import { graphql } from "../auth.js";

const CURRENT_USER = `
  query {
    auth {
      username
    }
  }
`;

const GET_TEMP_POSTS = `
  query GetTempPosts($username: String!) {
    posts(username: $username, temp_only: true) {
      id
      title
      url_slug
      updated_at
    }
  }
`;

export async function listTempPosts(): Promise<{
  posts: {
    post_id: string;
    title: string;
    url_slug: string;
    updated_at: string;
  }[];
}> {
  const { data: userData } = await graphql<{
    auth: { username: string } | null;
  }>(CURRENT_USER);
  if (!userData.auth) {
    throw new Error(
      "토큰이 만료됐거나 유효하지 않습니다. `npx -p velog-mcp-claude velog-mcp-setup`을 다시 실행하세요.",
    );
  }

  const { data } = await graphql<{
    posts: {
      id: string;
      title: string;
      url_slug: string;
      updated_at: string;
    }[];
  }>(GET_TEMP_POSTS, { username: userData.auth.username });

  return {
    posts: data.posts.map((p) => ({
      post_id: p.id,
      title: p.title,
      url_slug: p.url_slug,
      updated_at: p.updated_at,
    })),
  };
}
