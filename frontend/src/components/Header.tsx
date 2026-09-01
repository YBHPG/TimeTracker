import React from 'react';
import { Timer, Activity } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Theme } from '../hooks/useTheme';
import { formatDurationDigital } from '../utils/formatters';

interface HeaderProps {
  totalDaySeconds: number;
  hasActiveTask: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalDaySeconds,
  hasActiveTask,
  theme,
  onThemeChange,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & App title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
              TimeTracker
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Учет времени задач
            </p>
          </div>
        </div>

        {/* Total Day Timer & Theme Toggle */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Day Total Badge */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all ${
              hasActiveTask
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
            }`}
          >
            {hasActiveTask ? (
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            ) : (
              <Timer className="w-4 h-4 text-slate-400" />
            )}
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
                За день:
              </span>
              <span className="font-mono font-bold text-sm sm:text-base">
                {formatDurationDigital(totalDaySeconds)}
              </span>
            </div>
          </div>

          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
        </div>
      </div>
    </header>
  );
};
