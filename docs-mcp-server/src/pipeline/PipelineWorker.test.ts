import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ScraperService } from "../scraper";
import type { ScraperProgress } from "../scraper/types";
import type { DocumentManagementService } from "../store/DocumentManagementService";
import type { Document } from "../types";
import { PipelineWorker } from "./PipelineWorker";
import type { InternalPipelineJob, PipelineManagerCallbacks } from "./types";
import { PipelineJobStatus } from "./types";

// Mock dependencies
vi.mock("../store/DocumentManagementService");
vi.mock("../scraper/ScraperService");
vi.mock("../utils/logger");

describe("PipelineWorker", () => {
  let mockStore: Partial<DocumentManagementService>;
  let mockScraperService: Partial<ScraperService>;
  let mockCallbacks: PipelineManagerCallbacks;
  let worker: PipelineWorker;
  let mockJob: InternalPipelineJob;
  let abortController: AbortController;

  beforeEach(() => {
    vi.resetAllMocks();

    mockStore = {
      addDocument: vi.fn().mockResolvedValue(undefined),
      removeAllDocuments: vi.fn().mockResolvedValue(undefined),
    };

    mockScraperService = {
      // Mock scrape to allow simulation of progress callbacks
      scrape: vi.fn().mockImplementation(async (_options, _progressCallback, _signal) => {
        // Default: simulate immediate completion with no documents
        return Promise.resolve();
      }),
    };

    mockCallbacks = {
      onJobProgress: vi.fn().mockResolvedValue(undefined),
      onJobError: vi.fn().mockResolvedValue(undefined),
      onJobStatusChange: vi.fn().mockResolvedValue(undefined), // Not used by worker directly, but part of type
    };

    worker = new PipelineWorker(
      mockStore as DocumentManagementService,
      mockScraperService as ScraperService,
    );

    // Create a default mock job for tests
    abortController = new AbortController();
    mockJob = {
      id: "test-job-id",
      library: "test-lib",
      version: "1.0.0",
      status: PipelineJobStatus.RUNNING, // Assume worker receives a running job
      progress: null,
      error: null,
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      abortController: abortController,
      completionPromise: Promise.resolve(), // Mock promise parts if needed, but worker doesn't use them directly
      resolveCompletion: vi.fn(),
      rejectCompletion: vi.fn(),
      sourceUrl: "http://example.com",
      scraperOptions: {
        maxPages: 10,
        maxDepth: 1,
      },
    };
  });

  it("should execute job successfully, calling scrape, addDocument, and onJobProgress", async () => {
    const mockDoc1: Document = {
      content: "doc1",
      metadata: {
        url: "url1",
        title: "Doc 1",
        library: mockJob.library, // Add required field
        version: mockJob.version, // Add required field
      },
    };
    const mockDoc2: Document = {
      content: "doc2",
      metadata: {
        url: "url2",
        title: "Doc 2",
        library: mockJob.library, // Add required field
        version: mockJob.version, // Add required field
      },
    };

    // Configure mock scrape to yield progress
    (mockScraperService.scrape as Mock).mockImplementation(
      async (_options, progressCallback, _signal) => {
        const progress1: ScraperProgress = {
          pagesScraped: 1,
          totalPages: 2,
          currentUrl: "url1",
          depth: 1,
          maxDepth: 1,
          document: mockDoc1,
          totalDiscovered: 0,
        };
        await progressCallback(progress1);

        const progress2: ScraperProgress = {
          pagesScraped: 2,
          totalPages: 2,
          currentUrl: "url2",
          depth: 1,
          maxDepth: 1,
          document: mockDoc2,
          totalDiscovered: 0,
        };
        await progressCallback(progress2);
      },
    );

    await worker.executeJob(mockJob, mockCallbacks);

    // Verify documents were cleared before scraping started
    expect(mockStore.removeAllDocuments).toHaveBeenCalledOnce();
    expect(mockStore.removeAllDocuments).toHaveBeenCalledWith(
      mockJob.library,
      mockJob.version,
    );

    // Verify scrape was called
    expect(mockScraperService.scrape).toHaveBeenCalledOnce();
    expect(mockScraperService.scrape).toHaveBeenCalledWith(
      {
        url: mockJob.sourceUrl,
        library: mockJob.library,
        version: mockJob.version,
        ...mockJob.scraperOptions,
      },
      expect.any(Function), // The progress callback
      abortController.signal,
    );

    // Verify addDocument was called for each document
    expect(mockStore.addDocument).toHaveBeenCalledTimes(2);
    expect(mockStore.addDocument).toHaveBeenCalledWith(mockJob.library, mockJob.version, {
      pageContent: mockDoc1.content,
      metadata: mockDoc1.metadata,
    });
    expect(mockStore.addDocument).toHaveBeenCalledWith(mockJob.library, mockJob.version, {
      pageContent: mockDoc2.content,
      metadata: mockDoc2.metadata,
    });

    // Verify onJobProgress was called
    expect(mockCallbacks.onJobProgress).toHaveBeenCalledTimes(2);
    expect(mockCallbacks.onJobProgress).toHaveBeenCalledWith(
      mockJob,
      expect.objectContaining({ document: mockDoc1 }),
    );
    expect(mockCallbacks.onJobProgress).toHaveBeenCalledWith(
      mockJob,
      expect.objectContaining({ document: mockDoc2 }),
    );

    // Verify job progress object was NOT updated directly by worker
    // The worker should only call callbacks - the manager handles progress updates
    expect(mockJob.progress).toBeNull(); // Should remain null since worker doesn't update it directly

    // Verify no errors were reported
    expect(mockCallbacks.onJobError).not.toHaveBeenCalled();
  });

  it("should re-throw error if scraperService.scrape fails", async () => {
    const scraperError = new Error("Scraper failed");
    (mockScraperService.scrape as Mock).mockRejectedValue(scraperError);

    await expect(worker.executeJob(mockJob, mockCallbacks)).rejects.toThrow(scraperError);

    // Verify dependencies were called appropriately
    expect(mockScraperService.scrape).toHaveBeenCalledOnce();
    expect(mockStore.addDocument).not.toHaveBeenCalled();
    expect(mockCallbacks.onJobProgress).not.toHaveBeenCalled();
    expect(mockCallbacks.onJobError).not.toHaveBeenCalled();
  });

  it("should call onJobError and continue if store.addDocument fails", async () => {
    const mockDoc: Document = {
      content: "doc1",
      metadata: { url: "url1", title: "Doc 1", library: "test-lib", version: "1.0.0" },
    };
    const storeError = new Error("Database error");

    // Simulate scrape yielding one document
    (mockScraperService.scrape as Mock).mockImplementation(
      async (_options, progressCallback, _signal) => {
        const progress: ScraperProgress = {
          pagesScraped: 1,
          totalPages: 1,
          currentUrl: "url1",
          depth: 1,
          maxDepth: 1,
          document: mockDoc,
          totalDiscovered: 0,
        };
        await progressCallback(progress);
      },
    );

    // Simulate addDocument failing
    (mockStore.addDocument as Mock).mockRejectedValue(storeError);

    // Execute the job - should complete despite the error
    await expect(worker.executeJob(mockJob, mockCallbacks)).resolves.toBeUndefined();

    // Verify scrape was called
    expect(mockScraperService.scrape).toHaveBeenCalledOnce();
    // Verify addDocument was called
    expect(mockStore.addDocument).toHaveBeenCalledOnce();
    // Verify onJobProgress was called
    expect(mockCallbacks.onJobProgress).toHaveBeenCalledOnce();
    // Verify onJobError was called
    expect(mockCallbacks.onJobError).toHaveBeenCalledOnce();
    expect(mockCallbacks.onJobError).toHaveBeenCalledWith(mockJob, storeError, mockDoc);
  });

  it("should throw CancellationError if cancelled during scrape progress", async () => {
    const mockDoc: Document = {
      content: "doc1",
      metadata: { url: "url1", title: "Doc 1", library: "test-lib", version: "1.0.0" },
    };

    // Simulate scrape checking signal and throwing
    (mockScraperService.scrape as Mock).mockImplementation(
      async (_options, progressCallback, _signal) => {
        const progress: ScraperProgress = {
          pagesScraped: 1,
          totalPages: 2,
          currentUrl: "url1",
          depth: 1,
          maxDepth: 1,
          document: mockDoc,
          totalDiscovered: 0,
        };
        // Simulate cancellation happening *before* progress is processed by worker
        abortController.abort();
        // The worker's callback wrapper will check signal and throw
        await progressCallback(progress);
        // This part should not be reached
        throw new Error("Should have been cancelled");
      },
    );

    // Call executeJob once and check the specific error message
    await expect(worker.executeJob(mockJob, mockCallbacks)).rejects.toThrow(
      "Job cancelled during scraping progress",
    );
    // Also verify it's an instance of CancellationError if needed, though message check is often sufficient
    // await expect(worker.executeJob(mockJob, mockCallbacks)).rejects.toBeInstanceOf(CancellationError);

    // Verify scrape was called
    expect(mockScraperService.scrape).toHaveBeenCalledOnce();
    // Verify addDocument was NOT called
    expect(mockStore.addDocument).not.toHaveBeenCalled();
    // Verify onJobProgress was NOT called because cancellation check happens first
    expect(mockCallbacks.onJobProgress).not.toHaveBeenCalled();
    // Verify onJobError was NOT called
    expect(mockCallbacks.onJobError).not.toHaveBeenCalled();
  });

  it("should throw CancellationError if cancelled after scrape completes", async () => {
    // Simulate scrape completing successfully
    (mockScraperService.scrape as Mock).mockImplementation(
      async (_options, _progressCallback, _signal) => {
        // No progress needed for this test
        return Promise.resolve();
      },
    );

    // Abort *after* scrape would have finished but before worker checks again
    abortController.abort();

    // Call executeJob once and check the specific error message
    await expect(worker.executeJob(mockJob, mockCallbacks)).rejects.toThrow(
      "Job cancelled",
    );
    // Also verify it's an instance of CancellationError if needed
    // await expect(worker.executeJob(mockJob, mockCallbacks)).rejects.toBeInstanceOf(CancellationError);

    // Verify scrape was called (now only once)
    expect(mockScraperService.scrape).toHaveBeenCalledOnce();
    // Verify other callbacks not called
    expect(mockStore.addDocument).not.toHaveBeenCalled();
    expect(mockCallbacks.onJobProgress).not.toHaveBeenCalled();
    expect(mockCallbacks.onJobError).not.toHaveBeenCalled();
  });
});
