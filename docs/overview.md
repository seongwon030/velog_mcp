# velog-mcp-claude 프로젝트 문서

> 로컬 전용 문서 — git에 올라가지 않음

## 프로젝트 개요

Claude가 Velog에 직접 포스트를 작성·발행·수정·삭제할 수 있는 MCP(Model Context Protocol) 서버.

Velog의 공개 API가 없어서 내부 GraphQL API(`v2.velog.io/graphql`)를 리버스 엔지니어링해서 구현함. 파일 업로드는 REST API(`v3.velog.io/api/files/v3/upload`).

---

## 아키텍처

```
Claude (MCP 클라이언트)
    ↕ MCP (stdio transport)
src/index.ts  ← 툴 라우터
    ├── tools/draft.ts        세션 메모리에 초안 저장
    ├── tools/publish.ts      writePost mutation
    ├── tools/update.ts       editPost mutation
    ├── tools/delete.ts       removePost mutation
    ├── tools/get.ts          post query
    ├── tools/list.ts         posts query (cursor/tag/username 지원)
    ├── tools/upload.ts       REST multipart upload
    ├── tools/comment.ts      writeComment / editComment / removeComment
    ├── tools/like.ts         likePost / unlikePost mutation
    ├── tools/search.ts       searchPosts query
    ├── tools/trending.ts     cache.velcdn.com REST API
    ├── tools/trend-report.ts 트렌딩 분석 리포트
    ├── tools/notifications.ts notifications query
    ├── tools/reading-list.ts readingList query
    ├── tools/rss.ts          RSS 피드 파싱
    ├── tools/series.ts       createSeries / appendToSeries / deleteSeries
    ├── tools/tags.ts         userTags query
    └── tools/temp-posts.ts   posts(temp_only) query
src/auth.ts   ← GraphQL 요청 래퍼 + 토큰 관리
src/prompts.ts ← MCP 프롬프트 정의 (prompts/list, prompts/get)
src/resources.ts ← MCP Apps UI 리소스 (resources/list, resources/read)
ui/            ← 초안 미리보기 카드 브라우저 코드 (tsc 대상 아님, esbuild로 번들)
    ├── draft-preview.ts   App 브리지, 렌더링, 발행 버튼
    ├── markdown.ts        marked 설정과 HTML·URL 정화 (vitest로 테스트)
    ├── sanitize.ts        DOMPurify 허용 목록 2차 정화 (vitest + jsdom으로 테스트)
    ├── draft-preview.html/.css  인라인 템플릿
    └── tsconfig.json      DOM lib 타입 검사 전용 (noEmit)
scripts/build-ui.mjs ← ui/를 dist/ui/draft-preview.html 한 파일로 묶음
```

### MCP Apps 초안 미리보기 카드

MCP Apps 확장(`io.modelcontextprotocol/ui`, 스펙 2026-01-26)을 저수준 `Server`에 직접 연결한다. ext-apps의 `registerAppTool`/`registerAppResource`는 `McpServer` 전용이라 쓰지 않는다.

- **capabilities:** `resources: {}`를 추가했다. 이 capability가 없으면 SDK가 `ReadResourceRequestSchema` 핸들러 등록 자체를 거부한다.
- **UI 리소스:** `ui://velog/draft-preview`, mimeType `text/html;profile=mcp-app`. `resources/list` 항목과 `resources/read` contents 양쪽에 `_meta.ui.csp.resourceDomains: ["https://velog.velcdn.com"]`을 둔다. 스펙상 `resourceDomains`는 img-src만이 아니라 script-src·style-src·font-src·media-src에 함께 들어가므로, velog CDN은 이미지뿐 아니라 스크립트 출처로도 허용된다. velog CDN은 업로드 이미지를 이미지 MIME 타입으로 서빙해 스크립트로 실행되지 않으므로 위험은 낮다고 본다(확인한 사실이 아니라 판단). `connectDomains`는 두지 않으므로 카드는 외부로 fetch할 수 없다.
- **툴 연결:** `velog_draft_post` 정의에 `_meta.ui.resourceUri`와 폐기 예정인 평면 키 `_meta["ui/resourceUri"]`를 함께 둔다. 응답 `content` 텍스트는 이전과 같고 `structuredContent`는 반환하지 않는다(Claude Code에서는 `structuredContent`가 텍스트를 대체하기 때문).
- **앱 전용 툴 `velog_get_draft`:** `_meta.ui.visibility: ["app"]`. 카드가 `draft_id`로 초안 전체(본문 포함)를 받아 온다. `velog_draft_post` 응답에 본문 전체를 넣으면 모델 컨텍스트에 본문이 다시 들어가므로 분리했다. MCP Apps를 모르는 클라이언트는 `_meta`를 무시하므로 이 툴이 모델에게 보일 수 있다. 메모리만 읽는 툴이라 영향은 없다.
- **카드 흐름:** `ontoolresult`로 `velog_draft_post` 결과 텍스트의 `draft_id`를 읽고 → `velog_get_draft` 호출 → 렌더링. 발행 버튼은 `velog_publish_post`를 `{ draft_id, is_private }`로 호출한다. 링크는 iframe 안에서 이동하지 않고 `app.openLink`로 호스트에 맡긴다.
- **마크다운 정화 (`ui/markdown.ts`):** 카드 안에서 스크립트가 돌면 브리지를 통해 `velog_publish_post`나 `velog_delete_post`를 부를 수 있다. 본문은 GitHub 가져오기처럼 신뢰할 수 없는 출처에서 올 수 있으므로 marked 렌더러를 다음과 같이 고정한다.
  - 블록·인라인 raw HTML 토큰은 모두 이스케이프해서 텍스트로 보여준다.
  - 인라인 `<code>`·`<pre>`·`<kbd>`·`<script>` 태그 뒤에는 marked가 `inRawBlock` 상태로 들어가 텍스트 토큰을 원문 그대로(`escaped: true`) 넘기고, 기본 `text` 렌더러는 이를 그대로 출력한다. 그래서 `text` 렌더러도 덮어써서 이 토큰을 이스케이프한다. 이 상태는 같은 문단·제목·표 셀 안에서 강조나 링크 안까지 이어진다.
  - 링크 href는 `http:`/`https:`/`mailto:`만, 이미지 src는 `https:`만 통과한다. WHATWG `URL`로 파싱한 결과의 protocol을 보므로 대소문자·제어 문자 우회가 막힌다. 상대 경로와 앵커도 거부되며, 거부된 링크는 글자만, 이미지는 alt 텍스트만 남는다.
  - **2차 방어 (`ui/sanitize.ts`):** `innerHTML`에 넣기 직전에 DOMPurify로 한 번 더 거른다. marked 내부 동작이 바뀌어 raw HTML이 새어 나와도 렌더러가 만드는 태그(`ALLOWED_TAGS`)와 속성(`ALLOWED_ATTR`)만 남는다. `on*`, `style`, `script`·`iframe`·`svg`·`math`·`form`·`object`는 허용 목록에 없다. 훅에서 링크 href와 이미지 src를 같은 스킴 규칙으로 다시 검사하고, checkbox가 아닌 `input`은 지운다. DOMPurify의 `ALLOWED_URI_REGEXP`는 `start`·`rel` 같은 일반 속성 값에도 적용되므로 쓰지 않는다.
  - 테스트: 알려진 공격 입력과 결정적 퍼즈 입력(`renderMarkdown` 3000개, `sanitize(renderMarkdown(x))` 1000개)에서 허용 목록 밖의 태그나 속성이 나오지 않는지 확인한다.
  - 제목·태그·요약 같은 일반 필드는 `textContent`로만 넣고, `innerHTML`은 `sanitizeHtml(renderMarkdown(...))` 결과에만 쓴다.
  - 발행 버튼: 공개 발행의 확인 클릭은 확인 상태가 된 지 800ms 안에 들어오면 무시한다(더블클릭의 두 번째 클릭 포함). Enter·Space를 누르고 있으면 브라우저가 반복 keydown마다 `detail` 0인 click을 만들므로 `keydown`의 `event.repeat`를 `preventDefault`한다. OS 더블클릭 간격이 길면 `detail`이 계속 올라가므로 `detail`은 보지 않는다. 발행 중이거나 끝난 뒤, 또는 같은 `draft_id`로 tool-result가 다시 오면 무시해서 상태가 초기화되지 않게 한다.
- **빌드:** `npm run build` = `tsc` → `npm run build:ui`(`tsc -p ui`로 타입 검사 → `scripts/build-ui.mjs`). esbuild가 `ui/draft-preview.ts`를 IIFE 하나로 묶고, CSS와 함께 `dist/ui/draft-preview.html`에 인라인한다. 외부 URL은 없다. `@modelcontextprotocol/ext-apps`(1.x), `marked`, `dompurify`는 브라우저 번들 전용이고 ext-apps·marked는 engines가 Node 20 이상이라 devDependencies로만 두고 빌드 때 번들에 넣는다. 그래서 런타임 의존성과 `engines: ">=18"`은 바뀌지 않는다. 인라인 `<script>` 안의 `</script`·`<!--`는 `\x3C`로 바꾸고, 결과를 `vm.Script`로 컴파일해 구문이 깨지지 않았는지 확인한다.
- **서버의 HTML 로딩:** `resources/read` 요청 때마다 `dist/index.js` 기준 `./ui/draft-preview.html`을 읽는다. 파일이 없으면 "npm run build로 UI를 빌드하세요" 에러를 던진다. `package.json`의 `files: ["dist"]`로 함께 배포된다.
- **개발 모드:** `npm run dev`(`tsc --watch`)는 UI를 다시 빌드하지 않는다. `ui/`를 고쳤으면 `npm run build:ui`를 따로 실행한다.

### 툴 annotations

`src/index.ts` 상단의 프리셋으로 모든 툴에 annotations를 붙인다. 클라이언트용 힌트일 뿐 서버에서 강제하지 않는다.

| 프리셋 | 대상 |
| --- | --- |
| `READ_ONLY` | 조회·검색·트렌딩·리서치 툴 |
| `WRITE` | 댓글 작성, 업로드, 시리즈 생성·추가, GitHub 가져오기, 좋아요·취소(`idempotentHint: true`) |
| `OVERWRITE` (`destructiveHint: true`) | 포스트·댓글·시리즈 수정과 삭제 |
| `WRITE` + `destructiveHint: true` | `velog_publish_post` |
| `LOCAL_WRITE` | `velog_draft_post` (메모리에만 저장) |

`velog_publish_post`는 스펙상 추가 동작이지만, 공개 발행은 RSS·검색으로 퍼져 되돌리기 어렵고 성공 시 메모리 초안도 지우므로 삭제와 같은 경고 등급(`destructiveHint: true`)을 준다. `velog_get_notifications`의 `mark_as_read`는 아직 구현되지 않아 읽지 않은 알림 수만 조회하므로 `READ_ONLY`다. `velog_git_to_post`는 로컬 git만 읽으므로 `openWorldHint: false`이고, git 옵션 주입을 막기 위해 `since`는 `-`로 시작할 수 없다. 조회 툴도 토큰 갱신 시 `~/.velog-mcp.json`을 다시 쓰지만, 인증 유지용 내부 동작이라 읽기 전용 판정에서 제외한다.

### 프롬프트

`src/prompts.ts`는 프롬프트마다 `build(args)`로 user 메시지 하나를 만든다. MCP 프롬프트 인자는 문자열만 받으므로 `focus_tags`처럼 목록이 필요한 값은 쉼표로 구분한 문자열을 그대로 넘기고, 실제 검증은 각 툴의 Zod 스키마가 맡는다. 인자는 앞뒤 공백을 지우고 빈 값은 생략한 것으로 본다. 필수 인자가 비어 있거나 이름이 없는 프롬프트는 `InvalidParams`(-32602) 에러를 던진다.

---

## 툴 레퍼런스

### `velog_draft_post`

초안을 세션 메모리(Map)에 저장. Velog API 호출 없음.

| 파라미터          | 타입     | 필수 | 설명                      |
| ----------------- | -------- | ---- | ------------------------- |
| title             | string   | ✅   | 포스트 제목               |
| body              | string   | ✅   | 마크다운 본문             |
| tags              | string[] |      | 태그 목록                 |
| is_private        | boolean  |      | 비공개 여부 (기본: false) |
| short_description | string   |      | 요약                      |
| thumbnail         | string   |      | 썸네일 이미지 URL         |
| series_id         | string   |      | 발행할 시리즈 ID          |

반환: `{ draft_id, title, tags, is_private, series_id, body_preview }`

MCP Apps 지원 클라이언트에서는 결과가 `ui://velog/draft-preview` 카드로 렌더링된다.

---

### `velog_get_draft` (앱 전용)

초안 미리보기 카드가 초안 전체를 불러올 때 쓰는 툴. `_meta.ui.visibility: ["app"]`이라 MCP Apps 지원 클라이언트는 모델에게 노출하지 않는다. Velog API 호출 없음.

| 파라미터 | 타입   | 필수 | 설명                   |
| -------- | ------ | ---- | ---------------------- |
| draft_id | string | ✅   | draft_post에서 받은 ID |

반환: `{ draft_id, title, body, tags, is_private, short_description, thumbnail, series_id }` (없는 선택 필드는 `null`)

---

### `velog_publish_post`

초안을 Velog에 발행. `writePost` mutation 호출.

| 파라미터   | 타입    | 필수 | 설명                   |
| ---------- | ------- | ---- | ---------------------- |
| draft_id   | string  | ✅   | draft_post에서 받은 ID |
| is_private | boolean |      | 초안 설정 덮어씀       |

반환: `{ post_id, url_slug, url }`

**주의:** draft는 발행 후 메모리에서 삭제됨. Claude 재시작 시 미발행 draft 소멸.

---

### `velog_update_post`

기존 포스트 수정. `editPost` mutation 호출.
현재 포스트를 `getPost()`로 먼저 조회한 뒤 변경된 필드만 덮어씀.

| 파라미터          | 타입           | 필수 | 설명                         |
| ----------------- | -------------- | ---- | ---------------------------- |
| url_slug          | string         | ✅   | 수정할 포스트 slug           |
| title             | string         |      | 새 제목                      |
| body              | string         |      | 새 본문                      |
| tags              | string[]       |      | 새 태그                      |
| is_private        | boolean        |      | 비공개 여부                  |
| short_description | string         |      | 새 요약                      |
| thumbnail         | string \| null |      | 새 썸네일 URL. null이면 제거 |

반환: `{ post_id, url_slug, url }`

---

### `velog_delete_post`

포스트 삭제. `removePost` mutation 호출.

| 파라미터 | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| post_id  | string | ✅   | 삭제할 포스트 ID |

반환: `{ success, post_id }`

---

### `velog_list_posts`

포스트 목록 조회. cursor 기반 페이지네이션 지원.

| 파라미터 | 타입   | 필수 | 설명                                        |
| -------- | ------ | ---- | ------------------------------------------- |
| limit    | number |      | 가져올 수 (기본: 20)                        |
| cursor   | string |      | 페이지네이션 커서 (이전 응답의 next_cursor) |
| tag      | string |      | 태그 필터 (예: React, TypeScript)           |
| username | string |      | 조회할 유저명 (생략 시 본인)                |

반환: `{ posts: [{ post_id, title, url_slug, url, released_at, is_private }], next_cursor }`

---

### `velog_get_post`

포스트 전체 내용 조회.

| 파라미터 | 타입   | 필수 | 설명                         |
| -------- | ------ | ---- | ---------------------------- |
| url_slug | string | ✅   | 포스트 URL slug              |
| username | string |      | 작성자 유저명 (생략 시 본인) |

반환: `{ post_id, title, body, tags, is_private, thumbnail, url_slug, released_at }`

---

### `velog_upload_image`

로컬 이미지를 Velog CDN에 업로드.

| 파라미터  | 타입   | 필수 | 설명                                        |
| --------- | ------ | ---- | ------------------------------------------- |
| file_path | string | ✅   | 로컬 파일 경로 (.jpg .jpeg .png .gif .webp) |

반환: `{ url }` — `https://velog.velcdn.com/...` 형태

**구현:** `POST v3.velog.io/api/files/v3/upload` multipart/form-data, 필드 `image` + `type: "post"`

---

### `velog_write_comment`

포스트에 댓글 또는 대댓글 작성. `writeComment` mutation 호출.

| 파라미터   | 타입   | 필수 | 설명                        |
| ---------- | ------ | ---- | --------------------------- |
| url_slug   | string | ✅   | 댓글을 달 포스트 slug       |
| text       | string | ✅   | 댓글 내용                   |
| comment_id | string |      | 대댓글 작성 시 부모 댓글 ID |

반환: `{ comment_id, text, created_at }`

---

### `velog_update_comment`

댓글 내용 수정. `editComment` mutation 호출.

| 파라미터   | 타입   | 필수 | 설명           |
| ---------- | ------ | ---- | -------------- |
| comment_id | string | ✅   | 수정할 댓글 ID |
| text       | string | ✅   | 새 댓글 내용   |

반환: `{ comment_id, text, created_at }`

---

### `velog_delete_comment`

댓글 삭제. `removeComment` mutation 호출.

| 파라미터   | 타입   | 필수 | 설명           |
| ---------- | ------ | ---- | -------------- |
| comment_id | string | ✅   | 삭제할 댓글 ID |

반환: `{ success, comment_id }`

---

### `velog_get_comments`

포스트 댓글 목록 조회. 대댓글(replies) 포함.

| 파라미터 | 타입   | 필수 | 설명                      |
| -------- | ------ | ---- | ------------------------- |
| url_slug | string | ✅   | 댓글을 조회할 포스트 slug |

반환: `{ comments: [{ id, text, created_at, username, replies: [...] }] }`

---

### `velog_like_post` / `velog_unlike_post`

포스트 좋아요 / 취소. `likePost` / `unlikePost` mutation 호출.

| 파라미터 | 타입   | 필수 | 설명           |
| -------- | ------ | ---- | -------------- |
| post_id  | string | ✅   | 대상 포스트 ID |

반환: `{ success, post_id }`

---

### `velog_search_posts`

포스트 키워드 검색.

| 파라미터 | 타입   | 필수 | 설명                           |
| -------- | ------ | ---- | ------------------------------ |
| keyword  | string | ✅   | 검색 키워드                    |
| username | string |      | 특정 유저 포스트만 검색 (선택) |

반환: `{ posts: [{ post_id, title, url_slug, url, short_description }] }`

---

### `velog_get_trending`

트렌딩 포스트 목록. `cache.velcdn.com` REST API 호출 (인증 불필요).

| 파라미터  | 타입   | 필수 | 설명                                   |
| --------- | ------ | ---- | -------------------------------------- |
| timeframe | string |      | day / week / month / year (기본: week) |
| limit     | number |      | 가져올 수 (기본: 20)                   |
| offset    | number |      | 오프셋 (기본: 0)                       |

반환: `{ posts: [{ post_id, title, url_slug, url, username, likes, comments_count }] }`

---

### `velog_trend_report`

트렌딩 포스트 분석 데이터 반환. Claude가 이를 바탕으로 트렌드 문서를 작성.

| 파라미터  | 타입   | 필수 | 설명                                   |
| --------- | ------ | ---- | -------------------------------------- |
| timeframe | string |      | day / week / month / year (기본: week) |
| limit     | number |      | 분석할 수 (기본: 20, 최대: 40)         |

반환: 각 포스트의 tags, short_description, likes, comments_count 포함한 상세 목록

---

### `velog_get_notifications`

읽지 않은 알림 수 조회(`notificationCount` query). Velog v2 API가 개별 알림 목록을 제공하지 않아 목록은 반환하지 않는다.

| 파라미터     | 타입    | 필수 | 설명                            |
| ------------ | ------- | ---- | ------------------------------- |
| mark_as_read | boolean |      | 현재 미지원 (값은 무시됨)       |

반환: `{ unread_count, note }`

---

### `velog_get_reading_list`

내 읽을 목록(북마크) 또는 좋아요 목록 조회.

| 파라미터 | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| type     | string |      | READ(기본) / LIKED |

반환: `{ posts: [{ post_id, title, url_slug, url, username }] }`

---

### `velog_get_rss`

특정 유저의 RSS 피드 조회. 인증 불필요.

| 파라미터 | 타입   | 필수 | 설명         |
| -------- | ------ | ---- | ------------ |
| username | string | ✅   | Velog 유저명 |

반환: `{ items: [{ title, url, published_at, description }] }`

---

### `velog_list_series`

내 시리즈 목록 조회. 파라미터 없음.

반환: `{ series: [{ series_id, name, url_slug, posts_count }] }`

---

### `velog_create_series`

새 시리즈 생성. `createSeries` mutation 호출.

| 파라미터 | 타입   | 필수 | 설명                                  |
| -------- | ------ | ---- | ------------------------------------- |
| name     | string | ✅   | 시리즈 이름                           |
| url_slug | string |      | URL slug (생략 시 이름으로 자동 생성) |

반환: `{ series_id, name, url_slug }`

---

### `velog_append_to_series`

포스트를 시리즈에 추가. `appendToSeries` mutation 호출.

| 파라미터  | 타입   | 필수 | 설명             |
| --------- | ------ | ---- | ---------------- |
| series_id | string | ✅   | 시리즈 ID        |
| post_id   | string | ✅   | 추가할 포스트 ID |

반환: `{ success }`

---

### `velog_delete_series`

시리즈 삭제. 시리즈 내 포스트는 삭제되지 않음.

| 파라미터  | 타입   | 필수 | 설명             |
| --------- | ------ | ---- | ---------------- |
| series_id | string | ✅   | 삭제할 시리즈 ID |

반환: `{ success, series_id }`

---

### `velog_list_tags`

내 태그 목록과 태그별 포스트 수 조회. `userTags` query 호출. 파라미터 없음.

반환: `{ tags: [{ tag_id, name, posts_count }], total_posts }`

---

### `velog_list_temp_posts`

임시저장 포스트 목록 조회. 파라미터 없음.

반환: `{ posts: [{ post_id, title, url_slug, updated_at }] }`

---

## API 상세

### GraphQL 엔드포인트

```
POST https://v2.velog.io/graphql
Cookie: access_token=...; refresh_token=...
Content-Type: application/json
Origin: https://velog.io
Referer: https://velog.io/
```

- `operationName` 필수 (없으면 일부 mutation null 반환)
- `editPost` / `writePost`는 `thumbnail`, `series_id`, `token` 필드 명시적으로 `null` 전달 필요

### 파일 업로드 엔드포인트

```
POST https://v3.velog.io/api/files/v3/upload
Cookie: access_token=...; refresh_token=...
Content-Type: multipart/form-data
```

FormData 필드: `image` (파일), `type` ("post" | "profile")

### 인증

- 토큰 위치: `~/.velog-mcp.json` (0600 권한)
- `access_token`: ~24시간 TTL, GraphQL 응답 Set-Cookie로 자동 갱신
- `refresh_token`: ~30일 TTL, 만료 시 `npx -p velog-mcp-claude velog-mcp-setup` 재실행

---

## 개발 가이드

```bash
npm run build     # TypeScript 컴파일
npm run dev       # watch 모드
```

### 배포 방법

npm 레지스트리(`velog-mcp-claude`) 단일 배포. 태그를 푸시하면
`.github/workflows/release.yml`이 lint → build → test → publish를 수행한다.

```bash
npm version minor      # package.json 버전 + 커밋 + 태그 생성
git push && git push --tags
```

- 릴리즈 워크플로우는 태그 버전과 `package.json` 버전이 다르면 실패한다.
- 수동 실행이 필요하면 Actions 탭에서 `Release`를 `workflow_dispatch`로 돌린다.
- `NPM_TOKEN` 시크릿(Automation 토큰) 필요.
- v0.10.0까지는 수동 배포였고, 이름을 임시로 바꿔 올리는 절차 때문에
  v0.11.0 ~ v0.20.0이 npm에 누락된 적이 있다. 그래서 자동화로 전환했다.

---

### 버전 히스토리

| 버전   | 주요 변경                                                                               |
| ------ | --------------------------------------------------------------------------------------- |
| 0.1.0  | 초기 릴리즈 (draft, publish, list, get)                                                 |
| 0.2.0  | update, delete 추가. editPost null 버그 수정                                            |
| 0.3.0  | velog_upload_image 추가                                                                 |
| 0.4.0  | 썸네일 지원 (draft/publish/update), 업로드 URL 수정 (v3.velog.io)                       |
| 0.5.0  | velog_write_comment 추가 (댓글 + 대댓글)                                                |
| 0.6.0  | velog_delete_comment, velog_get_comments 추가                                           |
| 0.7.0  | velog_like_post, velog_unlike_post 추가                                                 |
| 0.8.0  | velog_search_posts 추가                                                                 |
| 0.9.0  | velog_get_trending 추가 (cache.velcdn.com REST API)                                     |
| 0.10.0 | velog_trend_report, velog_get_notifications, velog_get_reading_list, velog_get_rss 추가 |
| 0.11.0 | 시리즈 관리 4종 추가 (list/create/append/delete)                                        |
| 0.12.0 | list_posts에 cursor/tag/username, get_post에 username 파라미터 추가                     |
| 0.13.0 | velog_update_comment, velog_list_tags, velog_list_temp_posts 추가                       |
| 0.14.0 | velog_import_from_github 추가 (Jekyll/Hugo front matter 파싱)                          |
| 0.15.0 | getComments username 파라미터, slug fallback, 댓글 GraphQL 마이그레이션                |
| 0.16.0 | GitHub import 병렬 처리 + rate limit 보호                                              |
| 0.17.0 | GitHub import 하위 디렉터리 재귀 스캔                                                  |
| 0.17.1 | draft 스토어에 24h TTL 추가 (메모리 누수 수정)                                         |
| 0.18.0 | velog_topic_research 추가, velog_get_post에 views 필드 추가                            |
| 0.19.0 | updatePost의 series_id 지원, velog_update_series 추가, createSeries description 추가   |
| 0.20.0 | velog_git_to_post 추가 (커밋 이력·diff → 블로그 초안 프롬프트)                         |

---

## 알려진 제약사항

- draft는 프로세스 메모리에만 저장 → Claude 재시작 시 소멸
- Velog 공식 API 아님 → API 변경 시 동작 중단 가능
- `emailLogin` GraphQL mutation 미존재 → 이메일/비밀번호 로그인 자동화 불가
- 시리즈 순서 변경 API 미확인
