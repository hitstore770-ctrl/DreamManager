import { createContext, useContext, useMemo } from "react";

import { NOTES_KEY } from "../utils/notesStore";
import { usePersistentState } from "../utils/usePersistentState";

// Single shared source of truth for Pro Notes. Both the hub (which stays
// mounted as a drawer screen) and the editor (a stack screen on top) read the
// same in-memory array, so edits appear instantly on return and persist once.
const NotesContext = createContext(undefined);

export function NotesProvider({ children }) {
  const [notes, setNotes, loaded] = usePersistentState(NOTES_KEY, []);
  const value = useMemo(() => ({ notes, setNotes, loaded }), [notes, loaded]);
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (ctx === undefined) throw new Error("useNotes must be used within a NotesProvider");
  return ctx;
}
