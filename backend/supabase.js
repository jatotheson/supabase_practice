import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 
  "https://hbqyrvxbvrtktkxvbtwf.supabase.co";
const SUPABASE_PUBLIC_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicXlydnhidnJ0a3RreHZidHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg4MDMsImV4cCI6MjA4NzE3NDgwM30.RP4LrppCwRpyIEeUx7fn7Ibgb6oZOTOVTiBU4tcz8Uw";

export const client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY);

function getRedirectUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.location.origin;
}

export async function getSession() {
  const { data } = await client.auth.getSession();
  return data.session;
}

export async function signInWithGithub() {
  const redirectTo = getRedirectUrl();
  return client.auth.signInWithOAuth({
    provider: "github",
    options: redirectTo ? { redirectTo } : undefined,
  });
}

export async function signOut() {
  return client.auth.signOut();
}

export async function getRecords() {
  const { data, error } = await client.from("page").select("*");
  return { data, error };
}

/**
 * @param {string | null} title
 * @param {string | null} body
 */
export async function createRecord(title, body) {
  const { data, error } = await client.from("page").insert([{ title, body }]);
  return { data, error };
}

/**
 * @param {string | undefined} id
 */
export async function deleteRecord(id) {
  const { data, error } = await client.from("page").delete().eq("id", id);
  return { data, error };
}
