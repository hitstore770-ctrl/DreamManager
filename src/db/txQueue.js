// expo-sqlite's withTransactionAsync isn't safe to call concurrently on the
// same connection -- overlapping BEGINs throw "cannot start a transaction
// within a transaction" and the losing write silently never lands. Autosave's
// debounce timer, its unmount-flush, EditorScreen's pre-nav flush, and the
// Time Machine's background snapshot can all try to write the same note
// around the same moment, so every transactional write goes through this
// single per-db queue to force them to run one at a time, in order.
const queues = new WeakMap();

export function serialTransaction(db, fn) {
  const prevSettled = (queues.get(db) || Promise.resolve()).catch(() => {});
  const run = prevSettled.then(() => db.withTransactionAsync(fn));
  queues.set(db, run);
  return run;
}
