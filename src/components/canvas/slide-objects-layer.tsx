import { Feather, Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { SlideAnswers, SlideObject, SlideObjectShape } from '@/hooks/queries/use-lesson-slides';
import { effectivePointsMap, maxAssignablePoints } from '@/lib/slide-grading';

export type PendingObjectSpec =
  | { kind: 'text' }
  | { kind: 'shape'; shape: SlideObjectShape }
  | { kind: 'emoji'; emoji: string }
  | { kind: 'comment' }
  | { kind: 'link'; url: string; label: string }
  | { kind: 'fill_blank' }
  | { kind: 'multiple_choice' };

const MIN_SIZE = 24;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createObjectFromPending(pending: PendingObjectSpec, x: number, y: number): SlideObject {
  const id = makeId();
  switch (pending.kind) {
    case 'text':
      return { id, type: 'text', x, y, width: 220, height: 90, text: '', color: '#1f2937', fontSize: 16 };
    case 'shape':
      return {
        id,
        type: 'shape',
        shape: pending.shape,
        x,
        y,
        width: 160,
        height: 100,
        color: '#7c3aed',
        strokeWidth: 3,
      };
    case 'emoji':
      return { id, type: 'emoji', x, y, size: 48, emoji: pending.emoji };
    case 'comment':
      return { id, type: 'comment', x, y, text: '' };
    case 'link':
      return { id, type: 'link', x, y, width: 200, url: pending.url, label: pending.label || pending.url };
    case 'fill_blank':
      return { id, type: 'fill_blank', x, y, width: 260, height: 100, prompt: '', answer: '' };
    case 'multiple_choice':
      return {
        id,
        type: 'multiple_choice',
        x,
        y,
        width: 260,
        height: 170,
        prompt: '',
        options: ['Option 1', 'Option 2'],
        correctIndex: null,
      };
  }
}

interface SlideObjectsLayerProps {
  objects: SlideObject[];
  onChange: (objects: SlideObject[]) => void;
  interactive: boolean;
  pending: PendingObjectSpec | null;
  onPlaced: () => void;
  /** Current zoom level. Object x/y/width/height/size/fontSize are stored zoom-independent
   * (100%-zoom "base" values) and scaled to this value for rendering, same reasoning as
   * SlideCanvas's stroke points — so placed items stay correctly sized/positioned relative
   * to the slide at any zoom level instead of looking pinned at their original pixel spot. */
  zoom: number;
  /** Student mode for the teacher's read-only reference layer: question objects (fill_blank/
   * multiple_choice) become answerable even though `interactive` is false (everything else
   * in that layer stays inert) — the question itself isn't editable here, only the answer. */
  answerable?: boolean;
  answers?: SlideAnswers;
  onAnswerChange?: (questionId: string, value: string | number) => void;
}

export function SlideObjectsLayer({
  objects: initialObjects,
  onChange,
  interactive,
  pending,
  onPlaced,
  zoom,
  answerable = false,
  answers,
  onAnswerChange,
}: SlideObjectsLayerProps) {
  // Mirrors SlideCanvas's own `strokes` state: the parent's `saveObjects` mutation
  // deliberately doesn't invalidate/refetch (same reasoning as saveAnnotations — it would
  // fight this component's own state while placing/dragging), so this component must own
  // its rendered objects locally rather than re-deriving them from the (stale) prop on
  // every change. The parent remounts this component fresh per slide (keyed higher up), so
  // seeding local state once from the prop at mount is safe.
  const [objects, setObjects] = useState(initialObjects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pointsMap = effectivePointsMap(objects);

  const commit = (next: SlideObject[]) => {
    setObjects(next);
    onChange(next);
  };

  const updateObject = (id: string, patch: Partial<SlideObject>) => {
    commit(objects.map((o) => (o.id === id ? ({ ...o, ...patch } as SlideObject) : o)));
  };

  const deleteObject = (id: string) => {
    commit(objects.filter((o) => o.id !== id));
    setSelectedId(null);
  };

  // Full-bleed 'auto' is only needed when this container itself must catch a tap (placing a
  // pending object, or clearing selection in the interactive layer) — a read-only-but-
  // answerable layer never does either, so it gets 'box-none' instead: the container is
  // transparent to hit-testing (letting clicks reach whatever's stacked below it, e.g. the
  // student's own interactive layer rendered on top of it) while its question-object children
  // still catch their own taps via their explicit per-item `pointerEvents="auto"`.
  const containerPointerEvents = pending || interactive ? 'auto' : answerable ? 'box-none' : 'none';

  return (
    <Pressable
      style={{
        ...StyleSheet.absoluteFillObject,
        pointerEvents: containerPointerEvents,
      }}
      onPress={(e) => {
        if (pending) {
          // React Native Web's Pressable passes the raw DOM MouseEvent through as
          // `nativeEvent` — it has no `locationX`/`locationY` (those are RN-native-only),
          // so fall back to the standard DOM `offsetX`/`offsetY` (position relative to the
          // element the listener is attached to, which is this same full-bleed Pressable).
          const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
          const x = ne.locationX ?? ne.offsetX ?? 0;
          const y = ne.locationY ?? ne.offsetY ?? 0;
          // Tap position is in current (zoomed) pixels — convert to zoom-independent base
          // coordinates before storing, same reasoning as everywhere else in this file.
          const obj = createObjectFromPending(pending, x / zoom, y / zoom);
          commit([...objects, obj]);
          setSelectedId(obj.id);
          onPlaced();
        } else {
          setSelectedId(null);
        }
      }}
    >
      {objects.map((obj) => (
        <SlideObjectItem
          key={obj.id}
          object={obj}
          zoom={zoom}
          selected={interactive && selectedId === obj.id}
          interactive={interactive}
          onSelect={() => setSelectedId(obj.id)}
          onUpdate={(patch) => updateObject(obj.id, patch)}
          onDelete={() => deleteObject(obj.id)}
          answerable={answerable}
          answerValue={answers?.[obj.id]}
          onAnswerChange={(value) => onAnswerChange?.(obj.id, value)}
          effectivePoints={pointsMap.get(obj.id) ?? 0}
          maxAssignablePoints={maxAssignablePoints(objects, obj.id)}
        />
      ))}
    </Pressable>
  );
}

function SlideObjectItem({
  object,
  zoom,
  selected,
  interactive,
  onSelect,
  onUpdate,
  onDelete,
  answerable,
  answerValue,
  onAnswerChange,
  effectivePoints,
  maxAssignablePoints,
}: {
  object: SlideObject;
  zoom: number;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<SlideObject>) => void;
  onDelete: () => void;
  answerable?: boolean;
  answerValue?: string | number;
  onAnswerChange?: (value: string | number) => void;
  /** Only meaningful for fill_blank/multiple_choice — this question's resolved point weight
   * (out of 100) and the most its manual `points` could be set to right now. */
  effectivePoints: number;
  maxAssignablePoints: number;
}) {
  // All of x/y/width/height/size below are base (100%-zoom) values, as stored — scaled by
  // zoom only right here at the point of layout, so drag/resize math (further down) can stay
  // in base units throughout.
  const baseWidth = 'width' in object ? object.width : object.type === 'emoji' ? object.size : 32;
  const baseHeight = 'height' in object ? object.height : object.type === 'emoji' ? object.size : 32;
  const resizable = object.type === 'text' || object.type === 'shape';

  // A question object in the teacher's read-only reference layer becomes purely
  // answerable for a student — no drag/select/delete/edit chrome, just the answer input,
  // regardless of `interactive`. The direct discriminant check (rather than a boolean flag)
  // is what lets TypeScript narrow `object` for the two question variants below.
  if (answerable && (object.type === 'fill_blank' || object.type === 'multiple_choice')) {
    return (
      <View
        style={{
          position: 'absolute',
          left: object.x * zoom,
          top: object.y * zoom,
          width: baseWidth * zoom,
          height: baseHeight * zoom,
          pointerEvents: 'auto',
        }}
      >
        <QuestionAnswerContent
          object={object}
          zoom={zoom}
          value={answerValue}
          onChange={onAnswerChange}
          points={effectivePoints}
        />
      </View>
    );
  }

  const dragStart = { x: 0, y: 0 };
  const dragGesture = Gesture.Pan()
    .onBegin(() => {
      dragStart.x = object.x;
      dragStart.y = object.y;
    })
    .onUpdate((e) => {
      onUpdate({
        x: dragStart.x + e.translationX / zoom,
        y: dragStart.y + e.translationY / zoom,
      } as Partial<SlideObject>);
    });

  const resizeStart = { width: baseWidth, height: baseHeight };
  const resizeGesture = Gesture.Pan()
    .onBegin(() => {
      resizeStart.width = baseWidth;
      resizeStart.height = baseHeight;
    })
    .onUpdate((e) => {
      const dx = e.translationX / zoom;
      const dy = e.translationY / zoom;
      if (object.type === 'emoji') {
        const next = Math.max(MIN_SIZE, resizeStart.width + Math.max(dx, dy));
        onUpdate({ size: next } as Partial<SlideObject>);
        return;
      }
      onUpdate({
        width: Math.max(MIN_SIZE, resizeStart.width + dx),
        height: Math.max(MIN_SIZE, resizeStart.height + dy),
      } as Partial<SlideObject>);
    });

  return (
    <View
      style={{
        position: 'absolute',
        left: object.x * zoom,
        top: object.y * zoom,
        width: baseWidth * zoom,
        height: baseHeight * zoom,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    >
      {selected && (
        <GestureDetector gesture={dragGesture}>
          <View className="absolute -top-7 left-0 flex-row items-center gap-1 rounded-full bg-ink px-2 py-1">
            <Feather name="move" size={11} color="#fff" />
            <Pressable onPress={onDelete} hitSlop={6}>
              <Feather name="trash-2" size={12} color="#fca5a5" />
            </Pressable>
          </View>
        </GestureDetector>
      )}

      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{ flex: 1 }}
        className={selected ? 'rounded-md ring-2 ring-violet-500' : ''}
      >
        <ObjectContent
          object={object}
          zoom={zoom}
          selected={selected}
          onUpdate={onUpdate}
          effectivePoints={effectivePoints}
          maxAssignablePoints={maxAssignablePoints}
        />
      </Pressable>

      {selected && resizable && (
        <GestureDetector gesture={resizeGesture}>
          <View className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border-2 border-white bg-violet-600" />
        </GestureDetector>
      )}
    </View>
  );
}

// A small +/- stepper for a question's manual point weight, plus an "Auto" reset back to
// evenly sharing the slide's remaining budget (see `effectivePointsMap` in slide-grading.ts).
// `points` is always the object's current *resolved* value (whether manual or auto-shared),
// so nudging +/-1 starts from wherever it visually is right now rather than from 0.
function PointsStepper({
  points,
  maxAssignable,
  onChange,
}: {
  points: number;
  maxAssignable: number;
  onChange: (points: number | null) => void;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-md bg-white/80 px-1 py-0.5">
      <Pressable
        onPress={() => onChange(Math.max(0, points - 1))}
        hitSlop={4}
        className="h-4 w-4 items-center justify-center rounded bg-black/5"
      >
        <Feather name="minus" size={9} color="#4b5563" />
      </Pressable>
      <Text className="w-8 text-center text-[10px] font-bold text-ink">{points} pts</Text>
      <Pressable
        onPress={() => onChange(Math.min(maxAssignable, points + 1))}
        disabled={points >= maxAssignable}
        hitSlop={4}
        style={{ opacity: points >= maxAssignable ? 0.4 : 1 }}
        className="h-4 w-4 items-center justify-center rounded bg-black/5"
      >
        <Feather name="plus" size={9} color="#4b5563" />
      </Pressable>
      <Pressable onPress={() => onChange(null)} hitSlop={4} className="ml-0.5">
        <Text className="text-[9px] font-semibold text-violet-600 underline">Auto</Text>
      </Pressable>
    </View>
  );
}

function ObjectContent({
  object,
  zoom,
  selected,
  onUpdate,
  effectivePoints,
  maxAssignablePoints,
}: {
  object: SlideObject;
  zoom: number;
  selected: boolean;
  onUpdate: (patch: Partial<SlideObject>) => void;
  effectivePoints: number;
  maxAssignablePoints: number;
}) {
  switch (object.type) {
    case 'text':
      return (
        <TextInput
          value={object.text}
          onChangeText={(text) => onUpdate({ text })}
          editable={selected}
          autoFocus={selected}
          multiline
          placeholder="Type…"
          placeholderTextColor="#9ca3af"
          style={{ flex: 1, color: object.color, fontSize: object.fontSize * zoom, padding: 4 }}
        />
      );
    case 'shape':
      return <ShapeContent object={object} zoom={zoom} />;
    case 'emoji':
      return (
        <Text style={{ fontSize: object.size * zoom, lineHeight: object.size * zoom }} className="text-center">
          {object.emoji}
        </Text>
      );
    case 'comment':
      return (
        <View>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-amber-400 shadow">
            <Feather name="message-circle" size={16} color="#fff" />
          </View>
          {selected && (
            // Absolutely positioned so its width isn't squeezed by the 32px marker box
            // this whole item is otherwise sized to.
            <TextInput
              value={object.text}
              onChangeText={(text) => onUpdate({ text })}
              multiline
              autoFocus
              placeholder="Add a note…"
              placeholderTextColor="#9ca3af"
              style={{ position: 'absolute', top: 36, left: 0, width: 192 }}
              className="rounded-lg bg-white p-2 text-xs text-ink shadow-lg"
            />
          )}
        </View>
      );
    case 'link':
      return (
        <Pressable
          onPress={() => !selected && Linking.openURL(object.url).catch(() => {})}
          className="flex-row items-center gap-1.5 rounded-full bg-blue-50 px-3 py-2"
        >
          <Feather name="link" size={13} color="#2563eb" />
          <Text className="flex-1 text-xs font-medium text-blue-700" numberOfLines={1}>
            {object.label}
          </Text>
        </Pressable>
      );
    case 'fill_blank':
      return (
        <View className="w-full flex-1 gap-1.5 rounded-lg border border-dashed border-violet-300 bg-violet-50/60 p-2">
          <View className="flex-row items-center justify-between gap-1">
            <View className="flex-row items-center gap-1">
              <Ionicons name="reader-outline" size={12} color="#7c3aed" />
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                Fill in the blank
              </Text>
            </View>
            {selected ? (
              <PointsStepper
                points={effectivePoints}
                maxAssignable={maxAssignablePoints}
                onChange={(points) => onUpdate({ points })}
              />
            ) : (
              <Text className="text-[10px] font-bold text-violet-600">{effectivePoints} pts</Text>
            )}
          </View>
          <TextInput
            value={object.prompt}
            onChangeText={(prompt) => onUpdate({ prompt })}
            editable={selected}
            multiline
            placeholder="Question or sentence with a blank…"
            placeholderTextColor="#9ca3af"
            className="text-sm text-ink"
          />
          {selected ? (
            <TextInput
              value={object.answer}
              onChangeText={(answer) => onUpdate({ answer })}
              placeholder="Correct answer (for your reference)"
              placeholderTextColor="#9ca3af"
              className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-ink"
            />
          ) : (
            <View className="h-6 w-full border-b border-dashed border-ink/30" />
          )}
        </View>
      );
    case 'multiple_choice':
      return (
        <View className="w-full flex-1 gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 p-2">
          <View className="flex-row items-center justify-between gap-1">
            <View className="flex-row items-center gap-1">
              <Ionicons name="checkbox-outline" size={12} color="#2563eb" />
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                Multiple choice
              </Text>
            </View>
            {selected ? (
              <PointsStepper
                points={effectivePoints}
                maxAssignable={maxAssignablePoints}
                onChange={(points) => onUpdate({ points })}
              />
            ) : (
              <Text className="text-[10px] font-bold text-blue-600">{effectivePoints} pts</Text>
            )}
          </View>
          <TextInput
            value={object.prompt}
            onChangeText={(prompt) => onUpdate({ prompt })}
            editable={selected}
            multiline
            placeholder="Question…"
            placeholderTextColor="#9ca3af"
            className="text-sm text-ink"
          />
          <View className="gap-1">
            {object.options.map((opt, i) => (
              <View key={i} className="flex-row items-center gap-1.5">
                <Pressable
                  onPress={() => selected && onUpdate({ correctIndex: object.correctIndex === i ? null : i })}
                  disabled={!selected}
                  hitSlop={4}
                >
                  <Feather
                    name={object.correctIndex === i ? 'check-circle' : 'circle'}
                    size={13}
                    color={object.correctIndex === i ? '#059669' : '#9ca3af'}
                  />
                </Pressable>
                {selected ? (
                  <TextInput
                    value={opt}
                    onChangeText={(text) => {
                      const next = [...object.options];
                      next[i] = text;
                      onUpdate({ options: next });
                    }}
                    className="flex-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-ink"
                  />
                ) : (
                  <Text className="flex-1 text-xs text-ink/80">{opt}</Text>
                )}
                {selected && object.options.length > 2 && (
                  <Pressable onPress={() => onUpdate({ options: object.options.filter((_, oi) => oi !== i) })} hitSlop={4}>
                    <Feather name="x" size={12} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          {selected && (
            <Pressable
              onPress={() => onUpdate({ options: [...object.options, `Option ${object.options.length + 1}`] })}
              className="flex-row items-center gap-1 self-start rounded-md px-1.5 py-1 active:bg-black/5"
            >
              <Feather name="plus" size={11} color="#4b5563" />
              <Text className="text-[11px] text-ink/60">Add option</Text>
            </Pressable>
          )}
        </View>
      );
  }
}

function QuestionAnswerContent({
  object,
  zoom,
  value,
  onChange,
  points,
}: {
  object: Extract<SlideObject, { type: 'fill_blank' } | { type: 'multiple_choice' }>;
  zoom: number;
  value: string | number | undefined;
  onChange?: (value: string | number) => void;
  points: number;
}) {
  if (object.type === 'fill_blank') {
    return (
      <View className="w-full flex-1 gap-1.5 rounded-lg bg-violet-50 p-2">
        <View className="flex-row items-start justify-between gap-2">
          <Text style={{ fontSize: 13 * zoom }} className="flex-1 font-medium text-ink/80">
            {object.prompt || 'Fill in the blank'}
          </Text>
          <Text className="text-[10px] font-bold text-violet-600">{points} pts</Text>
        </View>
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChangeText={(text) => onChange?.(text)}
          placeholder="Type your answer…"
          placeholderTextColor="#9ca3af"
          className="rounded-md border border-violet-200 bg-white px-2 py-1.5 text-sm text-ink"
        />
      </View>
    );
  }

  return (
    <View className="w-full flex-1 gap-1.5 rounded-lg bg-blue-50 p-2">
      <View className="flex-row items-start justify-between gap-2">
        <Text style={{ fontSize: 13 * zoom }} className="flex-1 font-medium text-ink/80">
          {object.prompt || 'Choose one'}
        </Text>
        <Text className="text-[10px] font-bold text-blue-600">{points} pts</Text>
      </View>
      <View className="gap-1">
        {object.options.map((opt, i) => {
          const chosen = value === i;
          return (
            <Pressable
              key={i}
              onPress={() => onChange?.(i)}
              className={`flex-row items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                chosen ? 'border-blue-500 bg-blue-100' : 'border-black/10 bg-white'
              }`}
            >
              <Feather name={chosen ? 'check-circle' : 'circle'} size={13} color={chosen ? '#2563eb' : '#9ca3af'} />
              <Text className="flex-1 text-xs text-ink/80">{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ShapeContent({ object, zoom }: { object: Extract<SlideObject, { type: 'shape' }>; zoom: number }) {
  const { shape, color } = object;
  const strokeWidth = object.strokeWidth * zoom;
  const width = object.width * zoom;
  const height = object.height * zoom;

  if (shape === 'rectangle') {
    return <View style={{ flex: 1, borderWidth: strokeWidth, borderColor: color, borderRadius: 6 }} />;
  }
  if (shape === 'ellipse') {
    return <View style={{ flex: 1, borderWidth: strokeWidth, borderColor: color, borderRadius: 9999 }} />;
  }

  // line & arrow: a rigid bar spanning the box diagonal, rotated in place. Angle is a ratio
  // of width:height, so it's unaffected by zoom scaling both equally — only length/position
  // need the scaled values.
  const length = Math.hypot(width, height);
  const angle = (Math.atan2(height, width) * 180) / Math.PI;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: length,
          height: strokeWidth,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        }}
      />
      {shape === 'arrow' && (
        <View
          style={{
            position: 'absolute',
            left: width - 9,
            top: height - 7,
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderTopWidth: 7,
            borderBottomWidth: 7,
            borderLeftColor: color,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
      )}
    </View>
  );
}
