import { describe, expect, it } from "vitest";
import { titleToSlug } from "../tools/publish.js";

describe("titleToSlug", () => {
  it("converts ASCII title to slug", () => {
    expect(titleToSlug("Hello World")).toBe("hello-world");
  });

  it("preserves Korean characters", () => {
    expect(titleToSlug("나의 첫 포스트")).toBe("나의-첫-포스트");
  });

  it("removes special characters", () => {
    expect(titleToSlug("Hello! @World# $Test%")).toBe("hello-world-test");
  });

  it("truncates to 80 characters", () => {
    const long = "a".repeat(100);
    expect(titleToSlug(long).length).toBeLessThanOrEqual(80);
  });

  it("removes leading hyphens", () => {
    // Title starting with special chars would produce leading hyphens before the fix
    expect(titleToSlug("---hello")).toBe("hello");
  });

  it("returns nanoid fallback for emoji-only title", () => {
    const result = titleToSlug("🚀🎉✨");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns nanoid fallback for empty title", () => {
    const result = titleToSlug("");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("collapses multiple spaces into single hyphen", () => {
    expect(titleToSlug("hello   world")).toBe("hello-world");
  });
});
