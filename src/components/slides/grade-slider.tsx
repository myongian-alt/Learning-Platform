import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 18;

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// A 0-100% grading control, built on Gesture.Pan the same way the canvas's drag/resize
// handles are (no native slider dependency is installed, and this stays consistent with the
// rest of the app). Dragging updates a local "live" value for immediate visual feedback but
// only calls onCommit once, on release/tap — so grading doesn't fire a network write per pixel.
export function GradeSlider({
  value,
  onCommit,
  disabled,
}: {
  value: number | null;
  onCommit: (grade: number) => void;
  disabled?: boolean;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [liveValue, setLiveValue] = useState<number | null>(null);

  const pctFromX = (x: number) => (trackWidth > 0 ? clamp((x / trackWidth) * 100) : 0);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => setLiveValue(pctFromX(e.x)))
    .onEnd((e) => {
      const next = pctFromX(e.x);
      setLiveValue(null);
      onCommit(next);
    });

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((e) => onCommit(pctFromX(e.x)));

  const gesture = Gesture.Race(pan, tap);
  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const displayValue = liveValue ?? value;
  const pct = clamp(displayValue ?? 0);
  const hasGrade = displayValue != null;

  return (
    <View className="flex-row items-center gap-2">
      <GestureDetector gesture={gesture}>
        <View onLayout={onLayout} style={{ height: THUMB_SIZE, justifyContent: 'center' }} className="flex-1">
          <View
            style={{ height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, overflow: 'hidden' }}
            className="bg-black/10"
          >
            <View
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: hasGrade ? '#7c3aed' : '#d1d5db',
              }}
            />
          </View>
          <View
            style={{
              position: 'absolute',
              left: `${pct}%` as unknown as number,
              marginLeft: -THUMB_SIZE / 2,
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: '#fff',
              borderWidth: 2,
              borderColor: hasGrade ? '#7c3aed' : '#9ca3af',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
            }}
          />
        </View>
      </GestureDetector>
      <Text className="w-10 text-right text-xs font-semibold text-ink/70">
        {hasGrade ? `${pct}%` : '—'}
      </Text>
    </View>
  );
}
