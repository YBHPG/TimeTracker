import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { Theme } from '../hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onThemeChange }) => {
  return (
    <div className="flex items-center bg-slate-200/80 dark:bg-slate-800/80 p-0.5 rounded-lg text-slate-600 dark:text-slate-400 backdrop-blur-sm border border-slate-300/50 dark:border-slate-700/50">
      <button
        type="button"
        title="Светлая тема"
        onClick={() => onThemeChange('light')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'light'
            ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-sm'
            : 'hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        type="button"
        title="Системная тема"
        onClick={() => onThemeChange('system')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'system'
            ? 'bg-white dark:bg-slate-700 text-brand-500 shadow-sm'
            : 'hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Laptop className="w-4 h-4" />
      </button>
      <button
        type="button"
        title="Темная тема"
        onClick={() => onThemeChange('dark')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'dark'
            ? 'bg-white dark:bg-slate-700 text-sky-400 shadow-sm'
            : 'hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
};
