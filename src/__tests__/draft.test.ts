import { describe, expect, it } from "vitest";
import { createDraft, getDraft, markPublished } from "../tools/draft.js";

describe("markPublished", () => {
  it("tells callers the draft was already published instead of missing", () => {
    const { draft_id } = createDraft({ title: "t", body: "b" });
    markPublished(draft_id, "https://velog.io/@me/t");
    expect(() => getDraft(draft_id)).toThrow(
      "이미 발행된 초안입니다: https://velog.io/@me/t",
    );
  });

  it("keeps the missing-draft error for unknown ids", () => {
    expect(() => getDraft("nope")).toThrow("draft_id가 존재하지 않습니다");
  });
});
