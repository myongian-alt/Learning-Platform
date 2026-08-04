import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeekFolderCard } from '@/components/lessons/week-folder';
import { SLIDE_TAGS, SlideViewerModal } from '@/components/slides/slide-viewer';
import { useClassDetail } from '@/hooks/queries/use-class-detail';
import { useClassWeekProgress } from '@/hooks/queries/use-class-week-progress';
import { useLessonResources } from '@/hooks/queries/use-lesson-resources';
import { useWeekActivities, type WeekActivity } from '@/hooks/queries/use-week-activities';
import { useAuthStore } from '@/store/auth-store';
import type { LessonFileType, LessonResource } from '@/types/database';

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
          onPress={() => (selectedWeek !== null ? setSelectedWeek(null) : router.back())}
          className="h-8 w-8 items-center justify-center rounded-lg active:bg-black/5"
        >
          <Feather name="chevron-left" size={18} color="#4b5563" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-lf-ink">
            {selectedWeek !== null ? `Week ${selectedWeek}` : (classQuery.data?.name ?? 'Class')}
          </Text>
          {selectedWeek !== null && (
            <Text className="text-xs text-lf-muted">{classQuery.data?.name}</Text>
          )}
        </View>
      </View>

      {selectedWeek === null ? (
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
        </ScrollView>
      )}
    </View>
  );
}
