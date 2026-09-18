import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, RefreshCw, Package, Search, Edit3, Trash2, ChevronDown,
  ChevronRight, Wrench, AlertTriangle, Layers, Grid3x3,
  FileCheck2, X, Highlighter, Barcode,
  Truck, Building2, Warehouse, Users,
} from 'lucide-react';
import BarcodeLib from 'react-barcode';
import { Modal } from '../components/ui/Modal';
import { CarroForm } from '../components/carros/CarroForm';
import { ProbetaForm } from '../components/carros/ProbetaForm';
import { ProbetaDetalle } from '../components/carros/ProbetaDetalle';
import { usePrestamosExternos } from '../hooks/usePrestamosExternos';

const tipoDestinoConfig: Record<string, { label: string; icon: any }> = {
  almacen: { label: 'Almacén', icon: Warehouse },
  seccion: { label: 'Sección', icon: Building2 },
  compania: { label: 'Compañía', icon: Truck },
  cliente: { label: 'Cliente', icon: Users },
  otro: { label: 'Otro', icon: Building2 },
};

export function Carros() {
  const [carros, setCarros] = useState<any[]>([]);
  const [probetas, setProbetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [soloFuera, setSoloFuera] = useState(false);

  const [modalCarroOpen, setModalCarroOpen] = useState(false);
  const [carroEditando, setCarroEditando] = useState<any | null>(null);

  const [modalProbetaOpen, setModalProbetaOpen] = useState(false);
  const [probetaEditando, setProbetaEditando] = useState<any | null>(null);
  const [carroDestino, setCarroDestino] = useState<string | null>(null);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleProbeta, setDetalleProbeta] = useState<any | null>(null);
  const [detalleCarro, setDetalleCarro] = useState<any | null>(null);
  const [barcodeAbierto, setBarcodeAbierto] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [avisoFueraCerrado, setAvisoFueraCerrado] = useState(false);

  const { fueraMap } = usePrestamosExternos();

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from('carros').select('*').order('codigo'),
      supabase
        .from('probetas')
        .select('*, tecnicas_ndt(codigo, nombre)')
        .neq('estado', 'salida')
        .order('pn'),
    ]);
    if (c.error) console.error(c.error);
    if (p.error) console.error(p.error);
    setCarros(c.data ?? []);
    setProbetas(p.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const probetasFuera = useMemo(
    () => probetas.filter((p) => fueraMap.has(p.id)),
    [probetas, fueraMap]
  );

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
        const pa = a.num_posicion ?? 999;
        const pb = b.num_posicion ?? 999;
        if (pa !== pb) return pa - pb;
        return (a.pn ?? '').localeCompare(b.pn ?? '');
      });
    });
    return map;
  }, [probetas]);

  const qLower = q.trim().toLowerCase();

  const probetaCoincide = useCallback((p: any): boolean => {
    if (!qLower) return false;
    const campos = [
      p.pn,
      p.codigo_barras,
      p.nombre,
      p.material,
      p.dimensiones,
      p.numero_serie,
      p.observaciones,
      p.normas_ntm,
      p.tecnicas_ndt?.codigo,
      p.tecnicas_ndt?.nombre,
      p.num_bandeja != null ? `B${p.num_bandeja}` : null,
      p.num_bandeja != null ? `bandeja ${p.num_bandeja}` : null,
      p.num_posicion != null ? `P${p.num_posicion}` : null,
      p.num_posicion != null ? `posicion ${p.num_posicion}` : null,
    ];
    return campos
      .filter((c) => c != null)
      .join(' ')
      .toLowerCase()
      .includes(qLower);
  }, [qLower]);

  const carroCoincide = useCallback((c: any): boolean => {
    if (!qLower) return true;
    return [c.codigo, c.nombre, c.descripcion, c.ubicacion]
      .filter(Boolean).join(' ').toLowerCase().includes(qLower);
  }, [qLower]);

  const resultadoBusqueda = useMemo(() => {
    if (!qLower && !soloFuera) {
      return {
        carrosVisibles: carros,
        probetasMatch: new Set<string>(),
        carrosAutoExpandir: new Set<string>(),
        probetasSinCarroVisibles: probetasPorCarro['__sin_carro__'] ?? [],
        totalCoincidencias: 0,
      };
    }

    const probetasMatch = new Set<string>();
    const carrosAutoExpandir = new Set<string>();
    const carrosConMatchDirecto = new Set<string>();

    probetas.forEach((p) => {
      if (soloFuera) {
        if (fueraMap.has(p.id)) {
          probetasMatch.add(p.id);
          if (p.carro_id) carrosAutoExpandir.add(p.carro_id);
        }
      } else if (probetaCoincide(p)) {
        probetasMatch.add(p.id);
        if (p.carro_id) carrosAutoExpandir.add(p.carro_id);
      }
    });

    if (!soloFuera) {
      carros.forEach((c) => {
        if (carroCoincide(c)) carrosConMatchDirecto.add(c.id);
      });
    }

    const carrosVisibles = carros.filter((c) =>
      carrosConMatchDirecto.has(c.id) || carrosAutoExpandir.has(c.id)
    );

    const probetasSinCarroVisibles = (probetasPorCarro['__sin_carro__'] ?? []).filter(
      (p) => probetasMatch.has(p.id)
    );

    return {
      carrosVisibles,
      probetasMatch,
      carrosAutoExpandir,
      probetasSinCarroVisibles,
      totalCoincidencias: probetasMatch.size + carrosConMatchDirecto.size,
    };
  }, [qLower, soloFuera, carros, probetas, probetasPorCarro, probetaCoincide, carroCoincide, fueraMap]);

  const {
    carrosVisibles,
    probetasMatch,
    carrosAutoExpandir,
    probetasSinCarroVisibles,
    totalCoincidencias,
  } = resultadoBusqueda;

  const hayBusquedaActiva = qLower.length > 0;
  const hayResultados = carrosVisibles.length > 0 || probetasSinCarroVisibles.length > 0;

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

  const abrirDetalleProbeta = (probeta: any, carro: any | null) => {
    setDetalleProbeta(probeta);
    setDetalleCarro(carro);
    setDetalleOpen(true);
  };

  const getProbetasDeLaBandeja = (probeta: any) => {
    if (!probeta?.carro_id || !probeta?.num_bandeja) return [];
    return (probetasPorCarro[probeta.carro_id] ?? []).filter(
      (p) => p.num_bandeja === probeta.num_bandeja
    );
  };

  const parseNtms = (probeta: any): string[] => {
    if (!probeta?.normas_ntm) return [];
    return String(probeta.normas_ntm)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  };

  const resaltar = (texto: string) => {
    if (!qLower || !texto) return texto;
    const idx = texto.toLowerCase().indexOf(qLower);
    if (idx === -1) return texto;
    return (
      <>
        {texto.slice(0, idx)}
        <mark className="bg-airbus-yellow/60 text-gray-900 rounded px-0.5">
          {texto.slice(idx, idx + qLower.length)}
        </mark>
        {texto.slice(idx + qLower.length)}
      </>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Carros de calibración</h1>
          <p className="text-sm text-gray-500">
            {carros.length} carros · {probetas.length} probetas
            {probetasFuera.length > 0 && (
              <span className="ml-2 text-airbus-orange font-semibold">
                · {probetasFuera.length} fuera del almacén
              </span>
            )}
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

      {/* BANNER: PROBETAS FUERA */}
      {!avisoFueraCerrado && probetasFuera.length > 0 && (
        <div className="bg-gradient-to-r from-airbus-orange to-airbus-red rounded-xl shadow-lg overflow-hidden animate-in">
          <div className="flex items-start gap-4 p-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 text-white animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-bold text-base">
                  {probetasFuera.length} probeta{probetasFuera.length !== 1 ? 's' : ''} fuera del almacén
                </h3>
                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                  PRÉSTAMO EXTERNO
                </span>
              </div>

              <p className="text-white/90 text-sm mt-1">
                Estas probetas están prestadas a terceros y no están disponibles para uso interno.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {probetasFuera.slice(0, 3).map((p) => {
                  const info = fueraMap.get(p.id);
                  const destinoConf = info?.prestamo.destino_tipo
                    ? tipoDestinoConfig[info.prestamo.destino_tipo]
                    : null;
                  const DestIcon = destinoConf?.icon ?? Building2;
                  return (
                    <button
                      key={p.id}
                      onClick={() => abrirDetalleProbeta(p, null)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full text-xs text-white transition"
                      title={`${destinoConf?.label}: ${info?.prestamo.destino_nombre}`}
                    >
                      <DestIcon className="w-3 h-3" />
                      <span className="font-mono font-bold">{p.pn}</span>
                      <span className="opacity-80 truncate max-w-[140px]">
                        {info?.prestamo.destino_nombre}
                      </span>
                    </button>
                  );
                })}
                {probetasFuera.length > 3 && (
                  <button
                    onClick={() => {
                      setSoloFuera(true);
                      setAvisoFueraCerrado(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/25 hover:bg-white/35 rounded-full text-xs text-white font-semibold transition"
                  >
                    +{probetasFuera.length - 3} más →
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setAvisoFueraCerrado(true)}
              className="p-1.5 hover:bg-white/10 rounded-full transition shrink-0"
              title="Cerrar aviso"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="card space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10 pr-10"
            placeholder="Buscar por carro, P/N, código de barras, NTM, bandeja, posición..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {probetasFuera.length > 0 && (
          <div>
            <button
              onClick={() => setSoloFuera(!soloFuera)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
                soloFuera
                  ? 'bg-airbus-orange text-white border-airbus-orange shadow-sm'
                  : 'bg-white text-airbus-orange border-airbus-orange/40 hover:bg-airbus-orange/5'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Solo probetas fuera del almacén
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  soloFuera
                    ? 'bg-white/20 text-white'
                    : 'bg-airbus-orange/15 text-airbus-orange'
                }`}
              >
                {probetasFuera.length}
              </span>
            </button>
          </div>
        )}

        {(hayBusquedaActiva || soloFuera) && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Highlighter className="w-3.5 h-3.5" />
              <span>
                {hayResultados ? (
                  <>
                    <strong className="text-airbus-blue">{totalCoincidencias}</strong>{' '}
                    coincidencia{totalCoincidencias !== 1 ? 's' : ''} · {' '}
                    <strong className="text-airbus-blue">{carrosVisibles.length}</strong>{' '}
                    carro{carrosVisibles.length !== 1 ? 's' : ''}
                  </>
                ) : (
                  'Sin resultados'
                )}
              </span>
            </div>
            <button
              onClick={() => { setQ(''); setSoloFuera(false); }}
              className="text-airbus-sky hover:text-airbus-blue font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando...
        </div>
      ) : !hayResultados && (hayBusquedaActiva || soloFuera) ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 mb-1">
            {soloFuera && !hayBusquedaActiva
              ? 'No hay probetas fuera del almacén'
              : `Sin resultados para "${q}"`}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            {soloFuera
              ? 'Todas las probetas están dentro del almacén'
              : 'Prueba con el código de carro, el P/N de una probeta, un código de barras o un código NTM'}
          </p>
          <button
            onClick={() => { setQ(''); setSoloFuera(false); }}
            className="btn-ghost border border-gray-300 inline-flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        </div>
      ) : carros.length === 0 ? (
        <div className="card p-12 text-center">
          <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 mb-4">Aún no hay carros registrados</p>
          <button onClick={abrirNuevoCarro} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {carrosVisibles.map((carro) => {
            const listaProbetas = probetasPorCarro[carro.id] ?? [];
            const autoExpandido = (hayBusquedaActiva || soloFuera) && carrosAutoExpandir.has(carro.id);
            const expandido = expandidos.has(carro.id) || autoExpandido;
            const capacidadTotal = (carro.num_bandejas ?? 0) * (carro.posiciones_por_bandeja ?? 0);
            const pct = capacidadTotal > 0
              ? Math.min(100, Math.round((listaProbetas.length / capacidadTotal) * 100))
              : null;

            const probetasDeEsteCarroQueMatchean = listaProbetas.filter((p) =>
              probetasMatch.has(p.id)
            ).length;
            const probetasFueraDeEsteCarro = listaProbetas.filter((p) =>
              fueraMap.has(p.id)
            ).length;

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
                    <Wrench className="w-6 h-6 text-airbus-light" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-airbus-blue text-sm">
                        {resaltar(carro.codigo)}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {resaltar(carro.nombre)}
                      </span>
                      {!carro.activo && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded-full uppercase">
                          Inactivo
                        </span>
                      )}
                      {probetasFueraDeEsteCarro > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-orange/15 text-airbus-orange border border-airbus-orange/40 rounded-full text-[10px] font-bold">
                          <Truck className="w-3 h-3" />
                          {probetasFueraDeEsteCarro} fuera
                        </span>
                      )}
                      {(hayBusquedaActiva || soloFuera) && probetasDeEsteCarroQueMatchean > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-yellow/30 text-yellow-800 border border-airbus-yellow/60 rounded-full text-[10px] font-bold">
                          <FileCheck2 className="w-3 h-3" />
                          {probetasDeEsteCarroQueMatchean} probeta
                          {probetasDeEsteCarroQueMatchean !== 1 ? 's' : ''} coinciden
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

                      {carro.posiciones_por_bandeja > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-blue/10 text-airbus-blue rounded-full font-semibold">
                          <Grid3x3 className="w-3 h-3" />
                          {carro.posiciones_por_bandeja} pos.
                        </span>
                      )}

                      <span className="font-semibold text-airbus-blue">
                        {listaProbetas.length} probeta{listaProbetas.length !== 1 ? 's' : ''}
                        {capacidadTotal > 0 && (
                          <span className="text-gray-400 font-normal">
                            {' '}/ {capacidadTotal}
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
                          const esMatch = probetasMatch.has(probeta.id);
                          const ntms = parseNtms(probeta);
                          const fueraInfo = fueraMap.get(probeta.id);
                          const estaFuera = !!fueraInfo;
                          const destinoConf = fueraInfo?.prestamo.destino_tipo
                            ? tipoDestinoConfig[fueraInfo.prestamo.destino_tipo]
                            : null;
                          const DestIcon = destinoConf?.icon ?? Truck;

                          return (
                            <div
                              key={probeta.id}
                              className={`flex items-center gap-3 px-4 py-3 hover:bg-white transition group cursor-pointer relative ${
                                estaFuera ? 'bg-airbus-orange/5' :
                                esMatch ? 'bg-airbus-yellow/10' : ''
                              }`}
                              onClick={() => abrirDetalleProbeta(probeta, carro)}
                            >
                              {estaFuera && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-airbus-orange" />
                              )}
                              {!estaFuera && esMatch && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-airbus-yellow" />
                              )}

                              {probeta.foto_url ? (
                                <div className={`w-14 h-14 rounded-lg border shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden ${
                                  estaFuera ? 'border-airbus-orange' :
                                  esMatch ? 'border-airbus-yellow' : 'border-gray-200'
                                }`}>
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
                                <div className={`w-14 h-14 bg-white border rounded-lg flex items-center justify-center shrink-0 ${
                                  estaFuera ? 'border-airbus-orange' :
                                  esMatch ? 'border-airbus-yellow' : 'border-gray-200'
                                }`}>
                                  <Package className={`w-5 h-5 ${estaFuera ? 'text-airbus-orange' : 'text-airbus-sky'}`} />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-airbus-blue text-xs">
                                    {resaltar(probeta.pn)}
                                  </span>
                                  <span className="text-sm text-gray-800 truncate">
                                    {resaltar(probeta.nombre)}
                                  </span>
                                  {probeta.tecnicas_ndt && (
                                    <span className="badge badge-blue">
                                      {probeta.tecnicas_ndt.codigo}
                                    </span>
                                  )}
                                  {probeta.num_bandeja && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-sky/15 text-airbus-sky rounded-full text-[10px] font-bold">
                                      <Layers className="w-3 h-3" />
                                      B{probeta.num_bandeja}
                                      {probeta.num_posicion ? ` · P${probeta.num_posicion}` : ''}
                                    </span>
                                  )}
                                  {!probeta.activa && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-semibold rounded-full uppercase">
                                      Inactiva
                                    </span>
                                  )}

                                  {estaFuera && (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-airbus-orange/15 text-airbus-orange border border-airbus-orange/40 max-w-full"
                                      title={`${destinoConf?.label}: ${fueraInfo?.prestamo.destino_nombre}${fueraInfo?.prestamo.destino_contacto ? ` (${fueraInfo.prestamo.destino_contacto})` : ''}${fueraInfo?.retrasado ? ' · RETRASADO' : ''}`}
                                    >
                                      <DestIcon className="w-3 h-3 shrink-0" />
                                      <span className="truncate">
                                        {fueraInfo?.prestamo.destino_nombre ?? 'Fuera'}
                                      </span>
                                      {fueraInfo?.retrasado && (
                                        <AlertTriangle className="w-3 h-3 shrink-0" />
                                      )}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400 flex-wrap">
                                  {probeta.material && <span>{resaltar(probeta.material)}</span>}
                                  {probeta.dimensiones && <span>{probeta.dimensiones}</span>}
                                </div>

                                {probeta.codigo_barras && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setBarcodeAbierto(probeta.codigo_barras); }}
                                    className="mt-1 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-airbus-sky/10 transition"
                                    title="Ver código de barras ampliado"
                                  >
                                    <Barcode className="w-3 h-3 text-airbus-sky" />
                                    <BarcodeLib
                                      value={probeta.codigo_barras}
                                      format="CODE128"
                                      displayValue={false}
                                      height={20}
                                      width={1}
                                      margin={0}
                                      lineColor="#00205B"
                                    />
                                  </button>
                                )}

                                {ntms.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <FileCheck2 className="w-3 h-3 text-airbus-sky shrink-0" />
                                    {ntms.map((ntm) => {
                                      const ntmEsMatch = hayBusquedaActiva &&
                                        ntm.toLowerCase().includes(qLower);
                                      return (
                                        <span
                                          key={ntm}
                                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                            ntmEsMatch
                                              ? 'bg-airbus-yellow text-gray-900 shadow-sm'
                                              : 'bg-airbus-sky/10 text-airbus-sky'
                                          }`}
                                        >
                                          {ntm}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); abrirEditarProbeta(probeta); }}
                                  className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                                  title="Editar"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); eliminarProbeta(probeta); }}
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

          {(!hayBusquedaActiva && !soloFuera ? (probetasPorCarro['__sin_carro__'] ?? []) : probetasSinCarroVisibles).length > 0 && (
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
                    {(!hayBusquedaActiva && !soloFuera ? (probetasPorCarro['__sin_carro__'] ?? []) : probetasSinCarroVisibles).length} probeta
                    {(!hayBusquedaActiva && !soloFuera ? (probetasPorCarro['__sin_carro__'] ?? []) : probetasSinCarroVisibles).length !== 1 ? 's' : ''} pendiente
                    {(!hayBusquedaActiva && !soloFuera ? (probetasPorCarro['__sin_carro__'] ?? []) : probetasSinCarroVisibles).length !== 1 ? 's' : ''} de asignar a un carro
                  </p>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {(!hayBusquedaActiva && !soloFuera ? (probetasPorCarro['__sin_carro__'] ?? []) : probetasSinCarroVisibles).map((probeta) => {
                  const esMatch = probetasMatch.has(probeta.id);
                  const ntms = parseNtms(probeta);
                  const fueraInfo = fueraMap.get(probeta.id);
                  const estaFuera = !!fueraInfo;
                  const destinoConf = fueraInfo?.prestamo.destino_tipo
                    ? tipoDestinoConfig[fueraInfo.prestamo.destino_tipo]
                    : null;
                  const DestIcon = destinoConf?.icon ?? Truck;

                  return (
                    <div
                      key={probeta.id}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition group cursor-pointer relative ${
                        estaFuera ? 'bg-airbus-orange/5' :
                        esMatch ? 'bg-airbus-yellow/10' : ''
                      }`}
                      onClick={() => abrirDetalleProbeta(probeta, null)}
                    >
                      {estaFuera && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-airbus-orange" />
                      )}
                      {!estaFuera && esMatch && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-airbus-yellow" />
                      )}

                      {probeta.foto_url ? (
                        <div className={`w-12 h-12 rounded-lg border shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden ml-4 ${
                          estaFuera ? 'border-airbus-orange' :
                          esMatch ? 'border-airbus-yellow' : 'border-gray-200'
                        }`}>
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
                        <Package className={`w-4 h-4 shrink-0 ml-4 ${estaFuera ? 'text-airbus-orange' : 'text-gray-400'}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-airbus-blue text-xs mr-2">
                            {resaltar(probeta.pn)}
                          </span>
                          <span className="text-sm text-gray-800">
                            {resaltar(probeta.nombre)}
                          </span>
                          {estaFuera && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-airbus-orange/15 text-airbus-orange border border-airbus-orange/40 max-w-full"
                              title={`${destinoConf?.label}: ${fueraInfo?.prestamo.destino_nombre}`}
                            >
                              <DestIcon className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {fueraInfo?.prestamo.destino_nombre ?? 'Fuera'}
                              </span>
                            </span>
                          )}
                        </div>
                        {ntms.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <FileCheck2 className="w-3 h-3 text-airbus-sky shrink-0" />
                            {ntms.map((ntm) => {
                              const ntmEsMatch = hayBusquedaActiva &&
                                ntm.toLowerCase().includes(qLower);
                              return (
                                <span
                                  key={ntm}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                    ntmEsMatch
                                      ? 'bg-airbus-yellow text-gray-900 shadow-sm'
                                      : 'bg-airbus-sky/10 text-airbus-sky'
                                  }`}
                                >
                                  {ntm}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirEditarProbeta(probeta); }}
                        className="text-xs text-airbus-sky hover:text-airbus-blue font-medium"
                      >
                        Asignar a carro
                      </button>
                    </div>
                  );
                })}
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

      <Modal
        open={detalleOpen}
        onClose={() => { setDetalleOpen(false); setDetalleProbeta(null); setDetalleCarro(null); }}
        title={detalleProbeta ? `Probeta ${detalleProbeta.pn}` : 'Detalle'}
        size="lg"
      >
        {detalleProbeta && (
          <ProbetaDetalle
            probeta={detalleProbeta}
            carro={detalleCarro}
            onClose={() => { setDetalleOpen(false); setDetalleProbeta(null); setDetalleCarro(null); }}
            probetasEnBandeja={getProbetasDeLaBandeja(detalleProbeta)}
          />
        )}
      </Modal>

      <Modal
        open={!!barcodeAbierto}
        onClose={() => setBarcodeAbierto(null)}
        title="Código de barras"
        size="sm"
      >
        {barcodeAbierto && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <BarcodeLib
                value={barcodeAbierto}
                format="CODE128"
                displayValue={false}
                height={80}
                width={2.5}
                margin={0}
                lineColor="#00205B"
              />
            </div>
            <p className="font-mono text-xs text-gray-500">{barcodeAbierto}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}