import { describe, expect, it } from "vitest";
import { toSlug } from "../utils/slug.js";

describe("toSlug", () => {
  it("converts ASCII title to slug", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
  });

  it("preserves Korean characters", () => {
    expect(toSlug("나의 첫 포스트")).toBe("나의-첫-포스트");
  });

  it("removes special characters", () => {
    expect(toSlug("Hello! @World# $Test%")).toBe("hello-world-test");
  });

  it("truncates to 80 characters", () => {
    const long = "a".repeat(100);
    expect(toSlug(long).length).toBeLessThanOrEqual(80);
  });

  it("removes leading hyphens", () => {
    expect(toSlug("---hello")).toBe("hello");
  });

  it("returns nanoid fallback for emoji-only title", () => {
    const result = toSlug("🚀🎉✨");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns nanoid fallback for empty title", () => {
    const result = toSlug("");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("collapses multiple spaces into single hyphen", () => {
    expect(toSlug("hello   world")).toBe("hello-world");
  });
});
