import { Canvas, Path, Rect, Skia, type SkPath } from '@shopify/react-native-skia';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useCanvasStore } from '@/store/canvas-store';

// A fixed-size "sheet of paper" that the user pans/zooms around. Large enough
// to feel infinite for a lesson's worth of work; not literally unbounded.
export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 4200;
const MIN_SCALE = 0.4;
const MAX_SCALE = 4;

interface Stroke {
  id: string;
  path: SkPath;
  color: string;
  strokeWidth: number;
  opacity: number;
}

const TOOL_STYLE: Record<string, { opacity: number; widthMultiplier: number }> = {
  pen: { opacity: 1, widthMultiplier: 1 },
  highlighter: { opacity: 0.35, widthMultiplier: 4 },
  eraser: { opacity: 1, widthMultiplier: 6 },
};

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export interface InfiniteCanvasProps {
  /** Persisted strokes to render underneath what the user draws locally (e.g. teacher annotations). */
  remoteStrokes?: Stroke[];
  onStrokeComplete?: (stroke: {
    color: string;
    strokeWidth: number;
    points: { x: number; y: number }[];
  }) => void;
}

export interface InfiniteCanvasHandle {
  undo: () => void;
}

export const InfiniteCanvas = forwardRef<InfiniteCanvasHandle, InfiniteCanvasProps>(
  function InfiniteCanvas({ remoteStrokes = [], onStrokeComplete }, ref) {
    const tool = useCanvasStore((s) => s.tool);
    const color = useCanvasStore((s) => s.color);
    const strokeWidth = useCanvasStore((s) => s.strokeWidth);

    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [, bumpRedraw] = useState(0);
    const activePath = useRef<SkPath | null>(null);
    const activePoints = useRef<{ x: number; y: number }[]>([]);
    const activeMeta = useRef<{ color: string; strokeWidth: number; opacity: number } | null>(null);
    const isPanMode = tool === 'pointer';

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const startStroke = (x: number, y: number) => {
      const path = Skia.Path.Make();
      path.moveTo(x, y);
      activePath.current = path;
      activePoints.current = [{ x, y }];
      const style = TOOL_STYLE[tool] ?? TOOL_STYLE.pen;
      activeMeta.current = {
        color: tool === 'eraser' ? '#fbfaf7' : color,
        strokeWidth: strokeWidth * style.widthMultiplier,
        opacity: style.opacity,
      };
      bumpRedraw((n) => n + 1);
    };

    const appendToStroke = (x: number, y: number) => {
      if (!activePath.current) return;
      activePath.current.lineTo(x, y);
      activePoints.current.push({ x, y });
      bumpRedraw((n) => n + 1);
    };

    const endStroke = () => {
      if (!activePath.current || !activeMeta.current) return;
      const finished: Stroke = {
        id: `${Date.now()}`,
        path: activePath.current,
        ...activeMeta.current,
      };
      setStrokes((prev) => [...prev, finished]);
      onStrokeComplete?.({ ...activeMeta.current, points: activePoints.current });
      activePath.current = null;
      activeMeta.current = null;
      activePoints.current = [];
    };

    // One finger draws (pen/highlighter/eraser) or pans (when the "Move" tool is active).
    const oneFingerGesture = Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .onBegin((event) => {
        if (isPanMode) return;
        runOnJS(startStroke)(event.x, event.y);
      })
      .onUpdate((event) => {
        if (isPanMode) {
          translateX.value = savedTranslateX.value + event.translationX;
          translateY.value = savedTranslateY.value + event.translationY;
        } else {
          runOnJS(appendToStroke)(event.x, event.y);
        }
      })
      .onEnd(() => {
        if (isPanMode) {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        } else {
          runOnJS(endStroke)();
        }
      });

    // Two fingers always pan/zoom, regardless of the selected tool.
    const twoFingerPan = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onUpdate((event) => {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      })
      .onEnd(() => {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      });

    const pinchGesture = Gesture.Pinch()
      .onUpdate((event) => {
        scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
      })
      .onEnd(() => {
        savedScale.value = scale.value;
      });

    const composedGesture = Gesture.Race(
      oneFingerGesture,
      Gesture.Simultaneous(twoFingerPan, pinchGesture),
    );

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }));

    useImperativeHandle(ref, () => ({
      undo: () => setStrokes((prev) => prev.slice(0, -1)),
    }));

    return (
      <View style={styles.viewport}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.sheet, animatedStyle]}>
            <Canvas style={styles.canvas}>
              <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} color="#fbfaf7" />
              {remoteStrokes.map((stroke) => (
                <Path
                  key={stroke.id}
                  path={stroke.path}
                  color={stroke.color}
                  style="stroke"
                  strokeWidth={stroke.strokeWidth}
                  strokeCap="round"
                  strokeJoin="round"
                  opacity={stroke.opacity}
                />
              ))}
              {strokes.map((stroke) => (
                <Path
                  key={stroke.id}
                  path={stroke.path}
                  color={stroke.color}
                  style="stroke"
                  strokeWidth={stroke.strokeWidth}
                  strokeCap="round"
                  strokeJoin="round"
                  opacity={stroke.opacity}
                />
              ))}
              {activePath.current && activeMeta.current && (
                <Path
                  path={activePath.current}
                  color={activeMeta.current.color}
                  style="stroke"
                  strokeWidth={activeMeta.current.strokeWidth}
                  strokeCap="round"
                  strokeJoin="round"
                  opacity={activeMeta.current.opacity}
                />
              )}
            </Canvas>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#e5e5e0',
  },
  sheet: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
});
