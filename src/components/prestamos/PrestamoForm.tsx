import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle, Package } from 'lucide-react';

interface PrestamoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  prestamoId?: string;
}

export function PrestamoForm({ onSuccess, onCancel }: PrestamoFormProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const hoy = new Date().toISOString().split('T')[0];
  const enUnaSemana = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];

  const [form, setForm] = useState({
    equipo_id: '',
    usuario_id: '',
    fecha_devolucion_prevista: enUnaSemana,
    observaciones: '',
  });

  // Cargar equipos disponibles + usuarios
  useEffect(() => {
    async function load() {
      const [eq, us] = await Promise.all([
        supabase
          .from('equipos')
          .select('id, id_equipo, nombre, codigo_barras, estado')
          .eq('estado', 'disponible')
          .order('nombre'),
        supabase
          .from('perfiles')
          .select('id, nombre_completo, email, activo')
          .eq('activo', true)
          .order('nombre_completo'),
      ]);
      setEquipos(eq.data ?? []);
      setUsuarios(us.data ?? []);
      setLoadingData(false);
    }
    load();
  }, []);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.equipo_id)  return setError('Selecciona un equipo');
    if (!form.usuario_id) return setError('Selecciona un usuario');

    setLoading(true);

    try {
      // 1. Crear el préstamo
      const { error: insErr } = await supabase.from('prestamos').insert({
        equipo_id: form.equipo_id,
        usuario_id: form.usuario_id,
        fecha_devolucion_prevista: form.fecha_devolucion_prevista || null,
        observaciones: form.observaciones.trim() || null,
        estado: 'activo',
      });
      if (insErr) throw insErr;

      // 2. Actualizar el estado del equipo a 'prestado'
      const { error: updErr } = await supabase
        .from('equipos')
        .update({ estado: 'prestado' })
        .eq('id', form.equipo_id);
      if (updErr) throw updErr;

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
      <Section title="Equipo y usuario">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipo *">
            <select
              className="input"
              value={form.equipo_id}
              onChange={(e) => update('equipo_id', e.target.value)}
              required
            >
              <option value="">— Selecciona un equipo —</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.id_equipo ? `[${eq.id_equipo}] ` : ''}{eq.nombre} · {eq.codigo_barras}
                </option>
              ))}
            </select>
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

      <Section title="Fechas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fecha de préstamo">
            <input
              type="date"
              className="input bg-gray-50"
              value={hoy}
              disabled
            />
          </Field>
          <Field label="Devolución prevista">
            <input
              type="date"
              className="input"
              value={form.fecha_devolucion_prevista}
              onChange={(e) => update('fecha_devolucion_prevista', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Motivo del préstamo, destino, etc."
        />
      </Section>

      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

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