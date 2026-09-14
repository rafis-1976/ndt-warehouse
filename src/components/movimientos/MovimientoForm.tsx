import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle } from 'lucide-react';

interface MovimientoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const tipos = [
  { value: 'entrada',       label: 'Entrada al almacén' },
  { value: 'salida',        label: 'Salida del almacén' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'ajuste',        label: 'Ajuste de inventario' },
];

export function MovimientoForm({ onSuccess, onCancel }: MovimientoFormProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    equipo_id: '',
    tipo: 'entrada',
    ubicacion_origen: '',
    ubicacion_destino: '',
    referencia: '',
    observaciones: '',
  });

  useEffect(() => {
    supabase
      .from('equipos')
      .select('id, id_equipo, nombre, codigo_barras, ubicacion')
      .order('nombre')
      .then(({ data }) => {
        setEquipos(data ?? []);
        setLoadingData(false);
      });
  }, []);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Al seleccionar equipo, autorellenar origen con su ubicación actual
  const handleEquipoChange = (id: string) => {
    const eq = equipos.find((e) => e.id === id);
    setForm((f) => ({
      ...f,
      equipo_id: id,
      ubicacion_origen: eq?.ubicacion ?? f.ubicacion_origen,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.equipo_id) return setError('Selecciona un equipo');

    setLoading(true);

    try {
      // 1. Crear el movimiento
      const { error: insErr } = await supabase.from('movimientos').insert({
        equipo_id: form.equipo_id,
        tipo: form.tipo,
        ubicacion_origen: form.ubicacion_origen.trim() || null,
        ubicacion_destino: form.ubicacion_destino.trim() || null,
        referencia: form.referencia.trim() || null,
        observaciones: form.observaciones.trim() || null,
      });
      if (insErr) throw insErr;

      // 2. Actualizar ubicación del equipo si es transferencia
      if (form.tipo === 'transferencia' && form.ubicacion_destino.trim()) {
        await supabase
          .from('equipos')
          .update({ ubicacion: form.ubicacion_destino.trim() })
          .eq('id', form.equipo_id);
      }

      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('row-level security'))
        setError('No tienes permisos para registrar movimientos.');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Equipo y tipo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipo *">
            <select
              className="input"
              value={form.equipo_id}
              onChange={(e) => handleEquipoChange(e.target.value)}
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
          <Field label="Tipo de movimiento *">
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => update('tipo', e.target.value)}
            >
              {tipos.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Ubicaciones">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Ubicación origen">
            <input
              className="input"
              value={form.ubicacion_origen}
              onChange={(e) => update('ubicacion_origen', e.target.value)}
              placeholder="Estante A-3"
            />
          </Field>
          <Field label="Ubicación destino">
            <input
              className="input"
              value={form.ubicacion_destino}
              onChange={(e) => update('ubicacion_destino', e.target.value)}
              placeholder="Estante B-1"
            />
          </Field>
        </div>
      </Section>

      <Section title="Referencia">
        <Field label="Referencia / Nº de orden">
          <input
            className="input font-mono"
            value={form.referencia}
            onChange={(e) => update('referencia', e.target.value)}
            placeholder="ORD-2024-1234"
          />
        </Field>
      </Section>

      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Detalles del movimiento..."
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
          Registrar movimiento
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