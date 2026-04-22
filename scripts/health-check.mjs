#!/usr/bin/env node
import fs from "fs";
import os from "os";
import path from "path";

const GRAPHQL = "https://v2.velog.io/graphql";
const TRENDING = "https://cache.velcdn.com/api/trending-posts?timeframe=week&limit=1";

const GREEN = "\x1b[32m✓\x1b[0m";
const RED = "\x1b[31m✗\x1b[0m";

function loadToken() {
  const configPath = path.join(os.homedir(), ".velog-mcp.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("~/.velog-mcp.json 없음. npx -p velog-mcp-claude velog-mcp-setup 실행 필요");
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function cookie(cfg) {
  return `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`;
}

async function gql(cfg, operationName, query, variables = {}) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie(cfg),
      Origin: "https://velog.io",
      Referer: "https://velog.io/",
    },
    body: JSON.stringify({ operationName, query, variables }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

function pass(label, detail = "") {
  console.log(`  ${GREEN} ${label}${detail ? `  (${detail})` : ""}`);
}

function fail(label, err) {
  console.log(`  ${RED} ${label}  → ${err}`);
}

async function checkAuth(cfg) {
  const data = await gql(cfg, "Auth", "query Auth { auth { username } }");
  if (!data.auth) throw new Error("토큰 유효하지 않음");
  return data.auth.username;
}

async function checkRead(cfg) {
  const data = await gql(
    cfg,
    "Posts",
    "query Posts($limit: Int) { posts(limit: $limit) { id } }",
    { limit: 1 }
  );
  if (!Array.isArray(data.posts)) throw new Error("posts 응답 비정상");
}

async function checkTrending() {
  const res = await fetch(TRENDING, {
    headers: { Referer: "https://velog.io/" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("응답 형식 변경됨");
}

async function checkWrite(cfg) {
  // 비공개 임시 포스트 생성 후 즉시 삭제
  const WRITE = `
    mutation WritePost(
      $title: String $body: String $tags: [String]
      $is_markdown: Boolean $is_temp: Boolean $is_private: Boolean
      $url_slug: String $thumbnail: String $meta: JSON $series_id: ID $token: String
    ) {
      writePost(
        title: $title body: $body tags: $tags
        is_markdown: $is_markdown is_temp: $is_temp is_private: $is_private
        url_slug: $url_slug thumbnail: $thumbnail meta: $meta series_id: $series_id token: $token
      ) { id }
    }
  `;
  const DELETE = `
    mutation RemovePost($id: ID!) {
      removePost(id: $id)
    }
  `;

  const data = await gql(cfg, "WritePost", WRITE, {
    title: "[health-check] auto delete",
    body: "",
    tags: [],
    is_markdown: true,
    is_temp: true,
    is_private: true,
    url_slug: `health-check-${Date.now()}`,
    thumbnail: null,
    meta: { short_description: "" },
    series_id: null,
    token: null,
  });

  const postId = data.writePost?.id;
  if (!postId) throw new Error("writePost 응답 없음");

  await gql(cfg, "RemovePost", DELETE, { id: postId });
}

async function run() {
  console.log("\nvelog-mcp health check\n");

  let cfg;
  try {
    cfg = loadToken();
    pass("토큰 파일 로드");
  } catch (e) {
    fail("토큰 파일 로드", e.message);
    process.exit(1);
  }

  let failed = 0;

  // 1. Auth
  try {
    const username = await checkAuth(cfg);
    pass("Auth (토큰 유효성)", `@${username}`);
  } catch (e) {
    fail("Auth (토큰 유효성)", e.message);
    failed++;
  }

  // 2. Read
  try {
    await checkRead(cfg);
    pass("Read (posts 쿼리)");
  } catch (e) {
    fail("Read (posts 쿼리)", e.message);
    failed++;
  }

  // 3. Trending CDN
  try {
    await checkTrending();
    pass("Trending CDN (cache.velcdn.com)");
  } catch (e) {
    fail("Trending CDN (cache.velcdn.com)", e.message);
    failed++;
  }

  // 4. Write
  try {
    await checkWrite(cfg);
    pass("Write (writePost → removePost)");
  } catch (e) {
    fail("Write (writePost → removePost)", e.message);
    failed++;
  }

  console.log();
  if (failed === 0) {
    console.log(`${GREEN} 모든 체크 통과\n`);
    process.exit(0);
  } else {
    console.log(`${RED} ${failed}개 항목 실패\n`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("예기치 않은 오류:", e.message);
  process.exit(1);
});
