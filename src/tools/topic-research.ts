import { getPost } from "./get.js";
import { listTags } from "./tags.js";
import { getTrending } from "./trending.js";

export async function topicResearch(params: {
  timeframe?: "day" | "week" | "month";
  limit?: number;
  focus_tags?: string[];
  compare_with_my_posts?: boolean;
}): Promise<{
  trending_tags: { tag: string; count: number; sample_titles: string[] }[];
  gap_tags: { tag: string; trending_rank: number }[];
  topics_i_cover: {
    tag: string;
    my_post_count: number;
    trending_rank: number;
  }[];
  suggested_reading: {
    title: string;
    url_slug: string;
    author: string;
    likes: number;
  }[];
}> {
  const timeframe = params.timeframe ?? "week";
  const limit = Math.min(params.limit ?? 15, 20);
  const compareWithMyPosts = params.compare_with_my_posts !== false;

  const { posts: trendingPosts } = await getTrending({ timeframe, limit });

  const postDetails = await Promise.all(
    trendingPosts.map((p) =>
      getPost({ url_slug: p.url_slug, username: p.username }).catch(
        () => null,
      ),
    ),
  );

  // Aggregate tag frequency from trending posts
  const tagMap = new Map<
    string,
    { count: number; titles: string[]; postIdx: number[] }
  >();
  postDetails.forEach((detail, idx) => {
    if (!detail) return;
    for (const tag of detail.tags) {
      if (params.focus_tags && !params.focus_tags.includes(tag)) continue;
      const entry = tagMap.get(tag) ?? { count: 0, titles: [], postIdx: [] };
      entry.count += 1;
      if (entry.titles.length < 3) entry.titles.push(detail.title);
      entry.postIdx.push(idx);
      tagMap.set(tag, entry);
    }
  });

  const sortedTags = [...tagMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([tag, { count, titles }], rank) => ({
      tag,
      count,
      sample_titles: titles,
      rank,
    }));

  const trending_tags = sortedTags.map(({ tag, count, sample_titles }) => ({
    tag,
    count,
    sample_titles,
  }));

  if (!compareWithMyPosts) {
    return {
      trending_tags,
      gap_tags: [],
      topics_i_cover: [],
      suggested_reading: [],
    };
  }

  const { tags: myTags } = await listTags();
  const myTagSet = new Set(myTags.map((t) => t.name));
  const myTagCount = new Map(myTags.map((t) => [t.name, t.posts_count]));

  const gap_tags = sortedTags
    .filter(({ tag }) => !myTagSet.has(tag))
    .map(({ tag, rank }) => ({ tag, trending_rank: rank + 1 }));

  const topics_i_cover = sortedTags
    .filter(({ tag }) => myTagSet.has(tag))
    .map(({ tag, rank }) => ({
      tag,
      my_post_count: myTagCount.get(tag) ?? 0,
      trending_rank: rank + 1,
    }));

  // Pick top-liked post per gap tag (dedup: one post per tag)
  const usedPostIds = new Set<string>();
  const suggested_reading: {
    title: string;
    url_slug: string;
    author: string;
    likes: number;
  }[] = [];

  for (const { tag } of gap_tags) {
    const entry = tagMap.get(tag);
    if (!entry) continue;
    const candidates = entry.postIdx
      .map((idx) => ({ post: trendingPosts[idx], detail: postDetails[idx] }))
      .filter(({ post, detail }) => detail && !usedPostIds.has(post.post_id))
      .sort((a, b) => b.post.likes - a.post.likes);

    if (candidates.length === 0) continue;
    const { post } = candidates[0];
    usedPostIds.add(post.post_id);
    suggested_reading.push({
      title: post.title,
      url_slug: post.url_slug,
      author: post.username,
      likes: post.likes,
    });
    if (suggested_reading.length >= 5) break;
  }

  return { trending_tags, gap_tags, topics_i_cover, suggested_reading };
}
