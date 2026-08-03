import { Feather, Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

import { StudentClassView } from '@/components/class/student-class-view';
import { TEACHER_SIDEBAR_ITEMS, TeacherSidebar } from '@/components/layout/teacher-sidebar';
import { WeekFolderCard, weekColor } from '@/components/lessons/week-folder';
import { SLIDE_TAGS, SlideViewerModal } from '@/components/slides/slide-viewer';
import { useClassAssignments } from '@/hooks/queries/use-class-assignments';
import { useClassDetail } from '@/hooks/queries/use-class-detail';
import { useClassRoster } from '@/hooks/queries/use-class-roster';
import { useCreateAssignment } from '@/hooks/queries/use-create-assignment';
import { useLessonResources } from '@/hooks/queries/use-lesson-resources';
import { useLessonSlides } from '@/hooks/queries/use-lesson-slides';
import { signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';
import type { LessonFileType, LessonResource } from '@/types/database';

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

type Section = 'lessons' | 'quizzes' | 'gradebook' | 'students' | 'groups' | 'settings';

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
  const queryClient = useQueryClient();

  const classQuery = useClassDetail(classId);
  const { assignments } = useClassAssignments(classId);
  const { students } = useClassRoster(classId);
  const {
    resources,
    countByWeek,
    totalBytes,
    uploadFile,
    renameFile,
    deleteFile,
    retryConversion,
  } = useLessonResources(classId);
  const createAssignment = useCreateAssignment();

  const [section, setSection] = useState<Section>('lessons');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
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
    if (key === 'reports') return router.push('/(teacher)/reports');
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

  const handleActivityTap = (kind: 'quiz' | 'assignment' | 'project') => {
    if (!selectedWeek) {
      showFlash('Select a week first.');
      return;
    }
    if (kind === 'assignment') {
      createAssignment.mutate(
        { classId, title: `Week ${selectedWeek} Assignment`, weekNumber: selectedWeek },
        {
          onSuccess: () => {
            showFlash(`Assignment added to Week ${selectedWeek}`);
            queryClient.invalidateQueries({ queryKey: ['class-assignments', classId] });
          },
        },
      );
      return;
    }
    showFlash(kind === 'quiz' ? 'Quizzes & games are coming soon.' : 'Projects are coming soon.');
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
                weeks={weeks}
                countByWeek={countByWeek}
                resources={resources}
                selectedWeek={selectedWeek}
                onSelectWeek={toggleWeek}
                search={search}
                onSearchChange={setSearch}
                onBrowseFiles={handleBrowseFiles}
                uploading={uploadFile.isPending}
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
            {section === 'gradebook' && (
              <ComingSoonSection
                icon="stats-chart-outline"
                title="Gradebook"
                description="Per-student grade tracking and export is on the roadmap."
              />
            )}
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

          {section === 'lessons' && (
            <RightPanel onActivityTap={handleActivityTap} selectedWeek={selectedWeek} />
          )}
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

interface LessonsSectionProps {
  weeks: number[];
  countByWeek: Map<number, number>;
  resources: LessonResource[];
  selectedWeek: number | null;
  onSelectWeek: (week: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onBrowseFiles: (week: number) => void;
  uploading: boolean;
  fileActions: FileActions;
}

function LessonsSection({
  weeks,
  countByWeek,
  resources,
  selectedWeek,
  onSelectWeek,
  search,
  onSearchChange,
  onBrowseFiles,
  uploading,
  fileActions,
}: LessonsSectionProps) {
  return (
    <>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View>
          <Text className="text-2xl font-bold text-ink">My Lessons</Text>
          <Text className="text-sm text-ink/50">Organize and manage your lessons by week</Text>
        </View>
        <View className="flex-row items-center gap-2">
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
  fileActions,
}: {
  week: number;
  lessons: LessonResource[];
  otherWeeks: number[];
  countByWeek: Map<number, number>;
  onSelectWeek: (week: number) => void;
  onBrowseFiles: () => void;
  uploading: boolean;
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
        <View className="gap-4">
          {lessons.map((lesson) =>
            lesson.file_type === 'pdf' || lesson.file_type === 'image' ? (
              <SlideThumbnailGroup key={lesson.id} resource={lesson} actions={fileActions} />
            ) : (
              <FileCard key={lesson.id} resource={lesson} actions={fileActions} />
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
  actions,
}: {
  resource: LessonResource;
  actions: FileActions;
}) {
  const { data: slides, isLoading, updateSlidesPacing } = useLessonSlides(resource.id);
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

  const converting = resource.conversion_status === 'pending';
  const failed = resource.conversion_status === 'failed';

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== resource.title) actions.onRename(resource, trimmed);
    else setDraftTitle(resource.title);
    setRenaming(false);
  };

  if (converting || failed) {
    return <FileCard resource={resource} actions={actions} />;
  }

  return (
    <View className="gap-3 rounded-2xl border border-black/5 bg-white p-4">
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
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setSelectionMode(true)}
              accessibilityLabel="Select slides"
              className="flex-row items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1"
            >
              <Feather name="check-square" size={12} color="#7c3aed" />
              <Text className="text-[11px] font-semibold text-violet-700">Set pacing</Text>
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
            <Pressable
              key={slide.id}
              onPress={() =>
                selectionMode ? toggleSelected(slide.id) : actions.onOpen(resource, i)
              }
              accessibilityLabel={
                selectionMode
                  ? `${isSelected ? 'Deselect' : 'Select'} slide ${i + 1}`
                  : `Open slide ${i + 1}`
              }
              style={{ width: 124 }}
              className="gap-1"
            >
              <View
                style={{
                  height: 90,
                  backgroundColor: tag ? `${tag.color}1f` : 'rgba(0,0,0,0.04)',
                  borderColor: isSelected
                    ? '#7c3aed'
                    : tag
                      ? `${tag.color}55`
                      : 'rgba(0,0,0,0.1)',
                  borderWidth: isSelected ? 2 : 1,
                }}
                className="items-center justify-center overflow-hidden rounded-lg border"
              >
                {slide.url ? (
                  <Image
                    source={{ uri: slide.url }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <ActivityIndicator size="small" />
                )}

                {isTeacherPaced && (
                  <View
                    className="absolute left-1 top-1 h-4 w-4 items-center justify-center rounded-full bg-black/60"
                    accessibilityLabel="Teacher-paced"
                  >
                    <Feather name="lock" size={9} color="#fff" />
                  </View>
                )}

                {selectionMode && (
                  <View
                    className={`absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full ${
                      isSelected ? 'bg-violet-600' : 'bg-white/80'
                    }`}
                    style={!isSelected ? { borderWidth: 1.5, borderColor: '#c4b5fd' } : undefined}
                  >
                    {isSelected && <Text className="text-xs font-bold text-white">✓</Text>}
                  </View>
                )}
              </View>
              <Text className="text-center text-[10px] font-medium text-ink/50">Slide {i + 1}</Text>
              {tag && (
                <Text
                  style={{ color: tag.color }}
                  className="text-center text-[9px] font-semibold"
                  numberOfLines={1}
                >
                  {tag.label}
                </Text>
              )}
              {Boolean(slide.duration_minutes) && (
                <View className="flex-row items-center justify-center gap-1">
                  <Feather name="clock" size={9} color="#9ca3af" />
                  <Text className="text-[9px] text-ink/40">{slide.duration_minutes}m</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FileCard({ resource, actions }: { resource: LessonResource; actions: FileActions }) {
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
    <View className="w-56 gap-2 rounded-2xl border border-black/5 bg-white p-4">
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
    </View>
  );
}

function ActivityCard({
  color,
  icon,
  title,
  description,
  onPress,
}: {
  color: 'violet' | 'emerald' | 'amber';
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const bg = { violet: 'bg-violet-50', emerald: 'bg-emerald-50', amber: 'bg-amber-50' }[color];
  const iconBg = { violet: 'bg-violet-600', emerald: 'bg-emerald-600', amber: 'bg-amber-500' }[
    color
  ];
  const text = { violet: 'text-violet-700', emerald: 'text-emerald-700', amber: 'text-amber-700' }[
    color
  ];

  return (
    <Pressable onPress={onPress} className={`gap-1.5 rounded-xl p-3 ${bg}`}>
      <View className="flex-row items-start justify-between">
        <View className={`h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>{icon}</View>
        <Feather name="menu" size={12} color="rgba(0,0,0,0.25)" />
      </View>
      <Text className={`text-[13px] font-bold ${text}`}>{title}</Text>
      <Text className="text-[11px] leading-4 text-ink/50">{description}</Text>
    </Pressable>
  );
}

function RightPanel({
  onActivityTap,
  selectedWeek,
}: {
  onActivityTap: (kind: 'quiz' | 'assignment' | 'project') => void;
  selectedWeek: number | null;
}) {
  const steps = [
    'Click on a week folder',
    'Create or upload your lesson',
    'Drag activities to link with the lesson',
    'Everything is saved automatically',
  ];

  return (
    <View className="w-60 border-l border-black/5 bg-white">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        <View>
          <Text className="text-sm font-bold text-ink">Add Activities</Text>
          <Text className="text-[11px] text-ink/50">
            {selectedWeek
              ? `Tap to add to Week ${selectedWeek}`
              : 'Drag and drop to connect with a week or lesson'}
          </Text>
        </View>

        <ActivityCard
          color="violet"
          icon={<Ionicons name="game-controller" size={14} color="#fff" />}
          title="Quizzis & Games"
          description="Add interactive quizzes, polls, and games"
          onPress={() => onActivityTap('quiz')}
        />
        <ActivityCard
          color="emerald"
          icon={<Feather name="file-text" size={14} color="#fff" />}
          title="Assignment / Homework"
          description="Create assignments and homework tasks"
          onPress={() => onActivityTap('assignment')}
        />
        <ActivityCard
          color="amber"
          icon={<Feather name="folder" size={14} color="#fff" />}
          title="Projects"
          description="Add projects and long-term tasks"
          onPress={() => onActivityTap('project')}
        />

        <View className="gap-2">
          <Text className="text-xs font-bold text-ink">How it works</Text>
          {steps.map((step, i) => (
            <View key={step} className="flex-row items-start gap-2">
              <View className="h-4 w-4 items-center justify-center rounded-full bg-violet-500">
                <Text className="text-[9px] font-bold text-white">{i + 1}</Text>
              </View>
              <Text className="flex-1 text-[11px] leading-4 text-ink/60">{step}</Text>
            </View>
          ))}
        </View>

        <View className="gap-1 rounded-xl bg-amber-50 p-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="bulb-outline" size={13} color="#b45309" />
            <Text className="text-xs font-bold text-amber-800">Quick Tip</Text>
          </View>
          <Text className="text-[11px] leading-4 text-amber-900/70">
            You can also drag activities directly onto a lesson after opening the week folder.
          </Text>
        </View>
      </ScrollView>
    </View>
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
