import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { useStudentReport } from '@/hooks/queries/use-class-reports';

import { ActivityRadarChart } from './activity-radar-chart';
import { EngagementHeatmap } from './engagement-heatmap';
import { TrendLineChart } from './trend-line-chart';

// One student's individual analytics, inline on the same Reports page a teacher was already
// looking at (not a separate route) — reuses the exact same generic chart components as the
// class-wide view (TrendLineChart/ActivityRadarChart/EngagementHeatmap), just fed this one
// student's own data via useStudentReport, plus their full graded-item history which the
// class-wide aggregate has no reason to carry.
export function StudentReportDetail({
  classId,
  studentId,
  studentName,
  onBack,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  onBack: () => void;
}) {
  const report = useStudentReport(classId, studentId);

  return (
    <View className="gap-5">
      <Pressable onPress={onBack} className="flex-row items-center gap-1.5 self-start">
        <Feather name="arrow-left" size={14} color="#6b7280" />
        <Text className="text-xs font-semibold text-ink/60">Back to class view</Text>
      </Pressable>

      <View>
        <Text className="text-xl font-bold text-ink">{studentName}</Text>
        <Text className="text-sm text-ink/50">Individual analytics</Text>
      </View>

      {report.isLoading && (
        <View className="items-center py-16">
          <ActivityIndicator />
        </View>
      )}

      {!report.isLoading && report.data && (
        <>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[160px] flex-1 gap-1 rounded-2xl border border-black/5 bg-white p-4">
              <Text className="text-xs text-ink/50">Average score</Text>
              <Text className="text-2xl font-bold text-ink">
                {report.data.avgScore !== null ? `${report.data.avgScore}%` : '—'}
              </Text>
            </View>
            <View className="min-w-[160px] flex-1 gap-1 rounded-2xl border border-black/5 bg-white p-4">
              <Text className="text-xs text-ink/50">Items completed</Text>
              <Text className="text-2xl font-bold text-ink">{report.data.completed}</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-4">
            <View className="flex-1 gap-4 rounded-2xl border border-black/5 bg-white p-5" style={{ minWidth: 320 }}>
              <Text className="text-base font-bold text-ink">Score trend</Text>
              <TrendLineChart data={report.data.trend} width={480} />
            </View>
            <View className="flex-1 gap-4 rounded-2xl border border-black/5 bg-white p-5" style={{ minWidth: 320 }}>
              <Text className="text-base font-bold text-ink">Strengths by activity type</Text>
              {report.data.radar.length >= 3 ? (
                <View className="items-center">
                  <ActivityRadarChart data={report.data.radar} color="#7c3aed" />
                </View>
              ) : (
                <Text className="py-8 text-center text-xs text-ink/40">
                  Not enough tagged activity yet to show this.
                </Text>
              )}
            </View>
          </View>

          <View className="gap-4 rounded-2xl border border-black/5 bg-white p-5">
            <Text className="text-base font-bold text-ink">Engagement</Text>
            <EngagementHeatmap data={report.data.heatmap} />
          </View>

          <View className="gap-2 rounded-2xl border border-black/5 bg-white p-5">
            <Text className="text-base font-bold text-ink">Graded item history</Text>
            {report.data.history.length === 0 ? (
              <Text className="text-xs text-ink/40">Nothing graded yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} className="gap-1.5">
                {report.data.history.map((item, i) => (
                  <View
                    key={`${item.label}-${i}`}
                    className="flex-row items-center justify-between gap-2 border-b border-black/5 py-2"
                  >
                    <Text className="flex-1 text-xs text-ink" numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text className="text-[10px] text-ink/40">
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </Text>
                    <Text className="w-12 text-right text-xs font-bold text-ink">{item.percent}%</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </>
      )}
    </View>
  );
}
