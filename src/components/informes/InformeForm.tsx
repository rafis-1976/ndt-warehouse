import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, FileText, Plane, Calendar, User,
  Building2, Wrench, Package, Hash, CheckCircle2, XCircle, AlertTriangle,
  Stamp,
} from 'lucide-react';
import { EquipoSelect, type EquipoOption } from '../ui/EquipoSelect';

interface InformeFormProps {
  informeId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const METODOS = [
  { value: 'UT', label: 'UT', nombre: 'Ultrasonic Testing' },
  { value: 'RT', label: 'RT', nombre: 'Radiographic Testing' },
  { value: 'ET', label: 'ET', nombre: 'Eddy Current Testing' },
  { value: 'TT', label: 'TT', nombre: 'Thermographic Testing' },
];

const ESTACIONES = [
  { value: 'MADET', label: 'MADET — Madrid' },
  { value: 'BCNET', label: 'BCNET — Barcelona' },
  { value: 'SVQET', label: 'SVQET — Sevilla' },
  { value: 'BIOET', label: 'BIOET — Bilbao' },
];

export function InformeForm({ informeId, onSuccess, onCancel }: InformeFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!informeId);
  const [error, setError] = useState('');

  const [equipos, setEquipos] = useState<EquipoOption[]>([]);
  const [probetas, setProbetas] = useState<any[]>([]);
  const [inspectorActual, setInspectorActual] = useState<any>(null);

  const hoy = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    numero_informe: '',
    numero_sap: '',
    revision: 1,

    matricula: '',
    modelo_aeronave: '',
    numero_serie_aeronave: '',
    componente: '',
    numero_fr: '',
    zona: '',

    estacion: 'MADET',
    easa_ref: 'ES.145.011',
    uk_caa_ref: 'UK.145.01413',
    operador: 'IBERIA',
    cliente: '',

    metodo: 'UT',
    ntm_referencia: '',
    ntm_step: '',

    fecha_inspeccion: hoy,
    seleccionar: '',

    equipo_id: '',
    probeta_id: '',

    resultado: 'pendiente',
    hallazgos: '',
    conclusion: '',
    observaciones: '',

    inspector_nombre: '',
    inspector_licencia: '',
    inspector_email: '',
    sello_texto: 'IBERIA MANTENIMIENTO · NDT',
    estado: 'borrador',
  });

  useEffect(() => {
    if (informeId) return;
    const ahora = new Date();
    const y = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    setForm((f) => ({
      ...f,
      numero_informe: `NDT-${y}${m}-${rand}`,
    }));
  }, [informeId]);

  useEffect(() => {
    async function load() {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id ?? '';

      const [eq, pb, perfil] = await Promise.all([
        supabase
          .from('equipos')
          .select('id, id_equipo, nombre, codigo_barras, estado, tecnicas_ndt(codigo, nombre)')
          .neq('estado', 'salida')
          .neq('estado', 'baja')
          .order('nombre'),
        supabase
          .from('probetas')
          .select('id, pn, nombre, codigo_barras, numero_serie, estado, tecnicas_ndt(codigo)')
          .neq('estado', 'salida')
          .neq('estado', 'baja')
          .order('pn'),
        userId
          ? supabase
              .from('perfiles')
              .select('id, nombre_completo, email, num_nomina, rol')
              .eq('id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setEquipos((eq.data ?? []) as EquipoOption[]);
      setProbetas(pb.data ?? []);
      if (perfil.data) {
        setInspectorActual(perfil.data);
        setForm((f) => ({
          ...f,
          inspector_nombre: f.inspector_nombre || perfil.data.nombre_completo,
          inspector_email: f.inspector_email || perfil.data.email,
        }));
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!informeId) {
      setLoadingData(false);
      return;
    }
    supabase
      .from('informes')
      .select('*')
      .eq('id', informeId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else if (data) {
          setForm({
            numero_informe: data.numero_informe ?? '',
            numero_sap: data.numero_sap ?? '',
            revision: data.revision ?? 1,
            matricula: data.matricula ?? '',
            modelo_aeronave: data.modelo_aeronave ?? '',
            numero_serie_aeronave: data.numero_serie_aeronave ?? '',
            componente: data.componente ?? '',
            numero_fr: data.numero_fr ?? '',
            zona: data.zona ?? '',
            estacion: data.estacion ?? 'MADET',
            easa_ref: data.easa_ref ?? 'ES.145.011',
            uk_caa_ref: data.uk_caa_ref ?? 'UK.145.01413',
            operador: data.operador ?? 'IBERIA',
            cliente: data.cliente ?? '',
            metodo: data.metodo ?? 'UT',
            ntm_referencia: data.ntm_referencia ?? '',
            ntm_step: data.ntm_step ?? '',
            fecha_inspeccion: data.fecha_inspeccion ?? hoy,
            seleccionar: data.seleccionar ?? '',
            equipo_id: data.equipo_id ?? '',
            probeta_id: data.probeta_id ?? '',
            resultado: data.resultado ?? 'pendiente',
            hallazgos: data.hallazgos ?? '',
            conclusion: data.conclusion ?? '',
            observaciones: data.observaciones ?? '',
            inspector_nombre: data.inspector_nombre ?? '',
            inspector_licencia: data.inspector_licencia ?? '',
            inspector_email: data.inspector_email ?? '',
            sello_texto: data.sello_texto ?? 'IBERIA MANTENIMIENTO · NDT',
            estado: data.estado ?? 'borrador',
          });
        }
        setLoadingData(false);
      });
  }, [informeId]);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const probetaSeleccionada = useMemo(
    () => probetas.find((p) => p.id === form.probeta_id),
    [probetas, form.probeta_id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.numero_informe.trim()) return setError('El N° de informe es obligatorio');
    if (!form.metodo) return setError('Selecciona el método NDT');
    if (!form.fecha_inspeccion) return setError('Indica la fecha de inspección');

    setLoading(true);
    try {
      const payload: any = {
        numero_informe: form.numero_informe.trim(),
        numero_sap: form.numero_sap.trim() || null,
        revision: Number(form.revision) || 1,
        matricula: form.matricula.trim().toUpperCase() || null,
        modelo_aeronave: form.modelo_aeronave.trim() || null,
        numero_serie_aeronave: form.numero_serie_aeronave.trim() || null,
        componente: form.componente.trim() || null,
        numero_fr: form.numero_fr.trim() || null,
        zona: form.zona.trim() || null,
        estacion: form.estacion,
        easa_ref: form.easa_ref.trim() || null,
        uk_caa_ref: form.uk_caa_ref.trim() || null,
        operador: form.operador.trim() || null,
        cliente: form.cliente.trim() || null,
        metodo: form.metodo,
        ntm_referencia: form.ntm_referencia.trim() || null,
        ntm_step: form.ntm_step.trim() || null,
        fecha_inspeccion: form.fecha_inspeccion,
        seleccionar: form.seleccionar.trim() || null,
        equipo_id: form.equipo_id || null,
        probeta_id: form.probeta_id || null,
        resultado: form.resultado,
        hallazgos: form.hallazgos.trim() || null,
        conclusion: form.conclusion.trim() || null,
        observaciones: form.observaciones.trim() || null,
        inspector_id: inspectorActual?.id ?? null,
        inspector_nombre: form.inspector_nombre.trim() || null,
        inspector_licencia: form.inspector_licencia.trim() || null,
        inspector_email: form.inspector_email.trim() || null,
        sello_texto: form.sello_texto.trim() || null,
        estado: form.estado,
      };

      if (informeId) {
        const { error } = await supabase.from('informes').update(payload).eq('id', informeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('informes').insert(payload);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('informes_numero_informe_key')) setError('Ya existe un informe con ese número');
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
      <Section title="Identificación del informe">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="N° de informe *">
            <input
              className="input font-mono"
              value={form.numero_informe}
              onChange={(e) => update('numero_informe', e.target.value.toUpperCase())}
              placeholder="NDT-202501-0001"
              required
            />
          </Field>
          <Field label="N° SAP (Document N°)">
            <input
              className="input font-mono"
              value={form.numero_sap}
              onChange={(e) => update('numero_sap', e.target.value)}
              placeholder="4500123456"
            />
          </Field>
          <Field label="Revisión">
            <input
              type="number"
              min={1}
              className="input"
              value={form.revision}
              onChange={(e) => update('revision', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Datos del avión / componente">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Matrícula (A/C Registration)">
            <div className="relative">
              <Plane className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 font-mono"
                value={form.matricula}
                onChange={(e) => update('matricula', e.target.value.toUpperCase())}
                placeholder="EC-ABC"
              />
            </div>
          </Field>
          <Field label="Modelo">
            <input
              className="input"
              value={form.modelo_aeronave}
              onChange={(e) => update('modelo_aeronave', e.target.value)}
              placeholder="Airbus A320-214"
            />
          </Field>
          <Field label="N° serie A/C">
            <input
              className="input font-mono"
              value={form.numero_serie_aeronave}
              onChange={(e) => update('numero_serie_aeronave', e.target.value)}
            />
          </Field>
          <Field label="Componente">
            <input
              className="input"
              value={form.componente}
              onChange={(e) => update('componente', e.target.value)}
              placeholder="Ala derecha, Fuselaje, Motor..."
            />
          </Field>
          <Field label="FR (Frame Reference)">
            <input
              className="input font-mono"
              value={form.numero_fr}
              onChange={(e) => update('numero_fr', e.target.value)}
              placeholder="FR-23"
            />
          </Field>
          <Field label="Zona">
            <input
              className="input"
              value={form.zona}
              onChange={(e) => update('zona', e.target.value)}
              placeholder="Zona 500"
            />
          </Field>
        </div>
      </Section>

      <Section title="Certificación y aprobación">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Instalación (Station/Facility)">
            <select
              className="input"
              value={form.estacion}
              onChange={(e) => update('estacion', e.target.value)}
            >
              {ESTACIONES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="EASA Approval Ref.">
            <input
              className="input font-mono"
              value={form.easa_ref}
              onChange={(e) => update('easa_ref', e.target.value)}
            />
          </Field>
          <Field label="UK CAA Approval Ref.">
            <input
              className="input font-mono"
              value={form.uk_caa_ref}
              onChange={(e) => update('uk_caa_ref', e.target.value)}
            />
          </Field>
          <Field label="Operador">
            <input
              className="input"
              value={form.operador}
              onChange={(e) => update('operador', e.target.value)}
            />
          </Field>
          <Field label="Cliente">
            <input
              className="input"
              value={form.cliente}
              onChange={(e) => update('cliente', e.target.value)}
              placeholder="Iberia, Vueling, ..."
            />
          </Field>
          <Field label="Seleccionar">
            <input
              className="input"
              value={form.seleccionar}
              onChange={(e) => update('seleccionar', e.target.value)}
              placeholder="Campo libre"
            />
          </Field>
        </div>
      </Section>

      <Section title="Método END (NDT Method)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {METODOS.map((m) => {
            const activo = form.metodo === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => update('metodo', m.value)}
                title={m.nombre}
                className={`flex flex-col items-center justify-center py-3 rounded-lg border-2 transition ${
                  activo
                    ? 'bg-airbus-blue text-white border-airbus-blue shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-airbus-blue/40 hover:bg-airbus-blue/5'
                }`}
              >
                <span className="text-lg font-bold">{m.label}</span>
                <span className="text-[9px] opacity-80 text-center leading-tight mt-0.5 px-1">
                  {m.nombre.replace(' Testing', '')}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Norma NTM">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="NTM Doc. Ref. (N°)">
            <input
              className="input font-mono"
              value={form.ntm_referencia}
              onChange={(e) => update('ntm_referencia', e.target.value.toUpperCase())}
              placeholder="NTM 51-10-01"
            />
          </Field>
          <Field label="Step NTM">
            <input
              className="input font-mono"
              value={form.ntm_step}
              onChange={(e) => update('ntm_step', e.target.value)}
              placeholder="Step 5.A.3"
            />
          </Field>
        </div>
      </Section>

      <Section title="Fechas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fecha de inspección *">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                className="input pl-10"
                value={form.fecha_inspeccion}
                onChange={(e) => update('fecha_inspeccion', e.target.value)}
                required
              />
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Equipo y probeta utilizados">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipo NDT utilizado">
            <EquipoSelect
              equipos={equipos.filter((e) =>
                !form.metodo || (e as any).tecnicas_ndt?.codigo === form.metodo
              )}
              value={form.equipo_id}
              onChange={(id) => update('equipo_id', id)}
              placeholder="— Selecciona un equipo —"
            />
            {form.equipo_id && (
              <p className="mt-1 text-[11px] text-airbus-green flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Equipo asignado al informe
              </p>
            )}
          </Field>

          <Field label="Probeta de calibración">
            <select
              className="input"
              value={form.probeta_id}
              onChange={(e) => update('probeta_id', e.target.value)}
            >
              <option value="">— Selecciona una probeta —</option>
              {probetas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pn} · {p.nombre}
                  {p.tecnicas_ndt?.codigo ? ` · ${p.tecnicas_ndt.codigo}` : ''}
                </option>
              ))}
            </select>
            {probetaSeleccionada && (
              <div className="mt-2 p-2.5 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Probeta seleccionada
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-mono font-bold text-airbus-blue text-xs">
                    P/N: {probetaSeleccionada.pn}
                  </span>
                  {probetaSeleccionada.numero_serie && (
                    <span className="font-mono text-[11px] text-gray-600">
                      S/N: {probetaSeleccionada.numero_serie}
                    </span>
                  )}
                  {probetaSeleccionada.codigo_barras && (
                    <span className="text-[10px] font-mono text-gray-400">
                      CB: {probetaSeleccionada.codigo_barras}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Field>
        </div>
      </Section>

      <Section title="Resultado de la inspección">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            type="button"
            onClick={() => update('resultado', 'pendiente')}
            className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition ${
              form.resultado === 'pendiente'
                ? 'bg-gray-500 text-white border-gray-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-xs font-semibold">Pendiente</span>
          </button>
          <button
            type="button"
            onClick={() => update('resultado', 'aprobado')}
            className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition ${
              form.resultado === 'aprobado'
                ? 'bg-airbus-green text-white border-airbus-green'
                : 'bg-white text-airbus-green border-airbus-green/30 hover:bg-airbus-green/5'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs font-semibold">Aprobado</span>
          </button>
          <button
            type="button"
            onClick={() => update('resultado', 'condicional')}
            className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition ${
              form.resultado === 'condicional'
                ? 'bg-airbus-orange text-white border-airbus-orange'
                : 'bg-white text-airbus-orange border-airbus-orange/30 hover:bg-airbus-orange/5'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs font-semibold">Condicional</span>
          </button>
          <button
            type="button"
            onClick={() => update('resultado', 'rechazado')}
            className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition ${
              form.resultado === 'rechazado'
                ? 'bg-airbus-red text-white border-airbus-red'
                : 'bg-white text-airbus-red border-airbus-red/30 hover:bg-airbus-red/5'
            }`}
          >
            <XCircle className="w-5 h-5" />
            <span className="text-xs font-semibold">Rechazado</span>
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Hallazgos">
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.hallazgos}
              onChange={(e) => update('hallazgos', e.target.value)}
              placeholder="Descripción de defectos, discontinuidades, indicaciones..."
            />
          </Field>
          <Field label="Conclusión">
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.conclusion}
              onChange={(e) => update('conclusion', e.target.value)}
              placeholder="Conclusión técnica sobre el estado del componente..."
            />
          </Field>
          <Field label="Observaciones">
            <textarea
              className="input min-h-[60px] resize-y"
              value={form.observaciones}
              onChange={(e) => update('observaciones', e.target.value)}
              placeholder="Notas adicionales, condiciones ambientales, etc."
            />
          </Field>
        </div>
      </Section>

      <Section title="Inspector / Firmante">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nombre del inspector">
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10"
                value={form.inspector_nombre}
                onChange={(e) => update('inspector_nombre', e.target.value)}
                placeholder="Nombre y apellidos"
              />
            </div>
          </Field>
          <Field label="N° licencia / certificación">
            <input
              className="input font-mono"
              value={form.inspector_licencia}
              onChange={(e) => update('inspector_licencia', e.target.value)}
              placeholder="NT-UT-12345"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={form.inspector_email}
              onChange={(e) => update('inspector_email', e.target.value)}
              placeholder="inspector@iberia.es"
            />
          </Field>
        </div>

        <div className="mt-4 p-3 bg-airbus-yellow/10 border border-airbus-yellow/40 rounded-lg flex items-start gap-2">
          <Stamp className="w-4 h-4 text-yellow-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-yellow-800 uppercase tracking-wider">
              Texto del sello
            </label>
            <input
              className="input mt-1"
              value={form.sello_texto}
              onChange={(e) => update('sello_texto', e.target.value)}
              placeholder="IBERIA MANTENIMIENTO · NDT"
            />
          </div>
        </div>
      </Section>

      <Section title="Estado del informe">
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'borrador', label: 'Borrador', color: 'gray' },
            { value: 'emitido', label: 'Emitido', color: 'green' },
            { value: 'anulado', label: 'Anulado', color: 'red' },
          ].map((e) => {
            const activo = form.estado === e.value;
            const colors: Record<string, string> = {
              gray: 'bg-gray-500 text-white border-gray-500',
              green: 'bg-airbus-green text-white border-airbus-green',
              red: 'bg-airbus-red text-white border-airbus-red',
            };
            return (
              <button
                key={e.value}
                type="button"
                onClick={() => update('estado', e.value)}
                className={`py-2 rounded-lg border-2 text-xs font-semibold transition ${
                  activo
                    ? colors[e.color]
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </div>
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
          {informeId ? 'Guardar cambios' : 'Crear informe'}
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