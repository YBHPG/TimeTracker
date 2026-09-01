import React, { useState } from 'react';
import { Play, Pause, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Task, TimeInterval } from '../types';
import { IntervalItem } from './IntervalItem';
import { calculateTaskDurationSeconds, formatDurationDigital, formatDurationHuman } from '../utils/formatters';

interface TaskCardProps {
  task: Task;
  onStart: (taskId: string) => Promise<void>;
  onPause: (taskId: string) => Promise<void>;
  onUpdateTitle: (taskId: string, newTitle: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onOpenAddInterval: (task: Task) => void;
  onEditInterval: (task: Task, interval: TimeInterval) => void;
  onDeleteInterval: (intervalId: string) => Promise<void>;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStart,
  onPause,
  onUpdateTitle,
  onDeleteTask,
  onOpenAddInterval,
  onEditInterval,
  onDeleteInterval,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [isUpdating, setIsUpdating] = useState(false);

  const durationSec = calculateTaskDurationSeconds(task);
  const isRunning = task.is_active;

  const handleSaveTitle = async () => {
    const trimmed = editedTitle.trim();
    if (!trimmed || trimmed === task.title) {
      setIsEditingTitle(false);
      setEditedTitle(task.title);
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdateTitle(task.id, trimmed);
      setIsEditingTitle(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') {
      setEditedTitle(task.title);
      setIsEditingTitle(false);
    }
  };

  const handleToggleTimer = async () => {
    setIsUpdating(true);
    try {
      if (isRunning) {
        await onPause(task.id);
      } else {
        await onStart(task.id);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Удалить задачу "${task.title}" и всю историю времени?`)) {
      setIsUpdating(true);
      try {
        await onDeleteTask(task.id);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  return (
    <div
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
        isRunning
          ? 'border-emerald-500/80 dark:border-emerald-500/70 ring-2 ring-emerald-500/20'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Top Banner Accent when active */}
      {isRunning && (
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse-subtle" />
      )}

      <div className="p-4 sm:p-5">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Title Area */}
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isUpdating}
                  className="w-full px-2.5 py-1 text-base font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-brand-500 text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditedTitle(task.title);
                    setIsEditingTitle(false);
                  }}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title">
                <h3
                  onClick={() => setIsEditingTitle(true)}
                  className="font-semibold text-base sm:text-lg text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 transition"
                  title="Нажмите для переименования"
                >
                  {task.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 text-slate-400 opacity-0 group-hover/title:opacity-100 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
                  title="Переименовать"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Subtitle / summary info */}
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                  isRunning
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {isRunning ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Активно
                  </>
                ) : (
                  'На паузе'
                )}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Периодов: {task.intervals.length}
              </span>
            </div>
          </div>

          {/* Timer Display & Play/Pause Controls */}
          <div className="flex items-center gap-2">
            {/* Total Duration for this task */}
            <div className="text-right">
              <div
                className={`font-mono text-lg sm:text-xl font-bold tracking-tight ${
                  isRunning
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {formatDurationDigital(durationSec)}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                {formatDurationHuman(durationSec)}
              </div>
            </div>

            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={handleToggleTimer}
              disabled={isUpdating}
              title={isRunning ? 'Поставить на паузу' : 'Запустить таймер'}
              className={`p-3 rounded-2xl transition-all shadow-sm flex items-center justify-center ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 active:scale-95'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95'
              }`}
            >
              {isRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
          </div>
        </div>

        {/* Intervals Section (Unnumbered list) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Периоды времени
            </span>
            <button
              type="button"
              onClick={() => onOpenAddInterval(task)}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/40 px-2 py-0.5 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить</span>
            </button>
          </div>

          {task.intervals.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-600 py-1.5 italic">
              Нет записанных периодов. Нажмите «Старт» для запуска таймера.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {task.intervals.map((inv) => (
                <IntervalItem
                  key={inv.id}
                  interval={inv}
                  onEdit={(invToEdit) => onEditInterval(task, invToEdit)}
                  onDelete={onDeleteInterval}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Card Footer / Actions */}
        <div className="flex items-center justify-end pt-2 mt-2 border-t border-slate-50 dark:border-slate-800/40 opacity-40 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleDelete}
            title="Удалить карточку"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition px-2 py-1 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Удалить задачу</span>
          </button>
        </div>
      </div>
    </div>
  );
};
