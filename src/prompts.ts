import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  build: (args: Record<string, string>) => string;
}

const PUBLISH_GUARD =
  "내가 공개/비공개를 명시적으로 고르기 전에는 velog_publish_post를 호출하지 마.";

// McpError는 메시지 앞에 "MCP error <code>:"를 붙이고 클라이언트가 받은 메시지를
// 다시 McpError로 감싸 접두어가 두 번 붙는다. SDK는 던진 값의 code만 읽으므로
// code를 실은 일반 Error를 던진다.
function invalidParams(message: string): Error {
  return Object.assign(new Error(message), { code: ErrorCode.InvalidParams });
}

// "React, TypeScript" → "React", "TypeScript"
function toList(value: string): string {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => JSON.stringify(t))
    .join(", ");
}

const PROMPTS: PromptDefinition[] = [
  {
    name: "write_post",
    description:
      "주제를 받아 Velog 포스트 초안을 작성합니다. 발행은 확인 후 진행합니다.",
    arguments: [
      { name: "topic", description: "포스트 주제", required: true },
      { name: "tags", description: "태그 (쉼표로 구분, 생략 시 추천)" },
    ],
    build: (args) =>
      [
        "Velog에 올릴 포스트를 작성해줘.",
        `- 주제: ${args.topic}`,
        `- 태그: ${args.tags || "주제에 맞게 3~5개 추천"}`,
        "",
        "진행 순서:",
        "1. velog_search_posts로 비슷한 글을 찾아보고, 겹치지 않는 관점을 잡아.",
        "2. 마크다운 본문을 쓰고 velog_draft_post로 초안을 만든 뒤 draft_id와 body_preview를 보여줘.",
        `3. ${PUBLISH_GUARD}`,
      ].join("\n"),
  },
  {
    name: "trend_brief",
    description: "Velog 트렌딩 포스트를 주제별로 묶어 브리핑합니다.",
    arguments: [
      {
        name: "timeframe",
        description: "기간: day / week / month / year (기본값: week)",
      },
    ],
    build: (args) =>
      [
        `velog_trend_report(timeframe: "${args.timeframe || "week"}")로 트렌딩 데이터를 가져와서 브리핑해줘.`,
        "- 글들을 주제별로 묶고, 묶음마다 대표 글의 제목·링크·좋아요 수를 붙여.",
        "- 마지막에 이번 기간의 흐름을 세 줄로 요약해.",
      ].join("\n"),
  },
  {
    name: "topic_ideas",
    description:
      "트렌딩 태그와 내 포스트를 비교해 아직 안 쓴 인기 주제를 제안합니다.",
    arguments: [
      {
        name: "focus_tags",
        description: "관심 태그 (쉼표로 구분, 생략 시 전체)",
      },
    ],
    build: (args) =>
      [
        args.focus_tags
          ? `velog_topic_research(focus_tags: [${toList(args.focus_tags)}])로 주제를 분석해줘.`
          : "velog_topic_research로 주제를 분석해줘.",
        "- gap_tags를 바탕으로 내가 쓸 만한 주제 3개를 제안해.",
        "- 주제마다 제목 후보 2개와 참고할 트렌딩 글을 붙여.",
        "- 초안은 내가 주제를 고른 뒤에 만들어.",
      ].join("\n"),
  },
  {
    name: "commits_to_post",
    description: "최근 git 커밋과 diff로 기술 블로그 초안을 작성합니다.",
    arguments: [
      {
        name: "repo_path",
        description: "git 레포 경로 (기본값: 현재 디렉터리)",
      },
      {
        name: "since",
        description: "이 커밋·태그 이후만 분석 (예: v0.19.0, HEAD~10)",
      },
    ],
    build: (args) => {
      const options = [
        args.repo_path && `repo_path: ${JSON.stringify(args.repo_path)}`,
        args.since && `since: ${JSON.stringify(args.since)}`,
      ].filter(Boolean);
      return [
        `velog_git_to_post(${options.join(", ")})로 커밋 이력과 diff를 가져와줘.`,
        "- 무엇을 왜 바꿨는지 중심으로 한국어 기술 블로그 글을 써.",
        "- velog_draft_post로 초안을 만들고 draft_id와 body_preview를 보여줘.",
        `- ${PUBLISH_GUARD}`,
      ].join("\n");
    },
  },
];

export function listPrompts(): {
  name: string;
  description: string;
  arguments: PromptArgument[];
}[] {
  return PROMPTS.map((p) => ({
    name: p.name,
    description: p.description,
    arguments: p.arguments,
  }));
}

export function getPrompt(
  name: string,
  rawArgs: Record<string, string> = {},
): {
  description: string;
  messages: { role: "user"; content: { type: "text"; text: string } }[];
} {
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) {
    throw invalidParams(`알 수 없는 프롬프트: ${name}`);
  }
  // 앞뒤 공백을 지우고 빈 값은 생략한 것으로 본다.
  const args: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawArgs)) {
    if (value.trim()) args[key] = value.trim();
  }
  for (const arg of prompt.arguments) {
    if (arg.required && !args[arg.name]) {
      throw invalidParams(`필수 인자가 없습니다: ${arg.name}`);
    }
  }
  return {
    description: prompt.description,
    messages: [
      { role: "user", content: { type: "text", text: prompt.build(args) } },
    ],
  };
}
