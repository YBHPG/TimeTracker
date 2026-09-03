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
import { ChevronRight, Plus, AlertCircle, ChevronLeft, Calendar as CalendarIcon, ListChecks, Trash2 } from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';

export const App: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [daysStats, setDaysStats] = useState<DayStatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch tasks for the selected date
  const loadTasks = useCallback(async (dateStr: string) => {
    try {
      setError(null);
      const data = await api.getTasks(dateStr);
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить задачи');
    }
  }, []);

  // Fetch all recorded days for calendar indicators
  const loadDaysStats = useCallback(async () => {
    try {
      const stats = await api.getDaysStats();
      setDaysStats(stats);
    } catch {
      // Non-critical
    }
  }, []);

  // Initial load and date change load
  useEffect(() => {
    setIsLoading(true);
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

  // Handlers
  const handleAddTask = async (title: string, autoStart: boolean, category: TaskCategory = 'work') => {
    try {
      setError(null);
      await api.createTask({
        title,
        date: selectedDate,
        category,
        auto_start: autoStart,
      });
      await Promise.all([loadTasks(selectedDate), loadDaysStats()]);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания задачи');
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
    try {
      await api.updateTask(taskId, { category: newCategory });
      await loadTasks(selectedDate);
    } catch (err: any) {
      setError(err.message || 'Ошибка смены категории');
    }
  };

  const handleStartTimer = async (taskId: string) => {
    try {
      await api.startTimer(taskId);
      await Promise.all([loadTasks(selectedDate), loadDaysStats()]);
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска таймера');
    }
  };

  const handlePauseTimer = async (taskId: string) => {
    try {
      await api.pauseTimer(taskId);
      await Promise.all([loadTasks(selectedDate), loadDaysStats()]);
    } catch (err: any) {
      setError(err.message || 'Ошибка остановки таймера');
    }
  };

  const handleUpdateTitle = async (taskId: string, newTitle: string) => {
    try {
      await api.updateTask(taskId, { title: newTitle });
      await loadTasks(selectedDate);
    } catch (err: any) {
      setError(err.message || 'Ошибка переименования задачи');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      await Promise.all([loadTasks(selectedDate), loadDaysStats()]);
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления задачи');
    }
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

    if (interval) {
      await api.updateInterval(interval.id, {
        start_time: startIso,
        end_time: endIso,
      });
    } else {
      await api.addInterval(task.id, {
        start_time: startIso,
        end_time: endIso,
      });
    }
    await Promise.all([loadTasks(selectedDate), loadDaysStats()]);
  };

  const handleDeleteInterval = async (intervalId: string) => {
    await api.deleteInterval(intervalId);
    await Promise.all([loadTasks(selectedDate), loadDaysStats()]);
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
    try {
      setError(null);
      await api.bulkDeleteTasks(Array.from(selectedTaskIds));
      setSelectedTaskIds(new Set());
      setIsSelectionMode(false);
      await Promise.all([loadTasks(selectedDate), loadDaysStats()]);
    } catch (err: any) {
      setError(err.message || 'Ошибка при совместном удалении задач');
    }
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
                    <p className="text-sm sm:text-base font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                      {getFormattedDayMonth(selectedDate)}
                    </p>
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
