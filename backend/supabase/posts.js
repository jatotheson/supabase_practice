import { client, POSTS_TABLE } from "./client.js";

export async function getPosts() {
  const { data, error } = await client.from(POSTS_TABLE).select("*").order("id", { ascending: false });
  return { data, error };
}

export async function createPost(title, body, userId) {
  if (!userId) {
    return { data: null, error: new Error("Missing user id for post creation.") };
  }

  const { data, error } = await client
    .from(POSTS_TABLE)
    .insert([{ title, body, user_id: userId }])
    .select("*")
    .single();

  return { data, error };
}

export async function deletePost(id, userId) {
  if (!userId) {
    return { data: null, error: new Error("Missing user id for post deletion.") };
  }

  const { data, error } = await client.from(POSTS_TABLE).delete().eq("id", id).eq("user_id", userId);
  return { data, error };
}
