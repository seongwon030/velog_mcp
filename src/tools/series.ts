import { graphql } from "../auth.js";
import { getCurrentUsername } from "../utils/auth-helpers.js";
import { toSlug } from "../utils/slug.js";

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
  mutation CreateSeries($name: String!, $url_slug: String!, $description: String) {
    createSeries(name: $name, url_slug: $url_slug, description: $description) {
      id
      name
      url_slug
      description
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

const EDIT_SERIES = `
  mutation EditSeries($id: ID!, $name: String!, $url_slug: String!) {
    editSeries(id: $id, name: $name, url_slug: $url_slug) {
      id
      name
      url_slug
    }
  }
`;

const DELETE_SERIES = `
  mutation DeleteSeries($id: ID!) {
    removeSeries(id: $id)
  }
`;

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
  const username = await getCurrentUsername();

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
  description?: string;
}): Promise<{
  series_id: string;
  name: string;
  url_slug: string;
  description: string | null;
  url: string;
}> {
  const username = await getCurrentUsername();
  const url_slug = params.url_slug ?? toSlug(params.name);

  const { data } = await graphql<{
    createSeries: {
      id: string;
      name: string;
      url_slug: string;
      description: string | null;
    } | null;
  }>(CREATE_SERIES, {
    name: params.name,
    url_slug,
    description: params.description ?? null,
  });

  if (!data.createSeries) {
    throw new Error("시리즈 생성에 실패했습니다.");
  }

  return {
    series_id: data.createSeries.id,
    name: data.createSeries.name,
    url_slug: data.createSeries.url_slug,
    description: data.createSeries.description,
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

export async function updateSeries(params: {
  series_id: string;
  name: string;
  url_slug?: string;
}): Promise<{
  series_id: string;
  name: string;
  url_slug: string;
  url: string;
}> {
  const username = await getCurrentUsername();
  const url_slug = params.url_slug ?? toSlug(params.name);

  const { data } = await graphql<{
    editSeries: { id: string; name: string; url_slug: string } | null;
  }>(EDIT_SERIES, { id: params.series_id, name: params.name, url_slug });

  if (!data.editSeries) {
    throw new Error("시리즈 수정에 실패했습니다.");
  }

  return {
    series_id: data.editSeries.id,
    name: data.editSeries.name,
    url_slug: data.editSeries.url_slug,
    url: `https://velog.io/@${username}/series/${data.editSeries.url_slug}`,
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
