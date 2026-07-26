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

// Vision-board cover palettes, used when a dream has no photo yet.
export const DREAM_COVERS = [
  { key: "night", colors: ["#1B2A4A", "#0E1729"] },
  { key: "sunset", colors: ["#8A3B4B", "#3A1C28"] },
  { key: "forest", colors: ["#1E4A3C", "#0F2620"] },
  { key: "gold", colors: ["#6B5320", "#2E230D"] },
  { key: "royal", colors: ["#3C2E6B", "#1B1433"] },
];

const INITIAL_DREAMS = [
  {
    id: "1",
    title: "רחפן DJI חדש",
    type: "money",
    current: 1500,
    target: 5000,
    saved: 1500,
    cover: "night",
    imageUri: null,
    cost: 3200,
    price: 5000,
    tasks: [],
    notes: [],
    milestones: [
      { id: "m1", title: "לחסוך 2,500 ₪", target: 2500, coins: 50, released: false, done: true },
      { id: "m2", title: "להשוות דגמים ומחירים", target: 3500, coins: 50, released: false, done: false },
      { id: "m3", title: "הגענו ליעד — לרכוש!", target: 5000, coins: 150, released: false, done: false },
    ],
  },
  {
    id: "2",
    title: "שליטה בתוכנת DaVinci Resolve",
    type: "knowledge",
    current: 20,
    target: 100,
    saved: 0,
    cover: "royal",
    imageUri: null,
    cost: 0,
    price: 0,
    tasks: [],
    notes: [],
    milestones: [
      { id: "k1", title: "לסיים קורס בסיס", target: 40, coins: 30, released: false, done: false },
      { id: "k2", title: "לערוך סרטון ראשון", target: 100, coins: 60, released: false, done: false },
    ],
  },
];

// Fill in fields that may be missing on documents created before the Goals
// upgrade, so older cloud data still renders safely.
function normalizeDream(dream) {
  return {
    imageUri: null,
    cost: 0,
    price: 0,
    saved: 0,
    cover: "night",
    tasks: [],
    notes: [],
    milestones: [],
    ...dream,
  };
}

// Vision-board progress: milestone completion when a checklist exists,
// otherwise the numeric current/target ratio. Always 0–100.
export function dreamProgress(dream) {
  const ms = dream?.milestones || [];
  if (ms.length) {
    const done = ms.filter((m) => m.done).length;
    return Math.round((done / ms.length) * 100);
  }
  const target = Number(dream?.target) || 0;
  if (!target) return 0;
  return Math.min(100, Math.round(((Number(dream?.current) || 0) / target) * 100));
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
        // Cloud unreachable — fall back to defaults so the app still works,
        // but never clobber dreams the user already has on screen: this
        // rejection can land long after the board rendered, and overwriting
        // then silently discards edits made in the meantime.
        if (!cancelled) {
          setDreams((prev) => (prev.length ? prev : INITIAL_DREAMS));
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

  const addDream = ({ title, type, target, cost = 0, price = 0, cover = "night", imageUri = null, milestones = [] }) => {
    const newDream = {
      id: Date.now().toString(),
      title,
      type,
      current: 0,
      target,
      saved: 0,
      cover,
      imageUri,
      cost,
      price,
      tasks: [],
      notes: [],
      milestones,
    };
    setDreams((prev) => [newDream, ...prev]);
    syncDream(newDream);
    return newDream;
  };

  // ---- Vision-board milestone checklist -----------------------------------
  // Ticking a milestone drives the card's progress bar directly. Coins are
  // awarded once per milestone (tracked by `released`, same as the numeric
  // threshold engine) so completing then un-completing can't farm coins.
  const toggleMilestone = (dreamId, milestoneId) => {
    let updated = null;
    let reward = 0;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== dreamId) return dream;
        const milestones = (dream.milestones || []).map((m) => {
          if (m.id !== milestoneId) return m;
          const done = !m.done;
          if (done && !m.released) {
            reward = m.coins || 25;
            return { ...m, done, released: true };
          }
          return { ...m, done };
        });
        updated = { ...dream, milestones };
        return updated;
      })
    );
    if (updated) patchDream(dreamId, { milestones: updated.milestones });
    if (reward) addCoins(reward);
  };

  const addChecklistMilestone = (dreamId, title) => {
    const milestone = { id: Date.now().toString(), title, target: 0, coins: 25, released: false, done: false };
    let updated = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== dreamId) return dream;
        updated = [...(dream.milestones || []), milestone];
        return { ...dream, milestones: updated };
      })
    );
    if (updated) patchDream(dreamId, { milestones: updated });
  };

  // Money put aside toward the dream's financial target.
  const addDreamSavings = (dreamId, amount) => {
    let updated = null;
    setDreams((prev) =>
      prev.map((dream) => {
        if (dream.id !== dreamId) return dream;
        const saved = Math.max(0, (Number(dream.saved) || 0) + amount);
        updated = { ...dream, saved, current: Math.min(dream.target || saved, saved) };
        return updated;
      })
    );
    if (updated) patchDream(dreamId, { saved: updated.saved, current: updated.current });
  };

  const removeDream = (dreamId) => {
    setDreams((prev) => prev.filter((d) => d.id !== dreamId));
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
      removeDream,
      updateDreamProgress,
      setDreamPricing,
      addMilestone,
      removeMilestone,
      toggleMilestone,
      addChecklistMilestone,
      addDreamSavings,
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
