import { useEffect, useRef, useState } from "react";
import { saveNoteBody } from "../db/notesRepo";

// Saves `body` to SQLite `delay`ms after typing stops, and flushes whatever
// is pending the moment the pane switches to a different note or unmounts —
// so navigating away mid-sentence never drops the last few keystrokes.
export function useDebouncedAutosave(db, noteId, body, ready, delay = 600) {
  const [savedAt, setSavedAt] = useState(null);
  const bodyRef = useRef(body);
  const readyRef = useRef(ready);
  const timerRef = useRef(null);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await saveNoteBody(db, noteId, bodyRef.current);
      setSavedAt(Date.now());
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [body, ready, db, noteId, delay]);

  useEffect(() => {
    return () => {
      if (readyRef.current) saveNoteBody(db, noteId, bodyRef.current);
    };
    // Only re-arm this flush-on-leave when the note identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  return { savedAt, bodyRef };
}
