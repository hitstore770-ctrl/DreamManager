import Svg, { Circle } from "react-native-svg";
import { View } from "react-native";

import CustomText from "../CustomText";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { UI } from "../../utils/ui";

// A progress ring, kept to two strokes and a number.
//
// The arc starts at twelve o'clock and runs clockwise, which is the one
// convention people read without thinking. `strokeLinecap="round"` matters
// more than it looks: a butt cap at 2% renders as a hard little wedge that
// reads as a rendering artefact rather than as progress just beginning.

export default function CircularProgress({
  progress = 0,
  size = 62,
  stroke = 6,
  color = UI.violet,
  track = "#E7EAF0",
  label,
  testID,
}) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          // SVG angles start at three o'clock; a quarter turn back puts the
          // start of the arc at the top.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <CustomText
        testID={testID}
        style={{ fontFamily: FONTS.bold, fontSize: size * 0.26, color: UI.ink }}
      >
        {label ?? `${Math.round(clamped * 100)}%`}
      </CustomText>
    </View>
  );
}
