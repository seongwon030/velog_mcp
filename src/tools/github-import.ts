import { createDraft } from "./draft.js";

async function mapConcurrent<T, R>(
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

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

export function parseFrontMatter(content: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };

  const [, yaml, body] = match;
  const data: Record<string, unknown> = {};

  // Parse multiline arrays first (tags:\n  - a\n  - b)
  const yamlLines = yaml.split("\n");
  let i = 0;
  while (i < yamlLines.length) {
    const line = yamlLines[i];
    const keyOnly = line.match(/^([\w-]+):\s*$/);
    if (keyOnly) {
      const key = keyOnly[1];
      const items: string[] = [];
      i++;
      while (i < yamlLines.length && yamlLines[i].match(/^\s+-\s+/)) {
        items.push(
          yamlLines[i]
            .replace(/^\s+-\s+/, "")
            .replace(/^['"]|['"]$/g, "")
            .trim(),
        );
        i++;
      }
      if (items.length > 0) data[key] = items;
      continue;
    }

    const kv = line.match(/^([\w-]+):\s*(.+)$/);
    if (kv) {
      const [, key, value] = kv;
      const clean = value.trim().replace(/^['"]|['"]$/g, "");
      if (clean.startsWith("[") && clean.endsWith("]")) {
        data[key] = clean
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
      } else {
        data[key] = clean;
      }
    }
    i++;
  }

  return { data, body: body.trim() };
}

export function rewriteImageUrls(
  body: string,
  repo: string,
  branch: string,
  filePath: string,
): string {
  const baseDir = filePath.includes("/")
    ? filePath.slice(0, filePath.lastIndexOf("/"))
    : "";
  const rawBase = `https://raw.githubusercontent.com/${repo}/${branch}`;

  return body.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
    (_, alt, src) => {
      const trimmed = src.trim();
      let resolved: string;
      if (trimmed.startsWith("/")) {
        resolved = `${rawBase}${trimmed}`;
      } else {
        const relative = trimmed.replace(/^\.\//, "");
        resolved = baseDir
          ? `${rawBase}/${baseDir}/${relative}`
          : `${rawBase}/${relative}`;
      }
      return `![${alt}](${resolved})`;
    },
  );
}

async function fetchGitHubContents(
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
    throw new Error("GitHub API에 연결할 수 없습니다. 네트워크를 확인하세요.");
  });

  if (res.status === 404)
    throw new Error(
      `GitHub 경로를 찾을 수 없습니다: ${repo}/${filePath || "(root)"}`,
    );
  if (res.status === 403)
    throw new Error(
      "GitHub API 요청 한도 초과. github_token을 제공하면 한도가 높아집니다.",
    );
  if (!res.ok) throw new Error(`GitHub API 오류: ${res.status}`);

  const data = await res.json();
  return Array.isArray(data) ? (data as GitHubFile[]) : [data as GitHubFile];
}

async function collectMdFiles(
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

async function fetchRaw(url: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { "User-Agent": "velog-mcp" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new Error("파일을 가져올 수 없습니다.");
  });

  if (res.status === 403)
    throw new Error(
      "GitHub API 요청 한도 초과. github_token을 제공하면 한도가 높아집니다.",
    );
  if (!res.ok) throw new Error(`파일 다운로드 실패: ${res.status}`);
  return res.text();
}

export async function importFromGitHub(params: {
  repo: string;
  path?: string;
  branch?: string;
  github_token?: string;
  dry_run?: boolean;
}): Promise<{
  imported: number;
  skipped: number;
  dry_run: boolean;
  posts: Array<{
    source_file: string;
    title: string;
    tags: string[];
    draft_id?: string;
  }>;
  failed: Array<{ source_file: string; error: string }>;
}> {
  const { repo, branch = "main", github_token, dry_run = false } = params;
  const filePath = params.path ?? "";

  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(
      "repo 형식이 잘못되었습니다. 'owner/repo' 형식으로 입력하세요. (예: octocat/my-blog)",
    );
  }

  const mdFiles = await collectMdFiles(repo, filePath, branch, github_token);

  if (mdFiles.length === 0) {
    throw new Error(
      `지정한 경로에 .md 파일이 없습니다: ${repo}/${filePath || "(root)"}`,
    );
  }

  const posts: Array<{
    source_file: string;
    title: string;
    tags: string[];
    draft_id?: string;
  }> = [];
  const failed: Array<{ source_file: string; error: string }> = [];
  let skipped = 0;

  const CONCURRENCY = github_token ? 10 : 5;

  // Phase 1: 파일 fetch만 병렬로 — draft 생성 없음
  type FetchedFile = {
    file: GitHubFile;
    title: string;
    tags: string[];
    processedBody: string;
    shortDescription: string | undefined;
  };

  const fetchSettled = await mapConcurrent(
    mdFiles,
    CONCURRENCY,
    async (file): Promise<FetchedFile | null> => {
      if (!file.download_url) return null;
      const raw = await fetchRaw(file.download_url, github_token);
      const { data, body } = parseFrontMatter(raw);

      if (!body.trim()) return null;

      const title =
        (data.title as string | undefined) ??
        file.name
          .replace(/^\d{4}-\d{2}-\d{2}-/, "")
          .replace(/\.md$/, "")
          .replace(/[-_]/g, " ");

      const tags: string[] = Array.isArray(data.tags)
        ? (data.tags as string[])
        : Array.isArray(data.categories)
          ? (data.categories as string[])
          : typeof data.tags === "string"
            ? [data.tags as string]
            : [];

      return {
        file,
        title,
        tags,
        processedBody: rewriteImageUrls(body, repo, branch, file.path),
        shortDescription: (data.description ?? data.excerpt ?? data.summary) as
          | string
          | undefined,
      };
    },
  );

  // rate limit 에러가 하나라도 있으면 draft 생성 전에 중단
  for (let i = 0; i < fetchSettled.length; i++) {
    const result = fetchSettled[i];
    if (result.status === "rejected") {
      const msg = (result.reason as Error).message;
      if (msg.includes("한도 초과")) throw result.reason as Error;
      failed.push({ source_file: mdFiles[i].path, error: msg });
    }
  }

  // Phase 2: 네트워크 에러 없음 확인 후 draft 일괄 생성
  for (let i = 0; i < fetchSettled.length; i++) {
    const result = fetchSettled[i];
    if (result.status === "rejected") continue; // already in failed
    if (result.value === null) {
      skipped++;
      continue;
    }

    const { file, title, tags, processedBody, shortDescription } = result.value;

    if (dry_run) {
      posts.push({ source_file: file.path, title, tags });
      continue;
    }

    const draft = createDraft({
      title,
      body: processedBody,
      tags,
      short_description: shortDescription,
    });
    posts.push({
      source_file: file.path,
      title,
      tags,
      draft_id: draft.draft_id,
    });
  }

  return { imported: posts.length, skipped, dry_run, posts, failed };
}
