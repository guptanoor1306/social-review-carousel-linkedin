import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import {
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  verifyAdminLogin,
  getSessionUser,
} from "../auth/session.js";
import * as store from "../db/store.js";
import type { AssetMediaItem } from "../models/media.js";
import { parseAssetMedia } from "../models/media.js";
import { normalizeSlideDetails } from "../models/slide-details.js";
import {
  isAssetTypeForPlatform,
  isPlatform,
  type Platform,
} from "../models/platform.js";
import { postReviewInvite, postReviewSummary, reviewUrl } from "../services/slack-notify.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.resolve(config.uploadsPath);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-()+ ]/g, "_");
      cb(null, `${randomUUID()}-${safe}`);
    },
  }),
  limits: { fileSize: 80 * 1024 * 1024, files: 10 },
});

export function createApiRouter(): Router {
  const router = Router();

  router.post("/auth/login", (req, res) => {
    const username = String(req.body.username ?? "");
    const password = String(req.body.password ?? "");
    if (!verifyAdminLogin(username, password)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    setSessionCookie(res, req, username);
    res.json({ ok: true, username });
  });

  router.post("/auth/logout", (req, res) => {
    clearSessionCookie(res, req);
    res.json({ ok: true });
  });

  router.get("/auth/me", (req, res) => {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: "not logged in" });
      return;
    }
    res.json({ username: user });
  });

  router.get("/batches", requireAdmin, async (_req, res) => {
    const batches = await store.listAllBatches();
    const out = await Promise.all(
      batches.map(async (b) => ({
        id: b.id,
        name: b.name,
        platform: b.platform,
        assetType: b.asset_type,
        status: b.status,
        channelId: b.channel_id,
        assetCount: await store.countAssets(b.id),
        reviewerCount: (await store.listReviewerNames(b.id)).length,
        reviewUrl: reviewUrl(b),
        createdAt: b.created_at,
      })),
    );
    res.json({ batches: out });
  });

  router.post("/batches", requireAdmin, async (req, res) => {
    const { name, platform, assetType, channelId } = req.body as {
      name?: string;
      platform?: string;
      assetType?: string;
      channelId?: string;
    };

    if (!name?.trim() || !platform || !assetType || !channelId?.trim()) {
      res.status(400).json({ error: "name, platform, assetType, channelId required" });
      return;
    }
    if (!isPlatform(platform) || !isAssetTypeForPlatform(platform, assetType)) {
      res.status(400).json({ error: "invalid platform or asset type" });
      return;
    }

    const batch = await store.createWebBatch({
      name: name.trim(),
      platform: platform as Platform,
      assetType,
      channelId: channelId.trim(),
    });

    res.status(201).json({
      batch: { id: batch.id, reviewUrl: reviewUrl(batch), token: batch.review_token },
    });
  });

  router.get("/batches/:id", requireAdmin, async (req, res) => {
    const batch = await store.getBatch(String(req.params.id));
    if (!batch) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const assets = await store.listAssets(batch.id);
    res.json({
      batch: {
        id: batch.id,
        name: batch.name,
        platform: batch.platform,
        assetType: batch.asset_type,
        status: batch.status,
        channelId: batch.channel_id,
        reviewUrl: reviewUrl(batch),
        reviewers: await store.listReviewerNames(batch.id),
      },
      assets: assets.map((a, idx) => ({
        id: a.id,
        index: idx + 1,
        title: a.title,
        postUrl: a.post_url,
        slides: parseAssetMedia(a).map((m, i) => ({
          label: m.label ?? `Slide ${i + 1}`,
          caption: m.caption ?? "",
          url: mediaPublicUrl(m),
        })),
      })),
    });
  });

  router.delete("/batches/:id", requireAdmin, async (req, res) => {
    const ok = await store.deleteBatch(String(req.params.id));
    res.json({ ok });
  });

  router.post(
    "/batches/:id/assets",
    requireAdmin,
    upload.array("files", 10),
    async (req, res) => {
      const batch = await store.getBatch(String(req.params.id));
      if (!batch || batch.status === "closed") {
        res.status(404).json({ error: "batch not found or closed" });
        return;
      }

      const mode = String(req.body.mode ?? "upload");
      const title = String(req.body.title ?? "").trim();
      const linkUrl = String(req.body.linkUrl ?? req.body.postUrl ?? "").trim();
      const files = req.files as Express.Multer.File[] | undefined;

      const media: AssetMediaItem[] = [];

      if (mode === "link") {
        if (!linkUrl) {
          res.status(400).json({ error: "paste a link to the reel, post, or carousel" });
          return;
        }
        media.push({ url: linkUrl, label: "Link preview" });
      } else {
        if (!files?.length) {
          res.status(400).json({ error: "choose a file to upload" });
          return;
        }
        const slideCaptions = parseSlideCaptionsField(req.body.slideCaptions);
        for (let i = 0; i < files.length; i += 1) {
          const f = files[i]!;
          const cap = String(slideCaptions[i] ?? "").trim();
          media.push({
            localPath: path.basename(f.path),
            label: files.length > 1 ? `Slide ${i + 1}` : "Media",
            caption: cap || undefined,
          });
        }
      }

      const asset = await store.addAsset({
        batchId: batch.id,
        title: title || defaultTitle(batch.asset_type, await store.countAssets(batch.id)),
        postUrl: mode === "link" ? linkUrl : null,
        previewUrl: media[0]?.url ?? null,
        mediaJson: JSON.stringify(media),
      });

      res.status(201).json({ assetId: asset.id, slideCount: media.length });
    },
  );

  router.delete("/batches/:batchId/assets/:assetId", requireAdmin, async (req, res) => {
    const asset = await store.getAsset(String(req.params.assetId));
    if (asset) {
      for (const m of parseAssetMedia(asset)) {
        if (m.localPath) {
          const p = path.join(config.uploadsPath, m.localPath);
          fs.unlink(p, () => {});
        }
      }
    }
    const ok = await store.deleteAsset(String(req.params.assetId));
    res.json({ ok });
  });

  router.post("/batches/:id/notify-slack", requireAdmin, async (req, res) => {
    try {
      const batch = await store.getBatch(String(req.params.id));
      if (!batch) {
        res.status(404).json({ error: "not found" });
        return;
      }
      await postReviewInvite(batch.id);
      await store.setBatchPublished(batch.id, "web");
      res.json({ ok: true, reviewUrl: reviewUrl(batch) });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  router.post("/batches/:id/summary-slack", requireAdmin, async (req, res) => {
    try {
      await postReviewSummary(String(req.params.id));
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  router.get("/review/:id", async (req, res) => {
    const token = String(req.query.token ?? "");
    const batch = await store.verifyBatchReviewToken(String(req.params.id), token);
    if (!batch || batch.status === "draft") {
      res.status(403).json({ error: "invalid or inactive review link" });
      return;
    }

    const assets = await store.listAssets(batch.id);
    const reviewerName = String(req.query.reviewer ?? "").trim();
    const progress = reviewerName
      ? await store.reviewerProgress(batch.id, reviewerName)
      : null;

    res.json({
      batch: {
        id: batch.id,
        name: batch.name,
        platform: batch.platform,
        assetType: batch.asset_type,
        status: batch.status,
        totalAssets: assets.length,
      },
      assets: assets.map((a, idx) => ({
        id: a.id,
        index: idx + 1,
        title: a.title,
        postUrl: a.post_url,
        slides: parseAssetMedia(a).map((m, i) => ({
          label: m.label ?? `Slide ${i + 1}`,
          caption: m.caption ?? "",
          url: mediaPublicUrl(m),
        })),
      })),
      progress,
    });
  });

  router.post("/review/:id/responses", async (req, res) => {
    const token = String(req.body.token ?? "");
    const batch = await store.verifyBatchReviewToken(String(req.params.id), token);
    if (!batch || batch.status !== "open") {
      res.status(403).json({ error: "review is not open" });
      return;
    }

    const reviewerName = String(req.body.reviewerName ?? "").trim();
    const assetId = String(req.body.assetId ?? "");
    const rating = Number(req.body.rating);
    const feedback = String(req.body.feedback ?? "").trim() || null;
    const slideDetails = normalizeSlideDetails(req.body.slideDetails);
    const slideDetailsJson = slideDetails.length
      ? JSON.stringify(slideDetails)
      : null;

    if (reviewerName.length < 2) {
      res.status(400).json({ error: "enter your name" });
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating 1-5 required" });
      return;
    }

    const assets = await store.listAssets(batch.id);
    if (!assets.some((a) => a.id === assetId)) {
      res.status(400).json({ error: "invalid asset" });
      return;
    }

    await store.upsertWebResponse({
      batchId: batch.id,
      assetId,
      reviewerName,
      rating,
      feedback,
      slideDetailsJson,
    });

    res.json({
      ok: true,
      progress: await store.reviewerProgress(batch.id, reviewerName),
    });
  });

  return router;
}

function mediaPublicUrl(item: AssetMediaItem): string | null {
  if (item.url) return item.url;
  if (item.localPath) {
    return `${config.publicBaseUrl}/uploads/${encodeURIComponent(item.localPath)}`;
  }
  return null;
}

function parseSlideCaptionsField(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? ""));
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map((x) => String(x ?? ""));
    } catch {
      return [raw];
    }
  }
  return [];
}

function defaultTitle(assetType: string, count: number): string {
  const label = assetType.charAt(0).toUpperCase() + assetType.slice(1);
  return `${label} ${count + 1}`;
}
