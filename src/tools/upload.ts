import fs from "fs";
import path from "path";
import { loadConfig } from "../auth.js";

export async function uploadImage(params: {
  file_path: string;
}): Promise<{ url: string }> {
  const cfg = loadConfig();

  const absolutePath = path.resolve(params.file_path);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${absolutePath}`);
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const fileName = path.basename(absolutePath);
  const ext = path.extname(fileName).toLowerCase();

  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const mimeType = mimeTypes[ext] ?? "application/octet-stream";

  const formData = new FormData();
  formData.append("image", new Blob([fileBuffer], { type: mimeType }), fileName);

  const res = await fetch("https://v2.velog.io/api/files/v3/upload", {
    method: "POST",
    headers: {
      Cookie: `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`,
      Origin: "https://velog.io",
      Referer: "https://velog.io/",
    },
    body: formData,
    signal: AbortSignal.timeout(30000),
  }).catch(() => {
    throw new Error("Velog API에 연결할 수 없습니다. 네트워크를 확인하세요.");
  });

  if (res.status === 401) {
    throw new Error(
      "토큰이 만료됐거나 유효하지 않습니다. `npx -p velog-mcp-claude velog-mcp-setup`을 다시 실행하세요.",
    );
  }

  const json = await res.json() as { path?: string; message?: string };

  if (!json.path) {
    throw new Error(json.message ?? "이미지 업로드에 실패했습니다.");
  }

  return { url: json.path };
}
