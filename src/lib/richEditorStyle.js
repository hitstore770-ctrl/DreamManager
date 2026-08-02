// Shared CSS for the WYSIWYG surface's content -- used both by the web
// variant (injected as a <style> tag scoped to a class) and the native
// WebView variant (embedded directly in the page's <head>). Font stays a
// plain system sans-serif here rather than the app's bundled Rubik: Rubik
// is registered with React Native's font system (usable by RN Text), but a
// WebView/contentEditable is a separate rendering context that doesn't see
// those fonts without embedding the ttf as a base64 @font-face, which this
// pass skips as an acceptable trade-off -- everything *around* the editor
// (toolbar, headers, list) still renders in true Rubik via AppText.
export function richEditorCss(theme, { native = false } = {}) {
  const font = native
    ? "-apple-system, Roboto, 'Segoe UI', sans-serif"
    : "Rubik_400Regular, -apple-system, Roboto, sans-serif";
  return `
    .rte-content {
      font-family: ${font};
      font-size: 16.5px;
      line-height: 1.5;
      color: ${theme.text};
      padding: 20px;
      outline: none;
      min-height: 100%;
      caret-color: ${theme.accent};
    }
    .rte-content h1, .rte-content h2, .rte-content h3,
    .rte-content h4, .rte-content h5, .rte-content h6 {
      font-weight: 700;
      margin: 16px 0 6px 0;
      letter-spacing: -0.3px;
    }
    .rte-content h1 { font-size: 1.7em; }
    .rte-content h2 { font-size: 1.32em; margin-top: 14px; }
    .rte-content h3 { font-size: 1.18em; }
    .rte-content p { margin: 4px 0; }
    .rte-content ul { margin: 4px 0; padding-left: 22px; }
    .rte-content li { margin: 2px 0; }
    .rte-content blockquote {
      margin: 8px 0;
      padding-left: 12px;
      border-left: 3px solid ${theme.quoteBorder};
      color: ${theme.textMuted};
      font-style: italic;
    }
    .rte-content b, .rte-content strong { font-weight: 700; }
    .rte-content code {
      font-family: ui-monospace, Menlo, monospace;
      background: ${theme.codeBg};
      color: ${theme.accent};
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .rte-content .checklist-line { color: ${theme.text}; }
    .rte-content .md-embed {
      display: block;
      margin: 8px 0;
      padding: 12px 14px;
      border-radius: 12px;
      background: ${theme.surfaceAlt};
      color: ${theme.textMuted};
      font-size: 0.9em;
      user-select: none;
    }
    .rte-content:empty:before,
    .rte-content p:only-child:empty:before {
      content: attr(data-placeholder);
      color: ${theme.textMuted};
    }
  `;
}
