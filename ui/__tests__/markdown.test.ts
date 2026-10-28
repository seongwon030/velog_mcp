import { describe, expect, it } from "vitest";
import {
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  renderMarkdown,
  safeImageSrc,
  safeLinkHref,
} from "../markdown.js";
import { fuzzInputs, RAW_BLOCK_PAYLOADS } from "./payloads.js";

// 출력에서 실제 태그만 뽑는다. 텍스트와 속성 값의 `<`·`>`는 이스케이프되므로
// `<...>` 덩어리는 모두 렌더러가 만든 태그다.
function tagsOf(html: string): { name: string; attrs: string[] }[] {
  return [...html.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)].map((m) => ({
    name: m[1].toLowerCase(),
    attrs: [...m[2].matchAll(/([^\s=/]+)(?:="[^"]*")?/g)].map((a) =>
      a[1].toLowerCase(),
    ),
  }));
}

// 텍스트의 `"`는 &quot;로 이스케이프되므로 남은 `"..."`는 모두 속성 값이다.
// alt 같은 속성 값 안의 이스케이프된 "onerror=" 글자는 실행되지 않으므로 뺀다.
function withoutAttrValues(html: string): string {
  return html.replace(/"[^"]*"/g, '""');
}

function expectOnlyAllowedMarkup(html: string): void {
  // 허용된 태그 이름이 바로 뒤따르지 않는 `<`는 없어야 한다.
  const stray = html.match(
    new RegExp(`<(?!/?(?:${ALLOWED_TAGS.join("|")})[\\s>/])`, "g"),
  );
  expect(stray, html).toBeNull();
  for (const tag of tagsOf(html)) {
    expect(ALLOWED_TAGS, html).toContain(tag.name);
    for (const attr of tag.attrs) expect(ALLOWED_ATTR, html).toContain(attr);
  }
}

describe("renderMarkdown raw HTML", () => {
  it("escapes block <script>", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes <img onerror> block HTML", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=");
  });

  it("escapes inline HTML inside a paragraph", () => {
    const html = renderMarkdown(
      'hello <span onclick="alert(1)">x</span> <b>bold</b>',
    );
    expect(html).not.toContain("<span");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;span onclick=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("escapes inline <svg onload> and <iframe>", () => {
    const html = renderMarkdown(
      'a <svg onload=alert(1)></svg> b <iframe src="https://evil.example"></iframe>',
    );
    expect(html).not.toMatch(/<svg|<iframe/);
  });
});

describe("renderMarkdown raw-block state (marked inRawBlock)", () => {
  it("escapes text after an inline <code> opener", () => {
    expect(renderMarkdown("좋은 글 <code> <img/src=x onerror=alert(1)>")).toBe(
      "<p>좋은 글 &lt;code&gt; &lt;img/src=x onerror=alert(1)&gt;</p>\n",
    );
  });

  it.each(RAW_BLOCK_PAYLOADS)("leaves no live tag for %j", (payload) => {
    const html = renderMarkdown(payload);
    expect(html).not.toMatch(/<img[\s/]/);
    expect(html).not.toMatch(/<svg|<script|<iframe|<\?|<!--|<!\[CDATA\[/);
    expect(withoutAttrValues(html)).not.toMatch(/<[^>]*\son\w+=/);
    expectOnlyAllowedMarkup(html);
  });

  it("fuzz: never emits markup outside the allowlist", () => {
    for (const input of fuzzInputs(3000)) {
      const html = renderMarkdown(input);
      expectOnlyAllowedMarkup(html);
      expect(withoutAttrValues(html), input).not.toMatch(/<[^>]*\son\w+=/);
      for (const m of html.matchAll(/<img src="([^"]*)"/g)) {
        expect(m[1]).toMatch(/^https:/);
      }
      for (const m of html.matchAll(/<a href="([^"]*)"/g)) {
        expect(m[1]).toMatch(/^(https?|mailto):/);
      }
    }
  });
});

describe("renderMarkdown links", () => {
  it("drops javascript: links but keeps text", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("drops obfuscated javascript: links", () => {
    for (const href of [
      "JaVaScRiPt:alert(1)",
      "java&#x09;script:alert(1)",
      "%20javascript:alert(1)",
    ]) {
      const html = renderMarkdown(`[x](${href})`);
      expect(html).not.toContain("<a");
    }
  });

  it("drops data: and relative links", () => {
    expect(renderMarkdown("[x](data:text/html,hi)")).not.toContain("<a");
    expect(renderMarkdown("[x](/relative)")).not.toContain("<a");
    expect(renderMarkdown("[x](#anchor)")).not.toContain("<a");
  });

  it("keeps http, https and mailto links", () => {
    expect(renderMarkdown("[a](https://velog.io/@me)")).toContain(
      '<a href="https://velog.io/@me" rel="noopener noreferrer">a</a>',
    );
    expect(renderMarkdown("[a](http://example.com)")).toContain(
      'href="http://example.com/"',
    );
    expect(renderMarkdown("[a](mailto:me@example.com)")).toContain(
      'href="mailto:me@example.com"',
    );
  });

  it("escapes quotes in link titles and hrefs", () => {
    const html = renderMarkdown('[a](https://example.com/?q=%22 "t\\"x")');
    expect(html).not.toMatch(/title="t"x"/);
    expect(html).toContain("&quot;");
  });

  it("renders autolinks through the same filter", () => {
    expect(renderMarkdown("<https://example.com>")).toContain(
      'href="https://example.com/"',
    );
    expect(renderMarkdown("https://example.com")).toContain(
      'href="https://example.com/"',
    );
  });
});

describe("renderMarkdown images", () => {
  it("drops javascript: and data: images, keeping alt text", () => {
    for (const src of [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "http://example.com/a.png",
    ]) {
      const html = renderMarkdown(`![alt text](${src})`);
      expect(html).not.toContain("<img");
      expect(html).toContain("alt text");
    }
  });

  it("keeps https images", () => {
    const html = renderMarkdown(
      "![thumb](https://velog.velcdn.com/images/a.png)",
    );
    expect(html).toContain(
      '<img src="https://velog.velcdn.com/images/a.png" alt="thumb"',
    );
  });

  it("escapes alt text", () => {
    const html = renderMarkdown('![" onerror="x](https://example.com/a.png)');
    expect(html).not.toMatch(/alt="" onerror=/);
  });
});

describe("renderMarkdown normal markdown", () => {
  it("renders headings, emphasis, lists, code, tables", () => {
    const html = renderMarkdown(
      [
        "# 제목",
        "",
        "**굵게** _기울임_ `code`",
        "",
        "- 하나",
        "- 둘",
        "",
        "```ts",
        "const a = '<b>';",
        "```",
        "",
        "| a | b |",
        "| - | - |",
        "| 1 | 2 |",
      ].join("\n"),
    );
    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain("<strong>굵게</strong>");
    expect(html).toContain("<em>기울임</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<li>하나</li>");
    expect(html).toContain('<code class="language-ts">');
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("<table>");
  });
});

describe("url helpers", () => {
  it("safeLinkHref allows only http/https/mailto", () => {
    expect(safeLinkHref("https://a.com")).toBe("https://a.com/");
    expect(safeLinkHref("vbscript:x")).toBeNull();
    expect(safeLinkHref("not a url")).toBeNull();
  });

  it("safeImageSrc allows only https", () => {
    expect(safeImageSrc("https://velog.velcdn.com/a.png")).toBe(
      "https://velog.velcdn.com/a.png",
    );
    expect(safeImageSrc("http://velog.velcdn.com/a.png")).toBeNull();
    expect(safeImageSrc("data:image/png;base64,AAAA")).toBeNull();
  });
});
