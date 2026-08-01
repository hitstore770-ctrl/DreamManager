import { useRef } from "react";
import { Animated, Dimensions } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";

const SCREEN_WIDTH = Dimensions.get("window").width;
const EDGE_WIDTH = 32; // gesture only starts from a strip near the left edge
const DISMISS_RATIO = 0.28;

// A right-swipe-from-the-edge "go back" gesture, built directly on
// react-native-gesture-handler rather than relying on the platform's own
// stack gesture (iOS has one, Android's native-stack doesn't). Dropped on
// the Editor, Split and Tag Index screens for consistent swipe navigation
// back to the notes list on every platform.
export default function SwipeBack({ children, onDismiss, style }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const onGestureEvent = Animated.event([{ nativeEvent: { translationX: translateX } }], {
    useNativeDriver: true,
  });

  const onHandlerStateChange = (e) => {
    const { state, translationX, velocityX } = e.nativeEvent;
    if (state === State.END || state === State.CANCELLED) {
      const shouldDismiss = translationX > SCREEN_WIDTH * DISMISS_RATIO || velocityX > 900;
      if (shouldDismiss) {
        Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: 180, useNativeDriver: true }).start(() => {
          translateX.setValue(0);
          onDismiss?.();
        });
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      }
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-100000, 12]}
      failOffsetY={[-18, 18]}
      hitSlop={{ left: 0, width: EDGE_WIDTH }}
    >
      <Animated.View
        style={[
          { flex: 1 },
          style,
          {
            transform: [
              {
                translateX: translateX.interpolate({
                  inputRange: [0, SCREEN_WIDTH],
                  outputRange: [0, SCREEN_WIDTH],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}
