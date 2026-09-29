import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import {
  countAssets,
  getBatch,
  getNextUnratedAsset,
  listAssets,
} from "../db/index.js";
import {
  buildAssetAggregates,
  buildBatchSummary,
} from "../services/aggregate.js";
import { resultsFallbackText, resultsPageBlocks } from "../views/results.js";
import {
  assetIndexInBatch,
  canUserReview,
  userProgress,
} from "../services/batch.js";
import { postResults } from "../services/results.js";
import { getAsset, getUserResponse, upsertResponse } from "../db/index.js";
import { refreshKickoffMessage } from "../services/batch.js";
import { buildReviewModalView } from "../services/review-view.js";
import { commentModal } from "../views/review.js";

export function registerActions(app: App): void {
  app.action("start_review", async ({ ack, body, action, client }) => {
    const blockBody = body as BlockAction<ButtonAction>;
    const userId = blockBody.user.id;
    const btn = action as ButtonAction;
    const batchId = btn.value;

    const reply = async (text: string) => {
      const ch = blockBody.channel?.id;
      if (ch) {
        await client.chat.postEphemeral({ channel: ch, user: userId, text });
      }
    };

    if (!batchId) {
      await ack();
      await reply("Missing batch. Try `/social-review start` again.");
      return;
    }

    const batch = getBatch(batchId);
    if (!batch) {
      await ack();
      await reply("Batch not found.");
      return;
    }

    const deny = canUserReview(batch, userId);
    if (deny) {
      await ack();
      await reply(deny);
      return;
    }

    const total = countAssets(batchId);
    if (total === 0) {
      await ack();
      await reply("This batch has no assets.");
      return;
    }

    const unrated = getNextUnratedAsset(batchId, userId);
    const next = unrated ?? listAssets(batchId)[0];
    if (!next) {
      await ack();
      await reply("Could not load assets.");
      return;
    }

    const progress = userProgress(batchId, userId);

    try {
      const view = await buildReviewModalView(client, batch, next, {
        assetIndex: assetIndexInBatch(batchId, next.id),
        totalAssets: progress.total,
      });
      await client.views.open({
        trigger_id: blockBody.trigger_id,
        view,
      });
    } catch (err) {
      console.error("start_review views.open failed:", err);
      await reply(
        "Could not open the review form. Use the *thread* below the kickoff message and tap *1–5* on each asset instead.",
      );
    }

    await ack();
  });

  app.action("rate_asset", async ({ ack, body, action, client }) => {
    await ack();

    const btn = action as ButtonAction;
    const userId = body.user.id;
    const channel = body.channel?.id;
    if (!channel || !btn.value) return;

    let batchId: string;
    let assetId: string;
    let rating: number;
    try {
      const parsed = JSON.parse(btn.value) as {
        batchId: string;
        assetId: string;
        rating: number;
      };
      batchId = parsed.batchId;
      assetId = parsed.assetId;
      rating = parsed.rating;
    } catch {
      return;
    }

    const batch = getBatch(batchId);
    if (!batch) return;

    const deny = canUserReview(batch, userId);
    if (deny) {
      await client.chat.postEphemeral({ channel, user: userId, text: deny });
      return;
    }

    const existing = getUserResponse(assetId, userId);
    upsertResponse({
      batchId,
      assetId,
      slackUserId: userId,
      rating,
      feedback: existing?.feedback ?? null,
    });

    await refreshKickoffMessage(client, batchId);

    const asset = getAsset(assetId);
    await client.chat.postEphemeral({
      channel,
      user: userId,
      text: existing
        ? `Updated *${asset?.title ?? "asset"}* to *${rating}/5*. Tap *Add comment* for written feedback.`
        : `Rated *${asset?.title ?? "asset"}* *${rating}/5*. Tap *Add comment* if you want to add notes.`,
    });
  });

  app.action("asset_comment", async ({ ack, body, action, client }) => {
    const blockBody = body as BlockAction<ButtonAction>;
    const btn = action as ButtonAction;
    const userId = blockBody.user.id;
    const channel = blockBody.channel?.id;
    if (!btn.value) {
      await ack();
      return;
    }

    let batchId: string;
    let assetId: string;
    try {
      const parsed = JSON.parse(btn.value) as {
        batchId: string;
        assetId: string;
      };
      batchId = parsed.batchId;
      assetId = parsed.assetId;
    } catch {
      return;
    }

    const batch = getBatch(batchId);
    const asset = getAsset(assetId);
    if (!batch || !asset) return;

    const deny = canUserReview(batch, userId);
    if (deny && channel) {
      await ack();
      await client.chat.postEphemeral({ channel, user: userId, text: deny });
      return;
    }

    const existing = getUserResponse(assetId, userId);

    try {
      await client.views.open({
        trigger_id: blockBody.trigger_id,
        view: commentModal(batch, asset, existing?.rating ?? null),
      });
    } catch (err) {
      console.error("asset_comment views.open failed:", err);
      if (channel) {
        await client.chat.postEphemeral({
          channel,
          user: userId,
          text: "Could not open the feedback form. Try again or rate with the 1–5 buttons first.",
        });
      }
    }

    await ack();
  });

  app.action("results_prev_page", async ({ ack, body, action, client }) => {
    await ack();
    await handleResultsPage(body as BlockAction<ButtonAction>, action as ButtonAction, client);
  });

  app.action("results_next_page", async ({ ack, body, action, client }) => {
    await ack();
    await handleResultsPage(body as BlockAction<ButtonAction>, action as ButtonAction, client);
  });
}

async function handleResultsPage(
  body: BlockAction<ButtonAction>,
  action: ButtonAction,
  client: import("@slack/web-api").WebClient,
): Promise<void> {
  /* legacy slack thread pagination */
  const channelId = body.channel?.id;
  const messageTs = body.message?.ts;
  if (!action.value || !channelId || !messageTs) return;

  let batchId: string;
  let page: number;
  try {
    const parsed = JSON.parse(action.value) as { batchId: string; page: number };
    batchId = parsed.batchId;
    page = parsed.page;
  } catch {
    return;
  }

  const batch = getBatch(batchId);
  if (!batch) return;

  const summary = await buildBatchSummary(batchId);
  const assets = await buildAssetAggregates(batchId);
  const blocks = resultsPageBlocks(batch, summary, assets, page);

  await client.chat.update({
    channel: channelId,
    ts: messageTs,
    text: resultsFallbackText(batch),
    blocks,
  });
}
