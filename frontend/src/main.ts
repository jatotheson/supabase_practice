import "./app.css";
import githubLogo from "./assets/github-logo.svg";
import googleLogo from "./assets/google-logo.svg";
import {
  getCachedSession,
  getSession,
  onAuthStateChange,
  signInWithGithub,
  signInWithGoogle,
  signOut,
} from "./auth";
import {
  createRecord,
  createTempUpload,
  deleteRecord,
  deleteTempUpload,
  getRecords,
  syncUserRecord,
  type CreatePostPayload,
  type PostFilters,
  type PostRecord,
  type TempUploadRecord,
} from "./api";

type TempUploadItem = TempUploadRecord & {
  file_name: string;
  local_preview_url: string | null;
};

const googleSignInButton = document.querySelector<HTMLButtonElement>("#google_sign_in_btn");
const githubSignInButton = document.querySelector<HTMLButtonElement>("#github_sign_in_btn");
const googleSignInIcon = document.querySelector<HTMLImageElement>("#google-sign-in-icon");
const githubSignInIcon = document.querySelector<HTMLImageElement>("#github-sign-in-icon");
const logoutButton = document.querySelector<HTMLInputElement>("#logout");
const createButton = document.querySelector<HTMLInputElement>("#create_btn");
const createForm = document.querySelector<HTMLFormElement>("#create_form");
const createTitleInput = document.querySelector<HTMLInputElement>("#create_title");
const createBodyInput = document.querySelector<HTMLTextAreaElement>("#create_body");
const createPostTypeInput = document.querySelector<HTMLSelectElement>("#create_post_type");
const createTeamSizeInput = document.querySelector<HTMLInputElement>("#create_team_size");
const createProjectDurationInput = document.querySelector<HTMLSelectElement>("#create_project_duration");
const createRecruitmentDeadlineInput = document.querySelector<HTMLInputElement>("#create_recruitment_deadline");
const createWorkStyleInput = document.querySelector<HTMLSelectElement>("#create_work_style");
const createLocationStateInput = document.querySelector<HTMLInputElement>("#create_location_state");
const createLocationCityInput = document.querySelector<HTMLInputElement>("#create_location_city");
const createContactEmailInput = document.querySelector<HTMLInputElement>("#create_contact_email");
const createContactDiscordInput = document.querySelector<HTMLInputElement>("#create_contact_discord");
const createContactSlackInput = document.querySelector<HTMLInputElement>("#create_contact_slack");
const createCommitmentLevelInput = document.querySelector<HTMLSelectElement>("#create_commitment_level");
const createPositionCountsInput = document.querySelector<HTMLInputElement>("#create_position_counts");
const createTechStacksInput = document.querySelector<HTMLInputElement>("#create_tech_stacks");
const createImagesInput = document.querySelector<HTMLInputElement>("#create_images");
const uploadTempImagesButton = document.querySelector<HTMLButtonElement>("#upload_temp_images_btn");
const tempUploadStatusEl = document.querySelector<HTMLParagraphElement>("#temp_upload_status");
const createImagesPreview = document.querySelector<HTMLDivElement>("#create_images_preview");
const historyEl = document.querySelector<HTMLDivElement>("#history");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const filterIndicatorEl = document.querySelector<HTMLParagraphElement>("#filter_indicator");
const applyFiltersButton = document.querySelector<HTMLButtonElement>("#apply_filters_btn");
const resetFiltersButton = document.querySelector<HTMLButtonElement>("#reset_filters_btn");
const filterPostTypeInput = document.querySelector<HTMLSelectElement>("#filter_post_type");
const filterTeamSizeMinInput = document.querySelector<HTMLInputElement>("#filter_team_size_min");
const filterTeamSizeMaxInput = document.querySelector<HTMLInputElement>("#filter_team_size_max");
const filterProjectDurationInput = document.querySelector<HTMLInputElement>("#filter_project_duration");
const filterDeadlineBeforeInput = document.querySelector<HTMLInputElement>("#filter_deadline_before");
const filterDeadlineAfterInput = document.querySelector<HTMLInputElement>("#filter_deadline_after");
const filterWorkStyleInput = document.querySelector<HTMLInputElement>("#filter_work_style");
const filterLocationStateInput = document.querySelector<HTMLInputElement>("#filter_location_state");
const filterLocationCityInput = document.querySelector<HTMLInputElement>("#filter_location_city");
const filterCommitmentLevelInput = document.querySelector<HTMLInputElement>("#filter_commitment_level");
const filterBookmarkedInput = document.querySelector<HTMLInputElement>("#filter_bookmarked");
const filterPositionsInput = document.querySelector<HTMLInputElement>("#filter_positions");
const filterPositionsMatchInput = document.querySelector<HTMLSelectElement>("#filter_positions_match");
const filterTechStacksInput = document.querySelector<HTMLInputElement>("#filter_tech_stacks");
const filterTechStacksMatchInput = document.querySelector<HTMLSelectElement>("#filter_tech_stacks_match");
const filterLimitInput = document.querySelector<HTMLInputElement>("#filter_limit");
const filterOffsetInput = document.querySelector<HTMLInputElement>("#filter_offset");
const filterSortInput = document.querySelector<HTMLSelectElement>("#filter_sort");
const filterOrderInput = document.querySelector<HTMLSelectElement>("#filter_order");

let lastSyncedUserId: string | null = null;
let pendingTempImageFiles: File[] = [];
let tempUploads: TempUploadItem[] = [];
let appliedFilters: PostFilters = {};
let recordsLoadRequestId = 0;
let lastLoggedSessionToken: string | null | undefined;

const ALLOWED_TEMP_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function setStatus(message: string, isError = false): void {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setTempUploadStatus(message: string, isError = false): void {
  if (!tempUploadStatusEl) {
    return;
  }
  tempUploadStatusEl.textContent = message;
  tempUploadStatusEl.classList.toggle("error", isError);
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

function parseCsvValues(value: string | null | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalInteger(value: string | null | undefined): number | undefined {
  const raw = (value || "").trim();
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parsePositionCounts(
  value: string | null | undefined
): { positionCounts: Record<string, number> | null; error: string | null } {
  const raw = (value || "").trim();
  if (!raw) {
    return { positionCounts: null, error: "Position counts are required." };
  }

  const entries = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const positionCounts: Record<string, number> = {};

  for (const entry of entries) {
    const [positionRaw, countRaw] = entry.split(":").map((item) => item.trim());
    if (!positionRaw) {
      return { positionCounts: null, error: `Invalid position_counts entry: "${entry}".` };
    }

    if (!countRaw) {
      positionCounts[positionRaw] = 1;
      continue;
    }

    const count = Number(countRaw);
    if (!Number.isInteger(count) || count < 1) {
      return {
        positionCounts: null,
        error: `Invalid count for "${positionRaw}". Use integers greater than or equal to 1.`,
      };
    }

    positionCounts[positionRaw] = count;
  }

  if (Object.keys(positionCounts).length === 0) {
    return { positionCounts: null, error: "Position counts are required." };
  }

  return { positionCounts, error: null };
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

function releaseTempPreviewUrls(): void {
  tempUploads.forEach((upload) => {
    if (upload.local_preview_url) {
      URL.revokeObjectURL(upload.local_preview_url);
    }
  });
}

function renderTempUploadPreviews(): void {
  if (!createImagesPreview) {
    return;
  }

  createImagesPreview.replaceChildren();

  if (tempUploads.length === 0) {
    createImagesPreview.hidden = true;
    return;
  }

  tempUploads.forEach((upload) => {
    const card = document.createElement("figure");
    card.className = "image-preview-item";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "image-preview-remove";
    removeButton.setAttribute("aria-label", `Remove ${upload.file_name}`);
    removeButton.textContent = "X";
    removeButton.addEventListener("click", async () => {
      try {
        const { error } = await deleteTempUpload(upload.upload_id);
        if (error) {
          setTempUploadStatus(`Temp image delete failed: ${error.message}`, true);
          return;
        }

        if (upload.local_preview_url) {
          URL.revokeObjectURL(upload.local_preview_url);
        }

        tempUploads = tempUploads.filter((item) => item.upload_id !== upload.upload_id);
        renderTempUploadPreviews();
        setTempUploadStatus("Temporary upload removed.");
      } catch (error) {
        setTempUploadStatus(`Temp image delete failed: ${formatError(error)}`, true);
      }
    });
    card.appendChild(removeButton);

    const image = document.createElement("img");
    image.src = upload.preview_url || upload.local_preview_url || "";
    image.alt = upload.file_name;
    image.loading = "lazy";
    card.appendChild(image);

    const caption = document.createElement("figcaption");
    caption.className = "image-preview-name";
    caption.textContent = `${upload.file_name} (${upload.upload_id})`;
    card.appendChild(caption);

    createImagesPreview.appendChild(card);
  });

  createImagesPreview.hidden = false;
}

function resetCreateForm(): void {
  if (createTitleInput) createTitleInput.value = "";
  if (createBodyInput) createBodyInput.value = "";
  if (createPostTypeInput) createPostTypeInput.value = "portfolio";
  if (createTeamSizeInput) createTeamSizeInput.value = "1";
  if (createProjectDurationInput) createProjectDurationInput.value = "1_3_months";
  if (createRecruitmentDeadlineInput) createRecruitmentDeadlineInput.value = "";
  if (createWorkStyleInput) createWorkStyleInput.value = "online";
  if (createLocationStateInput) createLocationStateInput.value = "";
  if (createLocationCityInput) createLocationCityInput.value = "";
  if (createContactEmailInput) createContactEmailInput.value = "";
  if (createContactDiscordInput) createContactDiscordInput.value = "";
  if (createContactSlackInput) createContactSlackInput.value = "";
  if (createCommitmentLevelInput) createCommitmentLevelInput.value = "part_time";
  if (createPositionCountsInput) createPositionCountsInput.value = "";
  if (createTechStacksInput) createTechStacksInput.value = "";
  if (createImagesInput) createImagesInput.value = "";
  pendingTempImageFiles = [];
  releaseTempPreviewUrls();
  tempUploads = [];
  renderTempUploadPreviews();
  setTempUploadStatus("");
}

function clearFilterInputs(): void {
  if (filterPostTypeInput) filterPostTypeInput.value = "";
  if (filterTeamSizeMinInput) filterTeamSizeMinInput.value = "";
  if (filterTeamSizeMaxInput) filterTeamSizeMaxInput.value = "";
  if (filterProjectDurationInput) filterProjectDurationInput.value = "";
  if (filterDeadlineBeforeInput) filterDeadlineBeforeInput.value = "";
  if (filterDeadlineAfterInput) filterDeadlineAfterInput.value = "";
  if (filterWorkStyleInput) filterWorkStyleInput.value = "";
  if (filterLocationStateInput) filterLocationStateInput.value = "";
  if (filterLocationCityInput) filterLocationCityInput.value = "";
  if (filterCommitmentLevelInput) filterCommitmentLevelInput.value = "";
  if (filterBookmarkedInput) filterBookmarkedInput.checked = false;
  if (filterPositionsInput) filterPositionsInput.value = "";
  if (filterPositionsMatchInput) filterPositionsMatchInput.value = "";
  if (filterTechStacksInput) filterTechStacksInput.value = "";
  if (filterTechStacksMatchInput) filterTechStacksMatchInput.value = "";
  if (filterLimitInput) filterLimitInput.value = "";
  if (filterOffsetInput) filterOffsetInput.value = "";
  if (filterSortInput) filterSortInput.value = "";
  if (filterOrderInput) filterOrderInput.value = "";
}

function hasAppliedFilters(filters: PostFilters): boolean {
  return Object.keys(filters).length > 0;
}

function updateFilterIndicator(): void {
  if (!filterIndicatorEl) {
    return;
  }

  filterIndicatorEl.textContent = hasAppliedFilters(appliedFilters)
    ? "Filters applied. Showing only posts that match the current filters."
    : "No filters applied. Showing all available posts.";
}

function collectFiltersFromInputs(): PostFilters {
  const filters: PostFilters = {};

  const postType = filterPostTypeInput?.value.trim();
  if (postType) filters.post_type = postType;

  const teamSizeMin = parseOptionalInteger(filterTeamSizeMinInput?.value);
  if (teamSizeMin !== undefined) filters.team_size_min = teamSizeMin;

  const teamSizeMax = parseOptionalInteger(filterTeamSizeMaxInput?.value);
  if (teamSizeMax !== undefined) filters.team_size_max = teamSizeMax;

  const projectDuration = parseCsvValues(filterProjectDurationInput?.value);
  if (projectDuration.length > 0) filters.project_duration = projectDuration;

  const deadlineBefore = filterDeadlineBeforeInput?.value.trim();
  if (deadlineBefore) filters.recruitment_deadline_before = deadlineBefore;

  const deadlineAfter = filterDeadlineAfterInput?.value.trim();
  if (deadlineAfter) filters.recruitment_deadline_after = deadlineAfter;

  const workStyle = parseCsvValues(filterWorkStyleInput?.value);
  if (workStyle.length > 0) filters.work_style = workStyle;

  const locationState = parseCsvValues(filterLocationStateInput?.value);
  if (locationState.length > 0) filters.location_state = locationState;

  const locationCity = filterLocationCityInput?.value.trim();
  if (locationCity) filters.location_city = locationCity;

  const commitmentLevel = parseCsvValues(filterCommitmentLevelInput?.value);
  if (commitmentLevel.length > 0) filters.commitment_level = commitmentLevel;

  if (filterBookmarkedInput?.checked) {
    filters.bookmarked = true;
  }

  const positions = parseCsvValues(filterPositionsInput?.value);
  if (positions.length > 0) {
    filters.positions = positions;
    const positionsMatch = filterPositionsMatchInput?.value.trim();
    if (positionsMatch) {
      filters.positions_match = positionsMatch;
    }
  }

  const techStacks = parseCsvValues(filterTechStacksInput?.value);
  if (techStacks.length > 0) {
    filters.tech_stacks = techStacks;
    const techStacksMatch = filterTechStacksMatchInput?.value.trim();
    if (techStacksMatch) {
      filters.tech_stacks_match = techStacksMatch;
    }
  }

  const limit = parseOptionalInteger(filterLimitInput?.value);
  if (limit !== undefined) filters.limit = limit;

  const offset = parseOptionalInteger(filterOffsetInput?.value);
  if (offset !== undefined) filters.offset = offset;

  const sort = filterSortInput?.value.trim();
  if (sort) filters.sort = sort;

  const order = filterOrderInput?.value.trim();
  if (order) filters.order = order;

  return filters;
}

async function checkLogin(): Promise<void> {
  try {
    const session = await getSession();
    const currentUserId = session?.user?.id || null;

    if (!session) {
      lastSyncedUserId = null;
    }

    if (googleSignInButton) googleSignInButton.style.display = session ? "none" : "inline-flex";
    if (githubSignInButton) githubSignInButton.style.display = session ? "none" : "inline-flex";
    if (logoutButton) logoutButton.style.display = session ? "inline-block" : "none";
    if (filterBookmarkedInput) filterBookmarkedInput.disabled = !session;

    if (session && currentUserId && lastSyncedUserId !== currentUserId) {
      void syncUserRecord().then(({ error }) => {
        if (error) {
          setStatus(`User sync failed: ${error.message}`, true);
          return;
        }
        lastSyncedUserId = currentUserId;
      });
    }
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

  const extraMeta = [
    record.post_type,
    typeof record.team_size === "number" ? `team ${record.team_size}` : null,
    record.project_duration,
    record.work_style,
  ].filter(Boolean);

  if (extraMeta.length > 0) {
    const details = document.createElement("p");
    details.textContent = extraMeta.join(" • ");
    wrapper.appendChild(details);
  }

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

  const requestId = ++recordsLoadRequestId;
  historyEl.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "empty";
  loading.textContent = "Loading posts...";
  historyEl.appendChild(loading);
  updateFilterIndicator();

  try {
    const { data: records, error } = await getRecords(appliedFilters);
    if (requestId !== recordsLoadRequestId) {
      return;
    }

    if (error) {
      throw error;
    }

    const safeRecords = (records || []) as PostRecord[];
    const canDelete = getCachedSession() !== null;
    historyEl.replaceChildren();

    if (safeRecords.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty";
      emptyState.textContent = hasAppliedFilters(appliedFilters)
        ? "No posts matched the applied filters."
        : "No records yet.";
      historyEl.appendChild(emptyState);
      return;
    }

    safeRecords.forEach((record) => {
      historyEl.appendChild(createRecordElement(record, canDelete));
    });
  } catch (error) {
    if (requestId !== recordsLoadRequestId) {
      return;
    }

    historyEl.replaceChildren();
    const errorState = document.createElement("p");
    errorState.className = "empty";
    errorState.textContent = "Unable to load posts.";
    historyEl.appendChild(errorState);
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

  const validNewFiles = newFiles.filter((file) =>
    ALLOWED_TEMP_IMAGE_MIME_TYPES.has((file.type || "").toLowerCase())
  );
  const invalidNewFiles = newFiles.filter(
    (file) => !ALLOWED_TEMP_IMAGE_MIME_TYPES.has((file.type || "").toLowerCase())
  );

  const existingKeys = new Set(
    pendingTempImageFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`)
  );

  validNewFiles.forEach((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!existingKeys.has(key)) {
      pendingTempImageFiles.push(file);
      existingKeys.add(key);
    }
  });

  if (invalidNewFiles.length > 0) {
    setTempUploadStatus(
      `Ignored unsupported image file(s): ${invalidNewFiles.map((file) => file.name).join(", ")}. Allowed: jpeg, png, webp.`,
      true
    );
    return;
  }

  setTempUploadStatus(
    `${pendingTempImageFiles.length} image file(s) selected. Click "Upload Temp Images" to create temp uploads.`
  );
});

uploadTempImagesButton?.addEventListener("click", async () => {
  if (pendingTempImageFiles.length === 0) {
    setTempUploadStatus("Select one or more images first.", true);
    return;
  }

  try {
    setTempUploadStatus(`Uploading ${pendingTempImageFiles.length} temp image(s)...`);

    const startSortOrder = tempUploads.length;
    const uploadedItems: TempUploadItem[] = [];

    for (const [index, file] of pendingTempImageFiles.entries()) {
      const { data, error } = await createTempUpload(file, startSortOrder + index);
      if (error) {
        setTempUploadStatus(`Temp upload failed: ${error.message}`, true);
        return;
      }

      if (data) {
        uploadedItems.push({
          ...data,
          file_name: file.name,
          local_preview_url: URL.createObjectURL(file),
        });
      }
    }

    tempUploads = [...tempUploads, ...uploadedItems];
    pendingTempImageFiles = [];
    if (createImagesInput) {
      createImagesInput.value = "";
    }
    renderTempUploadPreviews();
    setTempUploadStatus(`Uploaded ${uploadedItems.length} temp image(s).`);
  } catch (error) {
    setTempUploadStatus(`Temp upload failed: ${formatError(error)}`, true);
  }
});

applyFiltersButton?.addEventListener("click", async () => {
  appliedFilters = collectFiltersFromInputs();
  updateFilterIndicator();
  await refreshHistory();
});

resetFiltersButton?.addEventListener("click", async () => {
  clearFilterInputs();
  appliedFilters = {};
  updateFilterIndicator();
  await refreshHistory();
});

createForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const cleanTitle = createTitleInput?.value.trim() || "";
  const cleanBody = createBodyInput?.value.trim() || "";
  const postType = createPostTypeInput?.value.trim() || "";
  const teamSize = parseOptionalInteger(createTeamSizeInput?.value);
  const projectDuration = createProjectDurationInput?.value.trim() || "";
  const recruitmentDeadline = createRecruitmentDeadlineInput?.value.trim() || "";
  const workStyle = createWorkStyleInput?.value.trim() || "";
  const contactEmail = createContactEmailInput?.value.trim() || "";
  const commitmentLevel = createCommitmentLevelInput?.value.trim() || "";
  const { positionCounts, error: positionCountsError } = parsePositionCounts(
    createPositionCountsInput?.value
  );

  if (!cleanTitle || !cleanBody) {
    setStatus("Title and body are required.", true);
    return;
  }

  if (!postType || teamSize === undefined || !projectDuration || !recruitmentDeadline || !workStyle) {
    setStatus("Post type, team size, project duration, recruitment deadline, and work style are required.", true);
    return;
  }

  if (!contactEmail || !commitmentLevel) {
    setStatus("Contact email and commitment level are required.", true);
    return;
  }

  if (!positionCounts || positionCountsError) {
    setStatus(positionCountsError || "Position counts are required.", true);
    return;
  }

  try {
    const payload: CreatePostPayload = {
      title: cleanTitle,
      body: cleanBody,
      post_type: postType,
      team_size: teamSize,
      project_duration: projectDuration,
      recruitment_deadline: recruitmentDeadline,
      work_style: workStyle,
      location_state: createLocationStateInput?.value.trim() || null,
      location_city: createLocationCityInput?.value.trim() || null,
      contact_email: contactEmail,
      contact_discord: createContactDiscordInput?.value.trim() || null,
      contact_slack: createContactSlackInput?.value.trim() || null,
      commitment_level: commitmentLevel,
      position_counts: positionCounts,
      tech_stacks: parseCsvValues(createTechStacksInput?.value),
      temp_upload_ids: tempUploads.map((upload) => upload.upload_id),
    };

    const { error: createError } = await createRecord(payload);
    if (createError) {
      setStatus(`Create failed: ${createError.message}`, true);
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

async function logSessionForTesting(): Promise<void> {
  try {
    const session = await getSession();
    const accessToken = session?.access_token;
    if (accessToken === lastLoggedSessionToken) {
      return;
    }
    lastLoggedSessionToken = accessToken;
    console.log("SUPBASE TOKEN:\n" + accessToken + "\n", null);
  } catch (error) {
    if (lastLoggedSessionToken === undefined) {
      return;
    }
    lastLoggedSessionToken = undefined;
    console.log("SUPBASE TOKEN:\nundefined\n", error);
  }
}

onAuthStateChange(async () => {
  await logSessionForTesting();
  await checkLogin();
  await refreshHistory();
});

async function bootstrap(): Promise<void> {
  updateFilterIndicator();
  renderTempUploadPreviews();
  await refreshHistory();
  void logSessionForTesting();
  await checkLogin();
  await refreshHistory();
}

void bootstrap();

if (googleSignInIcon) googleSignInIcon.src = googleLogo;
if (githubSignInIcon) githubSignInIcon.src = githubLogo;
if (logoutButton) logoutButton.style.display = "none";
