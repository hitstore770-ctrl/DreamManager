// Safe arithmetic — a small tokenizer + shunting-yard evaluator. Deliberately
// NOT using eval(): only digits, . + - * / % ( ) are ever interpreted, so
// arbitrary note text can be scanned without executing anything.

const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };

export function evalArithmetic(expr) {
  if (typeof expr !== "string" || !/\d/.test(expr)) return null;
  // reject anything outside the allowed character set
  if (expr.replace(/[\d.\s+\-*/()%]/g, "") !== "") return null;

  const tokens = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/()%])/g);
  if (!tokens) return null;

  const out = [];
  const ops = [];
  let prev = null; // 'num' | 'op' | null
  for (const t of tokens) {
    if (/[\d.]/.test(t[0])) {
      const n = parseFloat(t);
      if (!isFinite(n)) return null;
      out.push(n);
      prev = "num";
    } else if (t === "(") {
      ops.push(t);
      prev = "op";
    } else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop());
      if (!ops.length) return null;
      ops.pop();
      prev = "num";
    } else {
      // operator — handle a leading/after-operator minus as unary
      if (t === "-" && (prev === null || prev === "op")) out.push(0);
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        PREC[ops[ops.length - 1]] >= PREC[t]
      ) {
        out.push(ops.pop());
      }
      ops.push(t);
      prev = "op";
    }
  }
  while (ops.length) {
    const o = ops.pop();
    if (o === "(") return null;
    out.push(o);
  }

  const st = [];
  for (const tok of out) {
    if (typeof tok === "number") {
      st.push(tok);
    } else {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) return null;
      let r;
      if (tok === "+") r = a + b;
      else if (tok === "-") r = a - b;
      else if (tok === "*") r = a * b;
      else if (tok === "%") r = a % b;
      else r = b === 0 ? NaN : a / b;
      st.push(r);
    }
  }
  if (st.length !== 1 || !isFinite(st[0])) return null;
  return Math.round(st[0] * 1e6) / 1e6;
}

// Find inline expressions written as "50*4=" (an expression immediately
// followed by '=' that isn't already answered) so the editor can suggest the
// result. Returns [{ expr, value, index, end }].
export function scanInlineMath(text) {
  if (!text) return [];
  const results = [];
  const re = /([\d.]+(?:\s*[+\-*/%]\s*[\d.]+)+)\s*=(?!\s*[\d.])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = evalArithmetic(m[1]);
    if (value !== null) {
      results.push({ expr: m[1].trim(), value, index: m.index, end: m.index + m[0].length });
    }
  }
  return results;
}

// Sum every standalone number found in the text (for the auto-sum footer).
export function autoSum(text) {
  if (!text) return { count: 0, total: 0 };
  const nums = (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => isFinite(n));
  const total = nums.reduce((a, b) => a + b, 0);
  return { count: nums.length, total: Math.round(total * 1e6) / 1e6 };
}
