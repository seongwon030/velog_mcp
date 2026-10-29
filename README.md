# velog-mcp-claude

[![npm](https://img.shields.io/npm/v/velog-mcp-claude)](https://www.npmjs.com/package/velog-mcp-claude)
[![downloads](https://img.shields.io/npm/dt/velog-mcp-claude)](https://www.npmjs.com/package/velog-mcp-claude)
[![CI](https://github.com/seongwon030/velog_mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/seongwon030/velog_mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/velog-mcp-claude)](./LICENSE)

**Claude에게 말로 부탁하면 Velog 글을 쓰고, 발행하고, 관리해 주는 MCP 서버입니다.**

> Velog 개발자([@velopert](https://github.com/velopert))로부터 운영을 허용한다는 답변을 받은 독립 오픈소스입니다.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/draft-preview-dark.png">
    <img src="docs/images/draft-preview-light.png" alt="대화 안에 뜬 Velog 초안 미리보기 카드. 제목, 태그, 렌더링된 본문, 비공개/공개 선택과 발행하기 버튼이 보인다." width="560">
  </picture>
</p>

## 할 수 있는 것

- **글쓰기와 발행**: 주제나 git 커밋으로 초안을 쓰고, 미리보기 카드에서 확인한 뒤 공개 또는 비공개로 발행합니다.
- **주제 찾기**: 트렌딩 글을 주제별로 정리하고, 내가 아직 안 쓴 인기 주제를 추천합니다.
- **블로그 관리**: 글 수정·삭제, 시리즈, 이미지 업로드, 태그·임시저장 글을 다룹니다.
- **소통**: 댓글, 좋아요, 검색, 읽을 목록, 알림 수를 확인합니다.

Claude Code, Claude Desktop, Codex CLI 등 MCP를 지원하는 클라이언트에서 동작합니다. (Node.js 18+)

## 시작하기

```bash
# 1. Velog 토큰 저장 (브라우저 DevTools → Cookies → velog.io의 access_token, refresh_token)
npx -p velog-mcp-claude velog-mcp-setup

# 2. 클라이언트에 등록 (Claude Code 예시)
claude mcp add velog -- npx -y velog-mcp-claude
```

그다음 이렇게 말해 보세요.

```text
이번 주 벨로그 트렌딩 글을 주제별로 정리해줘
내가 아직 안 쓴 인기 주제 3개 추천해줘
오늘 작업한 커밋들로 벨로그 글 써줘
```

## 더 보기

- [사용 가이드](./docs/guide.md): 클라이언트별 설정, 예시 요청, 미리보기 카드, 프롬프트, 전체 툴 목록, 인증, 기능 제안
- [보안과 주의사항](./docs/security.md): 토큰 보관, 공개 발행·삭제처럼 되돌리기 어려운 작업
- [구현 상세](./docs/overview.md) · [로드맵](./docs/roadmap.md)

> 공개 발행과 삭제는 되돌리기 어렵습니다. Claude가 발행이나 삭제를 하려 하면 내용을 확인한 뒤 승인하세요.

내부 GraphQL API를 리버스 엔지니어링하여 구현되었습니다. API 구조 변경으로 예고 없이 동작이 중단될 수 있습니다.
