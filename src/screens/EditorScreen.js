import { useSafeAreaInsets } from "react-native-safe-area-context";

import SwipeBack from "../navigation/SwipeBack";
import EditorPane from "../components/EditorPane";
import { useTheme } from "../theme/ThemeContext";

// Full-screen, distraction-free note editor. Swipe from the left edge (or
// tap back) to return to the list.
export default function EditorScreen({ route, navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const noteId = route.params?.noteId;

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <EditorPane noteId={noteId} onBack={() => navigation.goBack()} />
    </SwipeBack>
  );
}
