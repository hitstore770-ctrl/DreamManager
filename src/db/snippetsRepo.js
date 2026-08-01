import { uid } from "./notesRepo";

export async function listSnippets(db) {
  return db.getAllAsync(`SELECT * FROM snippets ORDER BY created_at DESC`);
}

export async function createSnippet(db, name, body, lang = null) {
  const id = uid();
  await db.runAsync(`INSERT INTO snippets (id, name, body, lang, created_at) VALUES (?, ?, ?, ?, ?)`, [
    id,
    name.trim() || "Untitled snippet",
    body,
    lang,
    Date.now(),
  ]);
  return id;
}

export async function deleteSnippet(db, id) {
  await db.runAsync(`DELETE FROM snippets WHERE id = ?`, [id]);
}
