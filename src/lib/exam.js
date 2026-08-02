import { parseBlocks } from "./markdown";

// Turns a note's raw markdown into exam questions, reusing the *existing*
// checklist syntax rather than inventing new markup: the heading/paragraph
// right before a run of checklist lines is the question stem, and within
// that run "- [x]" marks the correct option(s), "- [ ]" a distractor --
// exactly what a note tagged #questions already looks like when someone
// writes a self-quiz by hand.
//
// Blank blocks are skipped rather than treated as group boundaries: the
// WYSIWYG editor's HTML->markdown pass (domToMarkdown) inserts a blank
// line after *every* paragraph-level element, including each checklist
// line, so a question typed through the actual editor UI has a blank
// between every option -- treating that as "end of group" would mean no
// question typed through the app itself could ever be extracted.
export function extractQuestions(body) {
  const blocks = parseBlocks(body);
  const questions = [];
  let stem = "";
  let current = null;

  const flush = () => {
    if (current && current.options.length >= 2 && current.options.some((o) => o.correct)) {
      questions.push(current);
    }
    current = null;
  };

  for (const block of blocks) {
    if (block.type === "blank") continue;
    if (block.type === "checklist") {
      if (!current) current = { stem, options: [] };
      current.options.push({ text: block.text, correct: block.checked });
      continue;
    }
    flush();
    stem = block.type === "heading" || block.type === "paragraph" ? block.text : "";
  }
  flush();

  return questions;
}
