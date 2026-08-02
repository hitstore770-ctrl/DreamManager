import { TextInput } from "react-native";
import { defaultLetterSpacing, familyForWeight, flattenStyleProp } from "../theme/typography";
import { useSettings } from "../settings/SettingsContext";

// Same idea as AppText, for typed/placeholder text in inputs — so a
// TextInput's content doesn't visually clash with the Rubik labels around
// it. Line-height is left alone here: multi-line editors already set their
// own carefully (the Zen typewriter math depends on it), and single-line
// inputs don't need it.
export default function AppTextInput({ style, ...props }) {
  const { fontScale } = useSettings();
  const explicitFamily = flattenStyleProp(style, "fontFamily");
  if (explicitFamily) {
    return <TextInput {...props} style={style} />;
  }

  const weight = flattenStyleProp(style, "fontWeight");
  const fontSize = (flattenStyleProp(style, "fontSize") ?? 15) * fontScale;
  const hasLetterSpacing = flattenStyleProp(style, "letterSpacing") != null;

  const base = {
    fontFamily: familyForWeight(weight),
    ...(hasLetterSpacing ? null : { letterSpacing: defaultLetterSpacing(fontSize) }),
  };

  return <TextInput {...props} style={[base, style, { fontSize }]} />;
}
