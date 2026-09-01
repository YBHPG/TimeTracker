import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { X, Trash2 } from 'lucide-react';
import { TimeInterval } from '../types';
import { Switch } from './Checkbox';

interface IntervalModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskDate: string; // YYYY-MM-DD
  interval?: TimeInterval | null; // null if adding new
  onSave: (startTimeIso: string, endTimeIso: string | null) => Promise<void>;
  onDelete?: (intervalId: string) => Promise<void>;
}

export const IntervalModal: React.FC<IntervalModalProps> = ({
  isOpen,
  onClose,
  taskDate,
  interval,
  onSave,
  onDelete,
}) => {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (interval) {
      try {
        const start = parseISO(interval.start_time);
        setStartTime(format(start, 'HH:mm'));

        if (interval.end_time) {
          const end = parseISO(interval.end_time);
          setEndTime(format(end, 'HH:mm'));
          setIsRunning(false);
        } else {
          setEndTime(format(new Date(), 'HH:mm'));
          setIsRunning(true);
        }
      } catch {
        setStartTime('09:00');
        setEndTime('10:00');
        setIsRunning(false);
      }
    } else {
      const now = new Date();
      const currentHM = format(now, 'HH:mm');
      setStartTime(currentHM);
      setEndTime(currentHM);
      setIsRunning(false);
    }
    setError(null);
  }, [interval, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const startDateTime = new Date(`${taskDate}T${startTime}:00`);
      let endDateTime: Date | null = null;

      if (!isRunning) {
        endDateTime = new Date(`${taskDate}T${endTime}:00`);
        if (endDateTime < startDateTime) {
          setError('Время окончания не может быть раньше времени начала');
          return;
        }
      }

      setIsSaving(true);
      await onSave(
        startDateTime.toISOString(),
        endDateTime ? endDateTime.toISOString() : null
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения интервала');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!interval || !onDelete) return;
    if (window.confirm('Удалить этот интервал?')) {
      setIsSaving(true);
      try {
        await onDelete(interval.id);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Ошибка при удалении');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {interval ? 'Редактировать период' : 'Добавить период'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Время начала (с)
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Время окончания (по)
              </label>
              <Switch
                checked={isRunning}
                onChange={setIsRunning}
                label="Идет сейчас"
              />
            </div>
            <input
              type="time"
              disabled={isRunning}
              required={!isRunning}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {interval && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="p-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-full transition"
                title="Удалить период"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 text-xs font-semibold rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 transition shadow-md disabled:opacity-50"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
