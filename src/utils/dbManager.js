import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";
import { withTimeout } from "./network";

// Firestore CRUD for the app's per-user data.
//
// Everything lives under users/{uid}/... so one security rule covers the whole
// tree and no query can reach another account's documents:
//
//   match /users/{uid}/{document=**} {
//     allow read, write: if request.auth != null && request.auth.uid == uid;
//   }
//
// Every call is wrapped in withTimeout so a dead network surfaces as a
// rejected promise in a few seconds instead of hanging the UI forever.

export const COLLECTIONS = {
  sales: "sales",
  inventory: "inventory",
  debts: "debts",
  notes: "notes",
  dreams: "dreams",
  closes: "closes",
  promos: "promos",
};

export function currentUid() {
  return auth.currentUser?.uid || null;
}

// users/{uid}/{name}
function userCollection(name, uid = currentUid()) {
  if (!uid) throw new Error("not-signed-in");
  return collection(db, "users", uid, name);
}

function userDoc(name, id, uid = currentUid()) {
  if (!uid) throw new Error("not-signed-in");
  return doc(db, "users", uid, name, id);
}

// --- Create --------------------------------------------------------------
// Returns the new document id. Pass an `id` to control it (useful when the
// record already has a local id and you want the two to line up).
export async function createDoc(name, data, id = null) {
  const stamped = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (id) {
    await withTimeout(setDoc(userDoc(name, id), stamped));
    return id;
  }
  const ref = await withTimeout(addDoc(userCollection(name), stamped));
  return ref.id;
}

// --- Read ----------------------------------------------------------------
export async function readDoc(name, id) {
  const snap = await withTimeout(getDoc(userDoc(name, id)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// `filters` is a list of [field, op, value] tuples, e.g. [["day", "==", "2026-07-26"]].
export async function listDocs(name, { filters = [], sortBy = null, direction = "asc" } = {}) {
  const parts = filters.map(([field, op, value]) => where(field, op, value));
  if (sortBy) parts.push(orderBy(sortBy, direction));
  const q = parts.length ? query(userCollection(name), ...parts) : userCollection(name);
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// --- Update / delete -----------------------------------------------------
export async function updateDocFields(name, id, fields) {
  await withTimeout(updateDoc(userDoc(name, id), { ...fields, updatedAt: serverTimestamp() }));
}

// Create-or-merge, for records that may not exist yet.
export async function upsertDoc(name, id, fields) {
  await withTimeout(setDoc(userDoc(name, id), { ...fields, updatedAt: serverTimestamp() }, { merge: true }));
}

export async function removeDoc(name, id) {
  await withTimeout(deleteDoc(userDoc(name, id)));
}

// --- Live subscription ---------------------------------------------------
// Not wrapped in withTimeout: this stays open and re-fires on every change.
// Returns the unsubscribe function.
export function watchCollection(name, onChange, onError) {
  try {
    return onSnapshot(
      userCollection(name),
      (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => onError?.(err)
    );
  } catch (err) {
    onError?.(err);
    return () => {};
  }
}

// --- Bulk sync -----------------------------------------------------------
// Mirrors a local array into a collection. Used by the Settings backup switch
// and by the first sign-in on a device that already holds local data.
export async function pushAll(name, rows, idKey = "id") {
  const results = await Promise.allSettled(
    (rows || []).map((row) => upsertDoc(name, String(row[idKey]), row))
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  return { total: rows?.length || 0, failed };
}
