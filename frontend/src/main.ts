import {
  getSession,
  signInWithGithub,
  signOut,
  getRecords,
  createRecord,
  deleteRecord,
} from "../../backend/supabase.js";

async function checkLogin() {
  const session = await getSession();
  (document.querySelector("#login") as HTMLElement)!.style.display = session ? "none" : "inline";
  (document.querySelector("#logout") as HTMLElement)!.style.display = session ? "inline" : "none";
}

async function refreshHistory() {
  const session = await getSession();
  const { data: records } = await getRecords();
  const canDelete = session !== null;

  const html = (records || []).map((record) => `
    <div style="margin:20px 0">
      <h2>${record.title}</h2>
      ${record.body}
      ${canDelete ? `<input type="button" value="delete" data-id="${record.id}" class="delete-btn" />` : ""}
    </div>
  `).join("");

  const historyEl = document.querySelector("#history");
  if (historyEl) {
    historyEl.innerHTML = html;
  }

  // Attach delete listeners after rendering (safer than inline onclick)
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteRecord((btn as HTMLElement).dataset.id);
      refreshHistory();
    });
  });
}

document.querySelector("#login")?.addEventListener("click", signInWithGithub);

document.querySelector("#logout")?.addEventListener("click", async () => {
  await signOut();
  checkLogin();
  refreshHistory();
});

document.querySelector("#create_btn")?.addEventListener("click", async () => {
  await createRecord(prompt("title?"), prompt("body?"));
  refreshHistory();
});

checkLogin();
refreshHistory();