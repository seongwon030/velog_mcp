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
// 발행된 초안의 URL. 미리보기 카드처럼 모델이 모르는 경로로 발행된 초안을 다시
// 요청받았을 때 "존재하지 않음" 대신 이미 발행됐다고 알려주기 위해 남긴다.
const publishedUrls = new Map<string, string>();

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
  const publishedUrl = publishedUrls.get(draft_id);
  if (!entry && publishedUrl) {
    throw new Error(
      `이미 발행된 초안입니다: ${publishedUrl} 같은 초안은 다시 발행할 수 없습니다.`,
    );
  }
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

export function markPublished(draft_id: string, url: string): void {
  drafts.delete(draft_id);
  publishedUrls.set(draft_id, url);
}
