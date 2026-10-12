CREATE TABLE IF NOT EXISTS askagent_state (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
