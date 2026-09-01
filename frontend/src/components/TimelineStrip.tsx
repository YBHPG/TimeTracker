import React, { useMemo } from 'react';
import { Task } from '../types';
import { getTodayDateStr, parseDateSafe } from '../utils/formatters';

interface TimelineStripProps {
  tasks: Task[];
  selectedDate: string;
}

export const TimelineStrip: React.FC<TimelineStripProps> = ({ tasks, selectedDate }) => {
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

  // Decorative activity constellation dots above timeline
  const dots = useMemo(() => {
    // Generate static dot positions based on task blocks
    const dotList: Array<{ left: number; top: number; size: number }> = [];
    
    // Default decorative aesthetic dots
    const basePositions = [
      { x: 42, y: 12, s: 3 },
      { x: 45, y: 22, s: 2.5 },
      { x: 48, y: 14, s: 3 },
      { x: 58, y: 18, s: 2 },
      { x: 64, y: 16, s: 3 },
      { x: 67, y: 24, s: 2.5 },
      { x: 70, y: 15, s: 3 },
    ];

    basePositions.forEach((p) => {
      dotList.push({ left: p.x, top: p.y, size: p.s });
    });

    return dotList;
  }, []);

  return (
    <div className="w-full select-none py-2">
      {/* Activity Dots Area */}
      <div className="relative h-7 w-full overflow-hidden">
        {dots.map((d, i) => (
          <span
            key={i}
            style={{
              left: `${d.left}%`,
              top: `${d.top}px`,
              width: `${d.size}px`,
              height: `${d.size}px`,
            }}
            className="absolute rounded-full bg-slate-900 dark:bg-slate-100 transition-all opacity-80"
          />
        ))}
      </div>

      {/* Main 24-hour Timeline Bar */}
      <div className="relative w-full">
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
            return (
              <div
                key={b.id}
                title={`${b.taskTitle} (${b.isRunning ? 'Идет сейчас' : 'Завершено'})`}
                style={{
                  left: `${b.leftPct}%`,
                  width: `${b.widthPct}%`,
                }}
                className={`absolute top-0 bottom-0 transition-all ${
                  b.pattern === 'emerald'
                    ? 'bg-[#E0533C] animate-pulse'
                    : b.pattern === 'hatched'
                    ? 'bg-slate-900 dark:bg-slate-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#64748b_2px,#64748b_4px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#94a3b8_2px,#94a3b8_4px)]'
                    : 'bg-slate-900 dark:bg-slate-100'
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
