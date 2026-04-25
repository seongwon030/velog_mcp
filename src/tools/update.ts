import { graphql } from "../auth.js";
import { getPost } from "./get.js";

const EDIT_POST = `
  mutation EditPost(
    $id: ID!
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
    editPost(
      id: $id
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
        id
        username
      }
    }
  }
`;

export async function updatePost(params: {
  url_slug: string;
  title?: string;
  body?: string;
  tags?: string[];
  is_private?: boolean;
  short_description?: string;
  thumbnail?: string | null;
}): Promise<{ post_id: string; url_slug: string; url: string }> {
  const current = await getPost({ url_slug: params.url_slug });

  const { data } = await graphql<{
    editPost: {
      id: string;
      url_slug: string;
      user: { username: string };
    } | null;
  }>(EDIT_POST, {
    id: current.post_id,
    title: params.title ?? current.title,
    body: params.body ?? current.body,
    tags: params.tags ?? current.tags,
    is_markdown: true,
    is_temp: false,
    is_private: params.is_private ?? current.is_private,
    url_slug: params.url_slug,
    thumbnail:
      params.thumbnail !== undefined
        ? params.thumbnail
        : (current.thumbnail ?? null),
    meta: {
      short_description:
        params.short_description ?? current.short_description ?? "",
    },
    series_id: null,
    token: null,
  });

  if (!data.editPost) {
    throw new Error("포스트 수정에 실패했습니다. 토큰이 만료됐을 수 있습니다.");
  }

  const { id, url_slug, user } = data.editPost;
  return {
    post_id: id,
    url_slug,
    url: `https://velog.io/@${user.username}/${url_slug}`,
  };
}
