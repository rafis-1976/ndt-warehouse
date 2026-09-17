import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, RefreshCw, FileText, Search, X, Edit3, Trash2, Printer,
  Filter, Calendar, Plane, CheckCircle2, AlertTriangle,
  User, Hash, Building2,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { InformeForm } from '../components/informes/InformeForm';
import { InformeDetalle } from '../components/informes/InformeDetalle';

// ============================================================
// Configuración de estados y colores
// ============================================================
const resultadoConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  'NIL FINDINGS': { label: 'NIL FINDINGS', color: 'text-airbus-green',  bg: 'bg-airbus-green/15',  icon: CheckCircle2 },
  'FINDINGS':     { label: 'FINDINGS',     color: 'text-airbus-red',    bg: 'bg-airbus-red/15',    icon: AlertTriangle },
};

const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: 'text-gray-600',     bg: 'bg-gray-100' },
  emitido:  { label: 'Emitido',  color: 'text-airbus-green', bg: 'bg-airbus-green/15' },
  anulado:  { label: 'Anulado',  color: 'text-airbus-red',   bg: 'bg-airbus-red/15' },
};

const METODOS = ['ET', 'UT', 'TT', 'RT'];

const ESTACIONES = [
  { value: 'MADRID', label: 'Madrid' },
  { value: 'BARCELONA', label: 'Barcelona' },
];

// ============================================================
// Helpers
// ============================================================
/** Extrae los inspectores únicos de todos los steps de un informe */
function inspectoresDelInforme(informe: any): string[] {
  const set = new Set<string>();
  const steps = Array.isArray(informe.ntm_steps) ? informe.ntm_steps : [];
  steps.forEach((s: any) => {
    const num = String(s?.inspector_num_nomina ?? '').trim();
    const nombre = String(s?.inspector_nombre ?? '').trim();
    if (num && nombre) set.add(`#${num} - ${nombre}`);
    else if (num) set.add(`#${num}`);
    else if (nombre) set.add(nombre);
  });
  return Array.from(set);
}

export function Informes() {
  const [informes, setInformes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroResultado, setFiltroResultado] = useState<string>('todos');
  const [filtroMetodo, setFiltroMetodo] = useState<string>('todos');
  const [filtroEstacion, setFiltroEstacion] = useState<string>('todas');
  const [filtroInspector, setFiltroInspector] = useState<string>('todos');
  const [filtroMes, setFiltroMes] = useState<string>('todos');

  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [informeEditando, setInformeEditando] = useState<any | null>(null);

  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [informeDetalle, setInformeDetalle] = useState<any | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('informes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setInformes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ============================================================
  // Listas únicas para los filtros (extraídas de los datos)
  // ============================================================
  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>();
    informes.forEach((i) => {
      if (!i.fecha_inspeccion) return;
      const f = new Date(i.fecha_inspeccion);
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
      set.add(key);
    });
    return Array.from(set).sort().reverse().map((m) => {
      const [y, mes] = m.split('-');
      const nombreMes = new Date(Number(y), Number(mes) - 1, 1)
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      return { value: m, label: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) };
    });
  }, [informes]);

  const inspectoresDisponibles = useMemo(() => {
    const set = new Set<string>();
    informes.forEach((i) => {
      inspectoresDelInforme(i).forEach((n) => set.add(n));
    });
    return Array.from(set).sort();
  }, [informes]);

  // ============================================================
  // Filtrado combinado
  // ============================================================
  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return informes.filter((i) => {
      // Búsqueda global
      if (qLower) {
        const campos = [
          i.numero_informe,
          i.numero_sap,
          i.matricula,
          i.modelo_aeronave,
          i.numero_serie_aeronave,
          i.componente,
          i.numero_fr,
          i.zona,
          i.cliente,
          i.operador,
          i.ntm_referencia,
          i.ntm_step,
        ].filter(Boolean).join(' ').toLowerCase();

        // Buscar también en los steps
        const stepsTexto = Array.isArray(i.ntm_steps)
          ? i.ntm_steps.map((s: any) =>
              [
                s?.ntm,
                s?.step,
                s?.metodo,
                s?.inspector_num_nomina,
                s?.inspector_nombre,
                ...(s?.equipos ?? []).map((e: any) => `${e.id_equipo ?? ''} ${e.nombre ?? ''} ${e.numero_serie ?? ''}`),
                ...(s?.probetas ?? []).map((p: any) => `${p.pn ?? ''} ${p.nombre ?? ''} ${p.numero_serie ?? ''}`),
              ].join(' ')
            ).join(' ').toLowerCase()
          : '';

        if (!campos.includes(qLower) && !stepsTexto.includes(qLower)) return false;
      }

      // Estado
      if (filtroEstado !== 'todos' && i.estado !== filtroEstado) return false;

      // Resultado
      if (filtroResultado !== 'todos' && i.resultado !== filtroResultado) return false;

      // Método principal
      if (filtroMetodo !== 'todos' && i.metodo !== filtroMetodo) return false;

      // Instalación
      if (filtroEstacion !== 'todas') {
        const est = i.estacion === 'MADET' ? 'MADRID' : i.estacion === 'BCNET' ? 'BARCELONA' : i.estacion;
        if (est !== filtroEstacion) return false;
      }

      // Inspector (buscamos en los steps)
      if (filtroInspector !== 'todos') {
        const inspectores = inspectoresDelInforme(i);
        if (!inspectores.includes(filtroInspector)) return false;
      }

      // Mes de inspección
      if (filtroMes !== 'todos') {
        if (!i.fecha_inspeccion) return false;
        const f = new Date(i.fecha_inspeccion);
        const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
        if (key !== filtroMes) return false;
      }

      return true;
    });
  }, [informes, q, filtroEstado, filtroResultado, filtroMetodo, filtroEstacion, filtroInspector, filtroMes]);

  // ============================================================
  // Contadores
  // ============================================================
  const contadores = useMemo(() => {
    const c = {
      total: informes.length,
      borrador: 0,
      emitido: 0,
      anulado: 0,
      findings: 0,
      nil: 0,
    };
    informes.forEach((i) => {
      if (c[i.estado as keyof typeof c] !== undefined) (c as any)[i.estado]++;
      if (i.resultado === 'FINDINGS') c.findings++;
      if (i.resultado === 'NIL FINDINGS') c.nil++;
    });
    return c;
  }, [informes]);

  const hayFiltrosActivos =
    q !== '' ||
    filtroEstado !== 'todos' ||
    filtroResultado !== 'todos' ||
    filtroMetodo !== 'todos' ||
    filtroEstacion !== 'todas' ||
    filtroInspector !== 'todos' ||
    filtroMes !== 'todos';

  const limpiarFiltros = () => {
    setQ('');
    setFiltroEstado('todos');
    setFiltroResultado('todos');
    setFiltroMetodo('todos');
    setFiltroEstacion('todas');
    setFiltroInspector('todos');
    setFiltroMes('todos');
  };

  // ============================================================
  // Acciones
  // ============================================================
  const abrirNuevo = () => {
    setInformeEditando(null);
    setModalFormOpen(true);
  };

  const abrirEditar = (i: any) => {
    setInformeEditando(i);
    setModalFormOpen(true);
  };

  const abrirDetalle = (i: any) => {
    setInformeDetalle(i);
    setModalDetalleOpen(true);
  };

  const handleSuccess = () => {
    setModalFormOpen(false);
    setInformeEditando(null);
    setToast(informeEditando ? 'Informe actualizado' : 'Informe creado');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const eliminar = async (i: any) => {
    if (!confirm(`¿Eliminar el informe "${i.numero_informe}"?\n\nEsta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('informes').delete().eq('id', i.id);
    if (error) {
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
      return;
    }
    setToast('Informe eliminado');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const fmtFecha = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Informes de Inspección</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} de {informes.length} informes
            {contadores.findings > 0 && (
              <span className="ml-2 text-airbus-red font-semibold">
                · {contadores.findings} con findings
              </span>
            )}
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo informe
        </button>
      </div>

      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
      {toastError && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-red text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
          {toastError}
        </div>
      )}

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total"        value={contadores.total}    color="blue" />
        <StatCard label="Borradores"   value={contadores.borrador} color="gray" />
        <StatCard label="Emitidos"     value={contadores.emitido}  color="green" />
        <StatCard label="Anulados"     value={contadores.anulado}  color="red" />
        <StatCard label="NIL FINDINGS" value={contadores.nil}      color="green" />
        <StatCard label="FINDINGS"     value={contadores.findings} color="red" />
      </div>

      {/* FILTROS */}
      <div className="card space-y-4">
        {/* Buscador global */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por nº informe, matrícula, componente, NTM, equipo, probeta, inspector..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="btn-ghost border border-gray-300 flex items-center gap-2 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>

        {/* Fila 1: Estado + Resultado + Mes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ESTADO */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Filter className="w-3 h-3" />
              Estado
            </label>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={filtroEstado === 'todos'}
                onClick={() => setFiltroEstado('todos')}
              >
                Todos
              </FilterChip>
              <FilterChip
                active={filtroEstado === 'borrador'}
                onClick={() => setFiltroEstado('borrador')}
              >
                Borrador
              </FilterChip>
              <FilterChip
                active={filtroEstado === 'emitido'}
                onClick={() => setFiltroEstado('emitido')}
                color="green"
              >
                Emitido
              </FilterChip>
              <FilterChip
                active={filtroEstado === 'anulado'}
                onClick={() => setFiltroEstado('anulado')}
                color="red"
              >
                Anulado
              </FilterChip>
            </div>
          </div>

          {/* RESULTADO */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Filter className="w-3 h-3" />
              Resultado
            </label>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={filtroResultado === 'todos'}
                onClick={() => setFiltroResultado('todos')}
              >
                Todos
              </FilterChip>
              <FilterChip
                active={filtroResultado === 'NIL FINDINGS'}
                onClick={() => setFiltroResultado('NIL FINDINGS')}
                color="green"
                icon={<CheckCircle2 className="w-3 h-3" />}
              >
                NIL FINDINGS
              </FilterChip>
              <FilterChip
                active={filtroResultado === 'FINDINGS'}
                onClick={() => setFiltroResultado('FINDINGS')}
                color="red"
                icon={<AlertTriangle className="w-3 h-3" />}
              >
                FINDINGS
              </FilterChip>
            </div>
          </div>

          {/* MES */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Calendar className="w-3 h-3" />
              Mes de inspección
            </label>
            <select
              className="input text-sm"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
            >
              <option value="todos">Todos los meses</option>
              {mesesDisponibles.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 2: Método + Instalación + Inspector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MÉTODO */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Filter className="w-3 h-3" />
              Técnica principal
            </label>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={filtroMetodo === 'todos'}
                onClick={() => setFiltroMetodo('todos')}
              >
                Todas
              </FilterChip>
              {METODOS.map((m) => (
                <FilterChip
                  key={m}
                  active={filtroMetodo === m}
                  onClick={() => setFiltroMetodo(m)}
                  color="blue"
                >
                  {m}
                </FilterChip>
              ))}
            </div>
          </div>

          {/* INSTALACIÓN */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Building2 className="w-3 h-3" />
              Instalación
            </label>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={filtroEstacion === 'todas'}
                onClick={() => setFiltroEstacion('todas')}
              >
                Todas
              </FilterChip>
              {ESTACIONES.map((e) => (
                <FilterChip
                  key={e.value}
                  active={filtroEstacion === e.value}
                  onClick={() => setFiltroEstacion(e.value)}
                  color="blue"
                >
                  {e.label}
                </FilterChip>
              ))}
            </div>
          </div>

          {/* INSPECTOR */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <User className="w-3 h-3" />
              Inspector
            </label>
            <select
              className="input text-sm"
              value={filtroInspector}
              onChange={(e) => setFiltroInspector(e.target.value)}
            >
              <option value="todos">Todos los inspectores</option>
              {inspectoresDisponibles.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando informes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">
              {informes.length === 0
                ? 'Aún no hay informes registrados'
                : 'Sin resultados con los filtros actuales'}
            </p>
            {hayFiltrosActivos ? (
              <button
                onClick={limpiarFiltros}
                className="btn-ghost border border-gray-300 inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            ) : (
              <button onClick={abrirNuevo} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Crear el primer informe
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">N° Informe</th>
                  <th className="px-4 py-3">Aeronave</th>
                  <th className="px-4 py-3">Técnica</th>
                  <th className="px-4 py-3">Instalación</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Inspectores</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((i) => {
                  const resConf = resultadoConfig[i.resultado] ?? resultadoConfig['NIL FINDINGS'];
                  const estConf = estadoConfig[i.estado] ?? estadoConfig.borrador;
                  const ResIcon = resConf.icon;
                  const inspectores = inspectoresDelInforme(i);
                  const estacionMostrar =
                    i.estacion === 'MADET' ? 'Madrid'
                    : i.estacion === 'BCNET' ? 'Barcelona'
                    : i.estacion === 'MADRID' ? 'Madrid'
                    : i.estacion === 'BARCELONA' ? 'Barcelona'
                    : i.estacion || '—';

                  return (
                    <tr
                      key={i.id}
                      className="hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => abrirDetalle(i)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-airbus-blue text-xs">
                          {i.numero_informe}
                        </p>
                        {i.numero_sap && (
                          <p className="text-[10px] font-mono text-gray-400">
                            SAP: {i.numero_sap}
                          </p>
                        )}
                        {i.revision && i.revision > 1 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-0.5 bg-airbus-yellow/30 text-yellow-800 rounded text-[9px] font-bold">
                            Rev. {i.revision}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Plane className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-gray-800 text-xs">
                              {i.matricula || '—'}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {i.componente || i.modelo_aeronave || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="badge badge-blue">
                          {i.metodo || '—'}
                        </span>
                        {i.ntm_referencia && (
                          <p className="text-[10px] font-mono text-gray-400 truncate mt-0.5">
                            {i.ntm_referencia}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          {estacionMostrar}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {fmtFecha(i.fecha_inspeccion)}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {inspectores.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">—</span>
                        ) : inspectores.length === 1 ? (
                          <span className="text-xs text-gray-700 truncate max-w-[180px] inline-block">
                            {inspectores[0]}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs text-gray-700 truncate max-w-[150px]">
                              {inspectores[0]}
                            </span>
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 bg-airbus-sky/15 text-airbus-sky rounded text-[9px] font-bold cursor-help"
                              title={inspectores.join('\n')}
                            >
                              +{inspectores.length - 1}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${resConf.bg} ${resConf.color}`}>
                          <ResIcon className="w-3 h-3" />
                          {resConf.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${estConf.bg} ${estConf.color}`}>
                          {estConf.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => abrirDetalle(i)}
                            className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                            title="Ver / Imprimir"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => abrirEditar(i)}
                            className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => eliminar(i)}
                            className="p-1.5 text-gray-400 hover:text-airbus-red hover:bg-airbus-red/10 rounded transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      <Modal
        open={modalFormOpen}
        onClose={() => { setModalFormOpen(false); setInformeEditando(null); }}
        title={informeEditando ? `Editar informe ${informeEditando.numero_informe}` : 'Nuevo informe de inspección'}
        size="lg"
      >
        <InformeForm
          informeId={informeEditando?.id}
          onSuccess={handleSuccess}
          onCancel={() => { setModalFormOpen(false); setInformeEditando(null); }}
        />
      </Modal>

      {/* Modal Detalle */}
      <Modal
        open={modalDetalleOpen}
        onClose={() => { setModalDetalleOpen(false); setInformeDetalle(null); }}
        title={informeDetalle ? `Informe ${informeDetalle.numero_informe}` : 'Detalle'}
        size="lg"
      >
        {informeDetalle && (
          <InformeDetalle
            informe={informeDetalle}
            onClose={() => { setModalDetalleOpen(false); setInformeDetalle(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// StatCard
// ============================================================
function StatCard({
  label, value, color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'orange' | 'red' | 'gray';
}) {
  const colorMap: Record<string, string> = {
    blue:   'text-airbus-blue bg-airbus-blue/10',
    green:  'text-airbus-green bg-airbus-green/10',
    orange: 'text-airbus-orange bg-airbus-orange/10',
    red:    'text-airbus-red bg-airbus-red/10',
    gray:   'text-gray-500 bg-gray-100',
  };
  const cls = colorMap[color] ?? colorMap.gray;
  const [textCls, bgCls] = cls.split(' ');

  return (
    <div className="card p-3 flex flex-col gap-1">
      <div className={`inline-flex items-center px-2 py-0.5 rounded-full self-start text-[10px] font-bold uppercase tracking-wider ${bgCls} ${textCls}`}>
        {label}
      </div>
      <p className={`text-2xl font-bold ${textCls} leading-none`}>{value}</p>
    </div>
  );
}

// ============================================================
// FilterChip
// ============================================================
function FilterChip({
  active, onClick, children, color = 'default', icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'default' | 'blue' | 'green' | 'orange' | 'red';
  icon?: React.ReactNode;
}) {
  const activeColor: Record<string, string> = {
    default: 'bg-airbus-blue text-white border-airbus-blue',
    blue:    'bg-airbus-sky text-white border-airbus-sky',
    green:   'bg-airbus-green text-white border-airbus-green',
    orange:  'bg-airbus-orange text-white border-airbus-orange',
    red:     'bg-airbus-red text-white border-airbus-red',
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        active
          ? activeColor[color]
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}