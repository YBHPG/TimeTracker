import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { getTodayDateStr, parseDateSafe } from '../utils/formatters';

interface TimelineStripProps {
  tasks: Task[];
  selectedDate: string;
  onSelectTask?: (taskId: string) => void;
  onHoverTask?: (taskId: string | null) => void;
}

export const TimelineStrip: React.FC<TimelineStripProps> = ({
  tasks,
  selectedDate,
  onSelectTask,
  onHoverTask,
}) => {
  const [hoveredBlock, setHoveredBlock] = useState<any | null>(null);
  const hoveredTaskId = hoveredBlock ? hoveredBlock.taskId : null;

  // Current time marker calculation (0 to 100% of 24h)
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPercent = Math.min(100, Math.max(0, (currentMinutes / (24 * 60)) * 100));

  const isToday = selectedDate === getTodayDateStr();

  // Compute intervals as percentage blocks across 24h (1440 minutes)
  const intervalBlocks = useMemo(() => {
    const blocks: Array<{
      id: string;
      taskId: string;
      taskTitle: string;
      leftPct: number;
      widthPct: number;
      pattern: 'solid' | 'hatched' | 'emerald';
      isRunning: boolean;
    }> = [];

    const patternTypes: Array<'solid' | 'hatched'> = ['solid', 'hatched'];

    tasks.forEach((task, taskIdx) => {
      const pattern = patternTypes[taskIdx % patternTypes.length];

      task.intervals.forEach((inv) => {
        try {
          const startDate = parseDateSafe(inv.start_time);
          const startMin = startDate.getHours() * 60 + startDate.getMinutes() + startDate.getSeconds() / 60;

          let endMin: number;
          let isRunning = false;
          if (inv.end_time) {
            const endDate = parseDateSafe(inv.end_time);
            endMin = endDate.getHours() * 60 + endDate.getMinutes() + endDate.getSeconds() / 60;
          } else {
            isRunning = true;
            endMin = isToday ? currentMinutes : 1440;
          }

          const left = Math.max(0, Math.min(100, (startMin / 1440) * 100));
          const right = Math.max(0, Math.min(100, (endMin / 1440) * 100));
          const width = Math.max(0.5, right - left);

          blocks.push({
            id: inv.id,
            taskId: task.id,
            taskTitle: task.title,
            leftPct: left,
            widthPct: width,
            pattern: isRunning ? 'emerald' : pattern,
            isRunning,
          });
        } catch {
          // ignore parsing error
        }
      });
    });

    return blocks;
  }, [tasks, currentMinutes, isToday]);

  return (
    <div className="w-full select-none pt-6 pb-2">
      {/* Main 24-hour Timeline Bar */}
      <div className="relative w-full">
        {/* Custom Hover Badge (Coral accent matching NOW pill, showing only task title) */}
        {hoveredBlock && (
          <div
            style={{
              left: `${Math.max(8, Math.min(92, hoveredBlock.leftPct + hoveredBlock.widthPct / 2))}%`,
            }}
            className="absolute -top-7 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="px-2.5 py-0.5 rounded-full bg-[#E0533C] text-white text-[10px] font-bold tracking-tight shadow-md whitespace-nowrap max-w-[220px] truncate">
              {hoveredBlock.taskTitle}
            </div>
            <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#E0533C]" />
          </div>
        )}

        {/* Baseline Bar Background */}
        <div className="relative h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded-sm overflow-hidden flex items-center">
          {/* Subtle 3-hour tick marks */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-30">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-full w-[1px] bg-slate-400 dark:bg-slate-600" />
            ))}
          </div>

          {/* Render Task Interval Blocks */}
          {intervalBlocks.map((b) => {
            const isSameTask = Boolean(hoveredTaskId && b.taskId === hoveredTaskId);
            const isOtherTask = Boolean(hoveredTaskId && b.taskId !== hoveredTaskId);

            let colorClasses = '';
            if (isSameTask) {
              // Entire fragment filled solidly with accent color #E0533C
              colorClasses = 'bg-[#E0533C] z-10 scale-y-110 shadow-sm';
            } else if (b.pattern === 'emerald') {
              colorClasses = 'bg-[#E0533C] animate-pulse';
            } else if (b.pattern === 'hatched') {
              colorClasses =
                'bg-slate-900 dark:bg-slate-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#64748b_2px,#64748b_4px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#94a3b8_2px,#94a3b8_4px)]';
            } else {
              colorClasses = 'bg-slate-900 dark:bg-slate-100';
            }

            return (
              <div
                key={b.id}
                onMouseEnter={() => {
                  setHoveredBlock(b);
                  if (onHoverTask) onHoverTask(b.taskId);
                }}
                onMouseLeave={() => {
                  setHoveredBlock(null);
                  if (onHoverTask) onHoverTask(null);
                }}
                onClick={() => onSelectTask && onSelectTask(b.taskId)}
                style={{
                  left: `${b.leftPct}%`,
                  width: `${b.widthPct}%`,
                }}
                className={`absolute top-0 bottom-0 cursor-pointer transition-all duration-150 ${colorClasses} ${
                  isOtherTask ? 'opacity-25' : 'opacity-100'
                }`}
              />
            );
          })}
        </div>

        {/* NOW Marker Badge */}
        {isToday && (
          <div
            style={{ left: `${nowPercent}%` }}
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 transition-all duration-500"
          >
            {/* Vertical Marker Line */}
            <div className="w-[1.5px] h-6 bg-slate-900 dark:bg-slate-100" />

            {/* Red/Coral NOW Capsule */}
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-[#E0533C] text-white text-[9px] font-bold tracking-wider shadow-sm uppercase">
              NOW
            </div>
          </div>
        )}
      </div>

      {/* Time indicators under strip with improved contrast */}
      <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400 font-mono mt-7 px-0.5">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
};
