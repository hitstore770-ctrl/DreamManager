import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "./AuthContext";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { COLORS } from "../utils/theme";

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
  const { addCoins } = useAuth();
  const [dreams, setDreams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Guards the save effect so we never overwrite storage before hydration.
  const hasHydrated = useRef(false);

  // Hydrate from storage on mount, falling back to the mock dreams only when
  // storage holds nothing usable.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.dreams);
        const parsed = stored ? JSON.parse(stored) : null;
        setDreams(Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DREAMS);
      } catch {
        setDreams(INITIAL_DREAMS);
      } finally {
        hasHydrated.current = true;
        setIsLoading(false);
      }
    })();
  }, []);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (hasHydrated.current) {
      AsyncStorage.setItem(STORAGE_KEYS.dreams, JSON.stringify(dreams)).catch(() => {});
    }
  }, [dreams]);

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

  const setDreamImage = (dreamId, uri) => {
    setDreams((prev) =>
      prev.map((dream) => (dream.id === dreamId ? { ...dream, imageUri: uri } : dream))
    );
  };

  const value = useMemo(
    () => ({
      dreams,
      addDream,
      updateDreamProgress,
      addTask,
      toggleTask,
      addNote,
      setDreamImage,
    }),
    [dreams, addCoins]
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  return <DreamContext.Provider value={value}>{children}</DreamContext.Provider>;
}

export function useDreams() {
  const context = useContext(DreamContext);
  if (context === undefined) {
    throw new Error("useDreams must be used within a DreamProvider");
  }
  return context;
}
