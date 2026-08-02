// Native (iOS/Android) variant: RN has no DOM, so real inline rich text
// (bold mid-sentence, etc.) needs a contentEditable surface hosted in a
// WebView -- there's no other way to get true WYSIWYG formatting on native
// RN. The WebView bundles its own small HTML/CSS/JS page (built locally in
// buildDocument below, no network fetch), so this stays 100% offline. See
// RichEditorSurface.web.js for the web counterpart, which talks to a real
// DOM node directly instead of going through this postMessage bridge.
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { WebView } from "react-native-webview";
import { htmlStringToMarkdown, markdownFragmentToHtml, markdownToHtml } from "../lib/richtext";
import { richEditorCss } from "../lib/richEditorStyle";

function buildDocument(theme, initialHtml, placeholder) {
  const css = richEditorCss(theme, { native: true });
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; background: ${theme.bg}; }
  ${css}
</style>
</head>
<body>
  <div id="editor" class="rte-content" contenteditable="true" data-placeholder="${(placeholder || "").replace(/"/g, "&quot;")}">${initialHtml}</div>
  <script>
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
    var editor = document.getElementById("editor");
    function post(type, payload) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
    }
    editor.addEventListener("input", function () { post("change", editor.innerHTML); });
    true;
  </script>
</body>
</html>`;
}

const RichEditorSurface = forwardRef(function RichEditorSurface(
  { initialMarkdown, onChangeMarkdown, theme, placeholder, testID, onScrollY },
  ref
) {
  const webRef = useRef(null);
  // Computed once per mount -- the caller remounts us (via a `key` change)
  // whenever `initialMarkdown` needs to be re-applied from outside.
  const html = useRef(buildDocument(theme, markdownToHtml(initialMarkdown), placeholder)).current;

  const run = useCallback((js) => {
    webRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  const exec = useCallback(
    (cmd, value) => {
      run(`document.getElementById('editor').focus(); document.execCommand(${JSON.stringify(cmd)}, false, ${JSON.stringify(value ?? null)});`);
    },
    [run]
  );

  useImperativeHandle(
    ref,
    () => ({
      bold: () => exec("bold"),
      italic: () => exec("italic"),
      strikethrough: () => exec("strikeThrough"),
      bullets: () => exec("insertUnorderedList"),
      heading: (level) => {
        run(`(function(){
          var cur = (document.queryCommandValue('formatBlock') || '').toUpperCase();
          var target = 'H${level}';
          document.getElementById('editor').focus();
          document.execCommand('formatBlock', false, cur === target ? '<p>' : '<' + target + '>');
        })();`);
      },
      align: (dir) => exec(dir === "left" ? "justifyLeft" : dir === "center" ? "justifyCenter" : "justifyRight"),
      insertMarkdownAtCursor: (md) => {
        const fragHtml = markdownFragmentToHtml(md);
        run(`document.getElementById('editor').focus(); document.execCommand('insertHTML', false, ${JSON.stringify(fragHtml)});`);
      },
      focus: () => run(`document.getElementById('editor').focus();`),
    }),
    [exec, run]
  );

  const onMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "change") onChangeMarkdown?.(htmlStringToMarkdown(msg.payload));
    } catch {
      // Malformed bridge message -- drop it rather than crash the editor.
    }
  };

  return (
    <WebView
      ref={webRef}
      testID={testID}
      originWhitelist={["*"]}
      source={{ html }}
      onMessage={onMessage}
      onScroll={onScrollY ? (e) => onScrollY(e.nativeEvent.contentOffset.y) : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
      scrollEnabled
      keyboardDisplayRequiresUserAction={false}
    />
  );
});

export default RichEditorSurface;
