import { graphql } from "../auth.js";

const REMOVE_POST = `
  mutation RemovePost($id: ID!) {
    removePost(id: $id)
  }
`;

export async function deletePost(params: {
  post_id: string;
}): Promise<{ success: boolean; post_id: string }> {
  await graphql(REMOVE_POST, { id: params.post_id });
  return { success: true, post_id: params.post_id };
}
