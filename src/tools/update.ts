import { loadConfig } from "../auth.js";
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
}): Promise<{ post_id: string; url_slug: string; url: string }> {
  const cfg = loadConfig();
  const current = await getPost({ url_slug: params.url_slug });

  const variables = {
    id: current.post_id,
    title: params.title ?? current.title,
    body: params.body ?? current.body,
    tags: params.tags ?? current.tags,
    is_markdown: true,
    is_temp: false,
    is_private: params.is_private ?? current.is_private,
    url_slug: params.url_slug,
    thumbnail: null,
    meta: { short_description: params.short_description ?? "" },
    series_id: null,
    token: null,
  };

  const res = await fetch("https://v2.velog.io/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`,
      Origin: "https://velog.io",
      Referer: "https://velog.io/",
    },
    body: JSON.stringify({
      operationName: "EditPost",
      variables,
      query: EDIT_POST,
    }),
  });

  const raw = await res.json() as { data?: { editPost: unknown } | null; errors?: { message: string }[] };

  if (!raw.data?.editPost) {
    throw new Error(`editPost 실패. status=${res.status}, raw=${JSON.stringify(raw)}`);
  }

  const post = raw.data.editPost as { id: string; url_slug: string; user: { username: string } };
  return {
    post_id: post.id,
    url_slug: post.url_slug,
    url: `https://velog.io/@${post.user.username}/${post.url_slug}`,
  };
}
