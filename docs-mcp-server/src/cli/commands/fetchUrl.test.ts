/** Unit test for fetchUrlAction */

import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../scraper/fetcher", () => ({
  HttpFetcher: vi.fn().mockImplementation(() => ({})),
  FileFetcher: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("../../tools", () => ({
  FetchUrlTool: vi
    .fn()
    .mockImplementation(() => ({ execute: vi.fn(async () => "# md") })),
}));
vi.mock("../utils", () => ({ setupLogging: vi.fn(), parseHeaders: () => ({}) }));

import { fetchUrlAction } from "./fetchUrl";

function cmd() {
  return new Command();
}
beforeEach(() => vi.clearAllMocks());

describe("fetchUrlAction", () => {
  it("executes FetchUrlTool", async () => {
    await fetchUrlAction(
      "https://example.com",
      { followRedirects: true, scrapeMode: "auto" as any, header: [] },
      cmd(),
    );
    const { FetchUrlTool } = await import("../../tools");
    expect(FetchUrlTool).toHaveBeenCalledTimes(1);
  });
});
