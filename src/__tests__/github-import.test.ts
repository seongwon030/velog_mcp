import { describe, expect, it } from "vitest";
import {
  parseFrontMatter,
  rewriteImageUrls,
} from "../tools/github-import/parse.js";

describe("parseFrontMatter", () => {
  it("returns empty data and full content when no front matter", () => {
    const content = "# Hello\n\nBody text.";
    const result = parseFrontMatter(content);
    expect(result.data).toEqual({});
    expect(result.body).toBe(content);
  });

  it("parses title and body", () => {
    const content = `---\ntitle: My Post\n---\n\nBody here.`;
    const { data, body } = parseFrontMatter(content);
    expect(data.title).toBe("My Post");
    expect(body).toBe("Body here.");
  });

  it("parses multiline tags array", () => {
    const content = `---\ntitle: Post\ntags:\n  - TypeScript\n  - Node.js\n---\n\nBody.`;
    const { data } = parseFrontMatter(content);
    expect(data.tags).toEqual(["TypeScript", "Node.js"]);
  });

  it("parses inline tags array", () => {
    const content = `---\ntags: [react, vue, svelte]\n---\n\nBody.`;
    const { data } = parseFrontMatter(content);
    expect(data.tags).toEqual(["react", "vue", "svelte"]);
  });

  it("parses description, excerpt, summary fields", () => {
    const content = `---\ndescription: Short desc\nexcerpt: Short exc\nsummary: Short sum\n---\n\nBody.`;
    const { data } = parseFrontMatter(content);
    expect(data.description).toBe("Short desc");
    expect(data.excerpt).toBe("Short exc");
    expect(data.summary).toBe("Short sum");
  });

  it("handles CRLF line endings", () => {
    const content = "---\r\ntitle: CRLF Post\r\n---\r\n\r\nBody.";
    const { data, body } = parseFrontMatter(content);
    expect(data.title).toBe("CRLF Post");
    expect(body).toBe("Body.");
  });

  it("strips quotes from values", () => {
    const content = `---\ntitle: "Quoted Title"\n---\n\nBody.`;
    const { data } = parseFrontMatter(content);
    expect(data.title).toBe("Quoted Title");
  });
});

describe("rewriteImageUrls", () => {
  const repo = "owner/repo";
  const branch = "main";
  const rawBase = `https://raw.githubusercontent.com/${repo}/${branch}`;

  it("rewrites relative image path to GitHub raw URL", () => {
    const body = "![alt](./image.png)";
    const result = rewriteImageUrls(body, repo, branch, "posts/post.md");
    expect(result).toBe(`![alt](${rawBase}/posts/image.png)`);
  });

  it("rewrites absolute image path to GitHub raw URL", () => {
    const body = "![alt](/images/banner.png)";
    const result = rewriteImageUrls(body, repo, branch, "post.md");
    expect(result).toBe(`![alt](${rawBase}/images/banner.png)`);
  });

  it("leaves https:// image URLs unchanged", () => {
    const body = "![alt](https://example.com/img.png)";
    const result = rewriteImageUrls(body, repo, branch, "post.md");
    expect(result).toBe(body);
  });

  it("handles file in root (no directory)", () => {
    const body = "![alt](image.png)";
    const result = rewriteImageUrls(body, repo, branch, "post.md");
    expect(result).toBe(`![alt](${rawBase}/image.png)`);
  });

  it("rewrites multiple images in one body", () => {
    const body = "![a](./a.png)\n\nSome text\n\n![b](/b.png)";
    const result = rewriteImageUrls(body, repo, branch, "dir/post.md");
    expect(result).toContain(`${rawBase}/dir/a.png`);
    expect(result).toContain(`${rawBase}/b.png`);
  });
});
