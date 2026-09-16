import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, RefreshCw, ArrowDownRight, ArrowUpRight, ArrowRightLeft,
  Sliders, Search, X, Filter, Hash, Package, User as UserIcon,
  Truck, CornerDownLeft, Building2, Warehouse, Users, Calendar,
  Loader2, CheckCircle2,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { MovimientoForm } from '../components/movimientos/MovimientoForm';

type TipoMov =
  | 'entrada'
  | 'salida'
  | 'transferencia'
  | 'ajuste'
  | 'prestamo_externo'
  | 'devolucion_externa';

type TipoObjeto = 'todos' | 'equipo' | 'probeta';

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
  prestamo_externo: {
    label: 'Préstamo externo',
    icon: Truck,
    color: 'text-airbus-orange',
    bg: 'bg-airbus-orange/10',
    border: 'border-airbus-orange/30',
  },
  devolucion_externa: {
    label: 'Devolución externa',
    icon: CornerDownLeft,
    color: 'text-airbus-green',
    bg: 'bg-airbus-green/10',
    border: 'border-airbus-green/30',
  },
};

const tipoDestinoConfig: Record<string, { label: string; icon: any }> = {
  almacen: { label: 'Almacén', icon: Warehouse },
  seccion: { label: 'Sección', icon: Building2 },
  compania: { label: 'Compañía', icon: Truck },
  cliente: { label: 'Cliente', icon: Users },
  otro: { label: 'Otro', icon: Building2 },
};

export function Movimientos() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroObjeto, setFiltroObjeto] = useState<TipoObjeto>('todos');
  const [limite, setLimite] = useState<number>(50);
  const [devolviendo, setDevolviendo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('movimientos')
      .select(`
        *,
        equipos(id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo)),
        probetas(id, pn, nombre, codigo_barras, carros(codigo, nombre)),
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

  // ============================================================
  // Calcular qué objetos están FUERA (último movimiento = prestamo_externo)
  // ============================================================
  const ultimoPorObjeto = useMemo(() => {
    const map = new Map<string, any>();
    // items está ordenado desc por created_at, así que el primero que veamos por objeto es el último
    items.forEach((m) => {
      const key = m.equipo_id ? `eq:${m.equipo_id}` : m.probeta_id ? `pb:${m.probeta_id}` : null;
      if (!key) return;
      if (!map.has(key)) map.set(key, m);
    });
    return map;
  }, [items]);

  const estaFuera = (m: any): boolean => {
    const key = m.equipo_id ? `eq:${m.equipo_id}` : m.probeta_id ? `pb:${m.probeta_id}` : null;
    if (!key) return false;
    const ultimo = ultimoPorObjeto.get(key);
    if (!ultimo) return false;
    return ultimo.id === m.id && m.tipo === 'prestamo_externo';
  };

  // ============================================================
  // Devolver (crear movimiento de devolución + actualizar estado)
  // ============================================================
  const devolverObjeto = async (m: any) => {
    const nombre = m.equipo_id ? m.equipos?.nombre : m.probetas?.nombre;
    if (!confirm(`¿Registrar la devolución de "${nombre}"?\n\nSe creará un movimiento de devolución y el objeto volverá a estar disponible.`)) return;

    setDevolviendo(m.id);
    try {
      const payload: any = {
        equipo_id: m.equipo_id,
        probeta_id: m.probeta_id,
        tipo: 'devolucion_externa',
        ubicacion_origen: m.destino_nombre,
        ubicacion_destino: null,
        referencia: m.referencia,
        observaciones: `Devolución del préstamo a ${tipoDestinoConfig[m.destino_tipo]?.label ?? ''} ${m.destino_nombre ?? ''}`.trim(),
        destino_tipo: m.destino_tipo,
        destino_nombre: m.destino_nombre,
        destino_contacto: m.destino_contacto,
        fecha_devolucion_prevista: m.fecha_devolucion_prevista,
      };

      const { error: insErr } = await supabase.from('movimientos').insert(payload);
      if (insErr) throw insErr;

      // Actualizar estado del equipo/probeta
      if (m.equipo_id) {
        await supabase.from('equipos').update({ estado: 'disponible' }).eq('id', m.equipo_id);
      } else if (m.probeta_id) {
        await supabase.from('probetas').update({ estado: 'disponible' }).eq('id', m.probeta_id);
      }

      setToast('Devolución registrada correctamente');
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (err: any) {
      console.error(err);
      setToastError(err.message ?? 'Error al registrar la devolución');
      setTimeout(() => setToastError(null), 4000);
    } finally {
      setDevolviendo(null);
    }
  };

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return items.filter((m) => {
      if (filtroObjeto === 'equipo' && !m.equipo_id) return false;
      if (filtroObjeto === 'probeta' && !m.probeta_id) return false;

      const coincideBusqueda =
        qLower === '' ||
        [
          m.equipos?.id_equipo,
          m.equipos?.nombre,
          m.equipos?.codigo_barras,
          m.probetas?.pn,
          m.probetas?.nombre,
          m.probetas?.codigo_barras,
          m.probetas?.carros?.codigo,
          m.referencia,
          m.ubicacion_origen,
          m.ubicacion_destino,
          m.destino_nombre,
          m.destino_contacto,
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
  }, [items, q, filtroTipo, filtroObjeto]);

  const visibles = useMemo(() => filtered.slice(0, limite), [filtered, limite]);

  const contadores = useMemo(() => {
    const c: Record<string, number> = {
      todos: items.length,
      entrada: 0,
      salida: 0,
      transferencia: 0,
      ajuste: 0,
      prestamo_externo: 0,
      devolucion_externa: 0,
    };
    items.forEach((m) => {
      if (c[m.tipo] !== undefined) c[m.tipo]++;
    });
    return c;
  }, [items]);

  const contadoresObjeto = useMemo(() => {
    let equipos = 0;
    let probetas = 0;
    items.forEach((m) => {
      if (m.equipo_id) equipos++;
      if (m.probeta_id) probetas++;
    });
    return { todos: items.length, equipo: equipos, probeta: probetas };
  }, [items]);

  const hayFiltrosActivos =
    q !== '' || filtroTipo !== 'todos' || filtroObjeto !== 'todos';

  const limpiarFiltros = () => {
    setQ('');
    setFiltroTipo('todos');
    setFiltroObjeto('todos');
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
            Historial de entradas, salidas, transferencias, ajustes y préstamos externos
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

      {/* FILTRO POR OBJETO */}
      <div className="card">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <Filter className="w-3 h-3" />
          Tipo de objeto
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroObjeto('todos')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
              filtroObjeto === 'todos'
                ? 'bg-airbus-blue text-white border-airbus-blue shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Todos
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              filtroObjeto === 'todos' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {contadoresObjeto.todos}
            </span>
          </button>
          <button
            onClick={() => setFiltroObjeto('equipo')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
              filtroObjeto === 'equipo'
                ? 'bg-airbus-blue text-white border-airbus-blue shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Equipos
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              filtroObjeto === 'equipo' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {contadoresObjeto.equipo}
            </span>
          </button>
          <button
            onClick={() => setFiltroObjeto('probeta')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
              filtroObjeto === 'probeta'
                ? 'bg-airbus-blue text-white border-airbus-blue shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            Probetas
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              filtroObjeto === 'probeta' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {contadoresObjeto.probeta}
            </span>
          </button>
        </div>
      </div>

      {/* FILTRO POR TIPO DE MOVIMIENTO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard
          tipo="todos"
          count={contadores.todos}
          activo={filtroTipo === 'todos'}
          onClick={() => setFiltroTipo('todos')}
        />
        {Object.keys(tipoConfig).map((t) => (
          <StatCard
            key={t}
            tipo={t as TipoMov}
            count={contadores[t] ?? 0}
            activo={filtroTipo === t}
            onClick={() => setFiltroTipo(t)}
          />
        ))}
      </div>

      {/* BUSCADOR */}
      <div className="card">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por equipo, probeta, referencia, ubicación, destino o usuario..."
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

      {/* TABLA */}
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
              <button
                onClick={limpiarFiltros}
                className="btn-ghost border border-gray-300 inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            ) : (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
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
                    <th className="px-4 py-3">Objeto</th>
                    <th className="px-4 py-3">Origen → Destino</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibles.map((m) => {
                    const conf = tipoConfig[m.tipo as TipoMov] ?? tipoConfig.ajuste;
                    const Icon = conf.icon;
                    const esExterno = m.tipo === 'prestamo_externo' || m.tipo === 'devolucion_externa';
                    const destinoConf = m.destino_tipo
                      ? tipoDestinoConfig[m.destino_tipo]
                      : null;
                    const DestinoIcon = destinoConf?.icon ?? Building2;
                    const puedeDevolver = estaFuera(m);
                    const devolviendoEste = devolviendo === m.id;

                    return (
                      <tr
                        key={m.id}
                        className={`hover:bg-gray-50 transition ${
                          puedeDevolver ? 'bg-airbus-orange/5' : esExterno ? 'bg-airbus-orange/3' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${conf.bg} ${conf.border}`}>
                            <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${conf.color}`}>
                              {conf.label}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {m.equipo_id && m.equipos ? (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-airbus-blue/10 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-airbus-blue" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-airbus-blue text-xs">
                                    {m.equipos.id_equipo}
                                  </span>
                                  <span className="text-sm text-gray-800 truncate">
                                    {m.equipos.nombre}
                                  </span>
                                  {m.equipos.tecnicas_ndt?.codigo && (
                                    <span className="badge badge-blue">
                                      {m.equipos.tecnicas_ndt.codigo}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono text-gray-400 truncate">
                                  {m.equipos.codigo_barras}
                                </p>
                              </div>
                            </div>
                          ) : m.probeta_id && m.probetas ? (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-airbus-sky/10 flex items-center justify-center shrink-0">
                                <Hash className="w-4 h-4 text-airbus-sky" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-airbus-sky text-xs">
                                    {m.probetas.pn}
                                  </span>
                                  <span className="text-sm text-gray-800 truncate">
                                    {m.probetas.nombre}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-400 truncate">
                                  {m.probetas.carros?.codigo ? `${m.probetas.carros.codigo} · ` : ''}
                                  <span className="font-mono">{m.probetas.codigo_barras}</span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs text-gray-600">
                          {esExterno && m.destino_nombre ? (
                            <div className="flex items-start gap-2">
                              <div className="w-7 h-7 rounded-lg bg-airbus-orange/15 flex items-center justify-center shrink-0">
                                <DestinoIcon className="w-3.5 h-3.5 text-airbus-orange" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wider text-airbus-orange font-semibold">
                                  {destinoConf?.label}
                                </p>
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {m.destino_nombre}
                                </p>
                                {m.destino_contacto && (
                                  <p className="text-[10px] text-gray-500 truncate">
                                    {m.destino_contacto}
                                  </p>
                                )}
                                {m.fecha_devolucion_prevista && (
                                  <p className="text-[10px] text-airbus-orange flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-2.5 h-2.5" />
                                    Devolución: {new Date(m.fecha_devolucion_prevista).toLocaleDateString('es-ES')}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : m.ubicacion_origen || m.ubicacion_destino ? (
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

                        {/* ACCIONES */}
                        <td className="px-4 py-3 text-right">
                          {puedeDevolver && (
                            <button
                              onClick={() => devolverObjeto(m)}
                              disabled={devolviendoEste}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-airbus-green text-white rounded-lg text-xs font-semibold hover:bg-airbus-navy transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                              title="Registrar la devolución de este préstamo"
                            >
                              {devolviendoEste ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CornerDownLeft className="w-3.5 h-3.5" />
                              )}
                              Devolver
                            </button>
                          )}
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
      className={`card p-3 flex items-center gap-2.5 text-left transition border-2 ${
        activo ? config.border : 'border-transparent hover:border-gray-200'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold text-gray-800 leading-none">{count}</p>
        <p className="text-[10px] text-gray-500 leading-tight mt-0.5 truncate">
          {config.label}
        </p>
      </div>
    </button>
  );
}