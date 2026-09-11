import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle } from 'lucide-react';

interface EquipoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  equipoId?: string; // si se pasa, modo edición
}

const initialState = {
  codigo_barras: '',
  nombre: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  tecnica_id: '',
  estado: 'disponible',
  ubicacion: '',
  fecha_adquisicion: '',
  vida_util_meses: '',
  proxima_calibracion: '',
  observaciones: '',
};

export function EquipoForm({ onSuccess, onCancel, equipoId }: EquipoFormProps) {
  const [form, setForm] = useState(initialState);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!equipoId);
  const [error, setError] = useState('');

  // Cargar técnicas
  useEffect(() => {
    supabase
      .from('tecnicas_ndt')
      .select('id, codigo, nombre')
      .eq('activa', true)
      .order('codigo')
      .then(({ data }) => setTecnicas(data ?? []));
  }, []);

  // Cargar equipo si estamos editando
  useEffect(() => {
    if (!equipoId) return;
    supabase
      .from('equipos')
      .select('*')
      .eq('id', equipoId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (data) {
          setForm({
            codigo_barras: data.codigo_barras ?? '',
            nombre: data.nombre ?? '',
            marca: data.marca ?? '',
            modelo: data.modelo ?? '',
            numero_serie: data.numero_serie ?? '',
            tecnica_id: data.tecnica_id ?? '',
            estado: data.estado ?? 'disponible',
            ubicacion: data.ubicacion ?? '',
            fecha_adquisicion: data.fecha_adquisicion ?? '',
            vida_util_meses: data.vida_util_meses?.toString() ?? '',
            proxima_calibracion: data.proxima_calibracion ?? '',
            observaciones: data.observaciones ?? '',
          });
        }
        setLoadingData(false);
      });
  }, [equipoId]);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validación básica
    if (!form.codigo_barras.trim()) return setError('El código de barras es obligatorio');
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');

    setLoading(true);

    const payload: any = {
      codigo_barras: form.codigo_barras.trim(),
      nombre: form.nombre.trim(),
      marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null,
      numero_serie: form.numero_serie.trim() || null,
      tecnica_id: form.tecnica_id || null,
      estado: form.estado,
      ubicacion: form.ubicacion.trim() || null,
      fecha_adquisicion: form.fecha_adquisicion || null,
      vida_util_meses: form.vida_util_meses ? Number(form.vida_util_meses) : null,
      proxima_calibracion: form.proxima_calibracion || null,
      observaciones: form.observaciones.trim() || null,
    };

    try {
      if (equipoId) {
        const { error } = await supabase.from('equipos').update(payload).eq('id', equipoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('equipos').insert(payload);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      // Mensajes de error de Postgres más legibles
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('equipos_codigo_barras_key'))
        setError('Ya existe un equipo con ese código de barras');
      else if (msg.includes('equipos_numero_serie_key'))
        setError('Ya existe un equipo con ese número de serie');
      else if (msg.includes('row-level security'))
        setError('No tienes permisos para esta acción. Contacta con un administrador.');
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
      {/* Sección: Identificación */}
      <Section title="Identificación">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Código de barras *">
            <input
              className="input"
              value={form.codigo_barras}
              onChange={(e) => update('codigo_barras', e.target.value)}
              placeholder="NDT-0001"
              required
            />
          </Field>
          <Field label="Nombre del equipo *">
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Detector de defectos por ultrasonidos"
              required
            />
          </Field>
          <Field label="Marca">
            <input className="input" value={form.marca} onChange={(e) => update('marca', e.target.value)} placeholder="Olympus" />
          </Field>
          <Field label="Modelo">
            <input className="input" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} placeholder="EPOCH 650" />
          </Field>
          <Field label="Número de serie">
            <input className="input" value={form.numero_serie} onChange={(e) => update('numero_serie', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Sección: Clasificación */}
      <Section title="Clasificación">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Técnica NDT">
            <select className="input" value={form.tecnica_id} onChange={(e) => update('tecnica_id', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {tecnicas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} · {t.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select className="input" value={form.estado} onChange={(e) => update('estado', e.target.value)}>
              <option value="disponible">Disponible</option>
              <option value="prestado">Prestado</option>
              <option value="calibracion">En calibración</option>
              <option value="mantenimiento">En mantenimiento</option>
              <option value="baja">Baja</option>
            </select>
          </Field>
          <Field label="Ubicación">
            <input className="input" value={form.ubicacion} onChange={(e) => update('ubicacion', e.target.value)} placeholder="Estante A-3" />
          </Field>
        </div>
      </Section>

      {/* Sección: Fechas */}
      <Section title="Fechas y vida útil">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fecha de adquisición">
            <input type="date" className="input" value={form.fecha_adquisicion} onChange={(e) => update('fecha_adquisicion', e.target.value)} />
          </Field>
          <Field label="Vida útil (meses)">
            <input type="number" min="0" className="input" value={form.vida_util_meses} onChange={(e) => update('vida_util_meses', e.target.value)} placeholder="60" />
          </Field>
          <Field label="Próxima calibración">
            <input type="date" className="input" value={form.proxima_calibracion} onChange={(e) => update('proxima_calibracion', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Sección: Notas */}
      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas adicionales sobre el equipo..."
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
          {equipoId ? 'Guardar cambios' : 'Crear equipo'}
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