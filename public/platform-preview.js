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

export function renderPlatformPreview(mount, opts, openFullscreen) {
  const { platform, assetType, slides, title, postUrl } = opts;
  mount.innerHTML = "";
  mount.className = "preview-mount";

  const payload = buildImmersivePayload(opts);

  if (!supportsPlatformPreview(platform, assetType)) {
    renderFallbackStrip(mount, slides, openFullscreen);
    return payload;
  }

  const label = platformLabel(platform);
  const hint = document.createElement("div");
  hint.className = "preview-immersive-hint";
  const thumb = payload?.slides?.[0];
  const thumbUrl = thumb?.embed ? null : thumb?.url;
  const formatLabel = assetType.charAt(0).toUpperCase() + assetType.slice(1);
  const ctaLabel = isMobileReview() ? "View full screen" : "Continue in full preview";
  hint.innerHTML = `
    <button type="button" class="preview-minimized-open">
      ${
        thumbUrl
          ? `<img class="preview-minimized-thumb" src="${thumbUrl}" alt="" />`
          : `<div class="preview-minimized-thumb preview-minimized-thumb--empty">${formatLabel}</div>`
      }
      <span class="preview-minimized-cta">${ctaLabel}</span>
    </button>
    <p class="sub preview-minimized-note">${ZERO1.instagram.name} · rating &amp; feedback below</p>
  `;
  hint.querySelector(".preview-minimized-open").addEventListener("click", () => {
    if (!payload) return;
    if (isMobileReview()) {
      const media = toMediaOnlyPayload(payload);
      if (media) openFullscreen(media);
      return;
    }
    openFullscreen(payload);
  });
  mount.appendChild(hint);
  return payload;
}

function renderFallbackStrip(mount, slides, openFullscreen) {
  const strip = document.createElement("div");
  strip.className = "carousel";
  const list = slideList(slides);
  list.forEach((slide, i) => {
    appendSlideMedia(
      strip,
      slide,
      () =>
        openFullscreen({
          platform: "fallback",
          slides: list,
          index: i,
          title: "",
        }),
      true,
    );
  });
  mount.appendChild(strip);
  return list.length
    ? { platform: "fallback", slides: list, index: 0, title: "" }
    : null;
}

function appendSlideMedia(parent, slide, onOpen, zoomable) {
  if (!slide?.url) return;
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(slide.url);
  if (isVideo) {
    const v = document.createElement("video");
    v.src = slide.url;
    v.controls = true;
    v.playsInline = true;
    v.className = "preview-video";
    parent.appendChild(v);
    return;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = zoomable ? "zoom-hit" : "plain-media";
  btn.setAttribute("aria-label", "Open platform preview");
  const img = document.createElement("img");
  img.src = slide.url;
  img.alt = slide.label ?? "Preview";
  img.loading = "lazy";
  btn.appendChild(img);
  if (zoomable) {
    btn.addEventListener("click", () => onOpen());
  }
  parent.appendChild(btn);
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

  function applyPlatformBranding(platform) {
    const pLabel = platformLabel(platform);
    const logoSrc = PLATFORM_LOGO[platform];
    const show = platform === "instagram" || platform === "linkedin";
    brandMark.hidden = !show;
    if (!show) return;
    brandMarkLogo.src = logoSrc;
    brandMarkLogo.alt = pLabel;
  }

  const syncSlide = () => {
    const slide = ctx.slides[ctx.index];
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
    if (e.key === "Escape") close();
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
        renderMediaStage(fallbackStage, ctx.slides[ctx.index], "fallback");
      }

      el.hidden = false;
      document.body.classList.add("lightbox-open");
    },
    close,
  };
}
