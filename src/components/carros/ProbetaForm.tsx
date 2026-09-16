import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, Camera, Layers, Grid3x3, Info,
  MousePointerClick, X, Package,
} from 'lucide-react';
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
  const [probetasEnBandeja, setProbetasEnBandeja] = useState<any[]>([]);

  const imgBandejaRef = useRef<HTMLImageElement>(null);
  const [marcandoFoto, setMarcandoFoto] = useState(false);

  const [form, setForm] = useState({
    codigo: probeta?.codigo ?? '',
    nombre: probeta?.nombre ?? '',
    tipo: probeta?.tipo ?? '',
    tecnica_id: probeta?.tecnica_id ?? '',
    carro_id: probeta?.carro_id ?? carroId ?? '',
    num_bandeja: probeta?.num_bandeja ?? '',
    num_posicion: probeta?.num_posicion ?? '',
    pos_x: probeta?.pos_x ?? null,
    pos_y: probeta?.pos_y ?? null,
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
      supabase.from('carros').select('*').eq('activo', true).order('codigo'),
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
            num_bandeja: data.num_bandeja ?? '',
            num_posicion: data.num_posicion ?? '',
            pos_x: data.pos_x ?? null,
            pos_y: data.pos_y ?? null,
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

  useEffect(() => {
    if (!form.carro_id || !form.num_bandeja) {
      setProbetasEnBandeja([]);
      return;
    }
    supabase
      .from('probetas')
      .select('id, codigo, nombre, num_posicion, pos_x, pos_y')
      .eq('carro_id', form.carro_id)
      .eq('num_bandeja', Number(form.num_bandeja))
      .then(({ data }) => {
        const filtradas = (data ?? []).filter((p) => p.id !== probeta?.id);
        setProbetasEnBandeja(filtradas);
      });
  }, [form.carro_id, form.num_bandeja, probeta?.id]);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const carroSeleccionado = carros.find((c) => c.id === form.carro_id);
  const bandejasDisponibles = carroSeleccionado?.num_bandejas ?? 0;
  const posicionesDisponibles = carroSeleccionado?.posiciones_por_bandeja ?? 0;

  const fotoBandeja = carroSeleccionado?.bandejas_fotos?.find?.(
    (f: any) => f.num_bandeja === Number(form.num_bandeja)
  );

  const handleCarroChange = (id: string) => {
    setForm((f) => ({ ...f, carro_id: id, num_bandeja: '', num_posicion: '', pos_x: null, pos_y: null }));
  };

  const handleBandejaChange = (n: string) => {
    setForm((f) => ({ ...f, num_bandeja: n, num_posicion: '', pos_x: null, pos_y: null }));
  };

  const handleClickFoto = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!marcandoFoto) return;
    const img = imgBandejaRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setForm((f) => ({
      ...f,
      pos_x: Math.max(0, Math.min(1, Number(x.toFixed(4)))),
      pos_y: Math.max(0, Math.min(1, Number(y.toFixed(4)))),
    }));
  };

  const limpiarPosicion = () => {
    setForm((f) => ({ ...f, pos_x: null, pos_y: null, num_posicion: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.codigo.trim()) return setError('El código es obligatorio');
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');

    if (form.num_bandeja && bandejasDisponibles > 0) {
      const n = Number(form.num_bandeja);
      if (n < 1 || n > bandejasDisponibles) {
        return setError(`La bandeja debe estar entre 1 y ${bandejasDisponibles}`);
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        tipo: form.tipo.trim() || null,
        tecnica_id: form.tecnica_id || null,
        carro_id: form.carro_id || null,
        num_bandeja: form.num_bandeja ? Number(form.num_bandeja) : null,
        num_posicion: form.num_posicion ? Number(form.num_posicion) : null,
        pos_x: form.pos_x,
        pos_y: form.pos_y,
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
            Haz una foto o sube imágenes. Puedes recortar manualmente o quitar el fondo con IA.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <Section title="Ubicación en el carro">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Carro">
            <select
              className="input"
              value={form.carro_id}
              onChange={(e) => handleCarroChange(e.target.value)}
            >
              <option value="">— Sin asignar —</option>
              {carros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Bandeja">
            <select
              className="input"
              value={form.num_bandeja}
              onChange={(e) => handleBandejaChange(e.target.value)}
              disabled={!carroSeleccionado || bandejasDisponibles === 0}
            >
              <option value="">
                {!carroSeleccionado
                  ? '— Primero elige carro —'
                  : bandejasDisponibles === 0
                    ? '— Carro sin bandejas —'
                    : '— Sin asignar —'}
              </option>
              {carroSeleccionado && Array.from({ length: bandejasDisponibles }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Bandeja {n}</option>
              ))}
            </select>
          </Field>

          <Field label="Posición numérica (opcional)">
            <select
              className="input"
              value={form.num_posicion}
              onChange={(e) => update('num_posicion', e.target.value)}
              disabled={!form.num_bandeja || posicionesDisponibles === 0 || !!fotoBandeja}
            >
              <option value="">
                {!form.num_bandeja
                  ? '— Primero bandeja —'
                  : fotoBandeja
                    ? '— Usa la foto —'
                    : '— Sin asignar —'}
              </option>
              {!fotoBandeja && form.num_bandeja && Array.from({ length: posicionesDisponibles }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Posición {n}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {fotoBandeja ? (
          <div className="mt-4 bg-white border-2 border-airbus-sky/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-airbus-sky" />
                <span className="text-xs font-semibold text-airbus-blue">
                  Marca sobre la foto dónde está la probeta en la bandeja {form.num_bandeja}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {form.pos_x !== null && form.pos_y !== null && (
                  <button
                    type="button"
                    onClick={limpiarPosicion}
                    className="text-[11px] text-airbus-red hover:bg-airbus-red/10 px-2 py-1 rounded transition flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Quitar marca
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMarcandoFoto(!marcandoFoto)}
                  className={`text-[11px] px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                    marcandoFoto
                      ? 'bg-airbus-sky text-white'
                      : 'bg-airbus-sky/10 text-airbus-sky hover:bg-airbus-sky/20'
                  }`}
                >
                  <MousePointerClick className="w-3.5 h-3.5" />
                  {marcandoFoto ? 'Marcando...' : 'Activar marcado'}
                </button>
              </div>
            </div>

            {marcandoFoto && (
              <div className="mb-3 flex items-center gap-2 bg-airbus-sky/10 border border-airbus-sky/30 text-airbus-sky text-xs p-2.5 rounded-lg">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <p>
                  Haz clic sobre la foto en el punto exacto donde está la probeta.
                </p>
              </div>
            )}

            <div className="relative inline-block w-full">
              <img
                ref={imgBandejaRef}
                src={fotoBandeja.url}
                alt={`Bandeja ${form.num_bandeja}`}
                onClick={handleClickFoto}
                className={`w-full h-auto rounded-lg border border-gray-200 select-none ${
                  marcandoFoto ? 'cursor-crosshair' : 'cursor-default'
                }`}
                draggable={false}
              />

              {form.pos_x !== null && form.pos_y !== null && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${Number(form.pos_x) * 100}%`,
                    top: `${Number(form.pos_y) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 -m-4 rounded-full bg-airbus-green/30 animate-ping" />
                    <div className="relative w-8 h-8 rounded-full bg-airbus-green border-[3px] border-white shadow-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-white" />
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-airbus-green text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                      {form.codigo || 'Nueva'}
                    </div>
                  </div>
                </div>
              )}

              {probetasEnBandeja.map((p) => {
                if (p.pos_x === null || p.pos_y === null) return null;
                return (
                  <div
                    key={p.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${Number(p.pos_x) * 100}%`,
                      top: `${Number(p.pos_y) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="relative">
                      <div className="w-6 h-6 rounded-full bg-airbus-red border-2 border-white shadow-md flex items-center justify-center opacity-90">
                        <Package className="w-3 h-3 text-white" />
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 bg-airbus-red text-white text-[8px] font-bold px-1 py-0.5 rounded whitespace-nowrap">
                        {p.codigo}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-airbus-green border border-white shadow"></span>
                <span className="text-gray-500">Esta probeta</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-airbus-red border border-white shadow"></span>
                <span className="text-gray-500">Otras probetas</span>
              </div>
              {form.pos_x !== null && (
                <span className="ml-auto text-gray-400 font-mono">
                  x: {(Number(form.pos_x) * 100).toFixed(1)}% · y: {(Number(form.pos_y) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ) : carroSeleccionado && form.num_bandeja && posicionesDisponibles > 0 ? (
          <div className="mt-4 bg-white border-2 border-airbus-sky/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Grid3x3 className="w-4 h-4 text-airbus-sky" />
              <span className="text-xs font-semibold text-airbus-blue">
                Mapa de la bandeja {form.num_bandeja}
              </span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
              {Array.from({ length: posicionesDisponibles }, (_, i) => i + 1).map((n) => {
                const ocupante = probetasEnBandeja.find((p) => p.num_posicion === n);
                const seleccionada = Number(form.num_posicion) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => !ocupante && update('num_posicion', String(n))}
                    disabled={!!ocupante}
                    className={`aspect-square rounded-md border-2 text-xs font-bold transition ${
                      seleccionada
                        ? 'bg-airbus-green text-white border-airbus-green shadow-md'
                        : ocupante
                          ? 'bg-airbus-red/10 text-airbus-red border-airbus-red/40 cursor-not-allowed'
                          : 'bg-airbus-sky/10 text-airbus-sky border-airbus-sky/40 hover:border-airbus-sky hover:bg-airbus-sky/20'
                    }`}
                    title={ocupante ? `Ocupada por ${ocupante.codigo}` : `Posición ${n}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ) : carroSeleccionado && form.num_bandeja && !fotoBandeja && posicionesDisponibles === 0 ? (
          <div className="mt-3 flex items-start gap-2 bg-airbus-orange/10 border border-airbus-orange/30 text-airbus-orange text-xs p-3 rounded-lg">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>
              La bandeja {form.num_bandeja} no tiene foto ni posiciones definidas. Añade una foto desde la edición del carro para poder marcar la ubicación visualmente.
            </p>
          </div>
        ) : null}
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