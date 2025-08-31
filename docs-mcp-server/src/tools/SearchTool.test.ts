import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { DocumentManagementService } from "../store";
import type { StoreSearchResult } from "../store/types";
import { LibraryNotFoundError, VersionNotFoundError } from "./errors";
import { SearchTool, type SearchToolOptions } from "./SearchTool";

// Mock dependencies
vi.mock("../store");
vi.mock("../utils/logger");

describe("SearchTool", () => {
  let mockDocService: Partial<DocumentManagementService>;
  let searchTool: SearchTool;

  beforeEach(() => {
    vi.resetAllMocks();

    mockDocService = {
      validateLibraryExists: vi.fn(),
      findBestVersion: vi.fn(),
      searchStore: vi.fn(),
      listVersions: vi.fn(),
      listLibraries: vi.fn(),
    };

    searchTool = new SearchTool(mockDocService as DocumentManagementService);
  });

  const baseOptions: Omit<SearchToolOptions, "version" | "exactMatch" | "limit"> = {
    library: "test-lib",
    query: "test query",
  };

  const mockSearchResults: StoreSearchResult[] = [
    {
      url: "http://example.com/page1",
      content: "Content for result 1",
      score: 0.9,
    },
    {
      url: "http://example.com/page2",
      content: "Content for result 2",
      score: 0.8,
    },
  ];

  // --- Search Logic & Version Resolution Tests ---

  it("should search with exact version when exactMatch is true", async () => {
    const options: SearchToolOptions = {
      ...baseOptions,
      version: "1.0.0",
      exactMatch: true,
    };
    (mockDocService.searchStore as Mock).mockResolvedValue(mockSearchResults);

    const result = await searchTool.execute(options);

    expect(mockDocService.findBestVersion).not.toHaveBeenCalled();
    expect(mockDocService.searchStore).toHaveBeenCalledWith(
      "test-lib",
      "1.0.0", // Exact version
      "test query",
      5, // Default limit
    );
    expect(result.results).toEqual(mockSearchResults);
  });

  it("should throw VersionNotFoundError when exactMatch is true but no version is specified", async () => {
    const options: SearchToolOptions = {
      ...baseOptions,
      exactMatch: true,
    };
    // Mock listLibraries for this specific test case
    const mockLibraryDetails = [
      {
        library: "test-lib",
        versions: [
          {
            id: 1,
            ref: { library: "test-lib", version: "1.0.0" },
            status: "NOT_INDEXED",
            progress: { pages: 0, maxPages: 1 },
            counts: { documents: 1, uniqueUrls: 1 },
            indexedAt: "2024-01-01T00:00:00Z",
            sourceUrl: null,
          },
        ],
      },
    ];
    (mockDocService.validateLibraryExists as Mock).mockResolvedValue(undefined);
    (mockDocService.listLibraries as Mock).mockResolvedValue(mockLibraryDetails); // Mock listLibraries call

    await expect(searchTool.execute(options)).rejects.toThrow(VersionNotFoundError);
    expect(mockDocService.validateLibraryExists).toHaveBeenCalledWith("test-lib");
    expect(mockDocService.listLibraries).toHaveBeenCalled(); // Expect listLibraries now
    expect(mockDocService.listVersions).not.toHaveBeenCalled(); // Should not be called here
    expect(mockDocService.searchStore).not.toHaveBeenCalled();
  });

  it("should throw VersionNotFoundError when exactMatch is true with 'latest' version", async () => {
    const options: SearchToolOptions = {
      ...baseOptions,
      version: "latest",
      exactMatch: true,
    };
    // Mock listLibraries for this specific test case
    const mockLibraryDetails = [
      {
        library: "test-lib",
        versions: [
          {
            id: 1,
            ref: { library: "test-lib", version: "1.0.0" },
            status: "NOT_INDEXED",
            progress: { pages: 0, maxPages: 1 },
            counts: { documents: 1, uniqueUrls: 1 },
            indexedAt: "2024-01-01T00:00:00Z",
            sourceUrl: null,
          },
        ],
      },
    ];
    (mockDocService.validateLibraryExists as Mock).mockResolvedValue(undefined);
    (mockDocService.listLibraries as Mock).mockResolvedValue(mockLibraryDetails); // Mock listLibraries call

    await expect(searchTool.execute(options)).rejects.toThrow(VersionNotFoundError);
    expect(mockDocService.validateLibraryExists).toHaveBeenCalledWith("test-lib");
    expect(mockDocService.listLibraries).toHaveBeenCalled(); // Expect listLibraries now
    expect(mockDocService.listVersions).not.toHaveBeenCalled(); // Should not be called here
    expect(mockDocService.searchStore).not.toHaveBeenCalled();
  });

  it("should find best version and search when exactMatch is false (default)", async () => {
    const options: SearchToolOptions = { ...baseOptions, version: "1.x" };
    const findVersionResult = { bestMatch: "1.2.0", hasUnversioned: false };
    (mockDocService.findBestVersion as Mock).mockResolvedValue(findVersionResult);
    (mockDocService.searchStore as Mock).mockResolvedValue(mockSearchResults);

    const result = await searchTool.execute(options);

    expect(mockDocService.findBestVersion).toHaveBeenCalledWith("test-lib", "1.x");
    expect(mockDocService.searchStore).toHaveBeenCalledWith(
      "test-lib",
      "1.2.0", // Best matched version
      "test query",
      5,
    );
    expect(result.results).toEqual(mockSearchResults);
  });

  it("should search unversioned docs if findBestVersion returns null bestMatch but hasUnversioned", async () => {
    const options: SearchToolOptions = { ...baseOptions, version: "2.0.0" }; // Version doesn't exist
    const findVersionResult = { bestMatch: null, hasUnversioned: true };
    (mockDocService.findBestVersion as Mock).mockResolvedValue(findVersionResult);
    (mockDocService.searchStore as Mock).mockResolvedValue(mockSearchResults); // Assume searchStore handles null/"" correctly

    const result = await searchTool.execute(options);

    expect(mockDocService.findBestVersion).toHaveBeenCalledWith("test-lib", "2.0.0");
    // searchStore receives null, which it should normalize to "" for unversioned search
    expect(mockDocService.searchStore).toHaveBeenCalledWith(
      "test-lib",
      null,
      "test query",
      5,
    );
    expect(result.results).toEqual(mockSearchResults);
  });

  it("should use 'latest' for findBestVersion if version is omitted and exactMatch is false", async () => {
    const options: SearchToolOptions = { ...baseOptions }; // No version
    const findVersionResult = { bestMatch: "1.2.0", hasUnversioned: false };
    (mockDocService.findBestVersion as Mock).mockResolvedValue(findVersionResult);
    (mockDocService.searchStore as Mock).mockResolvedValue(mockSearchResults);

    await searchTool.execute(options);

    // The implementation passes undefined, which is defaulted to "latest" in the method
    expect(mockDocService.findBestVersion).toHaveBeenCalledWith("test-lib", undefined);
    expect(mockDocService.searchStore).toHaveBeenCalledWith(
      "test-lib",
      "1.2.0",
      "test query",
      5,
    );
  });

  // --- Limit Handling ---

  it("should use the specified limit", async () => {
    const options: SearchToolOptions = {
      ...baseOptions,
      version: "1.0.0",
      exactMatch: true,
      limit: 10,
    };
    (mockDocService.searchStore as Mock).mockResolvedValue([]);

    await searchTool.execute(options);

    expect(mockDocService.searchStore).toHaveBeenCalledWith(
      "test-lib",
      "1.0.0",
      "test query",
      10, // Specified limit
    );
  });

  // --- Error Handling & Result Structure ---

  it("should throw VersionNotFoundError and include available versions", async () => {
    const options: SearchToolOptions = { ...baseOptions, version: "nonexistent" };
    // Update test data to match LibraryVersionDetails
    const available = [
      {
        version: "1.0.0",
        documentCount: 5,
        uniqueUrlCount: 2,
        indexedAt: "2024-01-01T00:00:00Z",
      },
    ];
    const error = new VersionNotFoundError("test-lib", "nonexistent", available);
    (mockDocService.findBestVersion as Mock).mockRejectedValue(error);

    const executePromise = searchTool.execute(options);
    await expect(executePromise).rejects.toThrow(VersionNotFoundError);
    await expect(executePromise).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining("Version nonexistent not found"),
        availableVersions: available,
      }),
    );

    expect(mockDocService.findBestVersion).toHaveBeenCalledWith(
      "test-lib",
      "nonexistent",
    );
    expect(mockDocService.searchStore).not.toHaveBeenCalled();
  });

  it("should re-throw unexpected errors from findBestVersion", async () => {
    const options: SearchToolOptions = { ...baseOptions, version: "1.x" };
    const unexpectedError = new Error("Store connection failed");
    (mockDocService.findBestVersion as Mock).mockRejectedValue(unexpectedError);

    await expect(searchTool.execute(options)).rejects.toThrow("Store connection failed");
  });

  it("should throw LibraryNotFoundError and include suggestions", async () => {
    const options: SearchToolOptions = { ...baseOptions };
    const suggestions = ["test-lib-correct", "another-test-lib"];
    const error = new LibraryNotFoundError("test-lib", suggestions);
    (mockDocService.validateLibraryExists as Mock).mockRejectedValue(error);

    const executePromise = searchTool.execute(options);
    await expect(executePromise).rejects.toThrow(LibraryNotFoundError);
    await expect(executePromise).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining("Library 'test-lib' not found."),
        suggestions: suggestions,
      }),
    );

    expect(mockDocService.validateLibraryExists).toHaveBeenCalledWith("test-lib");
    expect(mockDocService.findBestVersion).not.toHaveBeenCalled();
    expect(mockDocService.searchStore).not.toHaveBeenCalled();
  });

  it("should re-throw unexpected errors from validateLibraryExists", async () => {
    const options: SearchToolOptions = { ...baseOptions };
    const unexpectedError = new Error("Validation DB connection failed");
    (mockDocService.validateLibraryExists as Mock).mockRejectedValue(unexpectedError);

    await expect(searchTool.execute(options)).rejects.toThrow(
      "Validation DB connection failed",
    );
  });

  it("should re-throw unexpected errors from searchStore", async () => {
    const options: SearchToolOptions = {
      ...baseOptions,
      version: "1.0.0",
      exactMatch: true,
    };
    const unexpectedError = new Error("Search index corrupted");
    (mockDocService.searchStore as Mock).mockRejectedValue(unexpectedError);

    await expect(searchTool.execute(options)).rejects.toThrow("Search index corrupted");
  });
});
