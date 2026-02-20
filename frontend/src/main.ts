import "./app.css";
import githubLogo from "./assets/github-logo.svg";
import {
  getSession,
  signInWithGithub,
  signOut,
  getRecords,
  createRecord,
  deleteRecord,
} from "../../backend/supabase.js";

type PageRecord = {
  id: string | number;
  title: string | null;
  body: string | null;
};

const loginButton = document.querySelector<HTMLButtonElement>("#login");
const loginIcon = document.querySelector<HTMLImageElement>("#login-icon");
const logoutButton = document.querySelector<HTMLInputElement>("#logout");
const createButton = document.querySelector<HTMLInputElement>("#create_btn");
const historyEl = document.querySelector<HTMLDivElement>("#history");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");

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

async function checkLogin(): Promise<void> {
  try {
    const session = await getSession();
    if (loginButton) loginButton.style.display = session ? "none" : "inline-flex";
    if (logoutButton) logoutButton.style.display = session ? "inline-block" : "none";
  } catch (error) {
    setStatus(`Unable to check session: ${formatError(error)}`, true);
  }
}

function createRecordElement(record: PageRecord, canDelete: boolean): HTMLElement {
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
        const { error } = await deleteRecord(String(record.id));
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

    const safeRecords = (records || []) as PageRecord[];
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

loginButton?.addEventListener("click", async () => {
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

createButton?.addEventListener("click", async () => {
  const title = prompt("title?");
  if (title === null) {
    setStatus("Create cancelled.");
    return;
  }

  const body = prompt("body?");
  if (body === null) {
    setStatus("Create cancelled.");
    return;
  }

  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle || !cleanBody) {
    setStatus("Title and body are required.", true);
    return;
  }

  try {
    const { error } = await createRecord(cleanTitle, cleanBody);
    if (error) {
      setStatus(`Create failed: ${error.message}`, true);
      return;
    }
    setStatus("Record created.");
    await refreshHistory();
  } catch (error) {
    setStatus(`Create failed: ${formatError(error)}`, true);
  }
});

void checkLogin();
void refreshHistory();

if (loginIcon) {
  loginIcon.src = githubLogo;
}
