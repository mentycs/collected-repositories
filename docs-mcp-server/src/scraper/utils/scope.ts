// Utility for scope filtering, extracted from WebScraperStrategy
import type { URL } from "node:url";
import { extractPrimaryDomain } from "../../utils/url";

/**
 * Compute the effective base directory for scope=subpages.
 * Rules:
 * - If path ends with '/', treat as directory (keep as-is)
 * - Else if last segment contains a dot, treat as file and use its parent directory
 * - Else treat the path as a directory name (append '/')
 */
export function computeBaseDirectory(pathname: string): string {
  if (pathname === "") return "/";
  if (pathname.endsWith("/")) return pathname;
  const lastSegment = pathname.split("/").at(-1) || "";
  const looksLikeFile = lastSegment.includes(".");
  if (looksLikeFile) {
    return pathname.replace(/\/[^/]*$/, "/");
  }
  return `${pathname}/`;
}

/**
 * Returns true if the targetUrl is in scope of the baseUrl for the given scope.
 * - "subpages": same hostname, and target path starts with the parent directory of the base path
 * - "hostname": same hostname
 * - "domain": same top-level domain (e.g. example.com)
 */
export function isInScope(
  baseUrl: URL,
  targetUrl: URL,
  scope: "subpages" | "hostname" | "domain",
): boolean {
  if (baseUrl.protocol !== targetUrl.protocol) return false;

  switch (scope) {
    case "subpages": {
      if (baseUrl.hostname !== targetUrl.hostname) return false;
      const baseDir = computeBaseDirectory(baseUrl.pathname);
      return targetUrl.pathname.startsWith(baseDir);
    }
    case "hostname":
      return baseUrl.hostname === targetUrl.hostname;
    case "domain": {
      return (
        extractPrimaryDomain(baseUrl.hostname) ===
        extractPrimaryDomain(targetUrl.hostname)
      );
    }
    default:
      return false;
  }
}
