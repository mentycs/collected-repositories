import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let projectRoot: string | null = null;

/**
 * Finds the project root directory by searching upwards from the current file
 * for a directory containing 'package.json'. Caches the result.
 *
 * @returns {string} The absolute path to the project root.
 * @throws {Error} If package.json cannot be found.
 */
export function getProjectRoot(): string {
  // Return cached result if available
  if (projectRoot) {
    return projectRoot;
  }

  // Start from the directory of the current module
  const currentFilePath = fileURLToPath(import.meta.url);
  let currentDir = path.dirname(currentFilePath);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      projectRoot = currentDir; // Cache the result
      return projectRoot;
    }

    const parentDir = path.dirname(currentDir);
    // Check if we have reached the filesystem root
    if (parentDir === currentDir) {
      throw new Error("Could not find project root containing package.json.");
    }
    currentDir = parentDir;
  }
}
