import { graphql } from "../auth.js";

const GET_READING_LIST = `
  query GetReadingList($type: ReadingListOption, $cursor: ID) {
    readingList(type: $type, cursor: $cursor) {
      id
      post {
        id
        title
        url_slug
        short_description
        released_at
        likes
        user {
          username
        }
        tags
      }
      inserted_at
    }
  }
`;

type ReadingListItem = {
  id: string;
  post: {
    id: string;
    title: string;
    url_slug: string;
    short_description: string | null;
    released_at: string;
    likes: number;
    user: { username: string };
    tags: string[];
  };
  inserted_at: string;
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
    likes: number;
    released_at: string;
    saved_at: string;
  }[];
}> {
  const { data } = await graphql<{ readingList: ReadingListItem[] }>(
    GET_READING_LIST,
    { type: params.type ?? "READ" },
  );
  const items = (data.readingList ?? []).map((item: ReadingListItem) => ({
    id: item.post.id,
    title: item.post.title,
    url: `https://velog.io/@${item.post.user.username}/${item.post.url_slug}`,
    short_description: item.post.short_description,
    tags: item.post.tags ?? [],
    likes: item.post.likes,
    released_at: item.post.released_at,
    saved_at: item.inserted_at,
  }));

  return { count: items.length, items };
}
