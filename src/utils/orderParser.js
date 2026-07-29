// Turning a spoken (or typed) line into cart lines.
//
// "שתי פחיות ועוד טוסט" has to become 2 × פחית שתייה and 1 × טוסט. Two things
// make that harder in Hebrew than the English equivalent:
//
//  1. Numbers are words far more often than digits, and they inflect for
//     gender — שני/שתי, שלושה/שלוש. Both forms have to hit the same value.
//  2. Nouns take prefixes (ו, ה, ב, ל, מ) and plurals, so a raw
//     `name.includes(word)` misses "פחיות" against "פחית".
//
// So matching is by token overlap against a stemmed form, with a threshold —
// and anything under it is returned as an *unmatched* fragment rather than
// guessed at. A register that silently rings up the wrong item because it
// half-recognised a word is worse than one that says it did not understand.

const NUMBER_WORDS = {
  אחד: 1,
  אחת: 1,
  שניים: 2,
  שתיים: 2,
  שני: 2,
  שתי: 2,
  זוג: 2,
  שלושה: 3,
  שלוש: 3,
  ארבעה: 4,
  ארבע: 4,
  חמישה: 5,
  חמש: 5,
  שישה: 6,
  שש: 6,
  שבעה: 7,
  שבע: 7,
  שמונה: 8,
  תשעה: 9,
  תשע: 9,
  עשרה: 10,
  עשר: 10,
};

// Words that carry no product meaning and would otherwise pollute the overlap
// score — "עוד טוסט" should match on טוסט alone.
const STOPWORDS = new Set(["ועוד", "עוד", "בבקשה", "תן", "לי", "של", "עם", "בלי", "אחד", "אחת", "פלוס", "גם", "את"]);

// Connectors that separate two orders, folded to commas before splitting.
//
// `\b` is useless here: JavaScript's word boundary is defined against [A-Za-z0-9_],
// so `\bועוד\b` never matches a Hebrew word at all — it silently made the
// whole sentence one fragment. Whitespace anchors are what actually work.
const CONNECTORS = /(?:^|\s)(?:ועוד|פלוס|וגם)(?=\s|$)/g;
const SPLITTERS = /[,+\n;]+/;

// Hebrew's five final forms are the same letters. Without folding them, the
// plural "מטענים" stems to טענ while the singular "מטען" stems to טען, and the
// two never meet — the word matches itself in one number and not the other.
const FINALS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

export function normalize(word) {
  return String(word || "")
    .replace(/["'׳״]/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c]);
}

// Every plausible form of a word, rather than one stem.
//
// A single stem forces a guess: strip the ו/ה/ב/ל/מ/כ/ש prefix and "כבלים"
// becomes בל, which is too short to match anything and short enough to match
// the wrong things. Keeping the candidates — with and without the prefix, with
// and without the plural ending — means the comparison can find the form the
// two words actually share instead of betting on one.
export function forms(word) {
  const base = normalize(word);
  const out = new Set();
  if (!base) return out;

  const add = (w) => {
    if (w && w.length >= 2) out.add(w);
  };

  // Feminine plurals do not just drop a suffix, they swap one: פחית becomes
  // פחיות, not פחיתים. Offering both singular endings back is what lets the
  // plural a customer says meet the singular the price list is written in.
  const withSuffixes = (w) => {
    add(w);
    add(w.replace(/(יות|ות|ים)$/, ""));
    if (w.endsWith("ות")) {
      add(`${w.slice(0, -2)}ת`);
      add(`${w.slice(0, -2)}ה`);
    }
  };

  withSuffixes(base);

  if (base.length > 3 && /^[והבלמכש]/.test(base)) {
    withSuffixes(base.slice(1));
  }

  return out;
}

function tokens(text) {
  return String(text || "")
    .split(/\s+/)
    .map((t) => t.replace(/[^֐-׿a-zA-Z0-9]/g, ""))
    .filter(Boolean);
}

// Two words match when any of their forms coincide, or when one form is a
// prefix of another and long enough to mean something.
//
// The prefix rule is what carries the irregular plurals that suffix-stripping
// alone cannot reach: עוגייה pluralises to עוגיות, which stems to עוג — not a
// suffix of the singular, but a prefix of it. Three characters is the floor;
// below that a stem stops naming one product and starts naming several.
const sharesForm = (a, b) => {
  for (const f of a) {
    if (b.has(f)) return true;
    for (const g of b) {
      const short = f.length <= g.length ? f : g;
      const long = f.length <= g.length ? g : f;
      if (short.length >= 3 && long.startsWith(short)) return true;
    }
  }
  return false;
};

// Every form of every word in the deck, used to decide whether a ו-prefixed
// word is "and X" or just a word that happens to start with vav.
function deckFormIndex(items) {
  const index = new Set();
  items.forEach((item) => tokens(item.name).forEach((t) => forms(t).forEach((f) => index.add(f))));
  return index;
}

// Hebrew writes "and" as a prefix rather than a word, so "וקפה קר" is a second
// order glued to the first with no separator to split on. Splitting on every
// ו would shred ordinary words; splitting only where the remainder names
// something in the deck is a check the sentence itself has to pass.
function splitConjunctions(fragment, index) {
  const raw = tokens(fragment);
  const out = [];
  let current = [];

  raw.forEach((t, i) => {
    const n = normalize(t);
    if (i > 0 && current.length && n.length > 3 && n.startsWith("ו")) {
      const bare = n.slice(1);
      const namesSomething = [...forms(bare)].some((f) => index.has(f));
      if (namesSomething) {
        out.push(current.join(" "));
        current = [];
      }
    }
    current.push(t);
  });

  if (current.length) out.push(current.join(" "));
  return out;
}

// How well a fragment names a product.
//
// Scored both ways round and the better one taken, because the two failure
// modes are opposite. Normalising by the product's words alone means
// "3 מטענים" scores 1/3 against "מטען מהיר 20W" and falls under the bar,
// even though it plainly names that item. Normalising by the fragment's words
// alone would let one incidental word drag in a product. Taking the max of the
// two lets a short request name a long product, while a fragment full of words
// that hit nothing still scores zero.
function score(fragmentForms, itemName) {
  const want = tokens(itemName).map(forms).filter((f) => f.size);
  if (!want.length || !fragmentForms.length) return 0;

  let hits = 0;
  want.forEach((w) => {
    if (fragmentForms.some((h) => sharesForm(h, w))) hits += 1;
  });
  if (!hits) return 0;

  return Math.max(hits / want.length, hits / fragmentForms.length);
}

const MATCH_THRESHOLD = 0.5;

export function parseOrderText(text, items) {
  const deck = Array.isArray(items) ? items : [];
  const lines = [];
  const unmatched = [];

  const index = deckFormIndex(deck);

  String(text || "")
    .replace(CONNECTORS, ",")
    .split(SPLITTERS)
    .map((f) => f.trim())
    .filter(Boolean)
    .flatMap((f) => splitConjunctions(f, index))
    .forEach((fragment) => {
      const raw = tokens(fragment);
      if (!raw.length) return;

      // Quantity: a digit anywhere, else a number word, else one.
      let qty = 1;
      const digit = raw.find((t) => /^\d+$/.test(t));
      if (digit) {
        qty = parseInt(digit, 10);
      } else {
        const word = raw.find((t) => NUMBER_WORDS[normalize(t)] != null);
        if (word) qty = NUMBER_WORDS[normalize(word)];
      }
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      if (qty > 99) qty = 99; // a dictation artefact, not an order

      const meaningful = raw.filter(
        (t) => !/^\d+$/.test(t) && !STOPWORDS.has(normalize(t)) && NUMBER_WORDS[normalize(t)] == null
      );
      if (!meaningful.length) return;

      const fragmentForms = meaningful.map(forms).filter((f) => f.size);

      let best = null;
      let bestScore = 0;
      deck.forEach((item) => {
        const sc = score(fragmentForms, item.name);
        if (sc > bestScore) {
          bestScore = sc;
          best = item;
        }
      });

      if (best && bestScore >= MATCH_THRESHOLD) lines.push({ item: best, qty });
      else unmatched.push(fragment);
    });

  // Same product named twice in one dictation is one cart line.
  const merged = [];
  lines.forEach((line) => {
    const found = merged.find((m) => m.item.sku === line.item.sku);
    if (found) found.qty += line.qty;
    else merged.push({ ...line });
  });

  return { lines: merged, unmatched };
}
