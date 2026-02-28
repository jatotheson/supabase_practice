import { client, USERS_TABLE } from "./client.js";

export async function ensureUserRow(userId) {
  if (!userId) {
    return { data: null, error: new Error("Missing user id for user sync.") };
  }

  const { error: upsertError } = await client.from(USERS_TABLE).upsert(
    {
      user_id: userId,
      created_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    },
  );

  if (upsertError) {
    return { data: null, error: upsertError };
  }

  const { data, error } = await client
    .from(USERS_TABLE)
    .select("user_id, user_name, created_at")
    .eq("user_id", userId)
    .single();

  return { data, error };
}
