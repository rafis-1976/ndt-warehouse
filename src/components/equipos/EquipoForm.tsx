import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, AlertTriangle, Wrench, CheckCircle2, FileText,
} from 'lucide-react';
import { estadoCalibracion } from '../../lib/calibracion';
import { DocumentosUpload } from './DocumentosUpload';
import type { DocumentoEquipo } from '../../lib/storage';

interface EquipoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  equipoId?: string;
}

const initialState = {
  id_equipo: '',
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
  const [tecnicasError, setTecnicasError] = useState('');
  const [documentos, setDocumentos] = useState<DocumentoEquipo[]>([]);
  const [uploadKey, setUploadKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!equipoId);
  const [enviandoCalibrar, setEnviandoCalibrar] = useState(false);
  const [error, setError] = useState('');
  const [avisoExito, setAvisoExito] = useState('');

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
      if (!data || data.length === 0) {
        setTecnicasError('No hay técnicas NDT registradas.');
        return;
      }
      setTecnicas(data);
    }
    loadTecnicas();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!equipoId) {
      // Nuevo equipo: generar ID temporal para el storage
      setUploadKey(`tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return;
    }
    setUploadKey(equipoId);

    supabase
      .from('equipos')
      .select('*')
      .eq('id', equipoId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (data) {
          setForm({
            id_equipo: data.id_equipo ?? '',
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
          // Cargar documentos existentes
          const docs: DocumentoEquipo[] = Array.isArray(data.documentos_urls)
            ? data.documentos_urls
            : [];
          setDocumentos(docs);
        }
        setLoadingData(false);
      });
  }, [equipoId]);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const calibracionVencida =
    !!form.proxima_calibracion && new Date(form.proxima_calibracion) < new Date();

  const calibracionProxima =
    !!form.proxima_calibracion &&
    !calibracionVencida &&
    estadoCalibracion(form.proxima_calibracion) === 'proxima';

  const puedeEnviarACalibrar =
    !!equipoId &&
    (calibracionVencida || calibracionProxima) &&
    form.estado !== 'calibracion' &&
    form.estado !== 'baja';

  const handleEnviarACalibrar = async () => {
    if (!equipoId) return;
    const confirmar = confirm(
      `¿Marcar "${form.nombre}" como EN CALIBRACIÓN?\n\n` +
        `El equipo quedará bloqueado para préstamos y aparecerá en el listado ` +
        `de "Equipos en calibración".`
    );
    if (!confirmar) return;

    setEnviandoCalibrar(true);
    setError('');
    setAvisoExito('');

    try {
      const { error: updErr } = await supabase
        .from('equipos')
        .update({ estado: 'calibracion' })
        .eq('id', equipoId);
      if (updErr) throw updErr;

      const { data: existente } = await supabase
        .from('calibraciones')
        .select('id')
        .eq('equipo_id', equipoId)
        .eq('estado', 'pendiente')
        .maybeSingle();

      if (!existente) {
        const { error: insErr } = await supabase.from('calibraciones').insert({
          equipo_id: equipoId,
          estado: 'pendiente',
          fecha_envio: new Date().toISOString(),
          observaciones: 'Enviado a calibrar desde gestión de equipos',
        });
        if (insErr) throw insErr;
      }

      await supabase.from('movimientos').insert({
        equipo_id: equipoId,
        tipo: 'salida',
        observaciones: 'Equipo enviado a calibración',
      });

      setForm((f) => ({ ...f, estado: 'calibracion' }));
      setAvisoExito('✅ Equipo enviado a calibración.');

      setTimeout(() => { onSuccess(); }, 1500);
    } catch (err: any) {
      setError(err.message ?? 'Error al enviar a calibrar');
    } finally {
      setEnviandoCalibrar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.id_equipo.trim()) return setError('El ID de equipo es obligatorio');
    if (!form.codigo_barras.trim()) return setError('El código de barras es obligatorio');
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');

    if (calibracionVencida) {
      const estadosPermitidos = ['baja', 'calibracion', 'pendiente_calibracion', 'mantenimiento'];
      if (!estadosPermitidos.includes(form.estado)) {
        return setError(
          'La calibración está vencida. El estado debe ser "Pendiente de Calibración", ' +
            '"En calibración", "En mantenimiento" o "Baja".'
        );
      }
    }

    setLoading(true);

    const payload: any = {
      id_equipo: form.id_equipo.trim().toUpperCase(),
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
      documentos_urls: documentos,
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
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('equipos_id_equipo_key')) setError('Ya existe un equipo con ese ID');
      else if (msg.includes('equipos_codigo_barras_key')) setError('Ya existe un equipo con ese código de barras');
      else if (msg.includes('equipos_numero_serie_key')) setError('Ya existe un equipo con ese número de serie');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {tecnicasError && (
        <div className="flex items-start gap-2 bg-airbus-orange/10 border border-airbus-orange/30 text-airbus-orange text-sm p-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Técnicas NDT no disponibles</p>
            <p className="text-xs mt-0.5 opacity-80">{tecnicasError}</p>
          </div>
        </div>
      )}

      {calibracionVencida && puedeEnviarACalibrar && (
        <div className="bg-gradient-to-r from-airbus-red to-airbus-orange rounded-xl p-4 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Calibración vencida</p>
              <p className="text-white/90 text-xs mt-1">
                Vencida el <strong>{form.proxima_calibracion}</strong>. Este equipo no puede prestarse.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnviarACalibrar}
              disabled={enviandoCalibrar}
              className="bg-white text-airbus-red px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-airbus-light transition flex items-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-60 shrink-0"
            >
              {enviandoCalibrar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              Enviar a calibrar
            </button>
          </div>
        </div>
      )}

      {form.estado === 'calibracion' && equipoId && (
        <div className="bg-airbus-yellow/15 border border-airbus-yellow/40 rounded-xl p-4 flex items-start gap-3">
          <Wrench className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">Equipo en calibración</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Regístralo en <strong>Calibraciones → En calibración</strong> cuando vuelva.
            </p>
          </div>
        </div>
      )}

      {calibracionProxima && form.estado !== 'calibracion' && (
        <div className="bg-airbus-orange/10 border border-airbus-orange/30 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-airbus-orange shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-airbus-orange">Calibración próxima a vencer</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Vence el <strong>{form.proxima_calibracion}</strong>.
            </p>
          </div>
        </div>
      )}

      {avisoExito && (
        <div className="flex items-start gap-2 bg-airbus-green/10 border border-airbus-green/30 text-airbus-green text-sm p-3 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-medium">{avisoExito}</p>
        </div>
      )}

      <Section title="Identificación">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="ID de equipo *">
            <input className="input font-mono" value={form.id_equipo}
              onChange={(e) => update('id_equipo', e.target.value.toUpperCase())}
              placeholder="EQ-0001" required />
          </Field>
          <Field label="Código de barras *">
            <input className="input font-mono" value={form.codigo_barras}
              onChange={(e) => update('codigo_barras', e.target.value)}
              placeholder="NDT-0001" required />
          </Field>
          <Field label="Nombre del equipo *">
            <input className="input" value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Detector de defectos por ultrasonidos" required />
          </Field>
          <Field label="Número de serie">
            <input className="input font-mono" value={form.numero_serie}
              onChange={(e) => update('numero_serie', e.target.value)} />
          </Field>
          <Field label="Marca">
            <input className="input" value={form.marca}
              onChange={(e) => update('marca', e.target.value)} placeholder="Olympus" />
          </Field>
          <Field label="Modelo">
            <input className="input" value={form.modelo}
              onChange={(e) => update('modelo', e.target.value)} placeholder="EPOCH 650" />
          </Field>
        </div>
      </Section>

      <Section title="Clasificación">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Técnica NDT">
            <select className="input" value={form.tecnica_id}
              onChange={(e) => update('tecnica_id', e.target.value)}
              disabled={tecnicas.length === 0}>
              <option value="">— Sin asignar —</option>
              {tecnicas.map((t) => (
                <option key={t.id} value={t.id}>{t.codigo} · {t.nombre}</option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select className="input" value={form.estado}
              onChange={(e) => update('estado', e.target.value)}>
              <option value="disponible" disabled={calibracionVencida}>Disponible</option>
              <option value="prestado" disabled={calibracionVencida}>Prestado</option>
              <option value="calibracion">En calibración</option>
              <option value="pendiente_calibracion">Pendiente de Calibración</option>
              <option value="mantenimiento">En mantenimiento</option>
              <option value="baja">Baja</option>
            </select>
          </Field>
          <Field label="Ubicación">
            <input className="input" value={form.ubicacion}
              onChange={(e) => update('ubicacion', e.target.value)}
              placeholder="Estante A-3" />
          </Field>
        </div>
      </Section>

      <Section title="Fechas y vida útil">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fecha de adquisición">
            <input type="date" className="input" value={form.fecha_adquisicion}
              onChange={(e) => update('fecha_adquisicion', e.target.value)} />
          </Field>
          <Field label="Vida útil (meses)">
            <input type="number" min="0" className="input" value={form.vida_util_meses}
              onChange={(e) => update('vida_util_meses', e.target.value)} placeholder="60" />
          </Field>
          <Field label="Próxima calibración">
            <input type="date"
              className={`input ${calibracionVencida ? 'border-airbus-red' : calibracionProxima ? 'border-airbus-orange' : ''}`}
              value={form.proxima_calibracion}
              onChange={(e) => update('proxima_calibracion', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Documentación adjunta">
        <div className="flex items-start gap-2 mb-3 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3">
          <FileText className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Sube manuales, certificados, fichas técnicas u otros documentos del equipo.
          </p>
        </div>

        <DocumentosUpload
          equipoId={uploadKey}
          documentos={documentos}
          onChange={setDocumentos}
        />
      </Section>

      <Section title="Observaciones">
        <textarea className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas adicionales sobre el equipo..." />
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
        <button type="submit" disabled={loading || enviandoCalibrar}
          className="btn-primary flex items-center gap-2">
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