import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fetchJson } from "../../utils/network";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolError, ToolLoading } from "./ToolKit";

const TIME_URL = "https://worldtimeapi.org/api/timezone/America/New_York";
const NY_TZ = "America/New_York";

function formatInNY(date, options) {
  return date.toLocaleString("he-IL", { timeZone: NY_TZ, ...options });
}

export default function WorldClock() {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [now, setNow] = useState(null);
  // Offset between the server's NY instant and our local clock, so we can
  // keep ticking without hammering the API.
  const offsetRef = useRef(0);
  const intervalRef = useRef(null);

  const loadTime = async () => {
    setStatus("loading");
    try {
      const data = await fetchJson(TIME_URL);
      if (!data?.datetime) {
        throw new Error("bad payload");
      }
      const serverNow = new Date(data.datetime).getTime();
      offsetRef.current = serverNow - Date.now();
      setNow(new Date(Date.now() + offsetRef.current));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadTime();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "ready") return undefined;
    intervalRef.current = setInterval(() => {
      setNow(new Date(Date.now() + offsetRef.current));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [status]);

  if (status === "loading") {
    return <ToolLoading label="טוען את השעה בניו יורק..." />;
  }

  if (status === "error") {
    return (
      <ToolError
        message="שגיאה בטעינת השעון העולמי. בדקו את חיבור האינטרנט ונסו שוב."
        onRetry={loadTime}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.city}>🗽 ניו יורק</Text>
      <Text style={styles.time}>
        {formatInNY(now, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </Text>
      <Text style={styles.date}>
        {formatInNY(now, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    alignItems: "center",
  },
  city: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.medium,
    marginBottom: 12,
  },
  time: {
    color: COLORS.textPrimary,
    fontSize: 52,
    fontFamily: FONTS.bold,
    letterSpacing: 2,
  },
  date: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginTop: 12,
  },
});
