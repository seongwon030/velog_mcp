import { createDraft } from "../draft.js";
import { collectMdFiles, fetchRaw, mapConcurrent } from "./fetch.js";
import { parseFrontMatter, rewriteImageUrls } from "./parse.js";
import type { GitHubFile } from "./parse.js";

export { parseFrontMatter, rewriteImageUrls } from "./parse.js";

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

  type FetchedFile = {
    file: GitHubFile;
    title: string;
    tags: string[];
    processedBody: string;
    shortDescription: string | undefined;
  };

  // Phase 1: fetch files concurrently — no draft creation yet
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

  // Abort before creating any drafts if rate limit was hit
  for (let i = 0; i < fetchSettled.length; i++) {
    const result = fetchSettled[i];
    if (result.status === "rejected") {
      const msg = (result.reason as Error).message;
      if (msg.includes("한도 초과")) throw result.reason as Error;
      failed.push({ source_file: mdFiles[i].path, error: msg });
    }
  }

  // Phase 2: create drafts in bulk
  for (let i = 0; i < fetchSettled.length; i++) {
    const result = fetchSettled[i];
    if (result.status === "rejected") continue;
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
