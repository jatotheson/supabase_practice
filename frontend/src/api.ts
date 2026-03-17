import { getCachedSession, getSession } from "./auth";

export type ApiResult<T> = {
  data: T | null;
  error: Error | null;
};

export type PostImageRecord = {
  image_id: string;
  post_id: string | number;
  storage_path: string;
  sort_order: number | null;
  url: string;
};

export type TempUploadRecord = {
  upload_id: string;
  storage_path: string;
  preview_url: string | null;
  mime_type: string;
  file_size_bytes: number;
  expires_at: string;
  sort_order: number | null;
};

export type PostRecord = {
  post_id: string | number;
  user_id: string | null;
  user_name: string | null;
  created_at: string | null;
  title: string | null;
  body: string | null;
  post_type?: string | null;
  team_size?: number | null;
  project_duration?: string | null;
  recruitment_deadline?: string | null;
  work_style?: string | null;
  location_state?: string | null;
  location_city?: string | null;
  contact_email?: string | null;
  contact_discord?: string | null;
  contact_slack?: string | null;
  commitment_level?: string | null;
  positions?: string[] | null;
  position_counts?: Record<string, number> | null;
  tech_stacks?: string[] | null;
  is_bookmarked?: boolean | null;
  images?: PostImageRecord[] | null;
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

export type PostFilters = {
  post_type?: string;
  team_size_min?: number;
  team_size_max?: number;
  project_duration?: string[];
  recruitment_deadline_before?: string;
  recruitment_deadline_after?: string;
  work_style?: string[];
  location_state?: string[];
  location_city?: string;
  commitment_level?: string[];
  bookmarked?: boolean;
  positions?: string[];
  positions_match?: string;
  tech_stacks?: string[];
  tech_stacks_match?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: string;
};

export type CreatePostPayload = {
  title: string;
  body: string;
  post_type: string;
  team_size: number;
  project_duration: string;
  recruitment_deadline: string;
  work_style: string;
  location_state?: string | null;
  location_city?: string | null;
  contact_email: string;
  contact_discord?: string | null;
  contact_slack?: string | null;
  commitment_level: string;
  position_counts: Record<string, number>;
  tech_stacks?: string[];
  temp_upload_ids?: string[];
};

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10000;

type RequestAuthMode = "optional" | "required" | "none";

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

function serializeQueryValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    const safeValues = value.map((item) => String(item).trim()).filter(Boolean);
    return safeValues.length > 0 ? safeValues.join(",") : null;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    const serialized = serializeQueryValue(value);
    if (serialized !== null) {
      params.set(key, serialized);
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  authMode: RequestAuthMode = "optional"
): Promise<ApiResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers = new Headers(init.headers);
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (!isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let accessToken = getCachedSession()?.access_token || null;

    if (!accessToken && authMode === "required") {
      const session = await getSession();
      accessToken = session?.access_token || null;
    }

    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    timeoutId = null;

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
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        data: null,
        error: new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`),
      };
    }

    return { data: null, error: toError(error) };
  }
}

export async function getRecords(filters: PostFilters = {}) {
  return request<PostRecord[]>(`/posts${buildQueryString(filters)}`);
}

export async function createRecord(payload: CreatePostPayload) {
  return request<PostRecord>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  }, "required");
}

export async function deleteRecord(id: string) {
  return request<{ success: boolean }>(`/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }, "required");
}

export async function uploadImage(file: File, postId: string | number, sortOrder: number) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("post_id", String(postId));
  formData.append("sort_order", String(sortOrder));
  return request<PostImageRecord>("/images/upload", {
    method: "POST",
    body: formData,
  }, "required");
}

export async function createTempUpload(file: File, sortOrder: number) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("sort_order", String(sortOrder));
  return request<TempUploadRecord>("/images/temp", {
    method: "POST",
    body: formData,
  }, "required");
}

export async function deleteTempUpload(uploadId: string) {
  return request<{ deleted: boolean; upload_id: string }>(
    `/images/temp/${encodeURIComponent(uploadId)}`,
    {
      method: "DELETE",
    },
    "required"
  );
}

export async function listImages(prefix = "") {
  const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
  return request<UploadedImage[]>(`/images${query}`);
}

export async function syncUserRecord() {
  return request<UserRecord>("/users/sync", {
    method: "POST",
  }, "required");
}
