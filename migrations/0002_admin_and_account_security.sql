ALTER TABLE profiles ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS profiles_admin_idx ON profiles(is_admin);
