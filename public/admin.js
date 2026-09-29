const $ = (id) => document.getElementById(id);
let activeBatchId = null;
let uploadMode = "upload";

const platformTypes = {
  instagram: ["carousel", "reel", "post", "story"],
  linkedin: ["post"],
};

const api = (path, opts = {}) =>
  fetch(`/api${path}`, { credentials: "include", cache: "no-store", ...opts });

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function syncAssetTypes() {
  const select = $("assetType");
  select.innerHTML = "";
  for (const t of platformTypes[$("platform").value] ?? []) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    select.appendChild(opt);
  }
}

$("platform").addEventListener("change", syncAssetTypes);
syncAssetTypes();

$("modeSeg").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (!btn) return;
  uploadMode = btn.dataset.mode;
  $("modeSeg").querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  $("uploadFields").hidden = uploadMode !== "upload";
  $("linkFields").hidden = uploadMode !== "link";
});

async function ensureAuth() {
  const res = await api("/auth/me");
  if (res.ok) {
    showApp();
    return true;
  }
  showLogin();
  return false;
}

async function submitLogin() {
  let res;
  try {
    res = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("loginUser").value.trim(),
        password: $("loginPass").value,
      }),
    });
  } catch {
    toast("Cannot reach server — is npm start running on this URL?");
    return;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    toast(data.error ?? "Invalid login");
    return;
  }
  showApp();
  await loadBatches();
}

function showApp() {
  $("loginView").hidden = true;
  $("appView").hidden = false;
  window.scrollTo(0, 0);
}

function showLogin() {
  $("loginView").hidden = false;
  $("appView").hidden = true;
}

$("loginBtn").addEventListener("click", () => void submitLogin());
$("loginPass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitLogin();
});
$("loginUser").addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitLogin();
});

$("logoutBtn").addEventListener("click", async () => {
  await api("/auth/logout", { method: "POST" });
  await ensureAuth();
});

async function loadBatches() {
  const res = await api("/batches");
  if (res.status === 401) {
    await ensureAuth();
    return;
  }
  if (!res.ok) {
    toast("Could not load batches");
    return;
  }
  const data = await res.json();
  const root = $("batchList");
  if (!data.batches?.length) {
    root.textContent = "No batches yet.";
    return;
  }
  root.innerHTML = data.batches
    .map(
      (b) => `<div class="asset-item">
        <div>
          <strong>${b.name}</strong>
          <span class="pill ${b.status}">${b.status}</span><br/>
          <small>${b.platform} · ${b.assetType} · ${b.assetCount} assets · ${b.reviewerCount} reviewers</small>
        </div>
        <button class="btn secondary" data-open="${b.id}" type="button">Open</button>
      </div>`,
    )
    .join("");
  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openBatch(btn.dataset.open));
  });
}

function syncBatchPanelVisibility() {
  const open = Boolean(activeBatchId);
  $("batchPanel").hidden = !open;
  $("batchEmpty").hidden = open;
}

async function openBatch(id) {
  activeBatchId = id;
  const res = await api(`/batches/${id}`);
  const data = await res.json();
  syncBatchPanelVisibility();
  $("batchTitle").textContent = data.batch.name;
  const st = $("batchStatus");
  st.textContent = data.batch.status;
  st.className = `pill ${data.batch.status}`;
  $("reviewLink").textContent = data.batch.reviewUrl;

  $("assetList").innerHTML = data.assets
    .map(
      (a) => `<div class="asset-item">
        <div><strong>${a.index}. ${a.title}</strong><br/><small>${a.slides.length} preview(s)</small></div>
        <button class="btn danger" data-del-asset="${a.id}" type="button">Remove</button>
      </div>`,
    )
    .join("");

  $("assetList").querySelectorAll("[data-del-asset]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this asset?")) return;
      await api(`/batches/${activeBatchId}/assets/${btn.dataset.delAsset}`, {
        method: "DELETE",
      });
      toast("Asset removed");
      openBatch(activeBatchId);
      loadBatches();
    });
  });

  const reviewers = data.batch.reviewers ?? [];
  $("reviewerList").textContent = reviewers.length
    ? `Reviewers: ${reviewers.join(", ")}`
    : "No reviews yet.";

  $("assetTitle").value = "";
  $("linkUrl").value = "";
  $("files").value = "";
}

$("createBatch").addEventListener("click", async () => {
  const res = await api("/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: $("name").value,
      platform: $("platform").value,
      assetType: $("assetType").value,
      channelId: $("channelId").value.trim(),
    }),
  });
  const data = await res.json();
  if (!res.ok) return toast(data.error ?? "Create failed");
  toast("Batch created");
  await loadBatches();
  await openBatch(data.batch.id);
});

$("addAsset").addEventListener("click", async () => {
  if (!activeBatchId) return;
  const fd = new FormData();
  fd.append("mode", uploadMode);
  fd.append("title", $("assetTitle").value);
  if (uploadMode === "link") {
    fd.append("linkUrl", $("linkUrl").value);
  } else {
    for (const f of $("files").files) fd.append("files", f);
  }
  const res = await api(`/batches/${activeBatchId}/assets`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) return toast(data.error ?? "Add failed");
  toast("Asset added");
  await openBatch(activeBatchId);
  await loadBatches();
});

$("notifySlack").addEventListener("click", async () => {
  const res = await api(`/batches/${activeBatchId}/notify-slack`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) return toast(data.error ?? "Notify failed");
  toast("Slack notified");
  openBatch(activeBatchId);
});

$("summarySlack").addEventListener("click", async () => {
  const res = await api(`/batches/${activeBatchId}/summary-slack`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) return toast(data.error ?? "Summary failed");
  toast("Summary posted");
});

$("deleteBatch").addEventListener("click", async () => {
  if (!confirm("Delete this entire batch?")) return;
  await api(`/batches/${activeBatchId}`, { method: "DELETE" });
  activeBatchId = null;
  syncBatchPanelVisibility();
  toast("Batch deleted");
  loadBatches();
});

(async () => {
  syncBatchPanelVisibility();
  if (await ensureAuth()) await loadBatches();
})();
