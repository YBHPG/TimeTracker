import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { TimeInterval } from '../types';
import {
  formatTimeHM,
  calculateIntervalDurationSeconds,
  formatDurationHuman,
} from '../utils/formatters';

interface IntervalItemProps {
  interval: TimeInterval;
  onEdit: (interval: TimeInterval) => void;
  onDelete: (intervalId: string) => void;
}

export const IntervalItem: React.FC<IntervalItemProps> = ({
  interval,
  onEdit,
  onDelete,
}) => {
  const isRunning = interval.end_time === null;
  const durationSec = calculateIntervalDurationSeconds(interval);

  const startTimeStr = formatTimeHM(interval.start_time);
  const endTimeStr = interval.end_time ? formatTimeHM(interval.end_time) : null;

  return (
    <li className="group flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition text-xs sm:text-sm">
      {/* Bullet + Interval Text */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isRunning ? 'bg-emerald-500 animate-ping' : 'bg-slate-400 dark:bg-slate-600'
          }`}
        />
        <div className="flex items-baseline gap-1.5 truncate">
          <span className="text-slate-700 dark:text-slate-300">
            с <span className="font-mono font-medium">{startTimeStr}</span>
            {isRunning ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">
                (идет...)
              </span>
            ) : (
              <>
                {' '}по <span className="font-mono font-medium">{endTimeStr}</span>
              </>
            )}
          </span>

          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            ({formatDurationHuman(durationSec)})
          </span>
        </div>
      </div>

      {/* Action Buttons on Hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-0 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onEdit(interval)}
          aria-label="Редактировать интервал"
          title="Редактировать интервал"
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(interval.id)}
          aria-label="Удалить интервал"
          title="Удалить интервал"
          className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
};
