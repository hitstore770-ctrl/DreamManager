import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import AddDreamScreen from "../screens/AddDreamScreen";
import ArcadeScreen from "../screens/ArcadeScreen";
import DreamDetailScreen from "../screens/DreamDetailScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="DreamDetail" component={DreamDetailScreen} />
          <Stack.Screen name="Arcade" component={ArcadeScreen} />
          <Stack.Screen
            name="AddDream"
            component={AddDreamScreen}
            options={{ presentation: "modal" }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
