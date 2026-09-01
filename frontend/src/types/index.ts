export interface TimeInterval {
  id: string;
  task_id: string;
  start_time: string; // ISO 8601 string
  end_time: string | null; // null if active
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
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
  title: string;
  date: string;
  auto_start?: boolean;
}

export interface UpdateTaskPayload {
  title?: string;
  date?: string;
  order_index?: number;
}

export interface CreateIntervalPayload {
  start_time: string;
  end_time?: string | null;
}

export interface UpdateIntervalPayload {
  start_time?: string;
  end_time?: string | null;
}
