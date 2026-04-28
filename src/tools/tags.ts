import { graphql } from "../auth.js";
import { getCurrentUsername } from "../utils/auth-helpers.js";

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
  const username = await getCurrentUsername();

  const { data } = await graphql<{
    userTags: {
      tags: { id: string; name: string; posts_count: number }[];
      posts_count: number;
    } | null;
  }>(GET_USER_TAGS, { username });

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
