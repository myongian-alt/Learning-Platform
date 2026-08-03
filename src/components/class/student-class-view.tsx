import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlideViewerModal } from '@/components/slides/slide-viewer';
import { useClassDetail } from '@/hooks/queries/use-class-detail';
import { useLessonResources } from '@/hooks/queries/use-lesson-resources';
import { useAuthStore } from '@/store/auth-store';
import type { LessonFileType, LessonResource } from '@/types/database';

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

// A student's read-only view of a class's Lessons — same underlying `lesson_resources`/
// `lesson_slides` data as the teacher's screen, just without upload/rename/delete/tagging,
// with slides opened via the same SlideViewerModal in "student" mode (own annotate+submit
// layer instead of the teacher's authoring layer).
export function StudentClassView({ classId }: { classId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const studentId = useAuthStore((s) => s.session?.user.id);
  const classQuery = useClassDetail(classId);
  const { resources, isLoading } = useLessonResources(classId);
  const [viewing, setViewing] = useState<{ resource: LessonResource; startIndex: number } | null>(
    null,
  );

  const weeks = useMemo(() => {
    const map = new Map<number, LessonResource[]>();
    for (const r of resources) {
      const list = map.get(r.week_number) ?? [];
      list.push(r);
      map.set(r.week_number, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [resources]);

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
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-black/5 bg-white px-5 py-4">
        <Pressable
          onPress={() => router.back()}
          className="h-8 w-8 items-center justify-center rounded-lg active:bg-black/5"
        >
          <Feather name="chevron-left" size={18} color="#4b5563" />
        </Pressable>
        <Text className="text-lg font-semibold text-ink">{classQuery.data?.name ?? 'Class'}</Text>
      </View>

      <ScrollView contentContainerClassName="gap-5 p-5">
        {isLoading && <ActivityIndicator />}
        {!isLoading && weeks.length === 0 && (
          <Text className="text-sm text-ink/50">No lessons have been posted yet.</Text>
        )}
        {weeks.map(([week, items]) => (
          <View key={week} className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink/40">
              Week {week}
            </Text>
            <View className="gap-2">
              {items.map((resource) => {
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
                      <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                        {resource.title}
                      </Text>
                      <Text className="text-xs text-ink/40">
                        {FILE_TYPE_LABEL[resource.file_type]}
                        {resource.conversion_status === 'pending' && ' · Preparing…'}
                      </Text>
                    </View>
                    {viewable && <Feather name="chevron-right" size={16} color="#9ca3af" />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
