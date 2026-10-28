import DOMPurify from "dompurify";
import {
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  safeImageSrc,
  safeLinkHref,
} from "./markdown.js";

// renderMarkdown 결과를 innerHTML에 넣기 직전의 2차 방어선. marked 내부 동작이
// 바뀌어 raw HTML이 새어 나와도 렌더러가 만드는 태그·속성만 남긴다.
const purify = DOMPurify(window);

// URL 스킴은 아래 훅이 WHATWG URL 파서로 다시 검사한다. ALLOWED_URI_REGEXP는 쓰지
// 않는다. DOMPurify가 이 정규식을 start·rel 같은 일반 속성 값에도 적용해서
// 렌더러가 만든 속성까지 지워 버리기 때문이다. 기본 URI 검사는 그대로 동작한다.

purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    const safe = safeLinkHref(node.getAttribute("href") ?? "");
    if (safe) node.setAttribute("href", safe);
    else node.removeAttribute("href");
  } else if (node.tagName === "IMG") {
    const safe = safeImageSrc(node.getAttribute("src") ?? "");
    if (safe) node.setAttribute("src", safe);
    else node.remove();
  } else if (
    node.tagName === "INPUT" &&
    node.getAttribute("type") !== "checkbox"
  ) {
    node.remove();
  }
});

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}
