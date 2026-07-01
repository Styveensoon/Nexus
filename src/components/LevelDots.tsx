import React, { useRef } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

type Props = {
  value: number;
  max?: number;
  activeColor: string;
  trackColor: string;
  onChange?: (value: number) => void;
  disabled?: boolean;
};

export default function LevelDots({ value, max = 10, activeColor, trackColor, onChange, disabled }: Props) {
  const rowRef = useRef<View>(null);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);

  const measure = () => {
    rowRef.current?.measure((_x, _y, width, _height, pageX) => {
      widthRef.current = width;
      pageXRef.current = pageX;
    });
  };

  const updateFromPageX = (pageX: number) => {
    const width = widthRef.current;
    if (width <= 0 || !onChange) return;
    const relativeX = pageX - pageXRef.current;
    const clamped = Math.max(0, Math.min(width, relativeX));
    const step = Math.min(max, Math.max(1, Math.ceil((clamped / width) * max)));
    onChange(step);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (_e, gestureState) => updateFromPageX(gestureState.x0),
      onPanResponderMove: (_e, gestureState) => updateFromPageX(gestureState.moveX),
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View ref={rowRef} onLayout={measure} style={styles.row} {...(disabled ? {} : panResponder.panHandlers)}>
        {Array.from({ length: max }).map((_, i) => {
          const active = i < value;
          const isCurrent = i === value - 1;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: active ? activeColor : trackColor,
                  transform: [{ scale: isCurrent ? 1.35 : 1 }],
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.value, { color: activeColor }]}>
        {value}/{max}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10 },
  dot: { width: 13, height: 13, borderRadius: 7 },
  value: { fontSize: 12, fontWeight: "800", minWidth: 32, textAlign: "right" },
});
