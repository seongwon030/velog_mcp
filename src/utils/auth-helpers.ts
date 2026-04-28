import { graphql } from "../auth.js";
import { ERR_TOKEN_EXPIRED } from "../constants/errors.js";

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
    throw new Error(ERR_TOKEN_EXPIRED);
  }
  return data.auth.username;
}
