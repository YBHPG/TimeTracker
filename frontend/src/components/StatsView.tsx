import React from 'react';
import { Task } from '../types';
import {
  calculateTaskDurationSeconds,
  formatDurationHuman,
  formatDurationDigital,
} from '../utils/formatters';
import { PieChart, Clock, ListChecks } from 'lucide-react';

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

export const StatsView: React.FC<StatsViewProps> = ({ tasks, totalSeconds }) => {
  const totalIntervals = tasks.reduce((sum, t) => sum + t.intervals.length, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#18181B] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Clock className="w-4 h-4" />
            <span>Всего за день</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {formatDurationDigital(totalSeconds)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {formatDurationHuman(totalSeconds)}
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

      {/* Progress Breakdown */}
      {totalSeconds > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-[#18181B] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-medium text-sm">
              <PieChart className="w-4 h-4 text-slate-500" />
              <span>Распределение времени</span>
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
