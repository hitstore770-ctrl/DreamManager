import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import { COLUMN_TYPES, emptyTable, parseTable, serializeTable } from "../lib/table";

const CELL_WIDTH = 130;

function blankValueFor(type) {
  if (type === "number") return 0;
  if (type === "checkbox") return false;
  return "";
}

// Full editor for a ```table block: add/remove rows and columns, rename
// columns, cycle a column's type (Text -> Number -> Checkbox), edit cells.
// Sorting and the sum/average footer live in the read-only TableView instead
// — this modal is purely about shaping the data.
export default function TableEditorModal({ visible, initialContent, onClose, onSave }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [table, setTable] = useState(() => emptyTable());

  useEffect(() => {
    if (visible) setTable(initialContent ? parseTable(initialContent) : emptyTable());
  }, [visible, initialContent]);

  const setCell = (ri, ci, value) => {
    setTable((t) => {
      const rows = t.rows.map((r) => [...r]);
      rows[ri][ci] = value;
      return { ...t, rows };
    });
  };

  const setColumnName = (ci, name) => {
    setTable((t) => ({ ...t, columns: t.columns.map((c, i) => (i === ci ? { ...c, name } : c)) }));
  };

  const cycleColumnType = (ci) => {
    setTable((t) => {
      const columns = t.columns.map((c, i) => {
        if (i !== ci) return c;
        const next = COLUMN_TYPES[(COLUMN_TYPES.indexOf(c.type) + 1) % COLUMN_TYPES.length];
        return { ...c, type: next };
      });
      const rows = t.rows.map((r) => r.map((v, i) => (i === ci ? blankValueFor(columns[ci].type) : v)));
      return { columns, rows };
    });
  };

  const addColumn = () => {
    setTable((t) => ({
      columns: [...t.columns, { name: `Column ${t.columns.length + 1}`, type: "text" }],
      rows: t.rows.map((r) => [...r, ""]),
    }));
  };

  const removeColumn = (ci) => {
    setTable((t) => ({
      columns: t.columns.filter((_, i) => i !== ci),
      rows: t.rows.map((r) => r.filter((_, i) => i !== ci)),
    }));
  };

  const addRow = () => {
    setTable((t) => ({ ...t, rows: [...t.rows, t.columns.map((c) => blankValueFor(c.type))] }));
  };

  const removeRow = (ri) => {
    setTable((t) => ({ ...t, rows: t.rows.filter((_, i) => i !== ri) }));
  };

  const submit = () => onSave(serializeTable(table));

  const s = styles(theme);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.topBar}>
          <TouchableOpacity testID="table-editor-close" style={s.iconBtn} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={s.title}>Edit Table</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity testID="table-editor-save" style={[s.iconBtn, { backgroundColor: theme.accent }]} onPress={submit} hitSlop={8}>
            <Feather name="check" size={19} color={theme.onAccent} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}>
            <View style={{ flexDirection: "row" }}>
              {table.columns.map((col, ci) => (
                <View key={ci} style={[s.headerCell, { width: CELL_WIDTH }]}>
                  <TextInput testID="column-name-input" style={s.columnNameInput} value={col.name} onChangeText={(v) => setColumnName(ci, v)} />
                  <View style={s.columnMetaRow}>
                    <TouchableOpacity testID="column-type-toggle" onPress={() => cycleColumnType(ci)} style={s.typePill}>
                      <Text style={s.columnType}>{col.type}</Text>
                    </TouchableOpacity>
                    {table.columns.length > 1 && (
                      <TouchableOpacity testID="remove-column" onPress={() => removeColumn(ci)} hitSlop={6}>
                        <Feather name="x" size={13} color={theme.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity testID="add-column" style={s.addColumnBtn} onPress={addColumn}>
                <Feather name="plus" size={18} color={theme.accent} />
              </TouchableOpacity>
            </View>

            {table.rows.map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row" }}>
                {row.map((val, ci) => (
                  <View key={ci} style={[s.cell, { width: CELL_WIDTH }]}>
                    {table.columns[ci].type === "checkbox" ? (
                      <Switch testID="cell-checkbox" value={!!val} onValueChange={(v) => setCell(ri, ci, v)} />
                    ) : (
                      <TextInput
                        testID="cell-input"
                        style={s.cellInput}
                        value={String(val ?? "")}
                        onChangeText={(v) => setCell(ri, ci, table.columns[ci].type === "number" ? Number(v) || 0 : v)}
                        keyboardType={table.columns[ci].type === "number" ? "numeric" : "default"}
                      />
                    )}
                  </View>
                ))}
                <TouchableOpacity testID="remove-row" style={s.removeRowBtn} onPress={() => removeRow(ri)}>
                  <Feather name="trash-2" size={14} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity testID="add-row" style={s.addRowBtn} onPress={addRow}>
              <Feather name="plus" size={15} color={theme.accent} />
              <Text style={{ color: theme.accent, fontWeight: "700", marginStart: 6 }}>Add row</Text>
            </TouchableOpacity>
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    title: { fontSize: 16, fontWeight: "700", color: t.text, marginStart: 8 },
    headerCell: { padding: 8, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border },
    columnNameInput: { fontSize: 13.5, fontWeight: "700", color: t.text, padding: 0 },
    columnMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    typePill: { backgroundColor: t.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    columnType: { fontSize: 10.5, color: t.accent, fontWeight: "700", textTransform: "capitalize" },
    addColumnBtn: { width: 44, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border },
    cell: { padding: 8, borderWidth: 1, borderColor: t.border, borderTopWidth: 0, justifyContent: "center" },
    cellInput: { fontSize: 13.5, color: t.text, padding: 0 },
    removeRowBtn: { width: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.border, borderTopWidth: 0 },
    addRowBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 44, marginTop: 4 },
  });
