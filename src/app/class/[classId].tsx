import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StudentClassView } from '@/components/class/student-class-view';
import { TEACHER_SIDEBAR_ITEMS, TeacherSidebar } from '@/components/layout/teacher-sidebar';
import { SlideThumbnailTile } from '@/components/lessons/slide-thumbnail-tile';
import { WeekFolderCard, weekColor } from '@/components/lessons/week-folder';
import { ClassReportsDashboard } from '@/components/reports/class-reports-dashboard';
import { SLIDE_TAGS, SlideViewerModal } from '@/components/slides/slide-viewer';
import { useClassAssignments } from '@/hooks/queries/use-class-assignments';
import { useClassDetail } from '@/hooks/queries/use-class-detail';
import { useClassRoster } from '@/hooks/queries/use-class-roster';
import { useGradebook } from '@/hooks/queries/use-gradebook';
import { useGradebookColumns } from '@/hooks/queries/use-gradebook-columns';
import { useLessonAttachedTasks } from '@/hooks/queries/use-lesson-attached-tasks';
import type {
  AiTaskKind,
  AttachedCardContent,
  KhanAcademyResource,
  McqQuestion,
  QuizizzResource,
} from '@/hooks/queries/use-lesson-ai-resources';
import { useLessonAiResources } from '@/hooks/queries/use-lesson-ai-resources';
import { useLessonResources } from '@/hooks/queries/use-lesson-resources';
import { useLessonSlides } from '@/hooks/queries/use-lesson-slides';
import { useStudentLiveClassPresence } from '@/hooks/queries/use-live-class-session';
import { usePortfolioFiles } from '@/hooks/queries/use-portfolio-files';
import { usePortfolioFolders } from '@/hooks/queries/use-portfolio-folders';
import { signOut } from '@/lib/auth-actions';
import { downloadCsv } from '@/lib/csv-export';
import { maxAssignableWeight, resolvePointWeights } from '@/lib/slide-grading';
import { useAuthStore } from '@/store/auth-store';
import type {
  LessonFileType,
  LessonResource,
  PortfolioFile,
  PortfolioFolder,
} from '@/types/database';

const TOTAL_WEEKS = 15;
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

const FILE_TYPE_META: Record<
  LessonFileType,
  { icon: keyof typeof Feather.glyphMap; color: string; label: string }
> = {
  pdf: { icon: 'file-text', color: '#ef4444', label: 'PDF' },
  pptx: { icon: 'monitor', color: '#f97316', label: 'PPTX' },
  docx: { icon: 'file-text', color: '#3b82f6', label: 'DOCX' },
  image: { icon: 'image', color: '#10b981', label: 'Image' },
  video: { icon: 'video', color: '#8b5cf6', label: 'Video' },
  link: { icon: 'link', color: '#64748b', label: 'Link' },
};

type Section =
  | 'lessons'
  | 'quizzes'
  | 'reports'
  | 'gradebook'
  | 'portfolio'
  | 'students'
  | 'groups'
  | 'settings';

const AI_TASK_META: Record<
  AiTaskKind,
  {
    label: string;
    shortLabel: string;
    color: string;
    bg: string;
    icon: keyof typeof Feather.glyphMap;
  }
> = {
  khan_academy_video: {
    label: 'Khan Academy Video',
    shortLabel: 'KA Video',
    color: '#0c7c59',
    bg: '#e6f7ef',
    icon: 'play-circle',
  },
  quizizz_quiz: {
    label: 'Quizizz Quiz',
    shortLabel: 'Quizizz',
    color: '#7c3aed',
    bg: '#f3e8ff',
    icon: 'activity',
  },
  custom_mcqs: {
    label: 'Custom MCQs',
    shortLabel: 'MCQs',
    color: '#b45309',
    bg: '#fffbeb',
    icon: 'help-circle',
  },
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ClassLessonsScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);

  const classQuery = useClassDetail(classId);
  const { assignments } = useClassAssignments(classId);
  const { students } = useClassRoster(classId);
  const {
    resources,
    countByWeek,
    totalBytes,
    uploadFile,
    renameFile,
    setLiveSession,
    deleteFile,
    retryConversion,
  } = useLessonResources(classId);

  const [section, setSection] = useState<Section>('lessons');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskPickerWeek, setTaskPickerWeek] = useState<number | null>(null);
  const [taskPickerResourceId, setTaskPickerResourceId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ resource: LessonResource; startIndex: number } | null>(
    null,
  );

  const toggleWeek = (week: number) => {
    setSelectedWeek((current) => (current === week ? null : week));
  };
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const showFlash = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash((current) => (current === message ? null : current)), 2500);
  };

  const fileActions: FileActions = {
    onOpen: (resource, startIndex = 0) => setViewing({ resource, startIndex }),
    onRename: (resource, title) => renameFile.mutate({ id: resource.id, title }),
    onDelete: (resource) =>
      deleteFile.mutate(resource, { onSuccess: () => showFlash('Lesson deleted.') }),
    onRetryConversion: (resource) =>
      retryConversion.mutate(resource, {
        onError: () => showFlash("Couldn't convert that file."),
      }),
  };

  const handleSidebarSelect = (key: string) => {
    if (key === 'classes') return router.push('/classes');
    if (key === 'assignments') return router.push('/(teacher)/assignments');
    setTaskPickerOpen(false);
    setTaskPickerWeek(null);
    setSection(key as Section);
  };

  const weeks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).filter((week) => {
      if (!query) return true;
      if (`week ${week}`.includes(query)) return true;
      return resources.some((r) => r.week_number === week && r.title.toLowerCase().includes(query));
    });
  }, [search, resources]);

  const handleBrowseFiles = async (weekNumber: number) => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    uploadFile.mutate(
      {
        weekNumber,
        uri: asset.uri,
        filename: asset.name,
        mimeType: asset.mimeType ?? null,
        size: asset.size ?? null,
      },
      {
        onSuccess: () => showFlash(`Uploaded to Week ${weekNumber}`),
        onError: () => showFlash("Couldn't upload that file."),
      },
    );
  };

  if (profile?.role === 'student') {
    return <StudentClassView classId={classId} />;
  }

  if (classQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator />
      </View>
    );
  }

  if (classQuery.error || !classQuery.data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-paper px-6">
        <Text className="text-center text-base text-ink/60">Couldn&apos;t load this class.</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-brand-600">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const classRow = classQuery.data;
  const breadcrumb = [
    classRow.grade,
    classRow.section?.length ? `Section ${classRow.section.join(', ')}` : null,
    classRow.subject,
  ]
    .filter(Boolean)
    .join('  •  ');

  const usedGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
  const storagePct = Math.min(100, (totalBytes / STORAGE_QUOTA_BYTES) * 100);
  const lastActivityAt = [...resources, ...assignments]
    .map((r) => new Date(r.updated_at ?? r.created_at).getTime())
    .sort((a, b) => b - a)[0];

  // Fullscreen presentation mode — sidebar and right panel are unmounted entirely (not just
  // covered by an overlay) so the slide can claim the vast majority of the window.
  if (viewing) {
    return (
      <SlideViewerModal
        resource={viewing.resource}
        startIndex={viewing.startIndex}
        onClose={() => setViewing(null)}
        viewerRole="teacher"
      />
    );
  }

  return (
    <View className="flex-1 flex-row bg-paper" style={{ paddingTop: insets.top }}>
      <TeacherSidebar
        items={TEACHER_SIDEBAR_ITEMS}
        activeKey={section}
        onSelect={handleSidebarSelect}
        teacherName={profile?.full_name ?? 'Teacher'}
        avatarUrl={profile?.avatar_url}
        onProfilePress={() => signOut()}
      />

      <View className="flex-1">
        {/* Top bar */}
        <View className="flex-row items-center justify-between border-b border-black/5 bg-white px-6 py-4">
          <Text className="text-lg font-semibold text-ink">{breadcrumb || classRow.name}</Text>
          <View className="flex-row items-center gap-2.5">
            <ToolbarButton
              icon="calendar"
              label="Calendar View"
              onPress={() => showFlash('Calendar view is coming soon.')}
            />
            <Pressable
              onPress={() => handleBrowseFiles(selectedWeek ?? 1)}
              className="flex-row items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 active:bg-violet-700"
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text className="text-sm font-semibold text-white">Create New</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-1 flex-row">
          <ScrollView className="flex-1" contentContainerClassName="gap-6 p-6">
            {section === 'lessons' && (
              <LessonsSection
                classId={classId}
                students={students}
                weeks={weeks}
                countByWeek={countByWeek}
                resources={resources}
                selectedWeek={selectedWeek}
                onSelectWeek={toggleWeek}
                search={search}
                onSearchChange={setSearch}
                onBrowseFiles={handleBrowseFiles}
                uploading={uploadFile.isPending}
                onAddTaskPress={(resourceId, week) => {
                  setTaskPickerResourceId(resourceId);
                  setTaskPickerWeek(week);
                  setTaskPickerOpen(true);
                }}
                onToggleLiveSession={(resource, live) =>
                  setLiveSession.mutate(
                    { resourceId: resource.id, live },
                    {
                      onSuccess: () =>
                        showFlash(
                          live
                            ? `${resource.title} is now live.`
                            : `${resource.title} is no longer live.`,
                        ),
                      onError: () => showFlash("Couldn't update the live session."),
                    },
                  )
                }
                onViewProgress={(resource) =>
                  router.push(`/class-progress/${classId}?resourceId=${resource.id}`)
                }
                fileActions={fileActions}
              />
            )}
            {section === 'students' && (
              <StudentsSection students={students} joinCode={classRow.join_code} />
            )}
            {section === 'quizzes' && (
              <ComingSoonSection
                icon="game-controller-outline"
                title="Quizzes & Games"
                description="Interactive quizzes, polls, and game-based review are on the roadmap."
              />
            )}
            {section === 'reports' && (
              <>
                <View>
                  <Text className="text-2xl font-bold text-ink">Reports</Text>
                  <Text className="text-sm text-ink/50">
                    Holistic, live analytics for this class — trends, distribution, activity
                    strengths, engagement, and who needs attention.
                  </Text>
                </View>
                <ClassReportsDashboard classId={classId} />
              </>
            )}
            {section === 'gradebook' && <GradebookSection classId={classId} />}
            {section === 'portfolio' && <PortfolioSection classId={classId} students={students} />}
            {section === 'groups' && (
              <ComingSoonSection
                icon="people-outline"
                title="Groups"
                description="Small-group and breakout management is on the roadmap."
              />
            )}
            {section === 'settings' && (
              <ComingSoonSection
                icon="settings-outline"
                title="Settings"
                description="Class-level settings are on the roadmap."
              />
            )}
          </ScrollView>
        </View>

        {/* Bottom stats bar */}
        <View className="flex-row items-center gap-8 border-t border-black/5 bg-black/[0.015] px-6 py-3">
          <View className="flex-row items-center gap-2.5">
            <Text className="text-xs text-ink/50">Storage Used</Text>
            <View className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
              <View
                style={{ width: `${storagePct}%` }}
                className="h-full rounded-full bg-emerald-500"
              />
            </View>
            <Text className="text-xs font-medium text-ink/70">{usedGB} GB / 10 GB</Text>
          </View>
          <StatItem label="Total Lessons" value={resources.length} />
          <StatItem label="Total Activities" value={assignments.length} />
          <View className="ml-auto flex-row items-center gap-2">
            <Feather name="cloud" size={14} color="#9ca3af" />
            <View>
              <Text className="text-xs text-ink/50">Last Backup</Text>
              <Text className="text-xs font-medium text-ink/70">
                {lastActivityAt ? timeAgo(new Date(lastActivityAt).toISOString()) : '—'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {section === 'lessons' && taskPickerOpen && (
        <TaskPickerOverlay
          resourceId={taskPickerResourceId}
          selectedWeek={taskPickerWeek ?? selectedWeek}
          onClose={() => {
            setTaskPickerOpen(false);
            setTaskPickerWeek(null);
            setTaskPickerResourceId(null);
          }}
          onAttached={(label) => {
            showFlash(`${label} attached.`);
            setTaskPickerOpen(false);
            setTaskPickerWeek(null);
            setTaskPickerResourceId(null);
          }}
        />
      )}

      {flash && (
        <View className="absolute bottom-16 right-6 rounded-xl bg-ink px-4 py-3 shadow-lg">
          <Text className="text-sm font-medium text-white">{flash}</Text>
        </View>
      )}
    </View>
  );
}

interface FileActions {
  onOpen: (resource: LessonResource, startIndex?: number) => void;
  onRename: (resource: LessonResource, title: string) => void;
  onDelete: (resource: LessonResource) => void;
  onRetryConversion: (resource: LessonResource) => void;
}

function ToolbarButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-xl border px-4 py-2.5 ${
        active ? 'border-violet-300 bg-violet-50' : 'border-black/10 bg-white'
      }`}
    >
      <Feather name={icon} size={15} color={active ? '#7c3aed' : '#4b5563'} />
      <Text className={`text-sm font-medium ${active ? 'text-violet-700' : 'text-ink/70'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View>
      <Text className="text-xs text-ink/50">{label}</Text>
      <Text className="text-sm font-bold text-ink">{value}</Text>
    </View>
  );
}

// A class-wide "who's active right now" indicator — real, not aspirational: presence already
// exists per-student (use-live-class-session.ts's class-students:{classId} channel, already
// powering the per-lesson class-progress monitor), it just had no entry point outside of
// opening one specific lesson's action row first. Clicking a name jumps straight into that
// student's live monitor view for the resource they're actually on.
function ClassActivityIndicator({
  classId,
  students,
}: {
  classId: string;
  students: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const presenceByStudent = useStudentLiveClassPresence(classId);
  const [open, setOpen] = useState(false);
  const active = Object.values(presenceByStudent).filter((p) => p.resourceId);
  const nameById = new Map(students.map((s) => [s.id, s.full_name]));

  if (active.length === 0) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-black/[0.03] px-3 py-2">
        <View className="h-2 w-2 rounded-full bg-black/15" />
        <Text className="text-xs font-medium text-ink/40">No students active</Text>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2"
      >
        <View className="h-2 w-2 rounded-full bg-emerald-500" />
        <Text className="text-xs font-semibold text-emerald-700">
          {active.length} active now
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#059669" />
      </Pressable>
      {open && (
        <View className="absolute right-0 top-11 z-30 w-72 gap-0.5 rounded-xl bg-white p-2 shadow-lg">
          <Text className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
            Active now
          </Text>
          <ScrollView style={{ maxHeight: 280 }}>
            {active.map((p) => (
              <Pressable
                key={p.studentId}
                onPress={() => {
                  setOpen(false);
                  router.push(`/class-progress/${classId}?resourceId=${p.resourceId}`);
                }}
                className="flex-row items-center justify-between gap-2 rounded-lg px-2 py-2 active:bg-black/5"
              >
                <Text className="flex-1 text-xs font-medium text-ink" numberOfLines={1}>
                  {nameById.get(p.studentId) ?? 'Student'}
                </Text>
                <Text className="text-[10px] text-ink/40">Slide {(p.slideIndex ?? 0) + 1}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

interface LessonsSectionProps {
  classId: string;
  students: { id: string; full_name: string }[];
  weeks: number[];
  countByWeek: Map<number, number>;
  resources: LessonResource[];
  selectedWeek: number | null;
  onSelectWeek: (week: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onBrowseFiles: (week: number) => void;
  uploading: boolean;
  onAddTaskPress: (resourceId: string, week: number) => void;
  onToggleLiveSession: (resource: LessonResource, live: boolean) => void;
  onViewProgress: (resource: LessonResource) => void;
  fileActions: FileActions;
}

function LessonsSection({
  classId,
  students,
  weeks,
  countByWeek,
  resources,
  selectedWeek,
  onSelectWeek,
  search,
  onSearchChange,
  onBrowseFiles,
  uploading,
  onAddTaskPress,
  onToggleLiveSession,
  onViewProgress,
  fileActions,
}: LessonsSectionProps) {
  return (
    <>
      {/* z-20 here (not just on the dropdown itself) so ClassActivityIndicator's absolutely-
          positioned panel can actually paint above the week-grid/lesson-cards content below —
          a later-in-DOM sibling otherwise wins regardless of the dropdown's own z-index, since
          only an ancestor's stacking context is compared against that sibling. Same fix as the
          fullscreen slide-viewer header's z-20 for the same reason. */}
      <View className="z-20 flex-row flex-wrap items-center justify-between gap-3">
        <View>
          <Text className="text-2xl font-bold text-ink">My Lessons</Text>
          <Text className="text-sm text-ink/50">Organize and manage your lessons by week</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <ClassActivityIndicator classId={classId} students={students} />
          <View className="w-72 flex-row items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5">
            <Feather name="search" size={15} color="#9ca3af" />
            <TextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder="Search weeks or lessons..."
              placeholderTextColor="#9ca3af"
              className="flex-1 text-sm text-ink"
            />
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white">
            <Feather name="list" size={16} color="#4b5563" />
          </View>
        </View>
      </View>

      {selectedWeek ? (
        <OpenWeekView
          week={selectedWeek}
          lessons={resources.filter((r) => r.week_number === selectedWeek)}
          otherWeeks={weeks.filter((w) => w !== selectedWeek)}
          countByWeek={countByWeek}
          onSelectWeek={onSelectWeek}
          onBrowseFiles={() => onBrowseFiles(selectedWeek)}
          uploading={uploading}
          onAddTaskPress={onAddTaskPress}
          onToggleLiveSession={onToggleLiveSession}
          onViewProgress={onViewProgress}
          fileActions={fileActions}
        />
      ) : (
        <View className="flex-row flex-wrap gap-4">
          {weeks.map((week) => (
            <WeekFolderCard
              key={week}
              week={week}
              lessonsCount={countByWeek.get(week) ?? 0}
              selected={false}
              onPress={() => onSelectWeek(week)}
            />
          ))}
        </View>
      )}
    </>
  );
}

function OpenWeekView({
  week,
  lessons,
  otherWeeks,
  countByWeek,
  onSelectWeek,
  onBrowseFiles,
  uploading,
  onAddTaskPress,
  onToggleLiveSession,
  onViewProgress,
  fileActions,
}: {
  week: number;
  lessons: LessonResource[];
  otherWeeks: number[];
  countByWeek: Map<number, number>;
  onSelectWeek: (week: number) => void;
  onBrowseFiles: () => void;
  uploading: boolean;
  onAddTaskPress: (resourceId: string, week: number) => void;
  onToggleLiveSession: (resource: LessonResource, live: boolean) => void;
  onViewProgress: (resource: LessonResource) => void;
  fileActions: FileActions;
}) {
  return (
    <View className="gap-4">
      {/* Open-folder indicator (left) + upload control — right below the search bar,
          at the same level, instead of buried under the folder like before. */}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <OpenFolderBadge
          week={week}
          lessonsCount={lessons.length}
          onPress={() => onSelectWeek(week)}
        />
        <CompactUploadControl week={week} onBrowseFiles={onBrowseFiles} uploading={uploading} />
      </View>

      {lessons.length === 0 ? (
        <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-10">
          <Text className="text-sm text-ink/40">No lessons in Week {week} yet.</Text>
        </View>
      ) : (
        <View className="gap-5">
          {lessons.map((lesson) =>
            lesson.file_type === 'pdf' || lesson.file_type === 'image' ? (
              <SlideThumbnailGroup
                key={lesson.id}
                resource={lesson}
                onAddTaskPress={() => onAddTaskPress(lesson.id, lesson.week_number)}
                onToggleLiveSession={onToggleLiveSession}
                onViewProgress={onViewProgress}
                actions={fileActions}
              />
            ) : (
              <FileCard
                key={lesson.id}
                resource={lesson}
                onAddTaskPress={() => onAddTaskPress(lesson.id, lesson.week_number)}
                actions={fileActions}
              />
            ),
          )}
        </View>
      )}

      {/* Other weeks shrink to one compact scrollable strip instead of a full grid,
          so the open week's content gets the space. */}
      <OtherWeeksStrip weeks={otherWeeks} countByWeek={countByWeek} onSelectWeek={onSelectWeek} />
    </View>
  );
}

function OpenFolderBadge({
  week,
  lessonsCount,
  onPress,
}: {
  week: number;
  lessonsCount: number;
  onPress: () => void;
}) {
  const color = weekColor(week);
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: `${color}12`, borderColor: color }}
      className="flex-row items-center gap-2 rounded-xl border px-3 py-2"
    >
      <Ionicons name="folder-open" size={16} color={color} />
      <Text className="text-sm font-bold text-ink">Week {week}</Text>
      <Text className="text-xs text-ink/40">
        · {lessonsCount} {lessonsCount === 1 ? 'Lesson' : 'Lessons'}
      </Text>
      <Feather name="chevron-up" size={14} color="#9ca3af" />
    </Pressable>
  );
}

function CompactUploadControl({
  week,
  onBrowseFiles,
  uploading,
}: {
  week: number;
  onBrowseFiles: () => void;
  uploading: boolean;
}) {
  return (
    <Pressable
      onPress={onBrowseFiles}
      disabled={uploading}
      className="flex-row items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5"
      style={{ opacity: uploading ? 0.6 : 1 }}
    >
      <Ionicons name="folder-open-outline" size={18} color="#7c3aed" />
      <View>
        <Text className="text-xs font-semibold text-violet-700">
          {uploading ? 'Uploading…' : `Drag & drop or browse (Week ${week})`}
        </Text>
        <Text className="text-[10px] text-ink/40">PDF, PPT, DOC, Images, Videos</Text>
      </View>
      <View className="rounded-lg border border-violet-200 bg-white px-3 py-1.5">
        <Text className="text-xs font-medium text-violet-700">Browse Files</Text>
      </View>
    </Pressable>
  );
}

function OtherWeeksStrip({
  weeks,
  countByWeek,
  onSelectWeek,
}: {
  weeks: number[];
  countByWeek: Map<number, number>;
  onSelectWeek: (week: number) => void;
}) {
  if (weeks.length === 0) return null;
  return (
    <View className="gap-2 border-t border-black/5 pt-3">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-ink/35">
        Other weeks
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2.5"
      >
        {weeks.map((week) => {
          const color = weekColor(week);
          const count = countByWeek.get(week) ?? 0;
          return (
            <Pressable
              key={week}
              onPress={() => onSelectWeek(week)}
              className="items-center gap-1 rounded-xl border border-black/5 bg-white px-2.5 py-2"
              style={{ width: 60 }}
            >
              <Ionicons name="folder" size={18} color={color} />
              <Text className="text-[10px] font-semibold text-ink/70">W{week}</Text>
              {count > 0 && <Text className="text-[9px] text-ink/35">{count}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SlideThumbnailGroup({
  resource,
  onAddTaskPress,
  onToggleLiveSession,
  onViewProgress,
  actions,
}: {
  resource: LessonResource;
  onAddTaskPress: () => void;
  onToggleLiveSession: (resource: LessonResource, live: boolean) => void;
  onViewProgress: (resource: LessonResource) => void;
  actions: FileActions;
}) {
  const {
    data: slides,
    isLoading,
    updateSlidesPacing,
    addBlankSlide,
    appendSlidesFromFile,
    moveSlide,
    deleteSlide,
  } = useLessonSlides(resource.id);
  const { data: attachedTasks, removeTask } = useLessonAttachedTasks(resource.id);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(resource.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Bulk "select some/all slides, then set their pacing" mode — selectedIds only has meaning
  // while selectionMode is on; both reset together whenever selection is cancelled or applied.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  const applyPacing = (pacingMode: 'teacher_paced' | 'student_paced') => {
    updateSlidesPacing.mutate({ ids: Array.from(selectedIds), pacingMode });
    exitSelectionMode();
  };

  const viewAttachedTask = (kind: AiTaskKind, content: unknown) => {
    if (kind === 'khan_academy_video' || kind === 'quizizz_quiz') {
      const resource = content as KhanAcademyResource | QuizizzResource;
      Alert.alert(resource.title, `${resource.description}\n\n${resource.url}`, [
        { text: 'Close', style: 'cancel' },
        { text: 'Open link', onPress: () => Linking.openURL(resource.url) },
      ]);
    } else {
      const mcqs = content as McqQuestion[];
      const summary = mcqs.map((mcq, i) => `${i + 1}. ${mcq.question}`).join('\n\n');
      Alert.alert('Custom MCQs', summary || 'No questions found.');
    }
  };

  const converting = resource.conversion_status === 'pending';
  const failed = resource.conversion_status === 'failed';

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== resource.title) actions.onRename(resource, trimmed);
    else setDraftTitle(resource.title);
    setRenaming(false);
  };

  const handleAppendFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    appendSlidesFromFile.mutate(
      {
        uri: asset.uri,
        filename: asset.name,
        mimeType: asset.mimeType ?? null,
      },
      {
        onError: (error) => {
          Alert.alert('Could not append slides', error.message);
        },
      },
    );
  };

  const openAddSlideOptions = () => {
    Alert.alert('Add to this lesson', 'Add slides from a file or insert a blank slide.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add file', onPress: handleAppendFile },
      {
        text: 'Blank slide',
        onPress: () =>
          addBlankSlide.mutate(undefined, {
            onError: (error) => Alert.alert('Could not add blank slide', error.message),
          }),
      },
    ]);
  };

  const handleDeleteSlide = (id: string, storagePath: string | null) => {
    Alert.alert('Delete slide?', 'This will permanently remove this slide.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteSlide.mutate(
            { id, storagePath },
            {
              onError: (error) => Alert.alert('Could not delete slide', error.message),
            },
          ),
      },
    ]);
  };

  const handleMoveSlide = (fromIndex: number, toIndex: number) => {
    moveSlide.mutate(
      { fromIndex, toIndex },
      {
        onError: (error) => Alert.alert('Could not move slide', error.message),
      },
    );
  };

  if (converting || failed) {
    return <FileCard resource={resource} onAddTaskPress={onAddTaskPress} actions={actions} />;
  }

  return (
    <View className="gap-3 rounded-2xl border border-black/15 bg-white p-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setRenaming(true)}
          disabled={renaming || selectionMode}
          className="flex-1 flex-row items-center gap-2"
        >
          <Feather name="file-text" size={14} color="#ef4444" />
          {renaming ? (
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              onSubmitEditing={commitRename}
              onBlur={commitRename}
              autoFocus
              className="flex-1 border-b border-violet-300 pb-0.5 text-sm font-semibold text-ink"
            />
          ) : (
            <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
              {resource.title}
            </Text>
          )}
        </Pressable>

        {confirmingDelete ? (
          <View className="flex-row items-center gap-2.5">
            <Pressable onPress={() => setConfirmingDelete(false)}>
              <Text className="text-xs text-ink/50">Cancel</Text>
            </Pressable>
            <Pressable onPress={() => actions.onDelete(resource)}>
              <Text className="text-xs font-semibold text-red-600">Confirm delete</Text>
            </Pressable>
          </View>
        ) : selectionMode ? (
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => setSelectedIds(new Set(slides?.map((s) => s.id) ?? []))}>
              <Text className="text-xs font-semibold text-violet-600">Select all</Text>
            </Pressable>
            <Pressable onPress={exitSelectionMode}>
              <Text className="text-xs text-ink/50">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row flex-wrap items-center justify-end gap-2">
            <Pressable
              onPress={() => onToggleLiveSession(resource, !resource.is_live_session)}
              accessibilityLabel="Toggle live session"
              className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${
                resource.is_live_session ? 'bg-emerald-600' : 'bg-black/[0.05]'
              }`}
            >
              <View
                className={`h-2 w-2 rounded-full ${resource.is_live_session ? 'bg-white' : 'bg-emerald-500'}`}
              />
              <Text
                className={`text-[11px] font-semibold ${resource.is_live_session ? 'text-white' : 'text-ink/70'}`}
              >
                {resource.is_live_session ? 'Live now' : 'Go live'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectionMode(true)}
              accessibilityLabel="Select slides"
              className="flex-row items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1"
            >
              <Feather name="check-square" size={12} color="#7c3aed" />
              <Text className="text-[11px] font-semibold text-violet-700">Set pacing</Text>
            </Pressable>
            <Pressable
              onPress={() => onViewProgress(resource)}
              accessibilityLabel="View student progress"
              className="flex-row items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1"
            >
              <Feather name="users" size={12} color="#0369a1" />
              <Text className="text-[11px] font-semibold text-sky-700">View students progress</Text>
            </Pressable>
            <Pressable
              onPress={() => setRenaming(true)}
              accessibilityLabel="Rename lesson"
              className="flex-row items-center gap-1"
            >
              <Feather name="edit-2" size={12} color="#6b7280" />
            </Pressable>
            <Pressable
              onPress={() => setConfirmingDelete(true)}
              accessibilityLabel="Delete lesson"
              className="flex-row items-center gap-1"
            >
              <Feather name="trash-2" size={12} color="#ef4444" />
            </Pressable>
          </View>
        )}
      </View>

      {selectionMode && selectedIds.size > 0 && (
        <View className="flex-row flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-3 py-2">
          <Text className="text-xs font-semibold text-violet-700">
            {selectedIds.size} slide{selectedIds.size === 1 ? '' : 's'} selected
          </Text>
          <View className="flex-1" />
          <Pressable
            onPress={() => applyPacing('teacher_paced')}
            className="flex-row items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5"
          >
            <Feather name="lock" size={11} color="#fff" />
            <Text className="text-xs font-semibold text-white">Teacher-paced</Text>
          </Pressable>
          <Pressable
            onPress={() => applyPacing('student_paced')}
            className="flex-row items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1.5"
          >
            <Feather name="unlock" size={11} color="#7c3aed" />
            <Text className="text-xs font-semibold text-violet-700">Student-paced</Text>
          </Pressable>
        </View>
      )}

      {isLoading && <ActivityIndicator size="small" />}

      <View className="flex-row flex-wrap gap-3">
        {slides?.map((slide, i) => {
          const tag = slide.activity_tag ? SLIDE_TAGS[slide.activity_tag] : null;
          const isTeacherPaced = slide.pacing_mode === 'teacher_paced';
          const isSelected = selectedIds.has(slide.id);
          return (
            <DraggableSlideCard
              key={slide.id}
              slide={slide}
              index={i}
              total={slides?.length ?? 0}
              tag={tag}
              isTeacherPaced={isTeacherPaced}
              isSelected={isSelected}
              selectionMode={selectionMode}
              disabled={moveSlide.isPending || deleteSlide.isPending}
              onOpen={() => actions.onOpen(resource, i)}
              onToggleSelected={() => toggleSelected(slide.id)}
              onMove={handleMoveSlide}
              onDelete={() => handleDeleteSlide(slide.id, slide.storage_path)}
            />
          );
        })}

        <Pressable
          onPress={openAddSlideOptions}
          accessibilityLabel="Add more slides"
          style={{ width: 124 }}
          className="gap-1"
          disabled={appendSlidesFromFile.isPending || addBlankSlide.isPending}
        >
          <View
            style={{
              height: 90,
              borderStyle: 'dashed',
              borderColor: '#a78bfa',
              borderWidth: 1.5,
            }}
            className="items-center justify-center overflow-hidden rounded-lg bg-violet-50"
          >
            {appendSlidesFromFile.isPending || addBlankSlide.isPending ? (
              <ActivityIndicator size="small" color="#7c3aed" />
            ) : (
              <>
                <View className="h-8 w-8 items-center justify-center rounded-full bg-violet-600">
                  <Feather name="plus" size={16} color="#fff" />
                </View>
                <Text className="mt-1 text-[10px] font-semibold text-violet-700">Add slide</Text>
              </>
            )}
          </View>
          <Text className="text-center text-[10px] font-medium text-ink/45">
            After Slide {slides?.length ?? 0}
          </Text>
        </Pressable>

        {(attachedTasks ?? [])
          .filter(
            (task): task is typeof task & { kind: AiTaskKind } =>
              task.kind === 'khan_academy_video' ||
              task.kind === 'quizizz_quiz' ||
              task.kind === 'custom_mcqs',
          )
          .map((task, i) => {
            const meta = AI_TASK_META[task.kind];
            return (
              <Pressable
                key={task.id}
                onPress={() => viewAttachedTask(task.kind, task.content)}
                style={{ width: 124 }}
                className="gap-1"
              >
                <View
                  style={{
                    height: 90,
                    borderColor: `${meta.color}66`,
                    backgroundColor: meta.bg,
                    borderWidth: 1,
                  }}
                  className="items-center justify-center rounded-lg"
                >
                  <View
                    style={{ backgroundColor: meta.color }}
                    className="h-7 w-7 items-center justify-center rounded-full"
                  >
                    <Feather name={meta.icon} size={12} color="#fff" />
                  </View>
                  <Text style={{ color: meta.color }} className="mt-1 text-[10px] font-semibold">
                    {meta.shortLabel}
                  </Text>
                  <Text className="text-[9px] text-ink/45">Task attached</Text>
                  <Pressable
                    onPress={() =>
                      removeTask.mutate(task.id, {
                        onError: (error) => Alert.alert('Could not remove task', error.message),
                      })
                    }
                    className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-white/90"
                    accessibilityLabel="Delete task"
                  >
                    <Feather name="x" size={10} color="#6b7280" />
                  </Pressable>
                </View>
                <Text className="text-center text-[10px] font-medium text-ink/45">
                  After Slide {(slides?.length ?? 0) + i + 1}
                </Text>
              </Pressable>
            );
          })}
      </View>

      <View className="mt-1 flex-row justify-end">
        <Pressable
          onPress={onAddTaskPress}
          className="flex-row items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1"
        >
          <Feather name="plus" size={10} color="#6d28d9" />
          <Text className="text-[9px] font-semibold text-violet-700">
            Additional Resources/Tasks
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FileCard({
  resource,
  onAddTaskPress,
  actions,
}: {
  resource: LessonResource;
  onAddTaskPress: () => void;
  actions: FileActions;
}) {
  const meta = FILE_TYPE_META[resource.file_type];
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(resource.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isSlideType = resource.file_type === 'pdf' || resource.file_type === 'image';
  const viewable = isSlideType && resource.conversion_status === 'ready';
  const converting = isSlideType && resource.conversion_status === 'pending';
  const failed = isSlideType && resource.conversion_status === 'failed';

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== resource.title) actions.onRename(resource, trimmed);
    else setDraftTitle(resource.title);
    setRenaming(false);
  };

  const badgeLabel = converting
    ? 'Converting…'
    : failed
      ? 'Convert failed'
      : viewable
        ? 'Slides'
        : meta.label;

  return (
    <View className="w-56 gap-2 rounded-2xl border border-black/15 bg-white p-4 shadow-sm">
      <Pressable
        onPress={() => viewable && actions.onOpen(resource)}
        disabled={!viewable}
        className="flex-row items-center gap-2.5"
      >
        <View
          style={{ backgroundColor: `${meta.color}1a` }}
          className="h-9 w-9 items-center justify-center rounded-xl"
        >
          {converting ? (
            <ActivityIndicator size="small" color={meta.color} />
          ) : (
            <Feather name={meta.icon} size={16} color={meta.color} />
          )}
        </View>
        <View className="flex-1">
          {renaming ? (
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              onSubmitEditing={commitRename}
              onBlur={commitRename}
              autoFocus
              className="border-b border-violet-300 pb-0.5 text-sm font-semibold text-ink"
            />
          ) : (
            <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
              {resource.title}
            </Text>
          )}
          <Text className="text-xs text-ink/45">
            Week {resource.week_number} • Lesson {resource.lesson_number}
          </Text>
        </View>
      </Pressable>

      <View className="flex-row items-center justify-between">
        <View className={`rounded-md px-2 py-0.5 ${failed ? 'bg-red-50' : 'bg-black/5'}`}>
          <Text
            className={`text-[10px] font-semibold uppercase ${failed ? 'text-red-600' : 'text-ink/50'}`}
          >
            {badgeLabel}
          </Text>
        </View>
        {failed || converting ? (
          <Pressable onPress={() => actions.onRetryConversion(resource)}>
            <Text className="text-xs font-medium text-brand-600">Retry</Text>
          </Pressable>
        ) : (
          <Text className="text-xs text-ink/40">Updated {timeAgo(resource.updated_at)}</Text>
        )}
      </View>

      {confirmingDelete ? (
        <View className="flex-row items-center justify-between rounded-lg bg-red-50 px-2.5 py-2">
          <Text className="text-xs font-medium text-red-700">Delete this lesson?</Text>
          <View className="flex-row gap-3">
            <Pressable onPress={() => setConfirmingDelete(false)}>
              <Text className="text-xs text-ink/50">Cancel</Text>
            </Pressable>
            <Pressable onPress={() => actions.onDelete(resource)}>
              <Text className="text-xs font-semibold text-red-600">Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-end gap-4 border-t border-black/5 pt-2">
          <Pressable onPress={() => setRenaming(true)} className="flex-row items-center gap-1">
            <Feather name="edit-2" size={12} color="#6b7280" />
            <Text className="text-xs text-ink/50">Rename</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmingDelete(true)}
            className="flex-row items-center gap-1"
          >
            <Feather name="trash-2" size={12} color="#ef4444" />
            <Text className="text-xs text-red-500">Delete</Text>
          </Pressable>
        </View>
      )}

      <View className="mt-1 flex-row justify-end">
        <Pressable
          onPress={onAddTaskPress}
          className="flex-row items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1"
        >
          <Feather name="plus" size={10} color="#6d28d9" />
          <Text className="text-[9px] font-semibold text-violet-700">
            Additional Resources/Tasks
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DraggableSlideCard({
  slide,
  index,
  total,
  tag,
  isTeacherPaced,
  isSelected,
  selectionMode,
  disabled,
  onOpen,
  onToggleSelected,
  onMove,
  onDelete,
}: {
  slide: { id: string; url: string | null; duration_minutes: number | null };
  index: number;
  total: number;
  tag: { label: string; color: string } | null;
  isTeacherPaced: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  disabled: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDelete: () => void;
}) {
  const pan = useState(() => new Animated.ValueXY())[0];
  const [dragging, setDragging] = useState(false);
  const tilePitch = 136; // card width (124) + gap (12)

  const reset = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      bounciness: 6,
    }).start(() => setDragging(false));
  }, [pan]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          !selectionMode &&
          !disabled &&
          (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6),
        onPanResponderGrant: () => {
          setDragging(true);
          pan.extractOffset();
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_evt, gestureState) => {
          pan.flattenOffset();
          const shift = Math.round(gestureState.dx / tilePitch);
          const toIndex = Math.max(0, Math.min(total - 1, index + shift));
          const fromIndex = index;
          reset();
          if (toIndex !== fromIndex) onMove(fromIndex, toIndex);
        },
        onPanResponderTerminate: () => {
          pan.flattenOffset();
          reset();
        },
      }),
    [disabled, index, onMove, pan, reset, selectionMode, total],
  );

  return (
    <Animated.View
      {...(!selectionMode && !disabled ? panResponder.panHandlers : {})}
      style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }] }}
    >
      <SlideThumbnailTile
        slide={slide}
        index={index}
        total={total}
        tag={tag}
        isTeacherPaced={isTeacherPaced}
        onOpen={onOpen}
        editable
        isSelected={isSelected}
        selectionMode={selectionMode}
        disabled={disabled}
        onToggleSelected={onToggleSelected}
        onMoveLeft={() => onMove(index, Math.max(0, index - 1))}
        onMoveRight={() => onMove(index, Math.min(total - 1, index + 1))}
        onDelete={onDelete}
      />
      {dragging && <Text className="text-center text-[8px] text-violet-700">Release to place</Text>}
    </Animated.View>
  );
}

function TaskPickerOverlay({
  resourceId,
  selectedWeek,
  onClose,
  onAttached,
}: {
  resourceId: string | null;
  selectedWeek: number | null;
  onClose: () => void;
  onAttached: (label: string) => void;
}) {
  const { data: aiResources, isLoading, generate, attachCard } = useLessonAiResources(resourceId);
  const [expandedMcqs, setExpandedMcqs] = useState(false);
  // Manual point overrides for the MCQ review step, keyed by question index — absent means
  // "auto" (evenly shares the remaining 100-point budget, see resolvePointWeights). Cleared
  // explicitly whenever a fresh batch is requested (regenerate/try again), since a new set of
  // questions shouldn't inherit the previous batch's point overrides at the same indices.
  const [manualPoints, setManualPoints] = useState<Record<number, number>>({});

  const status = aiResources?.status;
  const isGenerating = generate.isPending || status === 'pending';
  const khan = aiResources?.khan_academy as unknown as KhanAcademyResource | null;
  const quizizz = aiResources?.quizizz as unknown as QuizizzResource | null;
  const mcqs = aiResources?.mcqs as unknown as McqQuestion[] | null;

  const mcqWeights = mcqs
    ? resolvePointWeights(mcqs.map((_, i) => ({ id: String(i), points: manualPoints[i] ?? null })))
    : new Map<string, number>();

  const regenerate = () => {
    setManualPoints({});
    generate.mutate();
  };

  const handleAttach = (kind: AiTaskKind, content: AttachedCardContent, label: string) => {
    const resolvedContent =
      kind === 'custom_mcqs'
        ? (content as McqQuestion[]).map((mcq, i) => ({
            ...mcq,
            points: mcqWeights.get(String(i)),
          }))
        : content;
    attachCard.mutate(
      { kind, content: resolvedContent },
      {
        onSuccess: () => onAttached(label),
        onError: () =>
          Alert.alert('Could not attach', "Couldn't attach this resource to the lesson."),
      },
    );
  };

  return (
    <View className="absolute inset-0 z-20 items-center justify-center px-4">
      <View className="absolute inset-0 bg-black/25" pointerEvents="none" />
      <View
        className="w-full max-w-[420px] gap-3 rounded-3xl bg-white p-4 shadow-2xl"
        style={{ maxHeight: '85%' }}
      >
        <View className="flex-row items-start justify-between gap-2 px-1">
          <View className="flex-1 gap-1">
            <Text className="text-lg font-bold text-ink">Additional Resources</Text>
            <Text className="text-xs text-ink/50">
              {selectedWeek
                ? `AI-suggested resources for Week ${selectedWeek}.`
                : 'AI-suggested resources for this lesson.'}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close task picker"
            className="h-8 w-8 items-center justify-center rounded-full bg-black/5"
          >
            <Feather name="x" size={15} color="#6b7280" />
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="gap-3">
          {isLoading && (
            <View className="items-center py-8">
              <ActivityIndicator />
            </View>
          )}

          {!isLoading && (!aiResources || status === 'failed') && !isGenerating && (
            <View className="gap-3 rounded-2xl bg-violet-50 p-4">
              {status === 'failed' && aiResources?.error_message ? (
                <Text className="text-xs text-red-600">{aiResources.error_message}</Text>
              ) : (
                generate.isError && (
                  <Text className="text-xs text-red-600">
                    {generate.error instanceof Error
                      ? generate.error.message
                      : 'Something went wrong.'}
                  </Text>
                )
              )}
              <Text className="text-sm text-ink/60">
                Analyze this lesson with AI to get a real Khan Academy video, a real Quizizz quiz,
                and 5 custom MCQs tailored to it.
              </Text>
              <Pressable
                onPress={regenerate}
                accessibilityLabel="Generate AI resources"
                className="flex-row items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3"
              >
                <Feather name="zap" size={14} color="#fff" />
                <Text className="text-sm font-semibold text-white">
                  {status === 'failed' ? 'Try again' : 'Generate AI Resources'}
                </Text>
              </Pressable>
              <Text className="text-center text-[10px] text-ink/40">
                Uses AI + web search — takes about 10–20s.
              </Text>
            </View>
          )}

          {isGenerating && (
            <View className="items-center gap-2 rounded-2xl bg-violet-50 py-8">
              <ActivityIndicator color="#7c3aed" />
              <Text className="text-xs font-medium text-violet-700">Analyzing your lesson…</Text>
            </View>
          )}

          {!isGenerating && status === 'ready' && (
            <>
              {aiResources?.topic_summary && (
                <Text className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-ink/60">
                  {aiResources.topic_summary}
                </Text>
              )}

              {khan && (
                <ResourceCard
                  color="emerald"
                  icon={<Feather name="play-circle" size={16} color="#fff" />}
                  kicker="Khan Academy Video"
                  title={khan.title}
                  description={khan.description}
                  url={khan.url}
                  onAttach={() => handleAttach('khan_academy_video', khan, 'Khan Academy video')}
                  attaching={attachCard.isPending}
                />
              )}

              {quizizz && (
                <ResourceCard
                  color="violet"
                  icon={<Ionicons name="game-controller" size={16} color="#fff" />}
                  kicker="Quizizz Quiz"
                  title={quizizz.title}
                  description={`${quizizz.questionCount} questions — ${quizizz.description}`}
                  url={quizizz.url}
                  onAttach={() => handleAttach('quizizz_quiz', quizizz, 'Quizizz quiz')}
                  attaching={attachCard.isPending}
                />
              )}

              {mcqs && mcqs.length > 0 && (
                <View className="gap-1.5 rounded-2xl bg-amber-50 p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
                      <Feather name="help-circle" size={16} color="#fff" />
                    </View>
                    <Pressable
                      onPress={() => handleAttach('custom_mcqs', mcqs, '5 custom MCQs')}
                      disabled={attachCard.isPending}
                      className="rounded-full bg-amber-600 px-3 py-1.5"
                    >
                      <Text className="text-xs font-semibold text-white">Attach all 5</Text>
                    </Pressable>
                  </View>
                  <Text className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Custom MCQs
                  </Text>
                  <Text className="text-sm font-bold text-ink">
                    {mcqs.length} original questions
                  </Text>
                  <Pressable onPress={() => setExpandedMcqs((v) => !v)}>
                    <Text className="text-xs font-semibold text-amber-700">
                      {expandedMcqs ? 'Hide questions' : 'Show questions'}
                    </Text>
                  </Pressable>
                  {expandedMcqs &&
                    mcqs.map((mcq, i) => {
                      const weight = mcqWeights.get(String(i)) ?? 0;
                      const maxWeight = maxAssignableWeight(
                        mcqs.map((_, wi) => ({ id: String(wi), points: manualPoints[wi] ?? null })),
                        String(i),
                      );
                      return (
                        <View key={i} className="gap-1 rounded-lg bg-white/70 p-2.5">
                          <View className="flex-row items-start justify-between gap-2">
                            <Text className="flex-1 text-xs font-semibold text-ink">
                              {i + 1}. {mcq.question}
                            </Text>
                            <View className="flex-row items-center gap-1 rounded-md bg-black/5 px-1 py-0.5">
                              <Pressable
                                onPress={() =>
                                  setManualPoints((prev) => ({
                                    ...prev,
                                    [i]: Math.max(0, weight - 1),
                                  }))
                                }
                                hitSlop={4}
                                className="h-4 w-4 items-center justify-center rounded bg-white"
                              >
                                <Feather name="minus" size={9} color="#4b5563" />
                              </Pressable>
                              <Text className="w-8 text-center text-[10px] font-bold text-ink">
                                {weight} pts
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setManualPoints((prev) => ({
                                    ...prev,
                                    [i]: Math.min(maxWeight, weight + 1),
                                  }))
                                }
                                disabled={weight >= maxWeight}
                                style={{ opacity: weight >= maxWeight ? 0.4 : 1 }}
                                hitSlop={4}
                                className="h-4 w-4 items-center justify-center rounded bg-white"
                              >
                                <Feather name="plus" size={9} color="#4b5563" />
                              </Pressable>
                            </View>
                          </View>
                          {mcq.choices.map((choice, ci) => (
                            <Text
                              key={ci}
                              className={`text-[11px] ${
                                ci === mcq.correctIndex
                                  ? 'font-semibold text-emerald-700'
                                  : 'text-ink/60'
                              }`}
                            >
                              {String.fromCharCode(65 + ci)}. {choice}
                              {ci === mcq.correctIndex ? '  ✓' : ''}
                            </Text>
                          ))}
                          <Text className="text-[10px] italic text-ink/40">{mcq.explanation}</Text>
                        </View>
                      );
                    })}
                </View>
              )}

              <Pressable onPress={regenerate} className="items-center py-2">
                <Text className="text-xs font-semibold text-violet-700">Regenerate</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ResourceCard({
  color,
  icon,
  kicker,
  title,
  description,
  url,
  onAttach,
  attaching,
}: {
  color: 'violet' | 'emerald';
  icon: React.ReactNode;
  kicker: string;
  title: string;
  description: string;
  url: string;
  onAttach: () => void;
  attaching: boolean;
}) {
  const bg = color === 'violet' ? 'bg-violet-50' : 'bg-emerald-50';
  const iconBg = color === 'violet' ? 'bg-violet-600' : 'bg-emerald-600';
  const text = color === 'violet' ? 'text-violet-700' : 'text-emerald-700';

  return (
    <View className={`gap-1.5 rounded-2xl p-4 ${bg}`}>
      <View className="flex-row items-start justify-between">
        <View className={`h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>{icon}</View>
        <Pressable
          onPress={onAttach}
          disabled={attaching}
          className={`rounded-full px-3 py-1.5 ${color === 'violet' ? 'bg-violet-600' : 'bg-emerald-600'}`}
        >
          <Text className="text-xs font-semibold text-white">Attach</Text>
        </Pressable>
      </View>
      <Text className={`text-[10px] font-semibold uppercase tracking-wide ${text}`}>{kicker}</Text>
      <Text className="text-sm font-bold text-ink">{title}</Text>
      <Text className="text-xs leading-5 text-ink/50">{description}</Text>
      <Pressable onPress={() => Linking.openURL(url)}>
        <Text className={`text-xs font-semibold ${text}`} numberOfLines={1}>
          {url}
        </Text>
      </Pressable>
    </View>
  );
}

const GRADEBOOK_ROW_HEIGHT = 44;
const GRADEBOOK_HEADER_HEIGHT = 60;
const GRADEBOOK_COL_WIDTH = 108;
const GRADEBOOK_NAME_COL_WIDTH = 168;

// A real per-student x per-item spreadsheet: one column per gradable item — a slide with
// grading turned on, an attached custom-MCQs quiz, or a teacher-added custom column —
// labeled "W{week}L{lesson} {Activity}", "W{week}L{lesson}Quiz{N}", or whatever the teacher
// named it. Built from useGradebook, which is the single source of truth also feeding the
// student's own Grades tab, so a score showing up here is guaranteed to match what that
// student sees on their side. Column order is per-class and persists (see
// use-gradebook-columns.ts) — the left/right arrows on each header just swap it with its
// neighbor and save the whole new order.
function GradebookSection({ classId }: { classId: string }) {
  const gradebook = useGradebook(classId);
  const columnActions = useGradebookColumns(classId);
  const columns = gradebook.data?.columns ?? [];
  const rows = gradebook.data?.rows ?? [];

  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  const handleExportCsv = () => {
    const header = ['Student', ...columns.map((c) => c.label)];
    const body = rows.map((row) => [
      row.studentName,
      ...columns.map((c) => (row.scores[c.id] !== null ? `${row.scores[c.id]}%` : '')),
    ]);
    downloadCsv(`gradebook-${classId}.csv`, [header, ...body]);
  };

  const commitNewColumn = () => {
    const label = newColumnLabel.trim();
    if (label) columnActions.createColumn.mutate(label);
    setNewColumnLabel('');
    setAddingColumn(false);
  };

  const commitRename = () => {
    const label = draftLabel.trim();
    if (renamingColumnId && label) {
      columnActions.renameColumn.mutate({ id: renamingColumnId.replace('custom:', ''), label });
    }
    setRenamingColumnId(null);
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const order = columns.map((c) => c.id);
    [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
    columnActions.setColumnOrder.mutate(order);
  };

  return (
    <>
      <View className="flex-row items-start justify-between gap-3">
        <View>
          <Text className="text-2xl font-bold text-ink">Gradebook</Text>
          <Text className="text-sm text-ink/50">
            Every graded slide and quiz, synced live from student work.
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {addingColumn ? (
            <View className="flex-row items-center gap-1.5">
              <TextInput
                value={newColumnLabel}
                onChangeText={setNewColumnLabel}
                onSubmitEditing={commitNewColumn}
                onBlur={commitNewColumn}
                autoFocus
                placeholder="Column name"
                className="w-40 rounded-lg border border-violet-300 px-2.5 py-2 text-xs text-ink"
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setAddingColumn(true)}
              accessibilityLabel="Add gradebook column"
              className="flex-row items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2"
            >
              <Feather name="plus" size={13} color="#4b5563" />
              <Text className="text-xs font-semibold text-ink/70">Add column</Text>
            </Pressable>
          )}
          {columns.length > 0 && (
            <Pressable
              onPress={handleExportCsv}
              accessibilityLabel="Export gradebook as CSV"
              className="flex-row items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2"
            >
              <Feather name="download" size={13} color="#4b5563" />
              <Text className="text-xs font-semibold text-ink/70">Export CSV</Text>
            </Pressable>
          )}
        </View>
      </View>

      {gradebook.isLoading && <ActivityIndicator />}

      {!gradebook.isLoading && columns.length === 0 && (
        <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-10">
          <Text className="text-sm text-ink/40">
            Nothing to grade yet — turn on grading for a slide, attach a quiz, or add a custom
            column above.
          </Text>
        </View>
      )}

      {!gradebook.isLoading && columns.length > 0 && (
        <View className="flex-row overflow-hidden rounded-2xl border border-black/5 bg-white">
          <View style={{ width: GRADEBOOK_NAME_COL_WIDTH }}>
            <View
              style={{ height: GRADEBOOK_HEADER_HEIGHT }}
              className="justify-center border-b border-r border-black/5 bg-black/[0.02] px-3"
            >
              <Text className="text-[10px] font-bold uppercase tracking-wide text-ink/40">
                Student
              </Text>
            </View>
            {rows.length === 0 && (
              <View style={{ height: GRADEBOOK_ROW_HEIGHT }} className="justify-center px-3">
                <Text className="text-xs text-ink/40">No students yet</Text>
              </View>
            )}
            {rows.map((row) => (
              <View
                key={row.studentId}
                style={{ height: GRADEBOOK_ROW_HEIGHT }}
                className="justify-center border-b border-r border-black/5 px-3"
              >
                <Text className="text-xs font-semibold text-ink" numberOfLines={1}>
                  {row.studentName}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View className="flex-row">
                {columns.map((col, i) => (
                  <View
                    key={col.id}
                    style={{ width: GRADEBOOK_COL_WIDTH, height: GRADEBOOK_HEADER_HEIGHT }}
                    className="justify-center gap-0.5 border-b border-r border-black/5 bg-black/[0.02] px-1 py-1"
                  >
                    <View className="flex-row items-center justify-center gap-0.5">
                      <Pressable
                        onPress={() => moveColumn(i, -1)}
                        disabled={i === 0}
                        hitSlop={4}
                        accessibilityLabel={`Move ${col.label} left`}
                      >
                        <Feather
                          name="chevron-left"
                          size={12}
                          color={i === 0 ? '#d1d5db' : '#6b7280'}
                        />
                      </Pressable>
                      {renamingColumnId === col.id ? (
                        <TextInput
                          value={draftLabel}
                          onChangeText={setDraftLabel}
                          onSubmitEditing={commitRename}
                          onBlur={commitRename}
                          autoFocus
                          className="flex-1 border-b border-violet-300 text-center text-[10px] font-bold text-ink"
                        />
                      ) : (
                        <Pressable
                          className="flex-1"
                          disabled={col.kind !== 'custom'}
                          onPress={() => {
                            setRenamingColumnId(col.id);
                            setDraftLabel(col.label);
                          }}
                        >
                          <Text
                            className="text-center text-[10px] font-bold text-ink/60"
                            numberOfLines={2}
                          >
                            {col.label}
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => moveColumn(i, 1)}
                        disabled={i === columns.length - 1}
                        hitSlop={4}
                        accessibilityLabel={`Move ${col.label} right`}
                      >
                        <Feather
                          name="chevron-right"
                          size={12}
                          color={i === columns.length - 1 ? '#d1d5db' : '#6b7280'}
                        />
                      </Pressable>
                    </View>
                    {col.kind === 'slide' && col.gradingMode && (
                      <View className="flex-row items-center justify-center gap-0.5">
                        <Feather
                          name={col.gradingMode === 'auto' ? 'zap' : 'edit-3'}
                          size={8}
                          color="#9ca3af"
                        />
                        <Text className="text-[8px] font-medium text-ink/40">
                          {col.gradingMode === 'auto' ? 'Auto' : 'Manual'}
                        </Text>
                      </View>
                    )}
                    {col.kind === 'custom' && (
                      <Pressable
                        onPress={() =>
                          columnActions.deleteColumn.mutate(col.id.replace('custom:', ''))
                        }
                        accessibilityLabel={`Delete ${col.label} column`}
                        className="items-center"
                      >
                        <Feather name="trash-2" size={9} color="#ef4444" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
              {rows.map((row) => (
                <View key={row.studentId} className="flex-row">
                  {columns.map((col) => (
                    <View
                      key={col.id}
                      style={{ width: GRADEBOOK_COL_WIDTH, height: GRADEBOOK_ROW_HEIGHT }}
                      className="items-center justify-center border-b border-r border-black/5"
                    >
                      {col.kind === 'custom' ? (
                        <CustomScoreCell
                          key={row.scores[col.id]}
                          value={row.scores[col.id]}
                          onCommit={(score) =>
                            columnActions.setScore.mutate({
                              columnId: col.id.replace('custom:', ''),
                              studentId: row.studentId,
                              score,
                            })
                          }
                        />
                      ) : (
                        <Text
                          className={
                            row.scores[col.id] !== null
                              ? 'text-xs font-bold text-ink'
                              : 'text-xs text-ink/25'
                          }
                        >
                          {row.scores[col.id] !== null ? `${row.scores[col.id]}%` : '—'}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </>
  );
}

// A gradebook cell for a teacher-added custom column — free-typed, unlike the read-only
// auto-graded cells, since there's no submission behind it to derive a score from.
function CustomScoreCell({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (score: number | null) => void;
}) {
  const [draft, setDraft] = useState(value !== null ? String(value) : '');

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && parsed !== value) onCommit(Math.max(0, Math.min(100, parsed)));
  };

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="numeric"
      placeholder="—"
      className="w-full text-center text-xs font-bold text-ink"
    />
  );
}

// Teacher's view of the class Portfolio: folders like "Project" or "Copybook Work" the teacher
// creates and describes, with students uploading their own files into them (see
// student-class-view.tsx for that side). A teacher never uploads files here themselves — only
// name/description/order — so this screen is folder management plus a read/review roster of
// what each student has turned in.
function PortfolioSection({
  classId,
  students,
}: {
  classId: string;
  students: { id: string; full_name: string }[];
}) {
  const foldersQuery = usePortfolioFolders(classId);
  const folders = foldersQuery.folders;
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;

  const commitCreate = () => {
    const name = draftName.trim();
    if (name) {
      foldersQuery.createFolder.mutate({ name, description: draftDescription.trim() || null });
    }
    setDraftName('');
    setDraftDescription('');
    setCreating(false);
  };

  if (openFolder) {
    return (
      <PortfolioFolderDetail
        classId={classId}
        folder={openFolder}
        students={students}
        onBack={() => setOpenFolderId(null)}
      />
    );
  }

  return (
    <>
      <View className="flex-row items-start justify-between gap-3">
        <View>
          <Text className="text-2xl font-bold text-ink">Portfolio</Text>
          <Text className="text-sm text-ink/50">
            Folders for ongoing student work — projects, copybooks, and anything else you want
            collected over time.
          </Text>
        </View>
        <Pressable
          onPress={() => setCreating(true)}
          accessibilityLabel="New portfolio folder"
          className="flex-row items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 active:bg-violet-700"
        >
          <Feather name="folder-plus" size={13} color="#fff" />
          <Text className="text-xs font-semibold text-white">New folder</Text>
        </Pressable>
      </View>

      {creating && (
        <View className="gap-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Folder name (e.g. Project)"
            autoFocus
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
          />
          <TextInput
            value={draftDescription}
            onChangeText={setDraftDescription}
            placeholder="Description for students (optional)"
            multiline
            className="min-h-[60px] rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
          />
          <View className="flex-row justify-end gap-2">
            <Pressable onPress={() => setCreating(false)} className="rounded-lg px-3 py-2">
              <Text className="text-xs font-semibold text-ink/50">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={commitCreate}
              className="rounded-lg bg-violet-600 px-3 py-2 active:bg-violet-700"
            >
              <Text className="text-xs font-semibold text-white">Create</Text>
            </Pressable>
          </View>
        </View>
      )}

      {foldersQuery.isLoading && <ActivityIndicator />}

      {!foldersQuery.isLoading && folders.length === 0 && !creating && (
        <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-10">
          <Text className="text-sm text-ink/40">
            No folders yet — create one to start collecting student work.
          </Text>
        </View>
      )}

      {folders.length > 0 && (
        <View className="flex-row flex-wrap gap-3">
          {folders.map((folder) => (
            <View
              key={folder.id}
              className="w-64 gap-2 rounded-2xl border border-black/5 bg-white p-4"
            >
              {editingFolderId === folder.id ? (
                <PortfolioFolderEditForm
                  folder={folder}
                  onCancel={() => setEditingFolderId(null)}
                  onSave={(name, description) => {
                    foldersQuery.renameFolder.mutate({ id: folder.id, name, description });
                    setEditingFolderId(null);
                  }}
                />
              ) : (
                <>
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-row items-center gap-2">
                      <Feather name="folder" size={16} color="#7c3aed" />
                      <Text className="text-sm font-bold text-ink">{folder.name}</Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => setEditingFolderId(folder.id)}
                        accessibilityLabel={`Rename ${folder.name}`}
                      >
                        <Feather name="edit-2" size={13} color="#6b7280" />
                      </Pressable>
                      <Pressable
                        onPress={() => foldersQuery.deleteFolder.mutate(folder.id)}
                        accessibilityLabel={`Delete ${folder.name}`}
                      >
                        <Feather name="trash-2" size={13} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                  {folder.description ? (
                    <Text className="text-xs text-ink/50" numberOfLines={3}>
                      {folder.description}
                    </Text>
                  ) : (
                    <Text className="text-xs italic text-ink/30">No description</Text>
                  )}
                  <Pressable
                    onPress={() => setOpenFolderId(folder.id)}
                    className="mt-1 flex-row items-center gap-1.5 self-start rounded-lg border border-black/10 px-2.5 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-ink/70">Open</Text>
                    <Feather name="arrow-right" size={12} color="#4b5563" />
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function PortfolioFolderEditForm({
  folder,
  onSave,
  onCancel,
}: {
  folder: PortfolioFolder;
  onSave: (name: string, description: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description ?? '');

  return (
    <View className="gap-2">
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        className="rounded-lg border border-violet-300 px-2.5 py-2 text-sm font-bold text-ink"
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Description for students (optional)"
        className="min-h-[50px] rounded-lg border border-black/10 px-2.5 py-2 text-xs text-ink"
      />
      <View className="flex-row justify-end gap-2">
        <Pressable onPress={onCancel} className="rounded-lg px-2.5 py-1.5">
          <Text className="text-xs font-semibold text-ink/50">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => name.trim() && onSave(name.trim(), description.trim() || null)}
          className="rounded-lg bg-violet-600 px-2.5 py-1.5 active:bg-violet-700"
        >
          <Text className="text-xs font-semibold text-white">Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

// A folder's contents from the teacher's side: every student on the roster, and whatever files
// each has uploaded so far — teachers only review/download/delete here, they never upload
// (uploading is student-only, matching the folder's purpose as a submission box).
function PortfolioFolderDetail({
  classId: _classId,
  folder,
  students,
  onBack,
}: {
  classId: string;
  folder: PortfolioFolder;
  students: { id: string; full_name: string }[];
  onBack: () => void;
}) {
  const filesQuery = usePortfolioFiles(_classId, folder.id);
  const files = filesQuery.files;

  const filesByStudent = new Map<string, PortfolioFile[]>();
  for (const file of files) {
    const list = filesByStudent.get(file.student_id) ?? [];
    list.push(file);
    filesByStudent.set(file.student_id, list);
  }

  const openFile = async (file: PortfolioFile) => {
    const url = await filesQuery.getDownloadUrl(file);
    Linking.openURL(url);
  };

  return (
    <>
      <Pressable onPress={onBack} className="flex-row items-center gap-1.5 self-start">
        <Feather name="arrow-left" size={14} color="#6b7280" />
        <Text className="text-xs font-semibold text-ink/60">Back to Portfolio</Text>
      </Pressable>

      <View>
        <Text className="text-2xl font-bold text-ink">{folder.name}</Text>
        {folder.description && <Text className="text-sm text-ink/50">{folder.description}</Text>}
      </View>

      {filesQuery.isLoading && <ActivityIndicator />}

      {!filesQuery.isLoading && (
        <View className="gap-3">
          {students.length === 0 && (
            <Text className="text-sm text-ink/40">No students have joined yet.</Text>
          )}
          {students.map((student) => {
            const studentFiles = filesByStudent.get(student.id) ?? [];
            return (
              <View
                key={student.id}
                className="gap-2 rounded-2xl border border-black/5 bg-white p-4"
              >
                <Text className="text-sm font-bold text-ink">{student.full_name}</Text>
                {studentFiles.length === 0 ? (
                  <Text className="text-xs italic text-ink/30">No files uploaded yet</Text>
                ) : (
                  <View className="gap-1.5">
                    {studentFiles.map((file) => (
                      <View
                        key={file.id}
                        className="flex-row items-center justify-between gap-2 rounded-lg border border-black/5 bg-black/[0.02] px-3 py-2"
                      >
                        <Pressable
                          onPress={() => openFile(file)}
                          className="flex-1 flex-row items-center gap-2"
                        >
                          <Feather name="file" size={13} color="#6b7280" />
                          <Text className="flex-1 text-xs text-ink" numberOfLines={1}>
                            {file.file_name}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => filesQuery.deleteFile.mutate(file)}
                          accessibilityLabel={`Delete ${file.file_name}`}
                        >
                          <Feather name="trash-2" size={13} color="#ef4444" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

function StudentsSection({
  students,
  joinCode,
}: {
  students: { id: string; full_name: string }[];
  joinCode: string;
}) {
  return (
    <>
      <View>
        <Text className="text-2xl font-bold text-ink">Students</Text>
        <Text className="text-sm text-ink/50">Everyone enrolled in this class.</Text>
      </View>

      <View className="flex-row items-center gap-3 rounded-2xl bg-violet-50 px-5 py-4">
        <Ionicons name="key-outline" size={18} color="#7c3aed" />
        <Text className="text-sm text-violet-900">
          Share the join code{' '}
          <Text className="font-mono font-bold text-violet-700">{joinCode}</Text> to let students
          in.
        </Text>
      </View>

      <View className="gap-2">
        {students.length === 0 && (
          <Text className="text-sm text-ink/40">No students have joined yet.</Text>
        )}
        {students.map((student) => (
          <View
            key={student.id}
            className="flex-row items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-500">
              <Text className="text-xs font-bold text-white">
                {student.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="text-sm font-medium text-ink">{student.full_name}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function ComingSoonSection({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-24">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
        <Ionicons name={icon} size={26} color="#7c3aed" />
      </View>
      <Text className="text-lg font-bold text-ink">{title}</Text>
      <Text className="max-w-sm text-center text-sm text-ink/50">{description}</Text>
    </View>
  );
}
