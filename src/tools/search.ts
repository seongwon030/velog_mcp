import { graphql } from "../auth.js";

const SEARCH_POSTS = `
  query SearchPosts($keyword: String!, $username: String) {
    searchPosts(keyword: $keyword, username: $username) {
      count
      posts {
        id
        title
        url_slug
        user {
          username
        }
      }
    }
  }
`;

export async function searchPosts(params: {
  keyword: string;
  username?: string;
}): Promise<{
  count: number;
  posts: {
    post_id: string;
    title: string;
    url_slug: string;
    username: string;
  }[];
}> {
  const { data } = await graphql<{
    searchPosts: {
      count: number;
      posts: {
        id: string;
        title: string;
        url_slug: string;
        user: { username: string };
      }[];
    };
  }>(SEARCH_POSTS, {
    keyword: params.keyword,
    username: params.username ?? null,
  });

  return {
    count: data.searchPosts.count,
    posts: data.searchPosts.posts.map((p) => ({
      post_id: p.id,
      title: p.title,
      url_slug: p.url_slug,
      username: p.user.username,
    })),
  };
}
