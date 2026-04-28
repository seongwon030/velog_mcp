import { graphql } from "../auth.js";
import { getCurrentUsername } from "../utils/auth-helpers.js";

const READ_POST = `
  query ReadPost($username: String!, $url_slug: String!) {
    post(username: $username, url_slug: $url_slug) {
      id
      title
      body
      tags
      is_private
      is_temp
      url_slug
      thumbnail
      short_description
      released_at
      views
      series {
        id
      }
    }
  }
`;

export async function getPost(params: {
  url_slug: string;
  username?: string;
}): Promise<{
  post_id: string;
  title: string;
  body: string;
  tags: string[];
  is_private: boolean;
  is_temp: boolean;
  url_slug: string;
  thumbnail: string | null;
  short_description: string;
  released_at: string;
  views: number;
  series_id: string | null;
}> {
  let username = params.username;

  if (!username) {
    username = await getCurrentUsername();
  }

  const { data } = await graphql<{
    post: {
      id: string;
      title: string;
      body: string;
      tags: string[];
      is_private: boolean;
      is_temp: boolean;
      url_slug: string;
      thumbnail: string | null;
      short_description: string;
      released_at: string;
      views: number;
      series: { id: string } | null;
    } | null;
  }>(READ_POST, { username, url_slug: params.url_slug });

  if (!data.post) {
    throw new Error(`포스트를 찾을 수 없습니다: ${params.url_slug}`);
  }

  return {
    post_id: data.post.id,
    title: data.post.title,
    body: data.post.body,
    tags: data.post.tags,
    is_private: data.post.is_private,
    is_temp: data.post.is_temp,
    url_slug: data.post.url_slug,
    thumbnail: data.post.thumbnail,
    short_description: data.post.short_description,
    released_at: data.post.released_at,
    views: data.post.views,
    series_id: data.post.series?.id ?? null,
  };
}
