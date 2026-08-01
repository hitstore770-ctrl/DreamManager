import { useEffect, useRef } from "react";
import { deriveTitle, snapshotVersion } from "../db/notesRepo";

// The Time Machine's silent background hook: every `intervalMs` (default
// 60s), if the note actually changed since the last snapshot, write one to
// the `versions` table. Skips the tick entirely when nothing changed, so an
// open-but-idle note doesn't pile up identical snapshots.
export function useAutoVersion(db, noteId, bodyRef, ready, intervalMs = 60000) {
  const lastSnapshotRef = useRef(null);

  useEffect(() => {
    lastSnapshotRef.current = ready ? bodyRef.current : null;
    // Reset the baseline whenever the pane loads a different note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, ready]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!ready) return;
      const current = bodyRef.current;
      if (lastSnapshotRef.current !== null && current !== lastSnapshotRef.current) {
        snapshotVersion(db, noteId, deriveTitle(current), current);
      }
      lastSnapshotRef.current = current;
    }, intervalMs);
    return () => clearInterval(id);
  }, [db, noteId, ready, intervalMs, bodyRef]);
}
