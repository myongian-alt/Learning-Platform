import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlideCanvas, type SlideCanvasHandle, type SlideTool } from '@/components/canvas/slide-canvas';
import { SlideObjectsLayer, type PendingObjectSpec } from '@/components/canvas/slide-objects-layer';
import { GradeSlider } from '@/components/slides/grade-slider';
import { useAddSlides } from '@/hooks/queries/use-add-slides';
import {
  useLessonSlides,
  type SlideAnswers,
  type SlideObject,
  type SlideObjectShape,
  type SlideStroke,
  type ViewableSlide,
} from '@/hooks/queries/use-lesson-slides';
import { useMySlideSubmission, useSlideSubmissions } from '@/hooks/queries/use-slide-submissions';
import type { LessonResource, SlideActivityTag } from '@/types/database';

export const SLIDE_TAGS: Record<SlideActivityTag, { label: string; color: string }> = {
  title_objectives: { label: 'Title / Objectives', color: '#3b82f6' },
  warm_up: { label: 'Warm Up', color: '#f59e0b' },
  main_idea: { label: 'Main Idea', color: '#8b5cf6' },
  solved_examples: { label: 'Solved Examples', color: '#10b981' },
  guided_practice: { label: 'Guided Practice', color: '#06b6d4' },
  independent_activity: { label: 'Independent Activity', color: '#ec4899' },
  group_activity: { label: 'Group Activity', color: '#6366f1' },
  challenge_extra: { label: 'Challenge / Extra Activity', color: '#ef4444' },
  exit_ticket: { label: 'Exit Ticket', color: '#64748b' },
};
export const SLIDE_TAG_ORDER = Object.keys(SLIDE_TAGS) as SlideActivityTag[];

function formatTimer(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

const DRAW_COLORS = ['#1f2937', '#7c3aed', '#ef4444', '#2563eb', '#059669'];
const DRAW_WIDTHS = [1, 2, 3, 5, 8];
const HIGHLIGHT_COLOR = '#facc15';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const EMOJI_OPTIONS = ['😀', '🎉', '⭐', '✅', '❗', '❓', '👍', '👎', '❤️', '🔥', '💡', '📌'];
const SHAPE_OPTIONS: { shape: SlideObjectShape; icon: keyof typeof Feather.glyphMap }[] = [
  { shape: 'rectangle', icon: 'square' },
  { shape: 'ellipse', icon: 'circle' },
  { shape: 'line', icon: 'minus' },
  { shape: 'arrow', icon: 'arrow-up-right' },
];

export type SlideViewerRole = 'teacher' | 'student';

export function SlideViewerModal({
  resource,
  startIndex = 0,
  onClose,
  viewerRole,
  studentId,
}: {
  resource: LessonResource;
  startIndex?: number;
  onClose: () => void;
  viewerRole: SlideViewerRole;
  studentId?: string;
}) {
  const insets = useSafeAreaInsets();
  const { data: slides, isLoading, updateSlide, saveAnnotations, saveObjects } = useLessonSlides(resource.id);
  const [index, setIndex] = useState(startIndex);
  const slide = slides?.[index];
  const total = slides?.length ?? 0;

  return (
    <View className="absolute inset-0 z-50 bg-paper" style={{ paddingTop: insets.top }}>
      {/* Keyed by slide id so switching slides always mounts fresh tool/zoom/tag-picker
          state instead of syncing it via effects. */}
      <SlideStage
        key={slide?.id ?? 'empty'}
        resource={resource}
        slide={slide ?? null}
        index={index}
        total={total}
        isLoading={isLoading}
        onClose={onClose}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(total - 1, i + 1))}
        updateSlide={updateSlide}
        saveAnnotations={saveAnnotations}
        saveObjects={saveObjects}
        viewerRole={viewerRole}
        studentId={studentId}
      />
    </View>
  );
}

function SlideStage({
  resource,
  slide,
  index,
  total,
  isLoading,
  onClose,
  onPrev,
  onNext,
  updateSlide,
  saveAnnotations,
  saveObjects,
  viewerRole,
  studentId,
}: {
  resource: LessonResource;
  slide: ViewableSlide | null;
  index: number;
  total: number;
  isLoading: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  updateSlide: ReturnType<typeof useLessonSlides>['updateSlide'];
  saveAnnotations: ReturnType<typeof useLessonSlides>['saveAnnotations'];
  saveObjects: ReturnType<typeof useLessonSlides>['saveObjects'];
  viewerRole: SlideViewerRole;
  studentId?: string;
}) {
  const isTeacher = viewerRole === 'teacher';
  const tag = slide?.activity_tag ? SLIDE_TAGS[slide.activity_tag] : null;

  // Own annotation layer for a student (separate from the teacher's authoring layer above),
  // and the completion roster for a teacher — each a no-op query when not relevant to this
  // viewer, since slide?.id may briefly be null between navigations.
  const mySubmission = useMySlideSubmission(slide?.id ?? null, !isTeacher ? (studentId ?? null) : null);
  const submissions = useSlideSubmissions(isTeacher ? (slide?.id ?? null) : null);
  const submittedCount = submissions.data?.filter((s) => s.submitted_at).length ?? 0;
  const isSubmitted = Boolean(mySubmission.data?.submitted_at);

  // Once a slide already has a tag, show only that tag as a pill — the full 9-option
  // picker only reappears if the teacher explicitly asks to change it, or the slide is
  // untagged to begin with.
  const [changingTag, setChangingTag] = useState(false);

  const [tool, setTool] = useState<SlideTool>('select');
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [drawWidth, setDrawWidth] = useState(DRAW_WIDTHS[0]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, setPending] = useState<PendingObjectSpec | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<SlideCanvasHandle>(null);
  const scrollRef = useRef<View>(null);
  // Set right before a zoom change, read by the effect below once the resized content has
  // actually laid out — keeps the point that was at the viewport's center still centered
  // after the zoom applies, instead of the view staying pinned to its top-left scroll
  // position while the content grows out from under it (visually "toward the right").
  const pendingZoomCenterRef = useRef<{ baseX: number; baseY: number } | null>(null);

  const zoomTo = (nextZoom: number) => {
    const el = scrollRef.current as unknown as HTMLElement | null;
    if (el) {
      pendingZoomCenterRef.current = {
        baseX: (el.scrollLeft + el.clientWidth / 2) / zoom,
        baseY: (el.scrollTop + el.clientHeight / 2) / zoom,
      };
    }
    setZoom(nextZoom);
  };

  useEffect(() => {
    const el = scrollRef.current as unknown as HTMLElement | null;
    const pending = pendingZoomCenterRef.current;
    if (!el || !pending) return;
    el.scrollLeft = Math.max(0, pending.baseX * zoom - el.clientWidth / 2);
    el.scrollTop = Math.max(0, pending.baseY * zoom - el.clientHeight / 2);
    pendingZoomCenterRef.current = null;
  }, [zoom]);

  const [flash, setFlash] = useState<string | null>(null);
  const showFlash = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash((current) => (current === message ? null : current)), 2000);
  };

  const toggleTag = (t: SlideActivityTag) => {
    if (!slide || !isTeacher) return;
    updateSlide.mutate({ id: slide.id, activityTag: slide.activity_tag === t ? null : t });
    setChangingTag(false);
  };

  const showTagPicker = isTeacher && (!tag || changingTag);

  const teacherAnnotations = (slide?.annotations as unknown as SlideStroke[]) ?? [];
  const canvasStrokes = isTeacher ? teacherAnnotations : ((mySubmission.data?.annotations as unknown as SlideStroke[]) ?? []);
  const handleCanvasChange = (strokes: SlideStroke[]) => {
    if (!slide) return;
    if (isTeacher) {
      saveAnnotations.mutate({ id: slide.id, annotations: strokes });
    } else {
      mySubmission.saveAnnotations.mutate(strokes);
    }
  };

  const teacherObjects = (slide?.objects as unknown as SlideObject[]) ?? [];
  const myObjects = isTeacher ? teacherObjects : ((mySubmission.data?.objects as unknown as SlideObject[]) ?? []);
  const handleObjectsChange = (objects: SlideObject[]) => {
    if (!slide) return;
    if (isTeacher) {
      saveObjects.mutate({ id: slide.id, objects });
    } else {
      mySubmission.saveObjects.mutate(objects);
    }
  };

  // A student's answers to the teacher's fill-in-the-blank/multiple-choice questions —
  // irrelevant for the teacher's own view (they author questions, they don't answer them).
  // Tracked as local state (seeded once, same as canvasStrokes/myObjects below) rather than
  // re-derived from the query on every render: saveAnswers deliberately skips cache
  // invalidation, so re-deriving from `mySubmission.data` would merge each new answer against
  // the same stale (pre-first-save) snapshot every time, silently dropping every answer but
  // the most recent whenever a student answers more than one question on a slide.
  const [myAnswers, setMyAnswers] = useState<SlideAnswers>(
    () => (mySubmission.data?.answers as unknown as SlideAnswers) ?? {},
  );
  const handleAnswerChange = (questionId: string, value: string | number) => {
    const next = { ...myAnswers, [questionId]: value };
    setMyAnswers(next);
    mySubmission.saveAnswers.mutate(next);
  };

  const toolbarProps = {
    tool,
    onToolChange: (t: SlideTool) => {
      setPending(null);
      setTool(t);
    },
    drawColor,
    onDrawColorChange: setDrawColor,
    drawWidth,
    onDrawWidthChange: setDrawWidth,
    canUndo,
    canRedo,
    onUndo: () => canvasRef.current?.undo(),
    onRedo: () => canvasRef.current?.redo(),
    zoom,
    onZoomIn: () => zoomTo(Math.min(MAX_ZOOM, +(zoom + 0.25).toFixed(2))),
    onZoomOut: () => zoomTo(Math.max(MIN_ZOOM, +(zoom - 0.25).toFixed(2))),
    onComingSoon: showFlash,
    fullscreen,
    pendingKind: pending?.kind ?? null,
    onSetPendingText: () => {
      setTool('select');
      setPending((p) => (p?.kind === 'text' ? null : { kind: 'text' }));
    },
    onSetPendingShape: (shape: SlideObjectShape) => {
      setTool('select');
      setPending({ kind: 'shape', shape });
    },
    onSetPendingEmoji: (emoji: string) => {
      setTool('select');
      setPending({ kind: 'emoji', emoji });
    },
    onSetPendingComment: () => {
      setTool('select');
      setPending((p) => (p?.kind === 'comment' ? null : { kind: 'comment' }));
    },
    onOpenLinkDialog: () => {
      setTool('select');
      setLinkDialogOpen(true);
    },
    // Only the teacher authors questions — students answer them via SlideObjectsLayer's
    // `answerable` mode instead, so these tools stay hidden on the student's toolbar.
    canAuthorQuestions: isTeacher,
    onSetPendingFillBlank: () => {
      setTool('select');
      setPending((p) => (p?.kind === 'fill_blank' ? null : { kind: 'fill_blank' }));
    },
    onSetPendingMultipleChoice: () => {
      setTool('select');
      setPending((p) => (p?.kind === 'multiple_choice' ? null : { kind: 'multiple_choice' }));
    },
  };

  const tagRow = showTagPicker ? (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {SLIDE_TAG_ORDER.map((t) => {
        const meta = SLIDE_TAGS[t];
        const active = slide?.activity_tag === t;
        return (
          <Pressable
            key={t}
            onPress={() => toggleTag(t)}
            disabled={!slide}
            style={{
              backgroundColor: active ? meta.color : `${meta.color}14`,
              borderColor: `${meta.color}55`,
            }}
            className="rounded-full border px-2.5 py-1"
          >
            <Text style={{ color: active ? '#fff' : meta.color }} className="text-[10px] font-semibold">
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
      {tag && (
        <Pressable onPress={() => setChangingTag(false)} className="p-1">
          <Feather name="check" size={14} color="#10b981" />
        </Pressable>
      )}
    </View>
  ) : (
    tag && (
      <Pressable
        onPress={() => isTeacher && setChangingTag(true)}
        style={{ backgroundColor: `${tag.color}1f` }}
        className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
      >
        <Text style={{ color: tag.color }} className="text-[10px] font-semibold">
          {tag.label}
        </Text>
        {isTeacher && <Feather name="chevron-down" size={11} color={tag.color} />}
      </Pressable>
    )
  );

  const teacherSubmissionsToggle = isTeacher && slide && (
    <Pressable
      onPress={() =>
        updateSlide.mutate({ id: slide.id, submissionsEnabled: !slide.submissions_enabled })
      }
      className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5 ${
        slide.submissions_enabled ? 'bg-emerald-50' : 'bg-black/[0.03]'
      }`}
    >
      <Feather
        name={slide.submissions_enabled ? 'toggle-right' : 'toggle-left'}
        size={16}
        color={slide.submissions_enabled ? '#059669' : '#9ca3af'}
      />
      <Text
        className={`text-xs font-medium ${slide.submissions_enabled ? 'text-emerald-700' : 'text-ink/50'}`}
      >
        {slide.submissions_enabled ? `Submissions on · ${submittedCount} in` : 'Submissions off'}
      </Text>
    </Pressable>
  );

  const studentSubmitButton = !isTeacher && slide?.submissions_enabled && (
    <Pressable
      onPress={() => mySubmission.setSubmitted.mutate(!isSubmitted)}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
        isSubmitted ? 'bg-emerald-600' : 'bg-violet-600'
      }`}
    >
      <Feather name={isSubmitted ? 'check-circle' : 'send'} size={13} color="#fff" />
      <Text className="text-xs font-semibold text-white">{isSubmitted ? 'Submitted' : 'Submit'}</Text>
    </Pressable>
  );

  return (
    <>
      {/* Header: back, title, tag (collapsed to a single pill once set), timer. Hidden in
          fullscreen — its pieces reappear as floating overlays on the stage instead. */}
      {!fullscreen && (
        <View className="z-20 flex-row items-center justify-between border-b border-black/5 bg-white px-5 py-2">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close lesson"
              className="h-8 w-8 items-center justify-center rounded-lg active:bg-black/5"
            >
              <Feather name="x" size={18} color="#4b5563" />
            </Pressable>
            <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
              {resource.title}
            </Text>
            {tagRow}
            {teacherSubmissionsToggle}
            {isTeacher && <GradingPanel submissions={submissions} />}
          </View>

          <View className="flex-row items-center gap-2.5">
            {studentSubmitButton}
            {slide && (
              <SlideTimer
                key={slide.id}
                durationMinutes={slide.duration_minutes}
                editable={isTeacher}
                onChangeDuration={(minutes) =>
                  updateSlide.mutate({ id: slide.id, durationMinutes: minutes || null })
                }
              />
            )}
          </View>
        </View>
      )}

      {!fullscreen && (
        <View className="border-b border-black/5 bg-white px-3 py-1.5">
          <View className="flex-row items-center justify-center">
            <View className="flex-row items-center rounded-xl bg-black/[0.03] px-1.5 py-1">
              <SlideToolbarButtons
                orientation="horizontal"
                {...toolbarProps}
                onToggleFullscreen={() => setFullscreen(true)}
              />
            </View>
          </View>
        </View>
      )}

      {pending && (
        <View className="absolute inset-x-0 top-14 z-10 items-center">
          <View className="flex-row items-center gap-2 rounded-full bg-ink px-3 py-1.5 shadow-lg">
            <Text className="text-xs font-medium text-white">Tap the slide to place it</Text>
            <Pressable onPress={() => setPending(null)} hitSlop={6}>
              <Feather name="x" size={13} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Slide surface — flex-1 so it naturally claims the large majority of the window. The
          whole workspace (slide + margin + drawing/object layers) scales together with zoom;
          past 100% the surface scrolls (native scrollbars) instead of clipping. */}
      <View
        ref={scrollRef}
        className="flex-1 overflow-auto bg-black/[0.03]"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setStageSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
        }}
      >
        {(isLoading || (!slide && total === 0)) && (
          <View className="absolute inset-0 items-center justify-center">
            <ActivityIndicator />
          </View>
        )}

        {slide && stageSize.width > 0 && (
          <View
            style={{
              width: Math.max(stageSize.width, stageSize.width * zoom),
              height: Math.max(stageSize.height, stageSize.height * zoom),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: '100%', height: '100%', padding: fullscreen ? 14 : 18 }}>
              <View className="flex-1 items-center justify-center">
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: 1100,
                    backgroundColor: tag ? `${tag.color}0d` : '#fff',
                  }}
                  className="overflow-hidden rounded-2xl shadow-sm"
                >
                  {slide.url && (
                    <Image
                      source={{ uri: slide.url }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              </View>

              {/* A student sees the teacher's authoring-layer marks as a fixed reference
                  underlay (read-only) below their own editable strokes/objects. */}
              {!isTeacher && teacherAnnotations.length > 0 && (
                <SlideCanvas
                  key={`${slide.id}-teacher-ro`}
                  initialStrokes={teacherAnnotations}
                  tool="select"
                  color="#000"
                  strokeWidth={1}
                  zoom={zoom}
                  onChange={() => {}}
                />
              )}
              <SlideCanvas
                key={slide.id}
                ref={canvasRef}
                initialStrokes={canvasStrokes}
                tool={tool}
                color={tool === 'highlight' ? HIGHLIGHT_COLOR : drawColor}
                strokeWidth={tool === 'highlight' ? 16 : drawWidth}
                zoom={zoom}
                onChange={handleCanvasChange}
                onHistoryChange={(u, r) => {
                  setCanUndo(u);
                  setCanRedo(r);
                }}
              />

              <SlideObjectsLayer
                objects={myObjects}
                onChange={handleObjectsChange}
                interactive={tool === 'select'}
                pending={pending}
                onPlaced={() => setPending(null)}
                zoom={zoom}
              />

              {/* Rendered last (stacked on top) so its answerable question objects are
                  reachable — the student's own interactive layer above would otherwise
                  cover the full slide with its click-catcher and block taps meant for
                  these read-only reference objects. */}
              {!isTeacher && teacherObjects.length > 0 && (
                <SlideObjectsLayer
                  objects={teacherObjects}
                  onChange={() => {}}
                  interactive={false}
                  pending={null}
                  onPlaced={() => {}}
                  zoom={zoom}
                  answerable
                  answers={myAnswers}
                  onAnswerChange={handleAnswerChange}
                />
              )}
            </View>
          </View>
        )}

        {slide && fullscreen && (
          <>
            <View className="absolute left-3 top-3 flex-row items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg">
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close lesson"
                className="h-6 w-6 items-center justify-center rounded-full active:bg-black/5"
              >
                <Feather name="x" size={16} color="#4b5563" />
              </Pressable>
              <Text className="max-w-[220px] text-xs font-semibold text-ink" numberOfLines={1}>
                {resource.title}
              </Text>
              {tag && (
                <View style={{ backgroundColor: `${tag.color}1f` }} className="rounded-full px-2 py-0.5">
                  <Text style={{ color: tag.color }} className="text-[10px] font-semibold">
                    {tag.label}
                  </Text>
                </View>
              )}
              {teacherSubmissionsToggle}
              {isTeacher && <GradingPanel submissions={submissions} />}
            </View>

            <View className="absolute inset-x-0 top-3 flex-row items-center justify-center gap-2.5">
              {studentSubmitButton}
              <SlideTimer
                key={slide.id}
                durationMinutes={slide.duration_minutes}
                editable={isTeacher}
                onChangeDuration={(minutes) =>
                  updateSlide.mutate({ id: slide.id, durationMinutes: minutes || null })
                }
              />
            </View>

            {/* Flush against the extreme right edge, spanning the full height so it never
                collides with the header/timer/nav overlays above and below it — scrolls
                internally if the tool list is ever taller than the window. */}
            <View testID="fullscreen-toolbar" className="absolute inset-y-0 right-0 rounded-l-2xl bg-white/95 shadow-lg">
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 6 }}
              >
                <SlideToolbarButtons
                  orientation="vertical"
                  {...toolbarProps}
                  onToggleFullscreen={() => setFullscreen(false)}
                />
              </ScrollView>
            </View>

            <View className="absolute inset-x-0 bottom-3 items-center">
              <SlideNavControls index={index} total={total} onPrev={onPrev} onNext={onNext} />
            </View>
            {isTeacher && (
              <View className="absolute bottom-3 right-16">
                <AddSlideMenu resource={resource} onFlash={showFlash} />
              </View>
            )}
          </>
        )}
      </View>

      {/* Footer: Prev/Next navigation. Hidden in fullscreen — it reappears as a floating
          overlay docked to the bottom of the stage instead. */}
      {!fullscreen && (
        <View className="flex-row items-center border-t border-black/5 bg-white px-5 py-2">
          <View className="flex-1" />
          <SlideNavControls index={index} total={total} onPrev={onPrev} onNext={onNext} />
          <View className="flex-1 items-end">
            {isTeacher && <AddSlideMenu resource={resource} onFlash={showFlash} />}
          </View>
        </View>
      )}

      {linkDialogOpen && (
        <LinkDialog
          onCancel={() => setLinkDialogOpen(false)}
          onSubmit={(url, label) => {
            setLinkDialogOpen(false);
            setPending({ kind: 'link', url, label });
          }}
        />
      )}

      {flash && (
        <View className="absolute bottom-20 right-6 rounded-xl bg-ink px-4 py-3 shadow-lg">
          <Text className="text-sm font-medium text-white">{flash}</Text>
        </View>
      )}
    </>
  );
}

function LinkDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (url: string, label: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const canSubmit = url.trim().length > 0;

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/40">
      <View className="w-full max-w-sm gap-3 rounded-2xl bg-white p-5 shadow-xl">
        <Text className="text-base font-semibold text-ink">Insert link</Text>
        <View className="gap-1.5">
          <Text className="text-xs font-medium text-ink/60">URL</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com"
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm text-ink"
          />
        </View>
        <View className="gap-1.5">
          <Text className="text-xs font-medium text-ink/60">Label (optional)</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Link text"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm text-ink"
          />
        </View>
        <View className="mt-1 flex-row justify-end gap-2">
          <Pressable onPress={onCancel} className="rounded-lg px-3 py-2">
            <Text className="text-sm font-medium text-ink/60">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => canSubmit && onSubmit(url.trim(), label.trim())}
            disabled={!canSubmit}
            style={{ opacity: canSubmit ? 1 : 0.4 }}
            className="rounded-lg bg-violet-600 px-4 py-2"
          >
            <Text className="text-sm font-semibold text-white">Continue</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SlideNavControls({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-full bg-white px-2 py-1 shadow-sm">
      <Pressable
        onPress={onPrev}
        disabled={index === 0}
        style={{ opacity: index === 0 ? 0.3 : 1 }}
        className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:bg-black/5"
      >
        <Feather name="chevron-left" size={14} color="#4b5563" />
        <Text className="text-xs font-medium text-ink/70">Prev</Text>
      </Pressable>
      <Text className="text-xs text-ink/50">
        Slide {total === 0 ? 0 : index + 1} of {total}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={index >= total - 1}
        style={{ opacity: index >= total - 1 ? 0.3 : 1 }}
        className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:bg-black/5"
      >
        <Text className="text-xs font-medium text-ink/70">Next</Text>
        <Feather name="chevron-right" size={14} color="#4b5563" />
      </Pressable>
    </View>
  );
}

// Teacher-only: appends more slides to the lesson currently open — a blank canvas, or
// another file (image/PDF) converted the same way the original upload was.
function AddSlideMenu({ resource, onFlash }: { resource: LessonResource; onFlash: (message: string) => void }) {
  const { addBlankSlide, addFile } = useAddSlides(resource);
  const [open, setOpen] = useState(false);
  const busy = addBlankSlide.isPending || addFile.isPending;

  const handleBlank = () => {
    setOpen(false);
    addBlankSlide.mutate(undefined, {
      onSuccess: () => onFlash('Blank slide added.'),
      onError: () => onFlash("Couldn't add a blank slide."),
    });
  };

  const handleUploadFile = async () => {
    setOpen(false);
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    addFile.mutate(
      { uri: asset.uri, filename: asset.name, mimeType: asset.mimeType ?? null },
      {
        onSuccess: (count) => onFlash(`Added ${count} slide${count === 1 ? '' : 's'} from ${asset.name}.`),
        onError: () => onFlash("Couldn't add that file."),
      },
    );
  };

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        disabled={busy}
        accessibilityLabel="Add slide"
        style={{ opacity: busy ? 0.5 : 1 }}
        className="h-9 w-9 items-center justify-center rounded-full bg-violet-600 shadow-sm active:bg-violet-700"
      >
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={18} color="#fff" />}
      </Pressable>
      {open && (
        <View className="absolute bottom-11 right-0 w-52 gap-0.5 rounded-xl bg-white p-1.5 shadow-lg">
          <Pressable
            onPress={handleBlank}
            className="flex-row items-center gap-2 rounded-lg px-3 py-2.5 active:bg-black/5"
          >
            <Feather name="file-plus" size={14} color="#4b5563" />
            <Text className="text-sm text-ink/80">Add blank slide</Text>
          </Pressable>
          <Pressable
            onPress={handleUploadFile}
            className="flex-row items-center gap-2 rounded-lg px-3 py-2.5 active:bg-black/5"
          >
            <Feather name="upload" size={14} color="#4b5563" />
            <Text className="text-sm text-ink/80">Upload file to this lesson</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Teacher-only: a dropdown listing every student who has submitted this slide, each with a
// 0-100% GradeSlider wired straight to the setGrade mutation already on `submissions`.
function GradingPanel({ submissions }: { submissions: ReturnType<typeof useSlideSubmissions> }) {
  const [open, setOpen] = useState(false);
  const submittedRows = (submissions.data ?? []).filter((s) => s.submitted_at);

  if (submittedRows.length === 0) return null;

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-1.5 rounded-full bg-black/[0.03] px-2.5 py-1.5"
      >
        <Feather name="bar-chart-2" size={13} color="#7c3aed" />
        <Text className="text-xs font-medium text-ink/70">Grade</Text>
      </Pressable>
      {open && (
        // Anchored from the left, not the right: this button's own wrapper is only as wide
        // as the pill itself, so `right-0` would push a 288px-wide dropdown mostly off-screen
        // to the left whenever the button sits near the left edge of the header row.
        <View className="absolute left-0 top-11 z-10 w-72 rounded-xl bg-white p-2 shadow-lg">
          <Text className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
            Grades · {submittedRows.length} submitted
          </Text>
          <ScrollView style={{ maxHeight: 260 }}>
            {submittedRows.map((s, i) => (
              <View
                key={s.id}
                className={`gap-1.5 px-1 py-2 ${i < submittedRows.length - 1 ? 'border-b border-black/5' : ''}`}
              >
                <Text className="text-xs font-medium text-ink/80" numberOfLines={1}>
                  {s.profiles?.full_name ?? 'Student'}
                </Text>
                <GradeSlider
                  value={s.grade}
                  onCommit={(grade) => submissions.setGrade.mutate({ submissionId: s.id, grade })}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

type ToolbarIconName =
  | { set: 'feather'; name: keyof typeof Feather.glyphMap }
  | { set: 'ionicons'; name: keyof typeof Ionicons.glyphMap };

function ToolbarIcon({ icon, size, color }: { icon: ToolbarIconName; size: number; color: string }) {
  return icon.set === 'feather' ? (
    <Feather name={icon.name} size={size} color={color} />
  ) : (
    <Ionicons name={icon.name} size={size} color={color} />
  );
}

function SlideToolbarButton({
  icon,
  active,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  icon: ToolbarIconName;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={{ opacity: disabled ? 0.35 : 1 }}
      className={`h-9 w-9 items-center justify-center rounded-lg ${
        active ? 'bg-violet-600' : 'active:bg-black/5'
      }`}
    >
      <ToolbarIcon icon={icon} size={17} color={active ? '#fff' : '#4b5563'} />
    </Pressable>
  );
}

function ToolbarDivider({ orientation }: { orientation: 'horizontal' | 'vertical' }) {
  return orientation === 'vertical' ? (
    <View className="my-1.5 h-px w-6 bg-black/10" />
  ) : (
    <View className="mx-1.5 h-6 w-px bg-black/10" />
  );
}

function SlideToolbarButtons({
  orientation,
  tool,
  onToolChange,
  drawColor,
  onDrawColorChange,
  drawWidth,
  onDrawWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  fullscreen,
  onToggleFullscreen,
  onComingSoon,
  pendingKind,
  onSetPendingText,
  onSetPendingShape,
  onSetPendingEmoji,
  onSetPendingComment,
  onOpenLinkDialog,
  canAuthorQuestions,
  onSetPendingFillBlank,
  onSetPendingMultipleChoice,
}: {
  orientation: 'horizontal' | 'vertical';
  tool: SlideTool;
  onToolChange: (t: SlideTool) => void;
  drawColor: string;
  onDrawColorChange: (c: string) => void;
  drawWidth: number;
  onDrawWidthChange: (w: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onComingSoon: (message: string) => void;
  pendingKind: PendingObjectSpec['kind'] | null;
  onSetPendingText: () => void;
  onSetPendingShape: (shape: SlideObjectShape) => void;
  onSetPendingEmoji: (emoji: string) => void;
  onSetPendingComment: () => void;
  onOpenLinkDialog: () => void;
  canAuthorQuestions: boolean;
  onSetPendingFillBlank: () => void;
  onSetPendingMultipleChoice: () => void;
}) {
  const comingSoon = (label: string) => onComingSoon(`${label} is coming soon.`);
  const vertical = orientation === 'vertical';
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const rowClass = vertical ? 'mt-1 items-center gap-1 pt-1.5' : 'ml-1 flex-row items-center gap-1 pl-1.5';

  return (
    <View className={vertical ? 'items-center' : 'flex-row items-center'}>
      <SlideToolbarButton
        icon={{ set: 'feather', name: fullscreen ? 'minimize-2' : 'maximize-2' }}
        onPress={onToggleFullscreen}
        accessibilityLabel={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      />

      <ToolbarDivider orientation={orientation} />

      {/* History */}
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'corner-up-left' }}
        disabled={!canUndo}
        onPress={onUndo}
      />
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'corner-up-right' }}
        disabled={!canRedo}
        onPress={onRedo}
      />

      <ToolbarDivider orientation={orientation} />

      {/* Zoom */}
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'zoom-out' }}
        disabled={zoom <= MIN_ZOOM}
        onPress={onZoomOut}
      />
      {!vertical && (
        <Text className="w-10 text-center text-[11px] font-semibold text-ink/60">
          {Math.round(zoom * 100)}%
        </Text>
      )}
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'zoom-in' }}
        disabled={zoom >= MAX_ZOOM}
        onPress={onZoomIn}
      />

      <ToolbarDivider orientation={orientation} />

      {/* Core tools — wired to the canvas */}
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'mouse-pointer' }}
        active={tool === 'select'}
        onPress={() => onToolChange('select')}
      />
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'pencil' }}
        active={tool === 'draw'}
        onPress={() => onToolChange('draw')}
      />
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'brush' }}
        active={tool === 'highlight'}
        onPress={() => onToolChange('highlight')}
      />
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'backspace-outline' }}
        active={tool === 'erase'}
        onPress={() => onToolChange('erase')}
      />

      {tool === 'draw' && (
        <View className={rowClass}>
          {DRAW_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => onDrawColorChange(c)}
              style={{ backgroundColor: c, borderWidth: drawColor === c ? 2 : 0 }}
              className="h-5 w-5 rounded-full border-white"
            />
          ))}
        </View>
      )}
      {tool === 'draw' && (
        <View className={rowClass}>
          {DRAW_WIDTHS.map((w) => (
            <Pressable
              key={w}
              onPress={() => onDrawWidthChange(w)}
              className="h-5 w-5 items-center justify-center"
            >
              <View
                style={{
                  width: w,
                  height: w,
                  borderRadius: w,
                  backgroundColor: drawWidth === w ? '#7c3aed' : '#9ca3af',
                }}
              />
            </Pressable>
          ))}
        </View>
      )}

      <ToolbarDivider orientation={orientation} />

      {/* Insert tools — Comment, Text, Shapes, Link fully wired; Image/File/Fill-in-blank/
          MCQ/Voice remain "coming soon" (need upload/recording/grading infra respectively). */}
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'message-circle' }}
        active={pendingKind === 'comment'}
        onPress={onSetPendingComment}
      />
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'type' }}
        active={pendingKind === 'text'}
        onPress={onSetPendingText}
      />
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'shapes-outline' }}
        active={pendingKind === 'shape' || shapePickerOpen}
        onPress={() => {
          setEmojiPickerOpen(false);
          setShapePickerOpen((v) => !v);
        }}
      />
      {shapePickerOpen && (
        <View className={rowClass}>
          {SHAPE_OPTIONS.map(({ shape, icon }) => (
            <Pressable
              key={shape}
              onPress={() => {
                onSetPendingShape(shape);
                setShapePickerOpen(false);
              }}
              className="h-7 w-7 items-center justify-center rounded-md active:bg-black/5"
            >
              <Feather name={icon} size={14} color="#4b5563" />
            </Pressable>
          ))}
        </View>
      )}
      <SlideToolbarButton icon={{ set: 'feather', name: 'link' }} onPress={onOpenLinkDialog} />
      <SlideToolbarButton icon={{ set: 'feather', name: 'image' }} onPress={() => comingSoon('Images')} />
      {/* Only the teacher authors questions — students answer them inline on the slide instead. */}
      {canAuthorQuestions && (
        <SlideToolbarButton
          icon={{ set: 'ionicons', name: 'reader-outline' }}
          active={pendingKind === 'fill_blank'}
          onPress={onSetPendingFillBlank}
          accessibilityLabel="Add fill-in-the-blank question"
        />
      )}
      {canAuthorQuestions && (
        <SlideToolbarButton
          icon={{ set: 'ionicons', name: 'checkbox-outline' }}
          active={pendingKind === 'multiple_choice'}
          onPress={onSetPendingMultipleChoice}
          accessibilityLabel="Add multiple-choice question"
        />
      )}
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'happy-outline' }}
        active={pendingKind === 'emoji' || emojiPickerOpen}
        onPress={() => {
          setShapePickerOpen(false);
          setEmojiPickerOpen((v) => !v);
        }}
      />
      {emojiPickerOpen && (
        <View className={`${vertical ? 'flex-row flex-wrap justify-center' : 'flex-row flex-wrap'} ${rowClass} max-w-[140px]`}>
          {EMOJI_OPTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => {
                onSetPendingEmoji(emoji);
                setEmojiPickerOpen(false);
              }}
              className="h-7 w-7 items-center justify-center"
            >
              <Text style={{ fontSize: 16 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'paperclip' }}
        onPress={() => comingSoon('File attachments')}
      />
      <SlideToolbarButton icon={{ set: 'feather', name: 'mic' }} onPress={() => comingSoon('Voice notes')} />
    </View>
  );
}

const MAX_SLIDE_MINUTES = 20;

function SlideTimer({
  durationMinutes,
  editable,
  onChangeDuration,
}: {
  durationMinutes: number | null;
  editable: boolean;
  onChangeDuration: (minutes: number) => void;
}) {
  // Tracked locally (seeded once from the prop at mount, via the parent's key={slide.id})
  // rather than read from the prop on every click — the prop only reflects the server's
  // value after the update round-trips back through React Query, so a quick run of clicks
  // would otherwise each read the same stale value and clobber each other.
  const [minutes, setMinutes] = useState(durationMinutes ?? 0);
  const [seconds, setSeconds] = useState((durationMinutes ?? 0) * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const adjust = (delta: number) => {
    const next = Math.max(0, Math.min(MAX_SLIDE_MINUTES, minutes + delta));
    setMinutes(next);
    onChangeDuration(next);
    setSeconds(next * 60);
    setRunning(false);
  };

  if (!editable && !durationMinutes) return null;

  return (
    <View className="flex-row items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2.5">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs text-ink/50">Duration</Text>
        {editable && (
          <Pressable
            onPress={() => adjust(-1)}
            className="h-6 w-6 items-center justify-center rounded-md bg-black/5"
          >
            <Feather name="minus" size={12} color="#4b5563" />
          </Pressable>
        )}
        <Text className="w-14 text-center text-xs font-semibold text-ink">
          {minutes ? `${minutes} min` : 'None'}
        </Text>
        {editable && (
          <Pressable
            onPress={() => adjust(1)}
            className="h-6 w-6 items-center justify-center rounded-md bg-black/5"
          >
            <Feather name="plus" size={12} color="#4b5563" />
          </Pressable>
        )}
      </View>

      <View className="flex-row items-center gap-2">
        <Feather name="clock" size={13} color={seconds === 0 ? '#9ca3af' : '#7c3aed'} />
        <Text className={`text-sm font-bold ${seconds === 0 ? 'text-ink/30' : 'text-violet-700'}`}>
          {formatTimer(seconds)}
        </Text>
        <Pressable
          onPress={() => setRunning((r) => !r)}
          disabled={seconds === 0}
          style={{ opacity: seconds === 0 ? 0.4 : 1 }}
          className="rounded-md bg-violet-600 px-2.5 py-1"
        >
          <Text className="text-[11px] font-semibold text-white">{running ? 'Pause' : 'Start'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setRunning(false);
            setSeconds(minutes * 60);
          }}
          className="rounded-md bg-black/5 px-2.5 py-1"
        >
          <Text className="text-[11px] font-medium text-ink/60">Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}
