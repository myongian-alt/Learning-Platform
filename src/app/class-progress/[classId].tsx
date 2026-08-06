import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlideCanvas, type SlideTool } from '@/components/canvas/slide-canvas';
import { SlideObjectsLayer } from '@/components/canvas/slide-objects-layer';
import { useClassDetail } from '@/hooks/queries/use-class-detail';
import {
  type ActivitySignal,
  type LessonMonitorStudent,
  useLessonLiveMonitor,
} from '@/hooks/queries/use-lesson-live-monitor';
import type { SlideStroke, ViewableSlide } from '@/hooks/queries/use-lesson-slides';
import { useLessonResources } from '@/hooks/queries/use-lesson-resources';
import { useTeacherStudentSlideSubmission } from '@/hooks/queries/use-slide-submissions';

type FilterKey = 'live' | 'inactive' | 'submitted' | null;

const DEMO_NAMES = [
  'Aaliyah', 'Benjamin', 'Chloe', 'Daniel', 'Emma', 'Farhan', 'Grace', 'Hassan', 'Ibrahim', 'Jessica',
  'Kevin', 'Lina', 'Mariam', 'Noah', 'Omar', 'Priya', 'Quinn', 'Rania', 'Sami', 'Tariq',
  'Uma', 'Victor', 'Waleed', 'Ximena', 'Yusuf', 'Zara', 'Anaya', 'Bilal', 'Celine', 'Diego',
];

function formatAgo(iso: string | null) {
  if (!iso) return 'No activity yet';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return `${Math.max(1, Math.floor(diffMs / 1000))}s ago`;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function signalTone(signal: ActivitySignal) {
  if (signal === 'green') return { dot: '#16a34a', bg: '#dcfce7', text: '#166534', label: 'Live' };
  if (signal === 'brown') return { dot: '#a16207', bg: '#fef3c7', text: '#92400e', label: 'In and out' };
  return { dot: '#dc2626', bg: '#fee2e2', text: '#991b1b', label: 'Inactive' };
}

function buildDemoRows(): LessonMonitorStudent[] {
  const now = Date.now();
  return DEMO_NAMES.map((name, index) => {
    const signal: ActivitySignal = index % 7 === 0 ? 'red' : index % 4 === 0 ? 'brown' : 'green';
    const secondsAgo = signal === 'green' ? 12 + index * 3 : signal === 'brown' ? 75 + index * 8 : 210 + index * 9;
    const slideIndex = index % 6;
    return {
      id: `demo-${index + 1}`,
      slide_id: `demo-slide-${slideIndex}`,
      student_id: `demo-${index + 1}`,
      submitted_at: index % 5 === 0 ? new Date(now - 60_000).toISOString() : null,
      updated_at: new Date(now - secondsAgo * 1000).toISOString(),
      grade: null,
      feedback: null,
      answers: {},
      studentId: `demo-${index + 1}`,
      fullName: name,
      avatarUrl: null,
      signal,
      isOnlineNow: signal !== 'red',
      resourceId: 'demo-resource',
      slideId: `demo-slide-${slideIndex}`,
      slideIndex,
      pacingMode: index % 3 === 0 ? 'teacher_paced' : 'student_paced',
      followingTeacher: index % 3 === 0,
      submissionsEnabled: true,
      submittedCurrentSlide: index % 5 === 0,
      lastActiveAt: new Date(now - secondsAgo * 1000).toISOString(),
      lastEventType: index % 5 === 0 ? 'submitted' : index % 2 === 0 ? 'drawing' : 'answering',
      inactivityMs: secondsAgo * 1000,
      isOnTeacherSlide: slideIndex === 1,
      annotations: index % 2 === 0
        ? [
            {
              id: `stroke-${index}`,
              tool: 'draw',
              color: '#2563eb',
              strokeWidth: 3,
              points: [
                { x: 40, y: 30 },
                { x: 120, y: 90 },
                { x: 180, y: 50 },
              ],
            },
          ]
        : [],
      objects: [],
      teacher_annotations: [],
      teacher_comment: null,
    };
  });
}

function buildDemoSlides(): ViewableSlide[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `demo-slide-${index}`,
    resource_id: 'demo-resource',
    position: index + 1,
    created_at: new Date().toISOString(),
    storage_path: null,
    annotations: [],
    objects: [],
    duration_minutes: null,
    activity_tag: null,
    pacing_mode: index % 2 === 0 ? 'teacher_paced' : 'student_paced',
    submissions_enabled: true,
    grading_enabled: true,
    url: null,
  }));
}

export default function ClassProgressScreen() {
  const { classId, resourceId, demo } = useLocalSearchParams<{
    classId: string;
    resourceId?: string;
    demo?: string;
  }>();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const usingDemo = demo === '1';
  const resolvedClassId = usingDemo ? null : classId;
  const classQuery = useClassDetail(resolvedClassId);
  const { resources } = useLessonResources(resolvedClassId);
  const activeResourceId = usingDemo ? 'demo-resource' : resourceId ?? null;
  const monitor = useLessonLiveMonitor(resolvedClassId, activeResourceId);
  const resource = resources.find((item) => item.id === resourceId) ?? null;
  const students = usingDemo ? buildDemoRows() : monitor.students;
  const slides = usingDemo ? buildDemoSlides() : monitor.slides;
  const slidesById = useMemo(() => new Map(slides.map((slide) => [slide.id, slide])), [slides]);
  const selectedStudent = students.find((student) => student.studentId === selectedStudentId) ?? null;
  const selectedSlide = selectedStudent?.slideId ? (slidesById.get(selectedStudent.slideId) ?? null) : null;

  const filteredStudents = useMemo(() => {
    const next = students.filter((student) => {
      if (filter === 'live') return student.signal === 'green';
      if (filter === 'inactive') return student.signal !== 'green';
      if (filter === 'submitted') return student.submittedCurrentSlide;
      return true;
    });
    return next.sort((a, b) => {
      const rank = { red: 0, brown: 1, green: 2 };
      if (rank[a.signal] !== rank[b.signal]) return rank[a.signal] - rank[b.signal];
      return a.fullName.localeCompare(b.fullName);
    });
  }, [filter, students]);

  const summary = useMemo(() => {
    const liveCount = students.filter((student) => student.signal === 'green').length;
    const driftingCount = students.filter((student) => student.signal === 'brown').length;
    const inactiveCount = students.filter((student) => student.signal === 'red').length;
    const submittedCount = students.filter((student) => student.submittedCurrentSlide).length;
    return { liveCount, driftingCount, inactiveCount, submittedCount };
  }, [students]);

  if (!usingDemo && !resourceId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f4f6fb] px-6">
        <Text className="text-center text-base text-slate-500">
          Open this page from a lesson&apos;s &quot;View students progress&quot; button.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6fb]">
      <ScrollView contentContainerClassName="gap-5 px-5 py-5">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="gap-1">
            <Pressable onPress={() => router.back()} className="flex-row items-center gap-1.5 self-start rounded-full bg-white px-3 py-1.5">
              <Feather name="arrow-left" size={13} color="#475569" />
              <Text className="text-xs font-semibold text-slate-600">Back</Text>
            </Pressable>
            <Text className="text-3xl font-black text-slate-900">View students progress</Text>
            <Text className="text-sm text-slate-500">
              {(classQuery.data?.name ?? 'Class')} · {usingDemo ? 'Week 1 Lesson 1 Demo' : resource?.title ?? 'Lesson'}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(`/class-progress/${classId}?demo=1`)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2"
          >
            <Text className="text-sm font-semibold text-slate-700">30-student demo</Text>
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <SummaryCard label="Live now" value={summary.liveCount} accent="#16a34a" />
          <SummaryCard label="Drifting" value={summary.driftingCount} accent="#a16207" />
          <SummaryCard label="Inactive" value={summary.inactiveCount} accent="#dc2626" />
          <SummaryCard label="Submitted" value={summary.submittedCount} accent="#4f46e5" />
        </View>

        <View className="rounded-3xl bg-white p-4 shadow-sm">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <View>
              <Text className="text-base font-bold text-slate-900">Lesson live roster</Text>
              <Text className="text-sm text-slate-500">
                {monitor.liveSession
                  ? `Teacher is presenting slide ${monitor.liveSession.slideIndex + 1} right now.`
                  : 'Showing only the students currently working inside this lesson.'}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {([
                { key: 'live', label: 'Live' },
                { key: 'inactive', label: 'Inactive' },
                { key: 'submitted', label: 'Submitted' },
              ] as const).map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => setFilter((current) => (current === item.key ? null : item.key))}
                  className={`rounded-full px-3 py-1.5 ${filter === item.key ? 'bg-slate-900' : 'bg-slate-100'}`}
                >
                  <Text className={`text-xs font-bold uppercase tracking-wide ${filter === item.key ? 'text-white' : 'text-slate-600'}`}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {monitor.isLoading && !usingDemo && <Text className="text-sm text-slate-500">Loading live roster…</Text>}
          {!monitor.isLoading && filteredStudents.length === 0 && (
            <View className="w-full rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10">
              <Text className="text-center text-sm text-slate-500">No students are active in this lesson yet.</Text>
            </View>
          )}

          {filteredStudents.map((student) => (
            <StudentProgressCard
              key={student.studentId}
              student={student}
              slide={student.slideId ? (slidesById.get(student.slideId) ?? null) : null}
              onPress={() => student.slideId && setSelectedStudentId(student.studentId)}
            />
          ))}
        </View>
      </ScrollView>

      {selectedStudent && selectedSlide && (
        <TeacherReviewModal
          key={selectedStudent.studentId}
          student={selectedStudent}
          slide={selectedSlide}
          demo={usingDemo}
          onClose={() => setSelectedStudentId(null)}
        />
      )}
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View className="min-w-[160px] flex-1 rounded-3xl bg-white p-4 shadow-sm">
      <Text className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</Text>
      <View className="mt-3 flex-row items-end justify-between">
        <Text className="text-3xl font-black text-slate-900">{value}</Text>
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      </View>
    </View>
  );
}

function StudentProgressCard({
  student,
  slide,
  onPress,
}: {
  student: LessonMonitorStudent;
  slide: ViewableSlide | null;
  onPress: () => void;
}) {
  const tone = signalTone(student.signal);
  const initial = student.fullName.charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      onPress={onPress}
      className="min-w-[220px] max-w-[270px] flex-1 rounded-3xl bg-white p-3 shadow-sm"
      style={{ borderTopWidth: 3, borderTopColor: tone.dot }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-900">
            <Text className="text-sm font-bold text-white">{initial}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{student.fullName}</Text>
            <Text className="text-[11px] text-slate-500" numberOfLines={1}>
              {student.slideIndex === null ? 'Waiting' : `Slide ${student.slideIndex + 1}`} · {formatAgo(student.lastActiveAt)}
            </Text>
          </View>
        </View>
        <View className="rounded-full px-2 py-1" style={{ backgroundColor: tone.bg }}>
          <Text className="text-[10px] font-bold uppercase" style={{ color: tone.text }}>{tone.label}</Text>
        </View>
      </View>

      <View className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <MiniStudentPreview student={student} slide={slide} />
      </View>

      <View className="mt-2 flex-row items-center justify-between gap-3 px-1">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {student.lastEventType ?? 'Watching'}
        </Text>
        {student.submittedCurrentSlide && (
          <Text className="text-[11px] font-bold text-emerald-700">Submitted</Text>
        )}
      </View>
    </Pressable>
  );
}

function MiniStudentPreview({ student, slide }: { student: LessonMonitorStudent; slide: ViewableSlide | null }) {
  return (
    <View style={{ height: 150 }} className="relative bg-white">
      {slide?.url ? (
        <Image source={{ uri: slide.url }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
      ) : (
        <View className="absolute inset-0 items-center justify-center bg-slate-100">
          <Text className="text-xs font-semibold text-slate-400">Live activity preview</Text>
        </View>
      )}
      <SlideCanvas
        key={`student-preview-${student.id}-${student.updated_at}`}
        initialStrokes={student.annotations}
        tool="select"
        color="#2563eb"
        strokeWidth={2}
        zoom={1}
        onChange={() => {}}
      />
      <SlideObjectsLayer
        key={`student-objects-${student.id}-${student.updated_at}`}
        objects={student.objects}
        onChange={() => {}}
        interactive={false}
        pending={null}
        onPlaced={() => {}}
        zoom={1}
      />
    </View>
  );
}

function TeacherReviewModal({
  student,
  slide,
  demo,
  onClose,
}: {
  student: LessonMonitorStudent;
  slide: ViewableSlide;
  demo: boolean;
  onClose: () => void;
}) {
  const teacherSubmission = useTeacherStudentSlideSubmission(demo ? null : slide.id, demo ? null : student.studentId);
  const [draftComment, setDraftComment] = useState(student.teacher_comment ?? '');
  const [tool, setTool] = useState<SlideTool>('draw');

  const teacherAnnotations = demo
    ? student.teacher_annotations
    : ((teacherSubmission.data?.teacher_annotations as unknown as SlideStroke[]) ?? student.teacher_annotations ?? []);

  return (
    <View className="absolute inset-0 bg-black/55 px-6 py-6">
      <View className="flex-1 rounded-[28px] bg-white p-5 shadow-2xl">
        <View className="flex-row items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <View>
            <Text className="text-xl font-black text-slate-900">{student.fullName}</Text>
            <Text className="text-sm text-slate-500">
              Slide {student.slideIndex === null ? '—' : student.slideIndex + 1} · {formatAgo(student.lastActiveAt)}
            </Text>
          </View>
          <Pressable onPress={onClose} className="rounded-full bg-slate-100 p-2">
            <Feather name="x" size={18} color="#475569" />
          </Pressable>
        </View>

        <View className="mt-4 flex-1 flex-row gap-5">
          <View className="flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <Text className="text-sm font-semibold text-slate-700">Live student slide</Text>
              <View className="flex-row gap-2">
                {([
                  { key: 'select', icon: 'mouse-pointer' },
                  { key: 'draw', icon: 'edit-3' },
                  { key: 'highlight', icon: 'feather' },
                  { key: 'erase', icon: 'delete' },
                ] as const).map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setTool(item.key)}
                    className={`rounded-full px-3 py-1.5 ${tool === item.key ? 'bg-slate-900' : 'bg-slate-100'}`}
                  >
                    <Text className={`text-xs font-semibold ${tool === item.key ? 'text-white' : 'text-slate-600'}`}>
                      {item.key}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="relative flex-1">
              {slide.url ? (
                <Image source={{ uri: slide.url }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
              ) : (
                <View className="absolute inset-0 items-center justify-center bg-slate-100">
                  <Text className="text-sm font-semibold text-slate-400">No slide preview available</Text>
                </View>
              )}
              <SlideCanvas
                key={`student-layer-${student.id}-${student.updated_at}`}
                initialStrokes={student.annotations}
                tool="select"
                color="#2563eb"
                strokeWidth={2}
                zoom={1}
                onChange={() => {}}
              />
              <SlideObjectsLayer
                key={`student-objects-modal-${student.id}-${student.updated_at}`}
                objects={student.objects}
                onChange={() => {}}
                interactive={false}
                pending={null}
                onPlaced={() => {}}
                zoom={1}
              />
              <SlideCanvas
                key={`teacher-layer-${student.id}-${teacherSubmission.data?.updated_at ?? 'demo'}`}
                initialStrokes={teacherAnnotations}
                tool={tool}
                color={tool === 'highlight' ? '#facc15' : '#dc2626'}
                strokeWidth={tool === 'highlight' ? 14 : 3}
                zoom={1}
                onChange={(next) => {
                  if (!demo) teacherSubmission.saveTeacherAnnotations.mutate(next);
                }}
              />
            </View>
          </View>

          <View className="w-[300px] gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <View>
              <Text className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Activity</Text>
              <Text className="mt-2 text-sm font-semibold text-slate-700">{student.lastEventType ?? 'Watching'}</Text>
            </View>
            <View>
              <Text className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Teacher comment</Text>
              <TextInput
                value={draftComment}
                onChangeText={setDraftComment}
                onBlur={() => !demo && teacherSubmission.saveTeacherComment.mutate(draftComment.trim())}
                onSubmitEditing={() => !demo && teacherSubmission.saveTeacherComment.mutate(draftComment.trim())}
                placeholder="Write a quick note for this student..."
                multiline
                className="mt-2 min-h-[120px] rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
              />
            </View>
            <View className="rounded-2xl bg-white p-3">
              <Text className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Status</Text>
              <Text className="mt-2 text-sm text-slate-600">
                {student.submittedCurrentSlide ? 'Submitted this slide.' : 'Still working on this slide.'}
              </Text>
              <Text className="mt-1 text-sm text-slate-600">
                {student.followingTeacher ? 'Following teacher pacing.' : 'Working independently.'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
