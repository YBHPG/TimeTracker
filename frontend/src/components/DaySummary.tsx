import { PieChart } from 'lucide-react';
import { Task } from '../types';
import {
  calculateTaskDurationSeconds,
  formatDurationHuman,
  formatDurationDigital,
} from '../utils/formatters';

interface DaySummaryProps {
  tasks: Task[];
  totalSeconds: number;
}

const COLORS = [
  'bg-sky-500',
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-purple-500',
  'bg-teal-500',
  'bg-orange-500',
];

export const DaySummary: React.FC<DaySummaryProps> = ({ tasks, totalSeconds }) => {
  if (tasks.length === 0 || totalSeconds === 0) return null;

  return (
    <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
          <PieChart className="w-4 h-4 text-brand-500" />
          <span>Распределение времени за день</span>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
          Итого: {formatDurationHuman(totalSeconds)}
        </span>
      </div>

      {/* Visual Multi-segment Progress Bar */}
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
              className={`h-full ${color} transition-all duration-300 hover:brightness-110 cursor-pointer`}
            />
          );
        })}
      </div>

      {/* Task Share List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {tasks.map((task, index) => {
          const taskSec = calculateTaskDurationSeconds(task);
          if (taskSec === 0) return null;
          const pct = Math.round((taskSec / totalSeconds) * 100);
          const color = COLORS[index % COLORS.length];

          return (
            <div
              key={task.id}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 font-mono text-slate-500 dark:text-slate-400">
                <span>{formatDurationDigital(taskSec)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-semibold">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
