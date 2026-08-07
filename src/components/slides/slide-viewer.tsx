import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SlideCanvas,
  type SlideCanvasHandle,
  type SlideTool,
} from '@/components/canvas/slide-canvas';
import { SlideObjectsLayer, type PendingObjectSpec } from '@/components/canvas/slide-objects-layer';
import { FillBlanksView } from '@/components/lessons/fill-blanks-view';
import { QuizView } from '@/components/lessons/quiz-view';
import { GradeSlider } from '@/components/slides/grade-slider';
import { useAddSlides } from '@/hooks/queries/use-add-slides';
import { useBlink } from '@/hooks/use-blink';
import {
  useLessonSlides,
  type SlideAnswers,
  type SlideObject,
  type SlideObjectShape,
  type SlideStroke,
  type SlideTimerCommand,
  type ViewableSlide,
} from '@/hooks/queries/use-lesson-slides';
import {
  useLiveClassSessions,
  useStudentLessonPresence,
  useTeacherLivePresence,
  type LiveSlidePayload,
} from '@/hooks/queries/use-live-class-session';
import {
  useMySlideSubmission,
  useSlideSubmissions,
  type SlideSubmissionWithStudent,
} from '@/hooks/queries/use-slide-submissions';
import { autoGradeSlide, type AutoGradeResult } from '@/lib/slide-grading';
import type { LessonResource, SlideActivityTag, SlideGradingMode } from '@/types/database';

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
// A student's draw/object/answer save is an upsert onto `slide_submissions`, gated by RLS on
// the slide's `submissions_enabled` flag — this fires whenever that write is rejected (the
// teacher hasn't turned submissions on for this slide) so the failure is never silent.
const SUBMISSIONS_OFF_MESSAGE = "Ask your teacher to turn on activities for this slide first";
const SHAPE_OPTIONS: { shape: SlideObjectShape; icon: keyof typeof Feather.glyphMap }[] = [
  { shape: 'rectangle', icon: 'square' },
  { shape: 'ellipse', icon: 'circle' },
  { shape: 'line', icon: 'minus' },
  { shape: 'arrow', icon: 'arrow-up-right' },
];

// One accent per tool family so the toolbar reads as a set of distinct, purposeful tools at a
// glance instead of a flat gray grid — matches the color language already used elsewhere for
// the same concepts (fill_blank=violet, multiple_choice=blue in slide-objects-layer.tsx).
const TOOL_TINTS = {
  draw: '#7c3aed',
  highlight: '#f59e0b',
  erase: '#ef4444',
  comment: '#0ea5e9',
  text: '#4f46e5',
  shapes: '#7c3aed',
  link: '#2563eb',
  image: '#0d9488',
  fillBlank: '#7c3aed',
  multipleChoice: '#2563eb',
  emoji: '#db2777',
  file: '#64748b',
  voice: '#e11d48',
};

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
  const isTeacher = viewerRole === 'teacher';
  const {
    data: slides,
    isLoading,
    updateSlide,
    updateSlidesPacing,
    saveAnnotations,
    saveObjects,
  } = useLessonSlides(resource.id);
  const [index, setIndex] = useState(startIndex);
  const total = slides?.length ?? 0;

  // Student side: is a teacher currently presenting a slide from THIS resource, and is
  // this student following along. Teacher side: broadcast which slide is open so any
  // student's Home banner / lesson viewer can pick it up — see use-live-class-session.ts.
  const live = useLiveClassSessions(!isTeacher ? [resource.class_id] : []);
  const isLiveHere = !isTeacher && live?.resourceId === resource.id;
  const [following, setFollowing] = useState(false);

  // A teacher-paced slide force-locks navigation while it's the one actually being presented
  // live, with no student opt-out — checked against the TEACHER's current slide (whatever
  // `live.slideIndex` is), not the student's own local `index`, since forcing is about
  // whatever the class is being shown right now, not wherever this student happens to be.
  const liveSlideIndex = live && total > 0 ? Math.min(live.slideIndex, total - 1) : null;
  const liveSlidePacing = liveSlideIndex !== null ? slides?.[liveSlideIndex]?.pacing_mode : null;
  const forcedLock = isLiveHere && liveSlidePacing === 'teacher_paced';
  const navLocked = forcedLock || (following && isLiveHere);

  // While following (or force-locked), the displayed slide tracks the teacher's broadcast
  // index directly instead of mirroring it into `index` via an effect — `index` (and
  // Prev/Next) resume from wherever local navigation last was once the lock lifts.
  const effectiveIndex =
    navLocked && live && total > 0 ? Math.min(live.slideIndex, total - 1) : index;
  const slide = slides?.[effectiveIndex];

  const lessonPresence = useStudentLessonPresence({
    viewerRole,
    classId: resource.class_id,
    resourceId: resource.id,
    slideId: slide?.id ?? null,
    slideIndex: slide ? effectiveIndex : null,
    pacingMode: slide?.pacing_mode ?? null,
    followingTeacher: following,
    submissionsEnabled: slide?.submissions_enabled ?? false,
    studentId: studentId ?? null,
  });

  const teacherLivePayload: LiveSlidePayload | null =
    isTeacher && slide
      ? {
          resourceId: resource.id,
          resourceTitle: resource.title,
          slideId: slide.id,
          slideIndex: index,
          totalSlides: total,
          submissionsEnabled: slide.submissions_enabled,
        }
      : null;
  useTeacherLivePresence(isTeacher ? resource.class_id : null, teacherLivePayload);

  return (
    <View className="absolute inset-0 z-50 bg-paper" style={{ paddingTop: insets.top }}>
      {/* Keyed by slide id so switching slides always mounts fresh tool/zoom/tag-picker
          state instead of syncing it via effects. */}
      <SlideStage
        key={slide?.id ?? 'empty'}
        resource={resource}
        slide={slide ?? null}
        index={effectiveIndex}
        total={total}
        isLoading={isLoading}
        onClose={onClose}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(total - 1, i + 1))}
        updateSlide={updateSlide}
        updateSlidesPacing={updateSlidesPacing}
        saveAnnotations={saveAnnotations}
        saveObjects={saveObjects}
        viewerRole={viewerRole}
        studentId={studentId}
        live={isLiveHere ? live : null}
        following={following}
        onToggleFollowing={() => setFollowing((f) => !f)}
        navLocked={navLocked}
        forcedLock={forcedLock}
        onStudentActivity={lessonPresence.markActivity}
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
  updateSlidesPacing,
  saveAnnotations,
  saveObjects,
  viewerRole,
  studentId,
  live,
  following,
  onToggleFollowing,
  navLocked,
  forcedLock,
  onStudentActivity,
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
  updateSlidesPacing: ReturnType<typeof useLessonSlides>['updateSlidesPacing'];
  saveAnnotations: ReturnType<typeof useLessonSlides>['saveAnnotations'];
  saveObjects: ReturnType<typeof useLessonSlides>['saveObjects'];
  viewerRole: SlideViewerRole;
  studentId?: string;
  live: LiveSlidePayload | null;
  following: boolean;
  onToggleFollowing: () => void;
  navLocked: boolean;
  forcedLock: boolean;
  onStudentActivity: (eventType: string) => void;
}) {
  const isTeacher = viewerRole === 'teacher';
  const tag = slide?.activity_tag ? SLIDE_TAGS[slide.activity_tag] : null;
  // `live` is already pre-filtered to "only set when it matches this resource" by the
  // parent (see SlideViewerModal), so its mere presence means "live, here."
  const isLiveHere = Boolean(live);
  const liveBlinkOn = useBlink(isLiveHere);

  // Own annotation layer for a student (separate from the teacher's authoring layer above),
  // and the completion roster for a teacher — each a no-op query when not relevant to this
  // viewer, since slide?.id may briefly be null between navigations.
  const mySubmission = useMySlideSubmission(
    slide?.id ?? null,
    !isTeacher ? (studentId ?? null) : null,
  );
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
  // The slide's actual pixel dimensions, once its image has loaded — lets the stage size
  // itself to fill the full available width (rather than shrinking to fit the shorter of
  // width/height), so a portrait or tall slide displays at full width and simply scrolls
  // for the rest instead of shrinking down to fit entirely on screen. Loaded via a plain
  // browser Image rather than the RN <Image>'s onLoad — react-native-web forwards the raw
  // DOM load event there instead of the `{ source: { width, height } }` shape RN's own types
  // promise, so naturalWidth/naturalHeight aren't reliably reachable off it.
  const [loadedImgDims, setLoadedImgDims] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !slide?.url) return;
    const url = slide.url;
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled) setLoadedImgDims({ url, width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.src = url;
    return () => {
      cancelled = true;
    };
  }, [slide?.url]);
  // Discard the previous slide's dimensions once the url has moved on, rather than
  // resetting state directly in the effect above — avoids applying a stale aspect ratio to
  // the wrong slide while its own probe is still loading.
  const imgDims = loadedImgDims?.url === slide?.url ? loadedImgDims : null;
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
  const canvasStrokes = isTeacher
    ? teacherAnnotations
    : ((mySubmission.data?.annotations as unknown as SlideStroke[]) ?? []);
  const handleCanvasChange = (strokes: SlideStroke[]) => {
    if (!slide) return;
    if (isTeacher) {
      saveAnnotations.mutate({ id: slide.id, annotations: strokes });
    } else {
      onStudentActivity('drawing');
      mySubmission.saveAnnotations.mutate(strokes, { onError: () => showFlash(SUBMISSIONS_OFF_MESSAGE) });
    }
  };

  const teacherObjects = (slide?.objects as unknown as SlideObject[]) ?? [];
  const myObjects = isTeacher
    ? teacherObjects
    : ((mySubmission.data?.objects as unknown as SlideObject[]) ?? []);
  const handleObjectsChange = (objects: SlideObject[]) => {
    if (!slide) return;
    if (isTeacher) {
      saveObjects.mutate({ id: slide.id, objects });
    } else {
      onStudentActivity('annotating');
      mySubmission.saveObjects.mutate(objects, { onError: () => showFlash(SUBMISSIONS_OFF_MESSAGE) });
    }
  };

  // A student's answers to the teacher's fill-in-the-blank/multiple-choice questions —
  // irrelevant for the teacher's own view (they author questions, they don't answer them).
  // Tracked as local state rather than re-derived from the query on every render: saveAnswers
  // deliberately skips cache invalidation, so re-deriving from `mySubmission.data` would merge
  // each new answer against the same stale (pre-first-save) snapshot every time, silently
  // dropping every answer but the most recent whenever a student answers more than one
  // question on a slide.
  //
  // Seeded via the render-time-adjust pattern (see SlideTimer above) rather than a one-shot
  // `useState(() => mySubmission.data?.answers ...)` initializer — on a genuinely cold load
  // (no prior cache for this slide+student), `mySubmission.data` is still `undefined` at the
  // moment this component first mounts, so the naive one-shot version permanently locked in
  // `{}` and never got a chance to pick up the real saved answers once the query resolved.
  // Concretely this meant a student's grade badge wrongly showed 0% until they revisited the
  // slide, AND (more seriously) answering any single question while in that state wiped out
  // every other answer they'd already saved on it, since `next` merged against the empty seed
  // instead of their real prior answers — a genuine data-loss bug, not just a display glitch.
  const [myAnswers, setMyAnswers] = useState<SlideAnswers>({});
  const [answersSeeded, setAnswersSeeded] = useState(false);
  if (!isTeacher && !answersSeeded && !mySubmission.isLoading) {
    setAnswersSeeded(true);
    setMyAnswers((mySubmission.data?.answers as unknown as SlideAnswers) ?? {});
  }
  const handleAnswerChange = (questionId: string, value: string | number) => {
    const next = { ...myAnswers, [questionId]: value };
    setMyAnswers(next);
    onStudentActivity('answering');
    mySubmission.saveAnswers.mutate(next, { onError: () => showFlash(SUBMISSIONS_OFF_MESSAGE) });
  };

  // Quiz/Blanks are alternate full-screen presentations of the same teacher-authored
  // question objects the inline layer already renders — not a separate content type.
  const mcQuestions = teacherObjects.filter(
    (o): o is Extract<SlideObject, { type: 'multiple_choice' }> => o.type === 'multiple_choice',
  );
  const blankQuestions = teacherObjects.filter(
    (o): o is Extract<SlideObject, { type: 'fill_blank' }> => o.type === 'fill_blank',
  );
  const [overlay, setOverlay] = useState<'quiz' | 'blanks' | null>(null);

  // A student's own result for this slide, kept live via useMySlideSubmission's realtime
  // subscription — a teacher setting a manual grade updates this without the student
  // reloading. Auto-graded percent recomputes from the slide's current objects + the
  // student's stored answers (same as Gradebook/Grades tab), so it's never stale relative
  // to either. Only computed when the slide is explicitly in Auto mode — a Manual-mode slide
  // never auto-grades even if it happens to have gradable objects on it (a teacher can
  // deliberately choose to hand-grade a slide with fill_blank/multiple_choice questions).
  const myAutoResult =
    !isTeacher && slide?.grading_mode === 'auto' ? autoGradeSlide(teacherObjects, myAnswers) : null;

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
            <Text
              style={{ color: active ? '#fff' : meta.color }}
              className="text-[10px] font-semibold"
            >
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

  // Independent from submissionsEnabled: a slide can accept student work without the
  // teacher ever intending to score it (e.g. a warm-up). Off by default per-slide — the
  // teacher opts in only for slides that should actually be graded, and explicitly picks
  // Auto (scored live from fill_blank/multiple_choice answers) or Manual (teacher grades by
  // hand via GradingPanel, even if the slide happens to have gradable objects on it) rather
  // than that being silently inferred from content the way it used to be.
  const teacherGradingToggle = isTeacher && slide && (
    <GradingModeControl
      gradingEnabled={slide.grading_enabled}
      gradingMode={slide.grading_mode}
      onChange={(next) => updateSlide.mutate({ id: slide.id, ...next })}
    />
  );

  // Read-only badge for students — the teacher gets a tappable toggle instead, so pacing can
  // be flipped for the slide currently being presented without leaving to the thumbnail grid's
  // bulk "Set pacing" control (still the only way to set it for slides not open right now).
  const pacingBadge =
    isTeacher && slide ? (
      <Pressable
        onPress={() =>
          updateSlidesPacing.mutate({
            ids: [slide.id],
            pacingMode: slide.pacing_mode === 'teacher_paced' ? 'student_paced' : 'teacher_paced',
          })
        }
        className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${
          slide.pacing_mode === 'teacher_paced' ? 'bg-violet-50' : 'bg-black/[0.03]'
        }`}
      >
        <Feather
          name={slide.pacing_mode === 'teacher_paced' ? 'lock' : 'unlock'}
          size={10}
          color={slide.pacing_mode === 'teacher_paced' ? '#7c3aed' : '#9ca3af'}
        />
        <Text
          className={`text-[10px] font-semibold ${
            slide.pacing_mode === 'teacher_paced' ? 'text-violet-700' : 'text-ink/50'
          }`}
        >
          {slide.pacing_mode === 'teacher_paced' ? 'Teacher-paced' : 'Student-paced'}
        </Text>
      </Pressable>
    ) : (
      slide?.pacing_mode === 'teacher_paced' && (
        <View className="flex-row items-center gap-1 rounded-full bg-violet-50 px-2 py-1">
          <Feather name="lock" size={10} color="#7c3aed" />
          <Text className="text-[10px] font-semibold text-violet-700">Teacher-paced</Text>
        </View>
      )
    );

  const studentSubmitButton = !isTeacher && slide?.submissions_enabled && (
    <Pressable
      onPress={() => {
        onStudentActivity('submitted');
        mySubmission.setSubmitted.mutate(!isSubmitted);
      }}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
        isSubmitted ? 'bg-emerald-600' : 'bg-violet-600'
      }`}
    >
      <Feather name={isSubmitted ? 'check-circle' : 'send'} size={13} color="#fff" />
      <Text className="text-xs font-semibold text-white">
        {isSubmitted ? 'Submitted' : 'Submit'}
      </Text>
    </Pressable>
  );

  const quizButton = !isTeacher && mcQuestions.length > 0 && (
    <Pressable
      onPress={() => setOverlay('quiz')}
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ backgroundColor: '#FCE7F3' }}
    >
      <Feather name="award" size={13} color="#BE185D" />
      <Text className="text-xs font-bold" style={{ color: '#BE185D' }}>
        Play quiz
      </Text>
    </Pressable>
  );

  const blanksButton = !isTeacher && blankQuestions.length > 0 && (
    <Pressable
      onPress={() => setOverlay('blanks')}
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ backgroundColor: '#CFFAFE' }}
    >
      <Feather name="edit-3" size={13} color="#0891B2" />
      <Text className="text-xs font-bold" style={{ color: '#0891B2' }}>
        Fill blanks
      </Text>
    </Pressable>
  );

  // A teacher-paced slide leaves no opt-out while it's the one being presented live — the
  // interactive Self-paced/Follow-teacher switch is replaced with a plain locked badge.
  const liveToggle = isLiveHere && forcedLock ? (
    <View className="flex-row items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1.5">
      <Feather name="lock" size={11} color="#7C3AED" />
      <Text className="text-[11px] font-bold text-violet-700">Locked to teacher</Text>
    </View>
  ) : (
    isLiveHere && (
      <View className="flex-row items-center gap-1 rounded-full bg-black/[0.03] p-1">
        <Pressable
          onPress={() => following && onToggleFollowing()}
          className={`rounded-full px-2.5 py-1 ${!following ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-[11px] font-bold ${!following ? 'text-ink' : 'text-ink/40'}`}>
            Self-paced
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!following) {
              onStudentActivity('following');
              onToggleFollowing();
            }
          }}
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: following ? '#7C3AED' : 'transparent' }}
        >
          <Text
            className="text-[11px] font-bold"
            style={{ color: following ? '#fff' : 'rgba(0,0,0,0.4)' }}
          >
            Follow teacher
          </Text>
        </Pressable>
      </View>
    )
  );

  const liveTag = isLiveHere && (
    <View
      style={{ opacity: liveBlinkOn ? 1 : 0.4 }}
      className="flex-row items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1"
    >
      <View className="h-1.5 w-1.5 rounded-full bg-red-500" />
      <Text className="text-[10px] font-bold text-red-600">LIVE · your teacher is presenting</Text>
    </View>
  );

  // The stage always fills the available width at 100% zoom; its height instead follows
  // the slide's own aspect ratio once known, so the slide displays at full width even when
  // that makes it taller than the visible window — the surrounding stage is scrollable, so
  // the rest is just a scroll away rather than the whole slide shrinking down to fit.
  const stagePaddingX = fullscreen ? 16 : 32;
  const stagePaddingTop = fullscreen ? 8 : 12;
  const stagePaddingBottom = fullscreen ? 24 : 44;
  const zoomedStageWidth = Math.max(stageSize.width, stageSize.width * zoom);
  const fitWidthStageHeight = imgDims
    ? ((zoomedStageWidth - stagePaddingX * 2) / imgDims.width) * imgDims.height +
      stagePaddingTop +
      stagePaddingBottom
    : null;
  const zoomedStageHeight =
    fitWidthStageHeight !== null
      ? Math.max(stageSize.height, fitWidthStageHeight)
      : Math.max(stageSize.height, stageSize.height * zoom);

  return (
    <>
      {/* Header: back, title, tag (collapsed to a single pill once set), timer. Hidden in
          fullscreen — its pieces reappear as floating overlays on the stage instead. */}
      {!fullscreen && (
        <View className="z-20 flex-row items-center justify-between bg-white px-5 py-2">
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
            {pacingBadge}
            {liveTag}
            {liveToggle}
          </View>

          <View className="flex-row items-center gap-2.5">
            {blanksButton}
            {quizButton}
            {studentSubmitButton}
          </View>
        </View>
      )}

      {!fullscreen && slide && (
        <View className="z-10 flex-row items-center justify-between border-b border-black/5 bg-white px-5 pb-2">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            {teacherSubmissionsToggle}
            {teacherGradingToggle}
            {isTeacher && slide.grading_enabled && <GradingPanel submissions={submissions} />}
            {!isTeacher && slide.grading_enabled && (
              <StudentGradePanel
                isSubmitted={isSubmitted}
                grade={mySubmission.data?.grade ?? null}
                autoResult={myAutoResult}
                feedback={mySubmission.data?.feedback ?? null}
                gradingMode={slide.grading_mode}
              />
            )}
          </View>

          <SlideTimer
            key={slide.id}
            durationMinutes={slide.duration_minutes}
            timerCommand={slide.timer_command as SlideTimerCommand}
            editable={isTeacher}
            onChangeDuration={(minutes) =>
              updateSlide.mutate({ id: slide.id, durationMinutes: minutes || null })
            }
            onChangeCommand={(command) => updateSlide.mutate({ id: slide.id, timerCommand: command })}
          />
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
          setStageSize((prev) =>
            prev.width === width && prev.height === height ? prev : { width, height },
          );
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
              width: zoomedStageWidth,
              height: zoomedStageHeight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: '100%',
                height: '100%',
                paddingLeft: stagePaddingX,
                paddingRight: stagePaddingX,
                paddingTop: stagePaddingTop,
                paddingBottom: stagePaddingBottom,
              }}
            >
              <View className="flex-1 items-center justify-center">
                <View
                  style={{
                    width: '100%',
                    height: '100%',
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
              {/* Gated on mySubmission having actually resolved (for students — the teacher's
                  own annotations/objects come straight from the already-loaded slide, no
                  race): mounting this before the submission query settles would seed its
                  local state from stale/empty data and never get a chance to re-seed once the
                  real data arrived — see the myAnswers comment above for the concrete bug this
                  caused. A near-instant loading gap is a fine tradeoff for not silently
                  discarding a student's saved work. */}
              {(isTeacher || !mySubmission.isLoading) && (
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
              )}

              {(isTeacher || !mySubmission.isLoading) && (
                <SlideObjectsLayer
                  objects={myObjects}
                  onChange={handleObjectsChange}
                  interactive={tool === 'select'}
                  pending={pending}
                  onPlaced={() => setPending(null)}
                  zoom={zoom}
                />
              )}

              {/* Rendered last (stacked on top) so its answerable question objects are
                  reachable — the student's own interactive layer above would otherwise
                  cover the full slide with its click-catcher and block taps meant for
                  these read-only reference objects. */}
              {!isTeacher && teacherObjects.length > 0 && !mySubmission.isLoading && (
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
                <View
                  style={{ backgroundColor: `${tag.color}1f` }}
                  className="rounded-full px-2 py-0.5"
                >
                  <Text style={{ color: tag.color }} className="text-[10px] font-semibold">
                    {tag.label}
                  </Text>
                </View>
              )}
              {pacingBadge}
              {teacherSubmissionsToggle}
              {teacherGradingToggle}
              {isTeacher && slide?.grading_enabled && <GradingPanel submissions={submissions} />}
              {!isTeacher && slide?.grading_enabled && (
                <StudentGradePanel
                  isSubmitted={isSubmitted}
                  grade={mySubmission.data?.grade ?? null}
                  autoResult={myAutoResult}
                  feedback={mySubmission.data?.feedback ?? null}
                  gradingMode={slide.grading_mode}
                />
              )}
              {liveTag}
              {liveToggle}
            </View>

            <View className="absolute inset-x-0 top-3 flex-row items-center justify-center gap-2.5">
              {blanksButton}
              {quizButton}
              {studentSubmitButton}
              <SlideTimer
                key={slide.id}
                durationMinutes={slide.duration_minutes}
                timerCommand={slide.timer_command as SlideTimerCommand}
                editable={isTeacher}
                onChangeDuration={(minutes) =>
                  updateSlide.mutate({ id: slide.id, durationMinutes: minutes || null })
                }
                onChangeCommand={(command) =>
                  updateSlide.mutate({ id: slide.id, timerCommand: command })
                }
              />
            </View>

            {/* Flush against the extreme right edge, spanning the full height so it never
                collides with the header/timer/nav overlays above and below it — scrolls
                internally if the tool list is ever taller than the window. */}
            <View
              testID="fullscreen-toolbar"
              className="absolute inset-y-0 right-0 rounded-l-2xl bg-white/95 shadow-lg"
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  flexGrow: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 6,
                }}
              >
                <SlideToolbarButtons
                  orientation="vertical"
                  {...toolbarProps}
                  onToggleFullscreen={() => setFullscreen(false)}
                />
              </ScrollView>
            </View>

            <View className="absolute inset-x-0 bottom-3 items-center">
              <SlideNavControls
                index={index}
                total={total}
                onPrev={onPrev}
                onNext={onNext}
                locked={navLocked}
              />
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
          <SlideNavControls
            index={index}
            total={total}
            onPrev={onPrev}
            onNext={onNext}
            locked={navLocked}
          />
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

      {overlay === 'quiz' && (
        <QuizView
          questions={mcQuestions}
          answers={myAnswers}
          onAnswerChange={handleAnswerChange}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay === 'blanks' && (
        <FillBlanksView
          questions={blankQuestions}
          answers={myAnswers}
          onAnswerChange={handleAnswerChange}
          onClose={() => setOverlay(null)}
        />
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
  locked,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  locked?: boolean;
}) {
  const prevDisabled = locked || index === 0;
  const nextDisabled = locked || index >= total - 1;
  return (
    <View className="flex-row items-center gap-3 rounded-full bg-white px-2 py-1 shadow-sm">
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={{ opacity: prevDisabled ? 0.3 : 1 }}
        className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:bg-black/5"
      >
        <Feather name="chevron-left" size={14} color="#4b5563" />
        <Text className="text-xs font-medium text-ink/70">Prev</Text>
      </Pressable>
      <Text className="text-xs text-ink/50">
        {locked ? 'Following teacher' : `Slide ${total === 0 ? 0 : index + 1} of ${total}`}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={{ opacity: nextDisabled ? 0.3 : 1 }}
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
function AddSlideMenu({
  resource,
  onFlash,
}: {
  resource: LessonResource;
  onFlash: (message: string) => void;
}) {
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
        onSuccess: (count) =>
          onFlash(`Added ${count} slide${count === 1 ? '' : 's'} from ${asset.name}.`),
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
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather name="plus" size={18} color="#fff" />
        )}
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

// Teacher-only: turning grading on requires picking Auto or Manual up front (rather than
// silently inferring it from whether the slide happens to have gradable objects) — tapping the
// pill opens a 3-row menu (Off / Auto grading / Manual grading); the current state is always
// one of those three, never an ambiguous "on, but which kind."
function GradingModeControl({
  gradingEnabled,
  gradingMode,
  onChange,
}: {
  gradingEnabled: boolean;
  gradingMode: SlideGradingMode;
  onChange: (next: { gradingEnabled: boolean; gradingMode?: SlideGradingMode }) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = !gradingEnabled ? 'Grading off' : gradingMode === 'auto' ? 'Auto grading' : 'Manual grading';
  const color = !gradingEnabled ? '#9ca3af' : '#7c3aed';
  const bg = !gradingEnabled ? 'bg-black/[0.03]' : 'bg-violet-50';

  const options: { label: string; icon: keyof typeof Feather.glyphMap; onPress: () => void }[] = [
    {
      label: 'Off',
      icon: 'toggle-left',
      onPress: () => onChange({ gradingEnabled: false }),
    },
    {
      label: 'Auto grading',
      icon: 'zap',
      onPress: () => onChange({ gradingEnabled: true, gradingMode: 'auto' }),
    },
    {
      label: 'Manual grading',
      icon: 'edit-3',
      onPress: () => onChange({ gradingEnabled: true, gradingMode: 'manual' }),
    },
  ];

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5 ${bg}`}
      >
        <Feather name={gradingEnabled ? 'toggle-right' : 'toggle-left'} size={16} color={color} />
        <Text className="text-xs font-medium" style={{ color: gradingEnabled ? '#7c3aed' : '#6b7280' }}>
          {label}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={12} color={color} />
      </Pressable>
      {open && (
        <View className="absolute left-0 top-11 z-10 w-44 gap-0.5 rounded-xl bg-white p-1.5 shadow-lg">
          {options.map((opt) => {
            const selected =
              (opt.label === 'Off' && !gradingEnabled) ||
              (opt.label === 'Auto grading' && gradingEnabled && gradingMode === 'auto') ||
              (opt.label === 'Manual grading' && gradingEnabled && gradingMode === 'manual');
            return (
              <Pressable
                key={opt.label}
                onPress={() => {
                  opt.onPress();
                  setOpen(false);
                }}
                className={`flex-row items-center gap-2 rounded-lg px-2.5 py-2 ${
                  selected ? 'bg-violet-50' : ''
                }`}
              >
                <Feather name={opt.icon} size={13} color={selected ? '#7c3aed' : '#6b7280'} />
                <Text
                  className={`text-xs font-medium ${selected ? 'text-violet-700' : 'text-ink/70'}`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
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
          <ScrollView style={{ maxHeight: 320 }}>
            {submittedRows.map((s, i) => (
              <GradingRow
                key={s.id}
                submission={s}
                bordered={i < submittedRows.length - 1}
                onSetGrade={(grade) => submissions.setGrade.mutate({ submissionId: s.id, grade })}
                onSetFeedback={(feedback) =>
                  submissions.setGrade.mutate({ submissionId: s.id, grade: s.grade, feedback })
                }
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// One student's row inside GradingPanel — the grade slider plus a free-text comment,
// saved together via setGrade's extended {grade, feedback} input. Feedback commits on
// blur/submit (same pattern as the lesson-file rename fields elsewhere in this app)
// rather than on every keystroke, so it doesn't fire a write per character.
function GradingRow({
  submission,
  bordered,
  onSetGrade,
  onSetFeedback,
}: {
  submission: SlideSubmissionWithStudent;
  bordered: boolean;
  onSetGrade: (grade: number | null) => void;
  onSetFeedback: (feedback: string) => void;
}) {
  const [draftFeedback, setDraftFeedback] = useState(submission.feedback ?? '');

  const commitFeedback = () => {
    if (draftFeedback !== (submission.feedback ?? '')) onSetFeedback(draftFeedback);
  };

  return (
    <View className={`gap-1.5 px-1 py-2 ${bordered ? 'border-b border-black/5' : ''}`}>
      <Text className="text-xs font-medium text-ink/80" numberOfLines={1}>
        {submission.profiles?.full_name ?? 'Student'}
      </Text>
      <GradeSlider value={submission.grade} onCommit={onSetGrade} />
      <TextInput
        value={draftFeedback}
        onChangeText={setDraftFeedback}
        onBlur={commitFeedback}
        onSubmitEditing={commitFeedback}
        placeholder="Add feedback…"
        multiline
        className="rounded-lg border border-black/10 px-2 py-1.5 text-xs text-ink"
      />
    </View>
  );
}

// A student's own read-only result for a graded slide — mirrors the teacher's GradingPanel
// visually, but shows exactly one outcome (their own) instead of a per-student list. Reflects
// a manual grade if the teacher set one, else the live auto-graded percent, else "waiting to
// be graded" once submitted but neither applies yet (e.g. a manual-only slide like an exit
// ticket with no fill_blank/multiple_choice objects).
function StudentGradePanel({
  isSubmitted,
  grade,
  autoResult,
  feedback,
  gradingMode,
}: {
  isSubmitted: boolean;
  grade: number | null;
  autoResult: AutoGradeResult | null;
  feedback: string | null;
  gradingMode: SlideGradingMode;
}) {
  const [open, setOpen] = useState(false);
  // Mode is authoritative, not just "is there a manual grade" — matches use-gradebook.ts's
  // slideSubmissionPercent exactly, so a slide switched back to Auto immediately shows the
  // live-recomputed percent instead of a stale grade left over from when it was Manual.
  const hasManualGrade = gradingMode === 'manual' && grade !== null;
  const percent = gradingMode === 'manual' ? (grade ?? null) : (autoResult?.percent ?? null);
  const modeLabel = gradingMode === 'auto' ? 'Auto-graded' : 'Teacher-graded';

  if (!isSubmitted) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-black/[0.03] px-2.5 py-1.5">
        <Feather name="clock" size={12} color="#9ca3af" />
        <Text className="text-xs text-ink/40">Not submitted yet</Text>
      </View>
    );
  }

  if (percent === null) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5">
        <Feather name="clock" size={12} color="#b45309" />
        <Text className="text-xs font-medium text-amber-700">Waiting to be graded</Text>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        disabled={!feedback}
        className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5"
      >
        <Feather name="award" size={13} color="#059669" />
        <Text className="text-xs font-bold text-emerald-700">
          {modeLabel} · {percent}%
          {!hasManualGrade && autoResult ? ` · ${autoResult.correct}/${autoResult.total} correct` : ''}
        </Text>
        {feedback && <Feather name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#059669" />}
      </Pressable>
      {open && feedback && (
        <View className="absolute left-0 top-11 z-10 w-64 rounded-xl bg-white p-3 shadow-lg">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">
            Teacher feedback
          </Text>
          <Text className="mt-1 text-xs text-ink/80">{feedback}</Text>
        </View>
      )}
    </View>
  );
}

type ToolbarIconName =
  | { set: 'feather'; name: keyof typeof Feather.glyphMap }
  | { set: 'ionicons'; name: keyof typeof Ionicons.glyphMap };

function ToolbarIcon({
  icon,
  size,
  color,
}: {
  icon: ToolbarIconName;
  size: number;
  color: string;
}) {
  return icon.set === 'feather' ? (
    <Feather name={icon.name} size={size} color={color} />
  ) : (
    <Ionicons name={icon.name} size={size} color={color} />
  );
}

// Every button carries its own accent color — a resting tint so it reads as "a draw tool" /
// "a highlight tool" at a glance instead of a flat gray grid, and a solid fill of that same
// color once active. Neutral gray (`NEUTRAL_TINT`) for tools with no natural color identity
// (select/undo/redo/zoom/fullscreen).
const NEUTRAL_TINT = '#6b7280';

function SlideToolbarButton({
  icon,
  active,
  disabled,
  onPress,
  accessibilityLabel,
  tint = NEUTRAL_TINT,
}: {
  icon: ToolbarIconName;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={{
        opacity: disabled ? 0.35 : 1,
        backgroundColor: active ? tint : `${tint}14`,
        borderWidth: 1,
        borderColor: active ? tint : `${tint}2a`,
        shadowColor: tint,
        shadowOpacity: active ? 0.35 : 0,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
      className="h-9 w-9 items-center justify-center rounded-xl active:opacity-80"
    >
      <ToolbarIcon icon={icon} size={17} color={active ? '#fff' : tint} />
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

  const rowClass = vertical
    ? 'mt-1 items-center gap-1 pt-1.5'
    : 'ml-1 flex-row items-center gap-1 pl-1.5';

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
        tint={TOOL_TINTS.draw}
        accessibilityLabel="Draw"
      />
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'brush' }}
        active={tool === 'highlight'}
        onPress={() => onToolChange('highlight')}
        tint={TOOL_TINTS.highlight}
        accessibilityLabel="Highlight"
      />
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'backspace-outline' }}
        active={tool === 'erase'}
        onPress={() => onToolChange('erase')}
        tint={TOOL_TINTS.erase}
        accessibilityLabel="Erase"
      />

      {tool === 'draw' && (
        <View className={`${rowClass} flex-row items-center gap-2 rounded-xl border border-black/5 bg-white p-2 shadow-sm`}>
          {DRAW_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => onDrawColorChange(c)}
              style={{
                backgroundColor: c,
                borderWidth: drawColor === c ? 2 : 0,
                borderColor: '#fff',
                shadowColor: '#000',
                shadowOpacity: drawColor === c ? 0.25 : 0,
                shadowRadius: 3,
              }}
              className="h-5 w-5 rounded-full"
            />
          ))}
        </View>
      )}
      {tool === 'draw' && (
        <View className={`${rowClass} flex-row items-center gap-2 rounded-xl border border-black/5 bg-white p-2 shadow-sm`}>
          {DRAW_WIDTHS.map((w) => (
            <Pressable
              key={w}
              onPress={() => onDrawWidthChange(w)}
              className="h-6 w-6 items-center justify-center"
            >
              <View
                style={{
                  width: w,
                  height: w,
                  borderRadius: w,
                  backgroundColor: drawWidth === w ? TOOL_TINTS.draw : '#9ca3af',
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
        tint={TOOL_TINTS.comment}
        accessibilityLabel="Add comment"
      />
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'type' }}
        active={pendingKind === 'text'}
        onPress={onSetPendingText}
        tint={TOOL_TINTS.text}
        accessibilityLabel="Add text"
      />
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'shapes-outline' }}
        active={pendingKind === 'shape' || shapePickerOpen}
        onPress={() => {
          setEmojiPickerOpen(false);
          setShapePickerOpen((v) => !v);
        }}
        tint={TOOL_TINTS.shapes}
        accessibilityLabel="Add shape"
      />
      {shapePickerOpen && (
        <View className={`${rowClass} flex-row items-center gap-1 rounded-xl border border-black/5 bg-white p-1.5 shadow-sm`}>
          {SHAPE_OPTIONS.map(({ shape, icon }) => (
            <Pressable
              key={shape}
              onPress={() => {
                onSetPendingShape(shape);
                setShapePickerOpen(false);
              }}
              className="h-7 w-7 items-center justify-center rounded-md active:bg-black/5"
            >
              <Feather name={icon} size={14} color={TOOL_TINTS.shapes} />
            </Pressable>
          ))}
        </View>
      )}
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'link' }}
        onPress={onOpenLinkDialog}
        tint={TOOL_TINTS.link}
        accessibilityLabel="Add link"
      />
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'image' }}
        onPress={() => comingSoon('Images')}
        tint={TOOL_TINTS.image}
        accessibilityLabel="Add image"
      />
      {/* Only the teacher authors questions — students answer them inline on the slide instead. */}
      {canAuthorQuestions && (
        <SlideToolbarButton
          icon={{ set: 'ionicons', name: 'reader-outline' }}
          active={pendingKind === 'fill_blank'}
          onPress={onSetPendingFillBlank}
          accessibilityLabel="Add fill-in-the-blank question"
          tint={TOOL_TINTS.fillBlank}
        />
      )}
      {canAuthorQuestions && (
        <SlideToolbarButton
          icon={{ set: 'ionicons', name: 'checkbox-outline' }}
          active={pendingKind === 'multiple_choice'}
          onPress={onSetPendingMultipleChoice}
          accessibilityLabel="Add multiple-choice question"
          tint={TOOL_TINTS.multipleChoice}
        />
      )}
      <SlideToolbarButton
        icon={{ set: 'ionicons', name: 'happy-outline' }}
        active={pendingKind === 'emoji' || emojiPickerOpen}
        onPress={() => {
          setShapePickerOpen(false);
          setEmojiPickerOpen((v) => !v);
        }}
        tint={TOOL_TINTS.emoji}
        accessibilityLabel="Add emoji"
      />
      {emojiPickerOpen && (
        <View
          className={`${vertical ? 'flex-row flex-wrap justify-center' : 'flex-row flex-wrap'} ${rowClass} max-w-[150px] rounded-xl border border-black/5 bg-white p-1.5 shadow-sm`}
        >
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
        tint={TOOL_TINTS.file}
        accessibilityLabel="Attach file"
      />
      <SlideToolbarButton
        icon={{ set: 'feather', name: 'mic' }}
        onPress={() => comingSoon('Voice notes')}
        tint={TOOL_TINTS.voice}
        accessibilityLabel="Record voice note"
      />
    </View>
  );
}

const MAX_SLIDE_MINUTES = 20;

// Command-driven, not locally-owned: `timerCommand` ('idle' | 'running' | 'paused') lives on
// the slide itself (synced live to every viewer via useRealtimeInvalidate in
// use-lesson-slides.ts — see lesson_slides_timer_command migration), and only the teacher's
// Start/Pause/Reset buttons ever write it. Every viewer — teacher included — reacts to the
// command the same way via the effect below, which is what gives a self-paced student their
// own fresh countdown the moment they're on the slide "live": mounting with the command
// already 'running' takes the same "start fresh" branch as watching it flip to 'running'
// while already here, rather than one shared classroom-wide deadline.
function SlideTimer({
  durationMinutes,
  timerCommand,
  editable,
  onChangeDuration,
  onChangeCommand,
}: {
  durationMinutes: number | null;
  timerCommand: SlideTimerCommand;
  editable: boolean;
  onChangeDuration: (minutes: number) => void;
  onChangeCommand: (command: SlideTimerCommand) => void;
}) {
  const fullSeconds = (durationMinutes ?? 0) * 60;
  const [seconds, setSeconds] = useState(fullSeconds);
  const [expired, setExpired] = useState(false);
  const blinkOn = useBlink(expired);
  // Whether THIS viewer's own countdown has begun, and the last `timerCommand` seen — plain
  // state (not refs: this repo's lint config forbids touching refs during render), read/written
  // only by the render-time transition check right below.
  const [hasStarted, setHasStarted] = useState(timerCommand === 'running');
  const [prevCommand, setPrevCommand] = useState(timerCommand);

  // Reacts to `timerCommand` changing by adjusting state DURING render — React's documented
  // pattern for resetting/adjusting state in response to a prop change ("Adjusting some state
  // when a prop changes" in the React docs: compare against a state-tracked previous value and
  // call setState directly in the render body) — rather than in a useEffect, which would cost
  // an extra render pass and trips this repo's react-hooks/set-state-in-effect rule. This is
  // also what gives a self-paced student their own fresh countdown the moment they're on the
  // slide "live": mounting with the command already 'running' hits this same branch on the
  // very first render, exactly like watching it flip to 'running' while already here.
  if (prevCommand !== timerCommand) {
    setPrevCommand(timerCommand);
    if (timerCommand === 'running') {
      if (!hasStarted) setSeconds(fullSeconds);
      setHasStarted(true);
      setExpired(false);
    } else if (timerCommand === 'idle') {
      setSeconds(fullSeconds);
      setHasStarted(false);
      setExpired(false);
    }
    // 'paused' deliberately falls through untouched — the ticking effect below just stops,
    // freezing `seconds` wherever it currently is for this viewer.
  }

  useEffect(() => {
    if (timerCommand !== 'running') return;
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerCommand]);

  // Optimistic local resets (mirrored by the effect above once the mutation round-trips back
  // through the realtime-synced slide list) so a teacher's own controls feel instant instead
  // of waiting on a network round-trip, same reasoning as every other optimistic-then-persist
  // control in this app.
  const adjust = (delta: number) => {
    const currentMinutes = Math.round(fullSeconds / 60);
    const nextMinutes = Math.max(0, Math.min(MAX_SLIDE_MINUTES, currentMinutes + delta));
    onChangeDuration(nextMinutes);
    onChangeCommand('idle');
    setSeconds(nextMinutes * 60);
    setHasStarted(false);
    setExpired(false);
  };

  const reset = () => {
    onChangeCommand('idle');
    setSeconds(fullSeconds);
    setHasStarted(false);
    setExpired(false);
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
          {fullSeconds ? `${Math.round(fullSeconds / 60)} min` : 'None'}
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
        {expired ? (
          <View style={{ opacity: blinkOn ? 1 : 0.35 }} className="flex-row items-center gap-1.5">
            <Feather name="alert-circle" size={13} color="#dc2626" />
            <Text className="text-sm font-bold text-red-600">Time&apos;s up</Text>
          </View>
        ) : (
          <>
            <Feather name="clock" size={13} color={seconds === 0 ? '#9ca3af' : '#7c3aed'} />
            <Text
              className={`text-sm font-bold ${seconds === 0 ? 'text-ink/30' : 'text-violet-700'}`}
            >
              {formatTimer(seconds)}
            </Text>
          </>
        )}
        {editable && (
          <>
            <Pressable
              onPress={() => onChangeCommand(timerCommand === 'running' ? 'paused' : 'running')}
              disabled={fullSeconds === 0}
              style={{ opacity: fullSeconds === 0 ? 0.4 : 1 }}
              className="rounded-md bg-violet-600 px-2.5 py-1"
            >
              <Text className="text-[11px] font-semibold text-white">
                {timerCommand === 'running' ? 'Pause' : 'Start'}
              </Text>
            </Pressable>
            <Pressable onPress={reset} className="rounded-md bg-black/5 px-2.5 py-1">
              <Text className="text-[11px] font-medium text-ink/60">Reset</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
