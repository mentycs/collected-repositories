import semver from "semver";

// LibraryVersionDetails removed; use minimal inline shape for available versions metadata

class ToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class VersionNotFoundError extends ToolError {
  constructor(
    public readonly library: string,
    public readonly requestedVersion: string,
    public readonly availableVersions: Array<{
      version: string;
      documentCount: number;
      uniqueUrlCount: number;
      indexedAt: string | null;
    }>,
  ) {
    super(
      `Version ${requestedVersion} not found for ${library}. Available versions: ${availableVersions.map((v) => v.version).join(", ")}`,
      "SearchTool",
    );
  }

  getLatestVersion() {
    return this.availableVersions.sort((a, b) => semver.compare(b.version, a.version))[0];
  }
}

/**
 * Error thrown when a requested library cannot be found in the store.
 * Includes suggestions for similar library names if available.
 */
class LibraryNotFoundError extends ToolError {
  constructor(
    public readonly requestedLibrary: string,
    public readonly suggestions: string[] = [],
  ) {
    let message = `Library '${requestedLibrary}' not found.`;
    if (suggestions.length > 0) {
      message += ` Did you mean one of these: ${suggestions.join(", ")}?`;
    }
    // Assuming this error might originate from various tools, but SearchTool is a primary candidate.
    // We might need to adjust the toolName if it's thrown elsewhere.
    super(message, "SearchTool");
  }
}

export { LibraryNotFoundError, ToolError, VersionNotFoundError };
