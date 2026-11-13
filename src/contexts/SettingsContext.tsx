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

export type Theme = 'light' | 'dark' | 'auto';
export type FontSize = 'small' | 'normal' | 'large' | 'xlarge';

export type Accent =
  | 'blue'    // Granate  #780029
  | 'rose'    // Burdeos  #A6002E
  | 'red'     // Rojo     #D7192D
  | 'orange'  // Naranja  #F68400
  | 'green'   // Menta    #4BC59C
  | 'teal'    // Cian     #97E1E1
  | 'purple'  // Magenta  #A20067
  | 'tan'     // Arena    #9E8668
  | 'gray';   // Gris     #575757

const VALID_ACCENTS: Accent[] = [
  'blue', 'rose', 'red', 'orange', 'green', 'teal', 'purple', 'tan', 'gray',
];

/** Paleta corporativa. Los nombres de `Accent` se mantienen por compatibilidad
 *  con localStorage/CSS existente, pero el color real es el nuevo. */
const ACCENT_COLORS: Record<Accent, string> = {
  blue:   '#780029',
  rose:   '#A6002E',
  red:    '#D7192D',
  orange: '#F68400',
  green:  '#4BC59C',
  teal:   '#97E1E1',
  purple: '#A20067',
  tan:    '#9E8668',
  gray:   '#575757',
};

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
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme ?? DEFAULTS.theme,
      accent: VALID_ACCENTS.includes(parsed.accent as Accent)
        ? (parsed.accent as Accent)
        : DEFAULTS.accent,
      fontSize: parsed.fontSize ?? DEFAULTS.fontSize,
    };
  } catch {
    return DEFAULTS;
  }
}

function applyToDOM(settings: Settings) {
  const html = document.documentElement;

  // Tamaño de letra
  const sizeMap: Record<FontSize, string> = {
    small: '87.5%',
    normal: '100%',
    large: '112.5%',
    xlarge: '125%',
  };
  html.style.fontSize = sizeMap[settings.fontSize] || '100%';

  // Tema claro/oscuro
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  html.classList.toggle('theme-dark', isDark);

  // Color de acento (nueva paleta)
  const accentColor = ACCENT_COLORS[settings.accent] ?? ACCENT_COLORS.blue;
  html.setAttribute('data-accent', settings.accent);
  // Variables CSS para que cualquier estilo que las use recoja el color nuevo.
  // Cubre los nombres más habituales; si tu CSS usa solo [data-accent] con
  // colores hardcodeados, actualiza esas reglas a la nueva paleta.
  html.style.setProperty('--accent', accentColor);
  html.style.setProperty('--accent-color', accentColor);
  html.style.setProperty('--airbus-blue', accentColor);
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
          const remoteAccent = VALID_ACCENTS.includes(data.accent as Accent)
            ? (data.accent as Accent)
            : DEFAULTS.accent;
          const remote: Settings = {
            theme: (data.theme as Theme) || DEFAULTS.theme,
            accent: remoteAccent,
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