import { client, POSTS_TABLE } from "./client.js";

export async function getPosts() {
  const { data, error } = await client.from(POSTS_TABLE).select("*").order("post_id", { ascending: false });
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

export async function deletePost(postId, userId) {
  if (!userId) {
    return { data: null, error: new Error("Missing user id for post deletion.") };
  }

  const { data, error } = await client.from(POSTS_TABLE).delete().eq("post_id", postId).eq("user_id", userId);
  return { data, error };
}
