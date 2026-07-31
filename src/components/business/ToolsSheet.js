import { Modal, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";

import Icon from "../Icon";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import CustomText from "../../components/CustomText";

// Shared Pro-Tools bottom sheet + floating button used by the POS and
// Warehouse modules. The sheet itself is dumb — each screen composes its own
// rows/sub-views inside it.

const WHITE = "#FFFFFF";
const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const RED = "#EF4444";

export function ToolsFab({ onPress, style, testID = "tools-fab" }) {
  return (
    <TouchableOpacity testID={testID} style={[s.fab, style]} onPress={onPress} activeOpacity={0.85}>
      <Icon name="sliders" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

export function SheetRow({ icon, label, sub, onPress, danger, active, disabled }) {
  return (
    <TouchableOpacity
      style={[s.row, active && s.rowActive, disabled && { opacity: 0.45 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <CustomText style={s.rowChevron}>‹</CustomText>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <CustomText style={[s.rowLabel, danger && { color: RED }]}>{label}</CustomText>
        {!!sub && <CustomText style={s.rowSub}>{sub}</CustomText>}
      </View>
      <View style={s.rowBadge}>
        <Icon name={icon || "circle"} size={19} color={danger ? "#EF4444" : "#7C3AED"} />
      </View>
    </TouchableOpacity>
  );
}

export default function ToolsSheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={s.sheet}>
              <View style={s.grabber} />
              <CustomText style={s.title}>{title}</CustomText>
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    // No default horizontal position — WarehouseScreen, its only caller,
    // sets `right` explicitly. Business (WarehouseScreen's host screen) is
    // wrapped in withBack()'s BackFab, which floats at bottom-*left* — a
    // default `left` here used to sit right under it, and BackFab paints on
    // top, which made this button permanently untappable rather than merely
    // ugly.
    zIndex: 30,
    width: 56,
    height: 56,
    borderRadius: 24,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF1F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },

  backdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 22,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#EEF1F6", marginBottom: 10 },
  title: { fontFamily: FONTS.bold, fontSize: 17, color: INK, textAlign: "right", marginBottom: 10 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  rowActive: { backgroundColor: BLUE + "14" },
  rowBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: FONTS.semibold, fontSize: 15, color: INK },
  rowSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, marginTop: 1 },
  rowChevron: { fontFamily: FONTS.bold, fontSize: 18, color: INK_MUTED },
});
