import { createContext, useContext } from 'react';

export type EffectiveTheme = 'light' | 'dark';

export const ThemeContext = createContext<EffectiveTheme>('light');

export function useEffectiveTheme(): EffectiveTheme {
  return useContext(ThemeContext);
}
