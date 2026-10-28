// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ALLOWED_ATTR, ALLOWED_TAGS, renderMarkdown } from "../markdown.js";
import { sanitizeHtml } from "../sanitize.js";
import { fuzzInputs, RAW_BLOCK_PAYLOADS } from "./payloads.js";

function expectSafeDom(html: string): void {
  const root = document.createElement("div");
  root.innerHTML = html;
  for (const el of root.querySelectorAll("*")) {
    expect(ALLOWED_TAGS, html).toContain(el.tagName.toLowerCase());
    for (const attr of el.attributes) {
      expect(ALLOWED_ATTR, html).toContain(attr.name);
      expect(attr.name).not.toMatch(/^on/);
    }
    if (el.tagName === "A" && el.hasAttribute("href")) {
      expect(el.getAttribute("href")).toMatch(/^(https?|mailto):/);
    }
    if (el.tagName === "IMG") {
      expect(el.getAttribute("src")).toMatch(/^https:/);
    }
    if (el.tagName === "INPUT") {
      expect(el.getAttribute("type")).toBe("checkbox");
    }
  }
}

describe("sanitizeHtml", () => {
  it("strips tags and attributes outside the allowlist", () => {
    const out = sanitizeHtml(
      '<p onclick="x" style="color:red">a<script>alert(1)</script><img src=x onerror=alert(1)><svg onload=1></svg><iframe></iframe><math></math><form><input type="text"></form><object></object></p>',
    );
    // <form>이 <p>를 닫아 빈 <p>가 하나 더 생기는 것은 HTML 파서 동작이다.
    expect(out).toBe("<p>a</p><p></p>");
  });

  it("removes unsafe link and image URLs", () => {
    const out = sanitizeHtml(
      '<a href="javascript:alert(1)">a</a><a href="data:text/html,x">b</a><img src="http://x/a.png" alt="h"><img src="data:image/png;base64,AA" alt="d">',
    );
    expect(out).toBe("<a>a</a><a>b</a>");
  });

  it("keeps what renderMarkdown emits for normal markdown", () => {
    const md = [
      "# 제목",
      "",
      "**굵게** _기울임_ ~~취소~~ `code` [링크](https://velog.io)",
      "",
      "![이미지](https://velog.velcdn.com/a.png)",
      "",
      "3. 셋",
      "4. 넷",
      "",
      "- [x] 완료",
      "",
      "> 인용",
      "",
      "| a | b |",
      "| :- | -: |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
      "---",
    ].join("\n");
    const html = renderMarkdown(md);
    const out = sanitizeHtml(html);
    const normalize = (s: string) => {
      const div = document.createElement("div");
      div.innerHTML = s;
      return div.innerHTML;
    };
    expect(out).toBe(normalize(html));
    expect(out).toContain('<img src="https://velog.velcdn.com/a.png"');
    expect(out).toContain('<a href="https://velog.io/"');
    expect(out).toContain('<ol start="3">');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('align="left"');
    expect(out).toContain('class="language-ts"');
  });

  it.each(RAW_BLOCK_PAYLOADS)("sanitize(renderMarkdown(%j)) is inert", (p) => {
    const out = sanitizeHtml(renderMarkdown(p));
    expect(out).not.toMatch(/<img[\s/]/);
    expect(out).not.toMatch(/<svg|<script|<iframe/);
    expect(out).not.toMatch(/<[^>]*\son\w+=/);
    expectSafeDom(out);
  });

  it("fuzz: sanitize(renderMarkdown(x)) keeps only allowlisted markup", () => {
    for (const input of fuzzInputs(1000, 7)) {
      expectSafeDom(sanitizeHtml(renderMarkdown(input)));
    }
  });
});
