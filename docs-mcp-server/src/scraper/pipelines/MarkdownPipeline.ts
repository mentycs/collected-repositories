import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import type { ContentFetcher, RawContent } from "../fetcher/types";
import { MarkdownLinkExtractorMiddleware } from "../middleware/MarkdownLinkExtractorMiddleware";
import { MarkdownMetadataExtractorMiddleware } from "../middleware/MarkdownMetadataExtractorMiddleware";
import type { ContentProcessorMiddleware, MiddlewareContext } from "../middleware/types";
import type { ScraperOptions } from "../types";
import { convertToString } from "../utils/buffer";
import { BasePipeline } from "./BasePipeline";
import type { ProcessedContent } from "./types";

/**
 * Pipeline for processing Markdown content using middleware.
 */
export class MarkdownPipeline extends BasePipeline {
  private readonly middleware: ContentProcessorMiddleware[];

  constructor() {
    super();
    this.middleware = [
      new MarkdownMetadataExtractorMiddleware(),
      new MarkdownLinkExtractorMiddleware(),
    ];
  }

  canProcess(rawContent: RawContent): boolean {
    if (!rawContent.mimeType) return false;
    return (
      MimeTypeUtils.isMarkdown(rawContent.mimeType) ||
      MimeTypeUtils.isText(rawContent.mimeType)
    );
  }

  async process(
    rawContent: RawContent,
    options: ScraperOptions,
    fetcher?: ContentFetcher,
  ): Promise<ProcessedContent> {
    const contentString = convertToString(rawContent.content, rawContent.charset);

    const context: MiddlewareContext = {
      content: contentString,
      source: rawContent.source,
      metadata: {},
      links: [],
      errors: [],
      options,
      fetcher,
    };

    // Execute the middleware stack using the base class method
    await this.executeMiddlewareStack(this.middleware, context);

    return {
      textContent: typeof context.content === "string" ? context.content : "",
      metadata: context.metadata,
      links: context.links,
      errors: context.errors,
    };
  }

  async close(): Promise<void> {}
}
