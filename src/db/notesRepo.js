// All reads/writes go through here — screens never write raw SQL. Every
// function takes the `db` handle from useSQLiteContext() as its first arg.
import { extractTags, tagRoot } from "../lib/tags";
import { parseBlocks, toggleChecklistLine } from "../lib/markdown";
import { extractQuestions } from "../lib/exam";
import { serialTransaction } from "./txQueue";

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// The list/card title is never typed directly — it's the note's first
// non-empty line, stripped of the markdown marker that starts it.
export function deriveTitle(body) {
  const line = (body || "").split("\n").find((l) => l.trim().length > 0);
  if (!line) return "";
  return line
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*]\s*\[[ xX]\]\s*/, "")
    .replace(/^>\s*/, "")
    .replace(/^[-*]\s+/, "")
    .slice(0, 120);
}

function mapNoteRow(row) {
  return { ...row, pinned: !!row.pinned, vault: !!row.vault, archived: !!row.archived, tags: [] };
}

async function attachTags(db, notes) {
  if (!notes.length) return notes;
  const placeholders = notes.map(() => "?").join(",");
  const rows = await db.getAllAsync(
    `SELECT nt.note_id as noteId, t.path as path
       FROM note_tags nt JOIN tags t ON t.id = nt.tag_id
      WHERE nt.note_id IN (${placeholders})`,
    notes.map((n) => n.id)
  );
  const byNote = {};
  for (const r of rows) (byNote[r.noteId] ||= []).push(r.path);
  return notes.map((n) => ({ ...n, tags: byNote[n.id] || [] }));
}

// Insert/relink the tag rows for a note to exactly match `tagPaths`, and
// sweep any tag left with zero notes so the Tag Index never shows dead
// folders. Cheap at note-app scale — simplest correct approach beats a diff.
async function syncTags(db, noteId, tagPaths) {
  await db.runAsync(`DELETE FROM note_tags WHERE note_id = ?`, [noteId]);
  for (const path of tagPaths) {
    await db.runAsync(`INSERT OR IGNORE INTO tags (path, root) VALUES (?, ?)`, [path, tagRoot(path)]);
    const tagRow = await db.getFirstAsync(`SELECT id FROM tags WHERE path = ?`, [path]);
    await db.runAsync(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`, [noteId, tagRow.id]);
  }
  await db.runAsync(`DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)`);
}

// Vault notes are a separate category (see src/screens/VaultScreen.js) --
// their body is ciphertext and their title is a placeholder, so they never
// belong in the regular list, search, or tag results. Archived notes are
// hidden from the main list the same way -- see listArchivedNotes below.
export async function listNotes(db, { query = "", tagPath = null } = {}) {
  const clauses = ["n.vault = 0", "n.archived = 0"];
  const params = [];
  let sql = `SELECT DISTINCT n.* FROM notes n`;
  if (tagPath) {
    sql += ` JOIN note_tags nt ON nt.note_id = n.id JOIN tags t ON t.id = nt.tag_id`;
    clauses.push(`(t.path = ? OR t.path LIKE ?)`);
    params.push(tagPath, `${tagPath}/%`);
  }
  const q = query.trim();
  if (q) {
    clauses.push(`(n.title LIKE ? OR n.body LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
  sql += ` ORDER BY n.pinned DESC, n.updated_at DESC`;
  const rows = await db.getAllAsync(sql, params);
  return attachTags(db, rows.map(mapNoteRow));
}

export async function getNote(db, id) {
  const row = await db.getFirstAsync(`SELECT * FROM notes WHERE id = ?`, [id]);
  if (!row) return null;
  const [withTags] = await attachTags(db, [mapNoteRow(row)]);
  return withTags;
}

export async function createNote(db, body = "") {
  const id = uid();
  const now = Date.now();
  const title = deriveTitle(body);
  await db.runAsync(
    `INSERT INTO notes (id, title, body, pinned, color, created_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?, ?)`,
    [id, title, body, now, now]
  );
  await syncTags(db, id, extractTags(body));
  return getNote(db, id);
}

// Persist an edit: re-derives the title and re-syncs #tags from `body` in
// the same transaction as the row update, so the two never drift apart.
export async function saveNoteBody(db, id, body) {
  const title = deriveTitle(body);
  const now = Date.now();
  await serialTransaction(db, async () => {
    await db.runAsync(`UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`, [title, body, now, id]);
    await syncTags(db, id, extractTags(body));
  });
}

// The Global Inbox: every unchecked "- [ ]" line across every regular
// note, newest-note-first. Vault notes are skipped (their body is
// ciphertext -- reading it here would need the key, which isn't always
// unlocked) and archived notes are skipped too, matching listNotes'
// default view -- archiving a note is "get it out of my way," and that
// should include its open tasks.
export async function listUncheckedTasks(db) {
  const rows = await db.getAllAsync(`SELECT id, title, body FROM notes WHERE vault = 0 AND archived = 0 ORDER BY updated_at DESC`);
  const tasks = [];
  for (const row of rows) {
    for (const block of parseBlocks(row.body)) {
      if (block.type === "checklist" && !block.checked) {
        tasks.push({ noteId: row.id, noteTitle: row.title || "Untitled", lineIndex: block.lineIndex, text: block.text });
      }
    }
  }
  return tasks;
}

// Flips one checklist line by re-reading the note's *current* body first --
// the Inbox's list is a snapshot, and the note may have been edited
// elsewhere since it was taken.
export async function toggleTaskInNote(db, noteId, lineIndex) {
  const row = await db.getFirstAsync(`SELECT body FROM notes WHERE id = ?`, [noteId]);
  if (!row) return;
  await saveNoteBody(db, noteId, toggleChecklistLine(row.body, lineIndex));
}

// The Exam Simulator's question bank: every #questions-tagged note's
// checklist groups, flattened across notes. See src/lib/exam.js for how a
// group of checklist lines becomes one question.
export async function listExamQuestions(db) {
  const rows = await db.getAllAsync(
    `SELECT DISTINCT n.id, n.title, n.body
       FROM notes n
       JOIN note_tags nt ON nt.note_id = n.id
       JOIN tags t ON t.id = nt.tag_id
      WHERE n.vault = 0 AND n.archived = 0 AND (t.path = 'questions' OR t.path LIKE 'questions/%')`
  );
  const questions = [];
  for (const row of rows) {
    for (const q of extractQuestions(row.body)) {
      questions.push({ ...q, noteId: row.id, noteTitle: row.title || "Untitled" });
    }
  }
  return questions;
}

export async function setPinned(db, id, pinned) {
  await db.runAsync(`UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?`, [pinned ? 1 : 0, Date.now(), id]);
}

// Archiving is a soft-delete: the row (and its tags/version history) stays
// intact, it just drops out of listNotes' default view until restored.
export async function setArchived(db, id, archived) {
  await db.runAsync(`UPDATE notes SET archived = ?, updated_at = ? WHERE id = ?`, [archived ? 1 : 0, Date.now(), id]);
}

export async function listArchivedNotes(db) {
  const rows = await db.getAllAsync(`SELECT * FROM notes WHERE vault = 0 AND archived = 1 ORDER BY updated_at DESC`);
  return attachTags(db, rows.map(mapNoteRow));
}

export async function setColor(db, id, color) {
  await db.runAsync(`UPDATE notes SET color = ?, updated_at = ? WHERE id = ?`, [color, Date.now(), id]);
}

export async function deleteNote(db, id) {
  await db.runAsync(`DELETE FROM notes WHERE id = ?`, [id]);
}

// ---- Tags ------------------------------------------------------------
export async function listTagsWithCounts(db) {
  return db.getAllAsync(
    `SELECT t.path as path, COUNT(nt.note_id) as count
       FROM tags t LEFT JOIN note_tags nt ON nt.tag_id = t.id
      GROUP BY t.id ORDER BY t.path`
  );
}

// ---- Time Machine (versions) ------------------------------------------
export async function snapshotVersion(db, noteId, title, body) {
  await db.runAsync(`INSERT INTO versions (note_id, title, body, created_at) VALUES (?, ?, ?, ?)`, [
    noteId,
    title,
    body,
    Date.now(),
  ]);
}

export async function listVersions(db, noteId) {
  return db.getAllAsync(`SELECT * FROM versions WHERE note_id = ? ORDER BY created_at ASC`, [noteId]);
}

// Snapshots the note's current state first (so restoring never destroys the
// text that was on screen), then overwrites the note with the chosen
// version's content.
export async function restoreVersion(db, noteId, version, currentTitle, currentBody) {
  await serialTransaction(db, async () => {
    await db.runAsync(`INSERT INTO versions (note_id, title, body, created_at) VALUES (?, ?, ?, ?)`, [
      noteId,
      currentTitle,
      currentBody,
      Date.now(),
    ]);
    await db.runAsync(`UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`, [
      deriveTitle(version.body),
      version.body,
      Date.now(),
      noteId,
    ]);
    await syncTags(db, noteId, extractTags(version.body));
  });
  return getNote(db, noteId);
}
