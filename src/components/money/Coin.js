import { memo } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Polygon,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

// A struck metal coin, not a coloured circle.
//
// Four things do the work, and removing any one of them collapses it back into
// a disc: a radial face gradient offset toward the light source, a *counter*-lit
// rim (bright where the face is dark, so the edge reads as a bevel rather than
// an outline), reeded milling around the circumference, and a numeral drawn
// three times — dark down-right, light up-left, metal on top — which is what
// embossing physically is.
//
// The light source is fixed at the upper left for every coin in the app. Coins
// lit from different directions in the same tray look like stickers.

const METALS = {
  // Israeli coinage is genuinely two alloys: 10 agorot and ½ ₪ are aluminium
  // bronze (golden), 1/2/5 ₪ are nickel (white), and the 10 ₪ is bimetallic.
  gold: { lite: "#FBEBB8", mid: "#D9AE5A", dark: "#8A6222", edge: "#6B4A18", ink: "#5A3D12" },
  silver: { lite: "#FBFDFF", mid: "#C4CDDA", dark: "#78838F", edge: "#5C6673", ink: "#4A535E" },
};

// agorot -> how the coin is actually struck.
const SPEC = {
  10: { metal: "gold", face: "10", sub: "אג׳", sides: 0 },
  50: { metal: "gold", face: "½", sub: "₪", sides: 0 },
  100: { metal: "silver", face: "1", sub: "₪", sides: 0 },
  200: { metal: "silver", face: "2", sub: "₪", sides: 0 },
  // The 5 ₪ coin is a dodecagon. Rendering it round would be the one detail a
  // user who has held one would notice immediately.
  500: { metal: "silver", face: "5", sub: "₪", sides: 12 },
  // Bimetallic: golden ring, white centre.
  1000: { metal: "gold", core: "silver", face: "10", sub: "₪", sides: 0 },
};

export function coinSpec(agorot) {
  return SPEC[agorot] || SPEC[100];
}

function polygonPoints(cx, cy, r, sides, rotation = Math.PI / sides) {
  const pts = [];
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function Coin({ agorot = 100, size = 56, style }) {
  const spec = coinSpec(agorot);
  const m = METALS[spec.metal];
  const core = spec.core ? METALS[spec.core] : null;

  const uid = `c${agorot}${Math.round(size)}`;
  const c = size / 2;
  const r = c - 1; // leave a pixel so the milling is not clipped
  const faceR = r * 0.84;
  const coreR = r * 0.6;
  const numeralR = core ? coreR : faceR;
  const numeral = core ? core : m;

  // Milling ticks. Below ~34px the ticks alias into a grey fuzz, so drop them
  // and let the rim gradient carry the edge on its own.
  const teeth = size >= 34 ? Math.max(24, Math.round(size * 0.9)) : 0;
  const ticks = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = (i * 2 * Math.PI) / teeth;
    ticks.push(
      <Line
        key={i}
        x1={c + Math.cos(a) * (r - 0.5)}
        y1={c + Math.sin(a) * (r - 0.5)}
        x2={c + Math.cos(a) * (r * 0.9)}
        y2={c + Math.sin(a) * (r * 0.9)}
        stroke={m.edge}
        strokeWidth={Math.max(0.6, size / 70)}
        opacity={0.5}
      />
    );
  }

  const fs = numeralR * (spec.face.length > 1 ? 1.02 : 1.28);
  const emboss = Math.max(0.7, size / 62);
  const numeralY = c + fs * 0.35;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style}>
      <Defs>
        {/* Rim: bright top-left, dark bottom-right — the bevel catching light. */}
        <LinearGradient id={`${uid}rim`} x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={m.lite} />
          <Stop offset="0.42" stopColor={m.mid} />
          <Stop offset="1" stopColor={m.dark} />
        </LinearGradient>
        {/* Face: counter-lit, so the rim reads as raised above it. */}
        <RadialGradient id={`${uid}face`} cx="0.34" cy="0.28" r="0.92">
          <Stop offset="0" stopColor={m.lite} />
          <Stop offset="0.46" stopColor={m.mid} />
          <Stop offset="1" stopColor={m.dark} />
        </RadialGradient>
        {core && (
          <RadialGradient id={`${uid}core`} cx="0.34" cy="0.28" r="0.92">
            <Stop offset="0" stopColor={core.lite} />
            <Stop offset="0.46" stopColor={core.mid} />
            <Stop offset="1" stopColor={core.dark} />
          </RadialGradient>
        )}
        {/* Specular sheen across the upper left. */}
        <LinearGradient id={`${uid}sheen`} x1="0" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {spec.sides ? (
        <>
          <Polygon points={polygonPoints(c, c, r, spec.sides)} fill={`url(#${uid}rim)`} />
          <Polygon points={polygonPoints(c, c, faceR, spec.sides)} fill={`url(#${uid}face)`} />
          <Polygon
            points={polygonPoints(c, c, faceR, spec.sides)}
            fill="none"
            stroke={m.edge}
            strokeWidth={Math.max(0.6, size / 64)}
            opacity={0.55}
          />
        </>
      ) : (
        <>
          <Circle cx={c} cy={c} r={r} fill={`url(#${uid}rim)`} />
          <G>{ticks}</G>
          <Circle cx={c} cy={c} r={faceR} fill={`url(#${uid}face)`} />
          {/* The step down from rim to face. */}
          <Circle
            cx={c}
            cy={c}
            r={faceR}
            fill="none"
            stroke={m.edge}
            strokeWidth={Math.max(0.6, size / 64)}
            opacity={0.5}
          />
        </>
      )}

      {core && (
        <>
          <Circle cx={c} cy={c} r={coreR} fill={`url(#${uid}core)`} />
          <Circle
            cx={c}
            cy={c}
            r={coreR}
            fill="none"
            stroke={core.edge}
            strokeWidth={Math.max(0.6, size / 64)}
            opacity={0.6}
          />
        </>
      )}

      {/* Raised numeral: shadow, highlight, then the metal face on top. */}
      <G>
        <SvgText
          x={c + emboss}
          y={numeralY + emboss}
          fontSize={fs}
          fontWeight="bold"
          textAnchor="middle"
          fill={numeral.ink}
          opacity={0.75}
        >
          {spec.face}
        </SvgText>
        <SvgText
          x={c - emboss * 0.85}
          y={numeralY - emboss * 0.85}
          fontSize={fs}
          fontWeight="bold"
          textAnchor="middle"
          fill="#FFFFFF"
          opacity={0.6}
        >
          {spec.face}
        </SvgText>
        <SvgText x={c} y={numeralY} fontSize={fs} fontWeight="bold" textAnchor="middle" fill={numeral.mid}>
          {spec.face}
        </SvgText>
      </G>

      {/* Sheen last so it lies over the numeral, as a real reflection would. */}
      <Ellipse
        cx={c * 0.7}
        cy={c * 0.62}
        rx={r * 0.62}
        ry={r * 0.44}
        fill={`url(#${uid}sheen)`}
        transform={`rotate(-28 ${c * 0.7} ${c * 0.62})`}
        pointerEvents="none"
      />
    </Svg>
  );
}

export default memo(Coin);
