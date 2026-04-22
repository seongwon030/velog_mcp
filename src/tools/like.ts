import { graphql } from "../auth.js";

const LIKE_POST = `
  mutation LikePost($id: ID!) {
    likePost(id: $id) {
      id
      likes
    }
  }
`;

const UNLIKE_POST = `
  mutation UnlikePost($id: ID!) {
    unlikePost(id: $id) {
      id
      likes
    }
  }
`;

export async function likePost(params: {
  post_id: string;
}): Promise<{ post_id: string; likes: number | null }> {
  const { data } = await graphql<{
    likePost: { id: string; likes: number } | null;
  }>(LIKE_POST, { id: params.post_id });

  return {
    post_id: params.post_id,
    likes: data.likePost?.likes ?? null,
  };
}

export async function unlikePost(params: {
  post_id: string;
}): Promise<{ post_id: string; likes: number | null }> {
  const { data } = await graphql<{
    unlikePost: { id: string; likes: number } | null;
  }>(UNLIKE_POST, { id: params.post_id });

  return {
    post_id: params.post_id,
    likes: data.unlikePost?.likes ?? null,
  };
}
