import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentShell } from '@/components/layout/student-shell';
import { useLiveClassSessions } from '@/hooks/queries/use-live-class-session';
import { useBlink } from '@/hooks/use-blink';
import { useStudentDashboard } from '@/hooks/queries/use-student-dashboard';
import { joinClassWithCode, signOut } from '@/lib/auth-actions';
import { useAuthStore } from '@/store/auth-store';

const CLASS_RULE_COLORS = ['#302BB8', '#4B45E0', '#8C8BF0', '#4B7BF5', '#2E6B57'];

function todayLine() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });
}

export default function StudentHomeScreen() {
  const profile = useAuthStore((s) => s.profile);
  const studentId = useAuthStore((s) => s.session?.user.id);
  const dashboard = useStudentDashboard();
  const queryClient = useQueryClient();

  const classIds = useMemo(() => dashboard.data?.classes.map((c) => c.id) ?? [], [dashboard.data]);
  const live = useLiveClassSessions(classIds);
  const liveBlinkOn = useBlink(Boolean(live));

  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const allClasses = useMemo(() => dashboard.data?.classes ?? [], [dashboard.data]);
  const classes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allClasses;
    return allClasses.filter((c) => c.name.toLowerCase().includes(q));
  }, [allClasses, searchQuery]);
  const dueSoon = dashboard.data?.dueSoon ?? [];
  const badges = dashboard.data?.badges ?? [];
  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  return (
    <StudentShell>
      <SafeAreaView className="flex-1 bg-desk-canvas">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          {/* Top bar */}
          <View className="flex-row flex-wrap items-center justify-between gap-4 border-b border-desk-hairline px-[34px] py-3.5">
            <View className="max-w-[320px] flex-1 flex-row items-center gap-2" style={{ minWidth: 220 }}>
              <Feather name="search" size={15} color="#9C968B" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search your classes…"
                placeholderTextColor="#9C968B"
                className="flex-1 font-desk-sans text-[13.5px] text-desk-body"
              />
            </View>
            <View className="flex-row items-center gap-3.5">
              <Text className="font-desk-sans-semibold text-xs uppercase tracking-[0.1em] text-desk-muted3">
                {todayLine()}
              </Text>
              <View className="h-[33px] w-[33px] items-center justify-center rounded-lg border border-desk-hairline">
                <Feather name="bell" size={15} color="#1A1917" />
                {dueSoon.length > 0 && (
                  <View
                    className="absolute h-1.5 w-1.5 rounded-full bg-desk-alert"
                    style={{ top: 6, right: 7 }}
                  />
                )}
              </View>
              {/* Always-visible sign-out: the sidebar's profile row (also wired to
                  sign-out) only renders on wide screens, so this stays as the one
                  reachable affordance on narrow/tab-bar layouts. */}
              <Text onPress={() => signOut()} className="font-desk-sans text-[13px] text-desk-muted3">
                Sign out
              </Text>
            </View>
          </View>

          <View className="w-full max-w-[1180px] px-[34px] pt-[26px]" style={{ alignSelf: 'center' }}>
            {/* Greeting + stats */}
            <View className="flex-row flex-wrap items-end justify-between gap-x-8 gap-y-4.5">
              <View className="flex-1" style={{ minWidth: 300 }}>
                <Text className="font-poppins-semibold text-[34px] leading-[1.1] tracking-tighter text-desk-body">
                  Hi, {firstName}.
                </Text>
                <Text className="mt-1.5 max-w-[52ch] font-desk-sans text-[14.5px] leading-[1.5] text-desk-body2">
                  {allClasses.length === 0
                    ? 'Join a class below to see it on your desk.'
                    : dueSoon.length > 0
                      ? `${allClasses.length} ${allClasses.length === 1 ? 'class' : 'classes'} on your desk, ${dueSoon.length} ${dueSoon.length === 1 ? 'task' : 'tasks'} still open.`
                      : `${allClasses.length} ${allClasses.length === 1 ? 'class' : 'classes'} on your desk — you're all caught up.`}
                </Text>
              </View>
              <View className="flex-row gap-2.5">
                <View className="min-w-[92px] rounded border border-desk-indigoTintBorder bg-desk-indigoTint px-4 py-2.5">
                  <Text className="font-poppins-semibold text-[26px] leading-none text-desk-indigo">
                    {allClasses.length}
                  </Text>
                  <Text className="mt-1 text-[11.5px] text-desk-indigo">classes</Text>
                </View>
                <View className="min-w-[92px] rounded border border-desk-indigoTintBorder bg-desk-indigoTint px-4 py-2.5">
                  <Text className="font-poppins-semibold text-[26px] leading-none text-desk-indigo">
                    {dueSoon.length}
                  </Text>
                  <Text className="mt-1 text-[11.5px] text-desk-indigo">open tasks</Text>
                </View>
                <View className="min-w-[92px] rounded border border-desk-indigoTintBorder bg-desk-indigoTint px-4 py-2.5">
                  <Text className="font-poppins-semibold text-[26px] leading-none text-desk-indigo">
                    {dashboard.data?.averageScore != null ? dashboard.data.averageScore : '—'}
                    {dashboard.data?.averageScore != null && <Text className="text-base">%</Text>}
                  </Text>
                  <Text className="mt-1 text-[11.5px] text-desk-indigo">term average</Text>
                </View>
              </View>
            </View>

            {/* Join a class */}
            <View className="mt-[22px] flex-row flex-wrap items-center gap-6 rounded bg-desk-indigo px-7 py-[26px]">
              <View className="flex-1" style={{ minWidth: 300 }}>
                <Text className="font-desk-sans-bold text-[11px] uppercase tracking-[0.16em] text-desk-indigoOnDark">
                  Start here
                </Text>
                <Text className="mt-2 font-poppins-semibold text-[30px] tracking-tighter text-white">
                  Join a class
                </Text>
                <Text className="mt-2 max-w-[40ch] font-desk-sans text-sm leading-[1.5] text-desk-indigoOnDark2">
                  Enter the six-character code your teacher gave you. It lands on your desk right
                  away.
                </Text>
              </View>
              <View className="max-w-[420px] flex-1" style={{ minWidth: 260 }}>
                <View className="flex-row gap-2">
                  <TextInput
                    value={joinCode}
                    onChangeText={(t) => setJoinCode(t.toUpperCase())}
                    placeholder="7F3K2A"
                    placeholderTextColor="#A7A299"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    className="flex-1 rounded font-poppins-semibold text-[19px] tracking-[0.22em] text-desk-body"
                    style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 15 }}
                  />
                  <Pressable
                    onPress={handleJoin}
                    disabled={isJoining || !joinCode.trim()}
                    className="items-center justify-center rounded bg-desk-amber px-[26px] py-[15px]"
                    style={{ opacity: isJoining || !joinCode.trim() ? 0.6 : 1 }}
                  >
                    {isJoining ? (
                      <ActivityIndicator color="#1A1200" />
                    ) : (
                      <Text className="font-poppins-semibold text-[15px] text-desk-amberText">
                        Join
                      </Text>
                    )}
                  </Pressable>
                </View>
                {joinError && (
                  <Text className="mt-2 font-desk-sans text-[13px] text-red-200">{joinError}</Text>
                )}
              </View>
            </View>

            {/* Live now (real — replaces the design's static "in progress" strip, which has
                no backing data; this one does) */}
            {live && (
              <Link href={`/class/${live.classId}` as Href} asChild>
                <Pressable
                  className="mt-2.5 flex-row flex-wrap items-center gap-3.5 rounded border-l-[3px] border-desk-indigo bg-desk-surface px-4 py-2.5"
                  style={{
                    borderWidth: 1,
                    borderColor: '#DDD6C8',
                    borderLeftWidth: 3,
                    borderLeftColor: '#302BB8',
                    opacity: liveBlinkOn ? 1 : 0.55,
                  }}
                >
                  <View className="h-2 w-2 rounded-full bg-desk-indigo" />
                  <Text className="font-desk-sans-bold text-[11px] uppercase tracking-[0.14em] text-desk-indigo">
                    Live now
                  </Text>
                  <Text className="flex-1 font-desk-sans-semibold text-[13.5px] text-desk-body" numberOfLines={1} style={{ minWidth: 160 }}>
                    {live.resourceTitle}
                  </Text>
                  <Text className="text-[12.5px] text-desk-muted3">
                    Slide {live.slideIndex + 1} of {live.totalSlides}
                    {live.submissionsEnabled ? ' · Submissions open' : ''}
                  </Text>
                  <Text className="font-desk-sans-semibold text-[13px] text-desk-indigo">Join live lesson →</Text>
                </Pressable>
              </Link>
            )}

            {/* My classes */}
            <View className="mt-[30px]">
              <View className="flex-row items-baseline justify-between gap-4">
                <Text className="font-poppins-semibold text-[19px] tracking-tighter text-desk-body">
                  My classes
                </Text>
              </View>

              {dashboard.isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}
              {!dashboard.isLoading && classes.length === 0 && (
                <Text className="mt-3 font-desk-sans text-sm text-desk-muted3">
                  {allClasses.length === 0
                    ? 'Join a class above to see it here.'
                    : `No classes match "${searchQuery.trim()}".`}
                </Text>
              )}
              {classes.map((c, i) => (
                <Link key={c.id} href={`/class/${c.id}` as Href} asChild>
                  <Pressable
                    className="flex-row flex-wrap items-center gap-4.5 px-0.5 py-[15px]"
                    style={{
                      borderTopWidth: 1.5,
                      borderTopColor: '#302BB8',
                      borderBottomWidth: i === classes.length - 1 ? 1.5 : 0,
                      borderBottomColor: '#302BB8',
                    }}
                  >
                    <Text className="w-[30px] font-poppins-semibold text-[18px] text-desk-indigo">
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                    <View className="flex-1" style={{ minWidth: 210 }}>
                      <Text className="font-poppins-medium text-base tracking-tighter text-desk-body">
                        {c.name}
                      </Text>
                      <Text className="mt-0.5 font-desk-sans text-[13px] text-desk-muted3">
                        {c.totalSlides === 0
                          ? 'No graded activities yet'
                          : c.completedSlides === c.totalSlides
                            ? 'All caught up'
                            : `${c.totalSlides - c.completedSlides} activities open`}
                      </Text>
                    </View>
                    <View className="max-w-[160px] flex-1 flex-row items-center gap-2.5" style={{ minWidth: 100 }}>
                      <View className="h-1 flex-1 bg-desk-hairline">
                        <View
                          className="h-full"
                          style={{
                            width: `${c.percentComplete}%`,
                            backgroundColor: CLASS_RULE_COLORS[i % CLASS_RULE_COLORS.length],
                          }}
                        />
                      </View>
                      <Text className="font-desk-sans-semibold text-[12.5px] text-desk-body2">
                        {c.percentComplete}%
                      </Text>
                    </View>
                    <Text className="w-[92px] text-right font-desk-sans text-[12.5px] text-desk-muted3">
                      {c.completedSlides} / {c.totalSlides} lessons
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </View>

            {/* Due soon + Badges */}
            <View className="mt-7 flex-row flex-wrap items-start gap-x-7 gap-y-6">
              <View className="flex-1" style={{ minWidth: 460 }}>
                <Text className="font-poppins-semibold text-[19px] tracking-tighter text-desk-body">
                  Due soon
                </Text>
                <View className="mt-3 rounded border border-desk-indigoTintBorder bg-desk-indigoTint px-2.5 py-1">
                  {dueSoon.length === 0 && (
                    <Text className="px-0.5 py-4 font-desk-sans text-[13.5px] text-desk-muted3">
                      Nothing due right now — nice work.
                    </Text>
                  )}
                  {dueSoon.map((item, i) => (
                    <Link key={item.slideId} href={`/class/${item.classId}` as Href} asChild>
                      <Pressable
                        className="flex-row items-center gap-2.5 px-0.5 py-2.5"
                        style={{
                          borderBottomWidth: i === dueSoon.length - 1 ? 0 : 1,
                          borderBottomColor: '#D3D0F0',
                        }}
                      >
                        <View
                          className="h-[15px] w-[15px] items-center justify-center rounded-sm"
                          style={{ borderWidth: 1.5, borderColor: '#A9A6DC' }}
                        />
                        <Text className="flex-1 font-desk-sans-medium text-[12.5px] text-desk-body" numberOfLines={1}>
                          {item.resourceTitle}
                        </Text>
                        <Text className="font-desk-sans-semibold text-[11px] text-desk-indigoOnDark2" style={{ color: '#5B57A8' }} numberOfLines={1}>
                          {item.className}
                        </Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </View>

              {badges.length > 0 && (
                <View className="flex-1 max-w-[320px]" style={{ minWidth: 240 }}>
                  <Text className="font-poppins-semibold text-[15px] tracking-tighter text-desk-body">
                    Badges
                  </Text>
                  <View className="mt-2.5 flex-row flex-wrap gap-2.5">
                    {badges.map((badge) => (
                      <View
                        key={badge.key}
                        className="items-center gap-1.5 rounded-xl px-3.5 py-3"
                        style={{ backgroundColor: badge.earned ? '#F7EAD9' : '#EDE8DF' }}
                      >
                        <Feather
                          name="award"
                          size={18}
                          color={badge.earned ? '#C56A2B' : '#8F897D'}
                        />
                        <Text
                          className="max-w-[76px] text-center font-desk-sans-semibold text-[11px]"
                          style={{ color: badge.earned ? '#7A4415' : '#8F897D' }}
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
        </ScrollView>
      </SafeAreaView>
    </StudentShell>
  );
}
