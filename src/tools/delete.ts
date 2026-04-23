import { loadConfig } from "../auth.js";

const REMOVE_POST = `
  mutation RemovePost($id: ID!) {
    removePost(id: $id)
  }
`;

export async function deletePost(params: {
  post_id: string;
}): Promise<{ success: boolean; post_id: string }> {
  const cfg = loadConfig();

  const res = await fetch("https://v2.velog.io/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`,
      Origin: "https://velog.io",
      Referer: "https://velog.io/",
    },
    body: JSON.stringify({
      operationName: "RemovePost",
      variables: { id: params.post_id },
      query: REMOVE_POST,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const json = (await res.json()) as {
    data?: { removePost: boolean };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return { success: true, post_id: params.post_id };
}
