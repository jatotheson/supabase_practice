import { client, POSTS_TABLE, USERS_TABLE } from "./client.js";

export async function getPosts() {
  const { data: posts, error } = await client.from(POSTS_TABLE).select("*").order("post_id", { ascending: false });
  if (error) {
    return { data: null, error };
  }

  const safePosts = posts || [];
  if (safePosts.length === 0) {
    return { data: safePosts, error: null };
  }

  const userIds = [...new Set(safePosts.map((post) => post.user_id).filter(Boolean))];
  if (userIds.length === 0) {
    return {
      data: safePosts.map((post) => ({ ...post, user_name: null })),
      error: null,
    };
  }

  const { data: users, error: usersError } = await client
    .from(USERS_TABLE)
    .select("user_id, user_name")
    .in("user_id", userIds);

  if (usersError) {
    return {
      data: safePosts.map((post) => ({ ...post, user_name: null })),
      error: null,
    };
  }

  const userNameById = new Map((users || []).map((user) => [user.user_id, user.user_name]));
  return {
    data: safePosts.map((post) => ({
      ...post,
      user_name: userNameById.get(post.user_id) ?? null,
    })),
    error: null,
  };
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
