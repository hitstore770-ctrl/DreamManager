import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, useTheme } from "../theme/ThemeContext";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

// Shared bottom-sheet chrome for every popover in the app: a fading
// backdrop, a spring slide-up entrance, and a drag-down-to-dismiss gesture
// (same Animated + PanGestureHandler pattern as SwipeBack's edge-swipe, so
// there's no new animation dependency to pull in for it). Every sheet-style
// modal (Insert menu, Template/Snippet pickers, History, PIN entry, the
// two "name this" prompts) renders its content through this instead of a
// bare RN <Modal>.
export default function BottomSheet({ visible, onClose, children, maxHeightPercent = 0.85 }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onGestureEvent = Animated.event([{ nativeEvent: { translationY: translateY } }], { useNativeDriver: true });

  const onHandlerStateChange = (e) => {
    const { state, translationY, velocityY } = e.nativeEvent;
    if (state === State.END || state === State.CANCELLED) {
      const shouldDismiss = translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 180, useNativeDriver: true }).start(() => {
          onClose?.();
        });
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      }
    }
  };

  if (!mounted) return null;
  const s = styles(theme);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay, opacity: backdropOpacity }]} />
        </Pressable>
        <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange} activeOffsetY={[-10, 10]}>
          <Animated.View
            style={[
              s.sheet,
              {
                maxHeight: SCREEN_HEIGHT * maxHeightPercent,
                paddingBottom: insets.bottom + 16,
                transform: [
                  {
                    // Drag past the rest position (0) moves the sheet down 1:1;
                    // dragging *up* past rest has no effect (clamped), same
                    // rubber-band-free clamp style as SwipeBack.
                    translateY: translateY.interpolate({
                      inputRange: [-1, 0, SCREEN_HEIGHT],
                      outputRange: [0, 0, SCREEN_HEIGHT],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
            <View testID="bottom-sheet-grabber" style={s.grabber} />
            {children}
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

const styles = (t) =>
  StyleSheet.create({
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.surface,
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
      paddingTop: 10,
      paddingHorizontal: 20,
      ...t.cardShadow,
    },
    grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: t.border, marginBottom: 12 },
  });
