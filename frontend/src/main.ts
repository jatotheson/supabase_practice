import "./app.css";
import githubLogo from "./assets/github-logo.svg";
import googleLogo from "./assets/google-logo.svg";
import { getSession, signInWithGithub, signInWithGoogle, signOut } from "./auth";
import { createRecord, deleteRecord, getRecords, syncUserRecord, uploadImage } from "./api";
import type { PostRecord } from "./api";

const googleSignInButton = document.querySelector<HTMLButtonElement>("#google_sign_in_btn");
const githubSignInButton = document.querySelector<HTMLButtonElement>("#github_sign_in_btn");
const googleSignInIcon = document.querySelector<HTMLImageElement>("#google-sign-in-icon");
const githubSignInIcon = document.querySelector<HTMLImageElement>("#github-sign-in-icon");
const logoutButton = document.querySelector<HTMLInputElement>("#logout");
const createButton = document.querySelector<HTMLInputElement>("#create_btn");
const createForm = document.querySelector<HTMLFormElement>("#create_form");
const createTitleInput = document.querySelector<HTMLInputElement>("#create_title");
const createBodyInput = document.querySelector<HTMLTextAreaElement>("#create_body");
const createImagesInput = document.querySelector<HTMLInputElement>("#create_images");
const createImagesPreview = document.querySelector<HTMLDivElement>("#create_images_preview");
const historyEl = document.querySelector<HTMLDivElement>("#history");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
let imagePreviewUrls: string[] = [];
let selectedImageFiles: File[] = [];
let lastSyncedUserId: string | null = null;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function setStatus(message: string, isError = false): void {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatPostCreatedAt(value: string | null | undefined): string {
  if (!value) {
    return "(unknown time)";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "(unknown time)";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  let hours = parsed.getHours();
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hourText = String(hours).padStart(2, "0");

  return `${year}-${month}-${day} ${hourText}-${minutes} ${meridiem}`;
}

function toHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function isLikelyImageUrl(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    const lowerPath = parsed.pathname.toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(lowerPath);
  } catch {
    return false;
  }
}

function parseRecordBody(bodyValue: string | null | undefined): { text: string; imageUrls: string[] } {
  const raw = (bodyValue || "").trim();
  if (!raw) {
    return { text: "", imageUrls: [] };
  }

  const lines = raw.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => line.trim().toLowerCase() === "attached images:");
  const imageCandidateLines = markerIndex >= 0 ? lines.slice(markerIndex + 1) : lines;
  const textLines = markerIndex >= 0 ? lines.slice(0, markerIndex) : [];

  const imageUrls: string[] = [];
  const seen = new Set<string>();

  imageCandidateLines.forEach((line) => {
    const normalized = toHttpUrl(line);
    if (!normalized || !isLikelyImageUrl(normalized) || seen.has(normalized)) {
      if (markerIndex < 0) {
        textLines.push(line);
      }
      return;
    }
    seen.add(normalized);
    imageUrls.push(normalized);
  });

  return {
    text: textLines.join("\n").trim(),
    imageUrls,
  };
}

function getRecordImageUrls(record: PostRecord): string[] {
  const imageRecords = Array.isArray(record.images) ? record.images : [];
  if (imageRecords.length > 0) {
    const safeImages = [...imageRecords].sort((a, b) => {
      const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });

    return safeImages
      .map((imageRecord) => toHttpUrl(imageRecord.url))
      .filter((url): url is string => Boolean(url));
  }

  return parseRecordBody(record.body).imageUrls;
}

function setCreateFormVisibility(show: boolean): void {
  if (!createForm) {
    return;
  }
  createForm.hidden = !show;
}

function clearImagePreviews(): void {
  imagePreviewUrls.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  imagePreviewUrls = [];

  if (createImagesPreview) {
    createImagesPreview.replaceChildren();
    createImagesPreview.hidden = true;
  }
}

function syncSelectedImagesInput(): void {
  if (!createImagesInput) {
    return;
  }

  try {
    const dataTransfer = new DataTransfer();
    selectedImageFiles.forEach((file) => {
      dataTransfer.items.add(file);
    });
    createImagesInput.files = dataTransfer.files;
  } catch {
    // Ignore if the browser does not allow assigning FileList.
  }
}

function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function isAllowedImageFile(file: File): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has((file.type || "").toLowerCase());
}

function renderImagePreviews(): void {
  clearImagePreviews();

  if (!createImagesInput || !createImagesPreview) {
    return;
  }

  if (selectedImageFiles.length === 0) {
    return;
  }

  selectedImageFiles.forEach((file, index) => {
    const previewUrl = URL.createObjectURL(file);
    imagePreviewUrls.push(previewUrl);

    const card = document.createElement("figure");
    card.className = "image-preview-item";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "image-preview-remove";
    removeButton.setAttribute("aria-label", `Remove ${file.name}`);
    removeButton.textContent = "X";
    removeButton.addEventListener("click", () => {
      selectedImageFiles.splice(index, 1);
      syncSelectedImagesInput();
      renderImagePreviews();
    });
    card.appendChild(removeButton);

    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = file.name;
    image.loading = "lazy";
    card.appendChild(image);

    const caption = document.createElement("figcaption");
    caption.className = "image-preview-name";
    caption.textContent = file.name;
    card.appendChild(caption);

    createImagesPreview.appendChild(card);
  });

  createImagesPreview.hidden = false;
}

function resetCreateForm(): void {
  if (createTitleInput) {
    createTitleInput.value = "";
  }
  if (createBodyInput) {
    createBodyInput.value = "";
  }
  if (createImagesInput) {
    createImagesInput.value = "";
  }
  selectedImageFiles = [];
  clearImagePreviews();
}

async function checkLogin(): Promise<void> {
  try {
    const session = await getSession();
    const currentUserId = session?.user?.id || null;

    if (session && currentUserId && lastSyncedUserId !== currentUserId) {
      const { error } = await syncUserRecord();
      if (error) {
        setStatus(`User sync failed: ${error.message}`, true);
      } else {
        lastSyncedUserId = currentUserId;
      }
    }

    if (!session) {
      lastSyncedUserId = null;
    }

    if (googleSignInButton) googleSignInButton.style.display = session ? "none" : "inline-flex";
    if (githubSignInButton) githubSignInButton.style.display = session ? "none" : "inline-flex";
    if (logoutButton) logoutButton.style.display = session ? "inline-block" : "none";
  } catch (error) {
    setStatus(`Unable to check session: ${formatError(error)}`, true);
  }
}

function createRecordElement(record: PostRecord, canDelete: boolean): HTMLElement {
  const wrapper = document.createElement("article");
  wrapper.className = "record";

  const header = document.createElement("div");
  header.className = "record-header";

  const title = document.createElement("h2");
  title.textContent = record.title || "(untitled)";
  header.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "record-meta";

  const userId = document.createElement("span");
  userId.className = "record-user-id";
  const preferredUserName = typeof record.user_name === "string" ? record.user_name.trim() : "";
  userId.textContent = preferredUserName || (record.user_id ? String(record.user_id) : "(unknown user)");
  meta.appendChild(userId);

  const createdAt = document.createElement("span");
  createdAt.className = "record-created-at";
  createdAt.textContent = formatPostCreatedAt(record.created_at);
  meta.appendChild(createdAt);

  header.appendChild(meta);

  wrapper.appendChild(header);

  const parsedBody = parseRecordBody(record.body);
  const imageUrls = getRecordImageUrls(record);
  const displayBodyText =
    Array.isArray(record.images) && record.images.length > 0 ? (record.body || "").trim() : parsedBody.text;

  if (displayBodyText || imageUrls.length === 0) {
    const body = document.createElement("p");
    body.textContent = displayBodyText || "(no body)";
    wrapper.appendChild(body);
  }

  if (imageUrls.length > 0) {
    const imageGrid = document.createElement("div");
    imageGrid.className = "record-image-grid";

    imageUrls.forEach((imageUrl, index) => {
      const link = document.createElement("a");
      link.className = "record-image-link";
      link.href = imageUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Open attached image ${index + 1}`);

      const image = document.createElement("img");
      image.className = "record-image";
      image.src = imageUrl;
      image.alt = `Attached image ${index + 1}`;
      image.loading = "lazy";
      image.decoding = "async";

      link.appendChild(image);
      imageGrid.appendChild(link);
    });

    wrapper.appendChild(imageGrid);
  }

  if (canDelete) {
    const deleteButton = document.createElement("input");
    deleteButton.type = "button";
    deleteButton.value = "delete";
    deleteButton.className = "delete-btn";
    deleteButton.addEventListener("click", async () => {
      try {
        const { error } = await deleteRecord(String(record.post_id));
        if (error) {
          setStatus(`Delete failed: ${error.message}`, true);
          return;
        }
        setStatus("Record deleted.");
        await refreshHistory();
      } catch (error) {
        setStatus(`Delete failed: ${formatError(error)}`, true);
      }
    });
    wrapper.appendChild(deleteButton);
  }

  return wrapper;
}

async function refreshHistory(): Promise<void> {
  if (!historyEl) {
    return;
  }

  historyEl.replaceChildren();

  try {
    const session = await getSession();
    const { data: records, error } = await getRecords();
    if (error) {
      throw error;
    }

    const safeRecords = (records || []) as PostRecord[];
    const canDelete = session !== null;

    if (safeRecords.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty";
      emptyState.textContent = "No records yet.";
      historyEl.appendChild(emptyState);
      return;
    }

    safeRecords.forEach((record) => {
      historyEl.appendChild(createRecordElement(record, canDelete));
    });
  } catch (error) {
    setStatus(`Unable to load records: ${formatError(error)}`, true);
  }
}

googleSignInButton?.addEventListener("click", async () => {
  try {
    const { error } = await signInWithGoogle();
    if (error) {
      setStatus(`Login failed: ${error.message}`, true);
    }
  } catch (error) {
    setStatus(`Login failed: ${formatError(error)}`, true);
  }
});

githubSignInButton?.addEventListener("click", async () => {
  try {
    const { error } = await signInWithGithub();
    if (error) {
      setStatus(`Login failed: ${error.message}`, true);
    }
  } catch (error) {
    setStatus(`Login failed: ${formatError(error)}`, true);
  }
});

logoutButton?.addEventListener("click", async () => {
  try {
    const { error } = await signOut();
    if (error) {
      setStatus(`Logout failed: ${error.message}`, true);
      return;
    }
    setStatus("Logged out.");
    await checkLogin();
    await refreshHistory();
  } catch (error) {
    setStatus(`Logout failed: ${formatError(error)}`, true);
  }
});

createButton?.addEventListener("click", () => {
  setCreateFormVisibility(true);
  createTitleInput?.focus();
});

createImagesInput?.addEventListener("change", () => {
  const newFiles = Array.from(createImagesInput.files || []);
  if (newFiles.length === 0) {
    return;
  }

  const validNewFiles = newFiles.filter((file) => isAllowedImageFile(file));
  const invalidNewFiles = newFiles.filter((file) => !isAllowedImageFile(file));

  const existingKeys = new Set(selectedImageFiles.map((file) => getFileKey(file)));
  validNewFiles.forEach((file) => {
    const key = getFileKey(file);
    if (!existingKeys.has(key)) {
      selectedImageFiles.push(file);
      existingKeys.add(key);
    }
  });

  if (invalidNewFiles.length > 0) {
    const invalidNames = invalidNewFiles.map((file) => file.name).join(", ");
    setStatus(
      `Ignored unsupported image file(s): ${invalidNames}. Allowed: jpeg, png, webp, gif.`,
      true,
    );
  }

  syncSelectedImagesInput();
  renderImagePreviews();
});

createForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const cleanTitle = createTitleInput?.value.trim() || "";
  const cleanBody = createBodyInput?.value.trim() || "";
  if (!cleanTitle || !cleanBody) {
    setStatus("Title and body are required.", true);
    return;
  }

  try {
    const selectedImages = [...selectedImageFiles];
    const { data: createdPost, error: createError } = await createRecord(cleanTitle, cleanBody);
    if (createError) {
      setStatus(`Create failed: ${createError.message}`, true);
      return;
    }

    const createdPostId = createdPost?.post_id;
    if (!createdPostId) {
      setStatus("Create failed: missing created post id.", true);
      return;
    }

    if (selectedImages.length > 0) {
      setStatus(`Uploading ${selectedImages.length} image(s)...`);
      const uploadResults = await Promise.all(
        selectedImages.map((file, index) => uploadImage(file, createdPostId, index)),
      );

      const firstUploadError = uploadResults.find((result) => result.error)?.error;
      if (firstUploadError) {
        const { error: rollbackError } = await deleteRecord(String(createdPostId));
        if (rollbackError) {
          setStatus(
            `Create failed: ${firstUploadError.message}. Rollback failed: ${rollbackError.message}`,
            true,
          );
          return;
        }

        setStatus(`Create failed: ${firstUploadError.message}`, true);
        await refreshHistory();
        return;
      }
    }

    setStatus("Record created.");
    resetCreateForm();
    setCreateFormVisibility(false);
    await refreshHistory();
  } catch (error) {
    setStatus(`Create failed: ${formatError(error)}`, true);
  }
});

void checkLogin();
void refreshHistory();

if (googleSignInIcon) googleSignInIcon.src = googleLogo;
if (githubSignInIcon) githubSignInIcon.src = githubLogo;
