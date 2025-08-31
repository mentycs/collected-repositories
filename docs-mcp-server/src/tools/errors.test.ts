import { describe, expect, it, vi } from "vitest";
import { ToolError, VersionNotFoundError } from "./errors";

vi.mock("../utils/logger");

describe("Tool Errors", () => {
  describe("ToolError", () => {
    it("should create an instance with correct properties", () => {
      const error = new ToolError("Generic tool failure", "MyTool");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ToolError);
      expect(error.name).toBe("ToolError");
      expect(error.message).toBe("Generic tool failure");
      expect(error.toolName).toBe("MyTool");
    });
  });

  describe("VersionNotFoundError", () => {
    const library = "test-lib";
    const requestedVersion = "1.2.3";
    // Update test data to match LibraryVersionDetails
    const availableVersions = [
      {
        version: "1.0.0",
        documentCount: 10,
        uniqueUrlCount: 5,
        indexedAt: "2024-01-01T00:00:00Z",
      },
      {
        version: "2.0.0",
        documentCount: 20,
        uniqueUrlCount: 10,
        indexedAt: "2024-01-02T00:00:00Z",
      },
      {
        version: "1.1.0",
        documentCount: 15,
        uniqueUrlCount: 7,
        indexedAt: "2024-01-03T00:00:00Z",
      },
      {
        version: "2.0.0-beta.1",
        documentCount: 5,
        uniqueUrlCount: 3,
        indexedAt: "2024-01-04T00:00:00Z",
      },
    ];
    const emptyAvailable: Array<{
      version: string;
      documentCount: number;
      uniqueUrlCount: number;
      indexedAt: string | null;
    }> = [];

    it("should create an instance with correct properties", () => {
      const error = new VersionNotFoundError(
        library,
        requestedVersion,
        availableVersions,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ToolError); // Inherits from ToolError
      expect(error).toBeInstanceOf(VersionNotFoundError);
      expect(error.name).toBe("VersionNotFoundError");
      expect(error.message).toContain(
        `Version ${requestedVersion} not found for ${library}`,
      );
      expect(error.message).toContain("Available versions:");
      expect(error.library).toBe(library);
      expect(error.requestedVersion).toBe(requestedVersion);
      expect(error.availableVersions).toEqual(availableVersions);
      // Inherited property
      expect(error.toolName).toBe("SearchTool"); // Default toolName for this error
    });

    it("should correctly identify the latest semver version using getLatestVersion", () => {
      const error = new VersionNotFoundError(
        library,
        requestedVersion,
        availableVersions,
      );
      const latest = error.getLatestVersion();
      // Expect 2.0.0, as it's the highest stable version according to semver rules
      // Update assertion to match LibraryVersionDetails structure
      expect(latest).toEqual({
        version: "2.0.0",
        documentCount: 20,
        uniqueUrlCount: 10,
        indexedAt: "2024-01-02T00:00:00Z",
      });
    });

    it("should handle pre-release versions correctly in getLatestVersion", () => {
      // Update test data to match LibraryVersionDetails
      const versionsWithPrerelease = [
        {
          version: "1.0.0",
          documentCount: 10,
          uniqueUrlCount: 5,
          indexedAt: "2024-01-01T00:00:00Z",
        },
        {
          version: "1.1.0-alpha.1",
          documentCount: 5,
          uniqueUrlCount: 3,
          indexedAt: "2024-01-02T00:00:00Z",
        },
        {
          version: "1.1.0",
          documentCount: 15,
          uniqueUrlCount: 7,
          indexedAt: "2024-01-03T00:00:00Z",
        },
      ];
      const error = new VersionNotFoundError(
        library,
        requestedVersion,
        versionsWithPrerelease,
      );
      const latest = error.getLatestVersion();
      // Update assertion to match LibraryVersionDetails structure
      expect(latest).toEqual({
        version: "1.1.0",
        documentCount: 15,
        uniqueUrlCount: 7,
        indexedAt: "2024-01-03T00:00:00Z",
      }); // Stable 1.1.0 is > 1.1.0-alpha.1
    });

    it("should return undefined from getLatestVersion when availableVersions is empty", () => {
      const error = new VersionNotFoundError(library, requestedVersion, emptyAvailable);
      const latest = error.getLatestVersion();
      expect(latest).toBeUndefined();
    });

    it("should handle only pre-release versions in getLatestVersion", () => {
      // Update test data to match LibraryVersionDetails
      const onlyPrerelease = [
        {
          version: "1.0.0-rc.1",
          documentCount: 5,
          uniqueUrlCount: 3,
          indexedAt: "2024-01-01T00:00:00Z",
        },
        {
          version: "1.0.0-beta.2",
          documentCount: 3,
          uniqueUrlCount: 2,
          indexedAt: "2024-01-02T00:00:00Z",
        },
      ];
      const error = new VersionNotFoundError(library, requestedVersion, onlyPrerelease);
      const latest = error.getLatestVersion();
      // rc.1 > beta.2
      // Update assertion to match LibraryVersionDetails structure
      expect(latest).toEqual({
        version: "1.0.0-rc.1",
        documentCount: 5,
        uniqueUrlCount: 3,
        indexedAt: "2024-01-01T00:00:00Z",
      });
    });
  });
});
