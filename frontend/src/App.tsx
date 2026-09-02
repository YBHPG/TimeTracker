import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from './api/client';
import { Task, TimeInterval, DayStatItem } from './types';
import { useTheme } from './hooks/useTheme';
import { useTimerTick } from './hooks/useTimerTick';
import { TimelineStrip } from './components/TimelineStrip';
import { TaskItem } from './components/TaskItem';
import { BottomNav } from './components/BottomNav';
import { NewTaskModal } from './components/NewTaskModal';
import { CalendarModal } from './components/CalendarModal';
import { IntervalModal } from './components/IntervalModal';
import { StatsView } from './components/StatsView';
import { Switch } from './components/Checkbox';
import {
  getTodayDateStr,
  getDayOfWeekName,
  getFormattedDayMonth,
  calculateTaskDurationSeconds,
  formatDurationDigital,
  formatDurationHuman,
  formatDatePretty,
} from './utils/formatters';
import { ChevronRight, Plus, AlertCircle, ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
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
  const [quickAutoStart, setQuickAutoStart] = useState(true);

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
  const handleAddTask = async (title: string, autoStart: boolean) => {
    try {
      setError(null);
      await api.createTask({
        title,
        date: selectedDate,
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
    await handleAddTask(trimmed, quickAutoStart);
    setQuickTitle('');
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

  const isTodaySelected = selectedDate === getTodayDateStr();

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#09090B] text-slate-900 dark:text-slate-100 flex flex-col justify-between items-center py-0 sm:py-6 lg:py-10 transition-colors duration-200">
      {/* Responsive Container: Phone card on mobile, wide 2-column dashboard on PC (lg) */}
      <div className="w-full max-w-md lg:max-w-6xl min-h-screen lg:min-h-[860px] bg-white dark:bg-[#121214] sm:rounded-[44px] lg:rounded-[48px] sm:shadow-2xl sm:border sm:border-slate-200/70 dark:sm:border-slate-800/80 flex flex-col relative overflow-hidden">
        
        {/* Error Notification */}
        {error && (
          <div className="m-4 flex items-center gap-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-600 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="font-bold underline">✕</button>
          </div>
        )}

        {/* Main Workspace Layout (Single column on Mobile, 2 Columns on Desktop) */}
        <div className="flex-1 p-6 sm:p-8 lg:p-10 pb-28 lg:pb-32 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* ======================================================== */}
            {/* LEFT COLUMN (Hero Clock, Date Header, Timeline Strip, Summary) */}
            {/* ======================================================== */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6 lg:border-r lg:border-slate-100 dark:lg:border-slate-800/80 lg:pr-10">
              {/* Top Date Header */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                      {getDayOfWeekName(selectedDate)}
                    </h1>
                    <p className="text-base sm:text-lg lg:text-xl font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                      {getFormattedDayMonth(selectedDate)}
                    </p>
                  </div>

                  {/* Date Navigation & Calendar Trigger */}
                  <div className="flex items-center gap-0.5 pt-1">
                    <button
                      type="button"
                      onClick={handlePrevDay}
                      title="Предыдущий день"
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleNextDay}
                      title="Следующий день"
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(true)}
                      title="Открыть календарь"
                      className="p-1.5 ml-1 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Hero Current Time Display */}
                <div className="mt-8 mb-4 text-center">
                  <div className="text-6xl sm:text-7xl lg:text-8xl font-light tracking-tight text-slate-900 dark:text-white font-sans">
                    {currentTimeStr}
                  </div>

                  {/* Active Timer Pill Badge (Eye-catching focal point during work) */}
                  {activeTask ? (
                    <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E0533C]/10 dark:bg-[#E0533C]/20 border border-[#E0533C]/30 text-[#E0533C] dark:text-[#ff745e] font-mono text-xs font-semibold shadow-sm animate-pulse-subtle">
                      <span className="w-2 h-2 rounded-full bg-[#E0533C] animate-ping flex-shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-[280px] font-sans font-medium text-slate-800 dark:text-slate-200">
                        {activeTask.title}:
                      </span>
                      <span className="font-bold">
                        {formatDurationDigital(calculateTaskDurationSeconds(activeTask))}
                      </span>
                    </div>
                  ) : null}

                  {/* 24-hour Visual Timeline Strip with NOW Badge */}
                  <div className="mt-3">
                    <TimelineStrip tasks={tasks} selectedDate={selectedDate} />
                  </div>
                </div>
              </div>

              {/* Day Overview Card for PC / Tablet */}
              <div className="hidden lg:block p-6 rounded-3xl bg-slate-50/90 dark:bg-[#18181B] border border-slate-200/80 dark:border-slate-800 space-y-4">
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
                    <div className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
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
                    onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                    className="px-3 py-1 text-xs rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                  >
                    Вчера
                  </button>
                  <button
                    onClick={() => setSelectedDate(getTodayDateStr())}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                      isTodaySelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Сегодня
                  </button>
                  <button
                    onClick={() => setIsCalendarOpen(true)}
                    className="px-3 py-1 text-xs rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition ml-auto"
                  >
                    Календарь
                  </button>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* RIGHT COLUMN (Tasks List & Stats View) */}
            {/* ======================================================== */}
            <div className="lg:col-span-7 flex flex-col justify-start">
              {activeTab === 'home' ? (
                <div>
                  {/* Section Header: "Today" and "+" Button */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800 mb-4">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {isTodaySelected ? 'Today' : formatDatePretty(selectedDate)}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {tasks.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNewTaskOpen(true)}
                      title="Добавить новую задачу"
                      className="p-1.5 text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Quick Inline Task Creator on PC */}
                  <form onSubmit={handleQuickAdd} className="hidden lg:flex items-center gap-3 mb-6 p-2 rounded-2xl bg-slate-50 dark:bg-[#18181B] border border-slate-200/80 dark:border-slate-800/80">
                    <input
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      placeholder="Быстро добавить задачу..."
                      className="flex-1 px-3.5 py-2 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
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
                      className="px-5 py-2 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold tracking-wide transition disabled:opacity-40 shadow-sm"
                    >
                      Создать
                    </button>
                  </form>

                  {/* Tasks List */}
                  {isLoading ? (
                    <div className="py-20 text-center text-slate-400">
                      <div className="inline-block w-6 h-6 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-xs">Загрузка задач...</p>
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="py-20 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
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
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {tasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onStart={handleStartTimer}
                          onPause={handlePauseTimer}
                          onUpdateTitle={handleUpdateTitle}
                          onDeleteTask={handleDeleteTask}
                          onOpenAddInterval={handleOpenAddInterval}
                          onEditInterval={handleEditInterval}
                          onDeleteInterval={handleDeleteInterval}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="py-2 border-b border-slate-200/80 dark:border-slate-800 mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Статистика за день
                    </h2>
                  </div>
                  <StatsView tasks={tasks} totalSeconds={totalDaySeconds} />
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
    </div>
  );
};

export default App;
