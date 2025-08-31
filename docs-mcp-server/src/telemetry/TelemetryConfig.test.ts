import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateInstallationId,
  shouldEnableTelemetry,
  TelemetryConfig,
} from "./TelemetryConfig";

// Mock fs and envPaths
vi.mock("node:fs");
vi.mock("env-paths", () => ({
  default: () => ({ data: "/mock/data/path" }),
}));

describe("TelemetryConfig", () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  it("should be enabled by default", () => {
    delete process.env.DOCS_MCP_TELEMETRY;
    process.argv = ["node", "script.js"];

    const config = new TelemetryConfig();
    expect(config.isEnabled()).toBe(true);
  });

  it("should disable when environment variable is false", () => {
    process.env.DOCS_MCP_TELEMETRY = "false";
    process.argv = ["node", "script.js"];

    const config = new TelemetryConfig();
    expect(config.isEnabled()).toBe(false);
  });

  it("should disable when --no-telemetry flag is present", () => {
    delete process.env.DOCS_MCP_TELEMETRY;
    process.argv = ["node", "script.js", "--no-telemetry"];

    const config = new TelemetryConfig();
    expect(config.isEnabled()).toBe(false);
  });

  it("should allow runtime enable/disable", () => {
    const config = new TelemetryConfig();
    config.disable();
    expect(config.isEnabled()).toBe(false);

    config.enable();
    expect(config.isEnabled()).toBe(true);
  });
});

describe("generateInstallationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate new UUID when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => "");

    const id = generateInstallationId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(fs.mkdirSync).toHaveBeenCalledWith("/mock/data/path", { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("/mock/data/path", "installation.id"),
      id,
      "utf8",
    );
  });

  it("should read existing UUID from file", () => {
    const existingId = "12345678-1234-4567-8901-123456789012";
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(existingId);

    const id = generateInstallationId();

    expect(id).toBe(existingId);
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join("/mock/data/path", "installation.id"),
      "utf8",
    );
  });

  it("should use DOCS_MCP_STORE_PATH environment variable when set", () => {
    const customPath = "/custom/store/path";
    const originalEnv = process.env.DOCS_MCP_STORE_PATH;
    process.env.DOCS_MCP_STORE_PATH = customPath;

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => "");

    const id = generateInstallationId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(fs.mkdirSync).toHaveBeenCalledWith(customPath, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(customPath, "installation.id"),
      id,
      "utf8",
    );

    // Cleanup
    if (originalEnv !== undefined) {
      process.env.DOCS_MCP_STORE_PATH = originalEnv;
    } else {
      delete process.env.DOCS_MCP_STORE_PATH;
    }
  });
});

describe("shouldEnableTelemetry", () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  it("should return true when telemetry is enabled", () => {
    delete process.env.DOCS_MCP_TELEMETRY;
    process.argv = ["node", "script.js"];

    const result = shouldEnableTelemetry();
    expect(result).toBe(true);
  });
});
