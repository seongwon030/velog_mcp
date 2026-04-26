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

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

interface DraftEntry {
  draft: Draft;
  createdAt: number;
}

const drafts = new Map<string, DraftEntry>();

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
  drafts.set(draft_id, { draft, createdAt: Date.now() });
  return draft;
}

export function getDraft(draft_id: string): Draft {
  const entry = drafts.get(draft_id);
  if (!entry) {
    throw new Error(
      "draft_id가 존재하지 않습니다. velog_draft_post를 먼저 호출하세요.",
    );
  }
  if (Date.now() - entry.createdAt > DRAFT_TTL_MS) {
    drafts.delete(draft_id);
    throw new Error(
      "draft가 만료되었습니다 (24시간). velog_draft_post를 다시 호출하세요.",
    );
  }
  return entry.draft;
}

export function deleteDraft(draft_id: string): void {
  drafts.delete(draft_id);
}
