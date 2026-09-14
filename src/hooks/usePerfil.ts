import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type Rol = 'admin' | 'supervisor' | 'tecnico';

export interface Perfil {
  id: string;
  nombre_completo: string;
  email: string;
  rol: Rol;
  activo: boolean;
  telefono?: string | null;
}

export function usePerfil() {
  const { user, loading: authLoading } = useAuth();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[usePerfil] user =', user?.id, user?.email);
    console.log('[usePerfil] authLoading =', authLoading);

    if (authLoading) return; // esperar a que auth termine

    if (!user) {
      console.log('[usePerfil] No hay usuario, reseteando');
      setPerfil(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      console.log('[usePerfil] Consultando perfiles para id =', user!.id);

      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, email, rol, activo, telefono')
        .eq('id', user!.id)
        .maybeSingle();

      if (cancelled) return;

      console.log('[usePerfil] Respuesta:', { data, error });

      if (error) {
        console.error('[usePerfil] Error:', error);
        setError(error.message);
        setPerfil(null);
      } else if (!data) {
        console.warn('[usePerfil] No existe fila en perfiles para este usuario');
        setError('No existe perfil asociado a este usuario');
        setPerfil(null);
      } else {
        console.log('[usePerfil] Perfil cargado con rol:', data.rol);
        setPerfil(data as Perfil);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { perfil, loading, error };
}