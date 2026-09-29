import type { App } from "@slack/bolt";
import { randomUUID } from "node:crypto";
import {
  addAsset,
  closeBatch,
  countAssets,
  createBatch,
  getAsset,
  getBatch,
  getNextUnratedAsset,
  getUserResponse,
  setBatchReviewers,
  upsertResponse,
} from "../db/index.js";
import { isAssetTypeForPlatform, isPlatform } from "../models/platform.js";
import {
  ADD_ASSETS_CALLBACK,
  addAssetsStepModal,
  CLOSE_CALLBACK,
  CREATE_ADD_ASSET_CALLBACK,
  CREATE_BATCH_CALLBACK,
  creationDoneModal,
  PUBLISH_CALLBACK,
  REVIEWERS_CALLBACK,
} from "../views/batch.js";
import {
  COMMENT_MODAL_CALLBACK,
  parseReviewMetadata,
  REVIEW_MODAL_CALLBACK,
  commentModal,
  reviewCompleteModal,
} from "../views/review.js";
import {
  assetIndexInBatch,
  refreshKickoffMessage,
  userProgress,
} from "../services/batch.js";
import type { AssetMediaItem } from "../models/media.js";
import { slackFilePreviewUrl } from "../services/files.js";
import { publishBatchToChannel } from "../services/publish.js";
import { buildReviewModalView } from "../services/review-view.js";
import { postResults } from "../services/results.js";

function readAddAssetFormValues(
  values: Record<string, Record<string, { value?: unknown }>>,
  formKey: string,
) {
  const titleBlock = values[`title_${formKey}`]?.value as
    | { value?: string }
    | undefined;
  const postBlock = values[`post_url_${formKey}`]?.value as
    | { value?: string }
    | undefined;
  const slidesBlock = values[`slide_urls_${formKey}`]?.value as
    | { value?: string }
    | undefined;
  const uploadBlock = values[`upload_${formKey}`]?.value as
    | { files?: { id: string }[] }
    | undefined;
  const stepBlock = values[`step_${formKey}`]?.value as
    | { selected_option?: { value?: string } }
    | undefined;

  return {
    titleInput: titleBlock?.value?.trim() ?? "",
    postUrl: postBlock?.value?.trim() || null,
    slideUrlsRaw: slidesBlock?.value?.trim() ?? "",
    uploaded: uploadBlock?.files ?? [],
    step: stepBlock?.selected_option?.value ?? "add_more",
  };
}

export function registerViews(app: App): void {
  app.view(CREATE_BATCH_CALLBACK, async ({ ack, body, view }) => {
    const values = view.state.values;
    const name = values.name?.value?.value?.trim();
    const platformRaw = values.platform?.value?.selected_option?.value;
    const assetTypeRaw = values.asset_type?.value?.selected_option?.value;
    const channelId = values.channel?.value?.selected_conversation;
    const dueDate = values.due_at?.value?.selected_date ?? null;

    if (!name || !platformRaw || !assetTypeRaw || !channelId) {
      await ack({
        response_action: "errors",
        errors: {
          ...(!name ? { name: "Name is required" } : {}),
          ...(!platformRaw ? { platform: "Select a platform" } : {}),
          ...(!assetTypeRaw ? { asset_type: "Select an asset type" } : {}),
          ...(!channelId ? { channel: "Select a channel" } : {}),
        },
      });
      return;
    }

    if (!isPlatform(platformRaw)) {
      await ack({
        response_action: "errors",
        errors: { platform: "Invalid platform" },
      });
      return;
    }

    if (!isAssetTypeForPlatform(platformRaw, assetTypeRaw)) {
      await ack({
        response_action: "errors",
        errors: { asset_type: "Invalid type for platform" },
      });
      return;
    }

    const batch = createBatch({
      name,
      platform: platformRaw,
      assetType: assetTypeRaw,
      channelId,
      createdBy: body.user.id,
      dueAt: dueDate,
    });

    await ack({
      response_action: "update",
      view: addAssetsStepModal(batch.id, batch.name, 0, randomUUID()),
    });
  });

  app.view(CREATE_ADD_ASSET_CALLBACK, async ({ ack, body, view, client }) => {
    let batchId: string;
    let formKey: string;
    try {
      const meta = JSON.parse(view.private_metadata) as {
        batchId: string;
        formKey?: string;
      };
      batchId = meta.batchId;
      formKey = meta.formKey ?? "0";
    } catch {
      await ack({
        response_action: "errors",
        errors: { title: "Session expired — run /social-review create again." },
      });
      return;
    }

    const batch = getBatch(batchId);
    if (!batch || batch.status !== "draft") {
      await ack({
        response_action: "errors",
        errors: { title: "Batch not found or already started." },
      });
      return;
    }

    const form = readAddAssetFormValues(view.state.values, formKey);
    const titleInput = form.titleInput;
    const postUrl = form.postUrl;
    const slideUrlsRaw = form.slideUrlsRaw;
    const step = form.step;
    const uploaded = form.uploaded;

    const media: AssetMediaItem[] = [];
    for (let i = 0; i < uploaded.length; i += 1) {
      const fileId = uploaded[i]?.id;
      if (fileId) {
        media.push({
          slackFileId: fileId,
          label: `Slide ${i + 1}`,
        });
      }
    }

    const urlLines = slideUrlsRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < urlLines.length; i += 1) {
      media.push({
        url: urlLines[i],
        label: `Slide ${media.length + 1}`,
      });
    }

    const firstFileId = uploaded[0]?.id as string | undefined;
    const fileMeta = firstFileId
      ? await slackFilePreviewUrl(client, firstFileId)
      : null;

    const title =
      titleInput ||
      fileMeta?.fileName ||
      (uploaded.length > 0 ? "Uploaded asset" : "");

    const effectivePostUrl = postUrl ?? fileMeta?.permalink ?? null;
    const previewUrl = media.find((m) => m.url)?.url ?? fileMeta?.previewUrl ?? null;

    if (!title && !effectivePostUrl && media.length === 0) {
      await ack({
        response_action: "errors",
        errors: {
          title: "Add a title, link, slide URLs, or upload files.",
        },
      });
      return;
    }

    addAsset({
      batchId,
      title: title || "Untitled asset",
      postUrl: effectivePostUrl,
      previewUrl,
      mediaJson: JSON.stringify(media),
    });

    const count = countAssets(batchId);

    if (step === "add_more") {
      await ack({
        response_action: "update",
        view: addAssetsStepModal(batchId, batch.name, count, randomUUID()),
      });
      return;
    }

    await ack({
      response_action: "update",
      view: creationDoneModal(batch.name, count),
    });
  });

  app.view(ADD_ASSETS_CALLBACK, async ({ ack, body, view }) => {
    const batchId = view.state.values.batch?.value?.selected_option?.value;
    const title = view.state.values.title?.value?.value?.trim();
    const postUrl = view.state.values.post_url?.value?.value?.trim() || null;
    const previewUrl =
      view.state.values.preview_url?.value?.value?.trim() || null;

    if (!batchId || batchId === "_none" || !title) {
      await ack({
        response_action: "errors",
        errors: {
          ...( !batchId || batchId === "_none"
            ? { batch: "Select a batch" }
            : {}),
          ...(!title ? { title: "Title is required" } : {}),
        },
      });
      return;
    }

    const batch = getBatch(batchId);
    if (!batch || batch.status !== "draft") {
      await ack({
        response_action: "errors",
        errors: { batch: "Batch not found or not in draft" },
      });
      return;
    }

    addAsset({ batchId, title, postUrl, previewUrl });
    const count = countAssets(batchId);

    await ack({
      response_action: "update",
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Asset added" },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Added *${title}* to *${batch.name}* (${count} asset(s) total).\nRun \`/social-review add-assets\` again to add more.`,
            },
          },
        ],
      },
    });
  });

  app.view(REVIEWERS_CALLBACK, async ({ ack, view }) => {
    const batchId = view.state.values.batch?.value?.selected_option?.value;
    const reviewers =
      view.state.values.reviewers?.value?.selected_users ?? [];

    if (!batchId || batchId === "_none") {
      await ack({
        response_action: "errors",
        errors: { batch: "Select a batch" },
      });
      return;
    }

    setBatchReviewers(batchId, reviewers);
    await ack();
  });

  app.view(PUBLISH_CALLBACK, async ({ ack, body, view, client }) => {
    const batchId = view.state.values.batch?.value?.selected_option?.value;

    if (!batchId || batchId === "_none") {
      await ack({
        response_action: "errors",
        errors: { batch: "Select a batch" },
      });
      return;
    }

    const batch = getBatch(batchId);
    if (!batch || batch.status !== "draft") {
      await ack({
        response_action: "errors",
        errors: { batch: "Batch not found or already published" },
      });
      return;
    }

    const assetCount = countAssets(batchId);
    if (assetCount === 0) {
      await ack({
        response_action: "errors",
        errors: { batch: "Add at least one asset before publishing" },
      });
      return;
    }

    if (!batch.channel_id) {
      await ack({
        response_action: "errors",
        errors: { batch: "Batch has no channel" },
      });
      return;
    }

    await ack();
    await publishBatchToChannel(client, batchId);
  });

  app.view(CLOSE_CALLBACK, async ({ ack, view, client }) => {
    const batchId = view.state.values.batch?.value?.selected_option?.value;

    if (!batchId || batchId === "_none") {
      await ack({
        response_action: "errors",
        errors: { batch: "Select an open batch" },
      });
      return;
    }

    const batch = getBatch(batchId);
    if (!batch || batch.status !== "open") {
      await ack({
        response_action: "errors",
        errors: { batch: "Batch is not open" },
      });
      return;
    }

    await ack();
    closeBatch(batchId);

    if (batch.channel_id) {
      await postResults(client, batch.channel_id, batchId, 0);
      await client.chat.postMessage({
        channel: batch.channel_id,
        text: `Review closed: ${batch.name}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:lock: *${batch.name}* is closed. No new ratings will be accepted.`,
            },
          },
        ],
      });
    }
  });

  app.view(COMMENT_MODAL_CALLBACK, async ({ ack, body, view, client }) => {
    const meta = parseReviewMetadata(view.private_metadata);
    if (!meta) {
      await ack({
        response_action: "errors",
        errors: { feedback: "Session expired." },
      });
      return;
    }

    const batch = getBatch(meta.batchId);
    const asset = getAsset(meta.assetId);
    if (!batch || batch.status !== "open" || !asset) {
      await ack({
        response_action: "errors",
        errors: { feedback: "This review is not open." },
      });
      return;
    }

    const existing = getUserResponse(meta.assetId, body.user.id);
    const ratingRaw = view.state.values.rating?.value?.selected_option?.value;
    const feedback =
      view.state.values.feedback?.value?.value?.trim() || null;

    const rating = ratingRaw
      ? Number(ratingRaw)
      : existing?.rating ?? NaN;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      await ack({
        response_action: "errors",
        errors: { rating: "Select a rating from 1 to 5" },
      });
      return;
    }

    upsertResponse({
      batchId: meta.batchId,
      assetId: meta.assetId,
      slackUserId: body.user.id,
      rating,
      feedback,
    });

    await refreshKickoffMessage(client, meta.batchId);
    await ack();
  });

  app.view(REVIEW_MODAL_CALLBACK, async ({ ack, body, view, client }) => {
    const meta = parseReviewMetadata(view.private_metadata);
    if (!meta) {
      await ack({
        response_action: "errors",
        errors: { rating: "Session expired — click Start review again." },
      });
      return;
    }

    const batch = getBatch(meta.batchId);
    const ratingRaw =
      view.state.values.rating?.value?.selected_option?.value;

    const feedback =
      view.state.values.feedback?.value?.value?.trim() || null;

    if (!batch || batch.status !== "open") {
      await ack({
        response_action: "errors",
        errors: { rating: "This batch is no longer open." },
      });
      return;
    }

    const rating = ratingRaw ? Number(ratingRaw) : NaN;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      await ack({
        response_action: "errors",
        errors: { rating: "Select a rating from 1 to 5" },
      });
      return;
    }

    const { updated } = upsertResponse({
      batchId: meta.batchId,
      assetId: meta.assetId,
      slackUserId: body.user.id,
      rating,
      feedback,
    });

    await refreshKickoffMessage(client, meta.batchId);

    const next = getNextUnratedAsset(meta.batchId, body.user.id);
    const progress = userProgress(meta.batchId, body.user.id);
    const totalAssets = progress.total;

    if (next) {
      const view = await buildReviewModalView(client, batch, next, {
        assetIndex: assetIndexInBatch(meta.batchId, next.id),
        totalAssets,
      });
      await ack({
        response_action: "update",
        view,
      });
      return;
    }

    await ack({
      response_action: "update",
      view: reviewCompleteModal(batch.name, progress.done, totalAssets),
    });
  });
}
