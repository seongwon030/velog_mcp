import { loadConfig } from "../auth.js";
import { getPost } from "./get.js";

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
