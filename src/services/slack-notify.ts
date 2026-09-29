import { WebClient } from "@slack/web-api";
import { config } from "../config.js";
import * as store from "../db/store.js";
import { formatPlatformType } from "../models/platform.js";
import {
  buildAssetAggregates,
  buildBatchSummary,
} from "./aggregate.js";
import { resultsFallbackText, resultsPageBlocks } from "../views/results.js";

let client: WebClient | null = null;

function slack(): WebClient {
  if (!client) client = new WebClient(config.slackBotToken);
  return client;
}

export function reviewUrl(batch: { id: string; review_token: string }): string {
  return `${config.publicBaseUrl}/review/${batch.id}?token=${batch.review_token}`;
}

export async function postReviewInvite(batchId: string): Promise<void> {
  const batch = await store.getBatch(batchId);
  if (!batch?.channel_id) {
    throw new Error("Batch needs a Slack channel ID");
  }

  const assetCount = await store.countAssets(batchId);
  if (assetCount === 0) {
    throw new Error("Add at least one asset before notifying Slack");
  }

  const url = reviewUrl(batch);
  await slack().chat.postMessage({
    channel: batch.channel_id,
    text: `Review ready: ${batch.name}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Social asset review" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${batch.name}*\n${formatPlatformType(batch.platform, batch.asset_type)} · *${assetCount}* asset(s)\n\nOpen on your phone — enter your *name*, rate 1–5, optional feedback.`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open review" },
            style: "primary",
            url,
          },
        ],
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: url }],
      },
    ],
  });
}

export async function postReviewSummary(batchId: string): Promise<void> {
  const batch = await store.getBatch(batchId);
  if (!batch?.channel_id) {
    throw new Error("Batch needs a Slack channel ID");
  }

  const summary = await buildBatchSummary(batchId);
  const assets = await buildAssetAggregates(batchId);
  const blocks = resultsPageBlocks(batch, summary, assets, 0);

  await slack().chat.postMessage({
    channel: batch.channel_id,
    text: resultsFallbackText(batch),
    blocks,
  });
}
