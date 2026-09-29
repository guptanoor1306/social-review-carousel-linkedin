import pg from "pg";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { BatchRow, AssetRow, ResponseRow } from "./index.js";
import type { Platform } from "../models/platform.js";

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  channel_id TEXT,
  created_by TEXT NOT NULL,
  due_at TEXT,
  kickoff_message_ts TEXT,
  review_token TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  sort_order INT NOT NULL,
  title TEXT NOT NULL,
  post_url TEXT,
  preview_url TEXT,
  media_json TEXT NOT NULL DEFAULT '[]',
  slack_message_ts TEXT
);
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  slack_user_id TEXT,
  reviewer_name TEXT,
  rating INT NOT NULL,
  feedback TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_responses_asset_reviewer_name
  ON responses(asset_id, reviewer_name) WHERE reviewer_name IS NOT NULL AND reviewer_name <> '';
`;

export async function initPostgres(): Promise<void> {
  await pool.query(SCHEMA);
  await pool.query(`
    ALTER TABLE batches ADD COLUMN IF NOT EXISTS review_token TEXT NOT NULL DEFAULT '';
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS reviewer_name TEXT;
  `).catch(() => {});
}

function webReviewerKey(name: string): string {
  return `web:${name.trim().toLowerCase()}`;
}

export async function createWebBatch(input: {
  name: string;
  platform: Platform;
  assetType: string;
  channelId: string;
}): Promise<BatchRow> {
  const id = randomUUID();
  const reviewToken = randomUUID().replace(/-/g, "");
  await pool.query(
    `INSERT INTO batches (id, name, platform, asset_type, channel_id, created_by, review_token)
     VALUES ($1,$2,$3,$4,$5,'web',$6)`,
    [id, input.name, input.platform, input.assetType, input.channelId, reviewToken],
  );
  return (await getBatch(id))!;
}

export async function getBatch(id: string): Promise<BatchRow | undefined> {
  const r = await pool.query(`SELECT * FROM batches WHERE id = $1`, [id]);
  return r.rows[0] as BatchRow | undefined;
}

export async function listAllBatches(): Promise<BatchRow[]> {
  const r = await pool.query(`SELECT * FROM batches ORDER BY created_at DESC`);
  return r.rows as BatchRow[];
}

export async function verifyBatchReviewToken(
  batchId: string,
  token: string,
): Promise<BatchRow | undefined> {
  const batch = await getBatch(batchId);
  if (!batch || batch.review_token !== token) return undefined;
  return batch;
}

export async function addAsset(input: {
  batchId: string;
  title: string;
  postUrl: string | null;
  previewUrl: string | null;
  mediaJson?: string;
}): Promise<AssetRow> {
  const max = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) AS m FROM assets WHERE batch_id = $1`,
    [input.batchId],
  );
  const id = randomUUID();
  const order = Number(max.rows[0].m) + 1;
  await pool.query(
    `INSERT INTO assets (id, batch_id, sort_order, title, post_url, preview_url, media_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      input.batchId,
      order,
      input.title,
      input.postUrl,
      input.previewUrl,
      input.mediaJson ?? "[]",
    ],
  );
  return (await getAsset(id))!;
}

export async function getAsset(id: string): Promise<AssetRow | undefined> {
  const r = await pool.query(`SELECT * FROM assets WHERE id = $1`, [id]);
  return r.rows[0] as AssetRow | undefined;
}

export async function listAssets(batchId: string): Promise<AssetRow[]> {
  const r = await pool.query(
    `SELECT * FROM assets WHERE batch_id = $1 ORDER BY sort_order ASC`,
    [batchId],
  );
  return r.rows as AssetRow[];
}

export async function setAssetMediaJson(
  assetId: string,
  mediaJson: string,
): Promise<void> {
  await pool.query(`UPDATE assets SET media_json = $1 WHERE id = $2`, [
    mediaJson,
    assetId,
  ]);
}

export async function countAssets(batchId: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c FROM assets WHERE batch_id = $1`,
    [batchId],
  );
  return r.rows[0].c as number;
}

export async function setBatchPublished(
  batchId: string,
  kickoffMessageTs: string,
): Promise<void> {
  await pool.query(
    `UPDATE batches SET status = 'open', kickoff_message_ts = $1 WHERE id = $2`,
    [kickoffMessageTs, batchId],
  );
}

export async function upsertWebResponse(input: {
  batchId: string;
  assetId: string;
  reviewerName: string;
  rating: number;
  feedback: string | null;
}): Promise<void> {
  const name = input.reviewerName.trim();
  const existing = await pool.query(
    `SELECT id FROM responses WHERE asset_id = $1 AND lower(reviewer_name) = lower($2)`,
    [input.assetId, name],
  );
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE responses SET rating = $1, feedback = $2, updated_at = NOW() WHERE id = $3`,
      [input.rating, input.feedback, existing.rows[0].id],
    );
    return;
  }
  await pool.query(
    `INSERT INTO responses (id, batch_id, asset_id, slack_user_id, reviewer_name, rating, feedback)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      randomUUID(),
      input.batchId,
      input.assetId,
      webReviewerKey(name),
      name,
      input.rating,
      input.feedback,
    ],
  );
}

export async function listReviewerNames(batchId: string): Promise<string[]> {
  const r = await pool.query(
    `SELECT DISTINCT reviewer_name AS n FROM responses
     WHERE batch_id = $1 AND reviewer_name IS NOT NULL AND trim(reviewer_name) <> ''
     ORDER BY n ASC`,
    [batchId],
  );
  return r.rows.map((row) => row.n as string);
}

export async function reviewerProgress(
  batchId: string,
  reviewerName: string,
): Promise<{ rated: number; total: number }> {
  const total = await countAssets(batchId);
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c FROM responses WHERE batch_id = $1 AND lower(reviewer_name) = lower($2)`,
    [batchId, reviewerName.trim()],
  );
  return { rated: r.rows[0].c as number, total };
}

export async function listResponsesForBatch(
  batchId: string,
): Promise<ResponseRow[]> {
  const r = await pool.query(
    `SELECT * FROM responses WHERE batch_id = $1 ORDER BY updated_at DESC`,
    [batchId],
  );
  return r.rows as ResponseRow[];
}

export async function countDistinctReviewers(batchId: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(DISTINCT COALESCE(NULLIF(trim(reviewer_name), ''), slack_user_id))::int AS c
     FROM responses WHERE batch_id = $1`,
    [batchId],
  );
  return r.rows[0].c as number;
}

export async function countInvitedReviewers(batchId: string): Promise<number> {
  return 0;
}

export async function deleteAsset(assetId: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM assets WHERE id = $1`, [assetId]);
  return (r.rowCount ?? 0) > 0;
}

export async function deleteBatch(batchId: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM batches WHERE id = $1`, [batchId]);
  return (r.rowCount ?? 0) > 0;
}
