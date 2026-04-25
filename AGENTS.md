# AGENTS.md

## 프로젝트 개요

`velog-mcp-claude`는 Claude가 Velog 콘텐츠를 초안 작성, 발행, 수정,
삭제, 조회할 수 있게 해주는 Node.js 18+ 기반 MCP 서버입니다. Velog의 비공개
GraphQL 및 REST API를 사용합니다.

이 프로젝트는 리버스 엔지니어링 기반의 비공식 연동입니다. Velog API 동작은
언제든 바뀔 수 있다고 보고, 발행이나 삭제처럼 되돌리기 어렵거나 공개 범위에
영향을 주는 작업은 반드시 사용자의 검토를 거치세요.

## 스택과 명령어

- 런타임: Node.js 18+, ESM (`"type": "module"`).
- 언어: TypeScript, `strict` 활성화, `NodeNext` 모듈 해석.
- 원본 소스: `src/`.
- 빌드 결과물: `dist/`; 생성된 파일을 직접 수정하지 마세요.
- 포맷/린트: Biome, 공백 2칸 들여쓰기, 큰따옴표.

저장소 루트에서 다음 명령을 사용하세요.

```bash
npm run build      # TypeScript를 dist/로 컴파일
npm run lint       # Biome 검사
npm run lint:fix   # Biome 자동 수정 및 import 정리
npm run health     # 실제 Velog API 스모크 테스트; ~/.velog-mcp.json 필요
npm run dev        # tsc --watch
npm start          # dist/index.js 실행
npm run setup      # dist/setup.js 실행
```

TypeScript를 변경한 뒤에는 `npm run build`를 실행하세요. Biome 검사 대상인
소스나 문서를 변경했다면 `npm run lint`를 실행하세요. `npm run health`는 실제
Velog 토큰 접근이 필요하다고 명확히 판단될 때만 실행하세요.

## 아키텍처

- `src/index.ts`는 MCP 툴 스키마를 정의하고 툴 호출을 라우팅합니다.
- `src/tools/index.ts`는 개별 툴 구현을 다시 export합니다.
- `src/tools/*.ts`는 포스트, 초안, 댓글, 좋아요, 검색, 트렌딩, 알림, 읽을 목록,
  RSS, 시리즈, 태그, 임시저장, 업로드, GitHub 가져오기 등 기능 영역별 구현을
  담습니다.
- `src/auth.ts`는 Velog 토큰 로드, `Set-Cookie` 기반 토큰 갱신, 공용 GraphQL
  래퍼를 담당합니다.
- `src/setup.ts`는 설정 CLI 진입점입니다.
- `scripts/health-check.mjs`는 실제 인증/읽기/트렌딩/쓰기-삭제 검사를 수행합니다.
- `docs/overview.md`, `docs/security.md`, `docs/roadmap.md`에는 로컬 아키텍처,
  안전 주의사항, 기능 방향이 정리되어 있습니다.

새 MCP 툴을 추가할 때는 관련 위치를 모두 갱신하세요.

1. `src/tools/<name>.ts`에 툴을 구현합니다.
2. `src/tools/index.ts`에서 export합니다.
3. `src/index.ts`의 `ListToolsRequestSchema`에 툴 스키마를 추가합니다.
4. `CallToolRequestSchema`의 switch 문에 Zod 검증과 호출 분기를 추가합니다.
5. 사용자에게 노출되는 동작이 바뀌면 `README.md`와 관련 문서를 갱신합니다.

## API와 동작 메모

- Velog GraphQL 엔드포인트: `https://v2.velog.io/graphql`.
- 이미지 업로드 엔드포인트: `https://v3.velog.io/api/files/v3/upload`.
- 트렌딩 데이터는 `https://cache.velcdn.com`에서 가져옵니다.
- GraphQL 요청에는 유효한 `operationName`을 포함하세요. 일부 mutation은 이것이
  없으면 실패하거나 `null`을 반환합니다.
- 작성/수정 mutation에서는 기존 코드가 명시적으로 `null`을 전달하는 필드를
  유지하세요. 특히 `thumbnail`, `series_id`, `token`에 주의하세요.
- 초안은 프로세스 메모리에만 저장됩니다(`src/tools/draft.ts`). MCP 서버를
  재시작하면 발행하지 않은 초안은 사라집니다.

## 보안 규칙

- 시크릿, 토큰, `.env`, `.npmrc`, `.omc/`, `~/.velog-mcp.json`을 절대
  커밋하지 마세요.
- Velog 인증 정보는 `0600` 권한의 `~/.velog-mcp.json`에 저장됩니다.
- 토큰 값을 로그, 에러, 문서, 테스트, 예시에 포함하지 마세요.
- GitHub 가져오기에 쓰는 `github_token`은 선택값이며 요청 범위 안에서만
  사용하세요. 저장하지 마세요.
- 다음처럼 되돌릴 수 없거나 공개 범위에 영향을 주는 작업을 호출하거나 연결하기
  전에는 반드시 사용자에게 명시적으로 확인받으세요.
  - `velog_delete_post`
  - `velog_delete_comment`
  - 공개 `velog_publish_post`
- `velog_import_from_github`로 초안을 만들기 전에는 `dry_run: true`를 우선
  사용하세요.
- 자동화는 사용자의 Velog 계정과 정상적인 블로그 활동 범위로 제한하세요. 대량
  발행, 스팸 댓글, 타인 계정에 대한 작업은 피하세요.

## 코딩 지침

- 기존 스타일을 따르세요. 작은 기능 파일, 타입이 있는 파라미터 객체, 한국어
  사용자용 에러 메시지, JSON 문자열로 반환하는 MCP 응답을 유지합니다.
- 툴을 호출하기 전 `src/index.ts`에서 Zod로 MCP 입력을 검증하세요.
- 네트워크 호출에는 `AbortSignal.timeout`으로 시간 제한을 두세요.
- 사용자가 명시적으로 breaking change를 요청하지 않는 한, 기존 툴 이름과 응답
  형태의 하위 호환성을 유지하세요.
- 엔드포인트 동작에 맞는 경우 `src/auth.ts`의 `graphql()` 같은 공용 헬퍼를
  우선 사용하세요.
- 읽기 전용 툴은 Velog가 요구하지 않는 한 인증을 요구하지 않도록 하세요.
- 생성된 산출물은 `dist/`를 직접 수정하지 말고 `src/`를 수정한 뒤 다시
  빌드하세요.

## 문서화 지침

- 공개 사용 예시는 `README.md`에 둡니다.
- 구현 상세와 API 주의사항은 `docs/overview.md`에 둡니다.
- 토큰, 이용약관, 되돌릴 수 없는 작업, 운영 리스크 관련 내용은
  `docs/security.md`에 둡니다.
- 향후 아이디어는 `docs/roadmap.md`에 두고, 검증되지 않은 API 가정은 명확히
  표시하세요.
