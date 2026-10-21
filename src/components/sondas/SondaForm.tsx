import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, FileText, Camera, Barcode, Hash, CheckCircle2
} from 'lucide-react';
import BarcodeLib from 'react-barcode';
import { DocumentosUpload } from '../equipos/DocumentosUpload';
import { CamaraEquipo } from '../equipos/CamaraEquipo';
import type { DocumentoEquipo } from '../../lib/storage';
import type { FotoEquipo } from '../../lib/storageFotos';

interface SondaFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  sondaId?: string; // UUID
}

const initialState = {
  id_sonda: '',
  codigo_barras: '',
  nombre: '',
  tecnica_id: '',
  estado: 'disponible',
  observaciones: '',
};

export function SondaForm({ onSuccess, onCancel, sondaId }: SondaFormProps) {
  const [form, setForm] = useState(initialState);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [tecnicasError, setTecnicasError] = useState('');
  const [documentos, setDocumentos] = useState<DocumentoEquipo[]>([]);
  const [fotos, setFotos] = useState<FotoEquipo[]>([]);
  const [uploadKey, setUploadKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!sondaId);
  const [error, setError] = useState('');
  const [barcodeTocado, setBarcodeTocado] = useState(false);

  // Auto-sincronizar código de barras con ID
  useEffect(() => {
    if (barcodeTocado) return;
    if (form.id_sonda) {
      setForm((f) => ({ ...f, codigo_barras: form.id_sonda }));
    }
  }, [form.id_sonda, barcodeTocado]);

  // Cargar técnicas
  useEffect(() => {
    let cancelled = false;
    async function loadTecnicas() {
      setTecnicasError('');
      const { data, error } = await supabase
        .from('tecnicas_ndt')
        .select('id, codigo, nombre')
        .eq('activa', true)
        .order('codigo');

      if (cancelled) return;
      if (error) {
        setTecnicasError(`No se pudieron cargar las técnicas: ${error.message}`);
        return;
      }
      setTecnicas(data ?? []);
    }
    loadTecnicas();
    return () => { cancelled = true; };
  }, []);

  // Cargar sonda si es edición
  useEffect(() => {
    if (!sondaId) {
      setUploadKey(`tmp-snd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return;
    }
    setUploadKey(sondaId);

    supabase
      .from('sondas')
      .select('*')
      .eq('id', sondaId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (data) {
          setForm({
            id_sonda: data.id_sonda ?? '',
            codigo_barras: data.codigo_barras ?? '',
            nombre: data.nombre ?? '',
            tecnica_id: data.tecnica_id ?? '',
            estado: data.estado ?? 'disponible',
            observaciones: data.observaciones ?? '',
          });
          setBarcodeTocado(true); // Evitar sobreescribir al cargar

          const docs: DocumentoEquipo[] = Array.isArray(data.documentos_urls) ? data.documentos_urls : [];
          setDocumentos(docs);
          const fts: FotoEquipo[] = Array.isArray(data.fotos_urls) ? data.fotos_urls : [];
          setFotos(fts);
        }
        setLoadingData(false);
      });
  }, [sondaId]);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const cambiarIdSonda = (valor: string) => {
    const upper = valor.toUpperCase();
    setForm((f) => {
      const debeSincronizar = !barcodeTocado || f.codigo_barras === f.id_sonda;
      return {
        ...f,
        id_sonda: upper,
        codigo_barras: debeSincronizar ? upper : f.codigo_barras,
      };
    });
  };

  const cambiarCodigoBarras = (valor: string) => {
    setBarcodeTocado(true);
    setForm((f) => ({ ...f, codigo_barras: valor }));
  };

  const igualarAlCodigo = () => {
    if (!form.id_sonda) return;
    setForm((f) => ({ ...f, codigo_barras: f.id_sonda }));
    setBarcodeTocado(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.id_sonda.trim()) return setError('El ID de sonda es obligatorio');
    if (!form.codigo_barras.trim()) return setError('El código de barras es obligatorio');
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');

    setLoading(true);

    const payload: any = {
      id_sonda: form.id_sonda.trim().toUpperCase(),
      codigo_barras: form.codigo_barras.trim(),
      nombre: form.nombre.trim(),
      tecnica_id: form.tecnica_id || null,
      estado: form.estado,
      observaciones: form.observaciones.trim() || null,
      documentos_urls: documentos,
      fotos_urls: fotos,
      foto_url: fotos[0]?.url ?? null,
    };

    try {
      if (sondaId) {
        const { error } = await supabase.from('sondas').update(payload).eq('id', sondaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sondas').insert(payload);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('sondas_id_sonda_key')) setError('Ya existe una sonda con ese ID');
      else if (msg.includes('sondas_codigo_barras_key')) setError('Ya existe una sonda con ese código de barras');
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

  const barcodeSincronizado = form.id_sonda && form.codigo_barras === form.id_sonda;

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
      <Section title="Fotos de la sonda">
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
          <Field label="ID de sonda *">
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 font-mono"
                value={form.id_sonda}
                onChange={(e) => cambiarIdSonda(e.target.value)}
                placeholder="SND-0001"
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
                placeholder="Igual que el ID de sonda"
                required
              />
              {form.id_sonda && form.codigo_barras !== form.id_sonda && (
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
              <div className="mt-2 flex justify-center bg-white border border-gray-200 rounded-lg p-2">
                <BarcodeLib
                  value={form.codigo_barras}
                  format="CODE128"
                  displayValue={false}
                  height={38}
                  width={1.4}
                  margin={0}
                  lineColor="#00205B"
                />
              </div>
            )}
          </Field>

          <Field label="Nombre de la sonda *">
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Sonda angular 45º 5MHz"
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

      {/* DOCUMENTACIÓN */}
      <Section title="Documentación adjunta">
        <div className="flex items-start gap-2 mb-3 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3">
          <FileText className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Sube fichas técnicas, certificados u otros documentos de la sonda.
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
          placeholder="Notas adicionales sobre la sonda..."
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
          {sondaId ? 'Guardar cambios' : 'Crear sonda'}
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