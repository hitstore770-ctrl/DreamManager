import { uid } from "./notesRepo";

export async function listTemplates(db) {
  return db.getAllAsync(`SELECT * FROM templates ORDER BY created_at DESC`);
}

export async function createTemplate(db, name, body) {
  const id = uid();
  await db.runAsync(`INSERT INTO templates (id, name, body, created_at) VALUES (?, ?, ?, ?)`, [
    id,
    name.trim() || "Untitled template",
    body,
    Date.now(),
  ]);
  return id;
}

export async function deleteTemplate(db, id) {
  await db.runAsync(`DELETE FROM templates WHERE id = ?`, [id]);
}
