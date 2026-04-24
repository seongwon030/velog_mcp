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
```

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

내 알림 목록 조회. 좋아요·댓글·팔로우 알림 포함.

| 파라미터     | 타입    | 필수 | 설명                            |
| ------------ | ------- | ---- | ------------------------------- |
| mark_as_read | boolean |      | 조회 후 읽음 처리 (기본: false) |

반환: `{ notifications: [...], unread_count }`

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
- `access_token`: ~1-2시간 TTL, GraphQL 응답 Set-Cookie로 자동 갱신
- `refresh_token`: ~30일 TTL, 만료 시 `npx -p velog-mcp-claude velog-mcp-setup` 재실행

---

## 개발 가이드

```bash
npm run build     # TypeScript 컴파일
npm run dev       # watch 모드
```

### 배포 방법 (이중 배포)

1. GitHub Packages: `npm publish` (publishConfig에 npm.pkg.github.com 설정됨)
2. npm registry: 이름 임시 변경 후 publish

```bash
# npm 배포 스크립트
node -e "const p=require('./package.json'); p.name='velog-mcp-claude'; require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"
npm publish --registry https://registry.npmjs.org --access public
node -e "const p=require('./package.json'); p.name='@seongwon030/velog-mcp-claude'; require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"
```

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

---

## 알려진 제약사항

- draft는 프로세스 메모리에만 저장 → Claude 재시작 시 소멸
- Velog 공식 API 아님 → API 변경 시 동작 중단 가능
- `emailLogin` GraphQL mutation 미존재 → 이메일/비밀번호 로그인 자동화 불가
- 시리즈 순서 변경 API 미확인
