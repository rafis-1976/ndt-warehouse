import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle, Package, Calendar } from 'lucide-react';
import { EquipoSelect, type EquipoOption } from '../ui/EquipoSelect';

// ============================================================
// Helpers de fecha y hora
// ============================================================

/** Fecha/hora actual en formato "YYYY-MM-DDTHH:MM" (local) */
function nowLocal(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/** Suma días a un datetime-local */
function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/** Convierte datetime-local a ISO con zona (para Supabase) */
function toISO(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

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

  const [form, setForm] = useState(() => {
    const now = nowLocal();
    return {
      equipo_id: '',
      usuario_id: '',
      fecha_prestamo: now,
      fecha_devolucion_prevista: addDays(now, 7),
      observaciones: '',
    };
  });

  // ============================================================
  // Cargar equipos disponibles y usuarios
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

      // Ordenar equipos por técnica y luego por ID
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
      // 1. Crear el préstamo
      const { error: insErr } = await supabase.from('prestamos').insert({
        equipo_id: form.equipo_id,
        usuario_id: form.usuario_id,
        fecha_prestamo: toISO(form.fecha_prestamo),
        fecha_devolucion_prevista: toISO(form.fecha_devolucion_prevista),
        observaciones: form.observaciones.trim() || null,
        estado: 'activo',
      });
      if (insErr) throw insErr;

      // 2. Marcar equipo como prestado
      await supabase
        .from('equipos')
        .update({ estado: 'prestado' })
        .eq('id', form.equipo_id);

      // 3. Registrar movimiento de salida
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

      {/* ------------------ EQUIPO Y USUARIO ------------------ */}
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

      {/* ------------------ FECHAS Y HORAS ------------------ */}
      <Section title="Fechas y horas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Field label="Fecha y hora del préstamo *">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                type="datetime-local"
                className="input pl-10"
                value={form.fecha_prestamo}
                onChange={(e) => update('fecha_prestamo', e.target.value)}
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
                onChange={(e) => update('fecha_devolucion_prevista', e.target.value)}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Por defecto: 7 días después del préstamo
            </p>
          </Field>

        </div>

        {/* Resumen legible de las fechas */}
        {form.fecha_prestamo && (
          <div className="mt-3 p-3 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg text-xs">
            <p className="text-gray-600">
              <span className="font-semibold text-airbus-blue">Préstamo:</span>{' '}
              {new Date(form.fecha_prestamo).toLocaleString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            {form.fecha_devolucion_prevista && (
              <p className="text-gray-600 mt-1">
                <span className="font-semibold text-airbus-blue">Devolución:</span>{' '}
                {new Date(form.fecha_devolucion_prevista).toLocaleString('es-ES', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ------------------ OBSERVACIONES ------------------ */}
      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Motivo del préstamo, destino, etc."
        />
      </Section>

      {/* ------------------ ERROR ------------------ */}
      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ------------------ BOTONES ------------------ */}
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