import React, { useState } from 'react';
import { Plus, Play } from 'lucide-react';

interface NewTaskFormProps {
  onAddTask: (title: string, autoStart: boolean) => Promise<void>;
  isLoading?: boolean;
}

export const NewTaskForm: React.FC<NewTaskFormProps> = ({ onAddTask, isLoading = false }) => {
  const [title, setTitle] = useState('');
  const [autoStart, setAutoStart] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isLoading) return;

    await onAddTask(trimmed, autoStart);
    setTitle('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500"
    >
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Что вы сейчас делаете? Введите название задачи..."
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-sm transition"
          />
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-start">
          <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
            />
            <span className="flex items-center gap-1 font-medium">
              <Play className="w-3 h-3 fill-current text-emerald-500" />
              Автостарт
            </span>
          </label>

          <button
            type="submit"
            disabled={!title.trim() || isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white font-medium text-sm transition shadow-sm shadow-brand-500/25 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none"
          >
            <Plus className="w-4 h-4" />
            <span>Создать</span>
          </button>
        </div>
      </div>
    </form>
  );
};
