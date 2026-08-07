import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useClassReports } from '@/hooks/queries/use-class-reports';
import { useGradebook } from '@/hooks/queries/use-gradebook';
import { downloadCsv } from '@/lib/csv-export';

import { ActivityRadarChart } from './activity-radar-chart';
import { AtRiskList } from './at-risk-list';
import { EngagementHeatmap } from './engagement-heatmap';
import { GradeDonutChart } from './grade-donut-chart';
import { StatCard } from './stat-card';
import { StudentLeaderboard } from './student-leaderboard';
import { StudentReportDetail } from './student-report-detail';
import { TrendLineChart } from './trend-line-chart';

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1 gap-4 rounded-2xl border border-black/5 bg-white p-5" style={{ minWidth: 320 }}>
      <View>
        <Text className="text-base font-bold text-ink">{title}</Text>
        <Text className="text-xs text-ink/50">{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

export function ClassReportsDashboard({ classId }: { classId: string }) {
  const reports = useClassReports(classId);
  // Reused rather than re-derived: the same labeled columns ("W1L1 Ind Activity", ...)
  // that back the Gradebook grid, so an individual student's exported report uses the exact
  // same item names a teacher already sees there — one labeling scheme, not two.
  const gradebook = useGradebook(classId);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  const handleExportStudent = (studentId: string, studentName: string) => {
    const columns = gradebook.data?.columns ?? [];
    const row = gradebook.data?.rows.find((r) => r.studentId === studentId);
    if (!row) return;
    const header = ['Item', 'Score'];
    const body = columns.map((c) => [
      c.label,
      row.scores[c.id] !== null ? `${row.scores[c.id]}%` : 'Not submitted',
    ]);
    downloadCsv(`${studentName.replace(/\s+/g, '-').toLowerCase()}-report.csv`, [header, ...body]);
  };

  if (selectedStudent) {
    return (
      <StudentReportDetail
        classId={classId}
        studentId={selectedStudent.id}
        studentName={selectedStudent.name}
        onBack={() => setSelectedStudent(null)}
      />
    );
  }

  if (reports.isLoading) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator />
      </View>
    );
  }

  const data = reports.data;
  if (!data || data.kpis.studentCount === 0) {
    return (
      <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-14">
        <Text className="text-sm text-ink/40">
          Once students join and start turning in work, their analytics will show up here.
        </Text>
      </View>
    );
  }

  const hasGradedWork = data.kpis.totalSubmissions > 0;

  return (
    <View className="gap-5">
      {/* KPI row */}
      <View className="flex-row flex-wrap gap-3">
        <StatCard
          icon="trending-up"
          label="Class average"
          value={data.kpis.classAverage !== null ? String(data.kpis.classAverage) : '—'}
          suffix={data.kpis.classAverage !== null ? '%' : undefined}
          accent="#302BB8"
        />
        <StatCard
          icon="check-square"
          label="Completion rate"
          value={String(data.kpis.completionRate)}
          suffix="%"
          accent="#2E6B57"
        />
        <StatCard
          icon="file-text"
          label="Total submissions"
          value={String(data.kpis.totalSubmissions)}
          accent="#7c3aed"
        />
        <StatCard
          icon="alert-triangle"
          label="Students at risk"
          value={String(data.kpis.atRiskCount)}
          suffix={`/ ${data.kpis.studentCount}`}
          accent={data.kpis.atRiskCount > 0 ? '#C4451F' : '#2E6B57'}
        />
      </View>

      {!hasGradedWork ? (
        <View className="items-center justify-center rounded-2xl border border-dashed border-black/10 py-14">
          <Text className="text-sm text-ink/40">
            No graded work yet — turn on grading for a slide or attach a quiz to see the full
            picture here.
          </Text>
        </View>
      ) : (
        <>
          {/* Trend + Distribution */}
          <View className="flex-row flex-wrap gap-4">
            <SectionCard title="Score trend" subtitle="Average score, rolling 8 weeks">
              <TrendLineChart data={data.trend} width={520} />
            </SectionCard>
            <SectionCard title="Grade distribution" subtitle="Students by overall average">
              <GradeDonutChart
                data={data.distribution}
                centerValue={String(data.kpis.studentCount)}
                centerLabel="students"
              />
            </SectionCard>
          </View>

          {/* Radar + Leaderboard */}
          <View className="flex-row flex-wrap gap-4">
            <SectionCard title="Strengths by activity type" subtitle="Average score per kind of work">
              {data.radar.length >= 3 ? (
                <View className="items-center">
                  <ActivityRadarChart data={data.radar} />
                </View>
              ) : (
                <Text className="py-8 text-center text-xs text-ink/40">
                  Tag a few more slide types to unlock this view.
                </Text>
              )}
            </SectionCard>
            <SectionCard title="Leaderboard" subtitle="Ranked by average score">
              <StudentLeaderboard
                data={data.leaderboard}
                onExport={handleExportStudent}
                onSelectStudent={(studentId) => {
                  const entry = data.leaderboard.find((l) => l.studentId === studentId);
                  if (entry) setSelectedStudent({ id: entry.studentId, name: entry.name });
                }}
              />
            </SectionCard>
          </View>

          {/* Heatmap + At-risk */}
          <View className="flex-row flex-wrap gap-4">
            <SectionCard title="Engagement" subtitle="Submissions per day, last 9 weeks">
              <EngagementHeatmap data={data.heatmap} />
            </SectionCard>
            <SectionCard title="Needs attention" subtitle="Flagged automatically from the data above">
              <AtRiskList
                data={data.atRisk}
                onSelectStudent={(studentId) => {
                  const entry = data.atRisk.find((s) => s.studentId === studentId);
                  if (entry) setSelectedStudent({ id: entry.studentId, name: entry.name });
                }}
              />
            </SectionCard>
          </View>
        </>
      )}
    </View>
  );
}
