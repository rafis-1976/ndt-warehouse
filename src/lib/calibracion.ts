export type EstadoCalibracion = 'vencida' | 'proxima' | 'ok' | 'sin_fecha';

export type EstadoEfectivo =
  | 'disponible'
  | 'prestado'
  | 'calibracion'
  | 'pendiente_calibracion'
  | 'mantenimiento'
  | 'baja'
  | 'salida';

export function estadoCalibracion(fecha: string | null): EstadoCalibracion {
  if (!fecha) return 'sin_fecha';
  const diff = new Date(fecha).getTime() - Date.now();
  if (diff < 0) return 'vencida';
  if (diff < 30 * 864e5) return 'proxima';
  return 'ok';
}

export function estadoEfectivoEquipo(eq: {
  estado: string;
  proxima_calibracion: string | null;
}): EstadoEfectivo {
  if (eq.estado === 'baja') return 'baja';
  if (eq.estado === 'calibracion') return 'calibracion';
  if (eq.estado === 'mantenimiento') return 'mantenimiento';
  if (eq.estado === 'salida') return 'salida';
  if (eq.estado === 'pendiente_calibracion') return 'pendiente_calibracion';

  if (estadoCalibracion(eq.proxima_calibracion) === 'vencida') {
    return 'pendiente_calibracion';
  }

  return eq.estado as EstadoEfectivo;
}

export function estadoEfectivoLabel(estado: EstadoEfectivo): string {
  const labels: Record<EstadoEfectivo, string> = {
    disponible:            'Disponible',
    prestado:              'Prestado',
    calibracion:           'En calibración',
    pendiente_calibracion: 'Pendiente de Calibración',
    mantenimiento:         'En mantenimiento',
    baja:                  'Baja',
    salida:                'Fuera del almacén',
  };
  return labels[estado] ?? estado;
}

export function tieneCalibracionProxima(eq: {
  proxima_calibracion: string | null;
  estado: string;
}): boolean {
  if (eq.estado === 'baja') return false;
  if (eq.estado === 'calibracion') return false;
  if (eq.estado === 'pendiente_calibracion') return false;
  if (eq.estado === 'salida') return false;
  return estadoCalibracion(eq.proxima_calibracion) === 'proxima';
}

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
  if (ef === 'salida') return 'Equipo fuera del almacén';
  if (ef === 'pendiente_calibracion') {
    return `Calibración vencida (${eq.proxima_calibracion})`;
  }
  return null;
}