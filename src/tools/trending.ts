const TRENDING_URL = "https://cache.velcdn.com/api/trending-posts";

type TimeFrame = "day" | "week" | "month" | "year";

export async function getTrending(params: {
  timeframe?: TimeFrame;
  limit?: number;
  offset?: number;
}): Promise<{
  posts: {
    post_id: string;
    title: string;
    url_slug: string;
    username: string;
    likes: number;
    comments: number;
    short_description: string;
    thumbnail: string | null;
    released_at: string;
  }[];
}> {
  const timeframe = params.timeframe ?? "week";
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const url = `${TRENDING_URL}?timeframe=${timeframe}&limit=${limit}&offset=${offset}`;

  const res = await fetch(url, {
    headers: {
      Referer: "https://velog.io/",
    },
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    throw new Error(
      "Velog 트렌딩 API에 연결할 수 없습니다. 네트워크를 확인하세요.",
    );
  });

  if (!res.ok) {
    throw new Error(
      `트렌딩 포스트를 가져오는 데 실패했습니다. (status: ${res.status})`,
    );
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

  return {
    posts: json.map((p) => ({
      post_id: p.id,
      title: p.title,
      url_slug: p.urlSlug,
      username: p.user.username,
      likes: p.likes,
      comments: p.comments,
      short_description: p.shortDescription,
      thumbnail: p.thumbnail ?? null,
      released_at: p.releasedAt,
    })),
  };
}
