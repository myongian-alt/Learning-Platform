import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { SlideStroke } from '@/hooks/queries/use-lesson-slides';

// This module does `import { Skia } from '@shopify/react-native-skia'` at the top level,
// which on web builds its API around whatever `global.CanvasKit` is *at that moment* — so
// this file must only ever be reached (via the lazy wrapper in `slide-canvas.tsx`) after
// CanvasKit has already finished loading. Importing it eagerly is what caused strokes to
// throw "Cannot read properties of undefined (reading 'PictureRecorder')" even once the
// canvas was rendering, because the Skia object had already captured `CanvasKit` as
// undefined by the time this module first ran.

export type SlideTool = 'select' | 'draw' | 'highlight' | 'erase';

const TOOL_STYLE: Record<Exclude<SlideTool, 'select' | 'erase'>, { opacity: number }> = {
  draw: { opacity: 1 },
  highlight: { opacity: 0.35 },
};

const ERASE_RADIUS = 18;

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Stroke points are stored in "base" (100%-zoom) coordinates so they stay correct at any
// zoom level — rendering scales them up/down by the current zoom, like viewing the same
// physical drawing at a different magnification, rather than leaving them pinned at
// whatever pixel position they happened to be drawn at.
function strokeToPath(stroke: SlideStroke, zoom: number): SkPath {
  const path = Skia.Path.Make();
  stroke.points.forEach((p, i) =>
    i === 0 ? path.moveTo(p.x * zoom, p.y * zoom) : path.lineTo(p.x * zoom, p.y * zoom),
  );
  return path;
}

export interface SlideCanvasHandle {
  undo: () => void;
  redo: () => void;
}

export interface SlideCanvasProps {
  initialStrokes: SlideStroke[];
  tool: SlideTool;
  color: string;
  strokeWidth: number;
  /** Current zoom level — stroke points are stored zoom-independent (see strokeToPath) and
   * scaled to this value at render/capture time. */
  zoom: number;
  /** Fires after every settled change (new stroke, undo, redo, erase) so the caller can persist. */
  onChange: (strokes: SlideStroke[]) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export const SlideCanvas = forwardRef<SlideCanvasHandle, SlideCanvasProps>(function SlideCanvas(
  { initialStrokes, tool, color, strokeWidth, zoom, onChange, onHistoryChange },
  ref,
) {
  const [strokes, setStrokes] = useState<SlideStroke[]>(initialStrokes);
  const [, bumpRedraw] = useState(0);
  const redoStack = useRef<SlideStroke[][]>([]);
  const activePath = useRef<SkPath | null>(null);
  const activePoints = useRef<{ x: number; y: number }[]>([]);
  const erasedIds = useRef<Set<string>>(new Set());

  const commit = (next: SlideStroke[]) => {
    setStrokes(next);
    onChange(next);
    onHistoryChange?.(true, redoStack.current.length > 0);
  };

  const startStroke = (x: number, y: number) => {
    if (tool === 'select') return;
    if (tool === 'erase') {
      erasedIds.current = new Set();
      return;
    }
    // The live in-progress path is built from raw (already-zoomed) gesture coordinates —
    // it's drawn directly at the canvas's current pixel size, no scaling needed. Only the
    // *stored* points (below) are converted to zoom-independent base coordinates.
    const path = Skia.Path.Make();
    path.moveTo(x, y);
    activePath.current = path;
    activePoints.current = [{ x: x / zoom, y: y / zoom }];
    bumpRedraw((n) => n + 1);
  };

  const appendToStroke = (x: number, y: number) => {
    if (tool === 'select') return;
    if (tool === 'erase') {
      const bx = x / zoom;
      const by = y / zoom;
      for (const s of strokes) {
        if (erasedIds.current.has(s.id)) continue;
        if (s.points.some((p) => distance(p, { x: bx, y: by }) <= ERASE_RADIUS)) {
          erasedIds.current.add(s.id);
        }
      }
      if (erasedIds.current.size > 0) bumpRedraw((n) => n + 1);
      return;
    }
    if (!activePath.current) return;
    activePath.current.lineTo(x, y);
    activePoints.current.push({ x: x / zoom, y: y / zoom });
    bumpRedraw((n) => n + 1);
  };

  const endStroke = () => {
    if (tool === 'erase') {
      if (erasedIds.current.size === 0) return;
      redoStack.current = [];
      commit(strokes.filter((s) => !erasedIds.current.has(s.id)));
      erasedIds.current = new Set();
      return;
    }
    if (!activePath.current || activePoints.current.length < 2) {
      activePath.current = null;
      activePoints.current = [];
      return;
    }
    const stroke: SlideStroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tool: tool as 'draw' | 'highlight',
      color,
      strokeWidth,
      points: activePoints.current,
    };
    redoStack.current = [];
    commit([...strokes, stroke]);
    activePath.current = null;
    activePoints.current = [];
  };

  const gesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin((e) => startStroke(e.x, e.y))
    .onUpdate((e) => appendToStroke(e.x, e.y))
    .onEnd(() => endStroke());

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (strokes.length === 0) return;
      redoStack.current = [...redoStack.current, strokes];
      const next = strokes.slice(0, -1);
      setStrokes(next);
      onChange(next);
      onHistoryChange?.(next.length > 0, true);
    },
    redo: () => {
      const previous = redoStack.current.at(-1);
      if (!previous) return;
      redoStack.current = redoStack.current.slice(0, -1);
      setStrokes(previous);
      onChange(previous);
      onHistoryChange?.(previous.length > 0, redoStack.current.length > 0);
    },
  }));

  const skPaths = useMemo(
    () => strokes.map((s) => ({ stroke: s, path: strokeToPath(s, zoom) })),
    [strokes, zoom],
  );

  // In 'select' mode the pan gesture is a no-op (see the early returns above), but the
  // Skia canvas is still a full-bleed element that would otherwise sit on top of — and
  // block clicks through to — anything stacked underneath it (e.g. a read-only answerable
  // question layer rendered below the student's own canvas). Only capture pointer events
  // while actually drawing/erasing.
  return (
    <GestureDetector gesture={gesture}>
      <Canvas
        style={{
          ...StyleSheet.absoluteFillObject,
          pointerEvents: tool === 'select' ? 'none' : 'auto',
        }}
      >
        {skPaths.map(({ stroke, path }) => (
          <Path
            key={stroke.id}
            path={path}
            color={stroke.color}
            style="stroke"
            strokeWidth={stroke.strokeWidth * zoom}
            strokeCap="round"
            strokeJoin="round"
            opacity={stroke.tool === 'highlight' ? TOOL_STYLE.highlight.opacity : TOOL_STYLE.draw.opacity}
          />
        ))}
        {activePath.current && (
          <Path
            path={activePath.current}
            color={color}
            style="stroke"
            strokeWidth={strokeWidth * zoom}
            strokeCap="round"
            strokeJoin="round"
            opacity={tool === 'highlight' ? TOOL_STYLE.highlight.opacity : 1}
          />
        )}
      </Canvas>
    </GestureDetector>
  );
});

// Default export so this module can be `React.lazy`-loaded (see slide-canvas.tsx).
export default SlideCanvas;
