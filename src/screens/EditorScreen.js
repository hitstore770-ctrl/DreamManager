import { useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import SwipeBack from "../navigation/SwipeBack";
import EditorPane from "../components/EditorPane";
import { useTheme } from "../theme/ThemeContext";

// Full-screen, distraction-free note editor. Swipe from the left edge (or
// tap back) to return to the list.
export default function EditorScreen({ route, navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const noteId = route.params?.noteId;
  const flushRef = useRef(null);

  const goBack = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Await the save before navigating -- the list screen underneath
    // refetches the instant navigation starts, so an unawaited flush would
    // still lose the race. See the comment on EditorPane's `flushRef` prop.
    await flushRef.current?.();
    navigation.goBack();
  };

  return (
    <SwipeBack onDismiss={goBack} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <EditorPane noteId={noteId} onBack={goBack} flushRef={flushRef} />
    </SwipeBack>
  );
}
