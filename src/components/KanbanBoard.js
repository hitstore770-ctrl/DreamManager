import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import AppText from "./AppText";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";

import { extractBoard, moveCard, toggleCard } from "../lib/kanban";
import { RADIUS } from "../theme/ThemeContext";

const COLUMN_WIDTH = 230;

// A note that structures itself as "### Column" headings + list items,
// rendered as draggable cards. Dragging is done with the gesture-handler
// declarative Gesture API in `runOnJS` mode -- plain JS callbacks on the JS
// thread, no Reanimated worklets required. Every drop rewrites the note's
// raw markdown via `onChange`, so the board is always just a view onto the
// text, never a second source of truth.
export default function KanbanBoard({ raw, onChange, theme }) {
  const { columns, region } = extractBoard(raw);
  const rootRef = useRef(null);
  const rootRect = useRef({ x: 0, y: 0 });
  const columnRefs = useRef([]);
  const columnRects = useRef([]);
  const [dragging, setDragging] = useState(null); // { colIdx, cardIdx }
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  const remeasure = () => {
    rootRef.current?.measureInWindow?.((x, y) => {
      rootRect.current = { x, y };
    });
    columnRefs.current.forEach((ref, i) => {
      ref?.measureInWindow?.((x, y, width) => {
        columnRects.current[i] = { x, width };
      });
    });
  };

  const columnAt = (absoluteX) => {
    for (let i = 0; i < columnRects.current.length; i++) {
      const r = columnRects.current[i];
      if (r && absoluteX >= r.x && absoluteX <= r.x + r.width) return i;
    }
    return null;
  };

  const s = styles(theme);

  if (!region) {
    return <AppText style={{ color: theme.textMuted }}>No board detected in this note.</AppText>;
  }

  const draggedCard = dragging ? columns[dragging.colIdx]?.cards[dragging.cardIdx] : null;

  return (
    <View ref={rootRef} onLayout={remeasure} style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 12 }}>
        {columns.map((col, ci) => (
          <View
            key={ci}
            ref={(ref) => {
              columnRefs.current[ci] = ref;
            }}
            onLayout={remeasure}
            style={s.column}
          >
            <AppText style={s.columnTitle}>
              {col.name} <AppText style={s.columnCount}>{col.cards.length}</AppText>
            </AppText>
            {col.cards.map((card, cardIdx) => (
              <KanbanCard
                key={cardIdx}
                card={card}
                hidden={dragging?.colIdx === ci && dragging?.cardIdx === cardIdx}
                theme={theme}
                onTap={() => onChange(toggleCard(raw, columns, region, ci, cardIdx))}
                onDragStart={() => {
                  remeasure();
                  setDragging({ colIdx: ci, cardIdx });
                }}
                onDragMove={(x, y) => setDragPos({ x, y })}
                onDragEnd={(absX) => {
                  const target = columnAt(absX);
                  setDragging(null);
                  if (target !== null) onChange(moveCard(raw, columns, region, ci, cardIdx, target));
                }}
              />
            ))}
            {col.cards.length === 0 && <AppText style={s.emptyCol}>Drop cards here</AppText>}
          </View>
        ))}
      </ScrollView>

      {dragging && draggedCard && (
        <View
          pointerEvents="none"
          style={[s.ghost, { left: dragPos.x - rootRect.current.x - 90, top: dragPos.y - rootRect.current.y - 18 }]}
        >
          <AppText style={s.ghostText} numberOfLines={2}>
            {draggedCard.text}
          </AppText>
        </View>
      )}
    </View>
  );
}

function KanbanCard({ card, hidden, theme, onTap, onDragStart, onDragMove, onDragEnd }) {
  const s = styles(theme);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(6)
    .onStart(() => onDragStart())
    .onUpdate((e) => onDragMove(e.absoluteX, e.absoluteY))
    .onEnd((e) => onDragEnd(e.absoluteX));

  const tap = Gesture.Tap().runOnJS(true).onEnd(() => onTap());

  // First gesture to satisfy its own criteria wins and cancels the other:
  // a stationary tap resolves before Pan's 6px threshold is met; any real
  // drag movement activates Pan and cancels the tap.
  const gesture = Gesture.Race(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[s.card, hidden && { opacity: 0.25 }]}>
        {card.done !== null && (
          <View style={[s.checkbox, card.done && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
            {card.done && <Feather name="check" size={11} color={theme.onAccent} />}
          </View>
        )}
        <AppText
          style={[s.cardText, card.done && { textDecorationLine: "line-through", color: theme.textMuted }]}
          numberOfLines={4}
        >
          {card.text}
        </AppText>
      </View>
    </GestureDetector>
  );
}

const styles = (t) =>
  StyleSheet.create({
    column: { width: COLUMN_WIDTH, backgroundColor: t.surfaceAlt, borderRadius: RADIUS.md, padding: 10, alignSelf: "flex-start" },
    columnTitle: { fontSize: 13, fontWeight: "700", color: t.text, marginBottom: 10, paddingHorizontal: 2 },
    columnCount: { color: t.textMuted, fontWeight: "600" },
    emptyCol: { fontSize: 12, color: t.textMuted, textAlign: "center", paddingVertical: 14 },
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: t.surface,
      borderRadius: RADIUS.sm,
      padding: 10,
      marginBottom: 8,
      ...t.cardShadow,
    },
    checkbox: { width: 16, height: 16, marginTop: 2, borderRadius: 4, borderWidth: 2, borderColor: t.border, alignItems: "center", justifyContent: "center" },
    cardText: { flex: 1, fontSize: 13.5, color: t.text, lineHeight: 19 },
    ghost: {
      position: "absolute",
      width: 180,
      backgroundColor: t.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.accent,
      padding: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 8,
    },
    ghostText: { fontSize: 13, color: t.text },
  });
