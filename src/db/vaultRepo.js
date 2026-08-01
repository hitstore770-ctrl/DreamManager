// Vault-specific reads/writes. Kept separate from notesRepo.js because every
// function here deals in ciphertext, not plaintext -- mixing them into the
// regular repo would make it too easy to accidentally write plaintext to a
// vault row (or vice versa).
import { uid, deriveTitle } from "./notesRepo";
import { extractTags, tagRoot } from "../lib/tags";
import { encryptText, VAULT_VERIFIER_PLAINTEXT } from "../lib/crypto";

const LOCKED_TITLE = "🔒 Locked note";

export async function getVerifier(db) {
  return db.getFirstAsync(`SELECT cipher, iv, mac FROM vault_meta WHERE id = 1`);
}

export async function setVerifier(db, keyBytes) {
  const { cipherHex, ivHex, mac } = await encryptText(VAULT_VERIFIER_PLAINTEXT, keyBytes);
  await db.runAsync(
    `INSERT INTO vault_meta (id, cipher, iv, mac) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET cipher = excluded.cipher, iv = excluded.iv, mac = excluded.mac`,
    [cipherHex, ivHex, mac]
  );
}

export async function listVaultNotes(db) {
  const rows = await db.getAllAsync(`SELECT * FROM notes WHERE vault = 1 ORDER BY updated_at DESC`);
  return rows.map((r) => ({ ...r, pinned: !!r.pinned, vault: true, tags: [] }));
}

export async function createVaultNote(db, keyBytes) {
  const id = uid();
  const now = Date.now();
  const { cipherHex, ivHex, mac } = await encryptText("", keyBytes);
  await db.runAsync(
    `INSERT INTO notes (id, title, body, pinned, color, vault, iv, mac, created_at, updated_at)
     VALUES (?, ?, ?, 0, NULL, 1, ?, ?, ?, ?)`,
    [id, LOCKED_TITLE, cipherHex, ivHex, mac, now, now]
  );
  return id;
}

// Encrypts `plainBody` and overwrites the note in place. Tags are never
// synced for vault notes -- their content is private, so it shouldn't leak
// into the (plaintext) tag index either.
export async function saveVaultNoteBody(db, id, plainBody, keyBytes) {
  const { cipherHex, ivHex, mac } = await encryptText(plainBody, keyBytes);
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE notes SET title = ?, body = ?, iv = ?, mac = ?, updated_at = ? WHERE id = ?`, [
      LOCKED_TITLE,
      cipherHex,
      ivHex,
      mac,
      Date.now(),
      id,
    ]);
    await db.runAsync(`DELETE FROM note_tags WHERE note_id = ?`, [id]);
  });
}

// Moves a note out of the vault: stores the plaintext, re-derives a real
// title, and re-syncs tags now that the content is no longer private.
export async function moveOutOfVault(db, id, plainBody) {
  const title = deriveTitle(plainBody);
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE notes SET title = ?, body = ?, iv = NULL, mac = NULL, vault = 0, updated_at = ? WHERE id = ?`, [
      title,
      plainBody,
      now,
      id,
    ]);
    await db.runAsync(`DELETE FROM note_tags WHERE note_id = ?`, [id]);
    for (const path of extractTags(plainBody)) {
      await db.runAsync(`INSERT OR IGNORE INTO tags (path, root) VALUES (?, ?)`, [path, tagRoot(path)]);
      const tagRow = await db.getFirstAsync(`SELECT id FROM tags WHERE path = ?`, [path]);
      await db.runAsync(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`, [id, tagRow.id]);
    }
  });
}

// Moves an existing plaintext note into the vault: encrypts its current
// body, scrubs the plaintext title and any tag links.
export async function moveIntoVault(db, id, plainBody, keyBytes) {
  const { cipherHex, ivHex, mac } = await encryptText(plainBody, keyBytes);
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE notes SET title = ?, body = ?, iv = ?, mac = ?, vault = 1, updated_at = ? WHERE id = ?`, [
      LOCKED_TITLE,
      cipherHex,
      ivHex,
      mac,
      Date.now(),
      id,
    ]);
    await db.runAsync(`DELETE FROM note_tags WHERE note_id = ?`, [id]);
  });
}

export async function deleteVaultNote(db, id) {
  await db.runAsync(`DELETE FROM notes WHERE id = ?`, [id]);
}
