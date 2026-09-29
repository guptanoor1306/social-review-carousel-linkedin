CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  channel_id TEXT,
  created_by TEXT NOT NULL,
  due_at TEXT,
  kickoff_message_ts TEXT,
  review_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  post_url TEXT,
  preview_url TEXT,
  media_json TEXT NOT NULL DEFAULT '[]',
  slack_message_ts TEXT
);

CREATE INDEX IF NOT EXISTS idx_assets_batch ON assets(batch_id);

CREATE TABLE IF NOT EXISTS batch_reviewers (
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  slack_user_id TEXT NOT NULL,
  PRIMARY KEY (batch_id, slack_user_id)
);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  slack_user_id TEXT,
  reviewer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_responses_batch ON responses(batch_id);
CREATE INDEX IF NOT EXISTS idx_responses_asset_user ON responses(asset_id, slack_user_id);
