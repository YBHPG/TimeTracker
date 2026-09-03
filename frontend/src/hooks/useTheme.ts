import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    return saved || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && mediaQuery.matches);

      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }

      // Sync <meta name="color-scheme"> for browsers and extensions like Dark Reader
      let metaColorScheme = document.querySelector('meta[name="color-scheme"]');
      if (!metaColorScheme) {
        metaColorScheme = document.createElement('meta');
        metaColorScheme.setAttribute('name', 'color-scheme');
        document.head.appendChild(metaColorScheme);
      }
      metaColorScheme.setAttribute('content', isDark ? 'dark' : 'light');

      // Sync <meta name="darkreader-lock"> so Dark Reader doesn't invert native dark mode
      let darkreaderLock = document.querySelector('meta[name="darkreader-lock"]');
      if (isDark) {
        if (!darkreaderLock) {
          darkreaderLock = document.createElement('meta');
          darkreaderLock.setAttribute('name', 'darkreader-lock');
          document.head.appendChild(darkreaderLock);
        }
      } else {
        if (darkreaderLock) {
          darkreaderLock.remove();
        }
      }
    };

    applyTheme();
    localStorage.setItem('theme', theme);

    const listener = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  return { theme, setTheme };
}
