import {
  ERR_GITHUB_NETWORK,
  ERR_GITHUB_RATE_LIMIT,
} from "../../constants/errors.js";
import type { GitHubFile } from "./parse.js";

export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

export async function fetchGitHubContents(
  repo: string,
  filePath: string,
  branch: string,
  token?: string,
): Promise<GitHubFile[]> {
  const encodedPath = filePath
    ? `/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`
    : "";
  const url = `https://api.github.com/repos/${repo}/contents${encodedPath}?ref=${branch}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "velog-mcp",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new Error(ERR_GITHUB_NETWORK);
  });

  if (res.status === 404)
    throw new Error(
      `GitHub 경로를 찾을 수 없습니다: ${repo}/${filePath || "(root)"}`,
    );
  if (res.status === 403) throw new Error(ERR_GITHUB_RATE_LIMIT);
  if (!res.ok) throw new Error(`GitHub API 오류: ${res.status}`);

  const data = await res.json();
  return Array.isArray(data) ? (data as GitHubFile[]) : [data as GitHubFile];
}

export async function collectMdFiles(
  repo: string,
  filePath: string,
  branch: string,
  token?: string,
): Promise<GitHubFile[]> {
  const entries = await fetchGitHubContents(repo, filePath, branch, token);
  const mdFiles = entries.filter(
    (f) => f.type === "file" && f.name.endsWith(".md") && f.download_url,
  );
  const subdirs = entries.filter((f) => f.type === "dir");
  if (subdirs.length === 0) return mdFiles;
  const subResults = await Promise.all(
    subdirs.map((dir) => collectMdFiles(repo, dir.path, branch, token)),
  );
  return mdFiles.concat(...subResults);
}

export async function fetchRaw(url: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { "User-Agent": "velog-mcp" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new Error("파일을 가져올 수 없습니다.");
  });

  if (res.status === 403) throw new Error(ERR_GITHUB_RATE_LIMIT);
  if (!res.ok) throw new Error(`파일 다운로드 실패: ${res.status}`);
  return res.text();
}
