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

// Same accent set as the teacher's own class cards (src/app/classes.tsx's CARD_ACCENTS) so a
// class's color-coding is consistent whichever role is looking at it.
const CLASS_ACCENTS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

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
      <SafeAreaView className="flex-1 bg-paper">
        <ScrollView className="flex-1" contentContainerClassName="pb-11">
          {/* Top bar */}
          <View className="flex-row flex-wrap items-center justify-between gap-4 border-b border-black/5 bg-white px-[34px] py-3.5">
            <View className="max-w-[320px] flex-1 flex-row items-center gap-2" style={{ minWidth: 220 }}>
              <Feather name="search" size={15} color="#9ca3af" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search your classes…"
                placeholderTextColor="#9ca3af"
                className="flex-1 text-[13.5px] text-ink"
              />
            </View>
            <View className="flex-row items-center gap-3.5">
              <Text className="text-xs font-semibold uppercase tracking-[0.1em] text-ink/40">
                {todayLine()}
              </Text>
              <View className="h-[33px] w-[33px] items-center justify-center rounded-lg border border-black/15">
                <Feather name="bell" size={15} color="#1a1a2e" />
                {dueSoon.length > 0 && (
                  <View
                    className="absolute h-1.5 w-1.5 rounded-full bg-red-500"
                    style={{ top: 6, right: 7 }}
                  />
                )}
              </View>
              {/* Always-visible sign-out: the sidebar's profile row (also wired to
                  sign-out) only renders on wide screens, so this stays as the one
                  reachable affordance on narrow/tab-bar layouts. */}
              <Text onPress={() => signOut()} className="text-[13px] text-ink/50">
                Sign out
              </Text>
            </View>
          </View>

          <View className="w-full max-w-[1180px] px-[34px] pt-[26px]" style={{ alignSelf: 'center' }}>
            {/* Greeting + stats */}
            <View className="flex-row flex-wrap items-end justify-between gap-x-8 gap-y-4.5">
              <View className="flex-1" style={{ minWidth: 300 }}>
                <Text className="text-[34px] font-bold leading-[1.1] tracking-tighter text-ink">
                  Hi, {firstName}.
                </Text>
                <Text className="mt-1.5 max-w-[52ch] text-[14.5px] leading-[1.5] text-ink/60">
                  {allClasses.length === 0
                    ? 'Join a class below to get started.'
                    : dueSoon.length > 0
                      ? `${allClasses.length} ${allClasses.length === 1 ? 'class' : 'classes'}, ${dueSoon.length} ${dueSoon.length === 1 ? 'task' : 'tasks'} still open.`
                      : `${allClasses.length} ${allClasses.length === 1 ? 'class' : 'classes'} — you're all caught up.`}
                </Text>
              </View>
              <View className="flex-row gap-2.5">
                <View className="min-w-[92px] rounded-2xl border border-black/15 bg-white px-4 py-2.5 shadow-sm">
                  <Text className="text-[26px] font-bold leading-none text-violet-700">
                    {allClasses.length}
                  </Text>
                  <Text className="mt-1 text-[11.5px] text-ink/50">classes</Text>
                </View>
                <View className="min-w-[92px] rounded-2xl border border-black/15 bg-white px-4 py-2.5 shadow-sm">
                  <Text className="text-[26px] font-bold leading-none text-violet-700">
                    {dueSoon.length}
                  </Text>
                  <Text className="mt-1 text-[11.5px] text-ink/50">open tasks</Text>
                </View>
                <View className="min-w-[92px] rounded-2xl border border-black/15 bg-white px-4 py-2.5 shadow-sm">
                  <Text className="text-[26px] font-bold leading-none text-violet-700">
                    {dashboard.data?.averageScore != null ? dashboard.data.averageScore : '—'}
                    {dashboard.data?.averageScore != null && <Text className="text-base">%</Text>}
                  </Text>
                  <Text className="mt-1 text-[11.5px] text-ink/50">term average</Text>
                </View>
              </View>
            </View>

            {/* Join a class */}
            <View className="mt-[22px] flex-row flex-wrap items-center gap-6 rounded-2xl bg-violet-600 px-7 py-[26px] shadow-sm">
              <View className="flex-1" style={{ minWidth: 300 }}>
                <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                  Start here
                </Text>
                <Text className="mt-2 text-[30px] font-bold tracking-tighter text-white">
                  Join a class
                </Text>
                <Text className="mt-2 max-w-[40ch] text-sm leading-[1.5] text-white/80">
                  Enter the six-character code your teacher gave you to join right away.
                </Text>
              </View>
              <View className="max-w-[420px] flex-1" style={{ minWidth: 260 }}>
                <View className="flex-row gap-2">
                  <TextInput
                    value={joinCode}
                    onChangeText={(t) => setJoinCode(t.toUpperCase())}
                    placeholder="7F3K2A"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    className="flex-1 rounded-xl text-[19px] font-bold tracking-[0.22em] text-ink"
                    style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 15 }}
                  />
                  <Pressable
                    onPress={handleJoin}
                    disabled={isJoining || !joinCode.trim()}
                    className="items-center justify-center rounded-xl bg-white px-[26px] py-[15px]"
                    style={{ opacity: isJoining || !joinCode.trim() ? 0.6 : 1 }}
                  >
                    {isJoining ? (
                      <ActivityIndicator color="#7c3aed" />
                    ) : (
                      <Text className="text-[15px] font-bold text-violet-700">Join</Text>
                    )}
                  </Pressable>
                </View>
                {joinError && (
                  <Text className="mt-2 text-[13px] text-red-200">{joinError}</Text>
                )}
              </View>
            </View>

            {/* Live now (real — replaces the design's static "in progress" strip, which has
                no backing data; this one does) */}
            {live && (
              <Link href={`/class/${live.classId}` as Href} asChild>
                <Pressable
                  className="mt-2.5 flex-row flex-wrap items-center gap-3.5 rounded-2xl bg-white px-4 py-2.5 shadow-sm"
                  style={{
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.15)',
                    borderLeftWidth: 3,
                    borderLeftColor: '#7c3aed',
                    opacity: liveBlinkOn ? 1 : 0.55,
                  }}
                >
                  <View className="h-2 w-2 rounded-full bg-violet-600" />
                  <Text className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">
                    Live now
                  </Text>
                  <Text className="flex-1 text-[13.5px] font-semibold text-ink" numberOfLines={1} style={{ minWidth: 160 }}>
                    {live.resourceTitle}
                  </Text>
                  <Text className="text-[12.5px] text-ink/50">
                    Slide {live.slideIndex + 1} of {live.totalSlides}
                    {live.submissionsEnabled ? ' · Submissions open' : ''}
                  </Text>
                  <Text className="text-[13px] font-semibold text-violet-700">Join live lesson →</Text>
                </Pressable>
              </Link>
            )}

            {/* My classes */}
            <View className="mt-[30px]">
              <View className="flex-row items-baseline justify-between gap-4">
                <Text className="text-[19px] font-bold tracking-tighter text-ink">My classes</Text>
              </View>

              {dashboard.isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}
              {!dashboard.isLoading && classes.length === 0 && (
                <Text className="mt-3 text-sm text-ink/50">
                  {allClasses.length === 0
                    ? 'Join a class above to see it here.'
                    : `No classes match "${searchQuery.trim()}".`}
                </Text>
              )}
              <View className="mt-3 gap-2.5">
                {classes.map((c, i) => (
                  <Link key={c.id} href={`/class/${c.id}` as Href} asChild>
                    <Pressable
                      className="flex-row flex-wrap items-center gap-4.5 rounded-2xl border border-black/15 bg-white px-4 py-[15px] shadow-sm"
                      style={{ borderLeftColor: CLASS_ACCENTS[i % CLASS_ACCENTS.length], borderLeftWidth: 4 }}
                    >
                      <Text className="w-[30px] text-[18px] font-bold text-ink/30">
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <View className="flex-1" style={{ minWidth: 210 }}>
                        <Text className="text-base font-bold tracking-tighter text-ink">{c.name}</Text>
                        <Text className="mt-0.5 text-[13px] text-ink/50">
                          {c.totalSlides === 0
                            ? 'No graded activities yet'
                            : c.completedSlides === c.totalSlides
                              ? 'All caught up'
                              : `${c.totalSlides - c.completedSlides} activities open`}
                        </Text>
                      </View>
                      <View className="max-w-[160px] flex-1 flex-row items-center gap-2.5" style={{ minWidth: 100 }}>
                        <View className="h-1 flex-1 rounded-full bg-black/10">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${c.percentComplete}%`,
                              backgroundColor: CLASS_ACCENTS[i % CLASS_ACCENTS.length],
                            }}
                          />
                        </View>
                        <Text className="text-[12.5px] font-semibold text-ink/70">
                          {c.percentComplete}%
                        </Text>
                      </View>
                      <Text className="w-[92px] text-right text-[12.5px] text-ink/50">
                        {c.completedSlides} / {c.totalSlides} lessons
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </View>

            {/* Due soon + Badges */}
            <View className="mt-7 flex-row flex-wrap items-start gap-x-7 gap-y-6">
              <View className="flex-1" style={{ minWidth: 460 }}>
                <Text className="text-[19px] font-bold tracking-tighter text-ink">Due soon</Text>
                <View className="mt-3 gap-2 rounded-2xl border border-black/15 bg-white px-2.5 py-1 shadow-sm">
                  {dueSoon.length === 0 && (
                    <Text className="px-0.5 py-4 text-[13.5px] text-ink/50">
                      Nothing due right now — nice work.
                    </Text>
                  )}
                  {dueSoon.map((item, i) => (
                    <Link key={item.slideId} href={`/class/${item.classId}` as Href} asChild>
                      <Pressable
                        className="flex-row items-center gap-2.5 px-0.5 py-2.5"
                        style={{
                          borderBottomWidth: i === dueSoon.length - 1 ? 0 : 1,
                          borderBottomColor: 'rgba(0,0,0,0.08)',
                        }}
                      >
                        <View
                          className="h-[15px] w-[15px] items-center justify-center rounded-sm"
                          style={{ borderWidth: 1.5, borderColor: '#c4b5fd' }}
                        />
                        <Text className="flex-1 text-[12.5px] font-medium text-ink" numberOfLines={1}>
                          {item.resourceTitle}
                        </Text>
                        <Text className="text-[11px] font-semibold text-violet-700" numberOfLines={1}>
                          {item.className}
                        </Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </View>

              {badges.length > 0 && (
                <View className="flex-1 max-w-[320px]" style={{ minWidth: 240 }}>
                  <Text className="text-[15px] font-bold tracking-tighter text-ink">Badges</Text>
                  <View className="mt-2.5 flex-row flex-wrap gap-2.5">
                    {badges.map((badge) => (
                      <View
                        key={badge.key}
                        className="items-center gap-1.5 rounded-xl border border-black/15 px-3.5 py-3 shadow-sm"
                        style={{ backgroundColor: badge.earned ? '#fef3c7' : '#f3f4f6' }}
                      >
                        <Feather
                          name="award"
                          size={18}
                          color={badge.earned ? '#b45309' : '#9ca3af'}
                        />
                        <Text
                          className="max-w-[76px] text-center text-[11px] font-semibold"
                          style={{ color: badge.earned ? '#92400e' : '#9ca3af' }}
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
