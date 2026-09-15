import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type Rol = 'admin' | 'supervisor' | 'tecnico';

export interface Perfil {
  id: string;
  num_nomina: string | null;
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

  useEffect(() => {
    // Esperar a que auth termine
    if (authLoading) return;

    if (!user) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, num_nomina, nombre_completo, email, rol, activo, telefono')
        .eq('id', user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) console.error('[usePerfil] Error:', error);
      setPerfil(data as Perfil | null);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { perfil, loading };
}