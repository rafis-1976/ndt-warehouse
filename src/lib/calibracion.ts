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
 * Estado efectivo del equipo.
 * - Si la BD ya lo marca como 'pendiente_calibracion', respeta ese estado.
 * - Si la calibración está vencida (por si el cron no ha corrido), lo
 *   calcula dinámicamente.
 * - Si está en 'calibracion' o 'baja', respeta ese estado manual.
 */
export function estadoEfectivoEquipo(eq: {
  estado: string;
  proxima_calibracion: string | null;
}): EstadoEfectivo {
  // Estados manuales que se respetan siempre
  if (eq.estado === 'baja') return 'baja';
  if (eq.estado === 'calibracion') return 'calibracion';
  if (eq.estado === 'mantenimiento') return 'mantenimiento';

  // Si la BD ya lo marca como pendiente, respetar
  if (eq.estado === 'pendiente_calibracion') return 'pendiente_calibracion';

  // Salvaguarda: si la calibración está vencida, marcarlo pendiente
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
  if (eq.estado === 'pendiente_calibracion') return false;
  return estadoCalibracion(eq.proxima_calibracion) === 'proxima';
}

/**
 * ¿Se puede prestar este equipo?
 * Reglas NDT:
 *   - No prestar si está de baja
 *   - No prestar si está en mantenimiento
 *   - No prestar si está en calibración
 *   - No prestar si la calibración está vencida
 */
export function sePuedePrestar(eq: {
  proxima_calibracion: string | null;
  estado?: string;
}): boolean {
  const ef = estadoEfectivoEquipo({
    estado: eq.estado ?? 'disponible',
    proxima_calibracion: eq.proxima_calibracion,
  });
  return ef === 'disponible' || ef === 'prestado';
}

/**
 * Motivo por el que NO se puede prestar (o null si sí se puede).
 */
export function motivoNoPrestable(eq: {
  proxima_calibracion: string | null;
  estado?: string;
}): string | null {
  const ef = estadoEfectivoEquipo({
    estado: eq.estado ?? 'disponible',
    proxima_calibracion: eq.proxima_calibracion,
  });

  if (ef === 'baja') return 'Equipo dado de baja';
  if (ef === 'calibracion') return 'Equipo en calibración';
  if (ef === 'mantenimiento') return 'Equipo en mantenimiento';
  if (ef === 'pendiente_calibracion') {
    return `Calibración vencida (${eq.proxima_calibracion})`;
  }
  return null;
}