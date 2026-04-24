const RSS_BASE = "https://v2.velog.io/rss/@";

function parseTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(
    new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`),
  );
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return plainMatch ? plainMatch[1].trim() : "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function getRss(params: { username: string }): Promise<{
  username: string;
  posts: {
    title: string;
    url: string;
    description: string;
    published_at: string;
  }[];
}> {
  const res = await fetch(`${RSS_BASE}${params.username}`);
  if (!res.ok) {
    throw new Error(`RSS 요청 실패: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();

  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const posts = itemMatches.map((item) => ({
    title: stripHtml(parseTag(item, "title")),
    url: parseTag(item, "link"),
    description: stripHtml(parseTag(item, "description")).slice(0, 300),
    published_at: parseTag(item, "pubDate"),
  }));

  return { username: params.username, posts };
}
