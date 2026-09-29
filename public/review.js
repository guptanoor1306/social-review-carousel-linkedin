import {
  buildImmersivePayload,
  mountLightbox,
  PLATFORM_LOGO,
  renderPlatformPreview,
  supportsPlatformPreview,
} from "./platform-preview.js";

const $ = (id) => document.getElementById(id);

const batchId = location.pathname.split("/").pop();
const token = new URLSearchParams(location.search).get("token") ?? "";

const reviewFormBlock = $("reviewFormBlock");
const lightbox = mountLightbox({
  reviewSlot: { el: reviewFormBlock, home: $("assetCard") },
  onClose: () => {
    $("reviewFlow").hidden = false;
  },
});

let state = { assets: [], index: 0, rating: 0, batch: null, started: false };

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function reviewerName() {
  return ($("reviewerName").value || localStorage.getItem("reviewerName") || "").trim();
}

function saveName() {
  const n = reviewerName();
  if (n.length >= 2) localStorage.setItem("reviewerName", n);
}

function renderStars() {
  const root = $("stars");
  root.innerHTML = "";
  for (let n = 1; n <= 5; n += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `star${state.rating === n ? " active" : ""}`;
    btn.textContent = `${n} ★`;
    btn.addEventListener("click", () => {
      state.rating = n;
      renderStars();
      $("saveNext").disabled = false;
    });
    root.appendChild(btn);
  }
}

function updatePlatformRow(batch) {
  const row = $("previewPlatformRow");
  if (!batch || !supportsPlatformPreview(batch.platform, batch.assetType)) {
    row.hidden = true;
    return;
  }
  const p = batch.platform === "instagram" ? "Instagram" : "LinkedIn";
  const t = batch.assetType.charAt(0).toUpperCase() + batch.assetType.slice(1);
  row.hidden = false;
  $("previewPlatformLogo").src = PLATFORM_LOGO[batch.platform];
  $("previewPlatformLogo").alt = p;
  $("previewPlatformMeta").textContent = `${p} · ${t} · Zero1 by Zerodha`;
}

function updateProgress(i) {
  const asset = state.assets[i];
  const total = state.assets.length;
  $("assetCounter").textContent = `${i + 1}/${total}`;
  $("formBatchMeta").textContent = state.batch.name;
  const pct = total ? ((i + 1) / total) * 100 : 0;
  $("barFill").style.width = `${pct}%`;
  $("saveNext").textContent =
    i < total - 1 ? "Save & next" : "Save & finish";
}

function showAsset(i) {
  const asset = state.assets[i];
  if (!asset) return;
  state.index = i;
  state.rating = 0;
  $("feedback").value = "";
  $("assetCard").hidden = false;
  $("doneCard").hidden = true;
  $("assetTitle").textContent = `${asset.index}/${state.assets.length} · ${asset.title}`;
  updatePlatformRow(state.batch);

  const linkParts = [];
  if (asset.postUrl) {
    linkParts.push(
      `<a href="${asset.postUrl}" target="_blank" rel="noopener">Open draft / link</a>`,
    );
  }
  if (state.batch.platform === "linkedin") {
    linkParts.push(
      `<a href="https://www.linkedin.com/company/zerodha/" target="_blank" rel="noopener">Zero1 on LinkedIn</a>`,
    );
  } else {
    linkParts.push(
      `<a href="https://www.instagram.com/zero1byzerodha/" target="_blank" rel="noopener">@zero1byzerodha</a>`,
    );
  }
  $("assetLink").innerHTML = linkParts.join(" · ");

  const previewOpts = {
    platform: state.batch.platform,
    assetType: state.batch.assetType,
    slides: asset.slides ?? [],
    title: asset.title,
    postUrl: asset.postUrl,
  };
  const openPreview = (payload) => {
    if (!payload) return;
    $("reviewFlow").hidden = true;
    lightbox.open(payload);
  };
  renderPlatformPreview($("previewMount"), previewOpts, openPreview);

  const immersivePayload = buildImmersivePayload(previewOpts) ?? null;
  if (immersivePayload) {
    requestAnimationFrame(() => openPreview(immersivePayload));
  } else {
    $("reviewFlow").hidden = false;
  }

  updateProgress(i);
  $("saveNext").disabled = true;
  renderStars();
}

function beginReview(startIndex = 0) {
  state.started = true;
  $("welcomeCard").hidden = true;
  $("reviewFlow").hidden = false;
  showAsset(startIndex);
}

async function loadBatch() {
  const q = new URLSearchParams({ token });
  if (reviewerName()) q.set("reviewer", reviewerName());
  const res = await fetch(`/api/review/${batchId}?${q}`);
  const data = await res.json();
  if (!res.ok) {
    toast(data.error ?? "Invalid link");
    return false;
  }

  state.batch = data.batch;
  state.assets = data.assets ?? [];
  const meta = `${data.batch.name} · ${data.batch.platform} · ${data.batch.assetType} · ${state.assets.length} asset(s)`;
  $("welcomeMeta").textContent = meta;

  if (!state.assets.length) {
    toast("No assets in this review");
    return false;
  }

  state._startIndex = 0;
  if (data.progress?.rated > 0 && data.progress.rated < data.progress.total) {
    state._startIndex = Math.min(data.progress.rated, state.assets.length - 1);
  }
  return true;
}

async function load() {
  const saved = localStorage.getItem("reviewerName");
  if (saved) $("reviewerName").value = saved;

  const ok = await loadBatch();
  if (!ok) return;

  if (reviewerName().length >= 2 && sessionStorage.getItem(`reviewStarted:${batchId}`)) {
    beginReview(state._startIndex);
  }
}

$("startReview").addEventListener("click", () => {
  saveName();
  const name = reviewerName();
  if (name.length < 2) {
    toast("Enter your name to start");
    $("reviewerName").focus();
    return;
  }
  sessionStorage.setItem(`reviewStarted:${batchId}`, "1");
  beginReview(state._startIndex);
});

$("reviewerName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("startReview").click();
});

$("saveNext").addEventListener("click", async () => {
  saveName();
  const name = reviewerName();
  if (name.length < 2) {
    toast("Enter your name on the welcome screen");
    lightbox.close();
    $("welcomeCard").hidden = false;
    $("reviewFlow").hidden = true;
    return;
  }
  if (!state.rating) {
    toast("Pick a rating 1–5");
    return;
  }

  const asset = state.assets[state.index];
  const res = await fetch(`/api/review/${batchId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      reviewerName: name,
      assetId: asset.id,
      rating: state.rating,
      feedback: $("feedback").value,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    toast(data.error ?? "Save failed");
    return;
  }

  if (state.index < state.assets.length - 1) {
    toast("Saved");
    showAsset(state.index + 1);
    return;
  }

  lightbox.close();
  $("assetCard").hidden = true;
  $("reviewFlow").hidden = false;
  $("doneCard").hidden = false;
  $("saveNext").disabled = true;
  $("doneText").textContent = `You rated all ${state.assets.length} assets. The team can post a Slack summary when everyone is done.`;
  $("barFill").style.width = "100%";
});

load();
