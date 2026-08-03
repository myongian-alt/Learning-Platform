import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { Button } from '@/components/ui/button';
import { PressableCard } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatCard } from '@/components/ui/stat-card';
import { TextField } from '@/components/ui/text-field';
import { useLiveClassSessions } from '@/hooks/queries/use-live-class-session';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';
import { joinClassWithCode, signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';

export default function StudentHomeScreen() {
  const profile = useAuthStore((s) => s.profile);
  const studentId = useAuthStore((s) => s.session?.user.id);
  const dashboard = useStudentDashboard();
  const queryClient = useQueryClient();

  const classIds = useMemo(() => dashboard.data?.classes.map((c) => c.id) ?? [], [dashboard.data]);
  const live = useLiveClassSessions(classIds);

  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!studentId || !joinCode.trim()) return;
    setJoinError(null);
    setIsJoining(true);
    try {
      await joinClassWithCode(joinCode, studentId);
      setJoinCode('');
      queryClient.invalidateQueries({ queryKey: ['student-dashboard', studentId] });
      queryClient.invalidateQueries({ queryKey: ['student-classes', studentId] });
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Could not join that class.');
    } finally {
      setIsJoining(false);
    }
  };

  const classes = dashboard.data?.classes ?? [];
  const dueSoon = dashboard.data?.dueSoon ?? [];
  const badges = dashboard.data?.badges ?? [];

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-lf-canvas">
        <ScrollView contentContainerClassName="gap-6 px-5 py-6 md:px-9" className="flex-1">
          <View className="mx-auto w-full max-w-4xl gap-6">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-3xl font-extrabold tracking-tight text-lf-ink">
                  Hi, {profile?.full_name?.split(' ')[0]} 👋
                </Text>
                <Text className="text-base text-lf-muted">
                  Here&apos;s what&apos;s on your desk.
                </Text>
              </View>
              <Text onPress={() => signOut()} className="text-sm text-lf-muted">
                Sign out
              </Text>
            </View>

            {live && (
              <View className="flex-row flex-wrap items-center gap-4 rounded-3xl bg-lf-primary p-6">
                <View className="flex-1 gap-1" style={{ minWidth: 180 }}>
                  <Text className="text-xs font-bold tracking-wide text-lf-purpleTint4">
                    LIVE NOW
                  </Text>
                  <Text className="text-xl font-extrabold text-white">
                    {live.resourceTitle} is running
                  </Text>
                  <Text className="text-sm text-lf-purpleTint4">
                    Slide {live.slideIndex + 1} of {live.totalSlides}
                    {live.submissionsEnabled ? ' · Submissions open' : ''}
                  </Text>
                </View>
                <Link href={`/class/${live.classId}` as Href} asChild>
                  <Pressable className="rounded-full bg-white px-5 py-3">
                    <Text className="text-sm font-extrabold text-lf-primaryDeep">Join live →</Text>
                  </Pressable>
                </Link>
              </View>
            )}

            <View className="gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <Text className="text-base font-semibold text-lf-ink">Join a class</Text>
              <View className="flex-row items-end gap-3">
                <View className="flex-1">
                  <TextField
                    label="Class code"
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder="e.g. 7F3K2A"
                    autoCapitalize="characters"
                  />
                </View>
                <Button
                  label="Join"
                  onPress={handleJoin}
                  isLoading={isJoining}
                  variant="secondary"
                />
              </View>
              {joinError && <Text className="text-sm text-red-600">{joinError}</Text>}
            </View>

            <View className="flex-row flex-wrap gap-3">
              <StatCard
                label="Classes"
                value={classes.length}
                accentColor="#7C3AED"
                icon={<Feather name="grid" size={16} color="#7C3AED" />}
              />
              <StatCard
                label="Due this week"
                value={dueSoon.length}
                accentColor="#EF4444"
                icon={<Feather name="clock" size={16} color="#EF4444" />}
              />
              <StatCard
                label="Average score"
                value={
                  dashboard.data?.averageScore !== null &&
                  dashboard.data?.averageScore !== undefined
                    ? `${dashboard.data.averageScore}%`
                    : '—'
                }
                accentColor="#10B981"
                icon={<Feather name="trending-up" size={16} color="#10B981" />}
              />
              <StatCard
                label="Day streak"
                value={dashboard.data?.streak ?? 0}
                accentColor="#F59E0B"
                icon={<Feather name="award" size={16} color="#F59E0B" />}
              />
            </View>

            <View className="flex-row flex-wrap gap-5">
              <View className="flex-1 gap-3" style={{ minWidth: 300 }}>
                <Text className="text-lg font-extrabold tracking-tight text-lf-ink">Due soon</Text>
                {dashboard.isLoading && <ActivityIndicator />}
                {!dashboard.isLoading && dueSoon.length === 0 && (
                  <Text className="text-sm text-lf-muted">Nothing due right now — nice work.</Text>
                )}
                {dueSoon.map((item) => (
                  <Link key={item.slideId} href={`/class/${item.classId}` as Href} asChild>
                    <Pressable
                      className="flex-row items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
                      style={{ borderLeftWidth: 4, borderLeftColor: '#EF4444' }}
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                        <Feather name="alert-circle" size={16} color="#EF4444" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[15px] font-bold text-lf-ink" numberOfLines={1}>
                          {item.resourceTitle}
                        </Text>
                        <Text className="text-xs text-lf-muted">{item.className}</Text>
                      </View>
                    </Pressable>
                  </Link>
                ))}
              </View>

              <View className="flex-1 gap-3" style={{ minWidth: 300 }}>
                <Text className="text-lg font-extrabold tracking-tight text-lf-ink">
                  My classes
                </Text>
                <View className="flex-row flex-wrap gap-3">
                  {classes.length === 0 && (
                    <Text className="text-sm text-lf-muted">
                      Join a class above to see it here.
                    </Text>
                  )}
                  {classes.map((classRow) => (
                    <Link key={classRow.id} href={`/class/${classRow.id}` as Href} asChild>
                      <PressableCard
                        accentColor="#EC4899"
                        className="flex-1 gap-3"
                        style={{ minWidth: 220 }}
                      >
                        <Text className="text-base font-extrabold text-lf-ink">
                          {classRow.name}
                        </Text>
                        <ProgressBar percent={classRow.percentComplete} color="#EC4899" />
                        <Text className="text-xs font-bold text-lf-muted2">
                          {classRow.percentComplete}% complete
                        </Text>
                      </PressableCard>
                    </Link>
                  ))}
                </View>

                {badges.length > 0 && (
                  <View className="gap-2 rounded-2xl bg-white p-4 shadow-sm">
                    <Text className="text-sm font-extrabold text-lf-ink">Badges</Text>
                    <View className="flex-row flex-wrap gap-2.5">
                      {badges.map((badge) => (
                        <View
                          key={badge.key}
                          className="items-center gap-1.5 rounded-2xl px-3.5 py-3"
                          style={{ backgroundColor: badge.earned ? '#F59E0B1A' : '#F7F5FB' }}
                        >
                          <Feather
                            name="award"
                            size={18}
                            color={badge.earned ? '#F59E0B' : '#B4B0C4'}
                          />
                          <Text
                            className="text-center text-[11px] font-bold"
                            style={{ color: badge.earned ? '#B45309' : '#B4B0C4' }}
                          >
                            {badge.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </StudentShell>
  );
}
