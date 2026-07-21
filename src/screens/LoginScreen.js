import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { signInWithGoogle, isAuthenticating } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>מנהל החלומות</Text>
        <Text style={styles.subtitle}>
          עקבו אחר המטרות, הכספים וההתקדמות שלכם - במקום אחד.
        </Text>

        <TouchableOpacity
          style={[styles.googleButton, isAuthenticating && styles.googleButtonDisabled]}
          onPress={signInWithGoogle}
          disabled={isAuthenticating}
          activeOpacity={0.8}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#0B1026" />
          ) : (
            <>
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>התחבר באמצעות גוגל</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1026",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    padding: 28,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    shadowColor: "#5B8CFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 32,
    lineHeight: 20,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#5B8CFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  googleButtonDisabled: {
    opacity: 0.75,
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 12,
  },
  googleBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  googleButtonText: {
    color: "#0B1026",
    fontSize: 16,
    fontWeight: "600",
  },
});
