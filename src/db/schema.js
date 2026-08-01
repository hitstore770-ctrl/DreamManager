// Core local schema. Everything the app stores lives in these tables —
// there is no server, so this file *is* the data model.
export const DATABASE_NAME = "second_brain.db";

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  root TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

-- A single row (id = 1) holding an AES-encrypted "verifier" string. Unlocking
-- the Vault means: derive a key from the entered PIN and check it decrypts
-- this row back to the known plaintext -- see src/lib/crypto.js.
CREATE TABLE IF NOT EXISTS vault_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cipher TEXT NOT NULL,
  iv TEXT NOT NULL,
  mac TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_versions_note ON versions(note_id, created_at);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);
`;

// Columns added after the first release. CREATE TABLE IF NOT EXISTS can't
// retrofit these onto a `notes` table that already exists from an earlier
// install, and SQLite has no "ADD COLUMN IF NOT EXISTS" -- so each one is
// applied by hand, guarded by a check against the live table_info.
const NOTES_COLUMNS = [
  { name: "vault", ddl: "ALTER TABLE notes ADD COLUMN vault INTEGER NOT NULL DEFAULT 0" },
  { name: "iv", ddl: "ALTER TABLE notes ADD COLUMN iv TEXT" },
  { name: "mac", ddl: "ALTER TABLE notes ADD COLUMN mac TEXT" },
];

async function ensureNotesColumns(db) {
  const existing = await db.getAllAsync(`PRAGMA table_info(notes)`);
  const names = new Set(existing.map((c) => c.name));
  for (const col of NOTES_COLUMNS) {
    if (!names.has(col.name)) await db.execAsync(col.ddl);
  }
}

export async function migrate(db) {
  await db.execAsync(SCHEMA_SQL);
  await ensureNotesColumns(db);
}
