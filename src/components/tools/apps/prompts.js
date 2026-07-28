import { useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { TextInput, TouchableOpacity, View } from "react-native";

import { hapticSuccess } from "../../../utils/haptics";
import { Segment, Chips, BtnLabel, INK_MUTED, GREEN, s } from "../kit";
import CustomText from "../../../components/CustomText";

// Prompt-writing tools.

// ---------------------------------------------------------------------------
// H. מחולל פרומפטים AI
// ---------------------------------------------------------------------------
const PROMPT_TOPICS = ["מכונות שתייה", "ייבוא מאליאקספרס", "React Native", "עריכת וידאו", "לימודים"];
const PROMPT_FORMATS = ["פוסט לאינסטגרם", "תסריט לריל", "הודעה לספק", "רשימת צעדים", "קוד לדוגמה"];
const PROMPT_TONES = [
  { key: "pro", label: "מקצועי", he: "מקצועי ותכליתי", en: "professional and to the point" },
  { key: "friendly", label: "ידידותי", he: "ידידותי וזורם", en: "friendly and conversational" },
  { key: "punchy", label: "קצר וקולע", he: "קצר, חד ובלי מילים מיותרות", en: "short, punchy, no filler" },
];

export function PromptBuilder() {
  const [topic, setTopic] = useState("מכונות שתייה");
  const [format, setFormat] = useState("פוסט לאינסטגרם");
  const [audience, setAudience] = useState("");
  const [details, setDetails] = useState("");
  const [toneKey, setToneKey] = useState("pro");
  const [lang, setLang] = useState("he");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const tone = PROMPT_TONES.find((t) => t.key === toneKey) || PROMPT_TONES[0];
    const t = topic.trim();
    const f = format.trim();
    if (lang === "en") {
      return [
        `Act as an expert in ${t || "[Topic]"} and write a ${f || "[Format]"}.`,
        `Tone: ${tone.en}.`,
        audience.trim() && `Target audience: ${audience.trim()}.`,
        details.trim() && `Additional context: ${details.trim()}.`,
        "Return only the final result — no preamble, no explanations.",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      `תפקד כמומחה ב${t || "[נושא]"} וכתוב ${f || "[פורמט]"}.`,
      `סגנון הכתיבה: ${tone.he}.`,
      audience.trim() && `קהל היעד: ${audience.trim()}.`,
      details.trim() && `הקשר נוסף: ${details.trim()}.`,
      "החזר רק את התוצר הסופי, בעברית, בלי הקדמות ובלי הסברים.",
    ]
      .filter(Boolean)
      .join("\n");
  }, [topic, format, audience, details, toneKey, lang]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    hapticSuccess();
    try {
      await Clipboard.setStringAsync(prompt);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Segment
        options={[
          { key: "he", label: "עברית" },
          { key: "en", label: "English" },
        ]}
        value={lang}
        onChange={setLang}
      />

      <View>
        <CustomText style={s.fieldLabel}>נושא / תחום המומחיות</CustomText>
        <TextInput
          style={s.textField}
          value={topic}
          onChangeText={setTopic}
          placeholder="לדוגמה: מכונות שתייה"
          placeholderTextColor={INK_MUTED}
          textAlign="right"
        />
      </View>
      <Chips options={PROMPT_TOPICS} onPick={setTopic} active={topic} />

      <View>
        <CustomText style={s.fieldLabel}>פורמט התוצר</CustomText>
        <TextInput
          style={s.textField}
          value={format}
          onChangeText={setFormat}
          placeholder="לדוגמה: פוסט לאינסטגרם"
          placeholderTextColor={INK_MUTED}
          textAlign="right"
        />
      </View>
      <Chips options={PROMPT_FORMATS} onPick={setFormat} active={format} />

      <CustomText style={s.fieldLabel}>סגנון</CustomText>
      <Segment
        options={PROMPT_TONES.map((t) => ({ key: t.key, label: t.label }))}
        value={toneKey}
        onChange={setToneKey}
      />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <CustomText style={s.fieldLabel}>קהל יעד (רשות)</CustomText>
          <TextInput
            style={s.textField}
            value={audience}
            onChangeText={setAudience}
            placeholder="בחורי ישיבה"
            placeholderTextColor={INK_MUTED}
            textAlign="right"
          />
        </View>
      </View>

      <View>
        <CustomText style={s.fieldLabel}>הקשר נוסף (רשות)</CustomText>
        <TextInput
          style={[s.textField, { minHeight: 74, textAlignVertical: "top", paddingTop: 12 }]}
          value={details}
          onChangeText={setDetails}
          placeholder="מה חשוב שיופיע בתוצר?"
          placeholderTextColor={INK_MUTED}
          textAlign="right"
          multiline
        />
      </View>

      <CustomText style={s.fieldLabel}>הפרומפט המוכן</CustomText>
      <View style={s.promptBox}>
        <CustomText style={[s.promptText, lang === "en" && { textAlign: "left" }]}>{prompt}</CustomText>
      </View>

      <TouchableOpacity
        style={[s.bigBtn, copied && { backgroundColor: GREEN }]}
        onPress={copy}
        activeOpacity={0.85}
      >
        <BtnLabel icon={copied ? "check" : "copy"} text={copied ? "הפרומפט הועתק" : "העתק פרומפט"} style={s.bigBtnText} />
      </TouchableOpacity>
    </View>
  );
}
