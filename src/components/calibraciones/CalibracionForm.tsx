import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle } from 'lucide-react';

interface CalibracionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CalibracionForm({ onSuccess, onCancel }: CalibracionFormProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const hoy = new Date().toISOString().split('T')[0];
  const enUnAno = new Date(Date.now() + 365 * 864e5).toISOString().split('T')[0];

  const [form, setForm] = useState({
    equipo_id: '',
    fecha_calibracion: hoy,
    fecha_proxima: enUnAno,
    laboratorio: '',
    numero_certificado: '',
    resultado: 'aprobado',
    observaciones: '',
  });

  useEffect(() => {
    supabase
      .from('equipos')
      .select('id, id_equipo, nombre, codigo_barras')
      .order('nombre')
      .then(({ data }) => {
        setEquipos(data ?? []);
        setLoadingData(false);
      });
  }, []);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.equipo_id)         return setError('Selecciona un equipo');
    if (!form.fecha_calibracion) return setError('Indica la fecha de calibración');
    if (!form.fecha_proxima)     return setError('Indica la próxima fecha de calibración');

    setLoading(true);

    try {
      // 1. Crear el registro de calibración
      const { error: insErr } = await supabase.from('calibraciones').insert({
        equipo_id: form.equipo_id,
        fecha_calibracion: form.fecha_calibracion,
        fecha_proxima: form.fecha_proxima,
        laboratorio: form.laboratorio.trim() || null,
        numero_certificado: form.numero_certificado.trim() || null,
        resultado: form.resultado,
        observaciones: form.observaciones.trim() || null,
      });
      if (insErr) throw insErr;

      // 2. Actualizar el equipo con las nuevas fechas
      const { error: updErr } = await supabase
        .from('equipos')
        .update({
          ultima_calibracion: form.fecha_calibracion,
          proxima_calibracion: form.fecha_proxima,
        })
        .eq('id', form.equipo_id);
      if (updErr) throw updErr;

      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('row-level security'))
        setError('No tienes permisos para registrar calibraciones.');
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
      <Section title="Equipo">
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
      </Section>

      <Section title="Fechas de calibración">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fecha de calibración *">
            <input
              type="date"
              className="input"
              value={form.fecha_calibracion}
              onChange={(e) => update('fecha_calibracion', e.target.value)}
              required
            />
          </Field>
          <Field label="Próxima calibración *">
            <input
              type="date"
              className="input"
              value={form.fecha_proxima}
              onChange={(e) => update('fecha_proxima', e.target.value)}
              required
            />
          </Field>
        </div>
      </Section>

      <Section title="Certificado">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Laboratorio">
            <input
              className="input"
              value={form.laboratorio}
              onChange={(e) => update('laboratorio', e.target.value)}
              placeholder="Applus, Bureau Veritas..."
            />
          </Field>
          <Field label="Nº de certificado">
            <input
              className="input font-mono"
              value={form.numero_certificado}
              onChange={(e) => update('numero_certificado', e.target.value)}
              placeholder="CAL-2024-0001"
            />
          </Field>
          <Field label="Resultado">
            <select
              className="input"
              value={form.resultado}
              onChange={(e) => update('resultado', e.target.value)}
            >
              <option value="aprobado">Aprobado</option>
              <option value="condicional">Condicional</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas, incidencias, desviaciones..."
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
          Registrar calibración
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