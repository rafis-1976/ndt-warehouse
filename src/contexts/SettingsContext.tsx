import {
  createContext, useContext, useEffect, useState, useCallback, useMemo, useRef,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

// ============================================================
// Tipos
// ============================================================
export type Tema = 'claro' | 'oscuro' | 'auto';

export interface Settings {
  colorPrimario: string;
  colorSecundario: string;
  colorAcento: string;
  colorFondo: string;
  tema: Tema;
  densidad: 'compacta' | 'normal' | 'comoda';
  mostrarAnimaciones: boolean;
}

const DEFAULTS: Settings = {
  colorPrimario: '#0033a0',
  colorSecundario: '#ff6b00',
  colorAcento: '#00a651',
  colorFondo: '#f9fafb',
  tema: 'auto',
  densidad: 'normal',
  mostrarAnimaciones: true,
};

// ============================================================
// Contexto
// ============================================================
interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ============================================================
// Provider
// ============================================================
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  // 🔧 FIX: guardamos el id del usuario cargado para detectar cambios
  // y evitar condiciones de carrera con peticiones en vuelo.
  const loadedForUserRef = useRef<string | null>(null);

  // ----------------------------------------------------------
  // 🔧 FIX: efecto que se dispara SIEMPRE que cambia user
  //    1. Al logout → defaults + limpia cache del usuario anterior
  //    2. Al login → carga del usuario nuevo (cache local + Supabase)
  // ----------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;

    // CASO 1: sin usuario → limpiar TODO estado del anterior
    if (!user) {
      // 🔧 FIX: forzar reset a defaults aunque sea el primer render
      setSettings(DEFAULTS);
      setLoading(false);
      loadedForUserRef.current = null;
      return;
    }

    // CASO 2: usuario distinto del que ya está cargado → recargar
    if (loadedForUserRef.current === user.id) {
      // Mismo usuario, no hacemos nada (evita re-render y parpadeo)
      return;
    }

    // 🔧 FIX: ANTES de cargar el nuevo usuario, reseteamos a defaults
    // Esto evita que durante el fetch se vean los colores del anterior
    setSettings(DEFAULTS);
    setLoading(true);

    const cacheKey = `settings:${user.id}`;
    let cancelled = false;

    (async () => {
      // 1. Hidratación rápida desde cache del usuario ACTUAL
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached);
          setSettings({ ...DEFAULTS, ...parsed });
          setLoading(false);
        }
      } catch (_) {
        /* cache corrupta → ignorar */
      }

      // 2. Fuente de verdad: Supabase
      const { data, error } = await supabase
        .from('perfiles')
        .select('ajustes')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('[SettingsContext] Error cargando ajustes:', error);
        setLoading(false);
        return;
      }

      const merged = {
        ...DEFAULTS,
        ...((data?.ajustes as Partial<Settings> | null) ?? {}),
      };

      setSettings(merged);
      setLoading(false);

      // Cachear para la próxima
      try {
        localStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch (_) {}

      loadedForUserRef.current = user.id;
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // ----------------------------------------------------------
  // Aplicar CSS variables al :root
  // ----------------------------------------------------------
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', settings.colorPrimario);
    root.style.setProperty('--color-secondary', settings.colorSecundario);
    root.style.setProperty('--color-accent', settings.colorAcento);
    root.style.setProperty('--color-bg', settings.colorFondo);

    const temaResuelto =
      settings.tema === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'oscuro'
          : 'claro'
        : settings.tema;

    root.classList.toggle('theme-dark', temaResuelto === 'oscuro');
    root.classList.toggle('theme-light', temaResuelto === 'claro');
    root.dataset.densidad = settings.densidad;
    root.classList.toggle('no-animations', !settings.mostrarAnimaciones);
  }, [settings]);

  // ----------------------------------------------------------
  // Persistir cambios
  // ----------------------------------------------------------
  const persist = useCallback(
    async (next: Settings) => {
      if (!user) return;
      try {
        localStorage.setItem(`settings:${user.id}`, JSON.stringify(next));
      } catch (_) {}
      const { error } = await supabase
        .from('perfiles')
        .update({ ajustes: next })
        .eq('id', user.id);
      if (error) {
        console.error('[SettingsContext] Error guardando ajustes:', error);
      }
    },
    [user]
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULTS);
    if (user) {
      try {
        localStorage.removeItem(`settings:${user.id}`);
      } catch (_) {}
      await supabase.from('perfiles').update({ ajustes: {} }).eq('id', user.id);
    }
  }, [user]);

  const value = useMemo(
    () => ({ settings, loading, updateSetting, updateSettings, resetSettings }),
    [settings, loading, updateSetting, updateSettings, resetSettings]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings debe usarse dentro de <SettingsProvider>');
  }
  return ctx;
}