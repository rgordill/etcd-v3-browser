import { useState, useEffect } from 'react';

const DARK_CLASSES = ['pf-v6-theme-dark', 'pf-v5-theme-dark'];

function isDarkFromDOM(): boolean {
  return DARK_CLASSES.some((cls) => document.documentElement.classList.contains(cls));
}

/**
 * Read-only theme hook for console plugin mode.
 * Observes the <html> element for dark-mode classes set by the OpenShift console
 * without mutating the DOM itself.
 */
export function useConsoleTheme(): 'light' | 'dark' {
  const [effective, setEffective] = useState<'light' | 'dark'>(() =>
    isDarkFromDOM() ? 'dark' : 'light',
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setEffective(isDarkFromDOM() ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return effective;
}
