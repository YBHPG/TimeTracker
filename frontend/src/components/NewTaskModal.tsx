import React, { useState, useEffect } from 'react';
import { X, Play, Plus } from 'lucide-react';
import { Switch } from './Checkbox';
import { TaskCategory, CATEGORIES } from '../types';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (title: string, autoStart: boolean, category: TaskCategory) => Promise<void>;
  isLoading?: boolean;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('work');
  const [autoStart, setAutoStart] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddTask(trimmed, autoStart, category);
      setTitle('');
      setCategory('work');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-title"
        className="w-full max-w-md bg-white dark:bg-[#18181B] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-5 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="new-task-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Новая задача
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно создания задачи"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Название задачи
            </label>
            <input
              type="text"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Conduct product research..."
              className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition"
            />
          </div>

          <div>
            <label id="category-group-label" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Категория
            </label>
            <div role="radiogroup" aria-labelledby="category-group-label" className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="radio"
                  aria-checked={category === cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] ${
                    category === cat.id
                      ? 'border-slate-900 dark:border-white bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-semibold'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cat.dotBg} flex-shrink-0`} />
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="py-1">
            <Switch
              checked={autoStart}
              onChange={setAutoStart}
              label={
                <span className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-current text-emerald-500" />
                  <span>Сразу запустить таймер</span>
                </span>
              }
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting || isLoading}
              className="flex items-center justify-center min-w-[105px] px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold tracking-wide transition shadow-md disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C] focus-visible:ring-offset-2"
            >
              <span
                key={autoStart ? 'start' : 'create'}
                className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
              >
                {autoStart ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400 dark:text-emerald-500" />
                    <span>Начать</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Создать</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
