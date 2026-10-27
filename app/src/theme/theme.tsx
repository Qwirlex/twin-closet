import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { readSetting, writeSetting } from '@/lib/storage';

import { PALETTES, type Palette } from './tokens';

/** Выбор в Me › Appearance; по умолчанию тёмная */
export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeValue {
  t: Palette;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const KEY = 'twin.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = readSetting(KEY);
    return saved === 'light' || saved === 'system' ? saved : 'dark';
  });
  const scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;

  const value = useMemo<ThemeValue>(() => {
    const setMode = (next: ThemeMode) => {
      setModeState(next);
      writeSetting(KEY, next);
    };
    return { t: PALETTES[scheme], mode, setMode, toggle: () => setMode(scheme === 'dark' ? 'light' : 'dark') };
  }, [mode, scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme вне ThemeProvider');
  return value;
}
