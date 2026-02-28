import "./app.css";
import githubLogo from "./assets/github-logo.svg";
import googleLogo from "./assets/google-logo.svg";
import { getSession, signInWithGithub, signInWithGoogle, signOut } from "./auth";
import { createRecord, deleteRecord, getRecords, uploadImage } from "./api";
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

  const title = document.createElement("h2");
  title.textContent = record.title || "(untitled)";
  wrapper.appendChild(title);

  const body = document.createElement("p");
  body.textContent = record.body || "(no body)";
  wrapper.appendChild(body);

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
    let finalBody = cleanBody;

    if (selectedImages.length > 0) {
      setStatus(`Uploading ${selectedImages.length} image(s)...`);
      const uploadFolder = `posts/${Date.now()}`;
      const uploadResults = await Promise.all(
        selectedImages.map((file) => uploadImage(file, uploadFolder)),
      );

      const firstUploadError = uploadResults.find((result) => result.error)?.error;
      if (firstUploadError) {
        setStatus(`Image upload failed: ${firstUploadError.message}`, true);
        return;
      }

      const imageUrls = uploadResults
        .map((result) => result.data?.url || null)
        .filter((url): url is string => Boolean(url));

      if (imageUrls.length > 0) {
        finalBody = `${cleanBody}\n\nAttached Images:\n${imageUrls.join("\n")}`;
      }
    }

    const { error } = await createRecord(cleanTitle, finalBody);
    if (error) {
      setStatus(`Create failed: ${error.message}`, true);
      return;
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
