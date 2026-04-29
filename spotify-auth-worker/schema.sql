CREATE TABLE IF NOT EXISTS pairings (
  pairing_code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  client_id TEXT,
  spotify_user_id TEXT,
  refresh_token_enc TEXT,
  session_token_hash TEXT,
  session_expires_at INTEGER,
  session_claimed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  pairing_code TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pairings_expires_at ON pairings(expires_at);
CREATE INDEX IF NOT EXISTS idx_pairings_session_token_hash ON pairings(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);
