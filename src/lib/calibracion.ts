// ============================================================
// Utilidades de calibración compartidas
// ============================================================

export type EstadoCalibracion = 'vencida' | 'proxima' | 'ok' | 'sin_fecha';

export type EstadoEfectivo =
  | 'disponible'
  | 'prestado'
  | 'calibracion'
  | 'pendiente_calibracion'
  | 'mantenimiento'
  | 'baja';

/**
 * Determina el estado de calibración según la fecha.
 */
export function estadoCalibracion(fecha: string | null): EstadoCalibracion {
  if (!fecha) return 'sin_fecha';
  const diff = new Date(fecha).getTime() - Date.now();
  if (diff < 0) return 'vencida';
  if (diff < 30 * 864e5) return 'proxima';
  return 'ok';
}

/**
 * Calcula el estado efectivo del equipo teniendo en cuenta calibración.
 *
 * Prioridad:
 *  1. baja         → el equipo está retirado
 *  2. calibracion  → ya ha sido enviado a calibrar (estado manual)
 *  3. vencida      → pendiente_calibracion (auto)
 *  4. resto        → estado original
 */
export function estadoEfectivoEquipo(eq: {
  estado: string;
  proxima_calibracion: string | null;
}): EstadoEfectivo {
  if (eq.estado === 'baja') return 'baja';
  if (eq.estado === 'calibracion') return 'calibracion';

  if (estadoCalibracion(eq.proxima_calibracion) === 'vencida') {
    return 'pendiente_calibracion';
  }
  return eq.estado as EstadoEfectivo;
}

/**
 * Etiqueta legible para mostrar en la UI.
 */
export function estadoEfectivoLabel(estado: EstadoEfectivo): string {
  const labels: Record<EstadoEfectivo, string> = {
    disponible:            'Disponible',
    prestado:              'Prestado',
    calibracion:           'En calibración',
    pendiente_calibracion: 'Pendiente de Calibración',
    mantenimiento:         'En mantenimiento',
    baja:                  'Baja',
  };
  return labels[estado] ?? estado;
}

/**
 * ¿Tiene la calibración próxima a vencer? (aviso naranja sin cambiar estado)
 */
export function tieneCalibracionProxima(eq: {
  proxima_calibracion: string | null;
  estado: string;
}): boolean {
  if (eq.estado === 'baja') return false;
  if (eq.estado === 'calibracion') return false;
  return estadoCalibracion(eq.proxima_calibracion) === 'proxima';
}

/**
 * ¿Se puede prestar este equipo?
 */
export function sePuedePrestar(eq: {
  proxima_calibracion: string | null;
  estado?: string;
}): boolean {
  if (eq.estado === 'baja') return false;
  if (eq.estado === 'calibracion') return false;
  if (eq.estado === 'mantenimiento') return false;
  return estadoCalibracion(eq.proxima_calibracion) !== 'vencida';
}

/**
 * Motivo por el que NO se puede prestar (o null si sí se puede).
 */
export function motivoNoPrestable(eq: {
  proxima_calibracion: string | null;
  estado?: string;
}): string | null {
  if (eq.estado === 'baja') return 'Equipo dado de baja';
  if (eq.estado === 'calibracion') return 'Equipo en calibración';
  if (eq.estado === 'mantenimiento') return 'Equipo en mantenimiento';
  if (estadoCalibracion(eq.proxima_calibracion) === 'vencida') {
    return `Calibración vencida (${eq.proxima_calibracion})`;
  }
  return null;
}