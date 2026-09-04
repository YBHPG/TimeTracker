export interface TimeInterval {
  id: string;
  task_id: string;
  start_time: string; // ISO 8601 string
  end_time: string | null; // null if active
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export type TaskCategory = 'work' | 'personal' | 'study';

export interface CategoryConfig {
  id: TaskCategory;
  label: string;
  color: string;
  dotBg: string;
  badgeClass: string;
  activeBadgeClass: string;
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'work',
    label: 'Работа',
    color: '#3B82F6',
    dotBg: 'bg-blue-500',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    activeBadgeClass: 'bg-blue-500 text-white border-transparent',
  },
  {
    id: 'personal',
    label: 'Личное',
    color: '#10B981',
    dotBg: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    activeBadgeClass: 'bg-emerald-500 text-white border-transparent',
  },
  {
    id: 'study',
    label: 'Учёба',
    color: '#8B5CF6',
    dotBg: 'bg-purple-500',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    activeBadgeClass: 'bg-purple-500 text-white border-transparent',
  },
];

export function getCategoryConfig(category?: string | null): CategoryConfig {
  const found = CATEGORIES.find((c) => c.id === category);
  return found || CATEGORIES[0];
}

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category?: TaskCategory | string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  intervals: TimeInterval[];
  is_active: boolean;
  total_duration_seconds: number;
  active_interval_id: string | null;
}

export interface DayStatItem {
  date: string; // YYYY-MM-DD
  total_seconds: number;
  task_count: number;
  has_active_task: boolean;
}

export interface DaySummary {
  date: string;
  total_seconds: number;
  task_count: number;
  has_active_task: boolean;
  tasks: Task[];
}

export interface CreateTaskPayload {
  id?: string;
  title: string;
  date: string;
  category?: TaskCategory | string;
  auto_start?: boolean;
  at?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  date?: string;
  category?: TaskCategory | string | null;
  order_index?: number;
}

export interface CreateIntervalPayload {
  id?: string;
  start_time: string;
  end_time?: string | null;
}

export interface UpdateIntervalPayload {
  start_time?: string;
  end_time?: string | null;
}

export interface TimerActionPayload {
  at?: string;
  interval_id?: string;
}
