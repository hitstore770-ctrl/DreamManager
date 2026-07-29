import { useEffect, useRef } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";

import { db, isFirebaseConfigured } from "../config/firebaseConfig";
import { readPersistent, writePersistent } from "./usePersistentState";

// Mirroring local collections to Firestore, under users/{uid}/…
//
// LOCAL-FIRST, NOT CLOUD-FIRST
// ----------------------------
// The direction matters more than anything else in this file. AsyncStorage is
// the source of truth the UI renders; Firestore is a mirror. Every write goes
// to disk first and to the network whenever the network happens to be there.
//
// That is what makes offline work — not a Firestore setting. The Firebase JS
// SDK has no persistent cache on React Native (no IndexedDB), so a cloud-first
// design would leave the register unable to ring up a sale on a bus with no
// signal. Local-first means nothing on the critical path was waiting for the
// network to begin with, and the queue drains later.
//
// CONFLICTS
// ---------
// Last-write-wins per document, on an `updatedAt` the app stamps itself —
// not on serverTimestamp(), which is null on a locally-queued write and would
// make every offline edit lose to whatever the server already had.
//
// Deletions are the one thing this cannot do safely both ways. "A document is
// missing locally" and "a document was deleted on another device" look
// identical, and guessing wrong destroys data. So a *local* delete propagates
// (the app knows it happened), and a document present in the cloud but absent
// locally is treated as something to pull down, never as a delete to replay.
// The cost is that a note deleted on the phone while the tablet is offline can
// come back when the tablet syncs. Undeleting a note is a nuisance; silently
// deleting one the user still wanted is not recoverable.

const MAX_BATCH = 400; // Firestore's limit is 500 writes per batch.

// Document ids the app owns rather than the user: rolled-up figures that live
// alongside the rows they were computed from. A leading underscore marks them,
// and both directions of sync skip them — they are written by pushSummary and
// read by nothing in the app.
const isReserved = (id) => String(id || "").startsWith("_");

export function userCollection(uid, name) {
  return collection(db, "users", uid, name);
}

const stamp = (row) => Number(row?.updatedAt || row?.at || row?.ts || 0);

/**
 * Merge a remote set into a local one, newest wins per id.
 *
 * Returns null when nothing changed, so the caller can skip a write and avoid
 * a snapshot → write → snapshot loop.
 */
export function mergeById(local, remote, idOf) {
  const byId = new Map();
  local.forEach((row) => byId.set(idOf(row), row));

  let changed = false;
  remote.forEach((row) => {
    const id = idOf(row);
    const mine = byId.get(id);
    if (!mine) {
      byId.set(id, row);
      changed = true;
      return;
    }
    if (stamp(row) > stamp(mine)) {
      byId.set(id, row);
      changed = true;
    }
  });

  if (!changed) return null;
  return [...byId.values()];
}

// Strip the fields Firestore cannot store. `undefined` throws on write, and
// functions/symbols never belong in a document.
function clean(row) {
  const out = {};
  Object.entries(row || {}).forEach(([k, v]) => {
    if (v === undefined || typeof v === "function") return;
    out[k] = v;
  });
  return out;
}

/**
 * Keep one AsyncStorage-backed array in step with one Firestore collection.
 *
 * `storageKey` is written directly rather than through a setter, so a snapshot
 * reaches screens that are already mounted — see writePersistent.
 */
export function useCloudCollection({ uid, name, storageKey, idOf = (r) => r.id, enabled = true }) {
  // What the cloud last told us. Diffing against this is what stops the
  // listener's own echo from being pushed straight back up.
  const remoteRef = useRef(new Map());
  const readyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !uid || !isFirebaseConfigured) return undefined;

    readyRef.current = false;
    remoteRef.current = new Map();

    const unsub = onSnapshot(
      userCollection(uid, name),
      async (snap) => {
        const remote = [];
        const seen = new Map();
        snap.forEach((d) => {
          // Rolled-up documents share the collection with the rows they
          // summarise, so they have to be skipped here or the listener pulls
          // the totals back down and merges them into the log as a phantom
          // transaction — one that then feeds into the next total.
          if (isReserved(d.id)) return;
          const data = { ...d.data(), id: d.id };
          remote.push(data);
          seen.set(d.id, stamp(data));
        });
        remoteRef.current = seen;

        const local = (await readPersistent(storageKey, [])) || [];
        const merged = mergeById(Array.isArray(local) ? local : [], remote, idOf);
        if (merged) await writePersistent(storageKey, merged);

        readyRef.current = true;

        // First snapshot doubles as the initial upload: anything local that
        // the cloud has never seen goes up now. This is what carries the data
        // a user accumulated before they were ever online.
        const source = merged || local;
        await pushMissing(uid, name, source, idOf, seen);
      },
      () => {
        // Offline, or rules rejected the read. Neither is fatal: the app runs
        // on local state and the listener retries on its own.
        readyRef.current = false;
      }
    );

    return unsub;
  }, [uid, name, storageKey, enabled, idOf]);

  return remoteRef;
}

async function pushMissing(uid, name, rows, idOf, seen) {
  const pending = (rows || []).filter((row) => {
    const id = idOf(row);
    if (!id || isReserved(id)) return false;
    const known = seen.get(id);
    return known === undefined || stamp(row) > known;
  });
  if (!pending.length) return;

  for (let i = 0; i < pending.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    pending.slice(i, i + MAX_BATCH).forEach((row) => {
      batch.set(doc(db, "users", uid, name, String(idOf(row))), clean(row), { merge: true });
    });
    // Not awaited for the network — offline, the write sits in Firestore's
    // queue and this promise settles once it is persisted locally by the SDK.
    // Failure here is not worth surfacing: local state already has the data.
    await batch.commit().catch(() => {});
  }
}

/**
 * Push one document. Used at the moment something is created — a completed
 * sale — so it does not wait for the next reconciliation pass.
 */
export async function pushDoc(uid, name, row, idOf = (r) => r.id) {
  if (!uid || !isFirebaseConfigured || !row) return false;
  const id = idOf(row);
  if (!id) return false;
  try {
    await setDoc(doc(db, "users", uid, name, String(id)), clean(row), { merge: true });
    return true;
  } catch {
    return false;
  }
}

export async function pushMany(uid, name, rows, idOf = (r) => r.id) {
  if (!uid || !isFirebaseConfigured || !rows?.length) return false;
  try {
    for (let i = 0; i < rows.length; i += MAX_BATCH) {
      const batch = writeBatch(db);
      rows.slice(i, i + MAX_BATCH).forEach((row) => {
        const id = idOf(row);
        if (id) batch.set(doc(db, "users", uid, name, String(id)), clean(row), { merge: true });
      });
      await batch.commit();
    }
    return true;
  } catch {
    return false;
  }
}

export async function removeDoc(uid, name, id) {
  if (!uid || !isFirebaseConfigured || !id) return false;
  try {
    await deleteDoc(doc(db, "users", uid, name, String(id)));
    return true;
  } catch {
    return false;
  }
}

/**
 * A single document, for rolled-up figures rather than a collection.
 *
 * The dashboard's totals are derived from the logs and never read back, so
 * this exists to make the numbers queryable from outside the app — a
 * spreadsheet, a future web view — not to feed the screen.
 */
export async function pushSummary(uid, name, id, data) {
  if (!uid || !isFirebaseConfigured) return false;
  try {
    await setDoc(doc(db, "users", uid, name, id), { ...clean(data), updatedAt: Date.now() }, { merge: true });
    return true;
  } catch {
    return false;
  }
}
