import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

// ---- Safe expression evaluator (shunting-yard, no eval) -------------------
function tokenize(expr) {
  const out = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " ") {
      i += 1;
    } else if ("+-*/()".includes(ch)) {
      out.push(ch);
      i += 1;
    } else if (/[0-9.]/.test(ch)) {
      let num = ch;
      i += 1;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i += 1;
      }
      out.push(num);
    } else {
      i += 1; // skip unknown
    }
  }
  return out;
}

function toRpn(tokens) {
  const prec = { u: 4, "*": 3, "/": 3, "+": 2, "-": 2 };
  const right = { u: true };
  const output = [];
  const ops = [];
  let prev = null;
  tokens.forEach((tk) => {
    if (/[0-9.]/.test(tk[0])) {
      output.push(tk);
    } else if (tk === "(") {
      ops.push(tk);
    } else if (tk === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop());
      ops.pop();
    } else {
      // operator — detect unary minus/plus
      let op = tk;
      const unary = prev === null || prev === "(" || "+-*/u".includes(prev);
      if (unary && tk === "-") op = "u";
      if (unary && tk === "+") {
        prev = tk;
        return; // unary plus: no-op
      }
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        (prec[ops[ops.length - 1]] > prec[op] ||
          (prec[ops[ops.length - 1]] === prec[op] && !right[op]))
      ) {
        output.push(ops.pop());
      }
      ops.push(op);
    }
    prev = tk;
  });
  while (ops.length) output.push(ops.pop());
  return output;
}

function evalExpr(expr) {
  try {
    const rpn = toRpn(tokenize(expr));
    const st = [];
    rpn.forEach((tk) => {
      if (/[0-9.]/.test(tk[0])) {
        st.push(parseFloat(tk));
      } else if (tk === "u") {
        st.push(-st.pop());
      } else {
        const b = st.pop();
        const a = st.pop();
        if (a === undefined || b === undefined) throw new Error("bad");
        if (tk === "+") st.push(a + b);
        else if (tk === "-") st.push(a - b);
        else if (tk === "*") st.push(a * b);
        else if (tk === "/") st.push(a / b);
      }
    });
    const r = st.pop();
    if (st.length > 0 || r === undefined || Number.isNaN(r) || !Number.isFinite(r)) return null;
    return r;
  } catch {
    return null;
  }
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  const rounded = Math.round((n + Number.EPSILON) * 1e6) / 1e6;
  const [intPart, dec] = String(rounded).split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${withSep}.${dec}` : withSep;
}

const KEYS = [
  ["(", ")", "⌫", "C"],
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", "=", "+"],
];

const DEFAULT_BUCKETS = [
  { name: "חיסכון", pct: "20" },
  { name: "הוצאות", pct: "50" },
  { name: "מעשר", pct: "10" },
  { name: "פנאי", pct: "20" },
];

export default function MasterCalculator() {
  const [expr, setExpr] = useState("");
  const [tape, setTape] = usePersistentState(STORAGE_KEYS.calcTape, []);
  const [memory, setMemory] = usePersistentState(STORAGE_KEYS.calcMemory, 0);

  const [buckets, setBuckets] = useState(DEFAULT_BUCKETS);
  const [usdRate, setUsdRate] = useState("3.7");
  const [people, setPeople] = useState("2");
  const [discount, setDiscount] = useState("10");
  const [rate, setRate] = useState("40");
  const [hours, setHours] = useState("8");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [ppuPrice, setPpuPrice] = useState("");
  const [ppuUnits, setPpuUnits] = useState("");

  const live = useMemo(() => (expr ? evalExpr(expr) : 0), [expr]);
  const current = live ?? 0;

  const pushTape = (label, val) =>
    setTape((prev) => [{ id: Date.now().toString(), label, val }, ...prev].slice(0, 40));

  const press = (k) => {
    if (k === "C") {
      setExpr("");
    } else if (k === "⌫") {
      setExpr((e) => e.slice(0, -1));
    } else if (k === "=") {
      const r = evalExpr(expr);
      if (r !== null) {
        pushTape(expr, r);
        setExpr(String(Math.round((r + Number.EPSILON) * 1e6) / 1e6));
      }
    } else {
      setExpr((e) => e + k);
    }
  };

  const applyResult = (val) => {
    setExpr(String(Math.round((val + Number.EPSILON) * 1e6) / 1e6));
  };

  const copyResult = async () => {
    await Clipboard.setStringAsync(fmt(current));
    Alert.alert("הועתק ✓", fmt(current));
  };

  // Memory
  const mPlus = () => setMemory((m) => m + current);
  const mMinus = () => setMemory((m) => m - current);
  const mRecall = () => applyResult(memory);
  const mClear = () => setMemory(0);

  // Pro functions
  const maaser = () => {
    const v = current * 0.1;
    pushTape(`מעשר 10% מ-${fmt(current)}`, v);
    applyResult(v);
  };
  const vatAdd = () => {
    const v = current * 1.17;
    pushTape(`+מע״מ 17% על ${fmt(current)}`, v);
    applyResult(v);
  };
  const vatRemove = () => {
    const v = current / 1.17;
    pushTape(`מחיר לפני מע״מ מ-${fmt(current)}`, v);
    applyResult(v);
  };
  const toIls = () => {
    const v = current * (Number(usdRate) || 0);
    pushTape(`$${fmt(current)} → ₪`, v);
    applyResult(v);
  };
  const splitBill = () => {
    const p = parseInt(people, 10) || 1;
    const v = current / p;
    pushTape(`חלוקה ל-${p} → לאחד`, v);
    applyResult(v);
  };
  const applyDiscount = () => {
    const d = Number(discount) || 0;
    const v = current * (1 - d / 100);
    pushTape(`הנחה ${d}% מ-${fmt(current)}`, v);
    applyResult(v);
  };
  const hourlyTotal = () => {
    const v = (Number(rate) || 0) * (Number(hours) || 0);
    pushTape(`${fmt(Number(rate))}₪ × ${hours} שע׳`, v);
    applyResult(v);
  };
  const marginResult = useMemo(() => {
    const c = Number(cost) || 0;
    const p = Number(price) || 0;
    if (c <= 0) return null;
    return { profit: p - c, margin: ((p - c) / c) * 100 };
  }, [cost, price]);
  const ppu = useMemo(() => {
    const p = Number(ppuPrice) || 0;
    const u = Number(ppuUnits) || 0;
    if (u <= 0) return null;
    return p / u;
  }, [ppuPrice, ppuUnits]);

  const bucketTotalPct = buckets.reduce((s, b) => s + (Number(b.pct) || 0), 0);
  const setBucketPct = (i, v) =>
    setBuckets((prev) => prev.map((b, idx) => (idx === i ? { ...b, pct: v } : b)));

  return (
    <View>
      {/* Display */}
      <View style={styles.display}>
        <View style={styles.memRow}>
          <Text style={styles.memText}>{memory !== 0 ? `M: ${fmt(memory)}` : " "}</Text>
          <Text style={styles.exprText} numberOfLines={1}>
            {expr || "0"}
          </Text>
        </View>
        <Text style={styles.resultText} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(current)}
        </Text>
        <TouchableOpacity style={styles.copyAll} onPress={copyResult} activeOpacity={0.85}>
          <Text style={styles.copyAllText}>📋 העתק תוצאה</Text>
        </TouchableOpacity>
      </View>

      {/* Memory row */}
      <View style={styles.memBtnRow}>
        {[
          { l: "M+", fn: mPlus },
          { l: "M-", fn: mMinus },
          { l: "MR", fn: mRecall },
          { l: "MC", fn: mClear },
        ].map((b) => (
          <TouchableOpacity key={b.l} style={styles.memBtn} onPress={b.fn} activeOpacity={0.85}>
            <Text style={styles.memBtnText}>{b.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k) => {
              const isOp = "/*-+=".includes(k);
              const isCtrl = k === "C" || k === "⌫";
              return (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.key,
                    isOp && styles.keyOp,
                    isCtrl && styles.keyCtrl,
                    k === "=" && styles.keyEq,
                  ]}
                  onPress={() => press(k)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.keyText, (isOp || isCtrl) && styles.keyTextLight]}>{k}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Quick pro buttons operating on current result */}
      <Text style={styles.sectionTitle}>פעולות מהירות על התוצאה</Text>
      <View style={styles.proGrid}>
        <ProBtn label="מעשר 10%" onPress={maaser} color={COLORS.mustard} dark />
        <ProBtn label="+ מע״מ 17%" onPress={vatAdd} color={COLORS.navy} />
        <ProBtn label="− מע״מ 17%" onPress={vatRemove} color={COLORS.navy} />
      </View>

      {/* USD -> ILS */}
      <ProCard title="דולר → שקל">
        <View style={styles.inlineRow}>
          <MiniInput label="שער $" value={usdRate} onChange={setUsdRate} />
          <TouchableOpacity style={styles.goBtn} onPress={toIls} activeOpacity={0.85}>
            <Text style={styles.goBtnText}>המר</Text>
          </TouchableOpacity>
        </View>
      </ProCard>

      {/* Split bill */}
      <ProCard title="חלוקת חשבון">
        <View style={styles.inlineRow}>
          <MiniInput label="כמה אנשים" value={people} onChange={setPeople} />
          <TouchableOpacity style={styles.goBtn} onPress={splitBill} activeOpacity={0.85}>
            <Text style={styles.goBtnText}>חלק</Text>
          </TouchableOpacity>
        </View>
      </ProCard>

      {/* Discount */}
      <ProCard title="חישוב הנחה">
        <View style={styles.inlineRow}>
          <MiniInput label="אחוז הנחה" value={discount} onChange={setDiscount} />
          <TouchableOpacity style={styles.goBtn} onPress={applyDiscount} activeOpacity={0.85}>
            <Text style={styles.goBtnText}>הפחת</Text>
          </TouchableOpacity>
        </View>
      </ProCard>

      {/* Hourly -> cash */}
      <ProCard title="שכר לפי שעות">
        <View style={styles.inlineRow}>
          <MiniInput label="₪ לשעה" value={rate} onChange={setRate} />
          <MiniInput label="שעות" value={hours} onChange={setHours} />
          <TouchableOpacity style={styles.goBtn} onPress={hourlyTotal} activeOpacity={0.85}>
            <Text style={styles.goBtnText}>חשב</Text>
          </TouchableOpacity>
        </View>
      </ProCard>

      {/* Profit margin from cost */}
      <ProCard title="רווחיות מעלות">
        <View style={styles.inlineRow}>
          <MiniInput label="עלות ₪" value={cost} onChange={setCost} />
          <MiniInput label="מחיר ₪" value={price} onChange={setPrice} />
        </View>
        {marginResult && (
          <Text style={styles.proResult}>
            רווח {fmt(marginResult.profit)}₪ · מרווח {marginResult.margin.toFixed(1)}%
          </Text>
        )}
      </ProCard>

      {/* Price per unit */}
      <ProCard title="מחיר ליחידה">
        <View style={styles.inlineRow}>
          <MiniInput label="מחיר כולל ₪" value={ppuPrice} onChange={setPpuPrice} />
          <MiniInput label="יחידות" value={ppuUnits} onChange={setPpuUnits} />
        </View>
        {ppu != null && <Text style={styles.proResult}>{fmt(ppu)}₪ ליחידה</Text>}
      </ProCard>

      {/* Salary / profit splitter */}
      <ProCard title={`מפצל אחוזים (סה״כ ${bucketTotalPct}%)`}>
        {buckets.map((b, i) => (
          <View key={b.name} style={styles.bucketRow}>
            <Text style={styles.bucketAmount}>{fmt(current * ((Number(b.pct) || 0) / 100))}₪</Text>
            <View style={styles.bucketPctBox}>
              <TextInput
                style={styles.bucketPctInput}
                value={b.pct}
                onChangeText={(v) => setBucketPct(i, v)}
                keyboardType="numeric"
                textAlign="center"
              />
              <Text style={styles.bucketPctSign}>%</Text>
            </View>
            <Text style={styles.bucketName}>{b.name}</Text>
          </View>
        ))}
      </ProCard>

      {/* Tape */}
      <View style={styles.tapeHeader}>
        <TouchableOpacity onPress={() => setTape([])} activeOpacity={0.8}>
          <Text style={styles.tapeClear}>נקה</Text>
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>סרט חישובים</Text>
      </View>
      {tape.length === 0 ? (
        <Text style={styles.empty}>אין חישובים עדיין</Text>
      ) : (
        <ScrollView style={styles.tape} nestedScrollEnabled>
          {tape.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.tapeRow}
              onPress={() => applyResult(t.val)}
              activeOpacity={0.8}
            >
              <Text style={styles.tapeVal}>{fmt(t.val)}</Text>
              <Text style={styles.tapeLabel} numberOfLines={1}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ProBtn({ label, onPress, color, dark }) {
  return (
    <TouchableOpacity
      style={[styles.proBtn, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.proBtnText, dark && { color: COLORS.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProCard({ title, children }) {
  return (
    <View style={styles.proCard}>
      <Text style={styles.proCardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MiniInput({ label, value, onChange }) {
  return (
    <View style={styles.miniWrap}>
      <Text style={styles.miniLabel}>{label}</Text>
      <TextInput
        style={styles.miniInput}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        textAlign="center"
        placeholder="0"
        placeholderTextColor={COLORS.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  display: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 16,
    marginBottom: 12,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  memRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  memText: { color: COLORS.navy, fontSize: 12, fontFamily: FONTS.bold },
  exprText: { flex: 1, color: COLORS.textMuted, fontSize: 16, fontFamily: FONTS.regular, textAlign: "left", marginStart: 10 },
  resultText: { color: COLORS.textPrimary, fontSize: 40, fontFamily: FONTS.bold, textAlign: "left", marginVertical: 6 },
  copyAll: {
    backgroundColor: COLORS.success,
    borderRadius: RADIUS,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
    ...BRUTAL_BORDER,
  },
  copyAllText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  memBtnRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  memBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS,
    backgroundColor: COLORS.mustard,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  memBtnText: { color: COLORS.textPrimary, fontSize: 15, fontFamily: FONTS.bold },
  keypad: { marginBottom: 8 },
  keyRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  key: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  keyOp: { backgroundColor: COLORS.navy },
  keyCtrl: { backgroundColor: COLORS.danger },
  keyEq: { backgroundColor: COLORS.success },
  keyText: { color: COLORS.textPrimary, fontSize: 22, fontFamily: FONTS.bold },
  keyTextLight: { color: "#FFFFFF" },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 12,
    marginBottom: 10,
  },
  proGrid: { flexDirection: "row", gap: 8, marginBottom: 4 },
  proBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  proBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
  proCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 12,
    marginTop: 10,
    ...BRUTAL_BORDER,
  },
  proCardTitle: { color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 10 },
  inlineRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  miniWrap: { flex: 1 },
  miniLabel: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 4 },
  miniInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
    ...BRUTAL_BORDER,
  },
  goBtn: {
    paddingHorizontal: 18,
    height: 42,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  goBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  proResult: { color: COLORS.success, fontSize: 15, fontFamily: FONTS.bold, textAlign: "right", marginTop: 10 },
  bucketRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  bucketAmount: { flex: 1, color: COLORS.success, fontSize: 15, fontFamily: FONTS.bold, textAlign: "left" },
  bucketPctBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 10 },
  bucketPctInput: {
    width: 48,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingVertical: 6,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.bold,
    ...BRUTAL_BORDER,
  },
  bucketPctSign: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.bold, marginStart: 3 },
  bucketName: { width: 70, color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.bold, textAlign: "right" },
  tapeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tapeClear: { color: COLORS.danger, fontSize: 13, fontFamily: FONTS.bold },
  tape: {
    maxHeight: 200,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    padding: 8,
    ...BRUTAL_BORDER,
  },
  tapeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: "#EEE",
  },
  tapeVal: { color: COLORS.textPrimary, fontSize: 16, fontFamily: FONTS.bold },
  tapeLabel: { flex: 1, color: COLORS.textMuted, fontSize: 12, fontFamily: FONTS.regular, textAlign: "right", marginStart: 10 },
  empty: { color: COLORS.textMuted, fontSize: 13, fontFamily: FONTS.regular, textAlign: "center", paddingVertical: 12 },
});
