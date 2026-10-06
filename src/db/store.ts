import { config } from "../config.js";
import type { Platform } from "../models/platform.js";
import type { BatchRow, AssetRow, ResponseRow } from "./index.js";
import * as sqlite from "./index.js";
import * as pg from "./pg.js";

const usePg = (): boolean => Boolean(config.databaseUrl);

export async function initDb(): Promise<void> {
  if (usePg()) await pg.initPostgres();
  else sqlite.getDb();
}

export async function createWebBatch(input: {
  name: string;
  platform: Platform;
  assetType: string;
  channelId: string;
}): Promise<BatchRow> {
  if (usePg()) return pg.createWebBatch(input);
  return sqlite.createWebBatch(input);
}

export async function getBatch(id: string): Promise<BatchRow | undefined> {
  if (usePg()) return pg.getBatch(id);
  return sqlite.getBatch(id);
}

export async function listAllBatches(): Promise<BatchRow[]> {
  if (usePg()) return pg.listAllBatches();
  return sqlite.listAllBatches();
}

export async function verifyBatchReviewToken(
  batchId: string,
  token: string,
): Promise<BatchRow | undefined> {
  if (usePg()) return pg.verifyBatchReviewToken(batchId, token);
  return sqlite.verifyBatchReviewToken(batchId, token);
}

export async function addAsset(input: {
  batchId: string;
  title: string;
  postUrl: string | null;
  previewUrl: string | null;
  mediaJson?: string;
}): Promise<AssetRow> {
  if (usePg()) return pg.addAsset(input);
  return sqlite.addAsset(input);
}

export async function listAssets(batchId: string): Promise<AssetRow[]> {
  if (usePg()) return pg.listAssets(batchId);
  return sqlite.listAssets(batchId);
}

export async function setAssetMediaJson(
  assetId: string,
  mediaJson: string,
): Promise<void> {
  if (usePg()) return pg.setAssetMediaJson(assetId, mediaJson);
  sqlite.setAssetMediaJson(assetId, mediaJson);
}

export async function countAssets(batchId: string): Promise<number> {
  if (usePg()) return pg.countAssets(batchId);
  return sqlite.countAssets(batchId);
}

export async function setBatchPublished(
  batchId: string,
  kickoffMessageTs: string,
): Promise<void> {
  if (usePg()) return pg.setBatchPublished(batchId, kickoffMessageTs);
  sqlite.setBatchPublished(batchId, kickoffMessageTs);
}

export async function upsertWebResponse(input: {
  batchId: string;
  assetId: string;
  reviewerName: string;
  rating: number;
  feedback: string | null;
  slideDetailsJson?: string | null;
}): Promise<void> {
  if (usePg()) return pg.upsertWebResponse(input);
  sqlite.upsertWebResponse(input);
}

export async function listReviewerNames(batchId: string): Promise<string[]> {
  if (usePg()) return pg.listReviewerNames(batchId);
  return sqlite.listReviewerNames(batchId);
}

export async function reviewerProgress(
  batchId: string,
  reviewerName: string,
): Promise<{ rated: number; total: number }> {
  if (usePg()) return pg.reviewerProgress(batchId, reviewerName);
  return sqlite.reviewerProgress(batchId, reviewerName);
}

export async function listResponsesForBatch(
  batchId: string,
): Promise<ResponseRow[]> {
  if (usePg()) return pg.listResponsesForBatch(batchId);
  return sqlite.listResponsesForBatch(batchId);
}

export async function countDistinctReviewers(batchId: string): Promise<number> {
  if (usePg()) return pg.countDistinctReviewers(batchId);
  return sqlite.countDistinctReviewers(batchId);
}

export async function countInvitedReviewers(batchId: string): Promise<number> {
  if (usePg()) return pg.countInvitedReviewers(batchId);
  return sqlite.countInvitedReviewers(batchId);
}

export async function deleteAsset(assetId: string): Promise<boolean> {
  if (usePg()) return pg.deleteAsset(assetId);
  return sqlite.deleteAsset(assetId);
}

export async function deleteBatch(batchId: string): Promise<boolean> {
  if (usePg()) return pg.deleteBatch(batchId);
  return sqlite.deleteBatch(batchId);
}

export async function getAsset(id: string): Promise<AssetRow | undefined> {
  if (usePg()) return pg.getAsset(id);
  return sqlite.getAsset(id);
}
