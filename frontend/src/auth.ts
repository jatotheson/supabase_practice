import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://hbqyrvxbvrtktkxvbtwf.supabase.co";
const SUPABASE_PUBLIC_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicXlydnhidnJ0a3RreHZidHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg4MDMsImV4cCI6MjA4NzE3NDgwM30.RP4LrppCwRpyIEeUx7fn7Ibgb6oZOTOVTiBU4tcz8Uw";

const client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY);

function getRedirectUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.location.origin;
}

function getSupabaseProjectRef() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return null;
  }
}

function clearSupabaseAuthCache() {
  if (typeof window === "undefined") {
    return;
  }

  const projectRef = getSupabaseProjectRef();
  if (!projectRef) {
    return;
  }

  const prefix = `sb-${projectRef}-`;
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    Object.keys(storage).forEach((key) => {
      if (key.startsWith(prefix)) {
        storage.removeItem(key);
      }
    });
  });
}

export async function getSession() {
  const { data } = await client.auth.getSession();
  return data.session;
}

export async function signInWithGoogle() {
  const redirectTo = getRedirectUrl();
  return client.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo
      ? {
          redirectTo,
          queryParams: { prompt: "select_account" },
        }
      : undefined,
  });
}

export async function signInWithGithub() {
  const redirectTo = getRedirectUrl();
  return client.auth.signInWithOAuth({
    provider: "github",
    options: redirectTo
      ? {
          redirectTo,
          queryParams: { prompt: "select_account" },
        }
      : undefined,
  });
}

export async function signOut() {
  const result = await client.auth.signOut({ scope: "global" });
  clearSupabaseAuthCache();
  return result;
}
