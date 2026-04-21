#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createDraft } from "./tools/draft.js";
import { publishPost } from "./tools/publish.js";
import { listPosts } from "./tools/list.js";
import { getPost } from "./tools/get.js";
import { updatePost } from "./tools/update.js";
import { deletePost } from "./tools/delete.js";
import { uploadImage } from "./tools/upload.js";

const server = new Server(
  { name: "velog_mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "velog_draft_post",
      description:
        "Velog 포스트 초안을 세션 메모리에 저장합니다. 발행 전 사용자가 검토할 수 있도록 draft_id를 반환합니다.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "포스트 제목" },
          body: { type: "string", description: "마크다운 본문" },
          tags: { type: "array", items: { type: "string" }, description: "태그 목록" },
          is_private: { type: "boolean", description: "비공개 여부 (기본값: false)" },
          short_description: { type: "string", description: "포스트 요약" },
        },
        required: ["title", "body"],
      },
    },
    {
      name: "velog_publish_post",
      description:
        "초안(draft_id)을 Velog에 발행합니다. velog_draft_post 호출 후 사용하세요.",
      inputSchema: {
        type: "object",
        properties: {
          draft_id: { type: "string", description: "velog_draft_post에서 반환된 draft_id" },
          is_private: { type: "boolean", description: "비공개 발행 여부 (초안 설정 덮어씀)" },
        },
        required: ["draft_id"],
      },
    },
    {
      name: "velog_list_posts",
      description: "내 Velog 포스트 목록을 가져옵니다.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "가져올 포스트 수 (기본값: 20)" },
        },
      },
    },
    {
      name: "velog_get_post",
      description: "특정 Velog 포스트의 전체 내용을 가져옵니다.",
      inputSchema: {
        type: "object",
        properties: {
          url_slug: { type: "string", description: "포스트 URL slug" },
        },
        required: ["url_slug"],
      },
    },
    {
      name: "velog_update_post",
      description: "기존 Velog 포스트를 수정합니다.",
      inputSchema: {
        type: "object",
        properties: {
          url_slug: { type: "string", description: "수정할 포스트의 URL slug (예: my-post-title)" },
          title: { type: "string", description: "새 제목" },
          body: { type: "string", description: "새 마크다운 본문" },
          tags: { type: "array", items: { type: "string" }, description: "새 태그 목록" },
          is_private: { type: "boolean", description: "비공개 여부" },
          short_description: { type: "string", description: "새 요약" },
        },
        required: ["url_slug"],
      },
    },
    {
      name: "velog_delete_post",
      description: "Velog 포스트를 삭제합니다.",
      inputSchema: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "삭제할 포스트 ID" },
        },
        required: ["post_id"],
      },
    },
    {
      name: "velog_upload_image",
      description: "로컬 이미지 파일을 Velog에 업로드하고 URL을 반환합니다. 반환된 URL을 마크다운 본문에 사용하세요.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "업로드할 이미지 파일의 절대 경로 또는 상대 경로 (.jpg, .jpeg, .png, .gif, .webp)" },
        },
        required: ["file_path"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "velog_draft_post": {
        const params = z
          .object({
            title: z.string(),
            body: z.string(),
            tags: z.array(z.string()).optional(),
            is_private: z.boolean().optional(),
            short_description: z.string().optional(),
          })
          .parse(args);
        const draft = createDraft(params);
        const preview = draft.body.slice(0, 300) + (draft.body.length > 300 ? "..." : "");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                draft_id: draft.draft_id,
                title: draft.title,
                tags: draft.tags,
                is_private: draft.is_private,
                body_preview: preview,
              }),
            },
          ],
        };
      }

      case "velog_publish_post": {
        const params = z
          .object({ draft_id: z.string(), is_private: z.boolean().optional() })
          .parse(args);
        const result = await publishPost(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_list_posts": {
        const params = z.object({ limit: z.number().optional() }).parse(args ?? {});
        const posts = await listPosts(params);
        return { content: [{ type: "text", text: JSON.stringify(posts) }] };
      }

      case "velog_get_post": {
        const params = z.object({ url_slug: z.string() }).parse(args);
        const post = await getPost(params);
        return { content: [{ type: "text", text: JSON.stringify(post) }] };
      }

      case "velog_update_post": {
        const params = z
          .object({
            url_slug: z.string(),
            title: z.string().optional(),
            body: z.string().optional(),
            tags: z.array(z.string()).optional(),
            is_private: z.boolean().optional(),
            short_description: z.string().optional(),
          })
          .parse(args);
        const result = await updatePost(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_delete_post": {
        const params = z.object({ post_id: z.string() }).parse(args);
        const result = await deletePost(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_upload_image": {
        const params = z.object({ file_path: z.string() }).parse(args);
        const result = await uploadImage(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      default:
        throw new Error(`알 수 없는 툴: ${name}`);
    }
  } catch (e) {
    return {
      content: [{ type: "text", text: `오류: ${(e as Error).message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
