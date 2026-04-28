# velog-mcp-claude

> Velog 개발자([@velopert](https://github.com/velopert))로부터 운영을 허용한다는 답변을 받은 독립 오픈소스입니다.

Claude가 Velog에 직접 포스트를 작성·발행·수정·삭제하고, 댓글·좋아요·검색·트렌딩까지 다룰 수 있는 MCP 서버.

**npm**: [velog-mcp-claude](https://www.npmjs.com/package/velog-mcp-claude) | **요구사항**: Node.js 18+

## 설치

```bash
npx -p velog-mcp-claude velog-mcp-setup
```

Velog에 로그인한 상태에서 브라우저 DevTools → Application → Cookies → `https://velog.io`에서 `access_token`과 `refresh_token` 값을 복사해 입력하세요.

토큰은 `~/.velog-mcp.json`에 `0600` 권한으로 저장됩니다.

## 설정

### Claude Code

```bash
claude mcp add velog -- npx -y velog-mcp-claude
```

전역으로 추가하려면:

```bash
claude mcp add --scope global velog -- npx -y velog-mcp-claude
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "velog": {
      "command": "npx",
      "args": ["-y", "velog-mcp-claude"]
    }
  }
}
```

## 툴 목록

### 포스트

| 툴 | 설명 |
| --- | --- |
| `velog_draft_post` | 포스트 초안 생성 |
| `velog_publish_post` | 초안을 Velog에 발행 |
| `velog_list_posts` | 내 포스트 목록 조회 |
| `velog_get_post` | 특정 포스트 전체 내용 조회 (조회수 포함) |
| `velog_update_post` | 기존 포스트 수정 |
| `velog_delete_post` | 포스트 삭제 |
| `velog_upload_image` | 로컬 이미지를 Velog CDN에 업로드 |
| `velog_import_from_github` | GitHub 블로그 마크다운을 Velog 초안으로 가져오기 |
| `velog_git_to_post` | git 커밋 이력과 diff를 분석해 블로그 초안 프롬프트 생성 |

### 시리즈

| 툴 | 설명 |
| --- | --- |
| `velog_list_series` | 내 시리즈 목록 조회 |
| `velog_create_series` | 새 시리즈 생성 |
| `velog_update_series` | 시리즈 이름·설명 수정 |
| `velog_append_to_series` | 포스트를 시리즈에 추가 |
| `velog_delete_series` | 시리즈 삭제 |

### 댓글

| 툴 | 설명 |
| --- | --- |
| `velog_get_comments` | 포스트 댓글 목록 조회 (대댓글 포함) |
| `velog_write_comment` | 댓글 또는 대댓글 작성 |
| `velog_update_comment` | 댓글 수정 |
| `velog_delete_comment` | 댓글 삭제 |

### 좋아요

| 툴 | 설명 |
| --- | --- |
| `velog_like_post` | 포스트 좋아요 |
| `velog_unlike_post` | 포스트 좋아요 취소 |

### 탐색

| 툴 | 설명 |
| --- | --- |
| `velog_search_posts` | 키워드로 포스트 검색 |
| `velog_get_trending` | 트렌딩 포스트 조회 (day / week / month / year) |
| `velog_trend_report` | 트렌딩 포스트 분석 리포트 |
| `velog_topic_research` | 트렌딩 태그 × 내 포스트 교차분석으로 아직 안 쓴 인기 주제 발굴 |

## git 커밋 → 블로그 초안

최근 커밋 이력과 diff를 분석해 Claude가 한국어 기술 블로그 포스트를 자동으로 작성합니다.

```
나: "오늘 작업한 커밋들로 벨로그 포스트 작성해줘"
나: "지난 10개 커밋 기반으로 블로그 글 써줘"
나: "v0.19.0 태그 이후 변경사항으로 포스트 초안 만들어줘"
```

- `repo_path`: 분석할 로컬 git 저장소 경로 (기본값: 현재 디렉터리)
- `commits`: 가져올 최근 커밋 수 (기본값: 5)
- `since`: 특정 커밋·태그 이후 범위 지정 (예: `v0.19.0`, `HEAD~10`)
- `include_diff`: 코드 diff 포함 여부 (기본값: `true`)
- `tags`: 포스트에 넣을 태그 힌트 (미지정 시 파일 확장자로 자동 추론)

## GitHub 블로그 마이그레이션

Jekyll / Hugo 등 front matter가 있는 마크다운을 지원합니다. `dry_run: true`로 먼저 미리보기를 확인하세요.

```
나: "내 깃허브 블로그 _posts 폴더 글들을 벨로그 초안으로 옮겨줘"
```

- 상대 경로 이미지는 GitHub raw URL로 자동 변환
- Private 저장소는 `github_token` 파라미터로 접근

### GitHub API 한도 초과 시

토큰 없이 사용하면 60회/시간 제한이 있습니다. `dry_run: true` 한 번만으로도 한도의 상당 부분이 소진될 수 있습니다.

한도를 초과하면 `github_token`을 발급해 전달하세요.

**토큰 발급**: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token

- 공개 저장소: 스코프 없이 생성해도 되지만, **`public_repo`를 체크하면 확실합니다**
- 비공개 저장소: `repo` 체크

토큰을 전달하면 5,000회/시간으로 한도가 올라갑니다.

## 인증

- `access_token`: ~1-2시간 TTL, Velog 서버가 자동 갱신
- `refresh_token`: ~30일 TTL. 만료 시 `npx -p velog-mcp-claude velog-mcp-setup` 재실행

## 주의사항

- draft는 MCP 서버 세션 메모리에 저장됨. 재시작 시 소멸, 24시간 후 자동 만료.
- 보존하려면 `velog_publish_post(is_private: true)`로 비공개 저장.

## 로드맵

[docs/roadmap.md](./docs/roadmap.md) 참고.

## 면책 조항

내부 GraphQL API를 리버스 엔지니어링하여 구현되었습니다. API 구조 변경으로 예고 없이 동작이 중단될 수 있습니다.
