import { graphql } from "../auth.js";

const GET_READING_LIST = `
  query GetReadingList($type: ReadingListOption, $cursor: ID) {
    readingList(type: $type, cursor: $cursor) {
      id
      title
      url_slug
      short_description
      released_at
      user {
        username
      }
      tags
    }
  }
`;

type ReadingListPost = {
  id: string;
  title: string;
  url_slug: string;
  short_description: string | null;
  released_at: string;
  user: { username: string };
  tags: string[];
};

export async function getReadingList(params: {
  type?: "LIKED" | "READ";
}): Promise<{
  count: number;
  items: {
    id: string;
    title: string;
    url: string;
    short_description: string | null;
    tags: string[];
    released_at: string;
  }[];
}> {
  const { data } = await graphql<{ readingList: ReadingListPost[] }>(
    GET_READING_LIST,
    { type: params.type ?? "READ" },
  );
  const items = (data.readingList ?? []).map((post: ReadingListPost) => ({
    id: post.id,
    title: post.title,
    url: `https://velog.io/@${post.user.username}/${post.url_slug}`,
    short_description: post.short_description,
    tags: post.tags ?? [],
    released_at: post.released_at,
  }));

  return { count: items.length, items };
}
