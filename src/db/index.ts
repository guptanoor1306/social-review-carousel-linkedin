import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { BatchStatus, Platform } from "../models/platform.js";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type BatchRow = {
  id: string;
  name: string;
  platform: string;
  asset_type: string;
  status: BatchStatus;
  channel_id: string | null;
  created_by: string;
  due_at: string | null;
  kickoff_message_ts: string | null;
  review_token: string;
  created_at: string;
};

export type AssetRow = {
  id: string;
  batch_id: string;
  sort_order: number;
  title: string;
  post_url: string | null;
  preview_url: string | null;
  media_json: string;
  slack_message_ts: string | null;
};

export type ResponseRow = {
  id: string;
  batch_id: string;
  asset_id: string;
  slack_user_id: string | null;
  reviewer_name: string | null;
  rating: number;
  feedback: string | null;
  slide_details_json: string | null;
  updated_at: string;
};

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(path.resolve(config.databasePath));
    fs.mkdirSync(dir, { recursive: true });
    db = new Database(config.databasePath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    db.exec(schema);
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(assets)`)
    .all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("media_json")) {
    database.exec(
      `ALTER TABLE assets ADD COLUMN media_json TEXT NOT NULL DEFAULT '[]'`,
    );
  }
  if (!names.has("slack_message_ts")) {
    database.exec(`ALTER TABLE assets ADD COLUMN slack_message_ts TEXT`);
  }

  const batchCols = database
    .prepare(`PRAGMA table_info(batches)`)
    .all() as { name: string }[];
  const batchNames = new Set(batchCols.map((c) => c.name));
  if (!batchNames.has("review_token")) {
    database.exec(
      `ALTER TABLE batches ADD COLUMN review_token TEXT NOT NULL DEFAULT ''`,
    );
    database.exec(
      `UPDATE batches SET review_token = lower(hex(randomblob(16))) WHERE review_token = '' OR review_token IS NULL`,
    );
  }

  const respCols = database
    .prepare(`PRAGMA table_info(responses)`)
    .all() as { name: string }[];
  const respNames = new Set(respCols.map((c) => c.name));
  if (!respNames.has("reviewer_name")) {
    database.exec(`ALTER TABLE responses ADD COLUMN reviewer_name TEXT`);
  }
  if (!respNames.has("slide_details_json")) {
    database.exec(`ALTER TABLE responses ADD COLUMN slide_details_json TEXT`);
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_responses_asset_reviewer_name
      ON responses(asset_id, reviewer_name) WHERE reviewer_name IS NOT NULL AND reviewer_name != '';
  `);
}

function webReviewerKey(name: string): string {
  return `web:${name.trim().toLowerCase()}`;
}

export function createBatch(input: {
  name: string;
  platform: Platform;
  assetType: string;
  channelId: string;
  createdBy: string;
  dueAt: string | null;
}): BatchRow {
  const id = randomUUID();
  const reviewToken = randomUUID().replace(/-/g, "");
  getDb()
    .prepare(
      `INSERT INTO batches (id, name, platform, asset_type, channel_id, created_by, due_at, review_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.platform,
      input.assetType,
      input.channelId,
      input.createdBy,
      input.dueAt,
      reviewToken,
    );
  return getBatch(id)!;
}

export function createWebBatch(input: {
  name: string;
  platform: Platform;
  assetType: string;
  channelId: string;
  dueAt?: string | null;
}): BatchRow {
  return createBatch({
    ...input,
    dueAt: input.dueAt ?? null,
    createdBy: "web",
  });
}

export function getBatch(id: string): BatchRow | undefined {
  return getDb().prepare(`SELECT * FROM batches WHERE id = ?`).get(id) as
    | BatchRow
    | undefined;
}

export function verifyBatchReviewToken(
  batchId: string,
  token: string,
): BatchRow | undefined {
  const batch = getBatch(batchId);
  if (!batch || batch.review_token !== token) return undefined;
  return batch;
}

export function upsertWebResponse(input: {
  batchId: string;
  assetId: string;
  reviewerName: string;
  rating: number;
  feedback: string | null;
  slideDetailsJson?: string | null;
}): void {
  const name = input.reviewerName.trim();
  const existing = getDb()
    .prepare(
      `SELECT id FROM responses WHERE asset_id = ? AND reviewer_name = ? COLLATE NOCASE`,
    )
    .get(input.assetId, name) as { id: string } | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE responses SET rating = ?, feedback = ?, slide_details_json = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(
        input.rating,
        input.feedback,
        input.slideDetailsJson ?? null,
        existing.id,
      );
    return;
  }

  getDb()
    .prepare(
      `INSERT INTO responses (id, batch_id, asset_id, slack_user_id, reviewer_name, rating, feedback, slide_details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.batchId,
      input.assetId,
      webReviewerKey(name),
      name,
      input.rating,
      input.feedback,
      input.slideDetailsJson ?? null,
    );
}

export function listReviewerNames(batchId: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT reviewer_name AS n FROM responses
       WHERE batch_id = ? AND reviewer_name IS NOT NULL AND trim(reviewer_name) != ''
       ORDER BY n COLLATE NOCASE ASC`,
    )
    .all(batchId) as { n: string }[];
  return rows.map((r) => r.n);
}

export function reviewerProgress(
  batchId: string,
  reviewerName: string,
): { rated: number; total: number } {
  const total = countAssets(batchId);
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM responses
       WHERE batch_id = ? AND reviewer_name = ? COLLATE NOCASE`,
    )
    .get(batchId, reviewerName.trim()) as { c: number };
  return { rated: row.c, total };
}

export function listDraftBatches(createdBy?: string): BatchRow[] {
  if (createdBy) {
    return getDb()
      .prepare(
        `SELECT * FROM batches WHERE status = 'draft' AND created_by = ? ORDER BY created_at DESC`,
      )
      .all(createdBy) as BatchRow[];
  }
  return getDb()
    .prepare(`SELECT * FROM batches WHERE status = 'draft' ORDER BY created_at DESC`)
    .all() as BatchRow[];
}

export function listOpenBatches(): BatchRow[] {
  return getDb()
    .prepare(`SELECT * FROM batches WHERE status = 'open' ORDER BY created_at DESC`)
    .all() as BatchRow[];
}

export function listAllBatches(): BatchRow[] {
  return getDb()
    .prepare(`SELECT * FROM batches ORDER BY created_at DESC`)
    .all() as BatchRow[];
}

export function addAsset(input: {
  batchId: string;
  title: string;
  postUrl: string | null;
  previewUrl: string | null;
  mediaJson?: string;
}): AssetRow {
  const maxOrder = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM assets WHERE batch_id = ?`)
    .get(input.batchId) as { m: number };
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO assets (id, batch_id, sort_order, title, post_url, preview_url, media_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.batchId,
      maxOrder.m + 1,
      input.title,
      input.postUrl,
      input.previewUrl,
      input.mediaJson ?? "[]",
    );
  return getAsset(id)!;
}

export function setAssetSlackMessageTs(
  assetId: string,
  messageTs: string,
): void {
  getDb()
    .prepare(`UPDATE assets SET slack_message_ts = ? WHERE id = ?`)
    .run(messageTs, assetId);
}

export function setAssetMediaJson(assetId: string, mediaJson: string): void {
  getDb()
    .prepare(`UPDATE assets SET media_json = ? WHERE id = ?`)
    .run(mediaJson, assetId);
}

export function getAsset(id: string): AssetRow | undefined {
  return getDb().prepare(`SELECT * FROM assets WHERE id = ?`).get(id) as
    | AssetRow
    | undefined;
}

export function listAssets(batchId: string): AssetRow[] {
  return getDb()
    .prepare(`SELECT * FROM assets WHERE batch_id = ? ORDER BY sort_order ASC`)
    .all(batchId) as AssetRow[];
}

export function setBatchReviewers(batchId: string, userIds: string[]): void {
  const d = getDb();
  const del = d.prepare(`DELETE FROM batch_reviewers WHERE batch_id = ?`);
  const ins = d.prepare(
    `INSERT INTO batch_reviewers (batch_id, slack_user_id) VALUES (?, ?)`,
  );
  d.transaction(() => {
    del.run(batchId);
    for (const uid of userIds) {
      ins.run(batchId, uid);
    }
  })();
}

export function getBatchReviewers(batchId: string): string[] {
  const rows = getDb()
    .prepare(`SELECT slack_user_id FROM batch_reviewers WHERE batch_id = ?`)
    .all(batchId) as { slack_user_id: string }[];
  return rows.map((r) => r.slack_user_id);
}

export function setBatchPublished(
  batchId: string,
  kickoffMessageTs: string,
): void {
  getDb()
    .prepare(
      `UPDATE batches SET status = 'open', kickoff_message_ts = ? WHERE id = ?`,
    )
    .run(kickoffMessageTs, batchId);
}

export function closeBatch(batchId: string): void {
  getDb()
    .prepare(`UPDATE batches SET status = 'closed' WHERE id = ?`)
    .run(batchId);
}

export function getUserResponse(
  assetId: string,
  slackUserId: string,
): ResponseRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM responses WHERE asset_id = ? AND slack_user_id = ?`,
    )
    .get(assetId, slackUserId) as ResponseRow | undefined;
}

export function upsertResponse(input: {
  batchId: string;
  assetId: string;
  slackUserId: string;
  rating: number;
  feedback: string | null;
}): { updated: boolean } {
  const existing = getDb()
    .prepare(
      `SELECT id FROM responses WHERE asset_id = ? AND slack_user_id = ?`,
    )
    .get(input.assetId, input.slackUserId) as { id: string } | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE responses SET rating = ?, feedback = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(input.rating, input.feedback, existing.id);
    return { updated: true };
  }

  getDb()
    .prepare(
      `INSERT INTO responses (id, batch_id, asset_id, slack_user_id, rating, feedback)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.batchId,
      input.assetId,
      input.slackUserId,
      input.rating,
      input.feedback,
    );
  return { updated: false };
}

export function getNextUnratedAsset(
  batchId: string,
  slackUserId: string,
): AssetRow | undefined {
  return getDb()
    .prepare(
      `SELECT a.* FROM assets a
       LEFT JOIN responses r ON r.asset_id = a.id AND r.slack_user_id = ?
       WHERE a.batch_id = ? AND r.id IS NULL
       ORDER BY a.sort_order ASC
       LIMIT 1`,
    )
    .get(slackUserId, batchId) as AssetRow | undefined;
}

export function countAssets(batchId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM assets WHERE batch_id = ?`)
    .get(batchId) as { c: number };
  return row.c;
}

export function countUserResponses(batchId: string, slackUserId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM responses WHERE batch_id = ? AND slack_user_id = ?`,
    )
    .get(batchId, slackUserId) as { c: number };
  return row.c;
}

export function countDistinctReviewers(batchId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT COALESCE(NULLIF(trim(reviewer_name), ''), slack_user_id)) AS c
       FROM responses WHERE batch_id = ?`,
    )
    .get(batchId) as { c: number };
  return row.c;
}

export function listResponsesForBatch(batchId: string): ResponseRow[] {
  return getDb()
    .prepare(`SELECT * FROM responses WHERE batch_id = ? ORDER BY updated_at DESC`)
    .all(batchId) as ResponseRow[];
}

export function countInvitedReviewers(batchId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM batch_reviewers WHERE batch_id = ?`)
    .get(batchId) as { c: number };
  return row.c;
}

export function deleteAsset(assetId: string): boolean {
  const r = getDb()
    .prepare(`DELETE FROM assets WHERE id = ?`)
    .run(assetId);
  return r.changes > 0;
}

export function deleteBatch(batchId: string): boolean {
  const r = getDb()
    .prepare(`DELETE FROM batches WHERE id = ?`)
    .run(batchId);
  return r.changes > 0;
}
