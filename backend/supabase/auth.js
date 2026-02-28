import { client } from "./client.js";

export async function getUserFromAccessToken(accessToken) {
  if (!accessToken) {
    return { data: null, error: new Error("Missing access token.") };
  }

  const { data, error } = await client.auth.getUser(accessToken);
  return { data: data?.user ?? null, error: error ?? null };
}
