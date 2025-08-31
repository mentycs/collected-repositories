/**
 * Telemetry configuration management for enabling/disabling analytics collection.
 * Handles CLI flags, environment variables, and default settings.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import envPaths from "env-paths";

export class TelemetryConfig {
  private static instance?: TelemetryConfig;
  private enabled: boolean;

  constructor() {
    this.enabled = this.determineEnabledState();
  }

  /**
   * Determines if telemetry should be enabled based on CLI flags and environment variables.
   * Priority: CLI flags > environment variables > default (true)
   */
  private determineEnabledState(): boolean {
    // Environment variable takes precedence
    if (process.env.DOCS_MCP_TELEMETRY === "false") {
      return false;
    }

    // Check for CLI flag (passed during initialization)
    const args = process.argv;
    if (args.includes("--no-telemetry")) {
      return false;
    }

    // Default to enabled for optional analytics
    return true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  disable(): void {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }

  static getInstance(): TelemetryConfig {
    if (!TelemetryConfig.instance) {
      TelemetryConfig.instance = new TelemetryConfig();
    }
    return TelemetryConfig.instance;
  }
}

/**
 * Generate or retrieve a persistent installation identifier.
 * Creates a UUID and stores it in a file in the user data directory.
 * Supports DOCS_MCP_STORE_PATH environment variable override for Docker deployments.
 * This ensures truly unique identification that persists across runs.
 */
export function generateInstallationId(): string {
  try {
    // Use DOCS_MCP_STORE_PATH if set (for Docker/custom deployments), otherwise use standard paths
    const envStorePath = process.env.DOCS_MCP_STORE_PATH;
    const dataDir = envStorePath || envPaths("docs-mcp-server", { suffix: "" }).data;
    const installationIdPath = path.join(dataDir, "installation.id");

    // Try to read existing installation ID
    if (fs.existsSync(installationIdPath)) {
      const existingId = fs.readFileSync(installationIdPath, "utf8").trim();
      if (existingId) {
        return existingId;
      }
    }

    // Generate new UUID and store it
    const newId = randomUUID();

    // Ensure directory exists
    fs.mkdirSync(dataDir, { recursive: true });

    // Write the installation ID
    fs.writeFileSync(installationIdPath, newId, "utf8");

    return newId;
  } catch {
    // Fallback to a session-only UUID if file operations fail
    // This ensures analytics always has a valid distinct ID
    return randomUUID();
  }
}

/**
 * Check if telemetry should be enabled based on environment and CLI flags.
 */
export function shouldEnableTelemetry(): boolean {
  return TelemetryConfig.getInstance().isEnabled();
}
