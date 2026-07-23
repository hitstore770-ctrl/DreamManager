import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fetchJson } from "../../utils/network";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolError, ToolLoading } from "./ToolKit";

const ZMANIM_URL =
  "https://www.hebcal.com/zmanim?cfg=json&latitude=31.70&longitude=35.10&tzid=Asia/Jerusalem";

// Curated, ordered list of the key times we surface. Missing keys are skipped
// gracefully so a change in the API payload can't break the layout.
const KEY_TIMES = [
  { key: "alotHaShachar", label: "עלות השחר" },
  { key: "sunrise", label: "הנץ החמה (זריחה)", highlight: true },
  { key: "sofZmanShma", label: 'סוף זמן ק״ש' },
  { key: "chatzot", label: "חצות היום", highlight: true },
  { key: "minchaGedola", label: "מנחה גדולה" },
  { key: "plagHaMincha", label: "פלג המנחה" },
  { key: "sunset", label: "שקיעה", highlight: true },
  { key: "tzeit7083deg", label: "צאת הכוכבים" },
];

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ZmanimTool() {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [times, setTimes] = useState(null);
  const [dateLabel, setDateLabel] = useState(null);

  const loadZmanim = async () => {
    setStatus("loading");
    try {
      const data = await fetchJson(ZMANIM_URL);
      if (!data?.times) {
        throw new Error("bad payload");
      }
      setTimes(data.times);
      setDateLabel(data.date ?? null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadZmanim();
  }, []);

  if (status === "loading") {
    return <ToolLoading label="טוען זמני היום..." />;
  }

  if (status === "error") {
    return (
      <ToolError
        message="שגיאה בטעינת זמני היום. בדקו את חיבור האינטרנט ונסו שוב."
        onRetry={loadZmanim}
      />
    );
  }

  const rows = KEY_TIMES.filter((item) => times[item.key]);

  return (
    <View>
      <Text style={styles.locationText}>📍 ביתר עילית</Text>
      {dateLabel && <Text style={styles.dateText}>{dateLabel}</Text>}

      <View style={styles.card}>
        {rows.map((item, index) => (
          <View
            key={item.key}
            style={[styles.row, index === rows.length - 1 && styles.rowLast]}
          >
            <Text style={[styles.label, item.highlight && styles.labelHighlight]}>
              {item.label}
            </Text>
            <Text style={[styles.time, item.highlight && styles.timeHighlight]}>
              {formatTime(times[item.key])}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  locationText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 14,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  labelHighlight: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.medium,
  },
  time: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  timeHighlight: {
    color: COLORS.accent,
    fontFamily: FONTS.bold,
  },
});
