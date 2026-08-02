// Tiny key/value wrapper over the `settings` table -- every value is
// stored as a string, callers coerce (JSON.parse for numbers/objects) as
// needed.
export async function getSetting(db, key, fallback = null) {
  const row = await db.getFirstAsync(`SELECT value FROM settings WHERE key = ?`, [key]);
  return row ? row.value : fallback;
}

export async function setSetting(db, key, value) {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
}

export async function getAllSettings(db) {
  const rows = await db.getAllAsync(`SELECT key, value FROM settings`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
