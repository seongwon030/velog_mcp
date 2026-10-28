# velog-mcp-claude

[![npm](https://img.shields.io/npm/v/velog-mcp-claude)](https://www.npmjs.com/package/velog-mcp-claude)
[![downloads](https://img.shields.io/npm/dt/velog-mcp-claude)](https://www.npmjs.com/package/velog-mcp-claude)
[![CI](https://github.com/seongwon030/velog_mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/seongwon030/velog_mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/velog-mcp-claude)](./LICENSE)

> Velog 개발자([@velopert](https://github.com/velopert))로부터 운영을 허용한다는 답변을 받은 독립 오픈소스입니다.

Claude가 Velog에 직접 포스트를 작성·발행·수정·삭제하고, 댓글·좋아요·검색·트렌딩까지 다룰 수 있는 MCP 서버.

stdio 기반 표준 MCP 서버라 Claude Code, Claude Desktop, Codex CLI 등 MCP를 지원하는 클라이언트에서 모두 동작합니다.

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

### Codex CLI

```bash
codex mcp add velog -- npx -y velog-mcp-claude
```

또는 `~/.codex/config.toml`에 직접 추가:

```toml
[mcp_servers.velog]
command = "npx"
args = ["-y", "velog-mcp-claude"]
```

등록 확인은 `codex mcp list`.

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
| `velog_get_rss` | 특정 유저의 RSS 피드 조회 (인증 불필요) |

### 내 계정

| 툴 | 설명 |
| --- | --- |
| `velog_list_tags` | 내 태그 목록과 태그별 포스트 수 조회 |
| `velog_list_temp_posts` | 임시저장 포스트 목록 조회 |
| `velog_get_notifications` | 읽지 않은 알림 수 조회 (개별 알림 목록은 Velog API 미제공) |
| `velog_get_reading_list` | 읽을 목록(북마크) 조회 |

모든 툴에는 MCP annotations(`readOnlyHint`, `destructiveHint` 등)가 붙어 있습니다. 클라이언트는 이를 보고 조회 툴은 바로 실행하고, 삭제·수정 툴에는 경고를 띄울 수 있습니다.

## 프롬프트 (슬래시 커맨드)

자주 쓰는 작업을 MCP 프롬프트로 제공합니다. Claude Code에서는 `/mcp__velog__write_post`처럼 슬래시 커맨드로, Claude Desktop에서는 프롬프트 메뉴에서 고를 수 있습니다.

| 프롬프트 | 인자 | 설명 |
| --- | --- | --- |
| `write_post` | `topic`(필수), `tags` | 비슷한 글을 찾아본 뒤 초안 작성 |
| `trend_brief` | `timeframe` | 트렌딩 포스트를 주제별로 묶어 브리핑 |
| `topic_ideas` | `focus_tags` | 아직 안 쓴 인기 주제 3개 제안 |
| `commits_to_post` | `repo_path`, `since` | 최근 커밋과 diff로 기술 블로그 초안 작성 |

초안을 만드는 프롬프트는 사용자가 공개/비공개를 고르기 전까지 발행하지 않도록 지시합니다.

## 초안 미리보기 카드 (MCP Apps)

[MCP Apps](https://github.com/modelcontextprotocol/ext-apps)를 지원하는 클라이언트에서는 `velog_draft_post`를 호출하면 대화 안에 초안 카드가 뜹니다.

- 제목, 태그, 시리즈, 공개 여부, 요약, 썸네일, 마크다운 본문을 렌더링해서 보여줍니다.
- 카드에서 비공개/공개를 고르고 **발행하기**를 누르면 바로 발행됩니다. 공개 발행은 버튼을 한 번 더 눌러야 진행됩니다.
- 발행이 끝나면 포스트 URL이 표시되고, 누르면 브라우저에서 열립니다.

어떤 클라이언트에서 카드가 보이는지는 클라이언트의 MCP Apps 지원 여부에 달려 있습니다. 이 서버는 로컬(stdio) 서버이므로 로컬 MCP 서버를 연결할 수 있으면서 MCP Apps를 지원하는 Claude Desktop 같은 클라이언트에서 카드가 보입니다. claude.ai 웹·모바일은 원격 커넥터만 연결할 수 있어 이 서버를 직접 붙일 수 없습니다. Claude Code와 Codex CLI처럼 MCP Apps를 지원하지 않는 클라이언트는 지금처럼 텍스트 결과만 보여주며, 동작은 이전과 같습니다.

카드는 본문 전체를 불러오기 위해 앱 전용 툴 `velog_get_draft`를 씁니다. MCP Apps를 지원하는 클라이언트는 이 툴을 모델에게 보여주지 않습니다.

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
- `max_diff_lines`: diff에서 가져올 최대 줄 수 (기본값: 200)
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

- `access_token`: ~24시간 TTL, Velog 서버가 자동 갱신
- `refresh_token`: ~30일 TTL. 만료 시 `npx -p velog-mcp-claude velog-mcp-setup` 재실행

## 주의사항

- draft는 MCP 서버 세션 메모리에 저장됨. 재시작 시 소멸, 24시간 후 자동 만료.
- 보존하려면 `velog_publish_post(is_private: true)`로 비공개 저장.

## 로드맵

[docs/roadmap.md](./docs/roadmap.md) 참고.

## 기능 제안

원하는 기능이 있으면 [기능 제안 이슈](https://github.com/seongwon030/velog_mcp/issues/new?template=feature_request.md)로 남겨 주세요. 먼저 [로드맵](./docs/roadmap.md)과 [기존 이슈](https://github.com/seongwon030/velog_mcp/issues)에 같은 제안이 있는지 확인하고, 있으면 👍 반응이나 댓글로 의견을 보태 주세요.

링크로 열면 제목 앞에 `[기능 제안]`이 붙고 아래 양식이 자동으로 채워집니다. 각 칸을 채워 주시면 검토가 빠릅니다.

```markdown
## 하고 싶은 일
Claude에게 어떤 요청을 했을 때 무엇이 되길 원하는지
예) "내 시리즈 글 순서를 발행일 순으로 바꿔줘"

## 지금 불편한 점
현재 툴로는 왜 안 되는지, 어떻게 우회하고 있는지

## 참고 (선택)
Velog 웹에서 같은 동작을 하는 화면, 관련 API 요청 등
```

Velog 비공개 API에 없는 동작이거나 대량 발행·스팸처럼 정상적인 블로그 활동 범위를 벗어나는 기능은 구현하지 않을 수 있습니다.

## 면책 조항

내부 GraphQL API를 리버스 엔지니어링하여 구현되었습니다. API 구조 변경으로 예고 없이 동작이 중단될 수 있습니다.
