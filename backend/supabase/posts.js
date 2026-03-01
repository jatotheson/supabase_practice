import { client, POST_IMAGES_TABLE, POSTS_TABLE, PUBLIC_BUCKET, USERS_TABLE } from "./client.js";
import { getPostImagesByPostIds } from "./images.js";

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
  let users = [];
  let usersError = null;
  if (userIds.length > 0) {
    const usersResult = await client.from(USERS_TABLE).select("user_id, user_name").in("user_id", userIds);
    users = usersResult.data || [];
    usersError = usersResult.error;
  }

  const userNameById = new Map();
  if (!usersError) {
    users.forEach((user) => {
      userNameById.set(user.user_id, user.user_name);
    });
  }

  const postIds = safePosts.map((post) => post.post_id).filter(Boolean);
  const { data: postImages, error: postImagesError } = await getPostImagesByPostIds(postIds);
  const imagesByPostId = new Map();

  if (!postImagesError) {
    (postImages || []).forEach((imageRow) => {
      const current = imagesByPostId.get(imageRow.post_id) || [];
      current.push(imageRow);
      imagesByPostId.set(imageRow.post_id, current);
    });
  }

  return {
    data: safePosts.map((post) => ({
      ...post,
      user_name: userNameById.get(post.user_id) ?? null,
      images: imagesByPostId.get(post.post_id) || [],
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

  const { data: ownedPost, error: ownedPostError } = await client
    .from(POSTS_TABLE)
    .select("post_id, user_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownedPostError) {
    return { data: null, error: ownedPostError };
  }

  if (!ownedPost) {
    return { data: [], error: null };
  }

  const { data: imageRows, error: imageRowsError } = await client
    .from(POST_IMAGES_TABLE)
    .select("storage_path")
    .eq("post_id", postId);

  if (imageRowsError) {
    return { data: null, error: imageRowsError };
  }

  const storagePaths = (imageRows || []).map((row) => row.storage_path).filter(Boolean);
  if (storagePaths.length > 0) {
    const { error: storageDeleteError } = await client.storage.from(PUBLIC_BUCKET).remove(storagePaths);
    if (storageDeleteError) {
      return { data: null, error: storageDeleteError };
    }
  }

  const { error: imageDeleteError } = await client.from(POST_IMAGES_TABLE).delete().eq("post_id", postId);
  if (imageDeleteError) {
    return { data: null, error: imageDeleteError };
  }

  const { data, error } = await client.from(POSTS_TABLE).delete().eq("post_id", postId).eq("user_id", userId);
  return { data, error };
}

export async function getPostById(postId) {
  if (!postId) {
    return { data: null, error: new Error("Post id is required.") };
  }

  const { data, error } = await client
    .from(POSTS_TABLE)
    .select("post_id, user_id")
    .eq("post_id", postId)
    .single();

  return { data, error };
}
