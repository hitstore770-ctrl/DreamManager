// Turns a note's nested markdown bullet list into a tree, then a tidy
// left-to-right layout, for MindMapScreen to draw as SVG. Deliberately
// works off raw indentation (not parseBlocks' flat bullet blocks, which
// discard indent) since indent depth *is* the tree structure here.
//
// The negative lookahead excludes checklist lines ("- [ ] x" / "- [x] x")
// -- they match a plain bullet pattern too, and without this a task list
// or exam question block sitting next to a real bullet list (separated by
// nothing but the editor's usual blank line) would get pulled into the
// same forest as actual mind-map content.
const BULLET_RE = /^(\s*)[-*]\s+(?!\[[ xX]\]\s)(.*)$/;

// A note can contain several separate bullet lists; the one with the most
// items is almost always the one meant to become a map, so pick that run
// rather than merging unrelated lists together. A blank line does *not*
// end a run -- the WYSIWYG editor inserts one after every paragraph-level
// element, including each bullet, so a list typed through the app's own
// editor UI has a blank between every item.
export function extractMindMapTree(body) {
  const lines = (body || "").split("\n");
  const forests = [];
  let stack = null;

  for (const line of lines) {
    const m = line.match(BULLET_RE);
    if (!m) {
      if (line.trim() !== "") stack = null;
      continue;
    }
    if (!stack) {
      stack = [];
      forests.push({ roots: [], stack });
    }
    const forest = forests[forests.length - 1];
    const indentLen = m[1].length;
    const node = { text: m[2].trim(), children: [] };
    while (stack.length && stack[stack.length - 1].indentLen >= indentLen) stack.pop();
    if (stack.length === 0) forest.roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ indentLen, node });
  }

  let best = null;
  let bestCount = 0;
  for (const f of forests) {
    const count = countNodes(f.roots);
    if (count > bestCount) {
      best = f.roots;
      bestCount = count;
    }
  }
  if (!best) return null;

  // Multiple top-level bullets need one synthetic trunk to branch from.
  return best.length === 1 ? best[0] : { text: "", children: best };
}

function countNodes(nodes) {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function assignPositions(node, depth, leafCounter) {
  const children = node.children.map((c) => assignPositions(c, depth + 1, leafCounter));
  let y;
  if (children.length === 0) {
    y = leafCounter.n;
    leafCounter.n += 1;
  } else {
    const ys = children.map((c) => c.y);
    y = (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  return { text: node.text, depth, y, children };
}

function flatten(node, parent, nodes, edges) {
  nodes.push(node);
  if (parent) edges.push({ x1: parent.x, y1: parent.y, text1: parent.text, x2: node.x, y2: node.y });
  node.children.forEach((c) => flatten(c, node, nodes, edges));
}

export function layoutMindMap(root, { levelGap = 210, rowGap = 44 } = {}) {
  const positioned = assignPositions(root, 0, { n: 0 });
  // assignPositions returns y in "leaf slots"; convert to pixels and add x
  // in a second pass now that depth is known everywhere.
  const scale = (node) => {
    node.x = node.depth * levelGap;
    node.y = node.y * rowGap;
    node.children.forEach(scale);
  };
  scale(positioned);

  const nodes = [];
  const edges = [];
  flatten(positioned, null, nodes, edges);

  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const maxY = Math.max(...nodes.map((n) => n.y));
  return { nodes, edges, width: (maxDepth + 1) * levelGap, height: maxY + rowGap };
}
