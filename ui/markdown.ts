import { Marked, type Tokens } from "marked";

// 미리보기 카드 iframe 안에서 스크립트가 돌면 브리지로 velog_publish_post 같은
// 툴을 부를 수 있다. 본문은 GitHub 가져오기처럼 신뢰할 수 없는 출처에서 올 수
// 있으므로 raw HTML은 모두 이스케이프하고, URL은 허용한 스킴만 통과시킨다.
// 렌더 결과는 클라이언트에서 sanitize.ts(DOMPurify)를 한 번 더 거친다.

// 아래 렌더러(marked 18 기본 + 덮어쓴 link/image/html)가 만들 수 있는 태그와 속성.
// sanitize.ts의 허용 목록이자 테스트의 기준이다.
export const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "del",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "input",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "img",
];
export const ALLOWED_ATTR = [
  "href",
  "title",
  "rel",
  "src",
  "alt",
  "loading",
  "referrerpolicy",
  "class",
  "start",
  "type",
  "checked",
  "disabled",
  "align",
];

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const IMAGE_PROTOCOLS = new Set(["https:"]);

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 상대 경로나 파싱할 수 없는 값은 거부한다. WHATWG URL 파서가 브라우저와 같은
// 방식으로 제어 문자와 대소문자를 정규화하므로 "JaVa\tScript:" 같은 우회도 막힌다.
function allowUrl(value: string, protocols: Set<string>): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  return protocols.has(url.protocol) ? url.href : null;
}

export function safeLinkHref(href: string): string | null {
  return allowUrl(href, LINK_PROTOCOLS);
}

export function safeImageSrc(src: string): string | null {
  return allowUrl(src, IMAGE_PROTOCOLS);
}

const marked = new Marked({
  gfm: true,
  renderer: {
    // 블록·인라인 HTML 모두 텍스트로 보여준다. 블록은 원문 줄바꿈을 살린다.
    html(token: Tokens.HTML | Tokens.Tag): string {
      const escaped = escapeHtml(token.text);
      return "block" in token && token.block
        ? `<pre class="raw-html">${escaped.trimEnd()}</pre>\n`
        : escaped;
    },
    // <code>·<pre>·<kbd>·<script> 같은 인라인 태그 뒤에는 marked가 inRawBlock
    // 상태로 들어가 텍스트 토큰을 escaped: true와 원문 그대로 넘긴다. 기본 text
    // 렌더러는 이를 그대로 출력하므로 여기서 이스케이프한다. 이 상태는 같은 인라인
    // 구간(문단·제목·표 셀) 안에서 닫는 태그가 나올 때까지 강조·링크 안까지 이어진다.
    text(token: Tokens.Text | Tokens.Escape): string | false {
      if ("tokens" in token && token.tokens) return false;
      if ("escaped" in token && token.escaped) return escapeHtml(token.text);
      return false;
    },
    link({ href, title, tokens }: Tokens.Link): string {
      const inner = this.parser.parseInline(tokens);
      const safe = safeLinkHref(href);
      if (!safe) return inner;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(safe)}"${titleAttr} rel="noopener noreferrer">${inner}</a>`;
    },
    image({ href, title, text }: Tokens.Image): string {
      const safe = safeImageSrc(href);
      if (!safe) return escapeHtml(text);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" referrerpolicy="no-referrer">`;
    },
  },
});

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false });
}
