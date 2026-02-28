import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const POSTS_TABLE = process.env.SUPABASE_POSTS_TABLE || "posts";
export const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || "post-images";

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL in backend environment.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in backend environment.");
}

export const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
