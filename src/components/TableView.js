import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { columnStats, formatNumber, parseTable, sortedRows } from "../lib/table";

const CELL_WIDTH = 100;

// Inline, read-only render of a ```table block: tap a header to sort by that
// column (view-only — the underlying row order in the note is never
// rewritten just from sorting), number columns get a sum/average footer.
// Actual editing happens in TableEditorModal via the pencil button.
export default function TableView({ content, theme, fontSize = 16, onEdit }) {
  const table = parseTable(content);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const rows = sortedRows(table, sortCol, sortCol == null ? null : sortDir);
  const hasNumberCol = table.columns.some((c) => c.type === "number");

  const toggleSort = (i) => {
    if (sortCol !== i) {
      setSortCol(i);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null);
      setSortDir("asc");
    }
  };

  const s = styles(theme, fontSize);

  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={s.headerRow}>
            {table.columns.map((col, i) => (
              <TouchableOpacity key={i} style={s.cell} onPress={() => toggleSort(i)} activeOpacity={0.7}>
                <Text style={s.headerText} numberOfLines={1}>
                  {col.name}
                </Text>
                {sortCol === i && <Feather name={sortDir === "asc" ? "arrow-up" : "arrow-down"} size={11} color={theme.accent} />}
              </TouchableOpacity>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((val, ci) => (
                <View key={ci} style={s.cell}>
                  {table.columns[ci]?.type === "checkbox" ? (
                    <View style={[s.checkbox, val && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                      {val && <Feather name="check" size={11} color={theme.onAccent} />}
                    </View>
                  ) : (
                    <Text style={s.cellText} numberOfLines={2}>
                      {String(val ?? "")}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
          {hasNumberCol && (
            <View style={[s.row, s.statsRow]}>
              {table.columns.map((col, i) => {
                const stats = columnStats(table, i);
                return (
                  <View key={i} style={s.cell}>
                    {stats ? (
                      <Text style={s.statsText}>
                        Σ {formatNumber(stats.sum)} · x̄ {formatNumber(stats.avg)}
                      </Text>
                    ) : i === 0 ? (
                      <Text style={s.statsLabel}>Totals</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      {!!onEdit && (
        <TouchableOpacity testID="edit-table" style={s.editBtn} onPress={onEdit} activeOpacity={0.8}>
          <Feather name="edit-2" size={12} color={theme.textMuted} />
          <Text style={s.editText}>Edit table</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = (t, fontSize) =>
  StyleSheet.create({
    wrap: { marginVertical: 8, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: t.border },
    headerRow: { flexDirection: "row", backgroundColor: t.surfaceAlt },
    row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: t.border },
    statsRow: { backgroundColor: t.surfaceAlt },
    cell: { width: CELL_WIDTH, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4 },
    headerText: { fontSize: fontSize * 0.8, fontWeight: "700", color: t.text },
    cellText: { fontSize: fontSize * 0.85, color: t.text },
    checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 2, borderColor: t.border, alignItems: "center", justifyContent: "center" },
    statsText: { fontSize: fontSize * 0.7, color: t.textMuted, fontStyle: "italic" },
    statsLabel: { fontSize: fontSize * 0.7, color: t.textMuted, fontWeight: "700" },
    editBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: t.surfaceAlt },
    editText: { fontSize: 11, color: t.textMuted, fontWeight: "600" },
  });
