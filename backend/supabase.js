import crypto from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POSTS_TABLE = process.env.SUPABASE_POSTS_TABLE || "posts";
const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || "post-images";

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL in backend environment.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in backend environment.");
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalizeFolder(folder = "uploads") {
  const cleaned = folder.trim().replace(/^\/+|\/+$/g, "");
  return cleaned || "uploads";
}

function buildObjectPath(originalName = "", folder = "uploads") {
  const safeFolder = normalizeFolder(folder);
  const extension = path.extname(originalName).toLowerCase();
  const safeExtension = extension && extension.length <= 12 ? extension : ".bin";
  return `${safeFolder}/${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
}

function toPublicUrl(objectPath) {
  return client.storage.from(PUBLIC_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

export async function getPosts() {
  const { data, error } = await client.from(POSTS_TABLE).select("*").order("id", { ascending: false });
  return { data, error };
}

export async function getUserFromAccessToken(accessToken) {
  if (!accessToken) {
    return { data: null, error: new Error("Missing access token.") };
  }

  const { data, error } = await client.auth.getUser(accessToken);
  return { data: data?.user ?? null, error: error ?? null };
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

export async function uploadPublicImage(file, folder = "uploads") {
  if (!file?.buffer) {
    return { data: null, error: new Error("Image file is required.") };
  }

  if (!file.mimetype?.startsWith("image/")) {
    return { data: null, error: new Error("Only image files are allowed.") };
  }

  const objectPath = buildObjectPath(file.originalname || "", folder);
  const { error } = await client.storage.from(PUBLIC_BUCKET).upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      path: objectPath,
      url: toPublicUrl(objectPath),
    },
    error: null,
  };
}

export async function listPublicImages(prefix = "") {
  const normalizedPrefix = prefix.trim().replace(/^\/+|\/+$/g, "");
  const { data, error } = await client.storage.from(PUBLIC_BUCKET).list(normalizedPrefix || undefined, {
    limit: 100,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    return { data: null, error };
  }

  const items = (data || []).map((file) => {
    const objectPath = normalizedPrefix ? `${normalizedPrefix}/${file.name}` : file.name;
    return {
      name: file.name,
      path: objectPath,
      url: toPublicUrl(objectPath),
    };
  });

  return { data: items, error: null };
}
