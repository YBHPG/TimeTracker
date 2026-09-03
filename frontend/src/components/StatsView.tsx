import React, { useMemo } from 'react';
import { Task, CATEGORIES, TaskCategory } from '../types';
import {
  calculateTaskDurationSeconds,
  formatDurationDigital,
} from '../utils/formatters';
import { PieChart, Clock, ListChecks, Layers, Briefcase, User, GraduationCap } from 'lucide-react';

interface StatsViewProps {
  tasks: Task[];
  totalSeconds: number;
}

const COLORS = [
  'bg-slate-900 dark:bg-white',
  'bg-slate-600 dark:bg-slate-300',
  'bg-slate-400 dark:bg-slate-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
];

const CATEGORY_ICONS: Record<TaskCategory, React.FC<{ className?: string }>> = {
  work: Briefcase,
  personal: User,
  study: GraduationCap,
};

export const StatsView: React.FC<StatsViewProps> = ({ tasks, totalSeconds }) => {
  const totalIntervals = tasks.reduce((sum, t) => sum + t.intervals.length, 0);

  // Group stats by category
  const categoryStats = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catTasks = tasks.filter((t) => (t.category || 'work') === cat.id);
      const catSeconds = catTasks.reduce((sum, t) => sum + calculateTaskDurationSeconds(t), 0);
      const percentage = totalSeconds > 0 ? Math.round((catSeconds / totalSeconds) * 100) : 0;
      return {
        ...cat,
        tasksCount: catTasks.length,
        seconds: catSeconds,
        percentage,
        Icon: CATEGORY_ICONS[cat.id],
      };
    });
  }, [tasks, totalSeconds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#18181B] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Clock className="w-4 h-4" />
            <span>Всего за день</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {formatDurationDigital(totalSeconds)}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#18181B] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <ListChecks className="w-4 h-4" />
            <span>Активность</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {tasks.length} <span className="text-sm font-normal text-slate-400">задач</span>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {totalIntervals} записанных периодов
          </div>
        </div>
      </div>

      {/* Category Breakdown (Новая отдельная статистика) */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#18181B] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
            <Layers className="w-4 h-4 text-brand-500" />
            <span>Статистика по категориям</span>
          </div>
        </div>

        {/* Multi-segment Category Bar */}
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
          {categoryStats.map((cat) => {
            if (cat.seconds === 0) return null;
            const pct = Math.max(1, (cat.seconds / (totalSeconds || 1)) * 100);
            return (
              <div
                key={cat.id}
                style={{ width: `${pct}%`, backgroundColor: cat.color }}
                title={`${cat.label}: ${formatDurationDigital(cat.seconds)} (${Math.round(pct)}%)`}
                className="h-full transition-all duration-300"
              />
            );
          })}
        </div>

        {/* Category Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {categoryStats.map((cat) => {
            const Icon = cat.Icon;
            return (
              <div
                key={cat.id}
                className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {cat.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300">
                    {cat.percentage}%
                  </span>
                </div>

                <div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    {formatDurationDigital(cat.seconds)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{cat.tasksCount} {cat.tasksCount === 1 ? 'задача' : cat.tasksCount > 4 ? 'задач' : 'задачи'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task-by-Task Time Breakdown */}
      {totalSeconds > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-[#18181B] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium text-sm">
              <PieChart className="w-4 h-4 text-slate-500" />
              <span>Распределение по задачам</span>
            </div>
          </div>

          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
            {tasks.map((task, index) => {
              const taskSec = calculateTaskDurationSeconds(task);
              if (taskSec === 0) return null;
              const pct = Math.max(1, (taskSec / totalSeconds) * 100);
              const color = COLORS[index % COLORS.length];

              return (
                <div
                  key={task.id}
                  style={{ width: `${pct}%` }}
                  title={`${task.title}: ${formatDurationDigital(taskSec)} (${Math.round(pct)}%)`}
                  className={`h-full ${color} transition-all duration-300`}
                />
              );
            })}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-1">
            {tasks.map((task, index) => {
              const taskSec = calculateTaskDurationSeconds(task);
              if (taskSec === 0) return null;
              const pct = Math.round((taskSec / totalSeconds) * 100);
              const color = COLORS[index % COLORS.length];
              const cat = CATEGORIES.find((c) => c.id === task.category) || CATEGORIES[0];

              return (
                <div
                  key={task.id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {task.title}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded font-medium flex-shrink-0"
                      style={{ color: cat.color, backgroundColor: `${cat.color}15` }}
                    >
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 font-mono text-slate-500 dark:text-slate-400">
                    <span>{formatDurationDigital(taskSec)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
