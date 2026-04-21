import { graphql } from "../auth.js";
import { getDraft, deleteDraft } from "./draft.js";

const WRITE_POST = `
  mutation WritePost(
    $title: String
    $body: String
    $tags: [String]
    $is_markdown: Boolean
    $is_temp: Boolean
    $is_private: Boolean
    $url_slug: String
    $thumbnail: String
    $meta: JSON
    $series_id: ID
    $token: String
  ) {
    writePost(
      title: $title
      body: $body
      tags: $tags
      is_markdown: $is_markdown
      is_temp: $is_temp
      is_private: $is_private
      url_slug: $url_slug
      thumbnail: $thumbnail
      meta: $meta
      series_id: $series_id
      token: $token
    ) {
      id
      url_slug
      user {
        username
      }
    }
  }
`;

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export async function publishPost(params: {
  draft_id: string;
  is_private?: boolean;
}): Promise<{ post_id: string; url_slug: string; url: string }> {
  const draft = getDraft(params.draft_id);
  const is_private = params.is_private ?? draft.is_private;

  const { data } = await graphql<{
    writePost: {
      id: string;
      url_slug: string;
      user: { username: string };
    } | null;
  }>(WRITE_POST, {
    title: draft.title,
    body: draft.body,
    tags: draft.tags,
    is_markdown: true,
    is_temp: false,
    is_private,
    url_slug: titleToSlug(draft.title),
    thumbnail: draft.thumbnail ?? null,
    meta: { short_description: draft.short_description ?? "" },
    series_id: null,
    token: null,
  });

  if (!data.writePost) {
    throw new Error(
      "포스트 발행에 실패했습니다. 토큰이 만료됐을 수 있습니다. npx velog-mcp-setup을 다시 실행하세요.",
    );
  }

  deleteDraft(params.draft_id);

  const { id, url_slug, user } = data.writePost!;
  return {
    post_id: id,
    url_slug,
    url: `https://velog.io/@${user.username}/${url_slug}`,
  };
}
