import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';

export type Accent = 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'rose' | 'teal';
export type Theme = 'light' | 'dark' | 'auto';
export type Accent = 'blue' | 'green' | 'purple' | 'orange' | 'rose' | 'teal';
export type FontSize = 'small' | 'normal' | 'large' | 'xlarge';

export interface Settings {
  theme: Theme;
  accent: Accent;
  fontSize: FontSize;
}

const DEFAULTS: Settings = {
  theme: 'auto',
  accent: 'blue',
  fontSize: 'normal',
};

const STORAGE_KEY = 'ndt:user-settings';

interface SettingsContextType {
  settings: Settings;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  updateSettings: (partial: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function loadFromLocal(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function applyToDOM(settings: Settings) {
  const html = document.documentElement;

  const sizeMap: Record<FontSize, string> = {
    small: '87.5%',
    normal: '100%',
    large: '112.5%',
    xlarge: '125%',
  };
  html.style.fontSize = sizeMap[settings.fontSize] || '100%';

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  html.classList.toggle('theme-dark', isDark);

  html.setAttribute('data-accent', settings.accent);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadFromLocal());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);

  // Aplica al DOM antes del primer paint (evita flash)
  useLayoutEffect(() => {
    applyToDOM(settings);
  }, [settings]);

  // Re-aplica cuando cambia el tema del sistema (solo en modo auto)
  useEffect(() => {
    if (settings.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyToDOM(settings);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings]);

  // Carga desde Supabase al iniciar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) {
          setLoaded(true);
          return;
        }

        const { data, error } = await supabase
          .from('user_settings')
          .select('theme, accent, font_size')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (data && !error) {
          const remote: Settings = {
            theme: (data.theme as Theme) || DEFAULTS.theme,
            accent: (data.accent as Accent) || DEFAULTS.accent,
            fontSize: (data.font_size as FontSize) || DEFAULTS.fontSize,
          };
          setSettings(remote);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
        }
      } catch (e) {
        console.warn('No se pudo cargar configuración remota', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Guarda cuando cambian los ajustes (local inmediato + Supabase con debounce)
  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    const timeout = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setSaveStatus('idle');
          return;
        }

        const { error } = await supabase.from('user_settings').upsert(
          {
            user_id: user.id,
            theme: settings.theme,
            accent: settings.accent,
            font_size: settings.fontSize,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.warn('No se pudo guardar configuración remota', e);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [settings, loaded]);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, saveStatus, updateSettings, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}