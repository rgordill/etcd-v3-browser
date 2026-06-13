import { useState, useEffect, useCallback } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'etcd-browser-theme';
const DARK_CLASS = 'pf-v6-theme-dark';

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveEffective(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'auto') return getSystemPrefersDark() ? 'dark' : 'light';
  return choice;
}

function applyToDOM(effective: 'light' | 'dark') {
  const html = document.documentElement;
  if (effective === 'dark') {
    html.classList.add(DARK_CLASS);
  } else {
    html.classList.remove(DARK_CLASS);
  }
}

function loadSavedChoice(): ThemeChoice {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  return 'auto';
}

/**
 * Standalone theme hook — manages theme choice and applies it to the DOM.
 * Pass `disabled=true` to prevent DOM mutations (used in console plugin mode
 * where the host console owns the theme).
 */
export function useTheme(disabled = false) {
  const [choice, setChoiceState] = useState<ThemeChoice>(loadSavedChoice);
  const [effective, setEffective] = useState<'light' | 'dark'>(() =>
    resolveEffective(loadSavedChoice()),
  );

  const setChoice = useCallback((next: ThemeChoice) => {
    localStorage.setItem(STORAGE_KEY, next);
    setChoiceState(next);
    const eff = resolveEffective(next);
    setEffective(eff);
    if (!disabled) applyToDOM(eff);
  }, [disabled]);

  useEffect(() => {
    if (!disabled) applyToDOM(effective);
  }, [effective, disabled]);

  useEffect(() => {
    if (disabled || choice !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const eff = resolveEffective('auto');
      setEffective(eff);
      applyToDOM(eff);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [choice, disabled]);

  return { choice, effective, setChoice } as const;
}
