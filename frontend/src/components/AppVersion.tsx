import React, { useEffect, useState } from 'react';

/**
 * Shows the build id of the running frontend (dist/build.txt, stamped by the vite
 * `stamp-sw` plugin) and of the backend (X-Tracker-Version from /api/health).
 * This is how a user can tell by eye that an update actually applied.
 */
export const AppVersion: React.FC = () => {
  const [frontend, setFrontend] = useState('');
  const [backend, setBackend] = useState('');

  useEffect(() => {
    let alive = true;

    fetch('/build.txt', { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (alive) setFrontend(text.trim());
      })
      .catch(() => {});

    fetch('/api/health', { cache: 'no-store', redirect: 'manual' })
      .then((r) =>
        r.type === 'opaqueredirect' || r.status === 0
          ? ''
          : r.headers.get('x-tracker-version') || '',
      )
      .then((version) => {
        if (alive) setBackend(version);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  if (!frontend && !backend) return null;

  return (
    <div
      className="pt-2 mt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center"
      title="Версия интерфейса и API"
    >
      UI {frontend || '—'} · API {backend || '—'}
    </div>
  );
};
