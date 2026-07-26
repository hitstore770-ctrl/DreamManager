import { Component } from "react";
import { ScrollView, Text, View } from "react-native";

// Catches any render/runtime error in the tree and shows a readable message
// instead of a blank white screen. Without this, a single thrown error unmounts
// the whole app and the browser shows nothing.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface it to the console so it's visible in dev / preview logs.
    console.error("App crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: "#FFFFFF", padding: 24, justifyContent: "center" }}>
          <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>⚠️</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", textAlign: "center", color: "#111827", marginBottom: 8 }}>
            משהו השתבש
          </Text>
          <Text style={{ fontSize: 14, textAlign: "center", color: "#4B5563", marginBottom: 16 }}>
            אירעה שגיאה בטעינת האפליקציה. נסה לרענן.
          </Text>
          <ScrollView style={{ maxHeight: 220, backgroundColor: "#F9FAFC", borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 12, color: "#EF4444" }}>
              {String(this.state.error?.message || this.state.error)}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
