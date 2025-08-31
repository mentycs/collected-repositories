import { describe, expect, it } from "vitest";
import { computeBaseDirectory, isInScope } from "./scope";

describe("computeBaseDirectory", () => {
  it("returns directory unchanged when pathname ends with slash", () => {
    expect(computeBaseDirectory("/api/")).toBe("/api/");
  });

  it("treats file-looking path as its parent directory", () => {
    expect(computeBaseDirectory("/api/index.html")).toBe("/api/");
    expect(computeBaseDirectory("/deep/path/file.md")).toBe("/deep/path/");
  });

  it("treats non-file last segment (no dot) as directory and appends slash", () => {
    expect(computeBaseDirectory("/api")).toBe("/api/");
    expect(computeBaseDirectory("/api/v1")).toBe("/api/v1/");
  });

  it("root path stays root", () => {
    expect(computeBaseDirectory("/")).toBe("/");
  });
});

describe("isInScope - subpages", () => {
  const baseFile = new URL("https://example.com/api/index.html");
  const baseDir = new URL("https://example.com/api/");
  const nested = new URL("https://example.com/api/child/page.html");
  const upward = new URL("https://example.com/shared/page.html");

  it("file base acts like its parent directory for descendants", () => {
    expect(isInScope(baseFile, nested, "subpages")).toBe(true);
  });

  it("directory base includes descendant", () => {
    expect(isInScope(baseDir, nested, "subpages")).toBe(true);
  });

  it("file base excludes upward sibling", () => {
    expect(isInScope(baseFile, upward, "subpages")).toBe(false);
  });

  it("non-file segment without slash acts as directory", () => {
    const base = new URL("https://example.com/api");
    expect(isInScope(base, nested, "subpages")).toBe(true);
  });
});

describe("isInScope - hostname and domain", () => {
  const base = new URL("https://docs.example.com/guide/");
  const sameHost = new URL("https://docs.example.com/guide/intro");
  const diffSub = new URL("https://api.example.com/endpoint");
  const diffDomain = new URL("https://other.org/");

  it("hostname scope restricts to exact hostname", () => {
    expect(isInScope(base, sameHost, "hostname")).toBe(true);
    expect(isInScope(base, diffSub, "hostname")).toBe(false);
  });

  it("domain scope allows different subdomains under same registrable domain", () => {
    expect(isInScope(base, diffSub, "domain")).toBe(true);
    expect(isInScope(base, diffDomain, "domain")).toBe(false);
  });

  it("domain scope handles complex TLDs correctly", () => {
    const baseCoUk = new URL("https://api.service.co.uk/docs");
    const sameCoUk = new URL("https://www.service.co.uk/other");
    const diffCoUk = new URL("https://different.co.uk/page");

    expect(isInScope(baseCoUk, sameCoUk, "domain")).toBe(true);
    expect(isInScope(baseCoUk, diffCoUk, "domain")).toBe(false);
  });

  it("domain scope handles GitHub Pages correctly", () => {
    const baseGithub = new URL("https://user.github.io/repo");
    const sameUser = new URL("https://user.github.io/other-repo");
    const diffUser = new URL("https://otheruser.github.io/repo");

    expect(isInScope(baseGithub, sameUser, "domain")).toBe(true);
    expect(isInScope(baseGithub, diffUser, "domain")).toBe(false);
  });

  it("domain scope handles gov.uk domains correctly", () => {
    // For .gov.uk, each service gets its own registrable domain
    const baseGov = new URL("https://api.service.gov.uk/docs");
    const sameGov = new URL("https://subdomain.api.service.gov.uk/assets"); // Same registrable domain
    const diffGov = new URL("https://api.different.gov.uk/docs"); // Different registrable domain
    const diffService = new URL("https://cdn.service.gov.uk/assets"); // Different service = different registrable domain

    expect(isInScope(baseGov, sameGov, "domain")).toBe(true);
    expect(isInScope(baseGov, diffGov, "domain")).toBe(false);
    expect(isInScope(baseGov, diffService, "domain")).toBe(false);
  });
});
