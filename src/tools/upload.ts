import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../auth.js";
import { ERR_TOKEN_EXPIRED, ERR_VELOG_NETWORK } from "../constants/errors.js";

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
  formData.append(
    "image",
    new Blob([fileBuffer], { type: mimeType }),
    fileName,
  );
  formData.append("type", "post");

  const res = await fetch("https://v3.velog.io/api/files/v3/upload", {
    method: "POST",
    headers: {
      Cookie: `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`,
      Origin: "https://velog.io",
      Referer: "https://velog.io/",
    },
    body: formData,
    signal: AbortSignal.timeout(30000),
  }).catch(() => {
    throw new Error(ERR_VELOG_NETWORK);
  });

  if (res.status === 401) {
    throw new Error(ERR_TOKEN_EXPIRED);
  }

  const json = (await res.json()) as { path?: string; message?: string };

  if (!json.path) {
    throw new Error(json.message ?? "이미지 업로드에 실패했습니다.");
  }

  return { url: json.path };
}
