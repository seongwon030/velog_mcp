import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { ERR_TOKEN_EXPIRED, ERR_VELOG_NETWORK } from "./constants/errors.js";

const CONFIG_PATH = path.join(os.homedir(), ".velog-mcp.json");
const GRAPHQL_URL = "https://v2.velog.io/graphql";

export interface VelogConfig {
  access_token: string;
  refresh_token: string;
}

export function loadConfig(): VelogConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      "설정 파일이 없습니다. `npx velog_mcp setup`을 실행하세요.",
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as VelogConfig;
}

function saveConfig(config: VelogConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function updateTokensFromSetCookie(
  setCookieHeader: string | null,
  config: VelogConfig,
): VelogConfig {
  if (!setCookieHeader) return config;

  const updated = { ...config };
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];

  for (const cookie of cookies) {
    const match = cookie.match(/^(access_token|refresh_token)=([^;]+)/);
    if (match) {
      const [, name, value] = match;
      if (name === "access_token") updated.access_token = value;
      if (name === "refresh_token") updated.refresh_token = value;
    }
  }

  if (
    updated.access_token !== config.access_token ||
    updated.refresh_token !== config.refresh_token
  ) {
    saveConfig(updated);
  }

  return updated;
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  config?: VelogConfig,
): Promise<{ data: T; newConfig: VelogConfig }> {
  const cfg = config ?? loadConfig();

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `access_token=${cfg.access_token}; refresh_token=${cfg.refresh_token}`,
    },
    body: JSON.stringify({
      operationName: query.match(/(?:mutation|query)\s+(\w+)/)?.[1] ?? null,
      query,
      variables,
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new Error(ERR_VELOG_NETWORK);
  });

  if (res.status === 401) {
    throw new Error(ERR_TOKEN_EXPIRED);
  }

  const setCookie = res.headers.get("set-cookie");
  const newConfig = updateTokensFromSetCookie(setCookie, cfg);

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return { data: json.data as T, newConfig };
}

// setup CLI
async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runSetup(): Promise<void> {
  console.log("=== velog_mcp 설정 ===\n");
  console.log(
    "Velog에 로그인한 후 브라우저 DevTools → Application → Cookies에서",
  );
  console.log("access_token과 refresh_token 값을 복사하세요.\n");

  const access_token = await prompt("access_token: ");
  const refresh_token = await prompt("refresh_token: ");

  if (!access_token || !refresh_token) {
    console.error("토큰을 입력해주세요.");
    process.exit(1);
  }

  console.log("\n토큰 유효성 검증 중...");

  try {
    const { data } = await graphql<{ auth: { username: string } | null }>(
      `
        query {
          auth {
            username
          }
        }
      `,
      {},
      { access_token, refresh_token },
    );

    if (!data.auth) {
      console.error(
        "유효하지 않은 토큰입니다. Velog에 로그인 상태를 확인하세요.",
      );
      process.exit(1);
    }

    saveConfig({ access_token, refresh_token });
    console.log(`\n완료! @${data.auth?.username} 로 인증되었습니다.`);
    console.log(`설정 파일: ${CONFIG_PATH}`);

    await injectClaudeDesktopConfig();
  } catch (e) {
    console.error("오류:", (e as Error).message);
    process.exit(1);
  }
}

function getClaudeDesktopConfigPath(): string | null {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library/Application Support/Claude/claude_desktop_config.json",
    );
  }
  if (platform === "win32") {
    return path.join(
      process.env.APPDATA ?? os.homedir(),
      "Claude/claude_desktop_config.json",
    );
  }
  if (platform === "linux") {
    return path.join(os.homedir(), ".config/Claude/claude_desktop_config.json");
  }
  return null;
}

async function injectClaudeDesktopConfig(): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();
  if (!configPath) {
    console.log(
      "\nClaude Desktop config 경로를 감지할 수 없습니다. 수동으로 추가하세요.",
    );
    return;
  }

  const answer = await prompt(
    "\nClaude Desktop config에 자동으로 추가할까요? (y/n): ",
  );
  if (answer.toLowerCase() !== "y") return;

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch {
      // 파싱 실패 시 빈 객체로 시작
    }
  }

  const mcpServers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers.velog = {
    command: "npx",
    args: ["-y", "velog-mcp-claude"],
  };
  existing.mcpServers = mcpServers;

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));

  console.log(`Claude Desktop config 업데이트 완료: ${configPath}`);
  console.log("Claude Desktop을 재시작하면 velog_mcp 툴이 활성화됩니다.");
}
