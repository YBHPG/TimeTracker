import React from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download } from 'lucide-react';
import { formatDatePretty, getTodayDateStr } from '../utils/formatters';
import { api } from '../api/client';

interface DateNavProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenCalendar: () => void;
}

export const DateNav: React.FC<DateNavProps> = ({
  selectedDate,
  onSelectDate,
  onOpenCalendar,
}) => {
  const currentDate = parseISO(selectedDate);
  const todayStr = getTodayDateStr();
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const goToPrevDay = () => {
    const prev = subDays(currentDate, 1);
    onSelectDate(format(prev, 'yyyy-MM-dd'));
  };

  const goToNextDay = () => {
    const next = addDays(currentDate, 1);
    onSelectDate(format(next, 'yyyy-MM-dd'));
  };

  const isToday = selectedDate === todayStr;
  const isYesterday = selectedDate === yesterdayStr;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white/70 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm">
      {/* Date display & Calendar Trigger */}
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
        <button
          type="button"
          onClick={onOpenCalendar}
          className="group flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 font-medium transition-all text-sm sm:text-base border border-slate-200/60 dark:border-slate-700/60"
        >
          <CalendarIcon className="w-4 h-4 text-brand-500 group-hover:scale-110 transition-transform" />
          <span>{formatDatePretty(selectedDate)}</span>
        </button>

        <a
          href={api.getExportCsvUrl(selectedDate, selectedDate)}
          download={`tasks_${selectedDate}.csv`}
          title="Экспорт задач за этот день в CSV"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>

      {/* Quick Nav Controls */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
        <button
          onClick={goToPrevDay}
          title="Предыдущий день"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectDate(yesterdayStr)}
          className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
            isYesterday
              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Вчера
        </button>

        <button
          onClick={() => onSelectDate(todayStr)}
          className={`px-3 py-1.5 text-xs font-medium rounded-xl transition ${
            isToday
              ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Сегодня
        </button>

        <button
          onClick={goToNextDay}
          title="Следующий день"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
