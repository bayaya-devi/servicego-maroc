ALTER TABLE profiles ADD COLUMN first_name TEXT;
ALTER TABLE profiles ADD COLUMN last_name TEXT;
ALTER TABLE profiles ADD COLUMN cover_url TEXT;
ALTER TABLE profiles ADD COLUMN dashboard_prefs TEXT NOT NULL DEFAULT '{"activity":true,"exchanges":true,"tracking":true}';

ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'image', 'video', 'audio', 'location'));
ALTER TABLE messages ADD COLUMN media_key TEXT;
ALTER TABLE messages ADD COLUMN media_mime TEXT;
ALTER TABLE messages ADD COLUMN latitude REAL;
ALTER TABLE messages ADD COLUMN longitude REAL;

ALTER TABLE service_requests ADD COLUMN completed_at TEXT;

CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  publish_after TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (request_id, reviewer_id),
  CHECK (reviewer_id <> reviewed_id)
);
CREATE INDEX IF NOT EXISTS reviews_reviewed_idx ON reviews(reviewed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_request_idx ON reviews(request_id);

UPDATE profiles
SET first_name = CASE
      WHEN instr(trim(full_name), ' ') > 0 THEN substr(trim(full_name), 1, instr(trim(full_name), ' ') - 1)
      ELSE trim(full_name)
    END,
    last_name = CASE
      WHEN instr(trim(full_name), ' ') > 0 THEN substr(trim(full_name), instr(trim(full_name), ' ') + 1)
      ELSE ''
    END
WHERE first_name IS NULL;
