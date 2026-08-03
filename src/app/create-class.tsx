import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SelectorColumn, type SelectorAccent } from '@/components/onboarding/selector-column';
import { useCreateClassWizard } from '@/hooks/queries/use-create-class-wizard';
import { useAuthStore } from '@/store/auth-store';

const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Term 4', 'Summer Term'];
const GRADES = [
  'KG',
  'KG A',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAX_SECTIONS = 6;
const SUBJECTS = [
  'Mathematics',
  'English',
  'Science',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
];

interface WizardStep {
  key: 'term' | 'grade' | 'section' | 'subject';
  label: string;
  accent: SelectorAccent;
}

const STEPS: WizardStep[] = [
  { key: 'term', label: 'Select Term', accent: 'purple' },
  { key: 'grade', label: 'Select Class', accent: 'blue' },
  { key: 'section', label: 'Select Section', accent: 'green' },
  { key: 'subject', label: 'Select Subject', accent: 'orange' },
];

const STEP_DOT: Record<SelectorAccent, string> = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  orange: 'bg-orange-500',
};

export default function CreateClassScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const createClass = useCreateClassWizard();

  const [term, setTerm] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [subject, setSubject] = useState<string | null>(null);

  const stepDone: Record<WizardStep['key'], boolean> = {
    term: Boolean(term),
    grade: Boolean(grade),
    section: sections.length > 0,
    subject: Boolean(subject),
  };

  const canCreate = Boolean(term && grade && sections.length > 0 && subject);

  const summaryChips = useMemo(
    () => [
      { label: 'Term', value: term },
      { label: 'Class / Grade', value: grade },
      { label: 'Section', value: sections.length > 0 ? sections.join(', ') : null },
      { label: 'Subject', value: subject },
    ],
    [term, grade, sections, subject],
  );

  if (profile?.role === 'student') {
    return <Redirect href="/(student)/home" />;
  }

  const handleReset = () => {
    setTerm(null);
    setGrade(null);
    setSections([]);
    setSubject(null);
  };

  const handleClose = () => router.replace('/classes');

  const handleCreate = () => {
    if (!term || !grade || sections.length === 0 || !subject) return;
    createClass.mutate(
      { term, grade, sections, subject },
      { onSuccess: (created) => router.replace(`/class/${created.id}?created=1`) },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <SafeAreaView className="flex-1 bg-black/20">
        <ScrollView contentContainerClassName="items-center px-4 py-6">
          <LinearGradient
            colors={['#8b5cf6', '#3b82f6', '#22d3ee']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: '100%', maxWidth: 1200, borderRadius: 32, padding: 2 }}
          >
            <View className="gap-6 rounded-[30px] bg-paper p-6">
              {/* Header */}
              <View className="flex-row flex-wrap items-start justify-between gap-4">
                <View className="flex-row items-center gap-4">
                  <LinearGradient
                    colors={['#7c3aed', '#2563eb']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 56, height: 56, borderRadius: 18 }}
                    className="items-center justify-center"
                  >
                    <Text className="text-2xl">🏫</Text>
                  </LinearGradient>
                  <View>
                    <Text className="text-2xl font-bold text-ink">Create Your Class</Text>
                    <Text className="text-sm text-ink/50">
                      Set up your class details to get started ✨
                    </Text>
                  </View>
                </View>

                <View className="max-w-xs flex-1 gap-1 rounded-2xl bg-indigo-50 p-3">
                  <Text className="text-sm font-semibold text-indigo-700">✨ Tip</Text>
                  <Text className="text-xs text-indigo-900/70">
                    You can create multiple classes and switch between them anytime.
                  </Text>
                </View>

                <Pressable
                  onPress={handleClose}
                  className="h-9 w-9 items-center justify-center rounded-full bg-black/5"
                >
                  <Text className="text-base text-ink/50">✕</Text>
                </Pressable>
              </View>

              {/* Stepper */}
              <View className="flex-row flex-wrap items-center gap-2">
                {STEPS.map((step, index) => {
                  const done = stepDone[step.key];
                  return (
                    <View key={step.key} className="flex-row items-center gap-2">
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full ${
                          done ? STEP_DOT[step.accent] : 'bg-black/10'
                        }`}
                      >
                        {done && <Text className="text-xs font-bold text-white">✓</Text>}
                      </View>
                      <Text
                        className={`text-sm font-medium ${done ? 'text-ink' : 'text-ink/40'}`}
                      >
                        {step.label}
                      </Text>
                      {index < STEPS.length - 1 && (
                        <View className="mx-1 h-px w-6 bg-black/10" />
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Selector columns */}
              <View className="flex-row flex-wrap gap-3">
                <SelectorColumn
                  icon="📅"
                  title="Term"
                  subtitle="Choose a term"
                  accent="purple"
                  options={TERMS}
                  value={term}
                  onChange={setTerm}
                  searchPlaceholder="Search term…"
                />
                <SelectorColumn
                  icon="🎓"
                  title="Class / Grade"
                  subtitle="Choose class or grade"
                  accent="blue"
                  options={GRADES}
                  value={grade}
                  onChange={setGrade}
                  searchPlaceholder="Search grade…"
                />
                <SelectorColumn
                  icon="👥"
                  title="Section"
                  subtitle="Choose up to 6 sections"
                  accent="green"
                  options={SECTIONS}
                  multiple
                  max={MAX_SECTIONS}
                  value={sections}
                  onChange={setSections}
                  searchPlaceholder="Search section…"
                />
                <SelectorColumn
                  icon="📖"
                  title="Subject"
                  subtitle="Choose a subject"
                  accent="orange"
                  options={SUBJECTS}
                  value={subject}
                  onChange={setSubject}
                  searchPlaceholder="Search subject…"
                />
              </View>

              {/* Summary bar */}
              <View className="gap-4 rounded-2xl bg-white p-4 shadow-sm">
                <View className="flex-row flex-wrap items-center justify-between gap-4">
                  <View>
                    <Text className="text-base font-semibold text-ink">Your Class Summary</Text>
                    <Text className="text-xs text-ink/50">Review your selections</Text>
                  </View>

                  <View className="flex-row flex-wrap gap-2">
                    {summaryChips.map((chip) => (
                      <View
                        key={chip.label}
                        className="min-w-[110px] gap-0.5 rounded-xl bg-black/[0.03] px-3 py-2"
                      >
                        <Text className="text-sm font-semibold text-ink">
                          {chip.value ?? '—'}
                        </Text>
                        <Text className="text-[10px] uppercase tracking-wide text-ink/40">
                          {chip.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View className="flex-row items-center gap-3">
                    <Pressable onPress={handleReset} className="rounded-xl bg-black/5 px-4 py-3">
                      <Text className="text-sm font-medium text-ink/60">Reset All</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCreate}
                      disabled={!canCreate || createClass.isPending}
                      style={{ opacity: !canCreate || createClass.isPending ? 0.5 : 1 }}
                    >
                      <LinearGradient
                        colors={['#7c3aed', '#2563eb']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}
                        className="flex-row items-center gap-2"
                      >
                        <Text className="text-sm font-semibold text-white">
                          {createClass.isPending ? 'Creating…' : 'Create Class'}
                        </Text>
                        <Text className="text-sm text-white">→</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>

                {createClass.isError && (
                  <Text className="text-sm text-red-600">
                    {createClass.error instanceof Error
                      ? createClass.error.message
                      : 'Could not create the class.'}
                  </Text>
                )}
              </View>

              {/* Feature footer */}
              <View className="flex-row flex-wrap justify-between gap-4 border-t border-black/5 pt-4">
                <FeatureBadge icon="⚡" title="Quick Setup" subtitle="Create in seconds" />
                <FeatureBadge icon="🛡️" title="Secure & Private" subtitle="Your data is protected" />
                <FeatureBadge icon="🔄" title="Sync Across Devices" subtitle="Access anywhere" />
                <FeatureBadge icon="👥" title="Multiple Classes" subtitle="Manage with ease" />
              </View>
            </View>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function FeatureBadge({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="min-w-[150px] flex-1 flex-row items-center gap-2">
      <Text className="text-lg">{icon}</Text>
      <View>
        <Text className="text-xs font-semibold text-ink">{title}</Text>
        <Text className="text-[11px] text-ink/45">{subtitle}</Text>
      </View>
    </View>
  );
}
