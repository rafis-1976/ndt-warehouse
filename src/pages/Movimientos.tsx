import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, RefreshCw, ArrowDownRight, ArrowUpRight, ArrowRightLeft,
  Sliders, Search, X, Filter, Hash, Package, User as UserIcon,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { MovimientoForm } from '../components/movimientos/MovimientoForm';

type TipoMov = 'entrada' | 'salida' | 'transferencia' | 'ajuste';

const tipoConfig: Record<TipoMov, { label: string; icon: any; color: string; bg: string; border: string }> = {
  entrada: {
    label: 'Entrada',
    icon: ArrowDownRight,
    color: 'text-airbus-green',
    bg: 'bg-airbus-green/10',
    border: 'border-airbus-green/30',
  },
  salida: {
    label: 'Salida',
    icon: ArrowUpRight,
    color: 'text-airbus-orange',
    bg: 'bg-airbus-orange/10',
    border: 'border-airbus-orange/30',
  },
  transferencia: {
    label: 'Transferencia',
    icon: ArrowRightLeft,
    color: 'text-airbus-sky',
    bg: 'bg-airbus-sky/10',
    border: 'border-airbus-sky/30',
  },
  ajuste: {
    label: 'Ajuste',
    icon: Sliders,
    color: 'text-airbus-purple',
    bg: 'bg-airbus-purple/10',
    border: 'border-airbus-purple/30',
  },
};

export function Movimientos() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [limite, setLimite] = useState<number>(50);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('movimientos')
      .select(`
        *,
        equipos(id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo)),
        perfiles(num_nomina, nombre_completo)
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) console.error('[Movimientos] Error:', error);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSuccess = () => {
    setModalOpen(false);
    setToast('Movimiento registrado correctamente');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return items.filter((m) => {
      const coincideBusqueda =
        qLower === '' ||
        [
          m.equipos?.id_equipo,
          m.equipos?.nombre,
          m.equipos?.codigo_barras,
          m.referencia,
          m.ubicacion_origen,
          m.ubicacion_destino,
          m.perfiles?.nombre_completo,
          m.perfiles?.num_nomina,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(qLower);
      if (!coincideBusqueda) return false;

      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;

      return true;
    });
  }, [items, q, filtroTipo]);

  const visibles = useMemo(() => filtered.slice(0, limite), [filtered, limite]);

  const contadores = useMemo(() => {
    const c: Record<string, number> = {
      todos: items.length,
      entrada: 0,
      salida: 0,
      transferencia: 0,
      ajuste: 0,
    };
    items.forEach((m) => {
      if (c[m.tipo] !== undefined) c[m.tipo]++;
    });
    return c;
  }, [items]);

  const hayFiltrosActivos = q !== '' || filtroTipo !== 'todos';

  const limpiarFiltros = () => {
    setQ('');
    setFiltroTipo('todos');
  };

  const fmtFechaHora = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fmtFechaCorta = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const mismoDia = (a: Date, b: Date) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    if (mismoDia(d, hoy)) return `Hoy ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    if (mismoDia(d, ayer)) return `Ayer ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    return fmtFechaHora(iso);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Movimientos</h1>
          <p className="text-sm text-gray-500">
            Historial de entradas, salidas, transferencias y ajustes
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo movimiento
        </button>
      </div>

      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard tipo="todos" count={contadores.todos} activo={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')} />
        <StatCard tipo="entrada" count={contadores.entrada} activo={filtroTipo === 'entrada'} onClick={() => setFiltroTipo('entrada')} />
        <StatCard tipo="salida" count={contadores.salida} activo={filtroTipo === 'salida'} onClick={() => setFiltroTipo('salida')} />
        <StatCard tipo="transferencia" count={contadores.transferencia} activo={filtroTipo === 'transferencia'} onClick={() => setFiltroTipo('transferencia')} />
        <StatCard tipo="ajuste" count={contadores.ajuste} activo={filtroTipo === 'ajuste'} onClick={() => setFiltroTipo('ajuste')} />
      </div>

      <div className="card">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por equipo, referencia, ubicación o usuario..."
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
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando movimientos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">
              {items.length === 0
                ? 'Aún no hay movimientos registrados'
                : 'Sin resultados con los filtros actuales'}
            </p>
            {hayFiltrosActivos ? (
              <button onClick={limpiarFiltros} className="btn-ghost border border-gray-300 inline-flex items-center gap-2">
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            ) : (
              <button onClick={() => setModalOpen(true)} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Registrar el primero
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Origen → Destino</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibles.map((m) => {
                    const conf = tipoConfig[m.tipo as TipoMov] ?? tipoConfig.ajuste;
                    const Icon = conf.icon;

                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${conf.bg} ${conf.border}`}>
                            <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${conf.color}`}>
                              {conf.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-airbus-blue shrink-0 text-xs">
                              {m.equipos?.id_equipo ?? '—'}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 truncate text-sm">
                                {m.equipos?.nombre ?? '—'}
                              </p>
                              <p className="text-[10px] font-mono text-gray-400 truncate">
                                {m.equipos?.codigo_barras}
                              </p>
                            </div>
                            {m.equipos?.tecnicas_ndt?.codigo && (
                              <span className="badge badge-blue shrink-0">
                                {m.equipos.tecnicas_ndt.codigo}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {m.ubicacion_origen || m.ubicacion_destino ? (
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[100px]">
                                {m.ubicacion_origen ?? '—'}
                              </span>
                              <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[100px]">
                                {m.ubicacion_destino ?? '—'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">
                          {m.referencia ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {m.perfiles ? (
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-gray-700 truncate">
                                  {m.perfiles.nombre_completo}
                                </p>
                                {m.perfiles.num_nomina && (
                                  <p className="text-[10px] font-mono text-gray-400">
                                    #{m.perfiles.num_nomina}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Sistema</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {fmtFechaCorta(m.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > limite && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-center">
                <p className="text-xs text-gray-500 mb-2">
                  Mostrando {limite} de {filtered.length} movimientos
                </p>
                <button
                  onClick={() => setLimite((l) => l + 50)}
                  className="btn-ghost border border-gray-300 text-xs"
                >
                  Cargar 50 más
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo movimiento"
        size="lg"
      >
        <MovimientoForm
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function StatCard({
  tipo, count, activo, onClick,
}: {
  tipo: 'todos' | TipoMov;
  count: number;
  activo: boolean;
  onClick: () => void;
}) {
  const config = tipo === 'todos'
    ? { label: 'Todos', icon: Package, color: 'text-airbus-blue', bg: 'bg-airbus-blue/10', border: 'border-airbus-blue/30' }
    : tipoConfig[tipo];

  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`card p-3 flex items-center gap-3 text-left transition border-2 ${
        activo ? config.border : 'border-transparent hover:border-gray-200'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-800 leading-none">{count}</p>
        <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate">
          {config.label}
        </p>
      </div>
    </button>
  );
}