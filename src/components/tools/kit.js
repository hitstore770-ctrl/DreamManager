import { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Linking, Platform, Share, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../Icon";
import Slider from "./Slider";
import { useSettings } from "../../context/SettingsContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { gregorianToHebrew, hebrewWeekday } from "../../utils/hebrewDate";
import { shekel } from "../../utils/posStore";
import { computeZmanim, fmtTime, JERUSALEM } from "../../utils/zmanim";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import CustomText from "../../components/CustomText";

// Shared kit for the tool mini-apps: the input/stat/segment primitives and
// the one StyleSheet they all draw from. Each tool lives in its own file
// under ./apps and imports from here, so no single file grows without bound
// as the catalogue fills in.

// WHITE is both the paper the tools sit on and — critically — the quiet zone
// behind a rendered QR code. A QR on a tinted substrate does not scan reliably,
// so this token stays literally white regardless of what the theme does.
export const WHITE = "#FFFFFF";
export const CARD = "#F4F6F9";
export const INK = "#111827";
export const INK_SOFT = "#4B5563";
export const INK_MUTED = "#9CA3AF";
export const BLUE = "#7C3AED";
export const GOLD = "#0891B2";
export const GREEN = "#059669";
export const RED = "#DC2626";

// The browser's focus ring draws a hard black box around a focused input,
// which fights the soft 770JLM surfaces. No-op on native.
export const NO_OUTLINE = Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {};

export function Field({ label, value, onChange, placeholder, suffix, numeric = true, testID }) {
  return (
    <View style={{ flex: 1 }}>
      <CustomText style={s.fieldLabel}>{label}</CustomText>
      <View style={s.fieldRow}>
        {!!suffix && <CustomText style={s.fieldSuffix}>{suffix}</CustomText>}
        <TextInput
          testID={testID}
          style={s.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={numeric ? "numeric" : "default"}
          placeholder={placeholder}
          placeholderTextColor={INK_MUTED}
          textAlign="center"
        />
      </View>
    </View>
  );
}

export function Stat({ label, value, color = INK, big }) {
  return (
    <View style={s.stat}>
      <CustomText style={[s.statValue, big && { fontSize: 25 }, { color }]}>{value}</CustomText>
      <CustomText style={s.statLabel}>{label}</CustomText>
    </View>
  );
}

export function Segment({ options, value, onChange }) {
  return (
    <View style={s.segment}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[s.segmentBtn, value === o.key && s.segmentOn]}
          onPress={() => { hapticLight(); onChange(o.key); }}
          activeOpacity={0.75}
        >
          <CustomText style={[s.segmentText, value === o.key && { color: WHITE }]}>{o.label}</CustomText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Quick-fill chips that write a preset straight into a text field.
export function Chips({ options, onPick, active }) {
  return (
    <View style={s.chipRow}>
      {options.map((o) => {
        const on = active !== undefined && String(active) === String(o);
        return (
          <TouchableOpacity
            key={String(o)}
            style={[s.chip, on && { backgroundColor: BLUE }]}
            onPress={() => { hapticLight(); onPick(o); }}
            activeOpacity={0.75}
          >
            <CustomText style={[s.chipText, on && { color: WHITE }]}>{o}</CustomText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// − value + stepper for small integer counts (roommates, boxes).
export function Stepper({ label, value, onChange, min = 1, max = 30, suffix }) {
  const bump = (delta) => {
    const next = Math.max(min, Math.min(max, value + delta));
    if (next === value) { hapticWarning(); return; }
    hapticLight();
    onChange(next);
  };
  return (
    <View>
      <CustomText style={s.fieldLabel}>{label}</CustomText>
      <View style={s.stepperRow}>
        <TouchableOpacity testID="stepper-minus" style={s.stepBtn} onPress={() => bump(-1)} activeOpacity={0.7}>
          <CustomText style={s.stepBtnText}>−</CustomText>
        </TouchableOpacity>
        <CustomText style={s.stepValue}>
          {value}
          {suffix ? ` ${suffix}` : ""}
        </CustomText>
        <TouchableOpacity testID="stepper-plus" style={s.stepBtn} onPress={() => bump(1)} activeOpacity={0.7}>
          <CustomText style={s.stepBtnText}>+</CustomText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Fires a light tap whenever a calculator's headline result settles on a new
// value, so a calculation always confirms itself physically. Skips the first
// render so opening a sheet is silent.
export function useCalcHaptic(value) {
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (value === null || value === undefined || value === "") return;
    hapticLight();
  }, [value]);
}

// A button face: a vector icon and its label on one row — no emoji anywhere.
export function BtnLabel({ icon, text, style, color = WHITE }) {
  return (
    <View style={s.btnLabel}>
      <Icon name={icon} size={16} color={color} />
      <CustomText style={style}>{text}</CustomText>
    </View>
  );
}


export const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  hint: { fontFamily: FONTS.regular, fontSize: 11.5, color: INK_MUTED, textAlign: "right", lineHeight: 18 },

  fieldLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: INK_SOFT, textAlign: "right", marginBottom: 5 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 10,
    minHeight: 52,
  },
  fieldSuffix: { fontFamily: FONTS.semibold, fontSize: 12, color: INK_MUTED },
  fieldInput: { flex: 1, fontFamily: FONTS.bold, fontSize: 18, color: INK, minHeight: 52, ...NO_OUTLINE },

  statRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: CARD, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center" },
  statValue: { fontFamily: FONTS.bold, fontSize: 17 },
  statLabel: { fontFamily: FONTS.regular, fontSize: 10.5, color: INK_MUTED, marginTop: 3, textAlign: "center" },

  segment: { flexDirection: "row", backgroundColor: CARD, borderRadius: 14, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: BLUE },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: INK_SOFT },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "#D6DBE5", alignItems: "center", justifyContent: "center" },
  checkMark: { color: WHITE, fontFamily: FONTS.bold, fontSize: 14 },
  checkLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT, textAlign: "right" },

  previewStage: { backgroundColor: "#EDF0F4", borderRadius: 24, padding: 22, marginBottom: 6 },
  previewTitle: { fontFamily: FONTS.bold, fontSize: 16, color: INK },
  previewSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 3 },
  snippetBox: { backgroundColor: "#0E1729", borderRadius: 14, padding: 12, marginTop: 4 },
  snippetText: { fontFamily: "monospace", fontSize: 11, color: "#D7E3F4", textAlign: "left", lineHeight: 17 },

  codeInput: {
    minHeight: 150,
    backgroundColor: "#0E1729",
    borderRadius: 14,
    padding: 12,
    fontFamily: "monospace",
    fontSize: 12,
    color: "#D7E3F4",
    textAlignVertical: "top",
    ...NO_OUTLINE,
  },
  banner: { borderRadius: 14, padding: 12 },
  bannerText: { fontFamily: FONTS.bold, fontSize: 13, textAlign: "right" },
  bannerSub: { fontFamily: FONTS.regular, fontSize: 11, textAlign: "right", marginTop: 4, lineHeight: 17 },
  actionBtn: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: FONTS.bold, fontSize: 14, color: WHITE },
  btnLabel: { flexDirection: "row", alignItems: "center", gap: 8 },

  hebCard: { backgroundColor: CARD, borderRadius: 24, padding: 16, alignItems: "center" },
  hebDate: { fontFamily: FONTS.bold, fontSize: 20, color: INK, textAlign: "center" },
  hebSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 4, textAlign: "center" },

  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: BLUE + "0E",
    borderRadius: 24,
    padding: 14,
    minHeight: 66,
  },
  nextBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: BLUE + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  nextLabel: { fontFamily: FONTS.bold, fontSize: 15, color: BLUE },
  nextTime: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, marginTop: 2 },

  zGrid: { flexDirection: "row", gap: 8 },
  zTile: { flex: 1, backgroundColor: CARD, borderRadius: 14, paddingVertical: 12, alignItems: "center", gap: 2 },
  zTileTime: { fontFamily: FONTS.bold, fontSize: 14, color: INK },
  zTileLabel: { fontFamily: FONTS.regular, fontSize: 10, color: INK_MUTED },

  sectionLabel: { fontFamily: FONTS.bold, fontSize: 14, color: INK, textAlign: "right", marginTop: 4 },
  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  routineTime: { fontFamily: FONTS.bold, fontSize: 13, color: INK },
  routineLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },

  qrInput: {
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
    ...NO_OUTLINE,
  },
  qrWrap: { alignItems: "center", paddingVertical: 8 },
  qrGrid: { backgroundColor: WHITE, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E7EAEE" },
  qrCell: { width: 8, height: 8, backgroundColor: "transparent" },

  // --- Phase 2 batch ---
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: FONTS.semibold, fontSize: 12, color: INK_SOFT },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 5,
    minHeight: 56,
  },
  stepBtn: {
    width: 48,
    height: 46,
    borderRadius: 12,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontFamily: FONTS.bold, fontSize: 22, color: BLUE, lineHeight: 26 },
  stepValue: { flex: 1, textAlign: "center", fontFamily: FONTS.bold, fontSize: 17, color: INK },

  loadTrack: { height: 12, borderRadius: 6, backgroundColor: CARD, overflow: "hidden" },
  loadFill: { height: "100%", borderRadius: 6 },
  loadMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loadMeta: { fontFamily: FONTS.semibold, fontSize: 11.5, color: INK_SOFT },

  textField: {
    backgroundColor: CARD,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: INK,
    ...NO_OUTLINE,
  },
  promptBox: { backgroundColor: "#0E1729", borderRadius: 14, padding: 14 },
  promptText: { fontFamily: FONTS.regular, fontSize: 13, color: "#D7E3F4", textAlign: "right", lineHeight: 21 },

  resultInline: { fontFamily: FONTS.bold, fontSize: 18, color: BLUE },

  bigBtn: { minHeight: 54, borderRadius: 24, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  bigBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: WHITE },

  msgPreview: { backgroundColor: CARD, borderRadius: 14, padding: 12 },
  msgPreviewText: { fontFamily: FONTS.regular, fontSize: 12.5, color: INK_SOFT, textAlign: "right", lineHeight: 20 },
});
