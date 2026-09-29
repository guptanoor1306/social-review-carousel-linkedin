import type { WebClient } from "@slack/web-api";
import * as store from "../db/store.js";
import { buildAssetAggregates, buildBatchSummary } from "./aggregate.js";
import { resultsFallbackText, resultsPageBlocks } from "../views/results.js";

export async function postResults(
  client: WebClient,
  channel: string,
  batchId: string,
  page: number,
): Promise<void> {
  const batch = await store.getBatch(batchId);
  if (!batch) {
    throw new Error(`Batch not found: ${batchId}`);
  }

  const summary = await buildBatchSummary(batchId);
  const assets = await buildAssetAggregates(batchId);
  const blocks = resultsPageBlocks(batch, summary, assets, page);

  await client.chat.postMessage({
    channel,
    text: resultsFallbackText(batch),
    blocks,
  });
}
