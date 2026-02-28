import { getSession } from "./auth";

export type ApiResult<T> = {
  data: T | null;
  error: Error | null;
};

export type PostRecord = {
  post_id: string | number;
  user_id: string | null;
  user_name: string | null;
  created_at: string | null;
  title: string | null;
  body: string | null;
};

export type UploadedImage = {
  name?: string;
  path: string;
  url: string;
};

export type UserRecord = {
  user_id: string;
  user_name: string | null;
  created_at: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(init.headers);
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (!isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const session = await getSession();
    const accessToken = session?.access_token;
    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof payload.error === "string"
          ? payload.error
          : `Request failed with status ${response.status}`;
      return { data: null, error: new Error(message) };
    }

    return { data: (payload.data ?? null) as T | null, error: null };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}

export async function getRecords() {
  return request<PostRecord[]>("/posts");
}

export async function createRecord(title: string, body: string) {
  return request<PostRecord>("/posts", {
    method: "POST",
    body: JSON.stringify({ title, body }),
  });
}

export async function deleteRecord(id: string) {
  return request<{ success: boolean }>(`/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function uploadImage(file: File, folder = "uploads") {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);
  return request<UploadedImage>("/images/upload", {
    method: "POST",
    body: formData,
  });
}

export async function listImages(prefix = "") {
  const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
  return request<UploadedImage[]>(`/images${query}`);
}

export async function syncUserRecord() {
  return request<UserRecord>("/users/sync", {
    method: "POST",
  });
}
