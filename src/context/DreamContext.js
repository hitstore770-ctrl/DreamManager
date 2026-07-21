import { createContext, useContext, useMemo, useState } from "react";

import { useAuth } from "./AuthContext";

const DreamContext = createContext(undefined);

const INITIAL_DREAMS = [
  {
    id: "1",
    title: "רחפן DJI חדש",
    type: "money",
    current: 1500,
    target: 5000,
    tasks: [],
    notes: [],
  },
  {
    id: "2",
    title: "שליטה בתוכנת DaVinci Resolve",
    type: "knowledge",
    current: 20,
    target: 100,
    tasks: [],
    notes: [],
  },
];

export function DreamProvider({ children }) {
  const { addCoins } = useAuth();
  const [dreams, setDreams] = useState(INITIAL_DREAMS);

  const addDream = ({ title, type, target }) => {
    const newDream = {
      id: Date.now().toString(),
      title,
      type,
      current: 0,
      target,
      tasks: [],
      notes: [],
    };
    setDreams((prev) => [newDream, ...prev]);
  };

  const updateDreamProgress = (id, addedValue) => {
    setDreams((prev) =>
      prev.map((dream) =>
        dream.id === id
          ? { ...dream, current: Math.min(dream.target, dream.current + addedValue) }
          : dream
      )
    );
    addCoins(20);
  };

  const addTask = (dreamId, text) => {
    const newTask = { id: Date.now().toString(), text, isCompleted: false };
    setDreams((prev) =>
      prev.map((dream) =>
        dream.id === dreamId ? { ...dream, tasks: [...dream.tasks, newTask] } : dream
      )
    );
  };

  const toggleTask = (dreamId, taskId) => {
    const dream = dreams.find((item) => item.id === dreamId);
    const task = dream?.tasks.find((item) => item.id === taskId);
    const willBeCompleted = task ? !task.isCompleted : false;

    setDreams((prev) =>
      prev.map((d) =>
        d.id === dreamId
          ? {
              ...d,
              tasks: d.tasks.map((t) =>
                t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
              ),
            }
          : d
      )
    );

    if (willBeCompleted) {
      addCoins(10);
    }
  };

  const addNote = (dreamId, text) => {
    const newNote = { id: Date.now().toString(), text, date: new Date().toISOString() };
    setDreams((prev) =>
      prev.map((dream) =>
        dream.id === dreamId ? { ...dream, notes: [...dream.notes, newNote] } : dream
      )
    );
  };

  const value = useMemo(
    () => ({ dreams, addDream, updateDreamProgress, addTask, toggleTask, addNote }),
    [dreams, addCoins]
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
