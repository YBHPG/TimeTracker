import React from 'react';
import { RefreshCw, LogIn } from 'lucide-react';

interface PwaBannerProps {
  updateAvailable: boolean;
  sessionExpired: boolean;
  onUpdate: () => void;
  onDismissUpdate: () => void;
  onLogin: () => void;
}

export const PwaBanner: React.FC<PwaBannerProps> = ({
  updateAvailable,
  sessionExpired,
  onUpdate,
  onDismissUpdate,
  onLogin,
}) => {
  if (!updateAvailable && !sessionExpired) return null;

  // An expired session blocks everything, so it wins over the update prompt.
  const showSession = sessionExpired;

  return (
    <div className="fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px)+3.5rem)] z-50 flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-2 max-w-md w-full sm:w-auto bg-[#121214] dark:bg-white text-white dark:text-slate-900 pl-3.5 pr-1.5 py-1.5 rounded-2xl shadow-2xl border border-slate-800/40 dark:border-slate-200/40 backdrop-blur-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        {showSession ? (
          <LogIn className="w-4 h-4 flex-shrink-0 text-amber-400 dark:text-amber-500" />
        ) : (
          <RefreshCw className="w-4 h-4 flex-shrink-0 text-amber-400 dark:text-amber-500" />
        )}

        <span className="flex-1 text-xs font-medium whitespace-nowrap">
          {showSession ? 'Сессия истекла' : 'Вышла новая версия'}
        </span>

        <button
          type="button"
          onClick={showSession ? onLogin : onUpdate}
          className="h-11 px-4 inline-flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-semibold tracking-wide transition flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {showSession ? 'Войти' : 'Обновить'}
        </button>

        {!showSession && (
          <button
            type="button"
            onClick={onDismissUpdate}
            className="h-11 px-3 inline-flex items-center justify-center rounded-xl text-xs font-medium text-slate-400 hover:text-white dark:text-slate-500 dark:hover:text-slate-900 transition flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0533C]"
          >
            Позже
          </button>
        )}
      </div>
    </div>
  );
};
