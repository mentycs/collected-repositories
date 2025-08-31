import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import type { ContentFetcher, RawContent } from "../fetcher/types";
import { HtmlSanitizerMiddleware } from "../middleware";
import { HtmlCheerioParserMiddleware } from "../middleware/HtmlCheerioParserMiddleware";
import { HtmlLinkExtractorMiddleware } from "../middleware/HtmlLinkExtractorMiddleware";
import { HtmlMetadataExtractorMiddleware } from "../middleware/HtmlMetadataExtractorMiddleware";
import { HtmlPlaywrightMiddleware } from "../middleware/HtmlPlaywrightMiddleware";
import { HtmlToMarkdownMiddleware } from "../middleware/HtmlToMarkdownMiddleware";
import type { ContentProcessorMiddleware, MiddlewareContext } from "../middleware/types";
import type { ScraperOptions } from "../types";
import { convertToString } from "../utils/buffer";
import { resolveCharset } from "../utils/charset";
import { BasePipeline } from "./BasePipeline";
import type { ProcessedContent } from "./types";

/**
 * Pipeline for processing HTML content using middleware.
 */
export class HtmlPipeline extends BasePipeline {
  private readonly playwrightMiddleware: HtmlPlaywrightMiddleware;
  private readonly standardMiddleware: ContentProcessorMiddleware[];

  constructor() {
    super();
    this.playwrightMiddleware = new HtmlPlaywrightMiddleware();
    this.standardMiddleware = [
      new HtmlCheerioParserMiddleware(),
      new HtmlMetadataExtractorMiddleware(),
      new HtmlLinkExtractorMiddleware(),
      new HtmlSanitizerMiddleware(),
      new HtmlToMarkdownMiddleware(),
    ];
  }

  canProcess(rawContent: RawContent): boolean {
    return MimeTypeUtils.isHtml(rawContent.mimeType);
  }

  async process(
    rawContent: RawContent,
    options: ScraperOptions,
    fetcher?: ContentFetcher,
  ): Promise<ProcessedContent> {
    // Use enhanced charset detection that considers HTML meta tags
    const resolvedCharset = resolveCharset(
      rawContent.charset,
      rawContent.content,
      rawContent.mimeType,
    );
    const contentString = convertToString(rawContent.content, resolvedCharset);

    const context: MiddlewareContext = {
      content: contentString,
      source: rawContent.source,
      metadata: {},
      links: [],
      errors: [],
      options,
      fetcher,
    };

    // Build middleware stack dynamically based on scrapeMode
    let middleware: ContentProcessorMiddleware[] = [...this.standardMiddleware];
    if (options.scrapeMode === "playwright" || options.scrapeMode === "auto") {
      middleware = [this.playwrightMiddleware, ...middleware];
    }

    // Execute the middleware stack using the base class method
    await this.executeMiddlewareStack(middleware, context);

    return {
      textContent: typeof context.content === "string" ? context.content : "",
      metadata: context.metadata,
      links: context.links,
      errors: context.errors,
    };
  }

  async close(): Promise<void> {
    await this.playwrightMiddleware.closeBrowser();
  }
}
