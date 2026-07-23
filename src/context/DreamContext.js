import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { db, isFirebaseConfigured } from "../config/firebaseConfig";
import { withTimeout } from "../utils/network";
import { useAuth } from "./AuthContext";

const DreamContext = createContext(undefined);

const INITIAL_DREAMS = [
  {
    id: "1",
    title: "רחפן DJI חדש",
    type: "money",
    current: 1500,
    target: 5000,
    imageUri: null,
    tasks: [],
    notes: [],
  },
  {
    id: "2",
    title: "שליטה בתוכנת DaVinci Resolve",
    type: "knowledge",
    current: 20,
    target: 100,
    imageUri: null,
    tasks: [],
    notes: [],
  },
];

export function DreamProvider({ children }) {
  const { user, addCoins } = useAuth();
  const [dreams, setDreams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reference to the signed-in user's dreams subcollection: users/{uid}/dreams
  const dreamsCollection = () => collection(db, "users", user.uid, "dreams");
  const dreamDoc = (id) => doc(db, "users", user.uid, "dreams", id);

  // Load this user's dreams from Firestore whenever they sign in.
  useEffect(() => {
    if (!user) {
      setDreams([]);
      return undefined;
    }

    // Firebase not configured yet → run on in-memory defaults, no spinner.
    if (!isFirebaseConfigured) {
      setDreams(INITIAL_DREAMS);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const snapshot = await withTimeout(getDocs(dreamsCollection()));
        if (cancelled) return;
        if (snapshot.empty) {
          // First run for this user — seed their cloud collection.
          await Promise.all(
            INITIAL_DREAMS.map((dream) => setDoc(dreamDoc(dream.id), dream))
          );
          setDreams(INITIAL_DREAMS);
        } else {
          setDreams(snapshot.docs.map((snap) => snap.data()));
        }
      } catch (err) {
        // Cloud unreachable — fall back to defaults so the app still works.
        if (!cancelled) {
          setDreams(INITIAL_DREAMS);
          setError("שגיאה בטעינת הנתונים מהענן. מוצגים נתוני ברירת מחדל.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Best-effort write of a single dream document to Firestore.
  const syncDream = async (dream) => {
    if (!user || !isFirebaseConfigured) return;
    try {
      await setDoc(dreamDoc(dream.id), dream);
    } catch {
      // Local state remains authoritative if the cloud write fails.
    }
  };

  const patchDream = async (id, fields) => {
    if (!user || !isFirebaseConfigured) return;
    try {
      await updateDoc(dreamDoc(id), fields);
    } catch {
      // Ignore — local state already updated.
    }
  };

  const addDream = ({ title, type, target }) => {
    const newDream = {
      id: Date.now().toString(),
      title,
      type,
      current: 0,
      target,
      imageUri: null,
      tasks: [],
      notes: [],
    };
    setDreams((prev) => [newDream, ...prev]);
    syncDream(newDream);
  };

  const updateDreamProgress = (id, addedValue) => {
    let updated = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== id) return dream;
        updated = { ...dream, current: Math.min(dream.target, dream.current + addedValue) };
        return updated;
      })
    );
    if (updated) patchDream(id, { current: updated.current });
    addCoins(20);
  };

  const addTask = (dreamId, text) => {
    const newTask = { id: Date.now().toString(), text, isCompleted: false };
    let updatedTasks = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== dreamId) return dream;
        updatedTasks = [...dream.tasks, newTask];
        return { ...dream, tasks: updatedTasks };
      })
    );
    if (updatedTasks) patchDream(dreamId, { tasks: updatedTasks });
  };

  const toggleTask = (dreamId, taskId) => {
    const dream = dreams.find((item) => item.id === dreamId);
    const task = dream?.tasks.find((item) => item.id === taskId);
    const willBeCompleted = task ? !task.isCompleted : false;

    let updatedTasks = null;
    setDreams((prev) =>
      prev.map((d) => {
        if (d.id !== dreamId) return d;
        updatedTasks = d.tasks.map((t) =>
          t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
        );
        return { ...d, tasks: updatedTasks };
      })
    );
    if (updatedTasks) patchDream(dreamId, { tasks: updatedTasks });
    if (willBeCompleted) addCoins(10);
  };

  const addNote = (dreamId, text) => {
    const newNote = { id: Date.now().toString(), text, date: new Date().toISOString() };
    let updatedNotes = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== dreamId) return dream;
        updatedNotes = [...dream.notes, newNote];
        return { ...dream, notes: updatedNotes };
      })
    );
    if (updatedNotes) patchDream(dreamId, { notes: updatedNotes });
  };

  const setDreamImage = (dreamId, uri) => {
    setDreams((prev) =>
      prev.map((dream) => (dream.id === dreamId ? { ...dream, imageUri: uri } : dream))
    );
    patchDream(dreamId, { imageUri: uri });
  };

  const value = useMemo(
    () => ({
      dreams,
      isLoading,
      error,
      addDream,
      updateDreamProgress,
      addTask,
      toggleTask,
      addNote,
      setDreamImage,
    }),
    [dreams, isLoading, error, addCoins]
  );

  return <DreamContext.Provider value={value}>{children}</DreamContext.Provider>;
}

export function useDreams() {
  const context = useContext(DreamContext);
  if (context === undefined) {
    throw new Error("useDreams must be used within a DreamProvider");
  }
  return context;
}
