const $ = (id) => document.getElementById(id);
let activeBatchId = null;
let uploadMode = "upload";

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

function renderPendingUploadPreview() {
  const root = $("uploadPreview");
  const files = $("files").files;
  root.innerHTML = "";
  if (!files?.length) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  root.appendChild(document.createTextNode("Selected files: "));
  const row = document.createElement("div");
  row.className = "carousel carousel-compact";
  for (const f of files) {
    if (f.type.startsWith("video/")) {
      const wrap = document.createElement("div");
      wrap.className = "asset-thumb--video";
      wrap.title = f.name;
      const v = document.createElement("video");
      v.src = URL.createObjectURL(f);
      v.muted = true;
      v.playsInline = true;
      wrap.appendChild(v);
      row.appendChild(wrap);
    } else if (f.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.alt = f.name;
      img.title = f.name;
      row.appendChild(img);
    } else {
      const wrap = document.createElement("div");
      wrap.className = "asset-thumb--file";
      wrap.title = f.name;
      wrap.textContent = f.name.slice(0, 8);
      row.appendChild(wrap);
    }
  }
  root.appendChild(row);
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
        <div class="asset-item-body">
          ${renderSlideThumbs(a.slides)}
          <div><strong>${a.index}. ${escapeHtml(a.title)}</strong><br/><small>${a.slides.length} preview(s)</small></div>
        </div>
        <button class="btn btn-sm danger" data-del-asset="${a.id}" type="button">Remove</button>
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
  renderPendingUploadPreview();
}

$("files").addEventListener("change", renderPendingUploadPreview);

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
