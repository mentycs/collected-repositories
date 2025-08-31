import { describe, expect, it, vi } from "vitest";
import type { ScraperOptions } from "../types";
import { MarkdownMetadataExtractorMiddleware } from "./MarkdownMetadataExtractorMiddleware";
import type { MiddlewareContext } from "./types";

// Suppress logger output during tests
vi.mock("../../utils/logger");

// Helper to create a minimal valid ScraperOptions object
const createMockScraperOptions = (url = "http://example.com"): ScraperOptions => ({
  url,
  library: "test-lib",
  version: "1.0.0",
  maxDepth: 0,
  maxPages: 1,
  maxConcurrency: 1,
  scope: "subpages",
  followRedirects: true,
  excludeSelectors: [],
  ignoreErrors: false,
});

const createMockContext = (
  markdownContent: string,
  source = "http://example.com",
  options?: Partial<ScraperOptions>,
): MiddlewareContext => {
  return {
    content: markdownContent,
    source,
    metadata: {},
    links: [],
    errors: [],
    options: { ...createMockScraperOptions(source), ...options },
  };
};

describe("MarkdownMetadataExtractorMiddleware", () => {
  it("should extract title from the first H1 heading", async () => {
    const middleware = new MarkdownMetadataExtractorMiddleware();
    const markdown = "# My Title\n\nSome content here.";
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.metadata.title).toBe("My Title");
    expect(context.errors).toHaveLength(0);
  });

  it("should default to 'Untitled' if no H1 heading is found", async () => {
    const middleware = new MarkdownMetadataExtractorMiddleware();
    const markdown = "Some content without any headings.";
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.metadata.title).toBe("Untitled");
    expect(context.errors).toHaveLength(0);
  });

  it("should trim whitespace from the extracted H1 title", async () => {
    const middleware = new MarkdownMetadataExtractorMiddleware();
    const markdown = "#   My Spaced Title  \n\nContent follows.";
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.metadata.title).toBe("My Spaced Title");
    expect(context.errors).toHaveLength(0);
  });

  it("should use only the first H1 heading if multiple exist", async () => {
    const middleware = new MarkdownMetadataExtractorMiddleware();
    const markdown = "# First Title\nSome text\n# Second Title";
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.metadata.title).toBe("First Title");
    expect(context.errors).toHaveLength(0);
  });

  it("should handle empty markdown content", async () => {
    const middleware = new MarkdownMetadataExtractorMiddleware();
    const markdown = "";
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.metadata.title).toBe("Untitled");
    expect(context.errors).toHaveLength(0);
  });

  it("should correctly extract title with other markdown elements around H1", async () => {
    const middleware = new MarkdownMetadataExtractorMiddleware();
    const markdown = "Some intro text.\n\n# The Actual Title\n\nMore text.";
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.metadata.title).toBe("The Actual Title");
    expect(context.errors).toHaveLength(0);
  });

  it("should handle errors during extraction and add to context.errors", async () => {
    const middleware = new MarkdownMetadataExtractorMiddleware();
    const context = createMockContext("# Test Title");
    const next = vi.fn().mockResolvedValue(undefined);

    // Create a spy that simulates an error during processing
    vi.spyOn(context, "content", "get").mockImplementation(() => {
      throw new Error("Simulated error");
    });

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce(); // Should still call next
    expect(context.errors).toHaveLength(1);
    expect(context.errors[0].message).toContain(
      "Failed to extract metadata from Markdown",
    );
    expect(context.errors[0].message).toContain("Simulated error");
  });
});
