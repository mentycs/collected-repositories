import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { PipelineManager } from "../pipeline/PipelineManager";
import { ClearCompletedJobsTool } from "./ClearCompletedJobsTool";

// Mock dependencies
vi.mock("../pipeline/PipelineManager");
vi.mock("../utils/logger");

describe("ClearCompletedJobsTool", () => {
  let mockManagerInstance: Partial<PipelineManager>;
  let clearCompletedJobsTool: ClearCompletedJobsTool;

  beforeEach(() => {
    vi.resetAllMocks();

    // Define the mock implementation for the manager instance
    mockManagerInstance = {
      clearCompletedJobs: vi.fn().mockResolvedValue(0), // Default to no jobs cleared
    };

    // Instantiate the tool with the correctly typed mock instance
    clearCompletedJobsTool = new ClearCompletedJobsTool(
      mockManagerInstance as PipelineManager,
    );
  });

  it("should call manager.clearCompletedJobs", async () => {
    await clearCompletedJobsTool.execute({});
    expect(mockManagerInstance.clearCompletedJobs).toHaveBeenCalledOnce();
  });

  it("should return success: true with count when jobs are cleared", async () => {
    const clearedCount = 3;
    (mockManagerInstance.clearCompletedJobs as Mock).mockResolvedValue(clearedCount);

    const result = await clearCompletedJobsTool.execute({});

    expect(mockManagerInstance.clearCompletedJobs).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(clearedCount);
    expect(result.message).toContain("Successfully cleared 3 completed jobs");
  });

  it("should return success: true with singular message when 1 job is cleared", async () => {
    const clearedCount = 1;
    (mockManagerInstance.clearCompletedJobs as Mock).mockResolvedValue(clearedCount);

    const result = await clearCompletedJobsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(clearedCount);
    expect(result.message).toContain("Successfully cleared 1 completed job");
    expect(result.message).not.toContain("jobs"); // Should be singular
  });

  it("should return success: true with appropriate message when no jobs are cleared", async () => {
    const clearedCount = 0;
    (mockManagerInstance.clearCompletedJobs as Mock).mockResolvedValue(clearedCount);

    const result = await clearCompletedJobsTool.execute({});

    expect(result.success).toBe(true);
    expect(result.clearedCount).toBe(clearedCount);
    expect(result.message).toBe("No completed jobs to clear.");
  });

  it("should return success: false if clearCompletedJobs throws an error", async () => {
    const clearError = new Error("Clear operation failed");
    (mockManagerInstance.clearCompletedJobs as Mock).mockRejectedValue(clearError);

    const result = await clearCompletedJobsTool.execute({});

    expect(mockManagerInstance.clearCompletedJobs).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(result.clearedCount).toBe(0);
    expect(result.message).toContain("Failed to clear completed jobs");
    expect(result.message).toContain(clearError.message);
  });

  it("should handle non-Error exceptions gracefully", async () => {
    const clearError = "String error message";
    (mockManagerInstance.clearCompletedJobs as Mock).mockRejectedValue(clearError);

    const result = await clearCompletedJobsTool.execute({});

    expect(result.success).toBe(false);
    expect(result.clearedCount).toBe(0);
    expect(result.message).toContain("Failed to clear completed jobs");
    expect(result.message).toContain(clearError);
  });
});
