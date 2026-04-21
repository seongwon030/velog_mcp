# velog_mcp

Claude가 Velog에 직접 포스트를 작성하고 발행할 수 있는 MCP 서버.

공개 API가 없는 Velog를 GraphQL 리버스 엔지니어링으로 지원합니다. draft → 사용자 검토 → publish의 human-in-the-loop 플로우로 설계되어, 자동화이면서도 사용자가 완전한 통제권을 유지합니다.

## 설치

```bash
npx velog_mcp_setup
```

Velog에 로그인한 상태에서 브라우저 DevTools → Application → Cookies → `https://velog.io`에서 `access_token`과 `refresh_token` 값을 복사해 입력하세요.

토큰은 `~/.velog-mcp.json`에 `0600` 권한으로 저장됩니다. `.gitignore`에 추가하세요.

## Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "velog": {
      "command": "npx",
      "args": ["-y", "velog_mcp"]
    }
  }
}
```

## 사용법

### 포스트 작성 및 발행

```
나: "React 19 concurrent features에 대한 글 써줘"

Claude: velog_draft_post 호출
→ { draft_id: "abc123", title: "React 19 Concurrent Features 정리", body_preview: "..." }

나: "좋아, 발행해"

Claude: velog_publish_post(draft_id: "abc123") 호출
→ { url: "https://velog.io/@username/react-19-...", post_id: "..." }
```

### 비공개 발행

```
나: "이 글 비공개로 발행해줘"
Claude: velog_publish_post(draft_id: "abc123", is_private: true)
```

## 툴 목록

| 툴                   | 설명                                |
| -------------------- | ----------------------------------- |
| `velog_draft_post`   | 포스트 초안 생성 (세션 메모리 저장) |
| `velog_publish_post` | 초안을 Velog에 발행                 |
| `velog_list_posts`   | 내 포스트 목록 조회                 |
| `velog_get_post`     | 특정 포스트 전체 내용 조회          |
| `velog_update_post`  | 기존 포스트 수정                    |
| `velog_delete_post`  | 포스트 삭제                         |

## 인증

- `access_token`: ~1-2시간 TTL. Velog 서버가 GraphQL 응답에 `Set-Cookie`로 자동 갱신.
- `refresh_token`: ~30일 TTL. 만료 시 `npx velog_mcp_setup` 재실행 필요.
- 별도 refresh 엔드포인트 없음 — Velog 미들웨어가 자동 처리.

## 에러 처리

| 상황            | 메시지                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| 토큰 만료 (401) | `"토큰이 만료됐거나 유효하지 않습니다. npx velog_mcp_setup을 다시 실행하세요."` |
| 설정 파일 없음  | `"설정 파일이 없습니다. npx velog_mcp_setup을 실행하세요."`                     |
| 네트워크 오류   | `"Velog API에 연결할 수 없습니다. 네트워크를 확인하세요."`                      |
| 잘못된 draft_id | `"draft_id가 존재하지 않습니다. velog_draft_post를 먼저 호출하세요."`           |
| GraphQL 오류    | Velog 서버 에러 메시지 그대로 반환                                              |

## 주의사항

- draft는 MCP 서버 프로세스의 세션 메모리에 저장. Claude Desktop 재시작 시 소멸.
- 발행하지 않고 보존하려면 `velog_publish_post(is_private: true)`로 비공개 저장.
- 이미지: 마크다운 외부 URL 참조 방식 (`![alt](url)`) 사용.

## 라이선스

MIT
