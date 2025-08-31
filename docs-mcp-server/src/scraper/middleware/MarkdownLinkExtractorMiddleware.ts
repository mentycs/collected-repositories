import type { ContentProcessorMiddleware, MiddlewareContext } from "./types";

/**
 * Placeholder middleware for extracting links from Markdown content.
 * Currently, it does not implement link extraction, matching the
 * original MarkdownProcessor's TODO status.
 */
export class MarkdownLinkExtractorMiddleware implements ContentProcessorMiddleware {
  /**
   * Processes the context. Currently a no-op regarding link extraction.
   * @param context The current processing context.
   * @param next Function to call the next middleware.
   */
  async process(context: MiddlewareContext, next: () => Promise<void>): Promise<void> {
    // TODO: Implement Markdown link extraction (e.g., using regex or a Markdown parser)
    // For now, ensure context.links exists, defaulting to empty array if not set.
    if (!Array.isArray(context.links)) {
      context.links = [];
    }
    // No links are added here yet.

    await next();
  }
}
