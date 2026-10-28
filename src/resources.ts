import { readFile } from "node:fs/promises";

// MCP Apps(io.modelcontextprotocol/ui) 초안 미리보기 카드.
// HTML은 `npm run build`가 scripts/build-ui.mjs로 dist/ui/에 만든다.
export const DRAFT_PREVIEW_URI = "ui://velog/draft-preview";
const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
const DRAFT_PREVIEW_FILE = new URL("./ui/draft-preview.html", import.meta.url);

// 썸네일·본문 이미지는 velog CDN만 허용하고, 외부 fetch(connectDomains)는 열지 않는다.
const UI_META = {
  ui: { csp: { resourceDomains: ["https://velog.velcdn.com"] } },
};

export function listResources() {
  return [
    {
      uri: DRAFT_PREVIEW_URI,
      name: "velog_draft_preview",
      title: "Velog 초안 미리보기",
      description:
        "velog_draft_post 결과를 카드로 보여주고 발행 버튼을 제공하는 MCP Apps UI",
      mimeType: MCP_APP_MIME_TYPE,
      _meta: UI_META,
    },
  ];
}

export async function readResource(uri: string) {
  if (uri !== DRAFT_PREVIEW_URI) {
    throw new Error(`알 수 없는 리소스: ${uri}`);
  }
  let html: string;
  try {
    html = await readFile(DRAFT_PREVIEW_FILE, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "초안 미리보기 UI 파일(dist/ui/draft-preview.html)이 없습니다. npm run build로 UI를 빌드하세요.",
      );
    }
    throw e;
  }
  return [{ uri, mimeType: MCP_APP_MIME_TYPE, text: html, _meta: UI_META }];
}
