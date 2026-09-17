import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Plus, Hash, RefreshCw, Printer, X, Filter,
  Package, Layers, Grid3x3, FileCheck2, AlertTriangle, CheckCircle2,
  Barcode, Eye, Edit3, Trash2, Truck, Building2, Warehouse, Users,
  MapPin, FileText, Box,
} from 'lucide-react';
import BarcodeLib from 'react-barcode';
import { Modal } from '../components/ui/Modal';
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

type FiltroEstado = 'todas' | 'disponible' | 'prestado' | 'mantenimiento' | 'baja';

export function Probetas() {
  const [probetas, setProbetas] = useState<any[]>([]);
  const [carros, setCarros] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [filtroTecnica, setFiltroTecnica] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [filtroCarro, setFiltroCarro] = useState<string>('todos');
  const [soloFuera, setSoloFuera] = useState(false);

  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [probetaEditando, setProbetaEditando] = useState<any | null>(null);
  const [carroDestino, setCarroDestino] = useState<string | null>(null);

  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [probetaDetalle, setProbetaDetalle] = useState<any | null>(null);
  const [carroDetalle, setCarroDetalle] = useState<any | null>(null);

  const [barcodeAbierto, setBarcodeAbierto] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const { fueraMap } = usePrestamosExternos();

  // ============================================================
  // Carga de datos
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    const [pb, cr, tec] = await Promise.all([
      supabase
        .from('probetas')
        .select('*, tecnicas_ndt(codigo, nombre), carros(codigo, nombre, ubicacion, num_bandejas, posiciones_por_bandeja, bandejas_fotos)')
        .neq('estado', 'salida')
        .order('pn'),
      supabase.from('carros').select('*').order('codigo'),
      supabase
        .from('tecnicas_ndt')
        .select('id, codigo, nombre')
        .eq('activa', true)
        .order('codigo'),
    ]);
    if (pb.error) console.error(pb.error);
    setProbetas(pb.data ?? []);
    setCarros(cr.data ?? []);
    setTecnicas(tec.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ============================================================
  // Listas derivadas
  // ============================================================
  const probetasFuera = useMemo(
    () => probetas.filter((p) => fueraMap.has(p.id)),
    [probetas, fueraMap]
  );

  // ============================================================
  // Filtrado combinado
  // ============================================================
  const filtered = useMemo(() => {
    const qLower = q.toLowerCase().trim();
    return probetas.filter((p) => {
      // Filtro rápido "fuera del almacén"
      if (soloFuera && !fueraMap.has(p.id)) return false;

      // Búsqueda
      if (qLower) {
        const campos = [
          p.pn,
          p.nombre,
          p.codigo_barras,
          p.numero_serie,
          p.material,
          p.dimensiones,
          p.observaciones,
          p.normas_ntm,
          p.carros?.codigo,
          p.carros?.nombre,
          p.tecnicas_ndt?.codigo,
          p.tecnicas_ndt?.nombre,
          p.num_bandeja != null ? `bandeja ${p.num_bandeja}` : '',
          p.num_bandeja != null ? `b${p.num_bandeja}` : '',
          p.num_posicion != null ? `posicion ${p.num_posicion}` : '',
          p.num_posicion != null ? `p${p.num_posicion}` : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!campos.includes(qLower)) return false;
      }

      // Técnica
      if (filtroTecnica !== 'todas' && p.tecnicas_ndt?.codigo !== filtroTecnica) return false;

      // Estado
      if (filtroEstado !== 'todas' && p.estado !== filtroEstado) return false;

      // Carro
      if (filtroCarro !== 'todos') {
        if (filtroCarro === 'sin_carro' && p.carro_id) return false;
        if (filtroCarro !== 'sin_carro' && p.carro_id !== filtroCarro) return false;
      }

      return true;
    });
  }, [probetas, q, filtroTecnica, filtroEstado, filtroCarro, soloFuera, fueraMap]);

  // ============================================================
  // Contadores
  // ============================================================
  const contadores = useMemo(() => {
    const porTecnica: Record<string, number> = {};
    const porEstado: Record<string, number> = {
      disponible: 0, prestado: 0, mantenimiento: 0, baja: 0,
    };
    const porCarro: Record<string, number> = { sin_carro: 0 };

    probetas.forEach((p) => {
      const t = p.tecnicas_ndt?.codigo ?? 'sin';
      porTecnica[t] = (porTecnica[t] ?? 0) + 1;

      if (porEstado[p.estado] !== undefined) porEstado[p.estado]++;

      if (p.carro_id) {
        porCarro[p.carro_id] = (porCarro[p.carro_id] ?? 0) + 1;
      } else {
        porCarro.sin_carro++;
      }
    });

    return { porTecnica, porEstado, porCarro };
  }, [probetas]);

  const hayFiltrosActivos =
    q !== '' ||
    filtroTecnica !== 'todas' ||
    filtroEstado !== 'todas' ||
    filtroCarro !== 'todos' ||
    soloFuera;

  const limpiarFiltros = () => {
    setQ('');
    setFiltroTecnica('todas');
    setFiltroEstado('todas');
    setFiltroCarro('todos');
    setSoloFuera(false);
  };

  // ============================================================
  // Acciones
  // ============================================================
  const abrirNueva = () => {
    setProbetaEditando(null);
    setCarroDestino(null);
    setModalFormOpen(true);
  };

  const abrirEditar = (p: any) => {
    setProbetaEditando(p);
    setCarroDestino(null);
    setModalFormOpen(true);
  };

  const abrirDetalle = (p: any) => {
    setProbetaDetalle(p);
    setCarroDetalle(p.carros ?? null);
    setModalDetalleOpen(true);
  };

  const handleSuccess = () => {
    setModalFormOpen(false);
    setProbetaEditando(null);
    setCarroDestino(null);
    setToast(probetaEditando ? 'Probeta actualizada' : 'Probeta creada');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const eliminar = async (p: any) => {
    if (!confirm(`¿Eliminar la probeta "${p.pn} · ${p.nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('probetas').delete().eq('id', p.id);
    if (error) {
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
      return;
    }
    setToast('Probeta eliminada');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const imprimirEtiqueta = (p: any) => {
    const win = window.open('', '_blank', 'width=500,height=400');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Etiqueta ${p.pn}</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; padding: 20px; display: flex; justify-content: center; }
        .etiqueta { border: 1px solid #ccc; border-radius: 8px; padding: 16px 24px; text-align: center; max-width: 320px; }
        .pn { font-family: monospace; font-size: 20px; font-weight: bold; color: #0085AD; margin-bottom: 4px; }
        .nombre { font-size: 13px; color: #333; margin-bottom: 2px; }
        .sn { font-family: monospace; font-size: 10px; color: #666; margin-bottom: 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="etiqueta">
        <div class="pn">${p.pn}</div>
        <div class="nombre">${p.nombre}</div>
        <div class="sn">${p.numero_serie ? 'S/N ' + p.numero_serie : ''}</div>
        <div id="barcode"></div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <script>
        JsBarcode("#barcode", "${p.codigo_barras}", {
          format: "CODE128", displayValue: false, height: 60, width: 2, margin: 0
        });
        setTimeout(() => window.print(), 300);
      </script></body></html>
    `);
    win.document.close();
  };

  const getNtms = (p: any): string[] => {
    if (!p?.normas_ntm) return [];
    return String(p.normas_ntm)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="p-6 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Probetas de Calibración</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} de {probetas.length} probetas
            {probetasFuera.length > 0 && (
              <span className="ml-2 text-airbus-orange font-semibold">
                · {probetasFuera.length} fuera del almacén
              </span>
            )}
          </p>
        </div>
        <button
          onClick={abrirNueva}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva probeta
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

      {/* Aviso de probetas fuera */}
      {probetasFuera.length > 0 && (
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
                      onClick={() => abrirDetalle(p)}
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
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/25 hover:bg-white/35 rounded-full text-xs text-white font-semibold transition"
                  >
                    +{probetasFuera.length - 3} más →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card space-y-4">
        {/* Buscador */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por P/N, nombre, código de barras, serie, material, NTM..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="btn-ghost border border-gray-300 flex items-center gap-2 whitespace-nowrap"
              title="Limpiar todos los filtros"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>

        {/* Filtro rápido "fuera del almacén" */}
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

        {/* TÉCNICA */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Filter className="w-3 h-3" />
            Técnica NDT
          </label>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={filtroTecnica === 'todas'}
              onClick={() => setFiltroTecnica('todas')}
              count={probetas.length}
            >
              Todas
            </FilterChip>
            {tecnicas.map((t) => (
              <FilterChip
                key={t.id}
                active={filtroTecnica === t.codigo}
                onClick={() => setFiltroTecnica(t.codigo)}
                count={contadores.porTecnica[t.codigo] ?? 0}
                color="blue"
              >
                {t.codigo}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* ESTADO */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Filter className="w-3 h-3" />
            Estado
          </label>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={filtroEstado === 'todas'}
              onClick={() => setFiltroEstado('todas')}
              count={probetas.length}
            >
              Todos
            </FilterChip>
            <FilterChip
              active={filtroEstado === 'disponible'}
              onClick={() => setFiltroEstado('disponible')}
              count={contadores.porEstado.disponible}
              color="green"
            >
              Disponible
            </FilterChip>
            <FilterChip
              active={filtroEstado === 'prestado'}
              onClick={() => setFiltroEstado('prestado')}
              count={contadores.porEstado.prestado}
              color="orange"
            >
              Prestado
            </FilterChip>
            <FilterChip
              active={filtroEstado === 'mantenimiento'}
              onClick={() => setFiltroEstado('mantenimiento')}
              count={contadores.porEstado.mantenimiento}
            >
              En mantenimiento
            </FilterChip>
            <FilterChip
              active={filtroEstado === 'baja'}
              onClick={() => setFiltroEstado('baja')}
              count={contadores.porEstado.baja}
              color="red"
            >
              Baja
            </FilterChip>
          </div>
        </div>

        {/* CARRO */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Box className="w-3 h-3" />
            Carro
          </label>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={filtroCarro === 'todos'}
              onClick={() => setFiltroCarro('todos')}
              count={probetas.length}
            >
              Todos
            </FilterChip>
            <FilterChip
              active={filtroCarro === 'sin_carro'}
              onClick={() => setFiltroCarro('sin_carro')}
              count={contadores.porCarro.sin_carro ?? 0}
              color="orange"
            >
              Sin carro asignado
            </FilterChip>
            {carros.map((c) => (
              <FilterChip
                key={c.id}
                active={filtroCarro === c.id}
                onClick={() => setFiltroCarro(c.id)}
                count={contadores.porCarro[c.id] ?? 0}
                color="blue"
              >
                {c.codigo}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando probetas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Hash className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">
              {probetas.length === 0
                ? 'Aún no hay probetas registradas'
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
              <button onClick={abrirNueva} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Crear la primera probeta
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">P/N</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Técnica</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">NTM</th>
                  <th className="px-4 py-3">Código de barras</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => {
                  const fueraInfo = fueraMap.get(p.id);
                  const estaFuera = !!fueraInfo;
                  const destinoConf = fueraInfo?.prestamo.destino_tipo
                    ? tipoDestinoConfig[fueraInfo.prestamo.destino_tipo]
                    : null;
                  const DestIcon = destinoConf?.icon ?? Truck;
                  const ntms = getNtms(p);

                  const estadoBadgeClass =
                    p.estado === 'disponible' ? 'badge badge-green' :
                    p.estado === 'prestado' ? 'badge badge-blue' :
                    p.estado === 'mantenimiento' ? 'badge badge-yellow' :
                    p.estado === 'baja' ? 'badge badge-red' :
                    'badge badge-gray';

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-gray-50 transition cursor-pointer ${
                        estaFuera ? 'bg-airbus-orange/5' : ''
                      }`}
                      onClick={() => abrirDetalle(p)}
                    >
                      {/* P/N + foto */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.foto_url ? (
                            <div className="w-12 h-12 rounded-lg border border-gray-200 shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                              <img
                                src={p.foto_url}
                                alt={p.nombre}
                                className="w-full h-full object-contain"
                                onError={(ev) => {
                                  (ev.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-airbus-sky/10 border border-airbus-sky/20 rounded-lg flex items-center justify-center shrink-0">
                              <Hash className="w-5 h-5 text-airbus-sky" />
                            </div>
                          )}
                          <span className="font-mono font-bold text-airbus-blue text-sm">
                            {p.pn}
                          </span>
                        </div>
                      </td>

                      {/* Nombre + material */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{p.nombre}</p>
                        <p className="text-xs text-gray-500">
                          {p.material ?? ''}
                          {p.material && p.dimensiones ? ' · ' : ''}
                          {p.dimensiones ?? ''}
                        </p>
                      </td>

                      {/* Técnica */}
                      <td className="px-4 py-3">
                        {p.tecnicas_ndt?.codigo ? (
                          <span className="badge badge-blue">
                            {p.tecnicas_ndt.codigo}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>

                      {/* Ubicación */}
                      <td className="px-4 py-3">
                        {p.carros?.codigo ? (
                          <div className="text-xs text-gray-600">
                            <p className="font-mono font-semibold text-airbus-blue">
                              {p.carros.codigo}
                            </p>
                            {p.num_bandeja && (
                              <p className="flex items-center gap-1 text-gray-500 mt-0.5">
                                <Layers className="w-3 h-3" />
                                B{p.num_bandeja}
                                {p.num_posicion ? ` · P${p.num_posicion}` : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Sin carro
                          </span>
                        )}
                      </td>

                      {/* NTM */}
                      <td className="px-4 py-3">
                        {ntms.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">—</span>
                        ) : ntms.length <= 2 ? (
                          <div className="flex flex-wrap gap-1">
                            {ntms.map((n) => (
                              <span
                                key={n}
                                className="inline-flex items-center px-1.5 py-0.5 bg-airbus-sky/10 text-airbus-sky border border-airbus-sky/30 rounded text-[9px] font-mono font-bold"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-airbus-sky/10 text-airbus-sky border border-airbus-sky/30 rounded text-[9px] font-mono font-bold">
                              {ntms[0]}
                            </span>
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 bg-airbus-sky/15 text-airbus-sky rounded text-[9px] font-bold cursor-help"
                              title={ntms.join('\n')}
                            >
                              +{ntms.length - 1}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Código de barras */}
                      <td className="px-4 py-3">
                        {p.codigo_barras ? (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setBarcodeAbierto(p.codigo_barras);
                            }}
                            className="hover:bg-airbus-sky/10 rounded p-1 -m-1 transition"
                            title="Clic para ampliar"
                          >
                            <BarcodeLib
                              value={p.codigo_barras}
                              format="CODE128"
                              displayValue={false}
                              height={30}
                              width={1.2}
                              margin={0}
                              background="transparent"
                              lineColor="#0085AD"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={estadoBadgeClass}>
                            {p.estado ?? 'disponible'}
                          </span>

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
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => abrirDetalle(p)}
                            className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => imprimirEtiqueta(p)}
                            className="p-1.5 text-gray-400 hover:text-airbus-blue hover:bg-airbus-light/10 rounded transition"
                            title="Imprimir etiqueta"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => abrirEditar(p)}
                            className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => eliminar(p)}
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

      {/* Modal barcode */}
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
                lineColor="#0085AD"
              />
            </div>
            <p className="font-mono text-xs text-gray-500">{barcodeAbierto}</p>
          </div>
        )}
      </Modal>

      {/* Modal Form */}
      <Modal
        open={modalFormOpen}
        onClose={() => { setModalFormOpen(false); setProbetaEditando(null); setCarroDestino(null); }}
        title={probetaEditando ? `Editar probeta ${probetaEditando.pn}` : 'Nueva probeta'}
        size="lg"
      >
        <ProbetaForm
          probeta={probetaEditando}
          carroId={carroDestino ?? undefined}
          onSuccess={handleSuccess}
          onCancel={() => { setModalFormOpen(false); setProbetaEditando(null); setCarroDestino(null); }}
        />
      </Modal>

      {/* Modal Detalle */}
      <Modal
        open={modalDetalleOpen}
        onClose={() => { setModalDetalleOpen(false); setProbetaDetalle(null); setCarroDetalle(null); }}
        title={probetaDetalle ? `Probeta ${probetaDetalle.pn}` : 'Detalle'}
        size="lg"
      >
        {probetaDetalle && (
          <ProbetaDetalle
            probeta={probetaDetalle}
            carro={carroDetalle}
            onClose={() => { setModalDetalleOpen(false); setProbetaDetalle(null); setCarroDetalle(null); }}
            probetasEnBandeja={
              probetaDetalle.carro_id && probetaDetalle.num_bandeja
                ? probetas.filter(
                    (p) =>
                      p.carro_id === probetaDetalle.carro_id &&
                      p.num_bandeja === probetaDetalle.num_bandeja
                  )
                : []
            }
          />
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// FilterChip
// ============================================================
function FilterChip({
  active, onClick, children, count, color = 'default',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
  color?: 'default' | 'blue' | 'green' | 'orange' | 'red';
}) {
  const activeColor: Record<string, string> = {
    default: 'bg-airbus-blue text-white border-airbus-blue',
    blue:    'bg-airbus-sky text-white border-airbus-sky',
    green:   'bg-airbus-green text-white border-airbus-green',
    orange:  'bg-airbus-orange text-white border-airbus-orange',
    red:     'bg-airbus-red text-white border-airbus-red',
  };
  const countColor = active
    ? 'bg-white/20 text-white'
    : 'bg-gray-200 text-gray-500';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        active
          ? activeColor[color]
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <span>{children}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${countColor}`}>
        {count}
      </span>
    </button>
  );
}