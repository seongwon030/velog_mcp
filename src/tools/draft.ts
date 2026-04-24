import { nanoid } from "nanoid";

export interface Draft {
  draft_id: string;
  title: string;
  body: string;
  tags: string[];
  is_private: boolean;
  short_description?: string;
  thumbnail?: string;
  series_id?: string;
}

const drafts = new Map<string, Draft>();

export function createDraft(params: {
  title: string;
  body: string;
  tags?: string[];
  is_private?: boolean;
  short_description?: string;
  thumbnail?: string;
  series_id?: string;
}): Draft {
  const draft_id = nanoid(8);
  const draft: Draft = {
    draft_id,
    title: params.title,
    body: params.body,
    tags: params.tags ?? [],
    is_private: params.is_private ?? false,
    short_description: params.short_description,
    thumbnail: params.thumbnail,
    series_id: params.series_id,
  };
  drafts.set(draft_id, draft);
  return draft;
}

export function getDraft(draft_id: string): Draft {
  const draft = drafts.get(draft_id);
  if (!draft) {
    throw new Error(
      "draft_id가 존재하지 않습니다. velog_draft_post를 먼저 호출하세요.",
    );
  }
  return draft;
}

export function deleteDraft(draft_id: string): void {
  drafts.delete(draft_id);
}
