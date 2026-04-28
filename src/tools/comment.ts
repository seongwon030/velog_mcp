import { graphql } from "../auth.js";
import { getCurrentUsername } from "../utils/auth-helpers.js";
import { getPost } from "./get.js";

const GET_POST_COMMENTS = `
  query ReadPostComments($username: String!, $url_slug: String!) {
    post(username: $username, url_slug: $url_slug) {
      comments {
        id
        text
        created_at
        user {
          username
        }
        replies {
          id
          text
          created_at
          user {
            username
          }
        }
      }
    }
  }
`;

type CommentItem = {
  id: string;
  text: string;
  created_at: string;
  username: string;
  replies: { id: string; text: string; created_at: string; username: string }[];
};

export async function getComments(params: {
  url_slug: string;
  username?: string;
}): Promise<{ comments: CommentItem[] }> {
  let username = params.username;

  if (!username) {
    username = await getCurrentUsername();
  }

  const { data } = await graphql<{
    post: {
      comments: {
        id: string;
        text: string;
        created_at: string;
        user: { username: string };
        replies: {
          id: string;
          text: string;
          created_at: string;
          user: { username: string };
        }[];
      }[];
    } | null;
  }>(GET_POST_COMMENTS, {
    username,
    url_slug: params.url_slug,
  });

  if (!data.post) {
    throw new Error(`포스트를 찾을 수 없습니다: ${params.url_slug}`);
  }

  const comments = (data.post.comments ?? []).map((c) => ({
    id: c.id,
    text: c.text,
    created_at: c.created_at,
    username: c.user.username,
    replies: (c.replies ?? []).map((r) => ({
      id: r.id,
      text: r.text,
      created_at: r.created_at,
      username: r.user.username,
    })),
  }));

  return { comments };
}

const REMOVE_COMMENT = `
  mutation RemoveComment($id: ID!) {
    removeComment(id: $id)
  }
`;

export async function deleteComment(params: {
  comment_id: string;
}): Promise<{ success: boolean; comment_id: string }> {
  await graphql<{ removeComment: boolean }>(REMOVE_COMMENT, {
    id: params.comment_id,
  });
  return { success: true, comment_id: params.comment_id };
}

const EDIT_COMMENT = `
  mutation EditComment($id: ID!, $text: String!) {
    editComment(id: $id, text: $text) {
      id
      text
      created_at
    }
  }
`;

export async function updateComment(params: {
  comment_id: string;
  text: string;
}): Promise<{ comment_id: string; text: string; created_at: string }> {
  const { data } = await graphql<{
    editComment: { id: string; text: string; created_at: string } | null;
  }>(EDIT_COMMENT, { id: params.comment_id, text: params.text });

  if (!data.editComment) {
    throw new Error("댓글 수정에 실패했습니다.");
  }

  const c = data.editComment;
  return { comment_id: c.id, text: c.text, created_at: c.created_at };
}

const WRITE_COMMENT = `
  mutation WriteComment($post_id: ID!, $text: String!, $comment_id: ID) {
    writeComment(post_id: $post_id, text: $text, comment_id: $comment_id) {
      id
      text
      created_at
    }
  }
`;

export async function writeComment(params: {
  url_slug: string;
  text: string;
  comment_id?: string;
}): Promise<{ comment_id: string; text: string; created_at: string }> {
  const post = await getPost({ url_slug: params.url_slug });

  const { data } = await graphql<{
    writeComment: { id: string; text: string; created_at: string } | null;
  }>(WRITE_COMMENT, {
    post_id: post.post_id,
    text: params.text,
    comment_id: params.comment_id ?? null,
  });

  if (!data.writeComment) {
    throw new Error("댓글 작성에 실패했습니다.");
  }

  const c = data.writeComment;
  return { comment_id: c.id, text: c.text, created_at: c.created_at };
}
