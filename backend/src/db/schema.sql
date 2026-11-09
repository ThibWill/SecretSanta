CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL UNIQUE,          -- nom affiché, ex. "Océane"
  login           TEXT    NOT NULL UNIQUE,          -- nom normalisé, ex. "oceane"
  password_hash   TEXT    NOT NULL,
  is_admin        INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  is_participant  INTEGER NOT NULL DEFAULT 1 CHECK (is_participant IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Exclusions symétriques : une seule ligne par paire, avec user_a_id < user_b_id.
CREATE TABLE IF NOT EXISTS exclusions (
  user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

-- Table des tirages : une ligne = "giver offre un cadeau à receiver".
-- C'est cette table qui retient qui a déjà été tiré, et combien de fois.
CREATE TABLE IF NOT EXISTS draws (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  giver_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (giver_id, receiver_id),
  CHECK (giver_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_draws_receiver ON draws(receiver_id);

CREATE TABLE IF NOT EXISTS letters (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
