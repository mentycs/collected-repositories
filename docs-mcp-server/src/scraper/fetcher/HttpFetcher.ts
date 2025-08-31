import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { CancellationError } from "../../pipeline/errors";
import { analytics, extractHostname, extractProtocol } from "../../telemetry";
import { FETCHER_BASE_DELAY, FETCHER_MAX_RETRIES } from "../../utils/config";
import { RedirectError, ScraperError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import { FingerprintGenerator } from "./FingerprintGenerator";
import type { ContentFetcher, FetchOptions, RawContent } from "./types";

/**
 * Fetches content from remote sources using HTTP/HTTPS.
 */
export class HttpFetcher implements ContentFetcher {
  private readonly retryableStatusCodes = [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    525, // SSL Handshake Failed (Cloudflare specific)
  ];

  private fingerprintGenerator: FingerprintGenerator;

  constructor() {
    this.fingerprintGenerator = new FingerprintGenerator();
  }

  canFetch(source: string): boolean {
    return source.startsWith("http://") || source.startsWith("https://");
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    const startTime = performance.now();
    const maxRetries = options?.maxRetries ?? FETCHER_MAX_RETRIES;
    const baseDelay = options?.retryDelay ?? FETCHER_BASE_DELAY;
    // Default to following redirects if not specified
    const followRedirects = options?.followRedirects ?? true;

    try {
      const result = await this.performFetch(
        source,
        options,
        maxRetries,
        baseDelay,
        followRedirects,
      );

      // Track successful HTTP request
      const duration = performance.now() - startTime;
      analytics.track("http_request_completed", {
        success: true,
        hostname: extractHostname(source),
        protocol: extractProtocol(source),
        durationMs: Math.round(duration),
        contentSizeBytes: result.content.length,
        mimeType: result.mimeType,
        hasEncoding: !!result.encoding,
        followRedirects: followRedirects,
        hadRedirects: result.source !== source,
      });

      return result;
    } catch (error) {
      // Track failed HTTP request
      const duration = performance.now() - startTime;
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      analytics.track("http_request_completed", {
        success: false,
        hostname: extractHostname(source),
        protocol: extractProtocol(source),
        durationMs: Math.round(duration),
        statusCode: status,
        errorType:
          error instanceof CancellationError
            ? "cancellation"
            : error instanceof RedirectError
              ? "redirect"
              : error instanceof ScraperError
                ? "scraper"
                : "unknown",
        errorCode: axiosError.code,
        followRedirects: followRedirects,
      });

      throw error;
    }
  }

  private async performFetch(
    source: string,
    options?: FetchOptions,
    maxRetries = FETCHER_MAX_RETRIES,
    baseDelay = FETCHER_BASE_DELAY,
    followRedirects = true,
  ): Promise<RawContent> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const fingerprint = this.fingerprintGenerator.generateHeaders();
        const headers = {
          ...fingerprint,
          ...options?.headers, // User-provided headers override generated ones
        };

        const config: AxiosRequestConfig = {
          responseType: "arraybuffer",
          headers: {
            ...headers,
            // Override Accept-Encoding to exclude zstd which Axios doesn't handle automatically
            // This prevents servers from sending zstd-compressed content that would appear as binary garbage
            "Accept-Encoding": "gzip, deflate, br",
          },
          timeout: options?.timeout,
          signal: options?.signal, // Pass signal to axios
          // Axios follows redirects by default, we need to explicitly disable it if needed
          maxRedirects: followRedirects ? 5 : 0,
          decompress: true,
        };

        const response = await axios.get(source, config);

        const contentTypeHeader = response.headers["content-type"];
        const { mimeType, charset } = MimeTypeUtils.parseContentType(contentTypeHeader);
        const contentEncoding = response.headers["content-encoding"];

        // Convert ArrayBuffer to Buffer properly
        let content: Buffer;
        if (response.data instanceof ArrayBuffer) {
          content = Buffer.from(response.data);
        } else if (Buffer.isBuffer(response.data)) {
          content = response.data;
        } else if (typeof response.data === "string") {
          content = Buffer.from(response.data, "utf-8");
        } else {
          // Fallback for other data types
          content = Buffer.from(response.data);
        }

        // Determine the final effective URL after redirects (if any)
        const finalUrl =
          // Node follow-redirects style
          response.request?.res?.responseUrl ||
          // Some adapters may expose directly
          response.request?.responseUrl ||
          // Fallback to axios recorded config URL
          response.config?.url ||
          source;

        return {
          content,
          mimeType,
          charset,
          encoding: contentEncoding,
          source: finalUrl,
        } satisfies RawContent;
      } catch (error: unknown) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const code = axiosError.code;

        // Handle abort/cancel: do not retry, throw CancellationError
        if (options?.signal?.aborted || code === "ERR_CANCELED") {
          // Throw with isError = false to indicate cancellation is not an error
          throw new CancellationError("HTTP fetch cancelled");
        }

        // Handle redirect errors (status codes 301, 302, 303, 307, 308)
        if (!followRedirects && status && status >= 300 && status < 400) {
          const location = axiosError.response?.headers?.location;
          if (location) {
            throw new RedirectError(source, location, status);
          }
        }

        if (
          attempt < maxRetries &&
          (status === undefined || this.retryableStatusCodes.includes(status))
        ) {
          const delay = baseDelay * 2 ** attempt;
          logger.warn(
            `⚠️  Attempt ${attempt + 1}/${
              maxRetries + 1
            } failed for ${source} (Status: ${status}, Code: ${code}). Retrying in ${delay}ms...`,
          );
          await this.delay(delay);
          continue;
        }

        // Not a 5xx error or max retries reached
        throw new ScraperError(
          `Failed to fetch ${source} after ${
            attempt + 1
          } attempts: ${axiosError.message ?? "Unknown error"}`,
          true,
          error instanceof Error ? error : undefined,
        );
      }
    }
    throw new ScraperError(
      `Failed to fetch ${source} after ${maxRetries + 1} attempts`,
      true,
    );
  }
}
