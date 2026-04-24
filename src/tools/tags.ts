import { graphql } from "../auth.js";

const CURRENT_USER = `
  query {
    auth {
      username
    }
  }
`;

const GET_USER_TAGS = `
  query GetUserTags($username: String!) {
    userTags(username: $username) {
      tags {
        id
        name
        posts_count
      }
      posts_count
    }
  }
`;

export async function listTags(): Promise<{
  tags: { tag_id: string; name: string; posts_count: number }[];
  total_posts: number;
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
    userTags: {
      tags: { id: string; name: string; posts_count: number }[];
      posts_count: number;
    } | null;
  }>(GET_USER_TAGS, { username: userData.auth.username });

  if (!data.userTags) {
    return { tags: [], total_posts: 0 };
  }

  return {
    tags: data.userTags.tags.map((t) => ({
      tag_id: t.id,
      name: t.name,
      posts_count: t.posts_count,
    })),
    total_posts: data.userTags.posts_count,
  };
}
