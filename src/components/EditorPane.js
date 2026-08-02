import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "../theme/ThemeContext";
import { deriveTitle, getNote, saveNoteBody } from "../db/notesRepo";
import { saveVaultNoteBody, moveIntoVault, moveOutOfVault } from "../db/vaultRepo";
import { createTemplate } from "../db/templatesRepo";
import { useDebouncedAutosave } from "../hooks/useDebouncedAutosave";
import { useAutoVersion } from "../hooks/useAutoVersion";
import { extractTags, colorForRoot, tagRoot } from "../lib/tags";
import { countWords, replaceFence, toggleChecklistLine } from "../lib/markdown";
import { isKanbanBoard } from "../lib/kanban";
import { decryptText } from "../lib/crypto";
import { useVault } from "../vault/VaultContext";
import MarkdownView from "./MarkdownView";
import KanbanBoard from "./KanbanBoard";
import HistoryModal from "./HistoryModal";
import SaveTemplateModal from "./SaveTemplateModal";
import VaultPinModal from "./VaultPinModal";
import InsertMenuSheet from "./InsertMenuSheet";
import SnippetPickerSheet from "./SnippetPickerSheet";
import TableEditorModal from "./TableEditorModal";
import RichEditorSurface from "./RichEditorSurface";
import RichToolbar from "./RichToolbar";

const ZEN_LINE_HEIGHT = 25;

// A single, self-contained note editor: its own load, its own autosave, its
// own 60s version snapshots. Two of these mounted side by side (Split mode)
// never share state — each instance owns its hooks independently.
//
// `flushRef`, if passed, is filled in with a function that saves whatever's
// currently typed right now and returns the save's promise. It exists
// because navigating away doesn't unmount this component until its exit
// animation finishes, but the screen underneath refetches its list the
// moment navigation *starts* — a plain back button that only relied on the
// unmount-time flush could show stale (or, for a brand-new note, "Empty
// note") content. The caller (EditorScreen) `await`s flushRef.current()
// before calling navigation.goBack(), so the write has actually landed
// before the previous screen re-reads the database.
export default function EditorPane({ noteId, onBack, headerExtra, flushRef }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const vault = useVault();
  const navigation = useNavigation();

  const [note, setNote] = useState(null);
  const [body, setBody] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [ready, setReady] = useState(false);
  const [lockedNoKey, setLockedNoKey] = useState(false);
  const [preview, setPreview] = useState(false);
  const [boardMode, setBoardMode] = useState(false);
  const [zen, setZen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [tableEditor, setTableEditor] = useState(null); // { block } | { block: null } for a fresh insert
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollRef = useRef(null);
  const richRef = useRef(null);

  // Hide-on-scroll header: scrolling down inside a long note slides the
  // header (and its tag row) up out of the way to maximize reading space;
  // scrolling up -- even a little -- brings it straight back. The header
  // is measured (not a guessed constant) so the content underneath can
  // reserve exactly enough top padding to start below it.
  const [headerHeight, setHeaderHeight] = useState(56);
  const headerY = useRef(new Animated.Value(0)).current;
  const headerHiddenRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const setHeaderHidden = (hidden) => {
    if (headerHiddenRef.current === hidden) return;
    headerHiddenRef.current = hidden;
    Animated.timing(headerY, { toValue: hidden ? -headerHeight : 0, duration: 220, useNativeDriver: true }).start();
  };
  const onContentScroll = (y) => {
    const dy = y - lastScrollYRef.current;
    if (y <= 4) setHeaderHidden(false);
    else if (dy > 8) setHeaderHidden(true);
    else if (dy < -8) setHeaderHidden(false);
    lastScrollYRef.current = y;
  };
  // Fresh scroll bookkeeping (and a visible header) every time the visible
  // surface changes identity, so switching notes/modes never inherits a
  // stale scroll delta from whatever was on screen before.
  useEffect(() => {
    lastScrollYRef.current = 0;
    headerHiddenRef.current = false;
    headerY.setValue(0);
  }, [noteId, preview, boardMode, zen, headerY]);
  // Bumped whenever `body` changes from *outside* the rich editor's own DOM
  // (a table/drawing edit made from Preview, a Time Machine restore) --
  // combined with `noteId` as the surface's `key`, this forces it to
  // remount and re-seed from the latest `body` instead of going stale.
  const [reseedKey, setReseedKey] = useState(0);
  const prevPreview = useRef(false);
  useEffect(() => {
    if (prevPreview.current && !preview) setReseedKey((k) => k + 1);
    prevPreview.current = preview;
  }, [preview]);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setLockedNoKey(false);
    getNote(db, noteId).then(async (n) => {
      if (!alive) return;
      if (n?.vault) {
        if (!vault.key) {
          setNote(n);
          setLockedNoKey(true);
          setReady(true);
          return;
        }
        const plain = await decryptText(n.body, n.iv, n.mac, vault.key);
        if (!alive) return;
        setNote(n);
        setBody(plain ?? "");
        setReady(true);
        return;
      }
      setNote(n);
      setBody(n?.body || "");
      setReady(true);
    });
    return () => {
      alive = false;
    };
    // Reloads (and re-decrypts) whenever the Vault locks/unlocks under us.
  }, [db, noteId, vault.key]);

  const saveFn = useCallback(
    async (database, id, text) => {
      if (note?.vault) {
        if (!vault.key) return; // shouldn't happen: input is hidden while locked
        await saveVaultNoteBody(database, id, text, vault.key);
      } else {
        await saveNoteBody(database, id, text);
      }
    },
    [note?.vault, vault.key]
  );

  const { savedAt, bodyRef } = useDebouncedAutosave(db, noteId, body, ready && !lockedNoKey, { saveFn });
  useAutoVersion(db, noteId, bodyRef, ready && !lockedNoKey && !note?.vault);

  useEffect(() => {
    if (!flushRef) return undefined;
    // Must return the save's promise -- the caller awaits this before
    // navigating away, otherwise the write only *starts* and the screen
    // underneath can still read stale/empty data before it lands.
    flushRef.current = () => (ready && !lockedNoKey ? saveFn(db, noteId, bodyRef.current) : Promise.resolve());
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, saveFn, db, noteId, ready, lockedNoKey, bodyRef]);

  const tags = note?.vault ? [] : extractTags(body);
  const counts = countWords(body);
  const boardDetected = isKanbanBoard(body);
  const s = styles(theme);

  const onToggleChecklist = (lineIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBody((b) => toggleChecklistLine(b, lineIndex));
  };

  const onToggleZen = (next) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setZen(next);
  };

  // Sets `body` from somewhere other than the rich editor's own typing (a
  // Time Machine restore, a table/drawing edit saved from Preview) and
  // forces the rich editor to resync from it on next mount.
  const applyExternalBody = (newBody) => {
    setBody(newBody);
    setReseedKey((k) => k + 1);
  };

  const onRestored = (restored) => {
    setNote(restored);
    applyExternalBody(restored.body);
    setShowHistory(false);
  };

  const onToggleVault = async () => {
    if (!note) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (note.vault) {
      await moveOutOfVault(db, noteId, bodyRef.current);
      setNote((n) => ({ ...n, vault: false }));
    } else if (vault.key) {
      await moveIntoVault(db, noteId, bodyRef.current, vault.key);
      setNote((n) => ({ ...n, vault: true }));
    } else {
      setShowVaultUnlock(true);
    }
  };

  const onSaveAsTemplate = async (name) => {
    await createTemplate(db, name, bodyRef.current);
    setShowSaveTemplate(false);
  };

  // The rich editor owns the caret now (it's a DOM Range inside its own
  // WebView/div, not a plain-text offset), so inserts go through its
  // imperative ref. Only Zen mode still tracks a plain-text `selection`,
  // and its Insert-menu entry point is hidden while zen — so whenever this
  // fires, the rich editor is guaranteed to be the mounted surface, unless
  // the user is sitting in Preview (ref unmounted, `richRef.current` null),
  // in which case fall back to appending at the end of the note.
  const insertFragment = (md) => {
    if (richRef.current) {
      richRef.current.insertMarkdownAtCursor(md);
    } else {
      const current = bodyRef.current || "";
      applyExternalBody(`${current}${current && !current.endsWith("\n") ? "\n" : ""}${md}`);
    }
  };

  const selectedText = selection.end > selection.start ? body.slice(selection.start, selection.end) : "";

  const onInsertSnippet = (snippet) => {
    setShowSnippets(false);
    insertFragment(snippet.body);
  };

  const onPickInsert = (key) => {
    setShowInsertMenu(false);
    if (key === "snippet") {
      setShowSnippets(true);
    } else if (key === "table") {
      setTableEditor({ block: null });
    } else if (key === "drawing") {
      navigation.navigate("Whiteboard", {
        onSave: (base64) => insertFragment(`\`\`\`drawing\n${base64}\n\`\`\`\n`),
      });
    }
  };

  const onEditTable = (block) => setTableEditor({ block });

  const onTableSaved = (content) => {
    const editing = tableEditor?.block;
    if (editing) {
      applyExternalBody(replaceFence(bodyRef.current, editing.startLine, editing.endLine, "table", content));
    } else {
      insertFragment(`\`\`\`table\n${content}\n\`\`\`\n`);
    }
    setTableEditor(null);
  };

  const onEditDrawing = (block) => {
    navigation.navigate("Whiteboard", {
      initialContent: block.content,
      onSave: (base64) => applyExternalBody(replaceFence(bodyRef.current, block.startLine, block.endLine, "drawing", base64)),
    });
  };

  const onOpenPrint = () => {
    // note.title reflects the last *saved* title, which can lag behind an
    // edit still sitting in the debounce window — derive fresh from the
    // in-memory body instead so Print never shows a stale/blank title.
    navigation.navigate("Print", { title: deriveTitle(bodyRef.current) || "Untitled", body: bodyRef.current });
  };

  // Typewriter scrolling: keep the line the cursor is on vertically
  // centered. Approximate (counts logical newlines, not wrapped visual
  // lines) — enough to keep the current thought in the middle of the screen
  // without a full custom text-layout engine.
  const onSelectionChange = (e) => {
    setSelection(e.nativeEvent.selection);
    if (!zen || !viewportHeight) return;
    const pos = e.nativeEvent.selection.start;
    const lineIndex = body.slice(0, pos).split("\n").length - 1;
    const targetY = Math.max(0, lineIndex * ZEN_LINE_HEIGHT - viewportHeight / 2 + ZEN_LINE_HEIGHT);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {!zen && (
        <Animated.View
          style={[s.headerOverlay, { backgroundColor: theme.bg, transform: [{ translateY: headerY }] }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <View style={s.header}>
            {onBack && (
              <TouchableOpacity testID="editor-back" style={s.iconBtn} onPress={onBack} hitSlop={8}>
                <Feather name="chevron-left" size={22} color={theme.text} />
              </TouchableOpacity>
            )}
            {headerExtra}
            <View style={{ flex: 1 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.headerActions}>
              {!lockedNoKey && (
                <TouchableOpacity testID="toggle-vault" style={s.iconBtn} onPress={onToggleVault} hitSlop={4}>
                  <Feather name={note?.vault ? "unlock" : "shield"} size={17} color={theme.text} />
                </TouchableOpacity>
              )}
              {!lockedNoKey && (
                <TouchableOpacity testID="save-template" style={s.iconBtn} onPress={() => setShowSaveTemplate(true)} hitSlop={4}>
                  <Feather name="bookmark" size={17} color={theme.text} />
                </TouchableOpacity>
              )}
              {!lockedNoKey && (
                <TouchableOpacity testID="open-insert-menu" style={s.iconBtn} onPress={() => setShowInsertMenu(true)} hitSlop={4}>
                  <Feather name="plus-square" size={17} color={theme.text} />
                </TouchableOpacity>
              )}
              {!lockedNoKey && boardDetected && (
                <TouchableOpacity
                  testID="toggle-board"
                  style={[s.iconBtn, boardMode && { backgroundColor: theme.accent }]}
                  onPress={() => setBoardMode((b) => !b)}
                  hitSlop={4}
                >
                  <Feather name="trello" size={17} color={boardMode ? theme.onAccent : theme.text} />
                </TouchableOpacity>
              )}
              {!lockedNoKey && (
                <TouchableOpacity testID="toggle-zen" style={s.iconBtn} onPress={() => onToggleZen(true)} hitSlop={4}>
                  <Feather name="minimize-2" size={17} color={theme.text} />
                </TouchableOpacity>
              )}
              {!lockedNoKey && !note?.vault && (
                <TouchableOpacity testID="open-history" style={s.iconBtn} onPress={() => setShowHistory(true)} hitSlop={4}>
                  <Feather name="clock" size={18} color={theme.text} />
                </TouchableOpacity>
              )}
              {!lockedNoKey && !note?.vault && (
                <TouchableOpacity testID="open-print" style={s.iconBtn} onPress={onOpenPrint} hitSlop={4}>
                  <Feather name="printer" size={17} color={theme.text} />
                </TouchableOpacity>
              )}
              {!lockedNoKey && (
                <TouchableOpacity
                  testID="toggle-preview"
                  style={[s.iconBtn, preview && { backgroundColor: theme.accent }]}
                  onPress={() => setPreview((p) => !p)}
                  hitSlop={4}
                >
                  <Feather name="eye" size={18} color={preview ? theme.onAccent : theme.text} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {!lockedNoKey && !note?.vault && tags.length > 0 && (
            <View style={s.tagRow}>
              {tags.map((t) => (
                <View key={t} style={[s.tagPill, { backgroundColor: colorForRoot(tagRoot(t)) + "22" }]}>
                  <AppText style={[s.tagPillText, { color: colorForRoot(tagRoot(t)) }]}>#{t}</AppText>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      )}

      {zen && (
        <TouchableOpacity testID="exit-zen" style={s.zenExit} onPress={() => onToggleZen(false)} hitSlop={12}>
          <Feather name="minimize-2" size={15} color={theme.textMuted} />
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {lockedNoKey ? (
          <View style={[s.lockedWrap, { paddingTop: headerHeight }]}>
            <Feather name="lock" size={26} color={theme.textMuted} />
            <AppText style={s.lockedText}>This note is in the Vault. Open it from the Vault to unlock it.</AppText>
          </View>
        ) : boardMode && boardDetected ? (
          <View style={{ flex: 1, paddingTop: headerHeight }}>
            <KanbanBoard raw={body} onChange={setBody} theme={theme} />
          </View>
        ) : zen ? (
          // Zen/typewriter mode stays a plain text surface on purpose --
          // it's meant to be minimal, and its cursor-centering scroll math
          // needs a plain-text caret offset, not a DOM Range. No header to
          // hide here either (it isn't rendered at all in zen mode).
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
            contentContainerStyle={{ padding: 36, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <AppTextInput
              testID="editor-input"
              style={[s.input, s.zenInput]}
              value={body}
              onChangeText={setBody}
              onSelectionChange={onSelectionChange}
              placeholder="Start writing..."
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
        ) : preview ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingTop: headerHeight + 20, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => onContentScroll(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            <MarkdownView
              body={body}
              theme={theme}
              onToggleChecklist={onToggleChecklist}
              onEditTable={onEditTable}
              onEditDrawing={onEditDrawing}
            />
          </ScrollView>
        ) : (
          <>
            <View style={{ flex: 1, paddingTop: headerHeight }}>
              <RichEditorSurface
                key={`${noteId}:${reseedKey}`}
                ref={richRef}
                testID="editor-input"
                initialMarkdown={body}
                onChangeMarkdown={setBody}
                onScrollY={onContentScroll}
                theme={theme}
                placeholder="Start writing…"
              />
            </View>
            <RichToolbar surfaceRef={richRef} theme={theme} />
          </>
        )}
      </KeyboardAvoidingView>

      <View style={[s.footer, zen && s.zenFooter]}>
        {!zen && <AppText style={s.footerText}>{savedAt ? "Saved" : "Autosaving…"}</AppText>}
        <AppText style={[s.footerText, zen && s.zenCounter]}>
          {counts.words} words · {counts.chars} chars
        </AppText>
      </View>

      {!note?.vault && (
        <HistoryModal
          visible={showHistory}
          onClose={() => setShowHistory(false)}
          noteId={noteId}
          currentTitle={note?.title}
          currentBody={body}
          onRestored={onRestored}
        />
      )}

      <SaveTemplateModal visible={showSaveTemplate} onClose={() => setShowSaveTemplate(false)} onSave={onSaveAsTemplate} />

      <InsertMenuSheet visible={showInsertMenu} onClose={() => setShowInsertMenu(false)} onPick={onPickInsert} />

      <SnippetPickerSheet
        visible={showSnippets}
        onClose={() => setShowSnippets(false)}
        onInsert={onInsertSnippet}
        saveText={selectedText || body}
        hasSelection={!!selectedText}
      />

      <TableEditorModal
        visible={!!tableEditor}
        initialContent={tableEditor?.block?.content}
        onClose={() => setTableEditor(null)}
        onSave={onTableSaved}
      />

      <VaultPinModal
        visible={showVaultUnlock}
        onClose={() => setShowVaultUnlock(false)}
        onUnlocked={async (key) => {
          vault.unlock(key);
          setShowVaultUnlock(false);
          await moveIntoVault(db, noteId, bodyRef.current, key);
          setNote((n) => ({ ...n, vault: true }));
        }}
      />
    </View>
  );
}

const styles = (t) =>
  StyleSheet.create({
    headerOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, elevation: 8 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    zenExit: { position: "absolute", top: 10, right: 10, zIndex: 10, width: 30, height: 30, alignItems: "center", justifyContent: "center", opacity: 0.6 },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 18, marginBottom: 4 },
    tagPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    tagPillText: { fontSize: 11.5, fontWeight: "700" },
    input: { flex: 1, minHeight: 260, fontSize: 16.5, lineHeight: 25, color: t.text },
    zenInput: { fontSize: 18, lineHeight: ZEN_LINE_HEIGHT },
    lockedWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 },
    lockedText: { color: t.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    zenFooter: { justifyContent: "center", opacity: 0.5 },
    footerText: { fontSize: 11.5, color: t.textMuted },
    zenCounter: { fontSize: 11 },
  });
