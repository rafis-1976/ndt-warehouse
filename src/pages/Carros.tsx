import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, RefreshCw, Package, Search, Edit3, Trash2, ChevronDown,
  ChevronRight, Boxes, AlertTriangle, CheckCircle2, Layers,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { CarroForm } from '../components/carros/CarroForm';
import { ProbetaForm } from '../components/carros/ProbetaForm';

export function Carros() {
  const [carros, setCarros] = useState<any[]>([]);
  const [probetas, setProbetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [modalCarroOpen, setModalCarroOpen] = useState(false);
  const [carroEditando, setCarroEditando] = useState<any | null>(null);

  const [modalProbetaOpen, setModalProbetaOpen] = useState(false);
  const [probetaEditando, setProbetaEditando] = useState<any | null>(null);
  const [carroDestino, setCarroDestino] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from('carros').select('*').order('codigo'),
      supabase.from('probetas').select('*, tecnicas_ndt(codigo, nombre)').order('num_bandeja', { ascending: true, nullsFirst: false }).order('codigo'),
    ]);
    if (c.error) console.error(c.error);
    if (p.error) console.error(p.error);
    setCarros(c.data ?? []);
    setProbetas(p.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpandir = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const probetasPorCarro = useMemo(() => {
    const map: Record<string, any[]> = {};
    probetas.forEach((p) => {
      const key = p.carro_id ?? '__sin_carro__';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const ba = a.num_bandeja ?? 999;
        const bb = b.num_bandeja ?? 999;
        if (ba !== bb) return ba - bb;
        return (a.codigo ?? '').localeCompare(b.codigo ?? '');
      });
    });
    return map;
  }, [probetas]);

  const carrosFiltrados = useMemo(() => {
    if (!q.trim()) return carros;
    const qLower = q.toLowerCase();
    return carros.filter((c) =>
      [c.codigo, c.nombre, c.descripcion, c.ubicacion]
        .filter(Boolean).join(' ').toLowerCase().includes(qLower)
    );
  }, [carros, q]);

  const probetasSinCarro = probetasPorCarro['__sin_carro__'] ?? [];

  const handleSuccessCarro = () => {
    setModalCarroOpen(false);
    setCarroEditando(null);
    setToast(carroEditando ? 'Carro actualizado' : 'Carro creado');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const handleSuccessProbeta = () => {
    setModalProbetaOpen(false);
    setProbetaEditando(null);
    setCarroDestino(null);
    setToast(probetaEditando ? 'Probeta actualizada' : 'Probeta creada');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const eliminarCarro = async (carro: any) => {
    const nProbetas = (probetasPorCarro[carro.id] ?? []).length;
    const msg = nProbetas > 0
      ? `El carro "${carro.nombre}" tiene ${nProbetas} probetas asignadas. ¿Eliminar de todas formas? Las probetas quedarán sin carro.`
      : `¿Eliminar el carro "${carro.nombre}"?`;
    if (!confirm(msg)) return;

    const { error } = await supabase.from('carros').delete().eq('id', carro.id);
    if (error) {
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
      return;
    }
    setToast('Carro eliminado');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const eliminarProbeta = async (probeta: any) => {
    if (!confirm(`¿Eliminar la probeta "${probeta.nombre}"?`)) return;
    const { error } = await supabase.from('probetas').delete().eq('id', probeta.id);
    if (error) {
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
      return;
    }
    setToast('Probeta eliminada');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const abrirNuevoCarro = () => {
    setCarroEditando(null);
    setModalCarroOpen(true);
  };

  const abrirEditarCarro = (carro: any) => {
    setCarroEditando(carro);
    setModalCarroOpen(true);
  };

  const abrirNuevaProbeta = (carroId?: string) => {
    setProbetaEditando(null);
    setCarroDestino(carroId ?? null);
    setModalProbetaOpen(true);
  };

  const abrirEditarProbeta = (probeta: any) => {
    setProbetaEditando(probeta);
    setCarroDestino(null);
    setModalProbetaOpen(true);
  };

  const isCalibracionProblema = (fecha: string | null) => {
    if (!fecha) return false;
    const diff = new Date(fecha).getTime() - Date.now();
    return diff < 30 * 864e5;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Carros de calibración</h1>
          <p className="text-sm text-gray-500">
            {carros.length} carros · {probetas.length} probetas
          </p>
        </div>
        <button
          onClick={abrirNuevoCarro}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo carro
        </button>
      </div>

      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
          {toast}
        </div>
      )}
      {toastError && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-red text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
          {toastError}
        </div>
      )}

      <div className="card">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Buscar carro por código, nombre, ubicación..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando...
        </div>
      ) : carrosFiltrados.length === 0 ? (
        <div className="card p-12 text-center">
          <Boxes className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 mb-4">
            {carros.length === 0 ? 'Aún no hay carros registrados' : 'Sin resultados'}
          </p>
          {carros.length === 0 && (
            <button onClick={abrirNuevoCarro} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {carrosFiltrados.map((carro) => {
            const listaProbetas = probetasPorCarro[carro.id] ?? [];
            const expandido = expandidos.has(carro.id);
            const pct = carro.num_bandejas > 0
              ? Math.min(100, Math.round((listaProbetas.length / carro.num_bandejas) * 100))
              : null;

            const porBandeja = new Map<number | null, any[]>();
            listaProbetas.forEach((pb) => {
              const k = pb.num_bandeja ?? null;
              if (!porBandeja.has(k)) porBandeja.set(k, []);
              porBandeja.get(k)!.push(pb);
            });

            return (
              <div key={carro.id} className="card p-0 overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggleExpandir(carro.id)}
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {expandido ? (
                      <ChevronDown className="w-5 h-5 text-airbus-sky" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  <div className="w-12 h-12 bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl flex items-center justify-center shrink-0">
                    <Boxes className="w-6 h-6 text-airbus-light" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-airbus-blue text-sm">
                        {carro.codigo}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {carro.nombre}
                      </span>
                      {!carro.activo && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded-full uppercase">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {carro.descripcion && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {carro.descripcion}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                      {carro.ubicacion && <span>📍 {carro.ubicacion}</span>}

                      {carro.num_bandejas > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-sky/10 text-airbus-sky rounded-full font-semibold">
                          <Layers className="w-3 h-3" />
                          {carro.num_bandejas} bandeja{carro.num_bandejas !== 1 ? 's' : ''}
                        </span>
                      )}

                      <span className="font-semibold text-airbus-blue">
                        {listaProbetas.length} probeta{listaProbetas.length !== 1 ? 's' : ''}
                        {carro.num_bandejas > 0 && (
                          <span className="text-gray-400 font-normal">
                            {' '}/ {carro.num_bandejas}
                          </span>
                        )}
                      </span>

                      {pct !== null && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                pct >= 90 ? 'bg-airbus-red'
                                : pct >= 70 ? 'bg-airbus-orange'
                                : 'bg-airbus-green'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-500">
                            {pct}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => abrirNuevaProbeta(carro.id)}
                      className="p-2 text-airbus-green hover:bg-airbus-green/10 rounded-lg transition"
                      title="Añadir probeta"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => abrirEditarCarro(carro)}
                      className="p-2 text-airbus-sky hover:bg-airbus-sky/10 rounded-lg transition"
                      title="Editar carro"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => eliminarCarro(carro)}
                      className="p-2 text-gray-400 hover:text-airbus-red hover:bg-airbus-red/10 rounded-lg transition"
                      title="Eliminar carro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {listaProbetas.length === 0 ? (
                      <div className="p-6 text-center">
                        <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 mb-3">
                          Este carro no tiene probetas asignadas
                        </p>
                        <button
                          onClick={() => abrirNuevaProbeta(carro.id)}
                          className="btn-ghost border border-gray-300 text-xs inline-flex items-center gap-2"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Añadir probeta
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {listaProbetas.map((probeta) => {
                          const alerta = isCalibracionProblema(probeta.proxima_calibracion);
                          const vencida = probeta.proxima_calibracion &&
                            new Date(probeta.proxima_calibracion) < new Date();

                          return (
                            <div
                              key={probeta.id}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-white transition group"
                            >
                              {probeta.foto_url ? (
                                <div className="w-14 h-14 rounded-lg border border-gray-200 shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                                  <img
                                    src={probeta.foto_url}
                                    alt={probeta.nombre}
                                    className="w-full h-full object-contain"
                                    onError={(ev) => {
                                      (ev.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-14 h-14 bg-white border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
                                  <Package className="w-5 h-5 text-airbus-sky" />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-airbus-blue text-xs">
                                    {probeta.codigo}
                                  </span>
                                  <span className="text-sm text-gray-800 truncate">
                                    {probeta.nombre}
                                  </span>
                                  {probeta.tecnicas_ndt && (
                                    <span className="badge badge-blue">
                                      {probeta.tecnicas_ndt.codigo}
                                    </span>
                                  )}
                                  {probeta.num_bandeja && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-sky/15 text-airbus-sky rounded-full text-[10px] font-bold">
                                      <Layers className="w-3 h-3" />
                                      Bandeja {probeta.num_bandeja}
                                    </span>
                                  )}
                                  {!probeta.activa && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-semibold rounded-full uppercase">
                                      Inactiva
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                                  {probeta.tipo && <span>{probeta.tipo}</span>}
                                  {probeta.material && <span>{probeta.material}</span>}
                                  {probeta.dimensiones && <span>{probeta.dimensiones}</span>}
                                </div>
                              </div>

                              {probeta.proxima_calibracion && (
                                <div className={`text-[10px] font-semibold whitespace-nowrap flex items-center gap-1 ${
                                  vencida ? 'text-airbus-red' : alerta ? 'text-airbus-orange' : 'text-airbus-green'
                                }`}>
                                  {vencida || alerta ? (
                                    <AlertTriangle className="w-3 h-3" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  {probeta.proxima_calibracion}
                                </div>
                              )}

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button
                                  onClick={() => abrirEditarProbeta(probeta)}
                                  className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                                  title="Editar"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => eliminarProbeta(probeta)}
                                  className="p-1.5 text-gray-400 hover:text-airbus-red hover:bg-airbus-red/10 rounded transition"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {probetasSinCarro.length > 0 && (
            <div className="card p-0 overflow-hidden border-2 border-dashed border-airbus-orange/40">
              <div className="flex items-center gap-3 p-4 bg-airbus-orange/5">
                <div className="w-12 h-12 bg-airbus-orange/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-airbus-orange" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-airbus-orange text-sm">
                    Probetas sin carro asignado
                  </p>
                  <p className="text-xs text-gray-600">
                    {probetasSinCarro.length} probeta{probetasSinCarro.length !== 1 ? 's' : ''} pendiente{probetasSinCarro.length !== 1 ? 's' : ''} de asignar a un carro
                  </p>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {probetasSinCarro.map((probeta) => (
                  <div key={probeta.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition group">
                    {probeta.foto_url ? (
                      <div className="w-12 h-12 rounded-lg border border-gray-200 shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden ml-4">
                        <img
                          src={probeta.foto_url}
                          alt={probeta.nombre}
                          className="w-full h-full object-contain"
                          onError={(ev) => {
                            (ev.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <Package className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-mono font-bold text-airbus-blue text-xs mr-2">
                        {probeta.codigo}
                      </span>
                      <span className="text-sm text-gray-800">{probeta.nombre}</span>
                    </div>
                    <button
                      onClick={() => abrirEditarProbeta(probeta)}
                      className="text-xs text-airbus-sky hover:text-airbus-blue font-medium"
                    >
                      Asignar a carro
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalCarroOpen}
        onClose={() => { setModalCarroOpen(false); setCarroEditando(null); }}
        title={carroEditando ? 'Editar carro' : 'Nuevo carro'}
        size="md"
      >
        <CarroForm
          carro={carroEditando}
          onSuccess={handleSuccessCarro}
          onCancel={() => { setModalCarroOpen(false); setCarroEditando(null); }}
        />
      </Modal>

      <Modal
        open={modalProbetaOpen}
        onClose={() => { setModalProbetaOpen(false); setProbetaEditando(null); setCarroDestino(null); }}
        title={probetaEditando ? 'Editar probeta' : 'Nueva probeta'}
        size="lg"
      >
        <ProbetaForm
          probeta={probetaEditando}
          carroId={carroDestino ?? undefined}
          onSuccess={handleSuccessProbeta}
          onCancel={() => { setModalProbetaOpen(false); setProbetaEditando(null); setCarroDestino(null); }}
        />
      </Modal>
    </div>
  );
}