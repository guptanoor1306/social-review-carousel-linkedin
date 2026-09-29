import type { WebClient } from "@slack/web-api";
import {
  countAssets,
  countDistinctReviewers,
  countUserResponses,
  getBatch,
  getBatchReviewers,
  listAssets,
  listResponsesForBatch,
  type BatchRow,
} from "../db/index.js";
import { formatPlatformType } from "../models/platform.js";
import { kickoffMessageBlocks } from "../views/batch.js";

export async function refreshKickoffMessage(
  client: WebClient,
  batchId: string,
): Promise<void> {
  const batch = getBatch(batchId);
  if (!batch?.channel_id || !batch.kickoff_message_ts) return;

  const assetCount = countAssets(batchId);
  const reviewerCount = getBatchReviewers(batchId).length;
  const completedReviewers = countDistinctReviewers(batchId);

  const blocks = kickoffMessageBlocks(batch, assetCount, reviewerCount);
  blocks.splice(3, 0, {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Progress:* ${completedReviewers} reviewer(s) submitted · ${countTotalResponses(batchId)} total rating(s)`,
    },
  });

  await client.chat.update({
    channel: batch.channel_id,
    ts: batch.kickoff_message_ts,
    text: `Review: ${batch.name}`,
    blocks,
  });
}

function countTotalResponses(batchId: string): number {
  return listResponsesForBatch(batchId).length;
}

export function userProgress(batchId: string, userId: string) {
  const total = countAssets(batchId);
  const done = countUserResponses(batchId, userId);
  return { done, total, current: Math.min(done + 1, total) };
}

export function assetIndexInBatch(batchId: string, assetId: string): number {
  const assets = listAssets(batchId);
  const idx = assets.findIndex((a) => a.id === assetId);
  return idx >= 0 ? idx + 1 : 1;
}

export function canUserReview(batch: BatchRow, userId: string): string | null {
  if (batch.status !== "open") {
    return "This review batch is not open.";
  }
  const invited = getBatchReviewers(batch.id);
  if (invited.length > 0 && !invited.includes(userId)) {
    return "You are not on the reviewer list for this batch.";
  }
  return null;
}

export function batchLabel(batch: BatchRow): string {
  return `${batch.name} (${formatPlatformType(batch.platform, batch.asset_type)})`;
}
