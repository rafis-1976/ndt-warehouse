import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, Package, CheckCircle2, Wrench,
} from 'lucide-react';

// ============================================================
// Props
// ============================================================
interface CalibracionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  /** Si se pasa, estamos COMPLETANDO un envío pendiente */
  calibracionId?: string;
  /** Equipo precargado (cuando venimos de una calibración pendiente) */
  equipoId?: string;
}

// ============================================================
// Componente
// ============================================================
export function CalibracionForm({
  onSuccess,
  onCancel,
  calibracionId,
  equipoId: equipoIdProp,
}: CalibracionFormProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [equipoInfo, setEquipoInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const esModoCompletar = !!calibracionId;

  const hoy = new Date().toISOString().split('T')[0];
  const enUnAno = new Date(Date.now() + 365 * 864e5).toISOString().split('T')[0];

  const [form, setForm] = useState({
    equipo_id: equipoIdProp ?? '',
    fecha_calibracion: hoy,
    fecha_proxima: enUnAno,
    laboratorio: '',
    numero_certificado: '',
    resultado: 'aprobado',
    observaciones: '',
  });

  // ============================================================
  // Cargar datos
  // ============================================================
  useEffect(() => {
    async function load() {
      // Si estamos completando, cargar la calibración existente + el equipo
      if (calibracionId) {
        const [calRes, eqRes] = await Promise.all([
          supabase.from('calibraciones').select('*').eq('id', calibracionId).single(),
          equipoIdProp
            ? supabase
                .from('equipos')
                .select('id, id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo, nombre)')
                .eq('id', equipoIdProp)
                .single()
            : Promise.resolve({ data: null, error: null } as any),
        ]);

        if (calRes.error) {
          setError(calRes.error.message);
        } else if (calRes.data) {
          setForm({
            equipo_id: calRes.data.equipo_id,
            fecha_calibracion: hoy,
            fecha_proxima: enUnAno,
            laboratorio: calRes.data.laboratorio ?? '',
            numero_certificado: calRes.data.numero_certificado ?? '',
            resultado: calRes.data.resultado ?? 'aprobado',
            observaciones: calRes.data.observaciones ?? '',
          });
        }

        if (eqRes.data) setEquipoInfo(eqRes.data);
        setLoadingData(false);
        return;
      }

      // Modo normal: cargar todos los equipos
      const { data } = await supabase
        .from('equipos')
        .select('id, id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo, nombre)')
        .order('nombre');
      setEquipos(data ?? []);
      setLoadingData(false);
    }
    load();
  }, [calibracionId, equipoIdProp]);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Al elegir equipo en modo normal, mostrar su info
  const handleEquipoChange = (id: string) => {
    update('equipo_id', id);
    const eq = equipos.find((e) => e.id === id);
    setEquipoInfo(eq ?? null);
  };

  // ============================================================
  // Enviar
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.equipo_id) return setError('Selecciona un equipo');
    if (!form.fecha_calibracion) return setError('Indica la fecha de calibración');
    if (!form.fecha_proxima) return setError('Indica la próxima fecha');

    setLoading(true);
    try {
      if (esModoCompletar && calibracionId) {
        // 1a. Actualizar la calibración existente
        const { error: updCalErr } = await supabase
          .from('calibraciones')
          .update({
            fecha_calibracion: form.fecha_calibracion,
            fecha_proxima: form.fecha_proxima,
            laboratorio: form.laboratorio.trim() || null,
            numero_certificado: form.numero_certificado.trim() || null,
            resultado: form.resultado,
            observaciones: form.observaciones.trim() || null,
            estado: 'completada',
            fecha_recepcion: new Date().toISOString(),
          })
          .eq('id', calibracionId);
        if (updCalErr) throw updCalErr;
      } else {
        // 1b. Crear nueva calibración (directa, ya completada)
        const { error: insErr } = await supabase.from('calibraciones').insert({
          equipo_id: form.equipo_id,
          fecha_calibracion: form.fecha_calibracion,
          fecha_proxima: form.fecha_proxima,
          laboratorio: form.laboratorio.trim() || null,
          numero_certificado: form.numero_certificado.trim() || null,
          resultado: form.resultado,
          observaciones: form.observaciones.trim() || null,
          estado: 'completada',
        });
        if (insErr) throw insErr;
      }

      // 2. Actualizar el equipo: nueva fecha de calibración + estado disponible
      const nuevoEstado = form.resultado === 'rechazado' ? 'baja' : 'disponible';
      const { error: updEqErr } = await supabase
        .from('equipos')
        .update({
          ultima_calibracion: form.fecha_calibracion,
          proxima_calibracion: form.fecha_proxima,
          estado: nuevoEstado,
        })
        .eq('id', form.equipo_id);
      if (updEqErr) throw updEqErr;

      // 3. Registrar movimiento de entrada
      await supabase.from('movimientos').insert({
        equipo_id: form.equipo_id,
        tipo: 'entrada',
        observaciones: `Calibración completada (${form.resultado})`,
      });

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

  // ============================================================
  // Loading
  // ============================================================
  if (loadingData) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-airbus-sky" />
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Banner de modo */}
      {esModoCompletar && (
        <div className="bg-airbus-sky/10 border border-airbus-sky/30 rounded-xl p-3 flex items-start gap-3">
          <Wrench className="w-5 h-5 text-airbus-sky shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-airbus-blue">
              Completar calibración pendiente
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Rellena los datos del certificado para devolver el equipo al servicio.
            </p>
          </div>
        </div>
      )}

      {/* Info del equipo */}
      {equipoInfo && (
        <div className="bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-airbus-light opacity-90">
                {equipoInfo.id_equipo}
              </p>
              <p className="font-semibold text-sm truncate">{equipoInfo.nombre}</p>
              <p className="text-xs text-airbus-light opacity-80 font-mono">
                {equipoInfo.codigo_barras}
              </p>
            </div>
            {equipoInfo.tecnicas_ndt?.codigo && (
              <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-medium shrink-0">
                {equipoInfo.tecnicas_ndt.codigo}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Selector de equipo (solo en modo normal) */}
      {!esModoCompletar && (
        <Section title="Equipo">
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
                  {eq.id_equipo ? `[${eq.id_equipo}] ` : ''}
                  {eq.nombre} · {eq.codigo_barras}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      )}

      {/* Fechas */}
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

      {/* Certificado */}
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
          <Field label="Nº certificado">
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

        {form.resultado === 'rechazado' && (
          <div className="mt-3 flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/30 text-airbus-red text-xs p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Resultado: Rechazado</p>
              <p className="opacity-80 mt-0.5">
                El equipo pasará automáticamente a estado <strong>Baja</strong>.
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* Observaciones */}
      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas, incidencias, desviaciones..."
        />
      </Section>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost border border-gray-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : esModoCompletar ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {esModoCompletar ? 'Completar y devolver al servicio' : 'Registrar calibración'}
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