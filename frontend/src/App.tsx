import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from './api/client';
import { Task, TimeInterval, DayStatItem, TaskCategory } from './types';
import { useTheme } from './hooks/useTheme';
import { useTimerTick } from './hooks/useTimerTick';
import { TimelineStrip } from './components/TimelineStrip';
import { TaskItem } from './components/TaskItem';
import { BottomNav } from './components/BottomNav';
import { NewTaskModal } from './components/NewTaskModal';
import { CalendarModal } from './components/CalendarModal';
import { IntervalModal } from './components/IntervalModal';
import { StatsView } from './components/StatsView';
import { Checkbox, Switch } from './components/Checkbox';
import { CategoryDropdown } from './components/CategoryDropdown';
import { ConfirmModal } from './components/ConfirmModal';
import {
  getTodayDateStr,
  getDayOfWeekName,
  getFormattedDayMonth,
  calculateTaskDurationSeconds,
  formatDurationDigital,
  formatDurationHuman,
  formatDatePretty,
} from './utils/formatters';
import {
  getCachedTasks,
  setCachedTasks,
  getCachedDaysStats,
  setCachedDaysStats,
  enqueueAction,
  subscribeSyncState,
  onQueueDrained,
  generateClientUUID,
  SyncState,
} from './utils/syncManager';
import {
  ChevronRight,
  Plus,
  AlertCircle,
  ChevronLeft,
  Calendar as CalendarIcon,
  ListChecks,
  Trash2,
  WifiOff,
  RefreshCw,
  Check,
} from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';

function pauseTaskLocally(task: Task, isoTime: string): Task {
  let totalSec = 0;
  const updatedIntervals = task.intervals.map((inv) => {
    if (inv.end_time === null) {
      const startMs = new Date(inv.start_time).getTime();
      const endMs = new Date(isoTime).getTime();
      const dur = Math.max(0, Math.floor((endMs - startMs) / 1000));
      totalSec += dur;
      return {
        ...inv,
        end_time: isoTime,
        duration_seconds: dur,
        updated_at: isoTime,
      };
    }
    totalSec += inv.duration_seconds;
    return inv;
  });

  return {
    ...task,
    is_active: false,
    active_interval_id: null,
    intervals: updatedIntervals,
    total_duration_seconds: totalSec,
    updated_at: isoTime,
  };
}

export const App: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [tasks, setTasks] = useState<Task[]>(() => getCachedTasks(getTodayDateStr()) || []);
  const [daysStats, setDaysStats] = useState<DayStatItem[]>(() => getCachedDaysStats() || []);
  const [isLoading, setIsLoading] = useState(() => !(getCachedTasks(getTodayDateStr())?.length));
  const [error, setError] = useState<string | null>(null);

  // Sync state for offline support
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
  });
  const [showJustSynced, setShowJustSynced] = useState(false);

  // Active view tab: 'home' | 'stats'
  const [activeTab, setActiveTab] = useState<'home' | 'stats'>('home');

  // Inline quick add input for desktop
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<TaskCategory>('work');
  const [quickAutoStart, setQuickAutoStart] = useState(true);

  // Multi-selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Scroll fade gradient states for tasks list
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const taskListRef = useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    const el = taskListRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 2;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  // Scroll fade gradient states for stats view
  const [statsCanScrollUp, setStatsCanScrollUp] = useState(false);
  const [statsCanScrollDown, setStatsCanScrollDown] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const checkStatsScroll = useCallback(() => {
    const el = statsRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 2;
    setStatsCanScrollUp(el.scrollTop > 4);
    setStatsCanScrollDown(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  // Focus & highlight state triggered from timeline interaction
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [hoveredTimelineTaskId, setHoveredTimelineTaskId] = useState<string | null>(null);

  const handleSelectTaskFromTimeline = (taskId: string) => {
    setActiveTab('home');
    setFocusedTaskId(taskId);
    setHighlightedTaskId(taskId);

    setTimeout(() => {
      const el = document.getElementById(`task-${taskId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);

    setTimeout(() => {
      setHighlightedTaskId((curr) => (curr === taskId ? null : curr));
    }, 2500);
  };

  // Modals state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [intervalModalState, setIntervalModalState] = useState<{
    isOpen: boolean;
    task: Task | null;
    interval: TimeInterval | null;
  }>({
    isOpen: false,
    task: null,
    interval: null,
  });

  // Clock state for hero display
  const [currentTimeStr, setCurrentTimeStr] = useState(() => format(new Date(), 'HH:mm'));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(format(new Date(), 'HH:mm'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate if any task has an active timer running
  const activeTask = useMemo(() => tasks.find((t) => t.is_active), [tasks]);
  const hasActiveTask = Boolean(activeTask);

  // Trigger re-render every second when timer is running and get tick value
  const tick = useTimerTick(hasActiveTask);

  // Total seconds spent today (recalculated when tasks change or on each tick)
  const totalDaySeconds = useMemo(() => {
    return tasks.reduce((sum, task) => sum + calculateTaskDurationSeconds(task), 0);
  }, [tasks, tick]);

  // Update document title dynamically every second when a task is running
  useEffect(() => {
    if (activeTask) {
      const dur = calculateTaskDurationSeconds(activeTask);
      document.title = `▶ [${formatDurationDigital(dur)}] ${activeTask.title} | TimeTracker`;
    } else {
      document.title = 'TimeTracker — Учет времени';
    }
  }, [activeTask, tick]);

  // Subscribe to sync manager events
  useEffect(() => {
    const unsubscribe = subscribeSyncState(setSyncState);
    return unsubscribe;
  }, []);

  // Fetch tasks for the selected date (cache-first for instant offline responsiveness)
  const loadTasks = useCallback(async (dateStr: string) => {
    const cached = getCachedTasks(dateStr);
    if (cached) {
      setTasks(cached);
    }

    try {
      const data = await api.getTasks(dateStr);
      setTasks(data);
      setCachedTasks(dateStr, data);
      setError(null);
    } catch (err: any) {
      if (!cached && navigator.onLine) {
        setError(err.message || 'Не удалось загрузить задачи');
      }
    }
  }, []);

  // Fetch all recorded days for calendar indicators
  const loadDaysStats = useCallback(async () => {
    const cached = getCachedDaysStats();
    if (cached) {
      setDaysStats(cached);
    }

    try {
      const stats = await api.getDaysStats();
      setDaysStats(stats);
      setCachedDaysStats(stats);
    } catch {
      // Non-critical
    }
  }, []);

  // Re-fetch when sync queue is drained
  useEffect(() => {
    const unsubscribe = onQueueDrained(() => {
      setShowJustSynced(true);
      const timer = setTimeout(() => setShowJustSynced(false), 2500);
      loadTasks(selectedDate);
      loadDaysStats();
      return () => clearTimeout(timer);
    });
    return unsubscribe;
  }, [selectedDate, loadTasks, loadDaysStats]);

  // Initial load and date change load
  useEffect(() => {
    const cached = getCachedTasks(selectedDate);
    if (!cached || cached.length === 0) {
      setIsLoading(true);
    }
    Promise.all([loadTasks(selectedDate), loadDaysStats()]).finally(() => {
      setIsLoading(false);
    });
  }, [selectedDate, loadTasks, loadDaysStats]);

  useEffect(() => {
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
  }, [selectedDate]);

  useEffect(() => {
    const timeout = setTimeout(checkScroll, 50);
    const el = taskListRef.current;
    if (!el) return () => clearTimeout(timeout);
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timeout);
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [tasks, checkScroll]);

  useEffect(() => {
    if (activeTab === 'stats') {
      const timeout = setTimeout(checkStatsScroll, 50);
      const el = statsRef.current;
      if (!el) return () => clearTimeout(timeout);
      el.addEventListener('scroll', checkStatsScroll, { passive: true });
      window.addEventListener('resize', checkStatsScroll);
      return () => {
        clearTimeout(timeout);
        el.removeEventListener('scroll', checkStatsScroll);
        window.removeEventListener('resize', checkStatsScroll);
      };
    }
  }, [activeTab, tasks, checkStatsScroll]);

  // Navigation helpers
  const handlePrevDay = () => {
    const d = subDays(parseISO(selectedDate), 1);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const d = addDays(parseISO(selectedDate), 1);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  // Handlers - Optimistic local updates with offline sync queue
  const handleAddTask = async (title: string, autoStart: boolean, category: TaskCategory = 'work') => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setError(null);
    const isoNow = new Date().toISOString();
    const existingTask = tasks.find(
      (t) => t.title.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (existingTask) {
      let updatedTasks = [...tasks];
      if (autoStart) {
        const newIntervalId = generateClientUUID();
        updatedTasks = updatedTasks.map((t) => {
          if (t.id === existingTask.id) {
            const newInv: TimeInterval = {
              id: newIntervalId,
              task_id: t.id,
              start_time: isoNow,
              end_time: null,
              duration_seconds: 0,
              created_at: isoNow,
              updated_at: isoNow,
            };
            return {
              ...t,
              category,
              is_active: true,
              active_interval_id: newIntervalId,
              intervals: [...t.intervals, newInv],
              updated_at: isoNow,
            };
          } else if (t.is_active) {
            return pauseTaskLocally(t, isoNow);
          }
          return t;
        });
      } else {
        updatedTasks = updatedTasks.map((t) =>
          t.id === existingTask.id ? { ...t, category, updated_at: isoNow } : t
        );
      }

      setTasks(updatedTasks);
      setCachedTasks(selectedDate, updatedTasks);

      enqueueAction({
        type: 'CREATE_TASK',
        payload: {
          id: existingTask.id,
          title: trimmed,
          date: selectedDate,
          category,
          auto_start: autoStart,
          at: isoNow,
        },
      });
    } else {
      const newTaskId = generateClientUUID();
      const newIntervalId = generateClientUUID();
      const newInterval: TimeInterval | null = autoStart
        ? {
            id: newIntervalId,
            task_id: newTaskId,
            start_time: isoNow,
            end_time: null,
            duration_seconds: 0,
            created_at: isoNow,
            updated_at: isoNow,
          }
        : null;

      let updatedTasks = autoStart
        ? tasks.map((t) => (t.is_active ? pauseTaskLocally(t, isoNow) : t))
        : [...tasks];

      const maxOrder = updatedTasks.reduce((max, t) => Math.max(max, t.order_index || 0), 0);

      const newTask: Task = {
        id: newTaskId,
        title: trimmed,
        date: selectedDate,
        category,
        order_index: maxOrder + 1,
        intervals: newInterval ? [newInterval] : [],
        is_active: autoStart,
        total_duration_seconds: 0,
        active_interval_id: newInterval ? newInterval.id : null,
        created_at: isoNow,
        updated_at: isoNow,
      };

      updatedTasks = [...updatedTasks, newTask];
      setTasks(updatedTasks);
      setCachedTasks(selectedDate, updatedTasks);

      enqueueAction({
        type: 'CREATE_TASK',
        payload: {
          id: newTaskId,
          title: trimmed,
          date: selectedDate,
          category,
          auto_start: autoStart,
          at: isoNow,
        },
      });
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    await handleAddTask(trimmed, quickAutoStart, quickCategory);
    setQuickTitle('');
  };

  const handleUpdateCategory = async (taskId: string, newCategory: TaskCategory) => {
    const isoNow = new Date().toISOString();
    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, category: newCategory, updated_at: isoNow } : t
    );
    setTasks(updated);
    setCachedTasks(selectedDate, updated);
    enqueueAction({
      type: 'UPDATE_TASK',
      taskId,
      payload: { category: newCategory },
    });
  };

  const handleStartTimer = async (taskId: string) => {
    const isoNow = new Date().toISOString();
    const newIntervalId = generateClientUUID();

    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        if (t.is_active) return t;
        const newInv: TimeInterval = {
          id: newIntervalId,
          task_id: t.id,
          start_time: isoNow,
          end_time: null,
          duration_seconds: 0,
          created_at: isoNow,
          updated_at: isoNow,
        };
        return {
          ...t,
          is_active: true,
          active_interval_id: newIntervalId,
          intervals: [...t.intervals, newInv],
          updated_at: isoNow,
        };
      } else if (t.is_active) {
        return pauseTaskLocally(t, isoNow);
      }
      return t;
    });

    setTasks(updated);
    setCachedTasks(selectedDate, updated);
    enqueueAction({
      type: 'START_TIMER',
      taskId,
      payload: {
        at: isoNow,
        interval_id: newIntervalId,
      },
    });
  };

  const handlePauseTimer = async (taskId: string) => {
    const isoNow = new Date().toISOString();
    const updated = tasks.map((t) => (t.id === taskId ? pauseTaskLocally(t, isoNow) : t));
    setTasks(updated);
    setCachedTasks(selectedDate, updated);
    enqueueAction({
      type: 'PAUSE_TIMER',
      taskId,
      payload: {
        at: isoNow,
      },
    });
  };

  const handleUpdateTitle = async (taskId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const isoNow = new Date().toISOString();
    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, title: trimmed, updated_at: isoNow } : t
    );
    setTasks(updated);
    setCachedTasks(selectedDate, updated);
    enqueueAction({
      type: 'UPDATE_TASK',
      taskId,
      payload: { title: trimmed },
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    setCachedTasks(selectedDate, updated);
    enqueueAction({
      type: 'DELETE_TASK',
      taskId,
    });
  };

  // Interval modal handlers
  const handleOpenAddInterval = (task: Task) => {
    setIntervalModalState({
      isOpen: true,
      task,
      interval: null,
    });
  };

  const handleEditInterval = (task: Task, interval: TimeInterval) => {
    setIntervalModalState({
      isOpen: true,
      task,
      interval,
    });
  };

  const handleSaveInterval = async (startIso: string, endIso: string | null) => {
    const { task, interval } = intervalModalState;
    if (!task) return;

    const isoNow = new Date().toISOString();
    const startMs = new Date(startIso).getTime();
    const endMs = endIso ? new Date(endIso).getTime() : Date.now();
    const duration = Math.max(0, Math.floor((endMs - startMs) / 1000));

    let updatedTasks = [...tasks];

    if (interval) {
      updatedTasks = updatedTasks.map((t) => {
        if (t.id !== task.id) {
          if (endIso === null && t.is_active) {
            return pauseTaskLocally(t, startIso);
          }
          return t;
        }
        const intervals = t.intervals.map((inv) =>
          inv.id === interval.id
            ? { ...inv, start_time: startIso, end_time: endIso, duration_seconds: duration, updated_at: isoNow }
            : inv
        );
        const is_active = intervals.some((inv) => inv.end_time === null);
        const active_inv = intervals.find((inv) => inv.end_time === null);
        const total_sec = intervals.reduce((acc, inv) => acc + inv.duration_seconds, 0);
        return {
          ...t,
          intervals,
          is_active,
          active_interval_id: active_inv ? active_inv.id : null,
          total_duration_seconds: total_sec,
          updated_at: isoNow,
        };
      });

      enqueueAction({
        type: 'UPDATE_INTERVAL',
        intervalId: interval.id,
        payload: {
          start_time: startIso,
          end_time: endIso,
        },
      });
    } else {
      const newIntervalId = generateClientUUID();
      const newInv: TimeInterval = {
        id: newIntervalId,
        task_id: task.id,
        start_time: startIso,
        end_time: endIso,
        duration_seconds: duration,
        created_at: isoNow,
        updated_at: isoNow,
      };

      updatedTasks = updatedTasks.map((t) => {
        if (t.id !== task.id) {
          if (endIso === null && t.is_active) {
            return pauseTaskLocally(t, startIso);
          }
          return t;
        }
        const intervals = [...t.intervals, newInv].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        const is_active = intervals.some((inv) => inv.end_time === null);
        const active_inv = intervals.find((inv) => inv.end_time === null);
        const total_sec = intervals.reduce((acc, inv) => acc + inv.duration_seconds, 0);
        return {
          ...t,
          intervals,
          is_active,
          active_interval_id: active_inv ? active_inv.id : null,
          total_duration_seconds: total_sec,
          updated_at: isoNow,
        };
      });

      enqueueAction({
        type: 'ADD_INTERVAL',
        taskId: task.id,
        payload: {
          id: newIntervalId,
          start_time: startIso,
          end_time: endIso,
        },
      });
    }

    setTasks(updatedTasks);
    setCachedTasks(selectedDate, updatedTasks);
  };

  const handleDeleteInterval = async (intervalId: string) => {
    const isoNow = new Date().toISOString();
    const updatedTasks = tasks.map((t) => {
      const hasInterval = t.intervals.some((inv) => inv.id === intervalId);
      if (!hasInterval) return t;

      const intervals = t.intervals.filter((inv) => inv.id !== intervalId);
      const is_active = intervals.some((inv) => inv.end_time === null);
      const active_inv = intervals.find((inv) => inv.end_time === null);
      const total_sec = intervals.reduce((acc, inv) => acc + inv.duration_seconds, 0);
      return {
        ...t,
        intervals,
        is_active,
        active_interval_id: active_inv ? active_inv.id : null,
        total_duration_seconds: total_sec,
        updated_at: isoNow,
      };
    });

    setTasks(updatedTasks);
    setCachedTasks(selectedDate, updatedTasks);

    enqueueAction({
      type: 'DELETE_INTERVAL',
      intervalId,
    });
  };

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedTaskIds.size === tasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    const updatedTasks = tasks.filter((t) => !selectedTaskIds.has(t.id));
    setTasks(updatedTasks);
    setCachedTasks(selectedDate, updatedTasks);
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);

    enqueueAction({
      type: 'BULK_DELETE_TASKS',
      taskIds: ids,
    });
  };

  const isTodaySelected = selectedDate === getTodayDateStr();

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen bg-[#F4F4F6] dark:bg-[#09090B] text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center py-0 sm:py-3 lg:py-4 px-0 sm:px-4 lg:px-6 transition-colors duration-200 lg:overflow-hidden">
      {/* Responsive Container: Phone card on mobile, wide 2-column dashboard on PC (lg) */}
      <div className="w-full max-w-md lg:max-w-6xl min-h-screen lg:min-h-0 lg:h-full lg:max-h-[min(880px,calc(100vh-2rem))] bg-white dark:bg-[#121214] sm:rounded-[40px] lg:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/70 dark:sm:border-slate-800/80 flex flex-col relative overflow-hidden">
        
        {/* Error Notification */}
        {error && (
          <div className="m-4 flex items-center gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-600 text-xs flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="font-bold underline">✕</button>
          </div>
        )}

        {/* Main Workspace Layout */}
        <div className="flex-1 p-5 sm:p-7 lg:p-8 pb-24 lg:pb-24 overflow-y-auto lg:overflow-hidden min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 lg:h-full min-h-0">
            
            {/* ======================================================== */}
            {/* LEFT COLUMN (Hero Clock, Date Header, Timeline Strip, Summary) */}
            {/* ======================================================== */}
            <div className="lg:col-span-5 flex flex-col justify-start space-y-4 lg:border-r lg:border-slate-100 dark:lg:border-slate-800/80 lg:pr-8 flex-shrink-0">
              {/* Top Date Header */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                      {getDayOfWeekName(selectedDate)}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm sm:text-base font-normal text-slate-500 dark:text-slate-400">
                        {getFormattedDayMonth(selectedDate)}
                      </p>

                      {/* Network / Offline / Sync Status Indicator */}
                      {!syncState.isOnline ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-medium"
                          title="Офлайн режим. Данные сохраняются локально и отправятся на сервер при появлении интернета."
                        >
                          <WifiOff className="w-3 h-3" />
                          <span>Офлайн{syncState.pendingCount > 0 ? ` (${syncState.pendingCount})` : ''}</span>
                        </span>
                      ) : syncState.isSyncing ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-medium animate-pulse"
                          title="Синхронизация данных с сервером..."
                        >
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Синхронизация{syncState.pendingCount > 0 ? ` (${syncState.pendingCount})` : ''}</span>
                        </span>
                      ) : showJustSynced ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium animate-in fade-in duration-200"
                          title="Все данные успешно сохранены на сервере"
                        >
                          <Check className="w-3 h-3" />
                          <span>Синхронизировано</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Date Navigation & Calendar Trigger */}
                  <div className="flex items-center gap-0.5 pt-1">
                    <button
                      type="button"
                      onClick={handlePrevDay}
                      aria-label="Предыдущий день"
                      title="Предыдущий день"
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleNextDay}
                      aria-label="Следующий день"
                      title="Следующий день"
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(true)}
                      aria-label="Открыть календарь"
                      title="Открыть календарь"
                      className="p-1.5 ml-1 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Hero Current Time Display */}
                <div className="mt-4 mb-2 text-center">
                  <div className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight text-slate-900 dark:text-white font-sans">
                    {currentTimeStr}
                  </div>

                  {/* Active Timer Pill Badge (Eye-catching focal point during work) */}
                  {activeTask ? (
                    <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E0533C]/10 dark:bg-[#E0533C]/20 border border-[#E0533C]/30 text-[#E0533C] dark:text-[#ff745e] font-mono text-xs font-semibold shadow-sm animate-pulse-subtle">
                      <span className="w-2 h-2 rounded-full bg-[#E0533C] animate-ping flex-shrink-0" />
                      <span className="truncate max-w-[180px] sm:max-w-[260px] font-sans font-medium text-slate-800 dark:text-slate-200">
                        {activeTask.title}:
                      </span>
                      <span className="font-bold">
                        {formatDurationDigital(calculateTaskDurationSeconds(activeTask))}
                      </span>
                    </div>
                  ) : null}

                  {/* 24-hour Visual Timeline Strip with NOW Badge */}
                  <div className="mt-2">
                    <TimelineStrip
                      tasks={tasks}
                      selectedDate={selectedDate}
                      onSelectTask={handleSelectTaskFromTimeline}
                      onHoverTask={setHoveredTimelineTaskId}
                    />
                  </div>
                </div>
              </div>

              {/* Day Overview Card (Плашка с общим временем) - Зафиксирована под блоком с лентой времени */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/90 dark:bg-[#18181B] border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span>Сводка за день</span>
                  {hasActiveTask && (
                    <span className="flex items-center gap-1.5 text-[#E0533C] dark:text-[#ff745e] normal-case font-bold">
                      <span className="w-2 h-2 rounded-full bg-[#E0533C] animate-ping" />
                      Таймер активен
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">
                      {formatDurationDigital(totalDaySeconds)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatDurationHuman(totalDaySeconds)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-900 dark:text-white text-base">
                      {tasks.length}
                    </span>{' '}
                    {tasks.length === 1 ? 'задача' : tasks.length > 4 ? 'задач' : 'задачи'}
                  </div>
                </div>

                {/* Quick Date Shortcuts */}
                <div className="pt-2 flex items-center gap-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                    aria-label="Перейти ко вчерашнему дню"
                    className="px-3 py-1 text-xs rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                  >
                    Вчера
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(getTodayDateStr())}
                    aria-label="Перейти к сегодняшнему дню"
                    className={`px-3 py-1 text-xs rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] ${
                      isTodaySelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Сегодня
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(true)}
                    aria-label="Открыть календарь"
                    className="px-3 py-1 text-xs rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                  >
                    Календарь
                  </button>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* RIGHT COLUMN (Tasks List & Stats View) */}
            {/* ======================================================== */}
            <div className="lg:col-span-7 flex flex-col justify-start lg:h-full lg:overflow-hidden min-h-0">
              {activeTab === 'home' ? (
                <div className="flex flex-col lg:h-full min-h-0">
                  {/* Section Header or Selection Mode Toolbar */}
                  {isSelectionMode ? (
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800 mb-3 flex-shrink-0 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={tasks.length > 0 && selectedTaskIds.size === tasks.length}
                          onChange={handleToggleSelectAll}
                          label={
                            <span className="font-semibold text-sm text-slate-900 dark:text-white">
                              Выбрать все
                            </span>
                          }
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({selectedTaskIds.size} из {tasks.length})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedTaskIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            aria-label={`Удалить выбранные задачи (${selectedTaskIds.size})`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Удалить ({selectedTaskIds.size})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsSelectionMode(false);
                            setSelectedTaskIds(new Set());
                          }}
                          aria-label="Отменить режим выбора"
                          className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800 mb-3 flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                          {isTodaySelected ? 'Today' : formatDatePretty(selectedDate)}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {tasks.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {tasks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsSelectionMode(true)}
                            aria-label="Выбрать несколько задач"
                            title="Выбрать несколько задач"
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                          >
                            <ListChecks className="w-5 h-5 stroke-[2]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsNewTaskOpen(true)}
                          aria-label="Добавить новую задачу"
                          title="Добавить новую задачу"
                          className="p-1.5 text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                        >
                          <Plus className="w-6 h-6 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Inline Task Creator on PC with Custom Category Dropdown & Animated Button */}
                  <form
                    onSubmit={handleQuickAdd}
                    className="hidden lg:flex items-center gap-2.5 mb-4 p-2 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-slate-200/80 dark:border-slate-800/80 flex-shrink-0"
                  >
                    <input
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      aria-label="Название новой задачи"
                      placeholder="Быстро добавить задачу..."
                      className="flex-1 px-3 py-1.5 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] rounded-xl"
                    />
                    <CategoryDropdown
                      value={quickCategory}
                      onChange={setQuickCategory}
                      variant="pill"
                    />
                    <div className="px-1 flex items-center">
                      <Switch
                        checked={quickAutoStart}
                        onChange={setQuickAutoStart}
                        label="Старт"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!quickTitle.trim()}
                      aria-label={quickAutoStart ? 'Начать задачу' : 'Создать задачу'}
                      className="h-8 px-4 inline-flex items-center justify-center min-w-[76px] rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold tracking-wide transition disabled:opacity-40 shadow-xs flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
                    >
                      <span
                        key={quickAutoStart ? 'start' : 'create'}
                        className="inline-block animate-in fade-in zoom-in-95 duration-150"
                      >
                        {quickAutoStart ? 'Начать' : 'Создать'}
                      </span>
                    </button>
                  </form>

                  {/* Tasks List Container with Dynamic Top & Bottom Fade Gradients */}
                  <div className="relative lg:flex-1 flex flex-col min-h-0">
                    {/* Top Fade Gradient */}
                    <div
                      className={`pointer-events-none absolute top-0 left-0 right-2 h-7 bg-gradient-to-b from-white dark:from-[#121214] to-transparent z-10 transition-opacity duration-200 ${
                        canScrollUp ? 'opacity-100' : 'opacity-0'
                      }`}
                    />

                    {/* Scrollable Tasks List with custom smooth scrollbar and zero horizontal shift */}
                    <div
                      ref={taskListRef}
                      onScroll={checkScroll}
                      className="flex-1 custom-scrollbar px-2.5 sm:px-3 min-h-0 pt-1 pb-4"
                    >
                      {isLoading ? (
                        <div className="py-16 text-center text-slate-400">
                          <div className="inline-block w-6 h-6 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin mb-2" />
                          <p className="text-xs">Загрузка задач...</p>
                        </div>
                      ) : tasks.length === 0 ? (
                        <div className="py-16 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                          <p className="text-sm text-slate-400 dark:text-slate-500">
                            Нет задач на этот день.
                          </p>
                          <button
                            onClick={() => setIsNewTaskOpen(true)}
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Создать первую задачу</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {tasks.map((task, idx) => (
                            <React.Fragment key={task.id}>
                              <TaskItem
                                task={task}
                                onStart={handleStartTimer}
                                onPause={handlePauseTimer}
                                onUpdateTitle={handleUpdateTitle}
                                onUpdateCategory={handleUpdateCategory}
                                onDeleteTask={handleDeleteTask}
                                onOpenAddInterval={handleOpenAddInterval}
                                onEditInterval={handleEditInterval}
                                onDeleteInterval={handleDeleteInterval}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedTaskIds.has(task.id)}
                                onToggleSelect={handleToggleSelect}
                                isForceExpanded={focusedTaskId === task.id}
                                isHighlighted={highlightedTaskId === task.id}
                                isTimelineHovered={hoveredTimelineTaskId === task.id}
                              />
                              {idx < tasks.length - 1 && (
                                <div className="mx-2 my-2 h-[1px] bg-slate-200/60 dark:bg-slate-800/70" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Fade Gradient */}
                    <div
                      className={`pointer-events-none absolute bottom-0 left-0 right-2 h-8 bg-gradient-to-t from-white dark:from-[#121214] to-transparent z-10 transition-opacity duration-200 ${
                        canScrollDown ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:h-full min-h-0">
                  <div className="py-2 border-b border-slate-200/80 dark:border-slate-800 mb-4 flex-shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Статистика за день
                    </h2>
                  </div>
                  <div className="relative lg:flex-1 flex flex-col min-h-0">
                    {/* Top Fade Gradient - only visible when scrolled down */}
                    <div
                      className={`pointer-events-none absolute top-0 left-0 right-2 h-7 bg-gradient-to-b from-white dark:from-[#121214] to-transparent z-10 transition-opacity duration-200 ${
                        statsCanScrollUp ? 'opacity-100' : 'opacity-0'
                      }`}
                    />

                    {/* Scrollable Stats View */}
                    <div
                      ref={statsRef}
                      onScroll={checkStatsScroll}
                      className="flex-1 custom-scrollbar lg:pr-1 pb-4 min-h-0 pt-0.5"
                    >
                      <StatsView tasks={tasks} totalSeconds={totalDaySeconds} />
                    </div>

                    {/* Bottom Fade Gradient - visible when clipped below, fades out at bottom */}
                    <div
                      className={`pointer-events-none absolute bottom-0 left-0 right-2 h-8 bg-gradient-to-t from-white dark:from-[#121214] to-transparent z-10 transition-opacity duration-200 ${
                        statsCanScrollDown ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Capsule Bottom Navigation Bar (Matching screenshot) */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          selectedDate={selectedDate}
          theme={theme}
          onThemeChange={setTheme}
        />
      </div>

      {/* Modals */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onAddTask={handleAddTask}
      />

      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        daysStats={daysStats}
      />

      <IntervalModal
        isOpen={intervalModalState.isOpen}
        onClose={() =>
          setIntervalModalState({ isOpen: false, task: null, interval: null })
        }
        taskDate={intervalModalState.task ? intervalModalState.task.date : selectedDate}
        interval={intervalModalState.interval}
        onSave={handleSaveInterval}
        onDelete={handleDeleteInterval}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title="Удалить выбранные задачи?"
        message={`Вы уверены, что хотите удалить ${selectedTaskIds.size} ${
          selectedTaskIds.size === 1
            ? 'выбранную задачу'
            : selectedTaskIds.size > 4
            ? 'выбранных задач'
            : 'выбранные задачи'
        } и всю связанную с ними историю времени? Это действие нельзя отменить.`}
        confirmText={`Удалить (${selectedTaskIds.size})`}
        onConfirm={handleBulkDelete}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
};

export default App;
