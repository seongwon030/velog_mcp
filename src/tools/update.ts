import { graphql } from "../auth.js";

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
      updated_at
      user {
        username
      }
    }
  }
`;

export async function updatePost(params: {
  post_id: string;
  title?: string;
  body?: string;
  tags?: string[];
  is_private?: boolean;
  short_description?: string;
}): Promise<{ post_id: string; url_slug: string; url: string; updated_at: string }> {
  const { data } = await graphql<{
    editPost: {
      id: string;
      url_slug: string;
      updated_at: string;
      user: { username: string };
    };
  }>(EDIT_POST, {
    id: params.post_id,
    title: params.title,
    body: params.body,
    tags: params.tags,
    is_markdown: true,
    is_private: params.is_private,
    meta: params.short_description
      ? { short_description: params.short_description }
      : undefined,
  });

  const { id, url_slug, updated_at, user } = data.editPost;
  return {
    post_id: id,
    url_slug,
    url: `https://velog.io/@${user.username}/${url_slug}`,
    updated_at,
  };
}
