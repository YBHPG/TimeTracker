import React, { useState } from 'react';
import { Play, Pause, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Task, TimeInterval } from '../types';
import { IntervalItem } from './IntervalItem';
import { calculateTaskDurationSeconds, formatDurationDigital, formatDurationHuman } from '../utils/formatters';

interface TaskItemProps {
  task: Task;
  onStart: (taskId: string) => Promise<void>;
  onPause: (taskId: string) => Promise<void>;
  onUpdateTitle: (taskId: string, newTitle: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onOpenAddInterval: (task: Task) => void;
  onEditInterval: (task: Task, interval: TimeInterval) => void;
  onDeleteInterval: (intervalId: string) => Promise<void>;
}

export const TaskItem: React.FC<TaskItemProps> = ({
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
  const [isExpanded, setIsExpanded] = useState(false);

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

  const handleToggleTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <div className={`border-b border-slate-200/70 dark:border-slate-800/80 transition-all ${isRunning ? 'bg-[#E0533C]/[0.03] dark:bg-[#E0533C]/[0.07] -mx-2 px-2 rounded-2xl' : ''}`}>
      {/* Main Row Matching Design */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="group py-4 px-1.5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded-2xl transition-colors"
      >
        {/* Left Column: Title & Pill Tag */}
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                autoFocus
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isUpdating}
                className="w-full px-3 py-1.5 text-base font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E0533C]"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditedTitle(task.title);
                  setIsEditingTitle(false);
                }}
                className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-base sm:text-lg leading-snug tracking-tight truncate ${
                isRunning
                  ? 'text-slate-950 dark:text-white font-bold'
                  : 'text-slate-900 dark:text-slate-100'
              }`}>
                {task.title}
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                className="p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 dark:hover:text-slate-200 transition"
                title="Переименовать"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pill Tags with Signature Coral Accent when active */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                isRunning
                  ? 'bg-[#E0533C] text-white border-transparent shadow-sm shadow-[#E0533C]/30'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60'
              }`}
            >
              {durationSec > 0 ? formatDurationHuman(durationSec) : '0 мин'}
            </span>

            {isRunning && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E0533C]/15 text-[#E0533C] dark:bg-[#E0533C]/25 dark:text-[#ff745e] border border-[#E0533C]/30">
                <span className="w-2 h-2 rounded-full bg-[#E0533C] animate-ping" />
                Идет запись
              </span>
            )}

            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-0.5 ml-0.5">
              {task.intervals.length}{' '}
              {task.intervals.length === 1 ? 'период' : task.intervals.length > 4 ? 'периодов' : 'периода'}
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
            </span>
          </div>
        </div>

        {/* Right Column: Rounded Square Control Button with Coral Accent when active */}
        <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
          <button
            type="button"
            onClick={handleToggleTimer}
            disabled={isUpdating}
            title={isRunning ? 'Поставить на паузу' : 'Запустить таймер'}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ${
              isRunning
                ? 'bg-[#E0533C] hover:bg-[#c94530] text-white shadow-lg shadow-[#E0533C]/30 scale-105 ring-2 ring-[#E0533C]/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isRunning ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Section: Unnumbered Intervals List */}
      {isExpanded && (
        <div className="pb-4 pt-1 px-3 bg-slate-100/70 dark:bg-[#18181B] rounded-2xl mb-3 border border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Список периодов
            </span>
            <button
              type="button"
              onClick={() => onOpenAddInterval(task)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white hover:text-[#E0533C] dark:hover:text-[#ff745e] px-2 py-0.5 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить период</span>
            </button>
          </div>

          {task.intervals.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2 italic">
              Нет записанных периодов. Нажмите кнопку справа, чтобы начать.
            </p>
          ) : (
            <ul className="space-y-1">
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

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
              Суммарно: {formatDurationDigital(durationSec)}
            </span>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition px-2 py-1 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить карточку</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
