import type { Href } from 'expo-router';

import { useStudentAssignments } from './use-student-assignments';
import { useStudentDashboard } from './use-student-dashboard';
import { useStudentGrades } from './use-student-grades';

export interface TodoItem {
  key: string;
  title: string;
  meta: string;
  href: Href;
}

export interface StudentTodoData {
  due: TodoItem[];
  recentFeedback: TodoItem[];
  isLoading: boolean;
}

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isRecent(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() < RECENT_WINDOW_MS;
}

// Composes three existing hooks instead of re-querying: lesson-slide activities not yet
// submitted (from the dashboard hook's `dueSoon`), legacy assignment due items (still the
// same `assignments`/`submissions` pipeline as before — just no longer a separate tab),
// and recently-graded feedback (from the Grades hook, "recent" standing in for a real
// notifications table's unread state).
export function useStudentTodo(): StudentTodoData {
  const dashboard = useStudentDashboard();
  const assignments = useStudentAssignments();
  const grades = useStudentGrades();

  const due: TodoItem[] = [
    ...(dashboard.data?.dueSoon ?? []).map((d) => ({
      key: `slide-due:${d.slideId}`,
      title: d.resourceTitle,
      meta: d.className,
      href: `/class/${d.classId}` as Href,
    })),
    ...(assignments.data ?? [])
      .filter((a) => !a.submission || a.submission.status !== 'graded')
      .map((a) => ({
        key: `assignment-due:${a.id}`,
        title: a.title,
        meta: a.class_name,
        href: `/canvas/${a.id}` as Href,
      })),
  ];

  const recentFeedback: TodoItem[] = (grades.data ?? [])
    .filter((g) => g.tag !== 'Pending' && isRecent(g.updatedAt))
    .map((g) => ({
      key: `feedback:${g.key}`,
      title: g.title,
      meta: `${g.tag} · ${g.scoreLabel}`,
      href: g.href,
    }));

  return {
    due,
    recentFeedback,
    isLoading: dashboard.isLoading || assignments.isLoading || grades.isLoading,
  };
}
