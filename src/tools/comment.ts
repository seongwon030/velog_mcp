import { loadConfig, graphql } from "../auth.js";
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

const CURRENT_USER = `
  query {
    auth {
      username
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
}): Promise<{ comments: CommentItem[] }> {
  const { data: userData } = await graphql<{ auth: { username: string } | null }>(CURRENT_USER);
  if (!userData.auth) {
    throw new Error("토큰이 만료됐거나 유효하지 않습니다. `npx -p velog-mcp-claude velog-mcp-setup`을 다시 실행하세요.");
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
  }>(GET_POST_COMMENTS, { username: userData.auth.username, url_slug: params.url_slug });

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
      operationName: "RemoveComment",
      query: REMOVE_COMMENT,
      variables: { id: params.comment_id },
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    throw new Error("Velog API에 연결할 수 없습니다. 네트워크를 확인하세요.");
  });

  if (res.status === 401) {
    throw new Error(
      "토큰이 만료됐거나 유효하지 않습니다. `npx -p velog-mcp-claude velog-mcp-setup`을 다시 실행하세요.",
    );
  }

  const json = await res.json() as {
    data?: { removeComment: boolean | null };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return { success: true, comment_id: params.comment_id };
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
  const cfg = loadConfig();
  const post = await getPost({ url_slug: params.url_slug });

  const res = await fetch("https://v2.velog.io/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`,
      Origin: "https://velog.io",
      Referer: "https://velog.io/",
    },
    body: JSON.stringify({
      operationName: "WriteComment",
      query: WRITE_COMMENT,
      variables: {
        post_id: post.post_id,
        text: params.text,
        comment_id: params.comment_id ?? null,
      },
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    throw new Error("Velog API에 연결할 수 없습니다. 네트워크를 확인하세요.");
  });

  if (res.status === 401) {
    throw new Error(
      "토큰이 만료됐거나 유효하지 않습니다. `npx -p velog-mcp-claude velog-mcp-setup`을 다시 실행하세요.",
    );
  }

  const json = await res.json() as {
    data?: { writeComment: { id: string; text: string; created_at: string } | null };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data?.writeComment) {
    throw new Error("댓글 작성에 실패했습니다.");
  }

  const c = json.data.writeComment;
  return { comment_id: c.id, text: c.text, created_at: c.created_at };
}
