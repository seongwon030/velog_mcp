import { graphql } from "../auth.js";

const CURRENT_USER = `
  query {
    auth {
      username
    }
  }
`;

export async function getCurrentUsername(): Promise<string> {
  const { data } = await graphql<{ auth: { username: string } | null }>(
    CURRENT_USER,
  );
  if (!data.auth) {
    throw new Error(
      "토큰이 만료됐거나 유효하지 않습니다. `npx velog_mcp setup`을 다시 실행하세요.",
    );
  }
  return data.auth.username;
}
