import type { SidebarItem } from './teacher-sidebar';

// Shared across every student screen that shows the sidebar, so the nav list
// can't drift out of sync between them (same reasoning as TEACHER_SIDEBAR_ITEMS).
export const STUDENT_SIDEBAR_ITEMS: SidebarItem[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'my-classes', label: 'My Classes', icon: 'book-open' },
  { key: 'todo', label: 'To-do', icon: 'check-square' },
  { key: 'grades', label: 'Grades', icon: 'award' },
  { key: 'progress', label: 'Progress', icon: 'trending-up' },
];
