import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolCopyButton } from "./ToolKit";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(set) {
  return set[Math.floor(Math.random() * set.length)];
}

function shuffle(chars) {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

function generatePassword() {
  const length = 12 + Math.floor(Math.random() * 5); // 12-16
  // Guarantee at least one of each category, then fill the rest.
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) {
    chars.push(pick(ALL));
  }
  return shuffle(chars).join("");
}

export default function PasswordGenerator() {
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword(generatePassword());
  }, []);

  return (
    <View>
      <View style={styles.passwordBox}>
        <Text style={styles.passwordText} selectable>
          {password}
        </Text>
      </View>

      <ToolButton
        label="צור סיסמה חדשה 🔐"
        onPress={() => setPassword(generatePassword())}
        style={styles.generateButton}
      />
      <ToolCopyButton text={password} label="העתק סיסמה" color="#1E9E58" />
    </View>
  );
}

const styles = StyleSheet.create({
  passwordBox: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 18,
  },
  passwordText: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: FONTS.bold,
    letterSpacing: 1,
    textAlign: "center",
  },
  generateButton: {
    marginBottom: 12,
  },
});
