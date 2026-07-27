import { useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { Image, Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import { hapticLight, hapticSuccess, hapticWarning } from "../../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import { CARD_SHADOW } from "../../../utils/ui";
import {
  BLUE,
  BtnLabel,
  CARD,
  GOLD,
  GREEN,
  INK,
  INK_MUTED,
  INK_SOFT,
  RED,
  Segment,
  Stat,
  WHITE,
  s,
} from "../kit";

// Tools that reach outside the device: a hosted image model and the platform
// speech engine.

// ---------------------------------------------------------------------------
// A. מחולל תמונות AI
// ---------------------------------------------------------------------------

const IMAGE_SIZES = [
  { key: "512", label: "512" },
  { key: "768", label: "768" },
  { key: "1024", label: "1024" },
];

const PROMPT_IDEAS = [
  "a cold soda can on a wooden counter, studio light",
  "modern vending machine in a bright lobby, wide shot",
  "flat lay of shipping boxes and tape, top down",
  "minimal violet gradient background, soft shadows",
];

function buildImageUrl(prompt, size, seed) {
  const base = "https://image.pollinations.ai/prompt/";
  return `${base}${encodeURIComponent(prompt)}?width=${size}&height=${size}&nologo=true&seed=${seed}`;
}

export function AiImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("512");
  const [url, setUrl] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [copied, setCopied] = useState(false);
  // A new seed per request, otherwise the service returns the cached image for
  // an identical prompt and "generate again" appears to do nothing.
  const seed = useRef(0);

  const generate = () => {
    const clean = prompt.trim();
    if (!clean) {
      hapticWarning();
      return;
    }
    hapticSuccess();
    seed.current = Math.floor(Math.random() * 1e9);
    setUrl(buildImageUrl(clean, size, seed.current));
    setState("loading");
    setCopied(false);
  };

  const copyUrl = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    hapticLight();
    setCopied(true);
  };

  const shareUrl = async () => {
    if (!url) return;
    hapticLight();
    try {
      await Share.share({ message: url });
    } catch {
      /* dismissed */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={ai.stage}>
        {state === "idle" && (
          <View style={[ai.frame, ai.placeholder]}>
            <View style={ai.placeholderBadge}>
              <Icon name="image" size={30} color={BLUE} />
            </View>
            <Text style={ai.placeholderTitle}>התמונה תופיע כאן</Text>
            <Text style={ai.placeholderHint}>כתוב תיאור באנגלית ולחץ על צור תמונה</Text>
          </View>
        )}

        {state === "loading" && (
          <View style={[ai.frame, ai.placeholder]}>
            <View style={ai.placeholderBadge}>
              <Icon name="loader" size={30} color={BLUE} />
            </View>
            <Text style={ai.placeholderTitle}>מייצר תמונה...</Text>
            <Text style={ai.placeholderHint}>יצירה ראשונה יכולה לקחת עד דקה</Text>
          </View>
        )}

        {state === "error" && (
          <View style={[ai.frame, ai.placeholder, { backgroundColor: RED + "0E" }]}>
            <View style={[ai.placeholderBadge, { backgroundColor: RED + "16" }]}>
              <Icon name="wifi-off" size={28} color={RED} />
            </View>
            <Text style={[ai.placeholderTitle, { color: RED }]}>לא הצלחנו להביא את התמונה</Text>
            <Text style={ai.placeholderHint}>בדוק חיבור לאינטרנט ונסה שוב</Text>
          </View>
        )}

        {/* The Image stays mounted while loading so its own load events fire;
            the overlay above simply covers it until it resolves. */}
        {!!url && state !== "error" && (
          <Image
            testID="ai-image"
            source={{ uri: url }}
            style={[ai.frame, state === "loading" && ai.hidden]}
            resizeMode="cover"
            onLoad={() => setState("done")}
            onError={() => setState("error")}
          />
        )}
      </View>

      <View>
        <Text style={s.fieldLabel}>תיאור התמונה — באנגלית</Text>
        <TextInput
          testID="ai-prompt"
          style={ai.input}
          value={prompt}
          onChangeText={(v) => { setPrompt(v); setCopied(false); }}
          placeholder="a cold soda can on a wooden counter"
          placeholderTextColor={INK_MUTED}
          multiline
          autoCapitalize="none"
          textAlign="left"
          textAlignVertical="top"
        />
      </View>

      <View style={s.chipRow}>
        {PROMPT_IDEAS.map((idea, i) => (
          <TouchableOpacity
            key={i}
            style={s.chip}
            onPress={() => { hapticLight(); setPrompt(idea); }}
            activeOpacity={0.8}
          >
            <Text style={s.chipText}>{idea.split(",")[0].slice(0, 22)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fieldLabel}>גודל</Text>
      <Segment options={IMAGE_SIZES} value={size} onChange={(v) => { hapticLight(); setSize(v); }} />

      <TouchableOpacity
        testID="ai-generate"
        style={[s.bigBtn, !prompt.trim() && { backgroundColor: INK_MUTED }]}
        onPress={generate}
        activeOpacity={0.85}
        disabled={!prompt.trim() || state === "loading"}
      >
        <BtnLabel
          icon={state === "loading" ? "loader" : "zap"}
          text={state === "loading" ? "מייצר..." : url ? "צור שוב" : "צור תמונה"}
          style={s.bigBtnText}
        />
      </TouchableOpacity>

      {/* The URL is shown as soon as one is built, not only on success: when
          the fetch fails the link is the one thing still worth having, since
          it opens fine in a browser. */}
      {!!url && (
        <View style={[s.banner, { backgroundColor: CARD }]}>
          <Text testID="ai-url" style={[s.bannerSub, { color: INK_SOFT, textAlign: "left" }]} numberOfLines={3}>
            {url}
          </Text>
        </View>
      )}

      {!!url && (
        <View style={s.row}>
          <TouchableOpacity
            style={[s.actionBtn, copied && { backgroundColor: GREEN }]}
            onPress={copyUrl}
            activeOpacity={0.85}
          >
            <BtnLabel icon={copied ? "check" : "link-2"} text={copied ? "הועתק" : "העתק קישור"} style={s.actionText} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: CARD }]} onPress={shareUrl} activeOpacity={0.85}>
            <BtnLabel icon="share-2" text="שתף" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
          </TouchableOpacity>
        </View>
      )}

      <Text style={s.hint}>
        התמונות נוצרות בשירות pollinations.ai, שהוא חינמי ואינו דורש מפתח. התיאור נשלח לשרת שלהם, ולכן
        אין להזין בו מידע רגיש. כל יצירה מקבלת seed חדש, אחרת אותו תיאור היה מחזיר את אותה תמונה.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// B. הקראת טקסט
// ---------------------------------------------------------------------------

const VOICE_LANGS = [
  { key: "he-IL", label: "עברית" },
  { key: "en-US", label: "English" },
];

const RATES = [
  { key: "0.75", label: "איטי" },
  { key: "1", label: "רגיל" },
  { key: "1.3", label: "מהיר" },
];

export function TextToSpeech() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("he-IL");
  const [rate, setRate] = useState("1");
  const [speaking, setSpeaking] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  // Leaving speech running after the sheet closes would talk over the rest of
  // the app, so it stops on unmount.
  useEffect(() => () => { Speech.stop().catch(() => {}); }, []);

  const speak = () => {
    const clean = text.trim();
    if (!clean) {
      hapticWarning();
      return;
    }
    hapticLight();
    setUnsupported(false);
    setSpeaking(true);
    try {
      Speech.speak(clean, {
        language: lang,
        rate: parseFloat(rate),
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => { setSpeaking(false); setUnsupported(true); },
      });
    } catch {
      setSpeaking(false);
      setUnsupported(true);
    }
  };

  const stop = () => {
    hapticLight();
    Speech.stop().catch(() => {});
    setSpeaking(false);
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  // ~150 words a minute at normal rate is a fair speaking pace.
  const seconds = Math.round((words / (150 * (parseFloat(rate) || 1))) * 60);

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={s.fieldLabel}>טקסט להקראה</Text>
        <TextInput
          testID="tts-text"
          style={ai.input}
          value={text}
          onChangeText={setText}
          placeholder="הדבק כאן טקסט והמכשיר יקריא אותו"
          placeholderTextColor={INK_MUTED}
          multiline
          textAlign="right"
          textAlignVertical="top"
        />
      </View>

      <Text style={s.fieldLabel}>שפה</Text>
      <Segment options={VOICE_LANGS} value={lang} onChange={(v) => { hapticLight(); setLang(v); }} />
      <Text style={s.fieldLabel}>קצב</Text>
      <Segment options={RATES} value={rate} onChange={(v) => { hapticLight(); setRate(v); }} />

      <View style={s.row}>
        <TouchableOpacity
          testID="tts-play"
          style={[s.actionBtn, (!text.trim() || speaking) && { backgroundColor: INK_MUTED }]}
          onPress={speak}
          activeOpacity={0.85}
          disabled={!text.trim() || speaking}
        >
          <BtnLabel icon="play" text={speaking ? "מקריא..." : "הקרא"} style={s.actionText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: speaking ? GOLD : CARD }]}
          onPress={stop}
          activeOpacity={0.85}
        >
          <BtnLabel
            icon="square"
            text="עצור"
            color={speaking ? WHITE : INK_SOFT}
            style={[s.actionText, !speaking && { color: INK_SOFT }]}
          />
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        <Stat label="מילים" value={words} color={BLUE} />
        <Stat label="זמן הקראה משוער" value={seconds ? `${seconds} שנ׳` : "—"} />
      </View>

      {unsupported && (
        <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
          <Text style={[s.bannerText, { color: "#8A6D00" }]}>ההקראה לא זמינה כאן</Text>
          <Text style={[s.bannerSub, { color: "#8A6D00" }]}>
            המכשיר או הדפדפן לא מספק מנוע דיבור לשפה שנבחרה. נסה שפה אחרת או הפעל מהאפליקציה.
          </Text>
        </View>
      )}

      <Text style={s.hint}>
        ההקראה משתמשת במנוע הדיבור של המכשיר, בלי אינטרנט ובלי שליחת הטקסט לשרת. איכות הקול בעברית
        תלויה בקולות המותקנים במכשיר
        {Platform.OS === "web" ? " ובדפדפן" : ""}.
      </Text>
    </View>
  );
}

const ai = StyleSheet.create({
  stage: { alignItems: "center" },
  frame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: CARD,
    ...CARD_SHADOW,
  },
  hidden: { position: "absolute", opacity: 0 },
  placeholder: { alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  placeholderBadge: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: BLUE + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTitle: { fontFamily: FONTS.bold, fontSize: 16, color: INK, textAlign: "center" },
  placeholderHint: { fontFamily: FONTS.regular, fontSize: 12.5, color: INK_MUTED, textAlign: "center", lineHeight: 19 },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    minHeight: 92,
    fontFamily: FONTS.regular,
    fontSize: 14.5,
    color: INK,
    lineHeight: 22,
  },
});
