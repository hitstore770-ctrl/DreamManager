import { StyleSheet, Text, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";

export default function ComingSoon() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🌐</Text>
      <Text style={styles.text}>יתחבר לרשת בשלב הבא</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  text: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.medium,
    textAlign: "center",
  },
});
