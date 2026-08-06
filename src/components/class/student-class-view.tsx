import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { McqTaskQuizModal } from '@/components/class/mcq-task-quiz';
import { WeekFolderCard } from '@/components/lessons/week-folder';
import { SLIDE_TAGS, SlideViewerModal } from '@/components/slides/slide-viewer';
import { useClassDetail } from '@/hooks/queries/use-class-detail';
import { useClassWeekProgress } from '@/hooks/queries/use-class-week-progress';
import type {
  KhanAcademyResource,
  McqQuestion,
  QuizizzResource,
} from '@/hooks/queries/use-lesson-ai-resources';
import { useLessonResources } from '@/hooks/queries/use-lesson-resources';
import { useMcqTaskSubmissions } from '@/hooks/queries/use-mcq-task-submission';
import { usePortfolioFiles } from '@/hooks/queries/use-portfolio-files';
import { usePortfolioFolders } from '@/hooks/queries/use-portfolio-folders';
import { useWeekActivities, type WeekActivity } from '@/hooks/queries/use-week-activities';
import { useWeekAttachedTasks, type WeekAttachedTask } from '@/hooks/queries/use-week-attached-tasks';
import { useAuthStore } from '@/store/auth-store';
import type { LessonFileType, LessonResource, PortfolioFolder } from '@/types/database';

const AI_TASK_META: Record<
  WeekAttachedTask['kind'],
  { label: string; color: string; bg: string; icon: keyof typeof Feather.glyphMap }
> = {
  khan_academy_video: { label: 'Khan Academy', color: '#059669', bg: '#ECFDF5', icon: 'play-circle' },
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

// A student's read-only week-folder view of a class's Lessons — mirrors the teacher's
// grid (src/app/class/[classId].tsx) via the shared WeekFolderCard, but each folder's
// lock state and progress bar come from this student's own activity, and opening a week
// splits into "Lesson resources" (viewable files/slides) vs. "Activities to respond to"
// (submission-enabled slides, with a status pill). Slides open via the same
// SlideViewerModal in "student" mode (own annotate+submit layer instead of the
// teacher's authoring layer).
export function StudentClassView({ classId }: { classId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const studentId = useAuthStore((s) => s.session?.user.id);
  const classQuery = useClassDetail(classId);
  const { resources, isLoading } = useLessonResources(classId);
  const weekProgress = useClassWeekProgress(classId, studentId ?? null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [view, setView] = useState<'lessons' | 'portfolio'>('lessons');
  const [viewing, setViewing] = useState<{ resource: LessonResource; startIndex: number } | null>(
    null,
  );

  const weekResources = useMemo(
    () => (selectedWeek === null ? [] : resources.filter((r) => r.week_number === selectedWeek)),
    [resources, selectedWeek],
  );
  const weekResourceIds = useMemo(() => weekResources.map((r) => r.id), [weekResources]);
  const activities = useWeekActivities(weekResourceIds, studentId ?? null);
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

  const openActivity = (activity: WeekActivity) => {
    const resource = resourceById.get(activity.resourceId);
    if (!resource) return;
    setViewing({ resource, startIndex: activity.slideIndex });
  };

  return (
    <View className="flex-1 bg-lf-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-lf-line bg-white px-5 py-4">
        <Pressable
          onPress={() => {
            if (selectedWeek !== null) return setSelectedWeek(null);
            if (view === 'portfolio') return setView('lessons');
            router.back();
          }}
          className="h-8 w-8 items-center justify-center rounded-lg active:bg-black/5"
        >
          <Feather name="chevron-left" size={18} color="#4b5563" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-lf-ink">
            {selectedWeek !== null
              ? `Week ${selectedWeek}`
              : view === 'portfolio'
                ? 'Portfolio'
                : (classQuery.data?.name ?? 'Class')}
          </Text>
          {(selectedWeek !== null || view === 'portfolio') && (
            <Text className="text-xs text-lf-muted">{classQuery.data?.name}</Text>
          )}
        </View>
        {selectedWeek === null && (
          <View className="flex-row rounded-lg bg-lf-canvas p-0.5">
            {(['lessons', 'portfolio'] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => setView(key)}
                className={`rounded-md px-3 py-1.5 ${view === key ? 'bg-white shadow-sm' : ''}`}
              >
                <Text
                  className={`text-xs font-semibold ${view === key ? 'text-lf-ink' : 'text-lf-muted'}`}
                >
                  {key === 'lessons' ? 'Lessons' : 'Portfolio'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {view === 'portfolio' ? (
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
        <ScrollView contentContainerClassName="gap-6 p-5">
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">
              Lesson resources
            </Text>
            {weekResources.length === 0 && (
              <Text className="text-sm text-lf-muted">Nothing posted yet.</Text>
            )}
            {weekResources.map((resource) => {
              const viewable = isViewable(resource);
              return (
                <Pressable
                  key={resource.id}
                  onPress={() => viewable && setViewing({ resource, startIndex: 0 })}
                  disabled={!viewable}
                  style={{ opacity: viewable ? 1 : 0.5 }}
                  className="flex-row items-center justify-between rounded-xl bg-white p-3.5 shadow-sm"
                >
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Text className="flex-1 text-sm font-semibold text-lf-ink" numberOfLines={1}>
                        {resource.title}
                      </Text>
                      {resource.is_live_session && (
                        <View className="rounded-full bg-emerald-50 px-2 py-0.5">
                          <Text className="text-[10px] font-bold uppercase text-emerald-700">Live</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-lf-muted">
                      {FILE_TYPE_LABEL[resource.file_type]}
                      {resource.is_live_session && ' · Live session'}
                      {resource.conversion_status === 'pending' && ' · Preparing…'}
                    </Text>
                  </View>
                  {viewable && <Feather name="chevron-right" size={16} color="#9ca3af" />}
                </Pressable>
              );
            })}
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">
              Activities to respond to
            </Text>
            {activities.isLoading && <ActivityIndicator />}
            {!activities.isLoading && (activities.data?.length ?? 0) === 0 && (
              <Text className="text-sm text-lf-muted">No activities posted for this week.</Text>
            )}
            {activities.data?.map((activity) => {
              const resource = resourceById.get(activity.resourceId);
              const tag = activity.activityTag ? SLIDE_TAGS[activity.activityTag] : null;
              const statusLabel = activity.submitted
                ? activity.grade !== null
                  ? `Graded ${activity.grade}/100`
                  : 'Submitted'
                : 'Not started';
              const statusColor = activity.submitted
                ? activity.grade !== null
                  ? '#7C3AED'
                  : '#10B981'
                : '#9C98B4';
              return (
                <Pressable
                  key={activity.slideId}
                  onPress={() => openActivity(activity)}
                  className="flex-row items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm"
                >
                  {tag && (
                    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  )}
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold text-lf-ink" numberOfLines={1}>
                      {resource?.title ?? 'Activity'}
                    </Text>
                    <Text className="text-xs text-lf-muted">{tag?.label ?? 'Activity'}</Text>
                  </View>
                  <View
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${statusColor}1A` }}
                  >
                    <Text className="text-[11px] font-bold" style={{ color: statusColor }}>
                      {statusLabel}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

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
        <Text className="text-xs font-bold uppercase tracking-wide text-lf-muted3">
          My uploads
        </Text>
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
