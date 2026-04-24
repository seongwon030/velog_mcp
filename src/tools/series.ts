import { graphql } from "../auth.js";

const CURRENT_USER = `
  query {
    auth {
      username
    }
  }
`;

const USER_SERIES_LIST = `
  query SeriesList($username: String!) {
    seriesList(username: $username) {
      id
      name
      description
      url_slug
      posts_count
      thumbnail
      updated_at
    }
  }
`;

const CREATE_SERIES = `
  mutation CreateSeries($name: String!, $url_slug: String!) {
    createSeries(name: $name, url_slug: $url_slug) {
      id
      name
      url_slug
    }
  }
`;

const APPEND_TO_SERIES = `
  mutation AppendToSeries($series_id: ID!, $post_id: ID!) {
    appendToSeries(series_id: $series_id, post_id: $post_id) {
      id
    }
  }
`;

const DELETE_SERIES = `
  mutation DeleteSeries($id: ID!) {
    removeSeries(id: $id)
  }
`;

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function getUsername(): Promise<string> {
  const { data } = await graphql<{ auth: { username: string } | null }>(
    CURRENT_USER,
  );
  if (!data.auth) {
    throw new Error(
      "토큰이 만료됐거나 유효하지 않습니다. `npx velog_mcp setup`을 다시 실행하세요.",
    );
  }
  return data.auth.username;
}

export async function listSeries(): Promise<{
  series: {
    series_id: string;
    name: string;
    description: string | null;
    url_slug: string;
    posts_count: number;
    thumbnail: string | null;
    updated_at: string;
    url: string;
  }[];
}> {
  const username = await getUsername();

  const { data } = await graphql<{
    seriesList: {
      id: string;
      name: string;
      description: string | null;
      url_slug: string;
      posts_count: number;
      thumbnail: string | null;
      updated_at: string;
    }[];
  }>(USER_SERIES_LIST, { username });

  return {
    series: data.seriesList.map((s) => ({
      series_id: s.id,
      name: s.name,
      description: s.description,
      url_slug: s.url_slug,
      posts_count: s.posts_count,
      thumbnail: s.thumbnail,
      updated_at: s.updated_at,
      url: `https://velog.io/@${username}/series/${s.url_slug}`,
    })),
  };
}

export async function createSeries(params: {
  name: string;
  url_slug?: string;
}): Promise<{
  series_id: string;
  name: string;
  url_slug: string;
  url: string;
}> {
  const username = await getUsername();
  const url_slug = params.url_slug ?? nameToSlug(params.name);

  const { data } = await graphql<{
    createSeries: { id: string; name: string; url_slug: string } | null;
  }>(CREATE_SERIES, { name: params.name, url_slug });

  if (!data.createSeries) {
    throw new Error("시리즈 생성에 실패했습니다.");
  }

  return {
    series_id: data.createSeries.id,
    name: data.createSeries.name,
    url_slug: data.createSeries.url_slug,
    url: `https://velog.io/@${username}/series/${data.createSeries.url_slug}`,
  };
}

export async function appendToSeries(params: {
  series_id: string;
  post_id: string;
}): Promise<{ success: boolean; series_id: string; post_id: string }> {
  const { data } = await graphql<{
    appendToSeries: { id: string } | null;
  }>(APPEND_TO_SERIES, {
    series_id: params.series_id,
    post_id: params.post_id,
  });

  if (!data.appendToSeries) {
    throw new Error("시리즈에 포스트 추가에 실패했습니다.");
  }

  return {
    success: true,
    series_id: params.series_id,
    post_id: params.post_id,
  };
}

export async function deleteSeries(params: {
  series_id: string;
}): Promise<{ success: boolean; series_id: string }> {
  const { data } = await graphql<{
    removeSeries: boolean;
  }>(DELETE_SERIES, { id: params.series_id });

  if (!data.removeSeries) {
    throw new Error("시리즈 삭제에 실패했습니다.");
  }

  return { success: true, series_id: params.series_id };
}
