import { beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineClient } from "./PipelineClient";

vi.mock("../utils/logger");

// Mock tRPC client factory
const mockClient: any = {
  ping: { query: vi.fn() },
  enqueueJob: { mutate: vi.fn() },
  getJob: { query: vi.fn() },
  getJobs: { query: vi.fn() },
  cancelJob: { mutate: vi.fn() },
  clearCompletedJobs: { mutate: vi.fn() },
};

vi.mock("@trpc/client", () => {
  return {
    createTRPCProxyClient: () => mockClient,
    httpBatchLink: vi.fn(),
  } as any;
});

describe("PipelineClient", () => {
  let client: PipelineClient;
  const serverUrl = "http://localhost:8080";

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset default mock behaviors
    mockClient.ping.query.mockResolvedValue({ status: "ok" });
    mockClient.enqueueJob.mutate.mockResolvedValue({ jobId: "job-123" });
    mockClient.getJob.query.mockResolvedValue(undefined);
    mockClient.getJobs.query.mockResolvedValue({ jobs: [] });
    mockClient.cancelJob.mutate.mockResolvedValue({ success: true });
    mockClient.clearCompletedJobs.mutate.mockResolvedValue({ count: 5 });
    client = new PipelineClient(serverUrl);
  });

  describe("start", () => {
    it("should succeed when external worker is healthy", async () => {
      await expect(client.start()).resolves.toBeUndefined();
      expect(mockClient.ping.query).toHaveBeenCalled();
    });

    it("should fail when external worker is unreachable", async () => {
      mockClient.ping.query.mockRejectedValueOnce(new Error("Connection refused"));
      await expect(client.start()).rejects.toThrow(
        "Failed to connect to external worker",
      );
    });
  });

  describe("enqueueJob", () => {
    it("should delegate job creation to external API", async () => {
      const mockJobId = "job-123";
      mockClient.enqueueJob.mutate.mockResolvedValueOnce({ jobId: mockJobId });
      const jobId = await client.enqueueJob("react", "18.0.0", {
        url: "https://react.dev",
        library: "react",
        version: "18.0.0",
      });

      expect(jobId).toBe(mockJobId);
      expect(mockClient.enqueueJob.mutate).toHaveBeenCalledWith({
        library: "react",
        version: "18.0.0",
        options: {
          url: "https://react.dev",
          library: "react",
          version: "18.0.0",
        },
      });
    });

    it("should handle API errors gracefully", async () => {
      mockClient.enqueueJob.mutate.mockRejectedValueOnce(new Error("Bad request"));

      await expect(client.enqueueJob("invalid", null, {} as any)).rejects.toThrow(
        "Failed to enqueue job: Bad request",
      );
    });
  });

  describe("waitForJobCompletion", () => {
    it("should poll until job completes successfully", async () => {
      const jobId = "job-123";

      // Mock sequence: running -> running -> completed
      mockClient.getJob.query
        .mockResolvedValueOnce({ status: "running" })
        .mockResolvedValueOnce({ status: "running" })
        .mockResolvedValueOnce({ status: "completed" });

      await expect(client.waitForJobCompletion(jobId)).resolves.toBeUndefined();
      expect(mockClient.getJob.query).toHaveBeenCalledTimes(3);
    });

    it("should throw error when job fails", async () => {
      const jobId = "job-123";
      const error = { message: "Scraping failed" } as any;
      mockClient.getJob.query.mockResolvedValueOnce({ status: "failed", error });

      await expect(client.waitForJobCompletion(jobId)).rejects.toThrow("Scraping failed");
    });

    it("should prevent concurrent polling for same job", async () => {
      const jobId = "job-123";

      // Start first polling (mock hanging response)
      mockClient.getJob.query.mockImplementationOnce(
        () => new Promise(() => {}), // Never resolves
      );

      // Start first polling but don't await
      client.waitForJobCompletion(jobId);

      // Try to start second polling for same job
      await expect(client.waitForJobCompletion(jobId)).rejects.toThrow(
        "Already waiting for completion",
      );

      // Cleanup hanging promise
      await client.stop();
    });
  });

  describe("getJob", () => {
    it("should return undefined for non-existent job", async () => {
      mockClient.getJob.query.mockResolvedValueOnce(undefined);

      const result = await client.getJob("non-existent");
      expect(result).toBeUndefined();
    });

    it("should return job data for existing job", async () => {
      const mockJob = {
        id: "job-123",
        status: "completed",
        createdAt: "2023-01-01T00:00:00.000Z",
        startedAt: null,
        finishedAt: null,
        updatedAt: undefined,
      };
      const expectedJob = {
        id: "job-123",
        status: "completed",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        startedAt: null,
        finishedAt: null,
        updatedAt: undefined,
      };

      mockClient.getJob.query.mockResolvedValueOnce(mockJob);

      const result = await client.getJob("job-123");
      expect(result).toEqual(expectedJob);
    });
  });
});
