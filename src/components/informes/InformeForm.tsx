import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, FileText, Plane, Calendar, User,
  CheckCircle2, AlertTriangle, Plus, X, Package, Hash,
  ChevronDown, ChevronRight,
} from 'lucide-react';

interface InformeFormProps {
  informeId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const METODOS = [
  { value: 'ET', label: 'ET', nombre: 'Eddy Current Testing' },
  { value: 'UT', label: 'UT', nombre: 'Ultrasonic Testing' },
  { value: 'TT', label: 'TT', nombre: 'Thermographic Testing' },
  { value: 'RT', label: 'RT', nombre: 'Radiographic Testing' },
];

const ESTACIONES = [
  { value: 'MADRID', label: 'Madrid' },
  { value: 'BARCELONA', label: 'Barcelona' },
];

interface EquipoStepData {
  id: string;
  id_equipo: string | null;
  nombre: string;
  numero_serie: string | null;
  proxima_calibracion: string | null;
  tecnica_codigo?: string | null;
}

interface ProbetaStepData {
  id: string;
  pn: string;
  nombre: string;
  numero_serie: string | null;
  tecnica_codigo?: string | null;
}

interface NtmStep {
  ntm: string;
  step: string;
  metodo: string;
  fecha: string;
  resultado: string;
  findings_text: string;
  equipos: EquipoStepData[];
  probetas: ProbetaStepData[];
  inspector_id?: string | null;
  inspector_num_nomina: string;
  inspector_nombre: string;
}

async function generarNumeroInforme(): Promise<string> {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const prefijo = `NDT-${y}${m}-`;

  const { data, error } = await supabase
    .from('informes')
    .select('numero_informe')
    .like('numero_informe', `${prefijo}%`)
    .order('numero_informe', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[generarNumeroInforme] Error consultando últimos números:', error);
  }

  let siguiente = 1;
  if (data && data.length > 0) {
    const ultimo = data[0].numero_informe as string;
    const match = ultimo.match(/-(\d+)$/);
    if (match) {
      siguiente = parseInt(match[1], 10) + 1;
    }
  }

  const num = String(siguiente).padStart(4, '0');
  return `${prefijo}${num}`;
}

/** Genera el texto unificado del inspector: "#NOMINA - Nombre" */
function formatoInspector(numNomina: string | null | undefined, nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim();
  const num = (numNomina ?? '').trim();
  if (!n && !num) return '';
  if (!num) return n;
  if (!n) return `#${num}`;
  return `#${num} - ${n}`;
}

export function InformeForm({ informeId, onSuccess, onCancel }: InformeFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!informeId);
  const [generandoNumero, setGenerandoNumero] = useState(!informeId);
  const [error, setError] = useState('');

  const [equipos, setEquipos] = useState<any[]>([]);
  const [probetas, setProbetas] = useState<any[]>([]);
  const [inspectores, setInspectores] = useState<any[]>([]);
  const [inspectorActual, setInspectorActual] = useState<any>(null);

  const hoy = new Date().toISOString().split('T')[0];

  const [ntmSteps, setNtmSteps] = useState<NtmStep[]>([
    {
      ntm: '',
      step: '',
      metodo: 'ET',
      fecha: hoy,
      resultado: 'NIL FINDINGS',
      findings_text: '',
      equipos: [],
      probetas: [],
      inspector_id: null,
      inspector_num_nomina: '',
      inspector_nombre: '',
    },
  ]);

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

    estacion: 'MADRID',
    easa_ref: 'ES.145.011',
    uk_caa_ref: 'UK.145.01413',
    operador: 'IBERIA',
    cliente: '',

    seleccionar: '',
    observaciones: '',

    estado: 'borrador',
  });

  useEffect(() => {
    if (informeId) return;
    let cancelado = false;

    async function cargar() {
      setGenerandoNumero(true);
      const numero = await generarNumeroInforme();
      if (cancelado) return;
      setForm((f) => ({ ...f, numero_informe: numero }));
      setGenerandoNumero(false);
    }

    cargar();
    return () => { cancelado = true; };
  }, [informeId]);

  useEffect(() => {
    async function load() {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id ?? '';

      const [eq, pb, perfiles, perfil] = await Promise.all([
        supabase
          .from('equipos')
          .select('id, id_equipo, nombre, numero_serie, proxima_calibracion, estado, tecnicas_ndt(codigo, nombre)')
          .neq('estado', 'salida')
          .neq('estado', 'baja')
          .order('nombre'),
        supabase
          .from('probetas')
          .select('id, pn, nombre, numero_serie, estado, tecnicas_ndt(codigo)')
          .neq('estado', 'salida')
          .neq('estado', 'baja')
          .order('pn'),
        supabase
          .from('perfiles')
          .select('id, nombre_completo, email, num_nomina, rol')
          .eq('activo', true)
          .order('nombre_completo'),
        userId
          ? supabase
              .from('perfiles')
              .select('id, nombre_completo, email, num_nomina, rol')
              .eq('id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      setEquipos(eq.data ?? []);
      setProbetas(pb.data ?? []);
      setInspectores(perfiles.data ?? []);
      if (perfil.data) {
        setInspectorActual(perfil.data);
        setNtmSteps((prev) =>
          prev.map((s, i) =>
            i === 0 && !s.inspector_nombre && !s.inspector_num_nomina
              ? {
                  ...s,
                  inspector_id: perfil.data.id,
                  inspector_num_nomina: perfil.data.num_nomina ?? '',
                  inspector_nombre: perfil.data.nombre_completo ?? '',
                }
              : s
          )
        );
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!informeId) {
      setLoadingData(false);
      return;
    }

    let cancelado = false;
    async function cargarInforme() {
      const { data, error } = await supabase
        .from('informes')
        .select('*')
        .eq('id', informeId)
        .single();

      if (cancelado) return;

      if (error) {
        setError(error.message);
        setLoadingData(false);
        return;
      }

      if (data) {
        const estacionNormalizada =
          data.estacion === 'MADET' ? 'MADRID'
          : data.estacion === 'BCNET' ? 'BARCELONA'
          : (data.estacion ?? 'MADRID');

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
          estacion: estacionNormalizada,
          easa_ref: data.easa_ref ?? 'ES.145.011',
          uk_caa_ref: data.uk_caa_ref ?? 'UK.145.01413',
          operador: data.operador ?? 'IBERIA',
          cliente: data.cliente ?? '',
          seleccionar: data.seleccionar ?? '',
          observaciones: data.observaciones ?? '',
          estado: data.estado ?? 'borrador',
        });

        let stepsRaw: any[] = [];
        if (Array.isArray(data.ntm_steps)) {
          stepsRaw = data.ntm_steps;
        } else if (typeof data.ntm_steps === 'string') {
          try {
            const parsed = JSON.parse(data.ntm_steps);
            if (Array.isArray(parsed)) stepsRaw = parsed;
          } catch (e) {
            console.error('[InformeForm] Error parseando ntm_steps:', e);
          }
        }

        if (stepsRaw.length === 0 && (data.ntm_referencia || data.ntm_step)) {
          stepsRaw = [{
            ntm: data.ntm_referencia ?? '',
            step: data.ntm_step ?? '',
            metodo: data.metodo ?? 'ET',
            fecha: data.fecha_inspeccion ?? hoy,
            resultado: data.resultado === 'rechazado' || data.resultado === 'condicional'
              ? 'FINDINGS'
              : 'NIL FINDINGS',
            findings_text: data.hallazgos ?? '',
            equipos: [],
            probetas: [],
            inspector_id: null,
            inspector_num_nomina: '',
            inspector_nombre: data.inspector_nombre ?? '',
          }];
        }

        const stepsNormalizados: NtmStep[] = stepsRaw.map((s: any) => {
          const equiposStep: EquipoStepData[] = Array.isArray(s?.equipos)
            ? s.equipos.map((e: any) => ({
                id: String(e?.id ?? ''),
                id_equipo: e?.id_equipo ?? null,
                nombre: String(e?.nombre ?? ''),
                numero_serie: e?.numero_serie ?? null,
                proxima_calibracion: e?.proxima_calibracion ?? null,
                tecnica_codigo: e?.tecnica_codigo ?? null,
              }))
            : [];

          const probetasStep: ProbetaStepData[] = Array.isArray(s?.probetas)
            ? s.probetas.map((p: any) => ({
                id: String(p?.id ?? ''),
                pn: String(p?.pn ?? ''),
                nombre: String(p?.nombre ?? ''),
                numero_serie: p?.numero_serie ?? null,
                tecnica_codigo: p?.tecnica_codigo ?? null,
              }))
            : [];

          let resultado = String(s?.resultado ?? 'NIL FINDINGS');
          if (resultado === 'aprobado') resultado = 'NIL FINDINGS';
          else if (resultado === 'rechazado' || resultado === 'condicional') resultado = 'FINDINGS';
          else if (resultado !== 'NIL FINDINGS' && resultado !== 'FINDINGS') resultado = 'NIL FINDINGS';

          return {
            ntm: String(s?.ntm ?? ''),
            step: String(s?.step ?? ''),
            metodo: String(s?.metodo ?? 'ET'),
            fecha: String(s?.fecha ?? data.fecha_inspeccion ?? hoy),
            resultado,
            findings_text: String(s?.findings_text ?? ''),
            equipos: equiposStep,
            probetas: probetasStep,
            inspector_id: s?.inspector_id ?? null,
            inspector_num_nomina: String(s?.inspector_num_nomina ?? ''),
            inspector_nombre: String(s?.inspector_nombre ?? ''),
          };
        });

        if (stepsNormalizados.length > 0) {
          setNtmSteps(stepsNormalizados);
        }
      }

      setLoadingData(false);
    }

    cargarInforme();
    return () => { cancelado = true; };
  }, [informeId]);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addNtmStep = () => {
    setNtmSteps((prev) => [
      ...prev,
      {
        ntm: '',
        step: '',
        metodo: 'ET',
        fecha: hoy,
        resultado: 'NIL FINDINGS',
        findings_text: '',
        equipos: [],
        probetas: [],
        inspector_id: inspectorActual?.id ?? null,
        inspector_num_nomina: inspectorActual?.num_nomina ?? '',
        inspector_nombre: inspectorActual?.nombre_completo ?? '',
      },
    ]);
  };

  const updateNtmStep = (index: number, patch: Partial<NtmStep>) => {
    setNtmSteps((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const removeNtmStep = (index: number) => {
    setNtmSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const cambiarMetodoStep = (index: number, nuevoMetodo: string) => {
    setNtmSteps((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const equiposFiltrados = item.equipos.filter((e) => {
          const eq = equipos.find((x) => x.id === e.id);
          return eq?.tecnicas_ndt?.codigo === nuevoMetodo;
        });
        const probetasFiltradas = item.probetas.filter((p) => {
          const pb = probetas.find((x) => x.id === p.id);
          return pb?.tecnicas_ndt?.codigo === nuevoMetodo;
        });
        return {
          ...item,
          metodo: nuevoMetodo,
          equipos: equiposFiltrados,
          probetas: probetasFiltradas,
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.numero_informe.trim()) return setError('El N° de informe es obligatorio');
    if (ntmSteps.length === 0) return setError('Añade al menos un NTM/Step');

    for (let i = 0; i < ntmSteps.length; i++) {
      const s = ntmSteps[i];
      const pref = `Step ${i + 1}:`;
      if (!s.ntm.trim()) return setError(`${pref} el campo NTM Doc. Ref. es obligatorio`);
      if (!s.step.trim()) return setError(`${pref} el campo Step es obligatorio`);
      if (!s.fecha) return setError(`${pref} la fecha de realización es obligatoria`);
      if (s.equipos.length === 0) return setError(`${pref} añade al menos un equipo`);
      if (s.probetas.length === 0) return setError(`${pref} añade al menos una probeta`);
      if (!s.inspector_nombre.trim()) return setError(`${pref} selecciona el inspector`);
      if (!s.resultado) return setError(`${pref} selecciona el resultado`);
      if (s.resultado === 'FINDINGS' && !s.findings_text.trim()) {
        return setError(`${pref} describe los findings detectados`);
      }
    }

    setLoading(true);
    try {
      const ntmStepsFinal = ntmSteps.map((s) => ({
        ntm: s.ntm.trim(),
        step: s.step.trim(),
        metodo: s.metodo || '',
        fecha: s.fecha || '',
        resultado: s.resultado,
        findings_text: s.resultado === 'FINDINGS' ? s.findings_text.trim() : '',
        equipos: (s.equipos || []).map((e) => ({
          id: e.id,
          id_equipo: e.id_equipo,
          nombre: e.nombre,
          numero_serie: e.numero_serie,
          proxima_calibracion: e.proxima_calibracion,
          tecnica_codigo: e.tecnica_codigo ?? null,
        })),
        probetas: (s.probetas || []).map((p) => ({
          id: p.id,
          pn: p.pn,
          nombre: p.nombre,
          numero_serie: p.numero_serie,
          tecnica_codigo: p.tecnica_codigo ?? null,
        })),
        inspector_id: s.inspector_id ?? null,
        inspector_num_nomina: s.inspector_num_nomina?.trim() || '',
        inspector_nombre: s.inspector_nombre.trim(),
      }));

      const resultadoGlobal = ntmStepsFinal.some((s) => s.resultado === 'FINDINGS')
        ? 'FINDINGS'
        : 'NIL FINDINGS';

      const fechasValidas = ntmStepsFinal.map((s) => s.fecha).filter((f) => !!f);
      const fechaGlobal = fechasValidas.length > 0 ? fechasValidas.sort().slice(-1)[0] : null;

      const metodoPrincipal = ntmStepsFinal[0]?.metodo ?? '';

      const hallazgosGlobal = ntmStepsFinal
        .filter((s) => s.resultado === 'FINDINGS' && s.findings_text)
        .map((s) => `[${s.ntm}${s.step ? ' · ' + s.step : ''}] ${s.findings_text}`)
        .join('\n\n');

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
        metodo: metodoPrincipal,
        ntm_referencia: ntmStepsFinal[0]?.ntm ?? null,
        ntm_step: ntmStepsFinal[0]?.step ?? null,
        ntm_steps: ntmStepsFinal,
        fecha_inspeccion: fechaGlobal,
        seleccionar: form.seleccionar.trim() || null,
        equipo_id: ntmStepsFinal[0]?.equipos?.[0]?.id ?? null,
        probeta_id: ntmStepsFinal[0]?.probetas?.[0]?.id ?? null,
        resultado: resultadoGlobal,
        hallazgos: hallazgosGlobal || null,
        conclusion: null,
        observaciones: form.observaciones.trim() || null,
        inspector_id: null,
        inspector_nombre: null,
        inspector_licencia: null,
        inspector_email: null,
        estado: form.estado,
      };

      if (informeId) {
        const { error } = await supabase
          .from('informes')
          .update(payload)
          .eq('id', informeId);
        if (error) throw error;
      } else {
        let intentos = 0;
        const maxIntentos = 5;
        let insertado = false;

        while (!insertado && intentos < maxIntentos) {
          const { error } = await supabase.from('informes').insert(payload);
          if (!error) {
            insertado = true;
            break;
          }
          if (error.message.includes('informes_numero_informe_key')) {
            intentos++;
            const nuevoNumero = await generarNumeroInforme();
            payload.numero_informe = nuevoNumero;
            continue;
          }
          throw error;
        }

        if (!insertado) {
          throw new Error(
            'No se pudo generar un número de informe único tras varios intentos. Inténtalo de nuevo.'
          );
        }
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('informes_numero_informe_key')) setError('Ya existe un informe con ese número');
      else if (msg.includes('row-level security')) setError('No tienes permisos para esta acción');
      else setError(msg);
      console.error('[InformeForm] Error guardando:', err);
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
            <div className="relative">
              <input
                className="input font-mono bg-gray-50 text-gray-700 cursor-not-allowed"
                value={generandoNumero ? 'Generando número...' : form.numero_informe}
                readOnly
                title="Se asigna automáticamente con formato NDT-AAMM-XXXX"
              />
              {generandoNumero && (
                <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-airbus-sky animate-spin" />
              )}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Se asigna automáticamente con formato NDT-AAMM-XXXX
            </p>
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

      <Section title="Normas NTM, Steps, Técnicas, Equipos y Probetas">
        <div className="flex items-start gap-2 mb-4 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3">
          <FileText className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Todos los campos de cada step son <strong>obligatorios</strong>, incluido
            el inspector de cada step. El resultado debe ser{' '}
            <strong>NIL FINDINGS</strong> o <strong>FINDINGS</strong>.
          </p>
        </div>

        <div className="space-y-4">
          {ntmSteps.map((item, index) => (
            <NtmStepCard
              key={index}
              index={index}
              step={item}
              equipos={equipos}
              probetas={probetas}
              inspectores={inspectores}
              onUpdate={(patch) => updateNtmStep(index, patch)}
              onChangeMetodo={(metodo) => cambiarMetodoStep(index, metodo)}
              onRemove={() => removeNtmStep(index)}
              canRemove={ntmSteps.length > 1}
            />
          ))}

          <button
            type="button"
            onClick={addNtmStep}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-airbus-sky/40 rounded-lg text-airbus-sky hover:bg-airbus-sky/5 hover:border-airbus-sky transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Añadir otro NTM / Step
          </button>
        </div>
      </Section>

      <Section title="Observaciones">
        <textarea
          className="input min-h-[60px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Notas adicionales, condiciones ambientales, etc."
        />
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
        <button
          type="submit"
          disabled={loading || generandoNumero}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {informeId ? 'Guardar cambios' : 'Crear informe'}
        </button>
      </div>
    </form>
  );
}

function NtmStepCard({
  index, step, equipos, probetas, inspectores,
  onUpdate, onChangeMetodo, onRemove, canRemove,
}: {
  index: number;
  step: NtmStep;
  equipos: any[];
  probetas: any[];
  inspectores: any[];
  onUpdate: (patch: Partial<NtmStep>) => void;
  onChangeMetodo: (metodo: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [expandido, setExpandido] = useState(true);
  const [equipoSel, setEquipoSel] = useState('');
  const [probetaSel, setProbetaSel] = useState('');

  const equiposDeLaTecnica = equipos.filter((e) => e.tecnicas_ndt?.codigo === step.metodo);
  const probetasDeLaTecnica = probetas.filter((p) => p.tecnicas_ndt?.codigo === step.metodo);

  const equiposDisponibles = equiposDeLaTecnica.filter(
    (e) => !step.equipos.some((s) => s.id === e.id)
  );
  const probetasDisponibles = probetasDeLaTecnica.filter(
    (p) => !step.probetas.some((s) => s.id === p.id)
  );

  const addEquipo = () => {
    if (!equipoSel) return;
    const eq = equipos.find((e) => e.id === equipoSel);
    if (!eq) return;
    onUpdate({
      equipos: [
        ...step.equipos,
        {
          id: eq.id,
          id_equipo: eq.id_equipo ?? null,
          nombre: eq.nombre ?? '',
          numero_serie: eq.numero_serie ?? null,
          proxima_calibracion: eq.proxima_calibracion ?? null,
          tecnica_codigo: eq.tecnicas_ndt?.codigo ?? null,
        },
      ],
    });
    setEquipoSel('');
  };

  const removeEquipo = (id: string) => {
    onUpdate({ equipos: step.equipos.filter((e) => e.id !== id) });
  };

  const addProbeta = () => {
    if (!probetaSel) return;
    const pb = probetas.find((p) => p.id === probetaSel);
    if (!pb) return;
    onUpdate({
      probetas: [
        ...step.probetas,
        {
          id: pb.id,
          pn: pb.pn ?? '',
          nombre: pb.nombre ?? '',
          numero_serie: pb.numero_serie ?? null,
          tecnica_codigo: pb.tecnicas_ndt?.codigo ?? null,
        },
      ],
    });
    setProbetaSel('');
  };

  const removeProbeta = (id: string) => {
    onUpdate({ probetas: step.probetas.filter((p) => p.id !== id) });
  };

  const fmtFecha = (iso: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-ES');
    } catch {
      return iso;
    }
  };

  const esFindings = step.resultado === 'FINDINGS';
  const resultColor = esFindings
    ? 'bg-airbus-red text-white'
    : 'bg-airbus-green text-white';

  return (
    <div className="border-2 border-airbus-sky/40 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-airbus-blue to-airbus-navy text-white">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
          {index + 1}
        </div>

        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
          {expandido ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          <span className="font-mono text-xs truncate">{step.ntm || 'Sin NTM'}</span>
          {step.step && (
            <span className="text-[10px] opacity-80 truncate">· {step.step}</span>
          )}
          {step.metodo && (
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold shrink-0">
              {step.metodo}
            </span>
          )}
          {step.fecha && (
            <span className="text-[10px] opacity-80 shrink-0">· {fmtFecha(step.fecha)}</span>
          )}
          {(step.equipos.length > 0 || step.probetas.length > 0) && (
            <span className="text-[10px] opacity-80 shrink-0">
              · {step.equipos.length} eq · {step.probetas.length} pb
            </span>
          )}
        </button>

        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${resultColor}`}>
          {step.resultado}
        </span>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 hover:bg-white/20 rounded-lg transition shrink-0"
            title="Eliminar este NTM/Step"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {expandido && (
        <div className="p-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                NTM Doc. Ref. *
              </label>
              <input
                className="input font-mono"
                value={step.ntm}
                onChange={(e) => onUpdate({ ntm: e.target.value.toUpperCase() })}
                placeholder="NTM 51-10-01"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Step *
              </label>
              <input
                className="input font-mono"
                value={step.step}
                onChange={(e) => onUpdate({ step: e.target.value })}
                placeholder="Step 5.A.3"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                <Calendar className="w-3 h-3" />
                Fecha de realización *
              </label>
              <input
                type="date"
                className="input"
                value={step.fecha}
                onChange={(e) => onUpdate({ fecha: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Técnica END utilizada *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METODOS.map((m) => {
                const activo = step.metodo === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => onChangeMetodo(m.value)}
                    className={`flex flex-col items-center justify-center py-2 rounded-lg border-2 transition ${
                      activo
                        ? 'bg-airbus-sky text-white border-airbus-sky shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-airbus-sky/40'
                    }`}
                  >
                    <span className="text-sm font-bold">{m.label}</span>
                    <span className="text-[8px] opacity-80 text-center leading-tight">
                      {m.nombre.replace(' Testing', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Package className="w-3 h-3" />
              Equipos utilizados * ({step.equipos.length})
            </label>

            {step.equipos.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {step.equipos.map((eq) => (
                  <div
                    key={eq.id}
                    className="flex items-center gap-2 px-2.5 py-2 bg-airbus-blue/5 border border-airbus-blue/20 rounded-lg"
                  >
                    <Package className="w-3.5 h-3.5 text-airbus-blue shrink-0" />
                    <span className="font-mono font-bold text-airbus-blue text-xs shrink-0">
                      {eq.id_equipo ?? '—'}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{eq.nombre}</span>
                    {eq.numero_serie && (
                      <span className="text-[10px] font-mono text-gray-400 truncate hidden sm:inline">
                        S/N: {eq.numero_serie}
                      </span>
                    )}
                    <span className="text-[10px] text-airbus-orange font-medium shrink-0 hidden md:inline">
                      Próx. calib: {fmtFecha(eq.proxima_calibracion ?? '') || '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEquipo(eq.id)}
                      className="p-1 hover:bg-airbus-red/10 rounded text-gray-400 hover:text-airbus-red transition shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={equipoSel}
                onChange={(e) => setEquipoSel(e.target.value)}
                disabled={equiposDisponibles.length === 0}
              >
                <option value="">
                  {equiposDeLaTecnica.length === 0
                    ? `— No hay equipos de técnica ${step.metodo || '—'} —`
                    : equiposDisponibles.length === 0
                      ? '— Todos los equipos de esta técnica ya están añadidos —'
                      : '— Selecciona un equipo —'}
                </option>
                {equiposDisponibles.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id_equipo ? `[${e.id_equipo}] ` : ''}{e.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addEquipo}
                disabled={!equipoSel}
                className="btn-secondary whitespace-nowrap disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Hash className="w-3 h-3" />
              Probetas utilizadas * ({step.probetas.length})
            </label>

            {step.probetas.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {step.probetas.map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center gap-2 px-2.5 py-2 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg"
                  >
                    <Hash className="w-3.5 h-3.5 text-airbus-sky shrink-0" />
                    <span className="font-mono font-bold text-airbus-sky text-xs shrink-0">{pb.pn}</span>
                    <span className="text-xs text-gray-700 truncate flex-1">{pb.nombre}</span>
                    {pb.numero_serie && (
                      <span className="text-[10px] font-mono text-gray-400 truncate hidden sm:inline">
                        S/N: {pb.numero_serie}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeProbeta(pb.id)}
                      className="p-1 hover:bg-airbus-red/10 rounded text-gray-400 hover:text-airbus-red transition shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={probetaSel}
                onChange={(e) => setProbetaSel(e.target.value)}
                disabled={probetasDisponibles.length === 0}
              >
                <option value="">
                  {probetasDeLaTecnica.length === 0
                    ? `— No hay probetas de técnica ${step.metodo || '—'} —`
                    : probetasDisponibles.length === 0
                      ? '— Todas las probetas de esta técnica ya están añadidas —'
                      : '— Selecciona una probeta —'}
                </option>
                {probetasDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>{p.pn} · {p.nombre}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addProbeta}
                disabled={!probetaSel}
                className="btn-secondary whitespace-nowrap disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <User className="w-3 h-3" />
              Inspector que realizó esta inspección *
            </label>
            <select
              className="input"
              value={step.inspector_id ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  onUpdate({
                    inspector_id: null,
                    inspector_num_nomina: '',
                    inspector_nombre: '',
                  });
                } else {
                  const insp = inspectores.find((i) => i.id === v);
                  onUpdate({
                    inspector_id: v,
                    inspector_num_nomina: insp?.num_nomina ?? '',
                    inspector_nombre: insp?.nombre_completo ?? '',
                  });
                }
              }}
              required
            >
              <option value="">— Sin asignar —</option>
              {inspectores.map((i) => (
                <option key={i.id} value={i.id}>
                  {formatoInspector(i.num_nomina, i.nombre_completo)}
                </option>
              ))}
            </select>
            {step.inspector_nombre && (
              <p className="mt-1 text-[11px] text-airbus-green flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {formatoInspector(step.inspector_num_nomina, step.inspector_nombre)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Resultado de la inspección *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdate({ resultado: 'NIL FINDINGS', findings_text: '' })}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition font-bold ${
                  step.resultado === 'NIL FINDINGS'
                    ? 'bg-airbus-green text-white border-airbus-green shadow-md'
                    : 'bg-white text-airbus-green border-airbus-green/30 hover:bg-airbus-green/5'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                NIL FINDINGS
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ resultado: 'FINDINGS' })}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition font-bold ${
                  step.resultado === 'FINDINGS'
                    ? 'bg-airbus-red text-white border-airbus-red shadow-md'
                    : 'bg-white text-airbus-red border-airbus-red/30 hover:bg-airbus-red/5'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
                FINDINGS
              </button>
            </div>

            {esFindings && (
              <div className="mt-3">
                <label className="block text-[10px] font-semibold text-airbus-red uppercase tracking-wider mb-1">
                  Descripción de los findings *
                </label>
                <textarea
                  className="input min-h-[100px] resize-y border-airbus-red/40 focus:ring-airbus-red"
                  value={step.findings_text}
                  onChange={(e) => onUpdate({ findings_text: e.target.value })}
                  placeholder="Describe los defectos, discontinuidades o indicaciones detectadas..."
                  required
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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