import { createNativeStackNavigator } from "@react-navigation/native-stack";

import NotesListScreen from "../screens/NotesListScreen";
import EditorScreen from "../screens/EditorScreen";
import SplitWorkspaceScreen from "../screens/SplitWorkspaceScreen";
import TagIndexScreen from "../screens/TagIndexScreen";

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
      <Stack.Screen name="Editor" component={EditorScreen} />
      <Stack.Screen name="Split" component={SplitWorkspaceScreen} />
      <Stack.Screen name="TagIndex" component={TagIndexScreen} />
    </Stack.Navigator>
  );
}
