import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, FileText, Camera, Barcode, Hash, CheckCircle2,
  Layers, Grid3x3, Info, MousePointerClick, X, Package
} from 'lucide-react';
import BarcodeLib from 'react-barcode';
import { DocumentosUpload } from '../equipos/DocumentosUpload';
import { CamaraEquipo } from '../equipos/CamaraEquipo';
import { QRCodeSVG } from '../ui/QRCodeSVG';
import type { DocumentoEquipo } from '../../lib/storage';
import type { FotoEquipo } from '../../lib/storageFotos';

interface CableFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  cableId?: string;
}

const initialState = {
  id_cable: '',
  codigo_barras: '',
  nombre: '',
  tecnica_id: '',
  estado: 'disponible',
  observaciones: '',
  carro_id: '',
  num_bandeja: '',
  num_posicion: '',
  pos_x: null as number | null,
  pos_y: null as number | null,
};

export function CableForm({ onSuccess, onCancel, cableId }: CableFormProps) {
  const [form, setForm] = useState(initialState);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [carros, setCarros] = useState<any[]>([]);
  const [tecnicasError, setTecnicasError] = useState('');
  const [documentos, setDocumentos] = useState<DocumentoEquipo[]>([]);
  const [fotos, setFotos] = useState<FotoEquipo[]>([]);
  const [uploadKey, setUploadKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!cableId);
  const [error, setError] = useState('');
  const [barcodeTocado, setBarcodeTocado] = useState(false);

  const [cablesEnBandeja, setCablesEnBandeja] = useState<any[]>([]);
  const imgBandejaRef = useRef<HTMLImageElement>(null);
  const [marcandoFoto, setMarcandoFoto] = useState(false);

  // Auto-sincronizar código de barras
  useEffect(() => {
    if (barcodeTocado) return;
    if (form.id_cable) {
      setForm((f) => ({ ...f, codigo_barras: form.id_cable }));
    }
  }, [form.id_cable, barcodeTocado]);

  // Cargar técnicas y carros
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setTecnicasError('');
      const [t, c] = await Promise.all([
        supabase.from('tecnicas_ndt').select('id, codigo, nombre').eq('activa', true).order('codigo'),
        supabase.from('carros').select('*').eq('activo', true).order('codigo'),
      ]);

      if (cancelled) return;
      if (t.error) setTecnicasError(`No se pudieron cargar las técnicas: ${t.error.message}`);
      else setTecnicas(t.data ?? []);
      
      setCarros(c.data ?? []);
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Cargar cable si es edición
  useEffect(() => {
    if (!cableId) {
      setUploadKey(`tmp-cbl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return;
    }
    setUploadKey(cableId);

    supabase
      .from('cables')
      .select('*')
      .eq('id', cableId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (data) {
          setForm({
            id_cable: data.id_cable ?? '',
            codigo_barras: data.codigo_barras ?? '',
            nombre: data.nombre ?? '',
            tecnica_id: data.tecnica_id ?? '',
            estado: data.estado ?? 'disponible',
            observaciones: data.observaciones ?? '',
            carro_id: data.carro_id ?? '',
            num_bandeja: data.num_bandeja ?? '',
            num_posicion: data.num_posicion ?? '',
            pos_x: data.pos_x ?? null,
            pos_y: data.pos_y ?? null,
          });
          setBarcodeTocado(true);

          const docs: DocumentoEquipo[] = Array.isArray(data.documentos_urls) ? data.documentos_urls : [];
          setDocumentos(docs);
          const fts: FotoEquipo[] = Array.isArray(data.fotos_urls) ? data.fotos_urls : [];
          setFotos(fts);
        }
        setLoadingData(false);
      });
  }, [cableId]);

  // Cargar cables en la misma bandeja
  useEffect(() => {
    if (!form.carro_id || !form.num_bandeja) {
      setCablesEnBandeja([]);
      return;
    }
    supabase
      .from('cables')
      .select('id, id_cable, nombre, num_posicion, pos_x, pos_y')
      .eq('carro_id', form.carro_id)
      .eq('num_bandeja', Number(form.num_bandeja))
      .then(({ data }) => {
        const filtradas = (data ?? []).filter((c) => c.id !== cableId);
        setCablesEnBandeja(filtradas);
      });
  }, [form.carro_id, form.num_bandeja, cableId]);

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

  const cambiarIdCable = (valor: string) => {
    const upper = valor.toUpperCase();
    setForm((f) => {
      const debeSincronizar = !barcodeTocado || f.codigo_barras === f.id_cable;
      return {
        ...f,
        id_cable: upper,
        codigo_barras: debeSincronizar ? upper : f.codigo_barras,
      };
    });
  };

  const cambiarCodigoBarras = (valor: string) => {
    setBarcodeTocado(true);
    setForm((f) => ({ ...f, codigo_barras: valor }));
  };

  const igualarAlCodigo = () => {
    if (!form.id_cable) return;
    setForm((f) => ({ ...f, codigo_barras: f.id_cable }));
    setBarcodeTocado(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.id_cable.trim()) return setError('El ID de cable es obligatorio');
    if (!form.codigo_barras.trim()) return setError('El código de barras es obligatorio');
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');

    setLoading(true);

    const payload: any = {
      id_cable: form.id_cable.trim().toUpperCase(),
      codigo_barras: form.codigo_barras.trim(),
      nombre: form.nombre.trim(),
      tecnica_id: form.tecnica_id || null,
      estado: form.estado,
      observaciones: form.observaciones.trim() || null,
      carro_id: form.carro_id || null,
      num_bandeja: form.num_bandeja ? Number(form.num_bandeja) : null,
      num_posicion: form.num_posicion ? Number(form.num_posicion) : null,
      pos_x: form.pos_x,
      pos_y: form.pos_y,
      documentos_urls: documentos,
      fotos_urls: fotos,
      foto_url: fotos[0]?.url ?? null,
    };

    try {
      if (cableId) {
        const { error } = await supabase.from('cables').update(payload).eq('id', cableId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cables').insert(payload);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('cables_id_cable_key')) setError('Ya existe un cable con ese ID');
      else if (msg.includes('cables_codigo_barras_key')) setError('Ya existe un cable con ese código de barras');
      else if (msg.includes('row-level security')) setError('No tienes permisos para esta acción.');
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

  const barcodeSincronizado = form.id_cable && form.codigo_barras === form.id_cable;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {tecnicasError && (
        <div className="flex items-start gap-2 bg-airbus-orange/10 border border-airbus-orange/30 text-airbus-orange text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Técnicas NDT no disponibles</p>
            <p className="text-xs mt-0.5 opacity-80">{tecnicasError}</p>
          </div>
        </div>
      )}

      {/* FOTOS */}
      <Section title="Fotos del cable">
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
        />
      </Section>

      {/* IDENTIFICACIÓN */}
      <Section title="Identificación">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ID de cable *">
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 font-mono"
                value={form.id_cable}
                onChange={(e) => cambiarIdCable(e.target.value)}
                placeholder="CBL-0001"
                required
              />
            </div>
          </Field>

          <Field label="Código de barras *">
            <div className="relative">
              <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 pr-20 font-mono"
                value={form.codigo_barras}
                onChange={(e) => cambiarCodigoBarras(e.target.value)}
                placeholder="Igual que el ID de cable"
                required
              />
              {form.id_cable && form.codigo_barras !== form.id_cable && (
                <button
                  type="button"
                  onClick={igualarAlCodigo}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] bg-airbus-sky text-white rounded hover:bg-airbus-blue transition"
                  title="Usar el ID como código de barras"
                >
                  = ID
                </button>
              )}
            </div>
            {barcodeSincronizado && (
              <p className="mt-1 text-[10px] text-airbus-green flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Sincronizado con el ID
              </p>
            )}
            {form.codigo_barras && (
              <div className="mt-2 flex flex-col items-center bg-white border border-gray-200 rounded-lg p-2 gap-3">
                <BarcodeLib
                  value={form.codigo_barras}
                  format="CODE128"
                  displayValue={false}
                  height={38}
                  width={1.4}
                  margin={0}
                  lineColor="#00205B"
                />
                <div className="border-t border-gray-100 w-full pt-2 flex justify-center">
                  <QRCodeSVG value={form.codigo_barras} size={64} />
                </div>
              </div>
            )}
          </Field>

          <Field label="Nombre del cable *">
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Cable LEMO 00 a BNC"
              required
            />
          </Field>
        </div>
      </Section>

      {/* CLASIFICACIÓN */}
      <Section title="Clasificación">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Técnica NDT">
            <select
              className="input"
              value={form.tecnica_id}
              onChange={(e) => update('tecnica_id', e.target.value)}
              disabled={tecnicas.length === 0}
            >
              <option value="">— Sin asignar —</option>
              {tecnicas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} · {t.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado">
            <select
              className="input"
              value={form.estado}
              onChange={(e) => update('estado', e.target.value)}
            >
              <option value="disponible">Disponible</option>
              <option value="mantenimiento">En Reparación</option>
              <option value="baja">De Baja</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* UBICACIÓN EN EL CARRO */}
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
                  Marca sobre la foto dónde está el cable en la bandeja {form.num_bandeja}
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
                <p>Haz clic sobre la foto en el punto exacto donde está el cable.</p>
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
                      {form.id_cable || 'Nuevo'}
                    </div>
                  </div>
                </div>
              )}

              {cablesEnBandeja.map((p) => {
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
                        {p.id_cable}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-airbus-green border border-white shadow"></span>
                <span className="text-gray-500">Este cable</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-airbus-red border border-white shadow"></span>
                <span className="text-gray-500">Otros cables</span>
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
                const ocupante = cablesEnBandeja.find((p) => p.num_posicion === n);
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
                    title={ocupante ? `Ocupada por ${ocupante.id_cable}` : `Posición ${n}`}
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

      {/* DOCUMENTACIÓN */}
      <Section title="Documentación adjunta">
        <div className="flex items-start gap-2 mb-3 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3">
          <FileText className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Sube fichas técnicas, certificados u otros documentos del cable.
          </p>
        </div>
        <DocumentosUpload
          equipoId={uploadKey}
          documentos={documentos}
          onChange={setDocumentos}
        />
      </Section>

      {/* OBSERVACIONES */}
      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas adicionales sobre el cable..."
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
          {cableId ? 'Guardar cambios' : 'Crear cable'}
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