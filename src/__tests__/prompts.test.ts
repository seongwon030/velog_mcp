import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { getPrompt, listPrompts } from "../prompts.js";

describe("listPrompts", () => {
  it("returns prompts without build functions", () => {
    const prompts = listPrompts();
    expect(prompts.map((p) => p.name)).toEqual([
      "write_post",
      "trend_brief",
      "topic_ideas",
      "commits_to_post",
    ]);
    for (const p of prompts) {
      expect(p).not.toHaveProperty("build");
    }
  });
});

describe("getPrompt", () => {
  it("fills arguments into a single user message", () => {
    const result = getPrompt("write_post", {
      topic: "React 19",
      tags: "React",
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content.text).toContain("주제: React 19");
    expect(result.messages[0].content.text).toContain("태그: React");
  });

  it("keeps the publish guard in prompts that create drafts", () => {
    for (const name of ["write_post", "commits_to_post"]) {
      const args: Record<string, string> =
        name === "write_post" ? { topic: "x" } : {};
      const text = getPrompt(name, args).messages[0].content.text;
      expect(text).toContain("velog_publish_post를 호출하지 마");
    }
  });

  it("uses defaults when optional arguments are omitted", () => {
    expect(getPrompt("trend_brief").messages[0].content.text).toContain(
      'timeframe: "week"',
    );
    expect(getPrompt("commits_to_post").messages[0].content.text).toContain(
      "velog_git_to_post()",
    );
  });

  it("throws when a required argument is missing or blank", () => {
    expect(() => getPrompt("write_post")).toThrow(
      "필수 인자가 없습니다: topic",
    );
    expect(() => getPrompt("write_post", { topic: "  " })).toThrow(
      "필수 인자가 없습니다: topic",
    );
  });

  it("throws InvalidParams without an MCP error prefix", () => {
    expect(() => getPrompt("nope")).toThrow(
      expect.objectContaining({
        code: ErrorCode.InvalidParams,
        message: "알 수 없는 프롬프트: nope",
      }),
    );
  });

  it("quotes comma-separated focus_tags as a list", () => {
    const text = getPrompt("topic_ideas", {
      focus_tags: " React, ,TypeScript ",
    }).messages[0].content.text;
    expect(text).toContain('focus_tags: ["React", "TypeScript"]');
  });

  it("quotes repo_path and since", () => {
    const text = getPrompt("commits_to_post", {
      repo_path: "~/my repo",
      since: "v0.19.0",
    }).messages[0].content.text;
    expect(text).toContain(
      'velog_git_to_post(repo_path: "~/my repo", since: "v0.19.0")',
    );
  });

  it("treats blank optional arguments as omitted", () => {
    const text = getPrompt("trend_brief", { timeframe: "  " }).messages[0]
      .content.text;
    expect(text).toContain('timeframe: "week"');
  });
});
