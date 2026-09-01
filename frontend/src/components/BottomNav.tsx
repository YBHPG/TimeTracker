import React from 'react';
import { Sun, Moon, Laptop, Calendar as CalendarIcon, Download } from 'lucide-react';
import { Theme } from '../hooks/useTheme';
import { api } from '../api/client';

interface BottomNavProps {
  activeTab: 'home' | 'stats';
  onTabChange: (tab: 'home' | 'stats') => void;
  onOpenCalendar: () => void;
  selectedDate: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenCalendar,
  selectedDate,
  theme,
  onThemeChange,
}) => {
  const toggleTheme = () => {
    if (theme === 'system') onThemeChange('dark');
    else if (theme === 'dark') onThemeChange('light');
    else onThemeChange('system');
  };

  const getThemeTitle = () => {
    if (theme === 'system') return 'Тема: Системная (авто)';
    if (theme === 'dark') return 'Тема: Темная';
    return 'Тема: Светлая';
  };

  return (
    <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-1 bg-[#121214] dark:bg-white text-white dark:text-slate-900 p-1.5 rounded-full shadow-2xl border border-slate-800/40 dark:border-slate-200/40 backdrop-blur-lg transition-all duration-300">
        {/* Home Tab Button */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'home'
              ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-md'
              : 'text-slate-300 dark:text-slate-600 hover:text-white dark:hover:text-black'
          }`}
        >
          Home
        </button>

        {/* Stats / Mypage Tab Button */}
        <button
          type="button"
          onClick={() => onTabChange('stats')}
          className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'stats'
              ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-md'
              : 'text-slate-300 dark:text-slate-600 hover:text-white dark:hover:text-black'
          }`}
        >
          Stats
        </button>

        {/* Divider */}
        <div className="h-4 w-[1px] bg-slate-700 dark:bg-slate-300 mx-1" />

        {/* Calendar Trigger */}
        <button
          type="button"
          onClick={onOpenCalendar}
          title="Открыть календарь"
          className="p-2 text-slate-300 dark:text-slate-600 hover:text-white dark:hover:text-black rounded-full hover:bg-white/10 dark:hover:bg-slate-900/10 transition"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>

        {/* Theme Toggle (System / Dark / Light) */}
        <button
          type="button"
          onClick={toggleTheme}
          title={getThemeTitle()}
          className="p-2 text-slate-300 dark:text-slate-600 hover:text-white dark:hover:text-black rounded-full hover:bg-white/10 dark:hover:bg-slate-900/10 transition flex items-center justify-center"
        >
          {theme === 'system' ? (
            <Laptop className="w-4 h-4 text-sky-400 dark:text-sky-600" />
          ) : theme === 'dark' ? (
            <Moon className="w-4 h-4 text-indigo-300 dark:text-indigo-600" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400 dark:text-amber-500" />
          )}
        </button>

        {/* CSV Export */}
        <a
          href={api.getExportCsvUrl(selectedDate, selectedDate)}
          download={`tasks_${selectedDate}.csv`}
          title="Экспорт в CSV"
          className="p-2 text-slate-300 dark:text-slate-600 hover:text-white dark:hover:text-black rounded-full hover:bg-white/10 dark:hover:bg-slate-900/10 transition"
        >
          <Download className="w-4 h-4" />
        </a>
      </nav>
    </div>
  );
};
