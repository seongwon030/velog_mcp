import { isAbsolute, resolve } from "node:path";
import { execFileNoThrow } from "../utils/execFileNoThrow.js";

interface CommitEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export async function gitToPost(params: {
  repo_path?: string;
  commits?: number;
  since?: string;
  max_diff_lines?: number;
  include_diff?: boolean;
  tags?: string[];
}): Promise<{
  git_summary: {
    commits: CommitEntry[];
    diff_summary: string;
    diff_excerpt: string;
  };
  suggested_structure: {
    title_hint: string;
    tag_hints: string[];
  };
  draft_prompt: string;
}> {
  const repoPath = params.repo_path ?? ".";
  const commitCount = params.commits ?? 5;
  const { since } = params;
  const maxDiffLines = params.max_diff_lines ?? 200;
  const includeDiff = params.include_diff !== false;

  const absPath = isAbsolute(repoPath)
    ? repoPath
    : resolve(process.cwd(), repoPath);

  const gitCheck = await execFileNoThrow("git", [
    "-C",
    absPath,
    "rev-parse",
    "--git-dir",
  ]);
  if (gitCheck.exitCode !== 0) {
    throw new Error(`유효한 git 레포가 아닙니다: ${absPath}`);
  }

  const range = since ? [`${since}..HEAD`] : [`-${commitCount}`];
  const logResult = await execFileNoThrow("git", [
    "-C",
    absPath,
    "log",
    ...range,
    "--pretty=format:%h|%s|%an|%aI",
    "--no-merges",
  ]);
  if (logResult.exitCode !== 0) {
    throw new Error(`git log 실패: ${logResult.stderr}`);
  }

  const parsedCommits = parseLogOutput(logResult.stdout);
  if (parsedCommits.length === 0) {
    throw new Error(
      "지정한 범위에 커밋이 없습니다. since 값이나 commits 수를 확인해 주세요.",
    );
  }

  const baseRef = since ?? `HEAD~${commitCount}`;

  const statResult = await execFileNoThrow("git", [
    "-C",
    absPath,
    "diff",
    baseRef,
    "HEAD",
    "--stat",
    "--diff-filter=d",
  ]);
  const diff_summary = statResult.stdout.trim();

  let diff_excerpt = "";
  if (includeDiff) {
    const diffResult = await execFileNoThrow("git", [
      "-C",
      absPath,
      "diff",
      baseRef,
      "HEAD",
      "--unified=3",
      "--diff-filter=d",
      "--no-color",
    ]);
    diff_excerpt = diffResult.stdout
      .split("\n")
      .filter((line) => !line.startsWith("Binary"))
      .slice(0, maxDiffLines)
      .join("\n");
  }

  const title_hint = parsedCommits[0]?.message ?? "";
  const tag_hints = inferTagHints(diff_summary, params.tags);
  const draft_prompt = buildDraftPrompt(
    parsedCommits,
    diff_summary,
    diff_excerpt,
    tag_hints,
  );

  return {
    git_summary: { commits: parsedCommits, diff_summary, diff_excerpt },
    suggested_structure: { title_hint, tag_hints },
    draft_prompt,
  };
}

function parseLogOutput(raw: string): CommitEntry[] {
  if (!raw.trim()) return [];
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [hash = "", message = "", author = "", date = ""] = line.split("|");
      return { hash, message, author, date };
    });
}

function inferTagHints(diffStat: string, userTags?: string[]): string[] {
  if (userTags && userTags.length > 0) return userTags;
  const hints = new Set<string>();
  if (diffStat.includes(".ts") || diffStat.includes(".tsx"))
    hints.add("TypeScript");
  if (diffStat.includes(".js") || diffStat.includes(".jsx"))
    hints.add("JavaScript");
  if (diffStat.includes(".py")) hints.add("Python");
  if (diffStat.includes(".go")) hints.add("Go");
  if (diffStat.includes(".rs")) hints.add("Rust");
  if (diffStat.includes("test") || diffStat.includes("spec"))
    hints.add("테스트");
  if (diffStat.includes("docker") || diffStat.includes("Dockerfile"))
    hints.add("Docker");
  if (diffStat.includes("README") || diffStat.includes(".md"))
    hints.add("문서화");
  return [...hints].slice(0, 4);
}

function buildDraftPrompt(
  commits: CommitEntry[],
  diffSummary: string,
  diffExcerpt: string,
  tagHints: string[],
): string {
  const commitList = commits
    .map((c) => `- [${c.hash}] ${c.message} (${c.date.slice(0, 10)})`)
    .join("\n");

  return `아래 git 변경 이력을 바탕으로 한국어 기술 블로그 포스트를 작성해 주세요.

[커밋 목록]
${commitList}

[변경된 파일]
${diffSummary || "(변경 없음)"}

[코드 변경 내용]
${diffExcerpt || "(diff 미포함)"}

포스트 구조:
1. 무엇을 왜 만들었는지 (배경)
2. 핵심 구현 내용 (코드 포함)
3. 결과 및 사용법
4. 마치며

태그 힌트: ${tagHints.join(", ") || "없음"}`;
}
