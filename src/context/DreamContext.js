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
    cost: 3200,
    price: 5000,
    tasks: [],
    notes: [],
    milestones: [
      { id: "m1", title: "חצי מהדרך", target: 2500, coins: 50, released: false },
      { id: "m2", title: "הגענו ליעד!", target: 5000, coins: 150, released: false },
    ],
  },
  {
    id: "2",
    title: "שליטה בתוכנת DaVinci Resolve",
    type: "knowledge",
    current: 20,
    target: 100,
    imageUri: null,
    cost: 0,
    price: 0,
    tasks: [],
    notes: [],
    milestones: [],
  },
];

// Fill in fields that may be missing on documents created before the Goals
// upgrade, so older cloud data still renders safely.
function normalizeDream(dream) {
  return {
    imageUri: null,
    cost: 0,
    price: 0,
    tasks: [],
    notes: [],
    milestones: [],
    ...dream,
  };
}

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
          setDreams(snapshot.docs.map((snap) => normalizeDream(snap.data())));
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

  const addDream = ({ title, type, target, cost = 0, price = 0 }) => {
    const newDream = {
      id: Date.now().toString(),
      title,
      type,
      current: 0,
      target,
      imageUri: null,
      cost,
      price,
      tasks: [],
      notes: [],
      milestones: [],
    };
    setDreams((prev) => [newDream, ...prev]);
    syncDream(newDream);
  };

  // Bump a project's progress. Any milestone whose threshold is now reached
  // (and hasn't paid out yet) automatically releases its coins.
  const updateDreamProgress = (id, addedValue) => {
    let updated = null;
    let releasedCoins = 0;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== id) return dream;
        const current = Math.min(dream.target, dream.current + addedValue);
        const milestones = (dream.milestones ?? []).map((milestone) => {
          if (!milestone.released && current >= milestone.target) {
            releasedCoins += milestone.coins;
            return { ...milestone, released: true };
          }
          return milestone;
        });
        updated = { ...dream, current, milestones };
        return updated;
      })
    );
    if (updated) patchDream(id, { current: updated.current, milestones: updated.milestones });
    addCoins(20 + releasedCoins);
  };

  const setDreamPricing = (id, { cost, price }) => {
    let updated = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== id) return dream;
        updated = { ...dream, cost, price };
        return updated;
      })
    );
    if (updated) patchDream(id, { cost, price });
  };

  const addMilestone = (dreamId, { title, target, coins }) => {
    const newMilestone = {
      id: Date.now().toString(),
      title,
      target,
      coins,
      released: false,
    };
    let updatedMilestones = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== dreamId) return dream;
        updatedMilestones = [...(dream.milestones ?? []), newMilestone].sort(
          (a, b) => a.target - b.target
        );
        return { ...dream, milestones: updatedMilestones };
      })
    );
    if (updatedMilestones) patchDream(dreamId, { milestones: updatedMilestones });
  };

  const removeMilestone = (dreamId, milestoneId) => {
    let updatedMilestones = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== dreamId) return dream;
        updatedMilestones = (dream.milestones ?? []).filter((m) => m.id !== milestoneId);
        return { ...dream, milestones: updatedMilestones };
      })
    );
    if (updatedMilestones) patchDream(dreamId, { milestones: updatedMilestones });
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
      setDreamPricing,
      addMilestone,
      removeMilestone,
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
