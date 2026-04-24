# velog-mcp 기능 아이디어 로드맵

> 구현 가능성 검증 완료 기준으로 작성. API 존재 여부 미확인 항목은 별도 표기.

---

## 우선순위 높음

### 시리즈(Series) 관리

현재 `writePost` / `editPost`에서 `series_id`를 항상 `null`로 고정 중. Velog에서 시리즈는 콘텐츠 구조화의 핵심 기능임에도 완전 미지원 상태.

**구현 예정 툴**

| 툴                    | 설명                        |
| --------------------- | --------------------------- |
| `velog_list_series`   | 내 시리즈 목록 조회         |
| `velog_create_series` | 새 시리즈 생성              |
| `velog_add_to_series` | 포스트를 특정 시리즈에 추가 |
| `velog_delete_series` | 시리즈 삭제                 |

**예상 GraphQL mutation**

```graphql
mutation CreateSeries($name: String!, $url_slug: String!) {
  createSeries(name: $name, url_slug: $url_slug) {
    id
    name
  }
}
mutation AppendToSeries($series_id: ID!, $post_id: ID!) {
  appendToSeries(series_id: $series_id, post_id: $post_id) {
    id
  }
}
```

---

### 다른 유저 포스트 조회

현재 `velog_get_post`는 인증된 유저(본인) 포스트만 가능. `username` 파라미터를 옵션으로 추가하면 타 유저 포스트도 읽을 수 있음.

**변경 방향**: `velog_get_post`에 `username?: string` 파라미터 추가. 없으면 현재처럼 본인 것으로 동작.

**활용 시나리오**: "이 포스트 읽고 요약해줘" 링크만 주면 Claude가 직접 읽기 가능.

**범위 확대 검토**: `velog_list_posts`, `velog_get_comments`도 동일하게 `username` 파라미터 지원 가능한지 확인 필요. 타 유저의 포스트 목록이나 댓글 조회가 가능하면 분석·리서치 시나리오에서 유용함.

---

### 태그별 포스트 조회

`posts` 쿼리에 `tag` 파라미터가 이미 존재함(검증 완료). 새 툴 추가 없이 `velog_list_posts`에 `tag` 파라미터만 추가하면 됨.

```graphql
query Posts($tag: String, $limit: Int) {
  posts(tag: $tag, limit: $limit) {
    id
    title
    url_slug
  }
}
```

**활용 시나리오**: "React 태그 포스트 다 가져와줘", "내 TypeScript 글 목록 보여줘"

---

### 포스트 목록 페이지네이션

현재 `velog_list_posts`는 `limit`만 지원해 50개 이상 가져올 방법이 없음. Velog `posts` 쿼리는 `cursor` 기반 페이지네이션을 지원함.

**변경 방향**: `velog_list_posts`에 `cursor?: string` 파라미터 추가. 응답에 마지막 포스트의 `id`를 `next_cursor`로 반환하면 Claude가 연속 호출로 전체 목록 순회 가능.

```graphql
query Posts($cursor: ID, $limit: Int) {
  posts(cursor: $cursor, limit: $limit) {
    id
    title
    url_slug
  }
}
```

**활용 시나리오**: "내 포스트 전체 통계 내줘", "작년에 쓴 글 다 가져와줘"

---

## 우선순위 중간

### 댓글 수정

현재 `velog_write_comment` / `velog_delete_comment`만 존재. 수정 기능이 빠져있음.

**확인 필요 mutation**: `editComment(id: ID!, text: String!)`

**구현 예정 툴**: `velog_update_comment`

---

### 임시저장 포스트 목록

Velog에는 임시저장(temp) 탭이 있음. `is_temp: true`로 발행된 포스트들을 별도로 조회할 수 있는 API가 있을 가능성 높음.

**확인 필요 쿼리**: `posts(temp: true)` 또는 별도 `tempPosts` 쿼리

**구현 예정 툴**: `velog_list_temp_posts`

**활용 시나리오**: "임시저장된 글 목록 보여줘" → 이어서 작성하거나 삭제 정리

---

### 내 태그 목록 조회

내가 사용한 태그들과 각 태그별 포스트 수를 조회. 태그 관리에 유용.

**확인 필요 쿼리**: `userTags(username: String!)` — v2 GraphQL에 존재 가능

**구현 예정 툴**: `velog_list_tags`

**활용 시나리오**: "내가 자주 쓰는 태그 뭐야?", "태그별 포스트 수 정리해줘"

---

### 유저 프로필 조회

v3 GraphQL(`v3.velog.io/graphql`)에 `currentUser` 쿼리 확인됨. 팔로워 수, 이메일 알림 설정 등 v2보다 상세한 정보 반환.

**추가 확인 필요**: 타 유저 프로필 조회 가능 여부 (`user(username: String!)` 쿼리 존재 여부)

---

### 팔로우 관리

**확인 필요 mutation**: `followUser(user_id: ID!)` / `unfollowUser(user_id: ID!)`

**활용 시나리오**: 검색으로 찾은 유저 팔로우, 팔로잉 목록 관리

---

### 포스트 통계 조회

좋아요 수는 `post` 쿼리에서 이미 가져올 수 있음. 조회수(`views`)가 `Post` 타입에 있는지 확인 필요.

**확인 필요 필드**: `post { views likes }`

---

## Claude MCP 특성을 살린 자동화 아이디어

이 항목들은 별도 툴 없이 기존 툴 조합으로 구현 가능한 Claude 활용 시나리오.

### 트렌딩 브리핑

```
"오늘 벨로그 트렌딩 요약해줘"
→ velog_get_trending(timeframe=day) → Claude가 주제 분류 + 요약
```

> **참고**: `velog_get_trending`(원시 목록 반환)과 `velog_trend_report`(Claude가 분석·요약까지 수행)는 별도 툴로 분리되어 있음. 브리핑 시나리오는 `trend_report` 단독으로 충분.

### 내 글 성과 분석

```
"내 포스트 중 제일 반응 좋은 거 알려줘"
→ velog_list_posts(limit=50) → 각 post의 likes 비교 → 순위 정리
```

### 시리즈 기반 포스트 자동 발행

```
"React 시리즈 3편 작성해서 발행해줘"
→ velog_draft_post → velog_publish_post → velog_add_to_series
```

### 키워드 트렌드 파악 후 포스트 작성

```
"요즘 트렌딩 키워드로 포스트 써줘"
→ velog_get_trending → 키워드 추출 → velog_draft_post → velog_publish_post
```

### 포스트 복제 / 재발행

별도 툴 없이 기존 툴 조합으로 구현 가능.

```
"이 포스트 복사해서 수정용 초안 만들어줘"
→ velog_get_post(url_slug) → 내용 가져오기 → velog_draft_post(수정된 내용)
```

### 다국어 버전 발행

한국어 포스트를 영어로 번역해서 별도 발행.

```
"이 글 영어로 번역해서 비공개로 올려줘"
→ velog_get_post → Claude 번역 → velog_draft_post → velog_publish_post(is_private: true)
```

### SEO 최적화 제안

내 포스트 제목·태그를 트렌딩 키워드와 비교해 개선안 제시.

```
"내 글 SEO 분석해줘"
→ velog_list_posts → velog_get_trending → Claude가 제목/태그 최적화 제안
```

---

## API 탐색 메모

| 엔드포인트 | 용도

           | 상태       |

| ------------------------------------- | -------------------- | ---------- |
| `v2.velog.io/graphql` | 주요 CRUD | 사용 중 |
| `v3.velog.io/graphql` | 더 상세한 유저 정보 | 일부 확인 |
| `cache.velcdn.com/api/trending-posts` | 트렌딩 (인증 불필요) | 사용 중 |
| `v3.velog.io/api/files/v3/upload` | 이미지 업로드 | 사용 중 |
| `v2.velog.io/graphql` introspection | 스키마 전체 조회 | **차단됨** |

---

## 알려진 불가 기능

| 기능                   | 사유                                                |
| ---------------------- | --------------------------------------------------- |
| 팔로잉 피드            | `followingPosts` 쿼리 없음                          |
| v2 trendingPosts       | 쿼리는 존재하나 항상 빈 배열 반환 (deprecated 추정) |
| 이메일/비밀번호 로그인 | `emailLogin` mutation 없음                          |
| 시리즈 순서 변경       | API 미확인                                          |
