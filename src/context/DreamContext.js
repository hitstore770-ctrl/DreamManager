import { createContext, useContext, useMemo, useState } from "react";

const DreamContext = createContext(undefined);

const INITIAL_DREAMS = [
  { id: "1", title: "רחפן DJI חדש", type: "money", current: 1500, target: 5000 },
  {
    id: "2",
    title: "שליטה בתוכנת DaVinci Resolve",
    type: "knowledge",
    current: 20,
    target: 100,
  },
];

export function DreamProvider({ children }) {
  const [dreams, setDreams] = useState(INITIAL_DREAMS);

  const addDream = ({ title, type, target }) => {
    const newDream = {
      id: Date.now().toString(),
      title,
      type,
      current: 0,
      target,
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
  };

  const value = useMemo(
    () => ({ dreams, addDream, updateDreamProgress }),
    [dreams]
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
