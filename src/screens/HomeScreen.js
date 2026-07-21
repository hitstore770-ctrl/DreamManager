import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome to DreamManager</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1026",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "600",
  },
});
