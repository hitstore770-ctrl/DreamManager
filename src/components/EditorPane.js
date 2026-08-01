import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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

const ZEN_LINE_HEIGHT = 25;

// A single, self-contained note editor: its own load, its own autosave, its
// own 60s version snapshots. Two of these mounted side by side (Split mode)
// never share state — each instance owns its hooks independently.
export default function EditorPane({ noteId, onBack, headerExtra }) {
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

  const tags = note?.vault ? [] : extractTags(body);
  const counts = countWords(body);
  const boardDetected = isKanbanBoard(body);
  const s = styles(theme);

  const onToggleChecklist = (lineIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBody((b) => toggleChecklistLine(b, lineIndex));
  };

  const onRestored = (restored) => {
    setNote(restored);
    setBody(restored.body);
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

  // Inserts `text` at the current cursor (replacing the selection, if any)
  // and leaves the caret right after it.
  const insertAtCursor = (text) => {
    const start = Math.min(selection.start, body.length);
    const end = Math.min(Math.max(selection.end, start), body.length);
    const next = `${body.slice(0, start)}${text}${body.slice(end)}`;
    setBody(next);
    const caret = start + text.length;
    setSelection({ start: caret, end: caret });
  };

  const selectedText = selection.end > selection.start ? body.slice(selection.start, selection.end) : "";

  const onInsertSnippet = (snippet) => {
    setShowSnippets(false);
    insertAtCursor(snippet.body);
  };

  const onPickInsert = (key) => {
    setShowInsertMenu(false);
    if (key === "snippet") {
      setShowSnippets(true);
    } else if (key === "table") {
      setTableEditor({ block: null });
    } else if (key === "drawing") {
      navigation.navigate("Whiteboard", {
        onSave: (base64) => insertAtCursor(`\`\`\`drawing\n${base64}\n\`\`\`\n`),
      });
    }
  };

  const onEditTable = (block) => setTableEditor({ block });

  const onTableSaved = (content) => {
    const editing = tableEditor?.block;
    if (editing) {
      setBody((b) => replaceFence(b, editing.startLine, editing.endLine, "table", content));
    } else {
      insertAtCursor(`\`\`\`table\n${content}\n\`\`\`\n`);
    }
    setTableEditor(null);
  };

  const onEditDrawing = (block) => {
    navigation.navigate("Whiteboard", {
      initialContent: block.content,
      onSave: (base64) => setBody((b) => replaceFence(b, block.startLine, block.endLine, "drawing", base64)),
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
              <TouchableOpacity testID="toggle-zen" style={s.iconBtn} onPress={() => setZen(true)} hitSlop={4}>
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
      )}

      {zen && (
        <TouchableOpacity testID="exit-zen" style={s.zenExit} onPress={() => setZen(false)} hitSlop={12}>
          <Feather name="minimize-2" size={15} color={theme.textMuted} />
        </TouchableOpacity>
      )}

      {!zen && !lockedNoKey && !note?.vault && tags.length > 0 && (
        <View style={s.tagRow}>
          {tags.map((t) => (
            <View key={t} style={[s.tagPill, { backgroundColor: colorForRoot(tagRoot(t)) + "22" }]}>
              <Text style={[s.tagPillText, { color: colorForRoot(tagRoot(t)) }]}>#{t}</Text>
            </View>
          ))}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {lockedNoKey ? (
          <View style={s.lockedWrap}>
            <Feather name="lock" size={26} color={theme.textMuted} />
            <Text style={s.lockedText}>This note is in the Vault. Open it from the Vault to unlock it.</Text>
          </View>
        ) : boardMode && boardDetected ? (
          <KanbanBoard raw={body} onChange={setBody} theme={theme} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
            contentContainerStyle={{ padding: zen ? 36 : 18, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {preview ? (
              <MarkdownView
                body={body}
                theme={theme}
                onToggleChecklist={onToggleChecklist}
                onEditTable={onEditTable}
                onEditDrawing={onEditDrawing}
              />
            ) : (
              <TextInput
                testID="editor-input"
                style={[s.input, zen && s.zenInput]}
                value={body}
                onChangeText={setBody}
                onSelectionChange={onSelectionChange}
                placeholder="Start writing... use #tags, **bold**, - [ ] checklists, > quotes, ``` code```"
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
              />
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <View style={[s.footer, zen && s.zenFooter]}>
        {!zen && <Text style={s.footerText}>{savedAt ? "Saved" : "Autosaving…"}</Text>}
        <Text style={[s.footerText, zen && s.zenCounter]}>
          {counts.words} words · {counts.chars} chars
        </Text>
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
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    zenFooter: { borderTopWidth: 0, justifyContent: "center", opacity: 0.5 },
    footerText: { fontSize: 11.5, color: t.textMuted },
    zenCounter: { fontSize: 11 },
  });
