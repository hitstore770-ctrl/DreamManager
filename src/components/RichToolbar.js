import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RADIUS } from "../theme/ThemeContext";

// Bottom-docked formatting toolbar for the WYSIWYG editor. Every press
// fires a light haptic first, then dispatches the command into the surface
// via its imperative ref -- text goes bold/italic/etc. immediately, no
// markdown symbols ever shown.
export default function RichToolbar({ surfaceRef, theme }) {
  const s = styles(theme);

  const Btn = ({ testID, onPress, children }) => (
    <TouchableOpacity
      testID={testID}
      hitSlop={4}
      style={s.btn}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
    >
      {children}
    </TouchableOpacity>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bar} contentContainerStyle={s.barContent}>
      <Btn testID="rte-h1" onPress={() => surfaceRef.current?.heading(1)}>
        <AppText style={s.glyphLg}>H1</AppText>
      </Btn>
      <Btn testID="rte-h2" onPress={() => surfaceRef.current?.heading(2)}>
        <AppText style={s.glyphSm}>H2</AppText>
      </Btn>
      <View style={s.divider} />
      <Btn testID="rte-bold" onPress={() => surfaceRef.current?.bold()}>
        <AppText style={s.glyphLg}>B</AppText>
      </Btn>
      <Btn testID="rte-italic" onPress={() => surfaceRef.current?.italic()}>
        <AppText style={[s.glyphLg, { fontStyle: "italic" }]}>I</AppText>
      </Btn>
      <Btn testID="rte-strike" onPress={() => surfaceRef.current?.strikethrough()}>
        <AppText style={[s.glyphLg, { textDecorationLine: "line-through" }]}>S</AppText>
      </Btn>
      <View style={s.divider} />
      <Btn testID="rte-bullets" onPress={() => surfaceRef.current?.bullets()}>
        <Feather name="list" size={17} color={theme.text} />
      </Btn>
      <Btn testID="rte-checklist" onPress={() => surfaceRef.current?.insertMarkdownAtCursor("- [ ] \n")}>
        <Feather name="check-square" size={17} color={theme.text} />
      </Btn>
      <View style={s.divider} />
      <Btn testID="rte-align-left" onPress={() => surfaceRef.current?.align("left")}>
        <Feather name="align-left" size={17} color={theme.text} />
      </Btn>
      <Btn testID="rte-align-center" onPress={() => surfaceRef.current?.align("center")}>
        <Feather name="align-center" size={17} color={theme.text} />
      </Btn>
      <Btn testID="rte-align-right" onPress={() => surfaceRef.current?.align("right")}>
        <Feather name="align-right" size={17} color={theme.text} />
      </Btn>
    </ScrollView>
  );
}

const styles = (t) =>
  StyleSheet.create({
    bar: { backgroundColor: t.surfaceAlt, borderRadius: RADIUS.lg, marginHorizontal: 12, marginBottom: 10, flexGrow: 0 },
    barContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
    btn: { width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
    divider: { width: 1, height: 20, backgroundColor: t.border, marginHorizontal: 4 },
    glyphLg: { fontSize: 15, fontWeight: "700", color: t.text },
    glyphSm: { fontSize: 13, fontWeight: "700", color: t.text },
  });
