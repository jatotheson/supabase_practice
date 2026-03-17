import { createClient, type Session } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://hbqyrvxbvrtktkxvbtwf.supabase.co";
const SUPABASE_PUBLIC_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicXlydnhidnJ0a3RreHZidHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg4MDMsImV4cCI6MjA4NzE3NDgwM30.RP4LrppCwRpyIEeUx7fn7Ibgb6oZOTOVTiBU4tcz8Uw";

const client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY);

let cachedSession: Session | null = null;
let sessionLoaded = false;
let sessionLoadPromise: Promise<Session | null> | null = null;

declare global {
  interface Window {
    supabase?: typeof client;
  }
}

if (typeof window !== "undefined") {
  window.supabase = client;
}

client.auth.onAuthStateChange((_event, session) => {
  cachedSession = session;
  sessionLoaded = true;
});

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
  if (sessionLoaded && !sessionLoadPromise) {
    return cachedSession;
  }

  if (!sessionLoadPromise) {
    sessionLoadPromise = client.auth
      .getSession()
      .then(({ data }) => {
        cachedSession = data.session;
        sessionLoaded = true;
        return cachedSession;
      })
      .finally(() => {
        sessionLoadPromise = null;
      });
  }

  return sessionLoadPromise;
}

export function getCachedSession() {
  return cachedSession;
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
  cachedSession = null;
  sessionLoaded = true;
  const result = await client.auth.signOut({ scope: "local" });
  await client.auth.signOut({ scope: "global" }).catch(() => undefined);
  clearSupabaseAuthCache();
  return result;
}

export function onAuthStateChange(
  callback: Parameters<typeof client.auth.onAuthStateChange>[0]
) {
  return client.auth.onAuthStateChange(callback);
}

if (typeof window !== "undefined") {
  void getSession().catch(() => undefined);
}
