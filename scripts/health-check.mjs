#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const GRAPHQL = "https://v2.velog.io/graphql";
const TRENDING =
  "https://cache.velcdn.com/api/trending-posts?timeframe=week&limit=1";
const CONFIG_PATH = path.join(os.homedir(), ".velog-mcp.json");

const GREEN = "\x1b[32m✓\x1b[0m";
const RED = "\x1b[31m✗\x1b[0m";

function loadToken() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      "~/.velog-mcp.json 없음. npx -p velog-mcp-claude velog-mcp-setup 실행 필요",
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function saveToken(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

function applySetCookie(setCookie, cfg) {
  if (!setCookie) return cfg;
  const updated = { ...cfg };
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const m = c.match(/^(access_token|refresh_token)=([^;]+)/);
    if (m) updated[m[1]] = m[2];
  }
  return updated;
}

function cookie(cfg) {
  return `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`;
}

// cfg는 참조이므로 갱신된 토큰을 반영하려면 wrapper에서 처리
async function gql(cfgRef, operationName, query, variables = {}) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie(cfgRef.value),
      Origin: "https://velog.io",
      Referer: "https://velog.io/",
    },
    body: JSON.stringify({ operationName, query, variables }),
    signal: AbortSignal.timeout(30000),
  });

  const refreshed = applySetCookie(res.headers.get("set-cookie"), cfgRef.value);
  if (
    refreshed.access_token !== cfgRef.value.access_token ||
    refreshed.refresh_token !== cfgRef.value.refresh_token
  ) {
    cfgRef.value = refreshed;
    saveToken(refreshed);
  }

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

async function checkAuth(cfgRef) {
  const data = await gql(cfgRef, "Auth", "query Auth { auth { username } }");
  if (!data.auth) throw new Error("토큰 유효하지 않음");
  return data.auth.username;
}

async function checkRead(cfgRef) {
  const data = await gql(
    cfgRef,
    "Posts",
    "query Posts($limit: Int) { posts(limit: $limit) { id } }",
    { limit: 1 },
  );
  if (!Array.isArray(data.posts)) throw new Error("posts 응답 비정상");
}

async function checkTrending() {
  const res = await fetch(TRENDING, {
    headers: { Referer: "https://velog.io/" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("응답 형식 변경됨");
}

async function checkWrite(cfgRef) {
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
  const DELETE = `mutation RemovePost($id: ID!) { removePost(id: $id) }`;

  const data = await gql(cfgRef, "WritePost", WRITE, {
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

  await gql(cfgRef, "RemovePost", DELETE, { id: postId });
}

// GitHub Actions output 기록
function setGithubOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

async function run() {
  console.log("\nvelog-mcp health check\n");

  let cfgRef;
  try {
    cfgRef = { value: loadToken() };
    pass("토큰 파일 로드");
  } catch (e) {
    fail("토큰 파일 로드", e.message);
    process.exit(1);
  }

  let failed = 0;

  try {
    const username = await checkAuth(cfgRef);
    pass("Auth (토큰 유효성)", `@${username}`);
  } catch (e) {
    fail("Auth (토큰 유효성)", e.message);
    failed++;
  }

  try {
    await checkRead(cfgRef);
    pass("Read (posts 쿼리)");
  } catch (e) {
    fail("Read (posts 쿼리)", e.message);
    failed++;
  }

  try {
    await checkTrending();
    pass("Trending CDN (cache.velcdn.com)");
  } catch (e) {
    fail("Trending CDN (cache.velcdn.com)", e.message);
    failed++;
  }

  try {
    await checkWrite(cfgRef);
    pass("Write (writePost → removePost)");
  } catch (e) {
    fail("Write (writePost → removePost)", e.message);
    failed++;
  }

  // GitHub Actions에서 최종 토큰 출력 (갱신됐을 수 있음)
  setGithubOutput("access_token", cfgRef.value.access_token);
  setGithubOutput("refresh_token", cfgRef.value.refresh_token);

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
