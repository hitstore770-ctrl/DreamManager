import { useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import QRCode from "react-native-qrcode-svg";

import Icon from "../../Icon";
import { hapticLight, hapticSuccess } from "../../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import { CARD_SHADOW } from "../../../utils/ui";
import {
  BLUE,
  BtnLabel,
  CARD,
  GREEN,
  INK,
  INK_MUTED,
  INK_SOFT,
  NO_OUTLINE,
  Segment,
  Stat,
  WHITE,
  s,
} from "../kit";

// Customer-facing output: codes and links you hand to someone else.

// ---------------------------------------------------------------------------
// מחולל QR — a real, scannable code via react-native-qrcode-svg
// ---------------------------------------------------------------------------

// Error-correction level trades capacity for damage tolerance. L holds the
// most data; H still scans with about 30% of the code obscured, which is what
// you want on a sticker stuck to a machine.
const QR_LEVELS = [
  { key: "L", label: "L · 7%" },
  { key: "M", label: "M · 15%" },
  { key: "Q", label: "Q · 25%" },
  { key: "H", label: "H · 30%" },
];

const QR_PRESETS = [
  { label: "אתר", value: "https://770jlm.co.il" },
  { label: "וואטסאפ", value: "https://wa.me/972500000000" },
  { label: "וויפי", value: "WIFI:T:WPA;S:NETWORK;P:PASSWORD;;" },
  { label: "טלפון", value: "tel:+972500000000" },
];

export function QrGenerator() {
  const [text, setText] = useState("https://770jlm.co.il");
  const [level, setLevel] = useState("M");
  const [copied, setCopied] = useState(false);

  const value = text.trim();

  const copy = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    hapticSuccess();
    setCopied(true);
  };

  const share = async () => {
    if (!value) return;
    hapticLight();
    try {
      await Share.share({ message: value });
    } catch {
      /* the user dismissed the sheet */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={qr.stage}>
        {value ? (
          <View testID="qr-canvas" style={qr.quiet}>
            <QRCode
              value={value}
              size={196}
              color={INK}
              backgroundColor={WHITE}
              ecl={level}
            />
          </View>
        ) : (
          <View style={[qr.quiet, qr.empty]}>
            <Icon name="grid" size={34} color={INK_MUTED} />
            <Text style={qr.emptyText}>הזן טקסט או כתובת</Text>
          </View>
        )}
      </View>

      <View>
        <Text style={s.fieldLabel}>תוכן הקוד</Text>
        <TextInput
          testID="qr-input"
          style={qr.input}
          value={text}
          onChangeText={(v) => { setText(v); setCopied(false); }}
          placeholder="https://example.com"
          placeholderTextColor={INK_MUTED}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          textAlign="left"
          textAlignVertical="top"
        />
      </View>

      <View style={s.chipRow}>
        {QR_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            style={s.chip}
            onPress={() => { hapticLight(); setText(preset.value); setCopied(false); }}
            activeOpacity={0.8}
          >
            <Text style={s.chipText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fieldLabel}>רמת תיקון שגיאות</Text>
      <Segment options={QR_LEVELS} value={level} onChange={(v) => { hapticLight(); setLevel(v); }} />

      <View style={s.row}>
        <TouchableOpacity
          style={[s.actionBtn, copied && { backgroundColor: GREEN }]}
          onPress={copy}
          activeOpacity={0.85}
        >
          <BtnLabel icon={copied ? "check" : "copy"} text={copied ? "הועתק" : "העתק תוכן"} style={s.actionText} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={share} activeOpacity={0.85}>
          <BtnLabel icon="share-2" text="שתף" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        <Stat label="תווים" value={value.length} color={BLUE} />
        <Stat label="רמת תיקון" value={level} />
      </View>

      <Text style={s.hint}>
        הקוד אמיתי וניתן לסריקה. רמה גבוהה יותר שורדת יותר נזק והתלכלכות אבל דורשת יותר מודולים, לכן
        לקוד שמודבק על מכונה עדיף H ולקישור ארוך עדיף L.
      </Text>
    </View>
  );
}

const qr = StyleSheet.create({
  stage: { alignItems: "center", paddingVertical: 4 },
  // A quiet zone of at least four modules is part of the spec — without the
  // white margin many scanners simply will not lock on.
  quiet: { backgroundColor: WHITE, padding: 18, borderRadius: 24, ...CARD_SHADOW },
  empty: { width: 232, height: 232, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: CARD },
  emptyText: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_MUTED },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    minHeight: 80,
    fontFamily: "monospace",
    fontSize: 13,
    color: INK,
    lineHeight: 20,
    ...NO_OUTLINE,
  },
});
