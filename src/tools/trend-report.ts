import { graphql } from "../auth.js";

const TRENDING_URL = "https://cache.velcdn.com/api/trending-posts";

const POST_TAGS = `
  query PostTags($username: String!, $url_slug: String!) {
    post(username: $username, url_slug: $url_slug) {
      tags
    }
  }
`;

async function fetchTags(username: string, url_slug: string): Promise<string[]> {
  try {
    const { data } = await graphql<{ post: { tags: string[] } | null }>(
      POST_TAGS,
      { username, url_slug }
    );
    return data.post?.tags ?? [];
  } catch {
    return [];
  }
}

export async function getTrendReport(params: {
  timeframe?: "day" | "week" | "month" | "year";
  limit?: number;
}): Promise<{
  timeframe: string;
  fetched_at: string;
  posts: {
    rank: number;
    title: string;
    url: string;
    username: string;
    tags: string[];
    short_description: string;
    likes: number;
    comments: number;
    released_at: string;
  }[];
}> {
  const timeframe = params.timeframe ?? "week";
  const limit = Math.min(params.limit ?? 20, 40);

  const url = `${TRENDING_URL}?timeframe=${timeframe}&limit=${limit}&offset=0`;

  const res = await fetch(url, {
    headers: { Referer: "https://velog.io/" },
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    throw new Error("Velog 트렌딩 API에 연결할 수 없습니다.");
  });

  if (!res.ok) {
    throw new Error(`트렌딩 API 오류: status ${res.status}`);
  }

  const json = (await res.json()) as {
    id: string;
    title: string;
    urlSlug: string;
    likes: number;
    comments: number;
    shortDescription: string;
    thumbnail: string | null;
    releasedAt: string;
    user: { username: string };
  }[];

  const tagsResults = await Promise.all(
    json.map((p) => fetchTags(p.user.username, p.urlSlug))
  );

  return {
    timeframe,
    fetched_at: new Date().toISOString(),
    posts: json.map((p, i) => ({
      rank: i + 1,
      title: p.title,
      url: `https://velog.io/@${p.user.username}/${p.urlSlug}`,
      username: p.user.username,
      tags: tagsResults[i],
      short_description: p.shortDescription,
      likes: p.likes,
      comments: p.comments,
      released_at: p.releasedAt,
    })),
  };
}
