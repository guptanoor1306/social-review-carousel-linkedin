import type { WebClient } from "@slack/web-api";
import { config } from "../config.js";
import {
  countAssets,
  getBatch,
  getBatchReviewers,
  listAssets,
  setAssetSlackMessageTs,
  setBatchPublished,
} from "../db/index.js";
import { parseAssetMedia } from "../models/media.js";
import { enrichAndPersistAssetMedia } from "./media-display.js";
import { mirrorSlackFileToThread, postUrlSlideToThread } from "./files.js";
import { assetReviewMessageBlocks } from "../views/asset-card.js";
import { kickoffMessageBlocks } from "../views/batch.js";

export async function publishBatchToChannel(
  client: WebClient,
  batchId: string,
): Promise<void> {
  const batch = getBatch(batchId);
  if (!batch?.channel_id) {
    throw new Error("Batch or channel missing");
  }

  const assetCount = countAssets(batchId);
  const reviewerCount = getBatchReviewers(batchId).length;

  const posted = await client.chat.postMessage({
    channel: batch.channel_id,
    text: `Social review: ${batch.name}`,
    blocks: kickoffMessageBlocks(batch, assetCount, reviewerCount),
  });

  if (!posted.ts) {
    throw new Error("Failed to post kickoff message");
  }

  setBatchPublished(batchId, posted.ts);

  const assets = listAssets(batchId);
  let index = 0;
  for (const asset of assets) {
    index += 1;
    const assetWithMedia = await enrichAndPersistAssetMedia(client, asset);
    const header = await client.chat.postMessage({
      channel: batch.channel_id,
      thread_ts: posted.ts,
      text: `${index}/${assets.length}: ${asset.title}`,
      blocks: assetReviewMessageBlocks(batchId, assetWithMedia, {
        index,
        total: assets.length,
      }),
    });

    if (header.ts) {
      setAssetSlackMessageTs(assetWithMedia.id, header.ts);
    }

    const media = parseAssetMedia(assetWithMedia);
    for (let i = 0; i < media.length; i += 1) {
      const item = media[i]!;
      try {
        if (item.slackFileId) {
          await mirrorSlackFileToThread(
            client,
            config.slackBotToken,
            item.slackFileId,
            batch.channel_id,
            header.ts ?? posted.ts,
            item.label ?? `Slide ${i + 1} · ${assetWithMedia.title}`,
          );
        } else if (item.url) {
          await postUrlSlideToThread(
            client,
            batch.channel_id,
            header.ts ?? posted.ts,
            item,
            i,
          );
        }
      } catch (err) {
        console.error("Failed to post slide preview:", err);
        await client.chat.postMessage({
          channel: batch.channel_id,
          thread_ts: header.ts ?? posted.ts,
          text: item.label ?? `Slide ${i + 1}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `_Could not attach preview for ${item.label ?? "slide"}._`,
              },
            },
          ],
        });
      }
    }
  }
}
