import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { McqTaskQuizModal } from '@/components/class/mcq-task-quiz';
import { StudentGradebookView } from '@/components/class/student-gradebook-view';
import { SlideThumbnailTile } from '@/components/lessons/slide-thumbnail-tile';
import { WeekFolderCard } from '@/components/lessons/week-folder';
import { type SidebarItem, TeacherSidebar } from '@/components/layout/teacher-sidebar';
import { SLIDE_TAGS, SlideViewerModal } from '@/components/slides/slide-viewer';
import { useClassDetail } from '@/hooks/queries/use-class-detail';
import { useClassWeekProgress } from '@/hooks/queries/use-class-week-progress';
import type {
  KhanAcademyResource,
  McqQuestion,
  QuizizzResource,
} from '@/hooks/queries/use-lesson-ai-resources';
import { useLessonResources } from '@/hooks/queries/use-lesson-resources';
import { useLessonSlides } from '@/hooks/queries/use-lesson-slides';
import { useMcqTaskSubmissions } from '@/hooks/queries/use-mcq-task-submission';
import { usePortfolioFiles } from '@/hooks/queries/use-portfolio-files';
import { usePortfolioFolders } from '@/hooks/queries/use-portfolio-folders';
import { useWeekActivities, type WeekActivity } from '@/hooks/queries/use-week-activities';
import {
  useWeekAttachedTasks,
  type WeekAttachedTask,
} from '@/hooks/queries/use-week-attached-tasks';
import { useBlink } from '@/hooks/use-blink';
import { useAuthStore } from '@/store/auth-store';
import type { LessonFileType, LessonResource, PortfolioFolder } from '@/types/database';

// Same nav shell the teacher gets inside a class (TeacherSidebar, already a generic
// items/activeKey/onSelect component with no teacher-specific logic) — a student only gets
// the sections they can actually use, in the same visual language instead of the old
// sidebar-less segmented toggle.
const STUDENT_CLASS_SIDEBAR_ITEMS: SidebarItem[] = [
  { key: 'lessons', label: 'Lessons', icon: 'book-open' },
  { key: 'gradebook', label: 'Gradebook', icon: 'book' },
  { key: 'portfolio', label: 'Portfolio', icon: 'folder' },
];

const FILE_TYPE_META: Record<
  LessonFileType,
  { icon: keyof typeof Feather.glyphMap; color: string }
> = {
  pdf: { icon: 'file-text', color: '#ef4444' },
  pptx: { icon: 'file-text', color: '#f59e0b' },
  docx: { icon: 'file-text', color: '#2563eb' },
  image: { icon: 'image', color: '#059669' },
  video: { icon: 'video', color: '#7c3aed' },
  link: { icon: 'link', color: '#0891b2' },
};

const AI_TASK_META: Record<
  WeekAttachedTask['kind'],
  { label: string; color: string; bg: string; icon: keyof typeof Feather.glyphMap }
> = {
  khan_academy_video: {
    label: 'Khan Academy',
    color: '#059669',
    bg: '#ECFDF5',
    icon: 'play-circle',
  },
  quizizz_quiz: { label: 'Quizizz', color: '#7C3AED', bg: '#F5F3FF', icon: 'activity' },
  custom_mcqs: { label: 'Quiz', color: '#B45309', bg: '#FFFBEB', icon: 'help-circle' },
};

const TOTAL_WEEKS = 15;

const FILE_TYPE_LABEL: Record<LessonFileType, string> = {
  pdf: 'PDF',
  pptx: 'Slides',
  docx: 'Document',
  image: 'Image',
  video: 'Video',
  link: 'Link',
};

function isViewable(resource: LessonResource) {
  return resource.file_type === 'image' || resource.conversion_status === 'ready';
}

// A student's per-class experience, now structurally matching the teacher's own
// (src/app/class/[classId].tsx): a persistent sidebar (Lessons/Gradebook/Portfolio) instead
// of a sidebar-less segmented toggle, and Lessons rendered as the same rich cards/thumbnail
// grid the teacher sees (via the shared SlideThumbnailTile) instead of plain text rows — a
// slide needing a response shows its status directly on its own tile now, rather than a
// separate "Activities to respond to" list duplicating the same slides. Slides open via the
// same SlideViewerModal in "student" mode (own annotate+submit layer instead of the
// teacher's authoring layer).
export function StudentClassView({ classId }: { classId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const studentId = useAuthStore((s) => s.session?.user.id);
  const classQuery = useClassDetail(classId);
  const { resources, isLoading } = useLessonResources(classId);
  const weekProgress = useClassWeekProgress(classId, studentId ?? null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [section, setSection] = useState<'lessons' | 'gradebook' | 'portfolio'>('lessons');
  const [viewing, setViewing] = useState<{ resource: LessonResource; startIndex: number } | null>(
    null,
  );

  const weekResources = useMemo(
    () => (selectedWeek === null ? [] : resources.filter((r) => r.week_number === selectedWeek)),
    [resources, selectedWeek],
  );
  const weekResourceIds = useMemo(() => weekResources.map((r) => r.id), [weekResources]);
  const liveBlinkOn = useBlink(weekResources.some((r) => r.is_live_session));
  const activities = useWeekActivities(weekResourceIds, studentId ?? null);
  const activityBySlideId = useMemo(
    () => new Map((activities.data ?? []).map((a) => [a.slideId, a])),
    [activities.data],
  );
  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const attachedTasks = useWeekAttachedTasks(weekResourceIds);
  const mcqTaskIds = useMemo(
    () => (attachedTasks.data ?? []).filter((t) => t.kind === 'custom_mcqs').map((t) => t.id),
    [attachedTasks.data],
  );
  const mcqSubmissions = useMcqTaskSubmissions(mcqTaskIds);
  const mcqSubmissionByTask = useMemo(
    () => new Map((mcqSubmissions.data ?? []).map((s) => [s.task_id, s])),
    [mcqSubmissions.data],
  );
  const [takingQuiz, setTakingQuiz] = useState<{
    taskId: string;
    title: string;
    mcqs: McqQuestion[];
  } | null>(null);

  if (viewing && studentId) {
    return (
      <SlideViewerModal
        resource={viewing.resource}
        startIndex={viewing.startIndex}
        onClose={() => setViewing(null)}
        viewerRole="student"
        studentId={studentId}
      />
    );
  }

  return (
    <View className="flex-1 flex-row bg-lf-canvas" style={{ paddingTop: insets.top }}>
      <TeacherSidebar
        items={STUDENT_CLASS_SIDEBAR_ITEMS}
        activeKey={section}
        onSelect={(key) => {
          setSelectedWeek(null);
          setSection(key as typeof section);
        }}
        teacherName={profile?.full_name ?? 'Student'}
        avatarUrl={profile?.avatar_url}
        roleLabel="Student"
        onProfilePress={() => router.back()}
      />

      <View className="flex-1">
        <View className="flex-row items-center gap-3 border-b border-lf-line bg-white px-5 py-4">
          <Pressable
            onPress={() => (selectedWeek !== null ? setSelectedWeek(null) : router.back())}
            className="h-8 w-8 items-center justify-center rounded-lg active:bg-black/5"
          >
            <Feather name="chevron-left" size={18} color="#4b5563" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-lf-ink">
              {selectedWeek !== null
                ? `Week ${selectedWeek}`
                : section === 'gradebook'
                  ? 'Gradebook'
                  : section === 'portfolio'
                    ? 'Portfolio'
                    : (classQuery.data?.name ?? 'Class')}
            </Text>
            {(selectedWeek !== null || section !== 'lessons') && (
              <Text className="text-xs text-lf-muted">{classQuery.data?.name}</Text>
            )}
          </View>
        </View>

        {section === 'gradebook' ? (
          <StudentGradebookView classId={classId} />
        ) : section === 'portfolio' ? (
          <StudentPortfolioView classId={classId} studentId={studentId ?? null} />
        ) : selectedWeek === null ? (
          <ScrollView contentContainerClassName="gap-3 p-5">
            {isLoading && <ActivityIndicator />}
            <View className="flex-row flex-wrap gap-3">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((week) => {
                const progress = weekProgress.data?.get(week);
                const locked = !progress || progress.resourceCount === 0;
                return (
                  <WeekFolderCard
                    key={week}
                    week={week}
                    lessonsCount={progress?.resourceCount ?? 0}
                    selected={false}
                    locked={locked}
                    progressPercent={progress?.percentComplete ?? null}
                    statusLabel={
                      locked ? 'Locked' : progress?.percentComplete === 100 ? 'Done' : undefined
                    }
                    onPress={() => {
                      if (locked) return;
                      setSelectedWeek(week);
                    }}
                  />
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerClassName="gap-5 p-5">
            {weekResources.length === 0 && (
              <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-10">
                <Text className="text-sm text-lf-muted">
                  No lessons in Week {selectedWeek} yet.
                </Text>
              </View>
            )}
            {weekResources.map((resource) =>
              resource.file_type === 'pdf' || resource.file_type === 'image' ? (
                <StudentSlideLessonCard
                  key={resource.id}
                  resource={resource}
                  activityBySlideId={activityBySlideId}
                  liveBlinkOn={liveBlinkOn}
                  onOpenSlide={(startIndex) => setViewing({ resource, startIndex })}
                />
              ) : (
                <StudentFileLessonCard
                  key={resource.id}
                  resource={resource}
                  liveBlinkOn={liveBlinkOn}
                  onOpen={() => isViewable(resource) && setViewing({ resource, startIndex: 0 })}
                />
              ),
            )}

            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">
                Additional resources
              </Text>
              {attachedTasks.isLoading && <ActivityIndicator />}
              {!attachedTasks.isLoading && (attachedTasks.data?.length ?? 0) === 0 && (
                <Text className="text-sm text-lf-muted">Nothing posted yet.</Text>
              )}
              {attachedTasks.data?.map((task) => {
                const meta = AI_TASK_META[task.kind];
                const resource = resourceById.get(task.resourceId);

                if (task.kind === 'khan_academy_video') {
                  const video = task.content as KhanAcademyResource;
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => Linking.openURL(video.url)}
                      className="flex-row items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm"
                    >
                      <Feather name={meta.icon} size={16} color={meta.color} />
                      <View className="flex-1 gap-0.5">
                        <Text className="text-sm font-semibold text-lf-ink" numberOfLines={1}>
                          {video.title}
                        </Text>
                        <Text className="text-xs text-lf-muted" numberOfLines={1}>
                          {resource?.title} · Khan Academy video
                        </Text>
                      </View>
                      <Feather name="external-link" size={14} color="#9ca3af" />
                    </Pressable>
                  );
                }

                if (task.kind === 'quizizz_quiz') {
                  const quizizz = task.content as QuizizzResource;
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => Linking.openURL(quizizz.url)}
                      className="flex-row items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm"
                    >
                      <Feather name={meta.icon} size={16} color={meta.color} />
                      <View className="flex-1 gap-0.5">
                        <Text className="text-sm font-semibold text-lf-ink" numberOfLines={1}>
                          {quizizz.title}
                        </Text>
                        <Text className="text-xs text-lf-muted" numberOfLines={1}>
                          {resource?.title} · Quizizz · {quizizz.questionCount} questions
                        </Text>
                      </View>
                      <Feather name="external-link" size={14} color="#9ca3af" />
                    </Pressable>
                  );
                }

                const mcqs = task.content as McqQuestion[];
                const mySubmission = mcqSubmissionByTask.get(task.id);
                const completed = Boolean(mySubmission?.submitted_at);
                return (
                  <Pressable
                    key={task.id}
                    onPress={() =>
                      setTakingQuiz({
                        taskId: task.id,
                        title: `${resource?.title ?? 'Quiz'} · Quiz${task.quizNumber ?? 1}`,
                        mcqs,
                      })
                    }
                    className="flex-row items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm"
                  >
                    <Feather name={meta.icon} size={16} color={meta.color} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold text-lf-ink" numberOfLines={1}>
                        {resource?.title} · Quiz{task.quizNumber ?? 1}
                      </Text>
                      <Text className="text-xs text-lf-muted">{mcqs.length} questions</Text>
                    </View>
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: completed ? '#0596691A' : '#9C98B41A' }}
                    >
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: completed ? '#059669' : '#9C98B4' }}
                      >
                        {completed ? `${mySubmission!.score}%` : 'Take quiz'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {takingQuiz && studentId && (
          <McqTaskQuizModal
            taskId={takingQuiz.taskId}
            studentId={studentId}
            title={takingQuiz.title}
            mcqs={takingQuiz.mcqs}
            onClose={() => setTakingQuiz(null)}
          />
        )}
      </View>
    </View>
  );
}

// A slide-based lesson, read-only — the exact same card shell and SlideThumbnailTile grid the
// teacher's SlideThumbnailGroup renders (src/app/class/[classId].tsx), minus every editing
// affordance (no rename/delete/drag-reorder/pacing/live-toggle/upload). A slide with a
// gradable or submission-enabled activity gets its status as a badge directly on its own
// tile — replacing the old separate "Activities to respond to" list, which duplicated the
// same slides in a second, plainer place.
function StudentSlideLessonCard({
  resource,
  activityBySlideId,
  liveBlinkOn,
  onOpenSlide,
}: {
  resource: LessonResource;
  activityBySlideId: Map<string, WeekActivity>;
  liveBlinkOn: boolean;
  onOpenSlide: (startIndex: number) => void;
}) {
  const { data: slides, isLoading } = useLessonSlides(resource.id);

  return (
    <View className="gap-3 rounded-2xl border border-black/15 bg-white p-4 shadow-sm">
      <View className="flex-row items-center gap-2">
        <Feather name="file-text" size={14} color="#ef4444" />
        <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
          {resource.title}
        </Text>
        {resource.is_live_session && (
          <View
            style={{ opacity: liveBlinkOn ? 1 : 0.4 }}
            className="flex-row items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1"
          >
            <View className="h-2 w-2 rounded-full bg-white" />
            <Text className="text-[11px] font-semibold text-white">Live now</Text>
          </View>
        )}
      </View>

      {isLoading && <ActivityIndicator size="small" />}

      <View className="flex-row flex-wrap gap-3">
        {slides?.map((slide, i) => {
          const tag = slide.activity_tag ? SLIDE_TAGS[slide.activity_tag] : null;
          const activity = activityBySlideId.get(slide.id);
          const statusBadge = !activity
            ? null
            : activity.submitted
              ? activity.grade !== null
                ? { label: `${activity.grade}%`, color: '#7c3aed' }
                : { label: 'Submitted', color: '#10b981' }
              : { label: 'Not started', color: '#9c98b4' };
          return (
            <SlideThumbnailTile
              key={slide.id}
              slide={slide}
              index={i}
              total={slides.length}
              tag={tag}
              isTeacherPaced={slide.pacing_mode === 'teacher_paced'}
              onOpen={() => onOpenSlide(i)}
              statusBadge={statusBadge}
            />
          );
        })}
      </View>
    </View>
  );
}

// A non-slide lesson resource (video/doc/link), read-only — matches the teacher's FileCard
// shell (icon chip, title, type badge) minus rename/delete/retry.
function StudentFileLessonCard({
  resource,
  liveBlinkOn,
  onOpen,
}: {
  resource: LessonResource;
  liveBlinkOn: boolean;
  onOpen: () => void;
}) {
  const meta = FILE_TYPE_META[resource.file_type];
  const viewable = isViewable(resource);
  const converting = resource.conversion_status === 'pending';
  const failed = resource.conversion_status === 'failed';

  return (
    <Pressable
      onPress={onOpen}
      disabled={!viewable}
      style={{ opacity: viewable || converting || failed ? 1 : 0.6 }}
      className="w-56 gap-2 rounded-2xl border border-black/15 bg-white p-4 shadow-sm"
    >
      <View className="flex-row items-center gap-2.5">
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
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {resource.title}
          </Text>
          <Text className="text-xs text-ink/45">
            Week {resource.week_number} • Lesson {resource.lesson_number}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <View className={`rounded-md px-2 py-0.5 ${failed ? 'bg-red-50' : 'bg-black/5'}`}>
          <Text
            className={`text-[10px] font-semibold uppercase ${failed ? 'text-red-600' : 'text-ink/50'}`}
          >
            {failed
              ? 'Convert failed'
              : converting
                ? 'Preparing…'
                : FILE_TYPE_LABEL[resource.file_type]}
          </Text>
        </View>
        {resource.is_live_session && (
          <View
            style={{ opacity: liveBlinkOn ? 1 : 0.4 }}
            className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5"
          >
            <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <Text className="text-[10px] font-bold uppercase text-emerald-700">Live</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// A student's side of the Portfolio: the same folders the teacher created, read-only (RLS
// already enforces that — this component just never renders a rename/delete affordance), plus
// the ability to upload files into a folder and see only their own uploads there — other
// students' files never come back from the query, since RLS scopes portfolio_files reads to
// student_id = auth.uid() for a student caller.
function StudentPortfolioView({
  classId,
  studentId,
}: {
  classId: string;
  studentId: string | null;
}) {
  const foldersQuery = usePortfolioFolders(classId);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const openFolder = foldersQuery.folders.find((f) => f.id === openFolderId) ?? null;

  if (openFolder && studentId) {
    return (
      <StudentPortfolioFolder
        classId={classId}
        folder={openFolder}
        studentId={studentId}
        onBack={() => setOpenFolderId(null)}
      />
    );
  }

  return (
    <ScrollView contentContainerClassName="gap-3 p-5">
      {foldersQuery.isLoading && <ActivityIndicator />}
      {!foldersQuery.isLoading && foldersQuery.folders.length === 0 && (
        <Text className="text-sm text-lf-muted">
          Nothing here yet — your teacher hasn&apos;t created any folders.
        </Text>
      )}
      {foldersQuery.folders.map((folder) => (
        <Pressable
          key={folder.id}
          onPress={() => setOpenFolderId(folder.id)}
          className="flex-row items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm"
        >
          <Feather name="folder" size={16} color="#7c3aed" />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold text-lf-ink" numberOfLines={1}>
              {folder.name}
            </Text>
            {folder.description && (
              <Text className="text-xs text-lf-muted" numberOfLines={1}>
                {folder.description}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={16} color="#9ca3af" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function StudentPortfolioFolder({
  classId: _classId,
  folder,
  studentId,
  onBack,
}: {
  classId: string;
  folder: PortfolioFolder;
  studentId: string;
  onBack: () => void;
}) {
  const filesQuery = usePortfolioFiles(_classId, folder.id);
  const myFiles = filesQuery.files.filter((f) => f.student_id === studentId);

  const handleUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    filesQuery.uploadFile.mutate({
      studentId,
      uri: asset.uri,
      filename: asset.name,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    });
  };

  const openFile = async (fileId: string) => {
    const file = myFiles.find((f) => f.id === fileId);
    if (!file) return;
    const url = await filesQuery.getDownloadUrl(file);
    Linking.openURL(url);
  };

  return (
    <ScrollView contentContainerClassName="gap-4 p-5">
      <Pressable onPress={onBack} className="flex-row items-center gap-1.5 self-start">
        <Feather name="arrow-left" size={14} color="#6b7280" />
        <Text className="text-xs font-semibold text-lf-muted">Back to Portfolio</Text>
      </Pressable>

      <View className="gap-1">
        <Text className="text-lg font-bold text-lf-ink">{folder.name}</Text>
        {folder.description && <Text className="text-sm text-lf-muted">{folder.description}</Text>}
      </View>

      <Pressable
        onPress={handleUpload}
        disabled={filesQuery.uploadFile.isPending}
        className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-lf-line bg-white p-4"
      >
        <Feather name="upload" size={15} color="#7c3aed" />
        <Text className="text-sm font-semibold text-violet-700">
          {filesQuery.uploadFile.isPending ? 'Uploading…' : 'Upload a file'}
        </Text>
      </Pressable>

      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">My uploads</Text>
        {filesQuery.isLoading && <ActivityIndicator />}
        {!filesQuery.isLoading && myFiles.length === 0 && (
          <Text className="text-sm text-lf-muted">You haven&apos;t uploaded anything yet.</Text>
        )}
        {myFiles.map((file) => (
          <View
            key={file.id}
            className="flex-row items-center justify-between gap-2 rounded-xl bg-white p-3.5 shadow-sm"
          >
            <Pressable
              onPress={() => openFile(file.id)}
              className="flex-1 flex-row items-center gap-2.5"
            >
              <Feather name="file" size={15} color="#6b7280" />
              <Text className="flex-1 text-sm text-lf-ink" numberOfLines={1}>
                {file.file_name}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => filesQuery.deleteFile.mutate(file)}
              accessibilityLabel={`Delete ${file.file_name}`}
            >
              <Feather name="trash-2" size={14} color="#ef4444" />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
