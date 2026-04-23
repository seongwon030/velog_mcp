import { graphql } from "../auth.js";

const CURRENT_USER = `
  query {
    auth {
      username
    }
  }
`;

const GET_POSTS = `
  query GetPosts($username: String!, $limit: Int) {
    posts(username: $username, limit: $limit) {
      id
      title
      url_slug
      released_at
      is_private
    }
  }
`;

export async function listPosts(params: { limit?: number }): Promise<
  {
    post_id: string;
    title: string;
    url_slug: string;
    url: string;
    released_at: string;
    is_private: boolean;
  }[]
> {
  const { data: userData } = await graphql<{
    auth: { username: string } | null;
  }>(CURRENT_USER);

  if (!userData.auth) {
    throw new Error(
      "토큰이 만료됐거나 유효하지 않습니다. `npx velog_mcp setup`을 다시 실행하세요.",
    );
  }

  const username = userData.auth.username;
  const { data } = await graphql<{
    posts: {
      id: string;
      title: string;
      url_slug: string;
      released_at: string;
      is_private: boolean;
    }[];
  }>(GET_POSTS, { username, limit: params.limit ?? 20 });

  return data.posts.map((p) => ({
    post_id: p.id,
    title: p.title,
    url_slug: p.url_slug,
    url: `https://velog.io/@${username}/${p.url_slug}`,
    released_at: p.released_at,
    is_private: p.is_private,
  }));
}
