// Web variant: the contentEditable surface is a real browser DOM node, so
// this talks to it directly (document.execCommand + the DOM-walking
// domToMarkdown) instead of going through a WebView bridge. See
// RichEditorSurface.js for the native (iOS/Android) counterpart -- both
// expose the same imperative ref API so EditorPane doesn't need to care
// which one it got.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { domToMarkdown, markdownFragmentToHtml, markdownToHtml } from "../lib/richtext";
import { richEditorCss } from "../lib/richEditorStyle";

function ensureStyleTag(css) {
  if (typeof document === "undefined") return;
  let tag = document.getElementById("rte-style");
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "rte-style";
    document.head.appendChild(tag);
  }
  if (tag.textContent !== css) tag.textContent = css;
}

const RichEditorSurface = forwardRef(function RichEditorSurface(
  { initialMarkdown, onChangeMarkdown, theme, placeholder, testID },
  ref
) {
  const divRef = useRef(null);
  // Tapping a toolbar button (a separate DOM element) blurs the
  // contentEditable div and can reset the browser's Selection to the start
  // of the document -- without this, a toolbar tap right after typing
  // would format/insert at the wrong spot instead of where the caret was.
  // Track the last selection that lived inside our own div, and restore it
  // before every exec() call.
  const savedRangeRef = useRef(null);

  useEffect(() => {
    ensureStyleTag(richEditorCss(theme));
  }, [theme]);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = document.getSelection();
      if (sel && sel.rangeCount > 0 && divRef.current && divRef.current.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const restoreSelection = () => {
    if (!savedRangeRef.current) return;
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  };

  useEffect(() => {
    if (divRef.current) divRef.current.innerHTML = markdownToHtml(initialMarkdown);
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Unsupported in this browser -- domToMarkdown treats <div> and <p>
      // identically, so it's a cosmetic no-op if it fails.
    }
    // Seed once per mount -- the caller remounts us (via a `key` change)
    // whenever `initialMarkdown` needs to be re-applied from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = () => {
    if (!divRef.current) return;
    onChangeMarkdown?.(domToMarkdown(divRef.current));
  };

  const exec = (cmd, value) => {
    divRef.current?.focus();
    restoreSelection();
    document.execCommand(cmd, false, value);
    emitChange();
  };

  useImperativeHandle(ref, () => ({
    bold: () => exec("bold"),
    italic: () => exec("italic"),
    strikethrough: () => exec("strikeThrough"),
    bullets: () => exec("insertUnorderedList"),
    heading: (level) => {
      divRef.current?.focus();
      restoreSelection();
      const current = (document.queryCommandValue("formatBlock") || "").toUpperCase();
      const target = `H${level}`;
      document.execCommand("formatBlock", false, current === target ? "<p>" : `<${target}>`);
      emitChange();
    },
    align: (dir) => exec(dir === "left" ? "justifyLeft" : dir === "center" ? "justifyCenter" : "justifyRight"),
    insertMarkdownAtCursor: (md) => {
      divRef.current?.focus();
      restoreSelection();
      document.execCommand("insertHTML", false, markdownFragmentToHtml(md));
      emitChange();
    },
    focus: () => divRef.current?.focus(),
  }));

  return (
    <div
      ref={divRef}
      data-testid={testID}
      className="rte-content"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={emitChange}
      style={{ flex: 1, minHeight: 260, outline: "none", overflowY: "auto" }}
    />
  );
});

export default RichEditorSurface;
