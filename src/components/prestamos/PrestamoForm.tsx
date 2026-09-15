import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, Package, Calendar, Clock,
  Sun, Moon, Zap, CalendarDays,
} from 'lucide-react';
import { EquipoSelect, type EquipoOption } from '../ui/EquipoSelect';

// ============================================================
// Turnos de trabajo
// ============================================================
const TURNOS = [
  { id: 'mañana',  inicio: 6,  fin: 14, label: '06:00 – 14:00' },
  { id: 'tarde',   inicio: 14, fin: 22, label: '14:00 – 22:00' },
  { id: 'noche',   inicio: 22, fin: 6,  label: '22:00 – 06:00' },
];

// ============================================================
// Helpers de fecha y hora
// ============================================================

/** Fecha/hora actual en formato "YYYY-MM-DDTHH:MM" (local) */
function nowLocal(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/** Convierte un Date a formato datetime-local */
function dateToLocal(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/** Suma días a un datetime-local */
function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return dateToLocal(d);
}

/** Suma horas a un datetime-local */
function addHours(base: string, hours: number): string {
  const d = new Date(base);
  d.setHours(d.getHours() + hours);
  return dateToLocal(d);
}

/**
 * Devuelve la hora de fin del turno activo según la hora del préstamo.
 *
 * Turnos:
 *   06:00 – 14:00  → devolución a las 14:00 (mismo día)
 *   14:00 – 22:00  → devolución a las 22:00 (mismo día)
 *   22:00 – 06:00  → devolución a las 06:00 (día siguiente si empieza ≥22:00)
 */
function finJornada(fechaInicio: string): string {
  const inicio = new Date(fechaInicio);
  const h = inicio.getHours();
  const devolucion = new Date(inicio);

  if (h >= 6 && h < 14) {
    // Turno de mañana → termina hoy a las 14:00
    devolucion.setHours(14, 0, 0, 0);
  } else if (h >= 14 && h < 22) {
    // Turno de tarde → termina hoy a las 22:00
    devolucion.setHours(22, 0, 0, 0);
  } else {
    // Turno de noche (22:00 – 06:00)
    // Si empezamos entre las 22:00 y 23:59 → termina mañana a las 06:00
    // Si empezamos entre las 00:00 y 05:59 → termina hoy a las 06:00
    if (h >= 22) {
      devolucion.setDate(devolucion.getDate() + 1);
    }
    devolucion.setHours(6, 0, 0, 0);
  }

  return dateToLocal(devolucion);
}

/** Determina en qué turno cae una fecha */
function turnoDe(fecha: string): typeof TURNOS[number] {
  const h = new Date(fecha).getHours();
  if (h >= 6 && h < 14) return TURNOS[0];
  if (h >= 14 && h < 22) return TURNOS[1];
  return TURNOS[2];
}

/** Convierte datetime-local a ISO con zona (para Supabase) */
function toISO(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

/** Formatea un datetime-local a texto legible */
function fmt(local: string): string {
  if (!local) return '—';
  return new Date(local).toLocaleString('es-ES', {
    weekday: 'short',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ============================================================
// Presets de duración
// ============================================================
interface Preset {
  id: string;
  label: string;
  icon: any;
  descripcion: string;
  calcular: (fechaInicio: string) => string;
}

const presets: Preset[] = [
  {
    id: 'hora',
    label: '1 hora',
    icon: Clock,
    descripcion: 'Devolución 1 hora después',
    calcular: (f) => addHours(f, 1),
  },
  {
    id: 'medio_dia',
    label: 'Medio día',
    icon: Sun,
    descripcion: 'Devolución 12 horas después',
    calcular: (f) => addHours(f, 12),
  },
  {
    id: 'jornada',
    label: 'Jornada de trabajo',
    icon: CalendarDays,
    descripcion: 'Hasta el fin del turno activo',
    calcular: (f) => finJornada(f),
  },
  {
    id: 'semana',
    label: '1 semana',
    icon: Calendar,
    descripcion: 'Devolución 7 días después',
    calcular: (f) => addDays(f, 7),
  },
  {
    id: 'dos_semanas',
    label: '2 semanas',
    icon: Calendar,
    descripcion: 'Devolución 14 días después',
    calcular: (f) => addDays(f, 14),
  },
];

// ============================================================
// Componente principal
// ============================================================
interface PrestamoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function PrestamoForm({ onSuccess, onCancel }: PrestamoFormProps) {
  const [equipos, setEquipos] = useState<EquipoOption[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const [presetActivo, setPresetActivo] = useState<string | null>(null);

  const [form, setForm] = useState(() => {
  const now = nowLocal();
  return {
    equipo_id: '',
    usuario_id: '',
    fecha_prestamo: now,
    fecha_devolucion_prevista: finJornada(now),   // ← antes era finDiaCompleto
    observaciones: '',
  };
});

  // Marcar "día completo" como preset por defecto
  useEffect(() => {
    setPresetActivo('jornada');  
  }, []);

  // ============================================================
  // Cargar datos
  // ============================================================
  useEffect(() => {
    async function load() {
      const [eq, us] = await Promise.all([
        supabase
          .from('equipos')
          .select('id, id_equipo, nombre, codigo_barras, estado, tecnicas_ndt(codigo, nombre)')
          .eq('estado', 'disponible'),
        supabase
          .from('perfiles')
          .select('id, nombre_completo, email')
          .eq('activo', true)
          .order('nombre_completo'),
      ]);

      const sorted = ((eq.data ?? []) as EquipoOption[]).sort((a, b) => {
        const ta = a.tecnicas_ndt?.codigo ?? 'ZZZ';
        const tb = b.tecnicas_ndt?.codigo ?? 'ZZZ';
        if (ta !== tb) return ta.localeCompare(tb);
        return (a.id_equipo ?? '').localeCompare(b.id_equipo ?? '');
      });

      setEquipos(sorted);
      setUsuarios(us.data ?? []);
      setLoadingData(false);
    }
    load();
  }, []);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ============================================================
  // Aplicar preset
  // ============================================================
  const aplicarPreset = (preset: Preset) => {
    setPresetActivo(preset.id);
    const nuevaDevolucion = preset.calcular(form.fecha_prestamo);
    setForm((f) => ({ ...f, fecha_devolucion_prevista: nuevaDevolucion }));
  };

  // Si el usuario cambia manualmente la fecha de préstamo, recalcular el preset activo
  const cambiarFechaPrestamo = (valor: string) => {
    setForm((f) => {
      const actualizado = { ...f, fecha_prestamo: valor };
      // Si hay un preset activo, recalcular la devolución
      if (presetActivo) {
        const preset = presets.find((p) => p.id === presetActivo);
        if (preset) {
          actualizado.fecha_devolucion_prevista = preset.calcular(valor);
        }
      }
      return actualizado;
    });
  };

  // ============================================================
  // Duración calculada (para mostrar resumen)
  // ============================================================
  const duracion = useMemo(() => {
    if (!form.fecha_prestamo || !form.fecha_devolucion_prevista) return null;
    const diff = new Date(form.fecha_devolucion_prevista).getTime() -
                 new Date(form.fecha_prestamo).getTime();
    if (diff <= 0) return null;

    const horas = Math.floor(diff / 3600000);
    const minutos = Math.floor((diff % 3600000) / 60000);
    const dias = Math.floor(horas / 24);

    if (dias >= 1) {
      const horasRestantes = horas % 24;
      return `${dias} día${dias !== 1 ? 's' : ''}${horasRestantes ? ` y ${horasRestantes}h` : ''}`;
    }
    return `${horas}h${minutos ? ` ${minutos}min` : ''}`;
  }, [form.fecha_prestamo, form.fecha_devolucion_prevista]);

  // ============================================================
  // Enviar formulario
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.equipo_id)  return setError('Selecciona un equipo');
    if (!form.usuario_id) return setError('Selecciona un usuario');
    if (!form.fecha_prestamo) return setError('Indica la fecha y hora del préstamo');

    if (form.fecha_devolucion_prevista &&
        new Date(form.fecha_devolucion_prevista) < new Date(form.fecha_prestamo)) {
      return setError('La devolución no puede ser anterior al préstamo');
    }

    setLoading(true);
    try {
      const { error: insErr } = await supabase.from('prestamos').insert({
        equipo_id: form.equipo_id,
        usuario_id: form.usuario_id,
        fecha_prestamo: toISO(form.fecha_prestamo),
        fecha_devolucion_prevista: toISO(form.fecha_devolucion_prevista),
        observaciones: form.observaciones.trim() || null,
        estado: 'activo',
      });
      if (insErr) throw insErr;

      await supabase
        .from('equipos')
        .update({ estado: 'prestado' })
        .eq('id', form.equipo_id);

      await supabase.from('movimientos').insert({
        equipo_id: form.equipo_id,
        tipo: 'salida',
        observaciones: 'Préstamo registrado',
      });

      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('row-level security'))
        setError('No tienes permisos para crear préstamos.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  if (loadingData) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-airbus-sky" />
      </div>
    );
  }

  if (equipos.length === 0) {
    return (
      <div className="py-8 text-center">
        <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium mb-1">No hay equipos disponibles</p>
        <p className="text-sm text-gray-500 mb-4">
          Todos los equipos están prestados o en mantenimiento.
        </p>
        <button onClick={onCancel} className="btn-ghost border border-gray-300">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ============================================================
          EQUIPO Y USUARIO
          ============================================================ */}
      <Section title="Equipo y usuario">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipo *">
            <EquipoSelect
              equipos={equipos}
              value={form.equipo_id}
              onChange={(id) => update('equipo_id', id)}
            />
          </Field>
          <Field label="Usuario *">
            <select
              className="input"
              value={form.usuario_id}
              onChange={(e) => update('usuario_id', e.target.value)}
              required
            >
              <option value="">— Selecciona un usuario —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo} ({u.email})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* ============================================================
          PRESETS DE DURACIÓN
          ============================================================ */}
      <Section title="Duración del préstamo">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {presets.map((preset) => {
            const Icon = preset.icon;
            const activo = presetActivo === preset.id;
            const esDestacado = preset.id === 'dia_completo';

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => aplicarPreset(preset)}
                title={preset.descripcion}
                className={`
                  relative flex flex-col items-center justify-center gap-1.5
                  px-3 py-3 rounded-lg border-2 transition-all
                  ${activo
                    ? esDestacado
                      ? 'bg-airbus-sky text-white border-airbus-sky shadow-md'
                      : 'bg-airbus-blue text-white border-airbus-blue shadow-md'
                    : esDestacado
                      ? 'bg-airbus-sky/5 text-airbus-sky border-airbus-sky/30 hover:border-airbus-sky hover:bg-airbus-sky/10'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold text-center leading-tight">
                  {preset.label}
                </span>
                {esDestacado && !activo && (
                  <span className="absolute -top-2 -right-2 bg-airbus-orange text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    NUEVO
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ============================================================
          FECHAS Y HORAS
          ============================================================ */}
      <Section title="Fechas y horas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Field label="Fecha y hora del préstamo *">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                type="datetime-local"
                className="input pl-10"
                value={form.fecha_prestamo}
                onChange={(e) => cambiarFechaPrestamo(e.target.value)}
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Prefijada con la fecha y hora actual
            </p>
          </Field>

          <Field label="Devolución prevista">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                type="datetime-local"
                className="input pl-10"
                value={form.fecha_devolucion_prevista}
                onChange={(e) => {
                  update('fecha_devolucion_prevista', e.target.value);
                  setPresetActivo(null); // personalizado
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Se recalcula automáticamente al cambiar la duración
            </p>
          </Field>

        </div>

        {/* Resumen visual */}
        {form.fecha_prestamo && form.fecha_devolucion_prevista && (
          <div className="mt-3 p-4 bg-gradient-to-br from-airbus-sky/5 to-airbus-blue/5 border border-airbus-sky/20 rounded-lg">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Desde
                </p>
                <p className="text-sm font-medium text-airbus-blue capitalize">
                  {fmt(form.fecha_prestamo)}
                </p>
              </div>

              <div className="flex items-center gap-3 self-center">
                <div className="hidden sm:block w-12 h-px bg-airbus-sky/40" />
                <div className="flex flex-col items-center">
		  <Zap className="w-4 h-4 text-airbus-orange" />
		  <span className="text-[10px] font-bold text-airbus-orange uppercase tracking-wider mt-0.5">
		    {duracion ?? '—'}
		  </span>
 		 {presetActivo === 'jornada' && form.fecha_prestamo && (
 		   <span className="text-[9px] text-airbus-sky font-medium uppercase tracking-wider mt-0.5">
 		     Turno {turnoDe(form.fecha_prestamo).label}
		    </span>
		  )}
		</div>
                <div className="hidden sm:block w-12 h-px bg-airbus-sky/40" />
              </div>

              <div className="flex-1 min-w-[200px] sm:text-right">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Hasta
                </p>
                <p className="text-sm font-medium text-airbus-blue capitalize">
                  {fmt(form.fecha_devolucion_prevista)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ============================================================
          OBSERVACIONES
          ============================================================ */}
      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Motivo del préstamo, destino, etc."
        />
      </Section>

      {/* ============================================================
          ERROR
          ============================================================ */}
      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ============================================================
          BOTONES
          ============================================================ */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-ghost border border-gray-300">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Registrar préstamo
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Sub-componentes
// ============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-airbus-blue uppercase tracking-wider mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}