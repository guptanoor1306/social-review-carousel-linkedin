import {
  getRichEditorHtml,
  mountRichEditor,
  richEditorPlainText,
  setRichEditorHtml,
} from "./rich-text.js";

const $ = (id) => document.getElementById(id);
let activeBatchId = null;

const platformTypes = {
  instagram: ["carousel", "reel", "post", "story"],
  linkedin: ["post"],
};

const api = (path, opts = {}) =>
  fetch(`/api${path}`, { credentials: "include", cache: "no-store", ...opts });

function toast(msg, kind = "info") {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("toast-error", "toast-success");
  if (kind === "error") el.classList.add("toast-error");
  if (kind === "success") el.classList.add("toast-success");
  el.classList.add("show");
  setTimeout(() => {
    el.classList.remove("show", "toast-error", "toast-success");
  }, 3200);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isVideoUrl(url) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url ?? "");
}

function renderSlideThumbs(slides) {
  const list = (slides ?? []).filter((s) => s?.url && !s.embed);
  if (!list.length) return "";
  const items = list
    .map((s) => {
      if (isVideoUrl(s.url)) {
        return `<div class="asset-thumb--video"><video src="${escapeHtml(s.url)}" muted playsinline preload="metadata"></video></div>`;
      }
      return `<img src="${escapeHtml(s.url)}" alt="" loading="lazy" />`;
    })
    .join("");
  return `<div class="carousel carousel-compact">${items}</div>`;
}

function renderUploadCompose() {
  const root = $("uploadCompose");
  const files = $("files").files;
  const saved = collectSlideCaptions();
  root.innerHTML = "";
  if (!files?.length) {
    root.hidden = true;
    return;
  }
  root.hidden = false;

  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const row = document.createElement("div");
    row.className = "upload-compose-row";

    const media = document.createElement("div");
    media.className = "upload-compose-media";
    if (f.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.src = URL.createObjectURL(f);
      v.muted = true;
      v.playsInline = true;
      v.controls = true;
      media.appendChild(v);
    } else if (f.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.alt = f.name;
      media.appendChild(img);
    } else {
      media.textContent = f.name;
    }

    const body = document.createElement("div");
    body.className = "upload-compose-body";
    const lab = document.createElement("label");
    lab.textContent = `Slide ${i + 1}`;
    const sub = document.createElement("p");
    sub.className = "sub upload-compose-filename";
    sub.textContent = f.name;
    const input = document.createElement("textarea");
    input.className = "slide-caption-input";
    input.rows = 4;
    input.placeholder = "Caption for this slide (optional)";
    input.value = saved[i] ?? "";
    body.append(lab, sub, input);

    row.append(media, body);
    root.appendChild(row);
  }
}

function collectSlideCaptions() {
  return [...document.querySelectorAll(".slide-caption-input")].map((el) => el.value);
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
      (b) => `<button type="button" class="batch-list-row" data-open="${b.id}">
        <span class="batch-list-main">
          <strong>${escapeHtml(b.name)}</strong>
          <span class="pill ${b.status}">${b.status}</span>
          <small>${b.platform} · ${b.assetType} · ${b.assetCount} assets · ${b.reviewerCount} reviewers</small>
        </span>
        <span class="batch-list-chevron" aria-hidden="true">→</span>
      </button>`,
    )
    .join("");
  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openBatch(btn.dataset.open));
  });
}

function showAdminHome() {
  activeBatchId = null;
  $("adminHome").hidden = false;
  $("batchPanel").hidden = true;
}

function showBatchDetail() {
  $("adminHome").hidden = true;
  $("batchPanel").hidden = false;
  window.scrollTo(0, 0);
}

async function openBatch(id) {
  activeBatchId = id;
  const res = await api(`/batches/${id}`);
  const data = await res.json();
  showBatchDetail();
  $("batchTitle").textContent = data.batch.name;
  const st = $("batchStatus");
  st.textContent = data.batch.status;
  st.className = `pill ${data.batch.status}`;
  $("reviewLink").value = data.batch.reviewUrl ?? "";

  $("assetList").innerHTML = data.assets
    .map((a) => {
      const slideCaps = (a.slides ?? [])
        .map((s, i) => (s.caption ? `<li><small>Slide ${i + 1}: ${escapeHtml(s.caption)}</small></li>` : ""))
        .filter(Boolean)
        .join("");
      return `<div class="asset-item">
        <div class="asset-item-body">
          ${renderSlideThumbs(a.slides)}
          <div class="asset-item-title rich-html">${a.index}. ${a.title}</div>
          <small>${a.slides.length} preview(s)</small>
          ${slideCaps ? `<ul class="asset-slide-caps">${slideCaps}</ul>` : ""}
        </div>
        <button class="btn btn-sm danger" data-del-asset="${a.id}" type="button">Remove</button>
      </div>`;
    })
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

  setRichEditorHtml($("assetTitleEditor"), "");
  $("files").value = "";
  renderUploadCompose();
}

$("files").addEventListener("change", renderUploadCompose);
mountRichEditor($("assetTitleToolbar"), $("assetTitleEditor"));

$("createBatch").addEventListener("click", async () => {
  const channelId = $("channelId").value.trim();
  if (!channelId) {
    toast("Add a Slack channel ID before creating a batch", "error");
    $("channelId").focus();
    return;
  }
  const res = await api("/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: $("name").value,
      platform: $("platform").value,
      assetType: $("assetType").value,
      channelId,
    }),
  });
  const data = await res.json();
  if (!res.ok) return toast(data.error ?? "Create failed", "error");
  toast("Batch created", "success");
  await loadBatches();
  await openBatch(data.batch.id);
});

$("addAsset").addEventListener("click", async () => {
  if (!activeBatchId) return;
  const fd = new FormData();
  fd.append("mode", "upload");
  const titleHtml = getRichEditorHtml($("assetTitleEditor"));
  const titlePlain = richEditorPlainText(titleHtml);
  if (!titlePlain && !$("files").files?.length) {
    toast("Add files or a caption", "error");
    return;
  }
  fd.append("title", titleHtml || titlePlain);
  for (const f of $("files").files) fd.append("files", f);
  fd.append("slideCaptions", JSON.stringify(collectSlideCaptions()));
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
  showAdminHome();
  toast("Batch deleted");
  loadBatches();
});

$("backToBatches").addEventListener("click", () => {
  showAdminHome();
  loadBatches();
});

$("reviewLinkOpen").addEventListener("click", () => {
  const url = $("reviewLink").value;
  if (!url) return toast("No review link yet", "error");
  window.open(url, "_blank", "noopener,noreferrer");
});

$("reviewLinkCopy").addEventListener("click", async () => {
  const url = $("reviewLink").value;
  if (!url) return toast("No review link yet", "error");
  try {
    await navigator.clipboard.writeText(url);
    toast("Review link copied", "success");
  } catch {
    toast("Could not copy — use Open link", "error");
  }
});

(async () => {
  showAdminHome();
  if (await ensureAuth()) await loadBatches();
})();
