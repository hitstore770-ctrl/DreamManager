import { Component } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// The app's last line of defense: without this, ANY render-time throw
// (a native module that failed to link, a bad DB migration, anything)
// takes the whole app down hard -- no error screen, just an instant close,
// since React itself unmounts the entire tree on an uncaught error with
// no boundary to stop at. This can't use the app's own AppText/ThemeContext
// (the crash it's catching might be *in* those), so it's deliberately
// plain RN primitives and hardcoded colors.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught a crash:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.wrap}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{String(this.state.error?.message || this.state.error)}</Text>
            <TouchableOpacity style={styles.btn} onPress={() => this.setState({ error: null })}>
              <Text style={styles.btnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#1E1E24", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#27272F", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 },
  title: { color: "#F1F0F4", fontSize: 18, fontWeight: "700", marginBottom: 10 },
  message: { color: "#9E9DAA", fontSize: 13, lineHeight: 19, marginBottom: 18 },
  btn: { backgroundColor: "#6BBBA0", borderRadius: 10, height: 46, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#0B0B0A", fontWeight: "700", fontSize: 15 },
});
