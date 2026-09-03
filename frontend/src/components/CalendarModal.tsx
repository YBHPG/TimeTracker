import React, { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DayStatItem } from '../types';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  daysStats: DayStatItem[];
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  daysStats,
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const statsMap = new Map<string, DayStatItem>();
  daysStats.forEach((stat) => {
    statsMap.set(stat.date, stat);
  });

  const selectedDateTime = parseISO(selectedDate);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onSelectDate(format(today, 'yyyy-MM-dd'));
    onClose();
  };

  const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
        className="w-full max-w-md bg-white dark:bg-[#18181B] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="calendar-modal-title" className="text-xl font-bold capitalize text-slate-900 dark:text-white">
              {format(currentMonth, 'LLLL yyyy', { locale: ru })}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Выберите дату для просмотра истории
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Предыдущий месяц"
              title="Предыдущий месяц"
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Следующий месяц"
              title="Следующий месяц"
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть календарь"
              className="p-2 ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 gap-1 pt-2 text-center">
          {weekDayNames.map((d, i) => (
            <div
              key={d}
              className={`text-xs font-semibold uppercase tracking-wider ${
                i >= 5 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div role="grid" aria-label="Сетка дней" className="grid grid-cols-7 gap-1 pt-1 pb-2">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isSelected = isSameDay(day, selectedDateTime);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDay = isSameDay(day, new Date());
            const dayStat = statsMap.get(dateKey);
            const dateLabel = format(day, 'd MMMM yyyy', { locale: ru });
            const durationText = dayStat && dayStat.total_seconds > 0 ? `, ${Math.round(dayStat.total_seconds / 3600 * 10) / 10} ч` : '';

            return (
              <button
                key={dateKey}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-current={isTodayDay ? 'date' : undefined}
                aria-label={`${dateLabel}${durationText}${isSelected ? ', выбрано' : ''}`}
                onClick={() => {
                  onSelectDate(dateKey);
                  onClose();
                }}
                className={`relative flex flex-col items-center justify-center h-12 rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-md'
                    : isTodayDay
                    ? 'border border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
                    : isCurrentMonth
                    ? 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <span className="text-sm">{format(day, 'd')}</span>
                {dayStat && dayStat.total_seconds > 0 && (
                  <span
                    className={`text-[8px] px-1 rounded-full font-mono mt-0.5 ${
                      isSelected
                        ? 'text-slate-300 dark:text-slate-700 font-semibold'
                        : dayStat.has_active_task
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {Math.round(dayStat.total_seconds / 3600 * 10) / 10}ч
                  </span>
                )}
                {dayStat && dayStat.has_active_task && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <button
            type="button"
            onClick={goToToday}
            className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
          >
            К сегодняшнему дню
          </button>
          <span>Дней с записями: {daysStats.length}</span>
        </div>
      </div>
    </div>
  );
};
