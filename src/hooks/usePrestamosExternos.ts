import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PrestamoExterno {
  equipo_id: string | null;
  probeta_id: string | null;
  tipo: 'prestamo_externo' | 'devolucion_externa';
  destino_tipo: string | null;
  destino_nombre: string | null;
  destino_contacto: string | null;
  fecha_devolucion_prevista: string | null;
  created_at: string;
}

export interface FueraInfo {
  prestamo: PrestamoExterno;
  diasFuera: number;
  retrasado: boolean;
}

export function usePrestamosExternos() {
  const [prestamos, setPrestamos] = useState<PrestamoExterno[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('movimientos')
      .select(
        'equipo_id, probeta_id, tipo, destino_tipo, destino_nombre, destino_contacto, fecha_devolucion_prevista, created_at'
      )
      .in('tipo', ['prestamo_externo', 'devolucion_externa'])
      .order('created_at', { ascending: true });

    setPrestamos((data ?? []) as PrestamoExterno[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    // Refrescar cuando vuelve el foco a la pestaña
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Último estado por id (equipo o probeta)
  const ultimos = new Map<string, PrestamoExterno>();
  prestamos.forEach((p) => {
    const key = p.equipo_id ?? p.probeta_id;
    if (!key) return;
    ultimos.set(key, p);
  });

  // Los que están fuera ahora mismo (último movimiento = prestamo_externo)
  const fueraMap = new Map<string, FueraInfo>();
  ultimos.forEach((p, key) => {
    if (p.tipo !== 'prestamo_externo') return;
    const diasFuera = Math.max(
      0,
      Math.floor((Date.now() - new Date(p.created_at).getTime()) / 864e5)
    );
    const retrasado = p.fecha_devolucion_prevista
      ? new Date(p.fecha_devolucion_prevista) < new Date()
      : false;
    fueraMap.set(key, { prestamo: p, diasFuera, retrasado });
  });

  return { fueraMap, loading, reload: load };
}