import { ScrollView, StyleSheet, Text, View } from "react-native";

import Icon from "../Icon";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { TOOL_APPS } from "./registry";
import { CARD, INK, INK_MUTED, INK_SOFT } from "./kit";

// Resolves a catalogue tool id to its implementation and renders it inside the
// hub's bottom sheet, owning the scroll container and keyboard-dismiss
// behaviour so no individual tool has to repeat them.
//
// Keyboard avoidance lives on the sheet itself, not here: the whole sheet has
// to rise above the keyboard, and a KeyboardAvoidingView nested inside it
// would only shift the scroll area while the sheet stayed put.
//
// An id with no implementation falls through to an honest "not built yet"
// card rather than an empty sheet — the hub already blocks those, so this is
// the backstop for a catalogue entry added ahead of its code.

export default function ToolRenderer({ toolId, tool, maxHeight = 480 }) {
  const Tool = toolId ? TOOL_APPS[toolId] : null;

  return (
    <ScrollView
      style={{ maxHeight }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {Tool ? <Tool /> : <NotBuilt name={tool?.name} />}
    </ScrollView>
  );
}

function NotBuilt({ name }) {
  return (
    <View style={s.wrap}>
      <View style={s.badge}>
        <Icon name="tool" size={26} color={INK_MUTED} />
      </View>
      <Text style={s.title}>{name || "הכלי"} עדיין לא נבנה</Text>
      <Text style={s.sub}>הכלי מופיע בקטלוג אבל אין מאחוריו קוד עדיין. הוא ייפתח ברגע שייבנה.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 34, gap: 10 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: FONTS.bold, fontSize: 17, color: INK, textAlign: "center" },
  sub: { fontFamily: FONTS.regular, fontSize: 13, color: INK_SOFT, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
});
