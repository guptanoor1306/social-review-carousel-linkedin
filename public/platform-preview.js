/** Platform previews — Instagram / LinkedIn native-style shells (Zero1 by Zerodha). */

export const ZERO1_LOGO = "/assets/zero1-logo.png";
export const PLATFORM_LOGO = {
  instagram: "/assets/platform-instagram.svg",
  linkedin: "/assets/platform-linkedin.svg",
};
export const ZERO1_PROFILE_URL = "https://www.instagram.com/zero1byzerodha/";
export const ZERO1_LINKEDIN_URL = "https://www.linkedin.com/company/zerodha/";

export const ZERO1 = {
  instagram: {
    handle: "zero1byzerodha",
    name: "Zero1 by Zerodha",
  },
  linkedin: {
    handle: "zero1byzerodha",
    name: "Zero1 by Zerodha",
    headline: "Financial education · Zerodha",
  },
};

const IG_EMBED_SCRIPT = "https://www.instagram.com/embed.js";
let igEmbedLoading = null;

export function isMobileReview() {
  return window.matchMedia("(max-width: 840px)").matches;
}

export function isDesktopReview() {
  return window.matchMedia("(min-width: 841px)").matches;
}

function appendLinkedInGridCell(grid, slide, index, extraCount, onSelect) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "li-grid-cell";
  if (index === 0) cell.classList.add("li-grid-cell--hero");
  if (extraCount > 0) cell.classList.add("li-grid-cell--more");

  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(slide.url);
  if (isVideo) {
    const v = document.createElement("video");
    v.src = slide.url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    cell.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = slide.url;
    img.alt = slide.label ?? `Image ${index + 1}`;
    img.loading = "lazy";
    cell.appendChild(img);
  }

  if (extraCount > 0) {
    const overlay = document.createElement("span");
    overlay.className = "li-grid-more";
    overlay.textContent = `+${extraCount}`;
    cell.appendChild(overlay);
  }

  cell.title = "Click to view full image";
  cell.addEventListener("click", () => onSelect?.(index));
  grid.appendChild(cell);
}

function renderLinkedInFocusCarousel(container, slides, startIndex) {
  container.innerHTML = "";
  const list = slideList(slides);
  if (!list.length) return null;

  const toolbar = document.createElement("div");
  toolbar.className = "li-focus-toolbar";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "li-focus-back";
  backBtn.textContent = "← Overview";
  toolbar.appendChild(backBtn);

  const track = document.createElement("div");
  track.className = "carousel lightbox-media-carousel li-focus-carousel";
  list.forEach((slide) => appendSlideMedia(track, slide, null, false));

  container.appendChild(toolbar);
  container.appendChild(track);

  const idx = Math.min(Math.max(startIndex, 0), list.length - 1);
  const align = () => scrollCarouselToIndex(track, idx);
  requestAnimationFrame(align);
  track.querySelectorAll("img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener("load", align, { once: true });
  });
  setTimeout(align, 80);

  return { track, backBtn };
}

/** LinkedIn desktop feed-style multi-image grid (caption should sit above this). */
export function buildLinkedInMediaGrid(slides, onSelect) {
  const list = slideList(slides);
  const grid = document.createElement("div");
  grid.className = "li-grid";
  if (!list.length) return grid;

  if (list.length === 1) {
    grid.classList.add("li-grid--1");
    appendLinkedInGridCell(grid, list[0], 0, 0, onSelect);
    return grid;
  }
  if (list.length === 2) {
    grid.classList.add("li-grid--2");
    appendLinkedInGridCell(grid, list[0], 0, 0, onSelect);
    appendLinkedInGridCell(grid, list[1], 1, 0, onSelect);
    return grid;
  }

  if (list.length === 3) {
    grid.classList.add("li-grid--3");
    appendLinkedInGridCell(grid, list[0], 0, 0, onSelect);
    appendLinkedInGridCell(grid, list[1], 1, 0, onSelect);
    appendLinkedInGridCell(grid, list[2], 2, 0, onSelect);
    return grid;
  }

  grid.classList.add("li-grid--multi");
  appendLinkedInGridCell(grid, list[0], 0, 0, onSelect);
  appendLinkedInGridCell(grid, list[1], 1, 0, onSelect);
  appendLinkedInGridCell(grid, list[2], 2, 0, onSelect);
  const fourth = list[3];
  const extra = list.length > 4 ? list.length - 4 : 0;
  appendLinkedInGridCell(grid, fourth, 3, extra, onSelect);
  return grid;
}

function renderLinkedInFeedPreview(mount, list, title, openFullscreen, payload) {
  const wrap = document.createElement("div");
  wrap.className = "li-feed-preview";

  const head = document.createElement("div");
  head.className = "li-feed-head";
  head.innerHTML = `
    ${logoAvatarHtml("li-feed-avatar")}
    <div class="li-feed-head-text">
      <strong>${ZERO1.linkedin.name}</strong>
      <span>${ZERO1.linkedin.headline}</span>
    </div>
  `;
  wrap.appendChild(head);

  const caption = document.createElement("div");
  caption.className = "li-feed-caption";
  caption.textContent = title || ZERO1.linkedin.name;
  wrap.appendChild(caption);

  const grid = buildLinkedInMediaGrid(list, (index) =>
    openPreviewFromStrip(openFullscreen, payload, list, index, title, {
      linkedinFocus: true,
    }),
  );
  wrap.appendChild(grid);

  if (payload) {
    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "preview-strip-cta li-feed-cta";
    cta.textContent = "Open platform preview";
    cta.addEventListener("click", () =>
      openPreviewFromStrip(openFullscreen, payload, list, 0, title),
    );
    wrap.appendChild(cta);
  }

  mount.appendChild(wrap);
}

/** Full-screen media only (no platform chrome / review slot). */
export function toMediaOnlyPayload(payload) {
  if (!payload) return null;
  const slides = (payload.slides ?? []).filter((s) => s?.url && !s.embed);
  if (!slides.length) return null;
  return {
    platform: "fallback",
    slides,
    index: payload.index ?? 0,
    title: payload.title ?? "",
  };
}

export function supportsPlatformPreview(platform, assetType) {
  if (platform === "instagram" && (assetType === "carousel" || assetType === "post")) {
    return true;
  }
  if (platform === "linkedin" && assetType === "post") {
    return true;
  }
  return false;
}

function slideList(slides) {
  return (slides ?? []).filter((s) => s?.url);
}

function normalizeInstagramPermalink(url) {
  if (!url) return null;
  const m = String(url).match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  return `https://www.instagram.com/p/${m[1]}/`;
}

function linkedInEmbedSrc(url) {
  if (!url) return null;
  const s = String(url);
  const urn = s.match(/(urn:li:(?:activity|share|ugcPost):[0-9]+)/);
  if (urn) {
    return `https://www.linkedin.com/embed/feed/update/${encodeURIComponent(urn[1])}`;
  }
  if (/linkedin\.com\/(posts|feed\/update|pulse)/.test(s)) {
    return `https://www.linkedin.com/embed/feed/update?url=${encodeURIComponent(s.split("?")[0])}`;
  }
  return null;
}

/** Payload for immersive (desktop-style) platform preview. */
export function buildImmersivePayload({ platform, assetType, slides, title, postUrl }) {
  const list = slideList(slides);
  if (list.length) {
    return {
      platform: platform === "linkedin" ? "linkedin" : "instagram",
      assetType,
      slides: list,
      index: 0,
      title,
    };
  }

  if (platform === "instagram") {
    const permalink = normalizeInstagramPermalink(postUrl);
    if (permalink) {
      return {
        platform: "instagram",
        assetType,
        slides: [{ url: permalink, embed: "instagram" }],
        index: 0,
        title,
      };
    }
  }

  if (platform === "linkedin") {
    const embedSrc = linkedInEmbedSrc(postUrl);
    if (embedSrc) {
      return {
        platform: "linkedin",
        assetType,
        slides: [{ url: embedSrc, embed: "linkedin" }],
        index: 0,
        title,
      };
    }
    if (postUrl) {
      return {
        platform: "linkedin",
        assetType,
        slides: [{ url: postUrl, embed: "linkedin-link" }],
        index: 0,
        title,
      };
    }
  }

  return null;
}

function logoAvatarHtml(className = "ig-avatar-img") {
  return `<img class="${className} zero1-logo-img" src="${ZERO1_LOGO}" alt="Zero1 by Zerodha" width="40" height="40" />`;
}

function verifiedBadge() {
  return `<span class="ig-verified" aria-label="Verified">✓</span>`;
}

function platformLabel(platform) {
  return platform === "linkedin" ? "LinkedIn" : "Instagram";
}

function openPreviewFromStrip(openFullscreen, payload, list, index, title, opts = {}) {
  if (isMobileReview()) {
    const media = toMediaOnlyPayload({ ...payload, slides: list, index, title });
    if (media) {
      media.index = index;
      openFullscreen(media);
    }
    return;
  }
  if (payload && payload.platform !== "fallback") {
    openFullscreen({
      ...payload,
      slides: list,
      index,
      title,
      linkedinFocus: Boolean(opts.linkedinFocus),
    });
    return;
  }
  openFullscreen({
    platform: "fallback",
    slides: list,
    index,
    title: title ?? "",
  });
}

function renderHorizontalSlideStrip(mount, list, openFullscreen, payload, title) {
  const wrap = document.createElement("div");
  wrap.className = "preview-strip-wrap";
  const strip = document.createElement("div");
  strip.className = "carousel preview-carousel";
  list.forEach((slide, i) => {
    appendSlideMedia(
      strip,
      slide,
      () => openPreviewFromStrip(openFullscreen, payload, list, i, title),
      true,
    );
  });
  wrap.appendChild(strip);
  lockCarouselAtStart(strip);

  if (payload?.platform && payload.platform !== "fallback") {
    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "preview-strip-cta";
    cta.textContent = isMobileReview() ? "View full screen" : "Open platform preview";
    cta.addEventListener("click", () => openPreviewFromStrip(openFullscreen, payload, list, 0, title));
    wrap.appendChild(cta);
    const note = document.createElement("p");
    note.className = "sub preview-minimized-note";
    note.textContent = `${ZERO1.instagram.name} · swipe slides · rate below`;
    wrap.appendChild(note);
  }

  mount.appendChild(wrap);
}

export function renderPlatformPreview(mount, opts, openFullscreen) {
  const { platform, assetType, slides, title, postUrl } = opts;
  mount.innerHTML = "";
  mount.className = "preview-mount";

  const payload = buildImmersivePayload(opts);
  const list = slideList(slides);

  if (!supportsPlatformPreview(platform, assetType)) {
    if (list.length) {
      renderHorizontalSlideStrip(mount, list, openFullscreen, null, title);
    }
    return list.length
      ? { platform: "fallback", slides: list, index: 0, title: title ?? "" }
      : null;
  }

  if (list.length) {
    if (platform === "linkedin" && isDesktopReview()) {
      renderLinkedInFeedPreview(mount, list, title, openFullscreen, payload);
    } else {
      renderHorizontalSlideStrip(mount, list, openFullscreen, payload, title);
    }
    return payload;
  }

  const formatLabel = assetType.charAt(0).toUpperCase() + assetType.slice(1);
  const hint = document.createElement("div");
  hint.className = "preview-immersive-hint";
  const ctaLabel = isMobileReview() ? "View full screen" : "Continue in full preview";
  hint.innerHTML = `
    <button type="button" class="preview-minimized-open preview-minimized-open--compact">
      <div class="preview-minimized-thumb preview-minimized-thumb--empty">${formatLabel} link</div>
      <span class="preview-minimized-cta">${ctaLabel}</span>
    </button>
    <p class="sub preview-minimized-note">${ZERO1.instagram.name} · rating &amp; feedback below</p>
  `;
  hint.querySelector(".preview-minimized-open").addEventListener("click", () => {
    if (!payload) return;
    openPreviewFromStrip(openFullscreen, payload, payload.slides ?? [], 0, title);
  });
  mount.appendChild(hint);
  return payload;
}

function bindTapUnlessScroll(el, onTap) {
  let px = 0;
  let py = 0;
  let moved = false;
  el.addEventListener(
    "pointerdown",
    (e) => {
      px = e.clientX;
      py = e.clientY;
      moved = false;
    },
    { passive: true },
  );
  el.addEventListener(
    "pointermove",
    (e) => {
      if (Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 10) moved = true;
    },
    { passive: true },
  );
  el.addEventListener("pointerup", (e) => {
    if (moved) return;
    if (Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 10) return;
    onTap();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTap();
    }
  });
}

function appendSlideMedia(parent, slide, onOpen, zoomable) {
  if (!slide?.url) return;
  const wrap = document.createElement("div");
  wrap.className = zoomable ? "carousel-slide zoom-hit" : "carousel-slide plain-media";
  if (zoomable) {
    wrap.setAttribute("role", "button");
    wrap.tabIndex = 0;
    wrap.setAttribute("aria-label", "Open full screen");
  }

  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(slide.url);
  if (isVideo) {
    const v = document.createElement("video");
    v.src = slide.url;
    v.controls = true;
    v.playsInline = true;
    v.className = "preview-video";
    wrap.appendChild(v);
  } else {
    const img = document.createElement("img");
    img.src = slide.url;
    img.alt = slide.label ?? "Preview";
    img.loading = "lazy";
    img.draggable = false;
    wrap.appendChild(img);
  }

  if (zoomable && onOpen) bindTapUnlessScroll(wrap, onOpen);
  parent.appendChild(wrap);
}

function scrollCarouselToIndex(track, index) {
  if (!track?.children?.length) return;
  const i = Math.min(Math.max(index, 0), track.children.length - 1);
  const el = track.children[i];
  if (i === 0) {
    track.scrollLeft = 0;
    return;
  }
  track.scrollLeft = Math.max(0, el.offsetLeft);
}

function lockCarouselAtStart(track) {
  if (!track) return;
  const snap = () => {
    track.scrollLeft = 0;
  };
  requestAnimationFrame(snap);
  track.querySelectorAll("img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener("load", snap, { once: true });
  });
  setTimeout(snap, 80);
  setTimeout(snap, 250);
}

function renderLightboxScrollCarousel(container, slides, startIndex) {
  container.innerHTML = "";
  const list = slides.filter((s) => s?.url && !s.embed);
  if (!list.length) return false;

  const track = document.createElement("div");
  track.className = "carousel lightbox-media-carousel";
  list.forEach((slide) => appendSlideMedia(track, slide, null, false));
  container.appendChild(track);

  let idx = 0;
  const target = slides[startIndex];
  if (target) {
    const found = list.indexOf(target);
    if (found >= 0) idx = found;
  }
  idx = Math.min(Math.max(idx, 0), list.length - 1);
  const align = () => scrollCarouselToIndex(track, idx);
  requestAnimationFrame(align);
  track.querySelectorAll("img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener("load", align, { once: true });
  });
  setTimeout(align, 80);
  setTimeout(align, 250);
  return true;
}

function loadInstagramEmbedScript() {
  if (window.instgrm) return Promise.resolve();
  if (igEmbedLoading) return igEmbedLoading;
  igEmbedLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = IG_EMBED_SCRIPT;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return igEmbedLoading;
}

function renderMediaStage(stage, slide, platform) {
  stage.innerHTML = "";
  if (!slide) return;

  if (slide.embed === "instagram") {
    const wrap = document.createElement("div");
    wrap.className = "ig-embed-wrap";
    wrap.innerHTML = `<blockquote class="instagram-media" data-instgrm-permalink="${slide.url}" data-instgrm-version="14" data-instgrm-captioned></blockquote>`;
    stage.appendChild(wrap);
    loadInstagramEmbedScript()
      .then(() => window.instgrm?.Embeds?.process())
      .catch(() => {
        wrap.innerHTML = `<a class="embed-fallback" href="${slide.url}" target="_blank" rel="noopener">Open on Instagram</a>`;
      });
    return;
  }

  if (slide.embed === "linkedin" || slide.embed === "linkedin-link") {
    const wrap = document.createElement("div");
    wrap.className = "li-embed-wrap";
    if (slide.embed === "linkedin") {
      const iframe = document.createElement("iframe");
      iframe.src = slide.url;
      iframe.title = "LinkedIn post preview";
      iframe.setAttribute("frameborder", "0");
      iframe.allow = "autoplay; clipboard-write; encrypted-media; picture-in-picture";
      iframe.allowFullscreen = true;
      wrap.appendChild(iframe);
    } else {
      wrap.innerHTML = `<a class="embed-fallback" href="${slide.url}" target="_blank" rel="noopener">Open on LinkedIn</a>`;
    }
    stage.appendChild(wrap);
    return;
  }

  if (!slide.url) return;
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(slide.url);
  if (isVideo) {
    const v = document.createElement("video");
    v.src = slide.url;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    stage.appendChild(v);
    return;
  }
  const img = document.createElement("img");
  img.src = slide.url;
  img.alt = slide.label ?? "Preview";
  img.className = platform === "linkedin" ? "li-modal-media-img" : "ig-modal-media-img";
  stage.appendChild(img);
}

function igActionsHtml() {
  return `
    <div class="ig-modal-actions">
      <span class="ig-action ig-action-heart" aria-hidden="true"></span>
      <span class="ig-action ig-action-comment" aria-hidden="true"></span>
      <span class="ig-action ig-action-share" aria-hidden="true"></span>
      <span class="ig-action ig-action-save" aria-hidden="true"></span>
    </div>
  `;
}

export function mountLightbox({ reviewSlot, onClose } = {}) {
  const el = document.createElement("div");
  el.id = "lightbox";
  el.hidden = true;
  el.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Close">✕</button>
    <div class="lightbox-shell">
      <div class="platform-brand-mark" hidden>
        <img class="platform-brand-mark-logo" src="" alt="" width="32" height="32" />
      </div>
    <div class="lightbox-layout">
    <div class="platform-modal ig-modal">
      <div class="platform-modal-media ig-modal-media">
        <div class="li-modal-caption-top" hidden></div>
        <button type="button" class="ig-modal-nav prev" aria-label="Previous slide">‹</button>
        <div class="ig-modal-stage"></div>
        <button type="button" class="ig-modal-nav next" aria-label="Next slide">›</button>
      </div>
      <aside class="platform-modal-side ig-modal-side">
        <div class="ig-modal-head">
          ${logoAvatarHtml("ig-modal-avatar")}
          <div class="ig-modal-head-text">
            <div class="ig-handle-row">
              <span class="ig-modal-handle"></span>
              ${verifiedBadge()}
            </div>
            <span class="ig-modal-display-name"></span>
          </div>
        </div>
        <div class="ig-modal-scroll">
          <div class="ig-modal-caption"></div>
          ${igActionsHtml()}
          <div class="ig-modal-comment-box" aria-hidden="true">
            <span class="ig-modal-comment-placeholder">Add a comment…</span>
          </div>
          <div class="ig-modal-comments">
            <p class="ig-modal-comments-label">Your review</p>
            <div class="ig-modal-review-slot"></div>
          </div>
        </div>
      </aside>
    </div>
    </div>
    </div>
    <div class="ig-modal-fallback-stage"></div>
  `;
  document.body.appendChild(el);

  const modal = el.querySelector(".platform-modal");
  const fallbackStage = el.querySelector(".ig-modal-fallback-stage");
  const mediaCol = el.querySelector(".ig-modal-media");
  const liCaptionTop = el.querySelector(".li-modal-caption-top");
  const stage = el.querySelector(".ig-modal-stage");
  const captionEl = el.querySelector(".ig-modal-caption");
  const handleEl = el.querySelector(".ig-modal-handle");
  const displayNameEl = el.querySelector(".ig-modal-display-name");
  const slot = el.querySelector(".ig-modal-review-slot");
  const prevBtn = el.querySelector(".ig-modal-nav.prev");
  const nextBtn = el.querySelector(".ig-modal-nav.next");
  const actionsEl = el.querySelector(".ig-modal-actions");
  const commentBoxEl = el.querySelector(".ig-modal-comment-box");
  const brandMark = el.querySelector(".platform-brand-mark");
  const brandMarkLogo = el.querySelector(".platform-brand-mark-logo");
  let ctx = { slides: [], index: 0, platform: "instagram" };
  let liViewMode = "overview";

  function applyPlatformBranding(platform) {
    const pLabel = platformLabel(platform);
    const logoSrc = PLATFORM_LOGO[platform];
    const show = platform === "instagram" || platform === "linkedin";
    brandMark.hidden = !show;
    if (!show) return;
    brandMarkLogo.src = logoSrc;
    brandMarkLogo.alt = pLabel;
  }

  const renderLinkedInDesktopMedia = () => {
    stage.innerHTML = "";
    stage.classList.add("li-modal-stage--grid");
    mediaCol.classList.add("li-modal-media--feed");
    el.classList.add("is-li-desktop");
    liCaptionTop.hidden = false;
    liCaptionTop.textContent = captionEl.textContent;
    captionEl.hidden = true;
    prevBtn.hidden = true;
    nextBtn.hidden = true;

    if (liViewMode === "focus") {
      stage.classList.add("li-modal-stage--focus");
      const focus = renderLinkedInFocusCarousel(stage, ctx.slides, ctx.index);
      focus?.backBtn.addEventListener("click", () => {
        liViewMode = "overview";
        renderLinkedInDesktopMedia();
      });
      return;
    }

    stage.classList.remove("li-modal-stage--focus");
    stage.appendChild(
      buildLinkedInMediaGrid(ctx.slides, (index) => {
        ctx.index = index;
        liViewMode = "focus";
        renderLinkedInDesktopMedia();
      }),
    );
  };

  const syncSlide = () => {
    const slide = ctx.slides[ctx.index];
    const liDesktop =
      ctx.platform === "linkedin" &&
      isDesktopReview() &&
      ctx.slides.length > 0 &&
      !ctx.slides.some((s) => s.embed);

    if (liDesktop) {
      renderLinkedInDesktopMedia();
      return;
    }

    liViewMode = "overview";
    stage.classList.remove("li-modal-stage--grid", "li-modal-stage--focus");
    mediaCol.classList.remove("li-modal-media--feed");
    el.classList.remove("is-li-desktop");
    liCaptionTop.hidden = true;
    captionEl.hidden = false;

    renderMediaStage(stage, slide, ctx.platform);
    const multi = ctx.slides.length > 1 && !slide?.embed;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    prevBtn.disabled = ctx.index <= 0;
    nextBtn.disabled = ctx.index >= ctx.slides.length - 1;
  };

  prevBtn.addEventListener("click", () => {
    if (ctx.index > 0) {
      ctx.index -= 1;
      syncSlide();
    }
  });
  nextBtn.addEventListener("click", () => {
    if (ctx.index < ctx.slides.length - 1) {
      ctx.index += 1;
      syncSlide();
    }
  });

  const close = () => {
    el.hidden = true;
    el.classList.remove("is-linkedin", "is-instagram", "is-fallback", "is-media-only");
    stage.innerHTML = "";
    stage.classList.remove("li-modal-stage--grid", "li-modal-stage--focus");
    mediaCol.classList.remove("li-modal-media--feed");
    el.classList.remove("is-li-desktop");
    liCaptionTop.hidden = true;
    captionEl.hidden = false;
    liViewMode = "overview";
    fallbackStage.innerHTML = "";
    document.body.classList.remove("lightbox-open");
    if (reviewSlot?.el && slot.contains(reviewSlot.el) && reviewSlot.home) {
      reviewSlot.home.appendChild(reviewSlot.el);
    }
    onClose?.();
  };

  el.querySelector(".lightbox-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (el.hidden) return;
    if (e.key === "Escape") {
      if (
        liViewMode === "focus" &&
        ctx.platform === "linkedin" &&
        isDesktopReview()
      ) {
        liViewMode = "overview";
        renderLinkedInDesktopMedia();
        return;
      }
      close();
    }
    if (e.key === "ArrowLeft" && !prevBtn.hidden) prevBtn.click();
    if (e.key === "ArrowRight" && !nextBtn.hidden) nextBtn.click();
  });

  return {
    open(payload) {
      const {
        platform = "instagram",
        assetType = "post",
        slides = [],
        index = 0,
        title = "",
      } = payload;
      ctx = {
        slides: slides.filter((s) => s?.url || s?.embed),
        index,
        platform,
      };
      liViewMode =
        platform === "linkedin" &&
        isDesktopReview() &&
        payload.linkedinFocus
          ? "focus"
          : "overview";
      if (!ctx.slides.length) return;

      const brand = platform === "linkedin" ? ZERO1.linkedin : ZERO1.instagram;
      const formatLabel =
        assetType.charAt(0).toUpperCase() + assetType.slice(1);

      handleEl.textContent = brand.handle;
      displayNameEl.textContent = `${brand.name} · ${formatLabel}`;
      captionEl.textContent = title || brand.name;

      const immersive = platform !== "fallback";
      modal.hidden = !immersive;
      fallbackStage.hidden = immersive;

      el.classList.toggle("is-linkedin", platform === "linkedin");
      el.classList.toggle("is-instagram", platform === "instagram");
      el.classList.toggle("is-fallback", platform === "fallback");
      el.classList.toggle("is-media-only", platform === "fallback");
      applyPlatformBranding(platform);

      const isEmbed = ctx.slides.some((s) => s.embed);
      actionsEl.hidden = platform === "linkedin" || isEmbed;
      commentBoxEl.hidden = platform === "linkedin" || isEmbed;

      if (immersive) {
        syncSlide();
        if (reviewSlot?.el) slot.appendChild(reviewSlot.el);
      } else {
        const scrolled =
          renderLightboxScrollCarousel(fallbackStage, ctx.slides, ctx.index) ||
          false;
        if (!scrolled) {
          renderMediaStage(fallbackStage, ctx.slides[ctx.index], "fallback");
        }
      }

      el.hidden = false;
      document.body.classList.add("lightbox-open");
    },
    close,
  };
}
