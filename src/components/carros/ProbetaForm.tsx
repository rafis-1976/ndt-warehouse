import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle, Camera } from 'lucide-react';
import { CamaraEquipo } from '../equipos/CamaraEquipo';
import { BUCKET_PROBETAS, type FotoEquipo } from '../../lib/storageFotos';

interface ProbetaFormProps {
  probeta?: any;
  carroId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProbetaForm({ probeta, carroId, onSuccess, onCancel }: ProbetaFormProps) {
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [carros, setCarros] = useState<any[]>([]);
  const [fotos, setFotos] = useState<FotoEquipo[]>([]);
  const [uploadKey, setUploadKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!probeta);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    codigo: probeta?.codigo ?? '',
    nombre: probeta?.nombre ?? '',
    tipo: probeta?.tipo ?? '',
    tecnica_id: probeta?.tecnica_id ?? '',
    carro_id: probeta?.carro_id ?? carroId ?? '',
    material: probeta?.material ?? '',
    dimensiones: probeta?.dimensiones ?? '',
    numero_serie: probeta?.numero_serie ?? '',
    fecha_adquisicion: probeta?.fecha_adquisicion ?? '',
    proxima_calibracion: probeta?.proxima_calibracion ?? '',
    observaciones: probeta?.observaciones ?? '',
    activa: probeta?.activa ?? true,
  });

  useEffect(() => {
    Promise.all([
      supabase.from('tecnicas_ndt').select('id, codigo, nombre').eq('activa', true).order('codigo'),
      supabase.from('carros').select('id, codigo, nombre').eq('activo', true).order('codigo'),
    ]).then(([t, c]) => {
      setTecnicas(t.data ?? []);
      setCarros(c.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!probeta) {
      setUploadKey(`tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      setLoadingData(false);
      return;
    }

    setUploadKey(probeta.id);

    supabase
      .from('probetas')
      .select('*')
      .eq('id', probeta.id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (data) {
          setForm({
            codigo: data.codigo ?? '',
            nombre: data.nombre ?? '',
            tipo: data.tipo ?? '',
            tecnica_id: data.tecnica_id ?? '',
            carro_id: data.carro_id ?? '',
            material: data.material ?? '',
            dimensiones: data.dimensiones ?? '',
            numero_serie: data.numero_serie ?? '',
            fecha_adquisicion: data.fecha_adquisicion ?? '',
            proxima_calibracion: data.proxima_calibracion ?? '',
            observaciones: data.observaciones ?? '',
            activa: data.activa ?? true,
          });
          const fts: FotoEquipo[] = Array.isArray(data.fotos_urls) ? data.fotos_urls : [];
          setFotos(fts);
        }
        setLoadingData(false);
      });
  }, [probeta]);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.codigo.trim()) return setError('El código es obligatorio');
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');

    setLoading(true);
    try {
      const payload: any = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        tipo: form.tipo.trim() || null,
        tecnica_id: form.tecnica_id || null,
        carro_id: form.carro_id || null,
        material: form.material.trim() || null,
        dimensiones: form.dimensiones.trim() || null,
        numero_serie: form.numero_serie.trim() || null,
        fecha_adquisicion: form.fecha_adquisicion || null,
        proxima_calibracion: form.proxima_calibracion || null,
        observaciones: form.observaciones.trim() || null,
        activa: form.activa,
        fotos_urls: fotos,
        foto_url: fotos[0]?.url ?? null,
      };

      if (probeta) {
        const { error } = await supabase.from('probetas').update(payload).eq('id', probeta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('probetas').insert(payload);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('probetas_codigo_key')) setError('Ya existe una probeta con ese código');
      else if (msg.includes('row-level security')) setError('No tienes permisos para esta acción');
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
      <Section title="Fotos de la probeta">
        <div className="flex items-start gap-2 mb-3 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3">
          <Camera className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Haz una foto con la cámara o sube imágenes. Se puede recortar el fondo automáticamente.
          </p>
        </div>
        <CamaraEquipo
          equipoId={uploadKey}
          fotos={fotos}
          onChange={setFotos}
          bucket={BUCKET_PROBETAS}
        />
      </Section>

      <Section title="Identificación">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Código *">
            <input
              className="input font-mono"
              value={form.codigo}
              onChange={(e) => update('codigo', e.target.value.toUpperCase())}
              placeholder="PB-0001"
              required
            />
          </Field>
          <Field label="Nombre *">
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Bloque V1 acero"
              required
            />
          </Field>
          <Field label="Tipo">
            <input
              className="input"
              value={form.tipo}
              onChange={(e) => update('tipo', e.target.value)}
              placeholder="Bloque V1 / V2, penetrámetro, patrón ET..."
            />
          </Field>
          <Field label="Número de serie">
            <input
              className="input font-mono"
              value={form.numero_serie}
              onChange={(e) => update('numero_serie', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Clasificación">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Técnica NDT">
            <select
              className="input"
              value={form.tecnica_id}
              onChange={(e) => update('tecnica_id', e.target.value)}
            >
              <option value="">— Sin asignar —</option>
              {tecnicas.map((t) => (
                <option key={t.id} value={t.id}>{t.codigo} · {t.nombre}</option>
              ))}
            </select>
          </Field>
          <Field label="Carro">
            <select
              className="input"
              value={form.carro_id}
              onChange={(e) => update('carro_id', e.target.value)}
            >
              <option value="">— Sin asignar —</option>
              {carros.map((c) => (
                <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="input"
              value={form.activa ? 'activa' : 'inactiva'}
              onChange={(e) => update('activa', e.target.value === 'activa')}
            >
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Características">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Material">
            <input
              className="input"
              value={form.material}
              onChange={(e) => update('material', e.target.value)}
              placeholder="Acero al carbono, aluminio..."
            />
          </Field>
          <Field label="Dimensiones">
            <input
              className="input"
              value={form.dimensiones}
              onChange={(e) => update('dimensiones', e.target.value)}
              placeholder="100 x 50 x 25 mm"
            />
          </Field>
        </div>
      </Section>

      <Section title="Fechas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fecha de adquisición">
            <input
              type="date"
              className="input"
              value={form.fecha_adquisicion}
              onChange={(e) => update('fecha_adquisicion', e.target.value)}
            />
          </Field>
          <Field label="Próxima calibración">
            <input
              type="date"
              className="input"
              value={form.proxima_calibracion}
              onChange={(e) => update('proxima_calibracion', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas sobre la probeta..."
        />
      </Section>

      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-ghost border border-gray-300">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {probeta ? 'Guardar cambios' : 'Crear probeta'}
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