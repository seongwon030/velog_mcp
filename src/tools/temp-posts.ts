import { graphql } from "../auth.js";
import { getCurrentUsername } from "../utils/auth-helpers.js";

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
  const username = await getCurrentUsername();

  const { data } = await graphql<{
    posts: {
      id: string;
      title: string;
      url_slug: string;
      updated_at: string;
    }[];
  }>(GET_TEMP_POSTS, { username });

  return {
    posts: data.posts.map((p) => ({
      post_id: p.id,
      title: p.title,
      url_slug: p.url_slug,
      updated_at: p.updated_at,
    })),
  };
}
