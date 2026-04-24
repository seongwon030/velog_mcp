#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  appendToSeries,
  createDraft,
  createSeries,
  deleteComment,
  deletePost,
  deleteSeries,
  getComments,
  getNotifications,
  getPost,
  getReadingList,
  getRss,
  getTrendReport,
  getTrending,
  importFromGitHub,
  likePost,
  listPosts,
  listSeries,
  listTags,
  listTempPosts,
  publishPost,
  searchPosts,
  unlikePost,
  updateComment,
  updatePost,
  uploadImage,
  writeComment,
} from "./tools/index.js";

const server = new Server(
  { name: "velog_mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
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
          tags: {
            type: "array",
            items: { type: "string" },
            description: "태그 목록",
          },
          is_private: {
            type: "boolean",
            description: "비공개 여부 (기본값: false)",
          },
          short_description: { type: "string", description: "포스트 요약" },
          thumbnail: {
            type: "string",
            description:
              "썸네일 이미지 URL (velog_upload_image로 업로드한 URL 또는 외부 URL)",
          },
          series_id: {
            type: "string",
            description:
              "발행할 시리즈 ID (velog_list_series 또는 velog_create_series 응답에서 확인)",
          },
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
          draft_id: {
            type: "string",
            description: "velog_draft_post에서 반환된 draft_id",
          },
          is_private: {
            type: "boolean",
            description: "비공개 발행 여부 (초안 설정 덮어씀)",
          },
        },
        required: ["draft_id"],
      },
    },
    {
      name: "velog_list_posts",
      description:
        "Velog 포스트 목록을 가져옵니다. username을 지정하면 타 유저 포스트도 조회할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "가져올 포스트 수 (기본값: 20)",
          },
          cursor: {
            type: "string",
            description: "페이지네이션 커서 (이전 응답의 next_cursor 값)",
          },
          tag: {
            type: "string",
            description: "태그 필터 (예: React, TypeScript)",
          },
          username: {
            type: "string",
            description: "조회할 유저명 (생략 시 본인 포스트)",
          },
        },
      },
    },
    {
      name: "velog_get_post",
      description:
        "특정 Velog 포스트의 전체 내용을 가져옵니다. username을 지정하면 타 유저 포스트도 조회할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          url_slug: { type: "string", description: "포스트 URL slug" },
          username: {
            type: "string",
            description: "포스트 작성자 유저명 (생략 시 본인)",
          },
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
          url_slug: {
            type: "string",
            description: "수정할 포스트의 URL slug (예: my-post-title)",
          },
          title: { type: "string", description: "새 제목" },
          body: { type: "string", description: "새 마크다운 본문" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "새 태그 목록",
          },
          is_private: { type: "boolean", description: "비공개 여부" },
          short_description: { type: "string", description: "새 요약" },
          thumbnail: {
            type: "string",
            description: "새 썸네일 URL. null을 넘기면 썸네일 제거",
          },
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
      description:
        "로컬 이미지 파일을 Velog에 업로드하고 URL을 반환합니다. 반환된 URL을 마크다운 본문에 사용하세요.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description:
              "업로드할 이미지 파일의 절대 경로 또는 상대 경로 (.jpg, .jpeg, .png, .gif, .webp)",
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "velog_write_comment",
      description:
        "Velog 포스트에 댓글을 작성합니다. comment_id를 지정하면 대댓글로 작성됩니다.",
      inputSchema: {
        type: "object",
        properties: {
          url_slug: {
            type: "string",
            description: "댓글을 달 포스트의 URL slug",
          },
          text: { type: "string", description: "댓글 내용" },
          comment_id: {
            type: "string",
            description: "대댓글 작성 시 부모 댓글 ID",
          },
        },
        required: ["url_slug", "text"],
      },
    },
    {
      name: "velog_delete_comment",
      description: "Velog 댓글을 삭제합니다.",
      inputSchema: {
        type: "object",
        properties: {
          comment_id: { type: "string", description: "삭제할 댓글 ID" },
        },
        required: ["comment_id"],
      },
    },
    {
      name: "velog_update_comment",
      description: "Velog 댓글 내용을 수정합니다.",
      inputSchema: {
        type: "object",
        properties: {
          comment_id: { type: "string", description: "수정할 댓글 ID" },
          text: { type: "string", description: "새 댓글 내용" },
        },
        required: ["comment_id", "text"],
      },
    },
    {
      name: "velog_get_comments",
      description:
        "특정 Velog 포스트의 댓글 목록을 가져옵니다. 댓글 ID를 확인하여 삭제에 활용할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          url_slug: {
            type: "string",
            description: "댓글을 조회할 포스트의 URL slug",
          },
        },
        required: ["url_slug"],
      },
    },
    {
      name: "velog_like_post",
      description: "Velog 포스트에 좋아요를 누릅니다.",
      inputSchema: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "좋아요할 포스트 ID" },
        },
        required: ["post_id"],
      },
    },
    {
      name: "velog_unlike_post",
      description: "Velog 포스트 좋아요를 취소합니다.",
      inputSchema: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "좋아요 취소할 포스트 ID" },
        },
        required: ["post_id"],
      },
    },
    {
      name: "velog_search_posts",
      description:
        "Velog 포스트를 키워드로 검색합니다. username을 지정하면 특정 유저의 포스트만 검색합니다.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "검색 키워드" },
          username: {
            type: "string",
            description: "검색할 유저 이름 (생략 시 전체 검색)",
          },
        },
        required: ["keyword"],
      },
    },
    {
      name: "velog_get_trending",
      description:
        "Velog 트렌딩 포스트 목록을 가져옵니다. timeframe으로 기간을 지정할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          timeframe: {
            type: "string",
            enum: ["day", "week", "month", "year"],
            description: "기간 (기본값: week)",
          },
          limit: { type: "number", description: "가져올 수 (기본값: 20)" },
          offset: { type: "number", description: "오프셋 (기본값: 0)" },
        },
      },
    },
    {
      name: "velog_trend_report",
      description:
        "Velog 트렌딩 포스트를 분석하여 최근 개발 동향 리포트 데이터를 반환합니다. 각 포스트의 태그, 요약, 좋아요/댓글 수를 포함하며 Claude가 이를 분석해 트렌드 문서를 작성합니다.",
      inputSchema: {
        type: "object",
        properties: {
          timeframe: {
            type: "string",
            enum: ["day", "week", "month", "year"],
            description: "분석 기간 (기본값: week)",
          },
          limit: {
            type: "number",
            description: "분석할 포스트 수 (기본값: 20, 최대: 40)",
          },
        },
      },
    },
    {
      name: "velog_get_notifications",
      description:
        "내 Velog 알림 목록을 가져옵니다. 좋아요·댓글·팔로우 알림과 읽지 않은 알림 수를 반환합니다.",
      inputSchema: {
        type: "object",
        properties: {
          mark_as_read: {
            type: "boolean",
            description: "조회 후 읽음 처리 여부 (기본값: false)",
          },
        },
      },
    },
    {
      name: "velog_get_reading_list",
      description:
        "내 Velog 읽을 목록(북마크)을 가져옵니다. 저장한 포스트 목록을 반환합니다.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["READ", "LIKED"],
            description:
              "목록 유형: READ(읽을 목록) / LIKED(좋아요 목록) (기본값: READ)",
          },
        },
      },
    },
    {
      name: "velog_get_rss",
      description:
        "특정 Velog 유저의 RSS 피드를 가져옵니다. 인증 없이 최신 포스트 목록을 조회할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description: "조회할 Velog 유저명 (예: velopert)",
          },
        },
        required: ["username"],
      },
    },
    {
      name: "velog_list_tags",
      description: "내 Velog 태그 목록과 태그별 포스트 수를 조회합니다.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "velog_list_temp_posts",
      description: "Velog 임시저장 포스트 목록을 가져옵니다.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "velog_list_series",
      description: "내 Velog 시리즈 목록을 조회합니다.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "velog_create_series",
      description: "새 Velog 시리즈를 생성합니다.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "시리즈 이름" },
          url_slug: {
            type: "string",
            description: "시리즈 URL slug (생략 시 이름으로 자동 생성)",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "velog_append_to_series",
      description:
        "포스트를 시리즈에 추가합니다. post_id는 velog_publish_post 또는 velog_list_posts 응답에서 확인할 수 있습니다.",
      inputSchema: {
        type: "object",
        properties: {
          series_id: {
            type: "string",
            description:
              "시리즈 ID (velog_list_series 또는 velog_create_series 응답에서 확인)",
          },
          post_id: { type: "string", description: "추가할 포스트 ID" },
        },
        required: ["series_id", "post_id"],
      },
    },
    {
      name: "velog_delete_series",
      description:
        "Velog 시리즈를 삭제합니다. 시리즈 내 포스트는 삭제되지 않습니다.",
      inputSchema: {
        type: "object",
        properties: {
          series_id: { type: "string", description: "삭제할 시리즈 ID" },
        },
        required: ["series_id"],
      },
    },
    {
      name: "velog_import_from_github",
      description:
        "GitHub 블로그 저장소의 마크다운 파일을 Velog 초안으로 가져옵니다. Jekyll/Hugo/기타 정적 블로그의 _posts 폴더를 지원합니다. dry_run: true로 먼저 미리보기를 확인하세요.",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "GitHub 저장소 (예: octocat/my-blog)",
          },
          path: {
            type: "string",
            description: "마크다운 파일이 있는 폴더 경로 (예: _posts, content/posts). 생략 시 루트",
          },
          branch: {
            type: "string",
            description: "브랜치명 (기본값: main)",
          },
          github_token: {
            type: "string",
            description: "Private 저장소 접근 또는 API 한도 초과 시 GitHub Personal Access Token",
          },
          dry_run: {
            type: "boolean",
            description: "true이면 초안을 생성하지 않고 파싱 결과만 미리 보여줍니다 (기본값: false)",
          },
        },
        required: ["repo"],
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
            thumbnail: z.string().optional(),
            series_id: z.string().optional(),
          })
          .parse(args);
        const draft = createDraft(params);
        const preview =
          draft.body.slice(0, 300) + (draft.body.length > 300 ? "..." : "");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                draft_id: draft.draft_id,
                title: draft.title,
                tags: draft.tags,
                is_private: draft.is_private,
                series_id: draft.series_id ?? null,
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
        const params = z
          .object({
            limit: z.number().optional(),
            cursor: z.string().optional(),
            tag: z.string().optional(),
            username: z.string().optional(),
          })
          .parse(args ?? {});
        const result = await listPosts(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_get_post": {
        const params = z
          .object({ url_slug: z.string(), username: z.string().optional() })
          .parse(args);
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
            thumbnail: z.string().nullable().optional(),
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

      case "velog_write_comment": {
        const params = z
          .object({
            url_slug: z.string(),
            text: z.string(),
            comment_id: z.string().optional(),
          })
          .parse(args);
        const result = await writeComment(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_delete_comment": {
        const params = z.object({ comment_id: z.string() }).parse(args);
        const result = await deleteComment(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_update_comment": {
        const params = z
          .object({ comment_id: z.string(), text: z.string() })
          .parse(args);
        const result = await updateComment(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_get_comments": {
        const params = z.object({ url_slug: z.string() }).parse(args);
        const result = await getComments(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_like_post": {
        const params = z.object({ post_id: z.string() }).parse(args);
        const result = await likePost(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_unlike_post": {
        const params = z.object({ post_id: z.string() }).parse(args);
        const result = await unlikePost(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_search_posts": {
        const params = z
          .object({ keyword: z.string(), username: z.string().optional() })
          .parse(args);
        const result = await searchPosts(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_get_trending": {
        const params = z
          .object({
            timeframe: z.enum(["day", "week", "month", "year"]).optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
          })
          .parse(args ?? {});
        const result = await getTrending(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_trend_report": {
        const params = z
          .object({
            timeframe: z.enum(["day", "week", "month", "year"]).optional(),
            limit: z.number().optional(),
          })
          .parse(args ?? {});
        const result = await getTrendReport(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_get_notifications": {
        const params = z
          .object({ mark_as_read: z.boolean().optional() })
          .parse(args ?? {});
        const result = await getNotifications(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_get_reading_list": {
        const params = z
          .object({ type: z.enum(["READ", "LIKED"]).optional() })
          .parse(args ?? {});
        const result = await getReadingList(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_get_rss": {
        const params = z.object({ username: z.string() }).parse(args);
        const result = await getRss(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_list_tags": {
        const result = await listTags();
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_list_temp_posts": {
        const result = await listTempPosts();
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_list_series": {
        const result = await listSeries();
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_create_series": {
        const params = z
          .object({ name: z.string(), url_slug: z.string().optional() })
          .parse(args);
        const result = await createSeries(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_append_to_series": {
        const params = z
          .object({ series_id: z.string(), post_id: z.string() })
          .parse(args);
        const result = await appendToSeries(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_delete_series": {
        const params = z.object({ series_id: z.string() }).parse(args);
        const result = await deleteSeries(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      case "velog_import_from_github": {
        const params = z
          .object({
            repo: z.string(),
            path: z.string().optional(),
            branch: z.string().optional(),
            github_token: z.string().optional(),
            dry_run: z.boolean().optional(),
          })
          .parse(args);
        const result = await importFromGitHub(params);
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
