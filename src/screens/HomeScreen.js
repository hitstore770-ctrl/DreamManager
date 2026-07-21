import { FlatList, I18nManager, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DreamCard from "../components/DreamCard";
import { useAuth } from "../context/AuthContext";
import { useDreams } from "../context/DreamContext";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { dreams } = useDreams();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.greeting}>שלום, {user?.displayName ?? "חולם"}</Text>
          <Text style={styles.subGreeting}>אלו החלומות שלך</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>התנתקות</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={dreams}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DreamCard {...item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: insets.bottom + 24 },
          I18nManager.isRTL ? { left: 24 } : { right: 24 },
        ]}
        onPress={() => navigation.navigate("AddDream")}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1026",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "right",
  },
  subGreeting: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 13,
    textAlign: "right",
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#5B8CFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  fab: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B8CFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 12,
  },
  fabIcon: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "400",
    marginTop: -2,
  },
});
