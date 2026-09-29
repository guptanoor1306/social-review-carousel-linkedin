import type { AssetRow } from "../db/index.js";
import * as store from "../db/store.js";
import { config } from "../config.js";

export type AssetAggregate = {
  assetId: string;
  title: string;
  avgRating: number;
  count: number;
  minRating: number;
  maxRating: number;
  comments: { name: string; rating: number; feedback: string }[];
};

export type BatchSummary = {
  distinctReviewers: number;
  invitedReviewers: number;
  totalResponses: number;
};

export async function buildBatchSummary(
  batchId: string,
): Promise<BatchSummary> {
  const responses = await store.listResponsesForBatch(batchId);
  return {
    distinctReviewers: await store.countDistinctReviewers(batchId),
    invitedReviewers: await store.countInvitedReviewers(batchId),
    totalResponses: responses.length,
  };
}

export async function buildAssetAggregates(
  batchId: string,
): Promise<AssetAggregate[]> {
  const assets = await store.listAssets(batchId);
  const responses = await store.listResponsesForBatch(batchId);
  const byAsset = new Map<string, typeof responses>();
  for (const r of responses) {
    const list = byAsset.get(r.asset_id) ?? [];
    list.push(r);
    byAsset.set(r.asset_id, list);
  }

  const aggregates = assets.map((asset) =>
    toAggregate(asset, byAsset.get(asset.id) ?? []),
  );

  aggregates.sort((a, b) => {
    if (a.count === 0 && b.count === 0) return 0;
    if (a.count === 0) return 1;
    if (b.count === 0) return -1;
    if (config.resultsSort === "highest") {
      return b.avgRating - a.avgRating;
    }
    return a.avgRating - b.avgRating;
  });

  return aggregates;
}

function toAggregate(
  asset: AssetRow,
  rows: {
    slack_user_id: string | null;
    reviewer_name: string | null;
    rating: number;
    feedback: string | null;
  }[],
): AssetAggregate {
  if (rows.length === 0) {
    return {
      assetId: asset.id,
      title: asset.title,
      avgRating: 0,
      count: 0,
      minRating: 0,
      maxRating: 0,
      comments: [],
    };
  }

  const ratings = rows.map((r) => r.rating);
  const sum = ratings.reduce((a, b) => a + b, 0);
  const comments = rows.map((r) => ({
    name: (r.reviewer_name?.trim() || r.slack_user_id || "Unknown").trim(),
    rating: r.rating,
    feedback: (r.feedback ?? "").trim(),
  }));

  return {
    assetId: asset.id,
    title: asset.title,
    avgRating: sum / rows.length,
    count: rows.length,
    minRating: Math.min(...ratings),
    maxRating: Math.max(...ratings),
    comments,
  };
}
