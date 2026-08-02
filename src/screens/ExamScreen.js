import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { RADIUS, useTheme } from "../theme/ThemeContext";
import { listExamQuestions } from "../db/notesRepo";
import { t } from "../i18n/strings";
import SwipeBack from "../navigation/SwipeBack";
import EmptyState from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";

const SECONDS_PER_QUESTION = 30;
const MIN_SECONDS = 60;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatClock(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// The Mock Exam mode: pulls every question out of #questions-tagged notes
// (see src/lib/exam.js), runs a single countdown across the whole set, and
// grades as it goes -- no separate submit step, since "did you pick the
// right option" is knowable the instant you tap one.
export default function ExamScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [questions, setQuestions] = useState(null);
  const [step, setStep] = useState("start"); // start | running | finished
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setQuestions(await listExamQuestions(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      if (step === "start") load();
    }, [load, step])
  );

  useEffect(() => {
    if (step !== "running") return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setStep("finished");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  const start = () => {
    if (!questions?.length) return;
    setQuestions((prev) => shuffle(prev));
    setAnswers({});
    setIndex(0);
    setSecondsLeft(Math.max(MIN_SECONDS, questions.length * SECONDS_PER_QUESTION));
    setStep("running");
  };

  const answer = (optIndex) => {
    if (answers[index] !== undefined) return;
    const q = questions[index];
    const correct = !!q.options[optIndex]?.correct;
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    setAnswers((prev) => ({ ...prev, [index]: { optIndex, correct } }));
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      clearInterval(timerRef.current);
      setStep("finished");
    } else {
      setIndex((i) => i + 1);
    }
  };

  const retake = () => {
    setStep("start");
    load();
  };

  const s = styles(theme);

  const correctCount = Object.values(answers).filter((a) => a.correct).length;

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="exam-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="award" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <AppText style={s.topTitle}>{t("exam")}</AppText>
        {step === "running" && (
          <>
            <View style={{ flex: 1 }} />
            <View style={s.timerPill}>
              <Feather name="clock" size={13} color={theme.accent} />
              <AppText style={{ fontSize: 13, fontWeight: "700", color: theme.accent, marginStart: 5 }}>{formatClock(secondsLeft)}</AppText>
            </View>
          </>
        )}
      </View>

      {questions === null ? (
        <SkeletonList rows={5} />
      ) : step === "start" ? (
        questions.length === 0 ? (
          <EmptyState icon="award" title={t("noQuestions")} subtitle="" />
        ) : (
          <View style={s.startWrap}>
            <Feather name="award" size={44} color={theme.accent} />
            <AppText style={s.startCount}>{questions.length}</AppText>
            <TouchableOpacity testID="exam-start" style={[s.primaryBtn, { backgroundColor: theme.accent }]} onPress={start}>
              <AppText style={{ color: theme.onAccent, fontWeight: "700", fontSize: 15 }}>{t("startExam")}</AppText>
            </TouchableOpacity>
          </View>
        )
      ) : step === "running" ? (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
          <AppText style={s.progress}>
            {index + 1} / {questions.length}
          </AppText>
          <AppText style={s.stem}>{questions[index].stem || questions[index].noteTitle}</AppText>

          {questions[index].options.map((opt, i) => {
            const answered = answers[index];
            const isChosen = answered?.optIndex === i;
            let bg = theme.surfaceAlt;
            if (answered) {
              if (opt.correct) bg = theme.success ?? "#2F6F62";
              else if (isChosen) bg = theme.danger ?? "#C0392B";
            }
            return (
              <TouchableOpacity
                key={i}
                testID="exam-option"
                style={[s.option, { backgroundColor: bg }]}
                onPress={() => answer(i)}
                disabled={!!answered}
                activeOpacity={0.8}
              >
                <AppText style={{ color: answered && (opt.correct || isChosen) ? "#FFFFFF" : theme.text, fontSize: 14.5 }}>{opt.text}</AppText>
              </TouchableOpacity>
            );
          })}

          {!!answers[index] && (
            <TouchableOpacity testID="exam-next" style={[s.primaryBtn, { backgroundColor: theme.accent, marginTop: 10 }]} onPress={next}>
              <AppText style={{ color: theme.onAccent, fontWeight: "700", fontSize: 15 }}>
                {index + 1 >= questions.length ? t("finishExam") : t("next")}
              </AppText>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <View style={s.startWrap}>
          <AppText style={s.scoreLabel}>{t("yourScore")}</AppText>
          <AppText style={s.scoreValue}>
            {correctCount} / {questions.length}
          </AppText>
          <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }}>
            <AppText style={{ color: theme.success ?? "#2F6F62", fontWeight: "700" }}>
              {t("correct")}: {correctCount}
            </AppText>
            <AppText style={{ color: theme.danger ?? "#C0392B", fontWeight: "700" }}>
              {t("wrong")}: {questions.length - correctCount}
            </AppText>
          </View>
          <TouchableOpacity testID="exam-retake" style={[s.primaryBtn, { backgroundColor: theme.accent, marginTop: 20 }]} onPress={retake}>
            <AppText style={{ color: theme.onAccent, fontWeight: "700", fontSize: 15 }}>{t("retakeExam")}</AppText>
          </TouchableOpacity>
          <TouchableOpacity testID="exam-done" style={[s.primaryBtn, s.btnGhost]} onPress={() => navigation.goBack()}>
            <AppText style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{t("backToNotes")}</AppText>
          </TouchableOpacity>
        </View>
      )}
    </SwipeBack>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    timerPill: { flexDirection: "row", alignItems: "center", backgroundColor: t.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, height: 30 },
    startWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 30 },
    startCount: { fontSize: 34, fontWeight: "800", color: t.text },
    startHint: { fontSize: 13, color: t.textMuted, textAlign: "center" },
    primaryBtn: { paddingHorizontal: 26, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", minWidth: 200, marginTop: 8 },
    btnGhost: { backgroundColor: t.surfaceAlt },
    progress: { fontSize: 12.5, color: t.textMuted, fontWeight: "600", marginBottom: 10 },
    stem: { fontSize: 18, fontWeight: "700", color: t.text, marginBottom: 18, lineHeight: 25 },
    option: { borderRadius: RADIUS.md, padding: 14, marginBottom: 10 },
    scoreLabel: { fontSize: 14, color: t.textMuted, fontWeight: "600" },
    scoreValue: { fontSize: 44, fontWeight: "800", color: t.text },
  });
