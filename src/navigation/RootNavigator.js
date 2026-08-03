import { lazy, Suspense } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import NotesListScreen from "../screens/NotesListScreen";
import ArchivedScreen from "../screens/ArchivedScreen";
import EditorScreen from "../screens/EditorScreen";
import SplitWorkspaceScreen from "../screens/SplitWorkspaceScreen";
import TagIndexScreen from "../screens/TagIndexScreen";
import VaultScreen from "../screens/VaultScreen";
import GraphScreen from "../screens/GraphScreen";
import WhiteboardScreen from "../screens/WhiteboardScreen";
import PrintPreviewScreen from "../screens/PrintPreviewScreen";
import CompileScreen from "../screens/CompileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import InboxScreen from "../screens/InboxScreen";
import ExamScreen from "../screens/ExamScreen";
import MindMapScreen from "../screens/MindMapScreen";
import ErrorBoundary from "../components/ErrorBoundary";

// Lazy, not a top-level import like every other screen here: ScannerScreen
// imports expo-camera, and expo-camera's ExpoCameraManager.js calls
// requireNativeModule("ExpoCamera") at module scope -- the instant that
// file is *imported*, not when the camera is actually used. Every other
// screen above is required synchronously while App.js's own import chain
// loads, before React renders a single frame; if a native module referenced
// that way isn't linked into the compiled build, it throws right there and
// takes the whole app down before Metro/the JS engine has even started
// rendering -- no error screen possible, just an instant close. Deferring
// the import until Scanner is actually opened means a broken/unlinked
// camera module only breaks Scanner, not the entire app on launch.
const ScannerScreen = lazy(() => import("../screens/ScannerScreen"));
function LazyScannerScreen(props) {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <ScannerScreen {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="NotesList"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 240,
        // Swiping is handled by SwipeBack on each screen so it behaves the
        // same on iOS and Android, instead of the platform default.
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="NotesList" component={NotesListScreen} />
      <Stack.Screen name="Archived" component={ArchivedScreen} />
      <Stack.Screen name="Editor" component={EditorScreen} />
      <Stack.Screen name="Split" component={SplitWorkspaceScreen} />
      <Stack.Screen name="TagIndex" component={TagIndexScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="Graph" component={GraphScreen} />
      <Stack.Screen name="Whiteboard" component={WhiteboardScreen} options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="Print" component={PrintPreviewScreen} />
      <Stack.Screen name="Compile" component={CompileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Inbox" component={InboxScreen} />
      <Stack.Screen name="Scanner" component={LazyScannerScreen} />
      <Stack.Screen name="Exam" component={ExamScreen} />
      <Stack.Screen name="MindMap" component={MindMapScreen} />
    </Stack.Navigator>
  );
}
