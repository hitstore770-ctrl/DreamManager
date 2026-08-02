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
import ScannerScreen from "../screens/ScannerScreen";
import ExamScreen from "../screens/ExamScreen";
import MindMapScreen from "../screens/MindMapScreen";

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
      <Stack.Screen name="Scanner" component={ScannerScreen} />
      <Stack.Screen name="Exam" component={ExamScreen} />
      <Stack.Screen name="MindMap" component={MindMapScreen} />
    </Stack.Navigator>
  );
}
