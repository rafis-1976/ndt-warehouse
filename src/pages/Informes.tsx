import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, RefreshCw, FileText, Search, X, Edit3, Trash2, Printer,
  Filter, Calendar, Plane, CheckCircle2, XCircle, AlertTriangle,
  Clock, User, Hash,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { InformeForm } from '../components/informes/InformeForm';
import { InformeDetalle } from '../components/informes/InformeDetalle';

const resultadoConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  aprobado:    { label: 'Aprobado',    color: 'text-airbus-green',  bg: 'bg-airbus-green/15',  icon: CheckCircle2 },
  rechazado:   { label: 'Rechazado',   color: 'text-airbus-red',    bg: 'bg-airbus-red/15',    icon: XCircle },
  condicional: { label: 'Condicional', color: 'text-airbus-orange', bg: 'bg-airbus-orange/15', icon: AlertTriangle },
  pendiente:   { label: 'Pendiente',   color: 'text-gray-500',      bg: 'bg-gray-100',         icon: Clock },
};

const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: 'text-gray-600',      bg: 'bg-gray-100' },
  emitido:  { label: 'Emitido',  color: 'text-airbus-green',  bg: 'bg-airbus-green/15' },
  anulado:  { label: 'Anulado',  color: 'text-airbus-red',    bg: 'bg-airbus-red/15' },
};

export function Informes() {
  const [informes, setInformes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroResultado, setFiltroResultado] = useState<string>('todos');
  const [filtroMetodo, setFiltroMetodo] = useState<string>('todos');

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
      .select(`
        *,
        equipos(id_equipo, nombre, tecnicas_ndt(codigo)),
        probetas(pn, nombre),
        perfiles(num_nomina, nombre_completo)
      `)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setInformes(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return informes.filter((i) => {
      if (filtroEstado !== 'todos' && i.estado !== filtroEstado) return false;
      if (filtroResultado !== 'todos' && i.resultado !== filtroResultado) return false;
      if (filtroMetodo !== 'todos' && i.metodo !== filtroMetodo) return false;

      if (!qLower) return true;
      const campos = [
        i.numero_informe, i.numero_sap, i.matricula, i.modelo_aeronave,
        i.numero_serie_aeronave, i.componente, i.numero_fr, i.zona,
        i.ntm_referencia, i.ntm_step, i.inspector_nombre, i.inspector_licencia,
        i.equipos?.id_equipo, i.equipos?.nombre,
        i.probetas?.pn, i.probetas?.nombre,
        i.perfiles?.nombre_completo,
      ].filter(Boolean).join(' ').toLowerCase();
      return campos.includes(qLower);
    });
  }, [informes, q, filtroEstado, filtroResultado, filtroMetodo]);

  const contadores = useMemo(() => {
    const c = {
      total: informes.length,
      borrador: 0, emitido: 0, anulado: 0,
      aprobado: 0, rechazado: 0, condicional: 0, pendiente: 0,
    };
    informes.forEach((i) => {
      if (c[i.estado] !== undefined) c[i.estado as keyof typeof c]++;
      if (c[i.resultado] !== undefined) c[i.resultado as keyof typeof c]++;
    });
    return c;
  }, [informes]);

  const hayFiltrosActivos =
    q !== '' || filtroEstado !== 'todos' || filtroResultado !== 'todos' || filtroMetodo !== 'todos';

  const limpiarFiltros = () => {
    setQ('');
    setFiltroEstado('todos');
    setFiltroResultado('todos');
    setFiltroMetodo('todos');
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Informes de Inspección</h1>
          <p className="text-sm text-gray-500">
            {informes.length} informes registrados
            {contadores.emitido > 0 && (
              <span className="ml-2 text-airbus-green font-semibold">
                · {contadores.emitido} emitidos
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total" value={contadores.total} color="blue" />
        <StatCard label="Borradores" value={contadores.borrador} color="gray" />
        <StatCard label="Emitidos" value={contadores.emitido} color="green" />
        <StatCard label="Aprobados" value={contadores.aprobado} color="green" />
        <StatCard label="Condicionales" value={contadores.condicional} color="orange" />
        <StatCard label="Rechazados" value={contadores.rechazado} color="red" />
        <StatCard label="Anulados" value={contadores.anulado} color="red" />
      </div>

      {/* FILTROS */}
      <div className="card space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por nº informe, matrícula, componente, NTM, inspector..."
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Filter className="w-3 h-3" />
              Estado
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'todos', label: 'Todos' },
                { value: 'borrador', label: 'Borrador' },
                { value: 'emitido', label: 'Emitido' },
                { value: 'anulado', label: 'Anulado' },
              ].map((e) => (
                <FilterChip
                  key={e.value}
                  active={filtroEstado === e.value}
                  onClick={() => setFiltroEstado(e.value)}
                >
                  {e.label}
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Filter className="w-3 h-3" />
              Resultado
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'todos', label: 'Todos' },
                { value: 'aprobado', label: 'Aprobado' },
                { value: 'condicional', label: 'Condicional' },
                { value: 'rechazado', label: 'Rechazado' },
                { value: 'pendiente', label: 'Pendiente' },
              ].map((e) => (
                <FilterChip
                  key={e.value}
                  active={filtroResultado === e.value}
                  onClick={() => setFiltroResultado(e.value)}
                >
                  {e.label}
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Filter className="w-3 h-3" />
              Método
            </label>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={filtroMetodo === 'todos'} onClick={() => setFiltroMetodo('todos')}>
                Todos
              </FilterChip>
              {['UT', 'RT', 'ET', 'TT', 'MT', 'PT'].map((m) => (
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
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((i) => {
                  const resConf = resultadoConfig[i.resultado] ?? resultadoConfig.pendiente;
                  const estConf = estadoConfig[i.estado] ?? estadoConfig.borrador;
                  const ResIcon = resConf.icon;

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
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {fmtFecha(i.fecha_inspeccion)}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${resConf.bg} ${resConf.color}`}>
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

function FilterChip({
  active, onClick, children, color = 'default',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: 'default' | 'blue' | 'green' | 'orange' | 'red';
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
      {children}
    </button>
  );
}