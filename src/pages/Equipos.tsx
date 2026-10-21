import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Plus, Package, RefreshCw, Printer, X, Filter,
  AlertTriangle, Calendar, CheckCircle2, AlertCircle, Bell, Wrench,
  Truck, Building2, Warehouse, Users, ScanBarcode,
  Boxes, ChevronDown, ChevronRight, Edit3, Trash2, Layers, ImageIcon,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { EquipoForm } from '../components/equipos/EquipoForm';
import { KitForm } from '../components/kits/KitForm';
import { BarcodeScanner } from '../components/BarcodeScanner';
import Barcode from 'react-barcode';
import {
  estadoCalibracion,
  estadoEfectivoEquipo,
  estadoEfectivoLabel,
  tieneCalibracionProxima,
  type EstadoEfectivo,
} from '../lib/calibracion';
import { usePrestamosExternos } from '../hooks/usePrestamosExternos';

const estadoBadge: Record<EstadoEfectivo, string> = {
  disponible:            'badge badge-green',
  prestado:              'badge badge-blue',
  calibracion:           'badge badge-yellow',
  pendiente_calibracion: 'badge badge-red',
  mantenimiento:         'badge badge-yellow',
  baja:                  'badge badge-gray',
  salida:                'badge badge-gray',
};

const estadosFiltro: { value: EstadoEfectivo; label: string }[] = [
  { value: 'disponible',            label: 'Disponible' },
  { value: 'prestado',              label: 'Prestado' },
  { value: 'calibracion',           label: 'En calibración' },
  { value: 'pendiente_calibracion', label: 'Pendiente de Calibración' },
  { value: 'mantenimiento',         label: 'En mantenimiento' },
  { value: 'salida',                label: 'Fuera del almacén' },
  { value: 'baja',                  label: 'Baja' },
];

type FiltroCalibracion = 'todas' | 'vencida' | 'proxima' | 'ok' | 'sin_fecha';

const tipoDestinoConfig: Record<string, { label: string; icon: any }> = {
  almacen: { label: 'Almacén', icon: Warehouse },
  seccion: { label: 'Sección', icon: Building2 },
  compania: { label: 'Compañía', icon: Truck },
  cliente: { label: 'Cliente', icon: Users },
  otro: { label: 'Otro', icon: Building2 },
};

export function Equipos() {
  const [tab, setTab] = useState<'equipos' | 'kits'>('equipos');

  const [equipos, setEquipos] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filtroTecnica, setFiltroTecnica] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroCalibracion, setFiltroCalibracion] = useState<FiltroCalibracion>('todas');
  const [soloFuera, setSoloFuera] = useState(false);

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [barcodeAbierto, setBarcodeAbierto] = useState<string | null>(null);
  const [avisoVencidasCerrado, setAvisoVencidasCerrado] = useState(false);
  const [avisoProximasCerrado, setAvisoProximasCerrado] = useState(false);
  const [avisoFueraCerrado, setAvisoFueraCerrado] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [ultimoEscaneo, setUltimoEscaneo] = useState<string | null>(null);

  const { fueraMap } = usePrestamosExternos();

  const load = useCallback(async () => {
    setLoading(true);
    const [eq, tec] = await Promise.all([
      supabase
        .from('equipos')
        .select('*, tecnicas_ndt(codigo, nombre)')
        .order('id_equipo', { ascending: true }),
      supabase
        .from('tecnicas_ndt')
        .select('id, codigo, nombre')
        .eq('activa', true)
        .order('codigo'),
    ]);
    if (eq.error) console.error(eq.error);
    setEquipos(eq.data ?? []);
    setTecnicas(tec.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const equiposFuera = useMemo(
    () => equipos.filter((e) => fueraMap.has(e.id)),
    [equipos, fueraMap]
  );

  const equiposVencidos = useMemo(
    () => equipos.filter((e) => estadoEfectivoEquipo(e) === 'pendiente_calibracion'),
    [equipos]
  );

  const equiposProximos = useMemo(
    () => equipos.filter((e) => tieneCalibracionProxima(e)),
    [equipos]
  );

  const equiposEnCalibracion = useMemo(
    () => equipos.filter((e) => estadoEfectivoEquipo(e) === 'calibracion'),
    [equipos]
  );

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return equipos.filter((e) => {
      const efectivo = estadoEfectivoEquipo(e);

      if (efectivo === 'salida' && filtroEstado !== 'salida') {
        return false;
      }

      if (soloFuera && !fueraMap.has(e.id)) return false;

      const coincideBusqueda =
        qLower === '' ||
        [e.nombre, e.codigo_barras, e.numero_serie, e.marca, e.modelo, e.id_equipo]
          .join(' ')
          .toLowerCase()
          .includes(qLower);
      if (!coincideBusqueda) return false;

      if (filtroTecnica !== 'todas' && e.tecnicas_ndt?.codigo !== filtroTecnica) return false;

      if (filtroEstado !== 'todos') {
        if (efectivo !== filtroEstado) return false;
      }

      if (filtroCalibracion !== 'todas') {
        if (estadoCalibracion(e.proxima_calibracion) !== filtroCalibracion) return false;
      }

      return true;
    });
  }, [equipos, q, filtroTecnica, filtroEstado, filtroCalibracion, soloFuera, fueraMap]);

  const contadores = useMemo(() => {
    const porTecnica: Record<string, number> = {};
    const porEstado: Record<string, number> = {};
    const porCalibracion: Record<string, number> = {
      vencida: 0, proxima: 0, ok: 0, sin_fecha: 0,
    };

    equipos.forEach((e) => {
      const t = e.tecnicas_ndt?.codigo ?? 'sin';
      porTecnica[t] = (porTecnica[t] ?? 0) + 1;

      const ef = estadoEfectivoEquipo(e);
      porEstado[ef] = (porEstado[ef] ?? 0) + 1;

      porCalibracion[estadoCalibracion(e.proxima_calibracion)]++;
    });

    return { porTecnica, porEstado, porCalibracion };
  }, [equipos]);

  const hayFiltrosActivos =
    filtroTecnica !== 'todas' ||
    filtroEstado !== 'todos' ||
    filtroCalibracion !== 'todas' ||
    q !== '' ||
    soloFuera;

  const limpiarFiltros = () => {
    setFiltroTecnica('todas');
    setFiltroEstado('todos');
    setFiltroCalibracion('todas');
    setQ('');
    setSoloFuera(false);
    setUltimoEscaneo(null);
  };

  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setModalOpen(true); };

  const handleSuccess = () => {
    setModalOpen(false);
    setToast(editingId ? 'Equipo actualizado correctamente' : 'Equipo creado correctamente');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const handleScan = (code: string) => {
    const limpio = code.trim();
    setQ(limpio);
    setUltimoEscaneo(limpio);
    setScannerOpen(false);

    const match = equipos.find(
      (e) =>
        e.codigo_barras?.toLowerCase() === limpio.toLowerCase() ||
        e.id_equipo?.toLowerCase() === limpio.toLowerCase()
    );
    if (match) {
      setTimeout(() => openEdit(match.id), 150);
    }
  };

  const imprimirEtiqueta = (equipo: any) => {
    const win = window.open('', '_blank', 'width=500,height=500');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Etiqueta ${equipo.id_equipo}</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; padding: 20px; display: flex; justify-content: center; }
        .etiqueta { border: 1px solid #ccc; border-radius: 8px; padding: 16px 24px; text-align: center; max-width: 320px; display: flex; flex-direction: column; align-items: center; }
        .id { font-family: monospace; font-size: 20px; font-weight: bold; color: #00205B; margin-bottom: 4px; }
        .nombre { font-size: 13px; color: #333; margin-bottom: 2px; }
        .tecnica { font-size: 11px; color: #666; margin-bottom: 8px; }
        .codes { display: flex; flex-direction: column; gap: 8px; align-items: center; width: 100%; border-top: 1px dashed #ddd; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="etiqueta">
        <div class="id">${equipo.id_equipo ?? '—'}</div>
        <div class="nombre">${equipo.nombre}</div>
        <div class="tecnica">${equipo.tecnicas_ndt?.codigo ?? ''}</div>
        <div class="codes">
          <div id="barcode"></div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(equipo.codigo_barras)}" alt="QR" />
        </div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <script>
        JsBarcode("#barcode", "${equipo.codigo_barras}", {
          format: "CODE128", displayValue: false, height: 50, width: 2, margin: 0
        });
        setTimeout(() => window.print(), 500);
      </script></body></html>
    `);
    win.document.close();
  };

  return (
    <div className="p-6 space-y-4">
      {/* TABS */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('equipos')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
            tab === 'equipos'
              ? 'bg-white text-airbus-blue shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Equipos
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              tab === 'equipos'
                ? 'bg-airbus-blue/10 text-airbus-blue'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {equipos.length}
          </span>
        </button>
        <button
          onClick={() => setTab('kits')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
            tab === 'kits'
              ? 'bg-white text-airbus-blue shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          Kits
        </button>
      </div>

      {/* TAB: EQUIPOS */}
      {tab === 'equipos' && (
        <>
          {/* BANNER: FUERA DEL ALMACÉN */}
          {!avisoFueraCerrado && equiposFuera.length > 0 && (
            <div className="bg-gradient-to-r from-airbus-orange to-airbus-red rounded-xl shadow-lg overflow-hidden animate-in">
              <div className="flex items-start gap-4 p-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Truck className="w-6 h-6 text-white animate-pulse" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-bold text-base">
                      {equiposFuera.length} equipo{equiposFuera.length !== 1 ? 's' : ''} fuera del almacén
                    </h3>
                    <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                      PRÉSTAMO EXTERNO
                    </span>
                  </div>

                  <p className="text-white/90 text-sm mt-1">
                    Estos equipos están prestados a terceros y no están disponibles para uso interno.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {equiposFuera.slice(0, 3).map((e) => {
                      const info = fueraMap.get(e.id);
                      const destinoConf = info?.prestamo.destino_tipo
                        ? tipoDestinoConfig[info.prestamo.destino_tipo]
                        : null;
                      const DestIcon = destinoConf?.icon ?? Building2;
                      return (
                        <button
                          key={e.id}
                          onClick={() => openEdit(e.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full text-xs text-white transition"
                          title={`${destinoConf?.label}: ${info?.prestamo.destino_nombre}`}
                        >
                          <DestIcon className="w-3 h-3" />
                          <span className="font-mono font-bold">{e.id_equipo}</span>
                          <span className="opacity-80 truncate max-w-[140px]">
                            {info?.prestamo.destino_nombre}
                          </span>
                        </button>
                      );
                    })}
                    {equiposFuera.length > 3 && (
                      <button
                        onClick={() => {
                          setSoloFuera(true);
                          setAvisoFueraCerrado(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/25 hover:bg-white/35 rounded-full text-xs text-white font-semibold transition"
                      >
                        +{equiposFuera.length - 3} más →
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

          {/* BANNER ROJO: calibración vencida */}
          {!avisoVencidasCerrado && equiposVencidos.length > 0 && (
            <div className="bg-gradient-to-r from-airbus-red to-airbus-orange rounded-xl shadow-lg overflow-hidden animate-in">
              <div className="flex items-start gap-4 p-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Bell className="w-6 h-6 text-white animate-pulse" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-bold text-base">
                      {equiposVencidos.length} equipo{equiposVencidos.length !== 1 ? 's' : ''} con calibración vencida
                    </h3>
                    <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                      ACCIÓN REQUERIDA
                    </span>
                  </div>

                  <p className="text-white/90 text-sm mt-1">
                    Los equipos con calibración vencida no deben usarse para inspecciones hasta
                    que se recalibren y <strong>no pueden prestarse</strong>.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {equiposVencidos.slice(0, 3).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => openEdit(e.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full text-xs text-white transition"
                      >
                        <span className="font-mono font-bold">{e.id_equipo}</span>
                        <span className="opacity-80 truncate max-w-[140px]">{e.nombre}</span>
                      </button>
                    ))}
                    {equiposVencidos.length > 3 && (
                      <button
                        onClick={() => {
                          setFiltroEstado('pendiente_calibracion');
                          setAvisoVencidasCerrado(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/25 hover:bg-white/35 rounded-full text-xs text-white font-semibold transition"
                      >
                        +{equiposVencidos.length - 3} más →
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setAvisoVencidasCerrado(true)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition shrink-0"
                  title="Cerrar aviso"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* BANNER NARANJA: calibración próxima */}
          {!avisoProximasCerrado && equiposProximos.length > 0 && (
            <div className="bg-airbus-orange/10 border border-airbus-orange/30 rounded-xl p-4 flex items-start gap-3 animate-in">
              <div className="w-10 h-10 bg-airbus-orange/20 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-airbus-orange" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-airbus-orange">
                  {equiposProximos.length} equipo{equiposProximos.length !== 1 ? 's' : ''} con calibración próxima a vencer
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Vencen en menos de 30 días. Programa su recalibración para evitar bloqueos.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {equiposProximos.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => openEdit(e.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-airbus-orange/15 hover:bg-airbus-orange/25 rounded-full text-xs text-airbus-orange transition"
                    >
                      <span className="font-mono font-bold">{e.id_equipo}</span>
                      <span className="opacity-80 truncate max-w-[140px]">
                        {e.proxima_calibracion}
                      </span>
                    </button>
                  ))}
                  {equiposProximos.length > 3 && (
                    <button
                      onClick={() => {
                        setFiltroCalibracion('proxima');
                        setAvisoProximasCerrado(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-airbus-orange text-white rounded-full text-xs font-semibold transition"
                    >
                      +{equiposProximos.length - 3} más →
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setAvisoProximasCerrado(true)}
                className="p-1 rounded hover:bg-airbus-orange/20 transition shrink-0"
              >
                <X className="w-4 h-4 text-airbus-orange" />
              </button>
            </div>
          )}

          {/* CABECERA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-airbus-blue">Equipos NDT</h1>
              <p className="text-sm text-gray-500">
                {filtered.length} de {equipos.length} equipos
                {equiposFuera.length > 0 && (
                  <span className="ml-2 text-airbus-orange font-semibold">
                    · {equiposFuera.length} fuera del almacén
                  </span>
                )}
                {equiposEnCalibracion.length > 0 && (
                  <span className="ml-2 text-airbus-sky">
                    · {equiposEnCalibracion.length} en calibración
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={openNew}
              className="btn-primary flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Nuevo equipo
            </button>
          </div>

          {toast && (
            <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
              {toast}
            </div>
          )}

          {/* FILTROS */}
          <div className="card space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-10 pr-10"
                  placeholder="Buscar por ID, nombre, código, serie, marca..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-airbus-sky hover:text-airbus-blue hover:bg-airbus-sky/10 rounded transition"
                    title="Escanear código de barras"
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </button>
                )}
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

            {ultimoEscaneo && (
              <div className="flex items-center gap-2 text-xs bg-airbus-sky/10 border border-airbus-sky/30 text-airbus-blue px-3 py-1.5 rounded-lg">
                <ScanBarcode className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Código escaneado:{' '}
                  <span className="font-mono font-bold">{ultimoEscaneo}</span>
                </span>
                <button
                  onClick={() => { setUltimoEscaneo(null); setQ(''); }}
                  className="ml-auto text-airbus-sky hover:text-airbus-blue"
                  title="Quitar"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {equiposFuera.length > 0 && (
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
                  Solo equipos fuera del almacén
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      soloFuera
                        ? 'bg-white/20 text-white'
                        : 'bg-airbus-orange/15 text-airbus-orange'
                    }`}
                  >
                    {equiposFuera.length}
                  </span>
                </button>
              </div>
            )}

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <Filter className="w-3 h-3" />
                Técnica NDT
              </label>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={filtroTecnica === 'todas'}
                  onClick={() => setFiltroTecnica('todas')}
                  count={equipos.length}
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

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <Filter className="w-3 h-3" />
                Estado
              </label>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={filtroEstado === 'todos'}
                  onClick={() => setFiltroEstado('todos')}
                  count={equipos.length}
                >
                  Todos
                </FilterChip>
                {estadosFiltro.map((e) => {
                  const count = contadores.porEstado[e.value] ?? 0;
                  const esPendiente = e.value === 'pendiente_calibracion';
                  const enCalibracion = e.value === 'calibracion';
                  const esSalida = e.value === 'salida';

                  return (
                    <FilterChip
                      key={e.value}
                      active={filtroEstado === e.value}
                      onClick={() => setFiltroEstado(e.value)}
                      count={count}
                      color={
                        e.value === 'disponible'
                          ? 'green'
                          : e.value === 'baja' || esPendiente
                            ? 'red'
                            : enCalibracion || esSalida
                              ? 'orange'
                              : 'default'
                      }
                      icon={
                        esPendiente && count > 0 ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : enCalibracion ? (
                          <Wrench className="w-3 h-3" />
                        ) : esSalida ? (
                          <Truck className="w-3 h-3" />
                        ) : undefined
                      }
                    >
                      {e.label}
                    </FilterChip>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <Filter className="w-3 h-3" />
                Estado de calibración
              </label>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={filtroCalibracion === 'todas'}
                  onClick={() => setFiltroCalibracion('todas')}
                  count={equipos.length}
                >
                  Todas
                </FilterChip>
                <FilterChip
                  active={filtroCalibracion === 'vencida'}
                  onClick={() => setFiltroCalibracion('vencida')}
                  count={contadores.porCalibracion.vencida}
                  color="red"
                  icon={<AlertCircle className="w-3 h-3" />}
                >
                  Vencida
                </FilterChip>
                <FilterChip
                  active={filtroCalibracion === 'proxima'}
                  onClick={() => setFiltroCalibracion('proxima')}
                  count={contadores.porCalibracion.proxima}
                  color="orange"
                  icon={<AlertTriangle className="w-3 h-3" />}
                >
                  Próxima &lt; 30 días
                </FilterChip>
                <FilterChip
                  active={filtroCalibracion === 'ok'}
                  onClick={() => setFiltroCalibracion('ok')}
                  count={contadores.porCalibracion.ok}
                  color="green"
                  icon={<CheckCircle2 className="w-3 h-3" />}
                >
                  Al día
                </FilterChip>
                <FilterChip
                  active={filtroCalibracion === 'sin_fecha'}
                  onClick={() => setFiltroCalibracion('sin_fecha')}
                  count={contadores.porCalibracion.sin_fecha}
                  icon={<Calendar className="w-3 h-3" />}
                >
                  Sin fecha
                </FilterChip>
              </div>
            </div>
          </div>

          {/* TABLA */}
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cargando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 mb-4">
                  {equipos.length === 0
                    ? 'Aún no hay equipos registrados'
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
                  <button onClick={openNew} className="btn-primary inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Crear el primer equipo
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Códigos</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Técnica</th>
                      <th className="px-4 py-3">Ubicación</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Próx. calibración</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((e) => {
                      const cal = estadoCalibracion(e.proxima_calibracion);
                      const efectivo = estadoEfectivoEquipo(e);
                      const esPendiente = efectivo === 'pendiente_calibracion';
                      const enCalib = efectivo === 'calibracion';
                      const esProxima = cal === 'proxima';
                      const fueraInfo = fueraMap.get(e.id);
                      const estaFuera = !!fueraInfo;
                      const destinoConf = fueraInfo?.prestamo.destino_tipo
                        ? tipoDestinoConfig[fueraInfo.prestamo.destino_tipo]
                        : null;
                      const DestIcon = destinoConf?.icon ?? Truck;

                      return (
                        <tr
                          key={e.id}
                          className={`hover:bg-gray-50 transition cursor-pointer ${
                            estaFuera ? 'bg-airbus-orange/5' :
                            esPendiente ? 'bg-airbus-red/5' :
                            enCalib ? 'bg-airbus-yellow/5' :
                            esProxima ? 'bg-airbus-orange/5' : ''
                          }`}
                          onClick={() => openEdit(e.id)}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-airbus-blue">
                            {e.id_equipo ?? '—'}
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setBarcodeAbierto(e.codigo_barras);
                              }}
                              className="hover:bg-airbus-light/10 rounded p-1 -m-1 transition flex flex-col items-center gap-1"
                              title="Clic para ampliar"
                            >
                              <Barcode
                                value={e.codigo_barras}
                                format="CODE128"
                                displayValue={false}
                                height={25}
                                width={1}
                                margin={0}
                                background="transparent"
                                lineColor="#00205B"
                              />
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=40x40&data=${encodeURIComponent(e.codigo_barras)}`}
                                alt="QR"
                                className="w-10 h-10 rounded-sm"
                              />
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {e.foto_url ? (
                                <img
                                  src={e.foto_url}
                                  alt={e.nombre}
                                  className="w-10 h-10 rounded-lg object-contain border border-gray-200 shrink-0 bg-gray-50"
                                  onError={(ev) => {
                                    (ev.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-airbus-blue/10 flex items-center justify-center shrink-0">
                                  <Package className="w-4 h-4 text-airbus-blue/50" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-gray-800 truncate">{e.nombre}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {e.marca} {e.modelo}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="badge badge-blue">
                              {e.tecnicas_ndt?.codigo ?? '—'}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-gray-600">{e.ubicacion ?? '—'}</td>

                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={estadoBadge[efectivo] ?? 'badge badge-gray'}>
                                <span className="inline-flex items-center gap-1">
                                  {esPendiente && <AlertTriangle className="w-3 h-3" />}
                                  {enCalib && <Wrench className="w-3 h-3" />}
                                  {efectivo === 'salida' && <Truck className="w-3 h-3" />}
                                  {estadoEfectivoLabel(efectivo)}
                                </span>
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

                              {esProxima && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-airbus-orange/15 text-airbus-orange border border-airbus-orange/30">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Calibración próxima
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {cal === 'vencida' && (
                              <span className="text-airbus-red font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {e.proxima_calibracion}
                              </span>
                            )}
                            {cal === 'proxima' && (
                              <span className="text-airbus-orange font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {e.proxima_calibracion}
                              </span>
                            )}
                            {cal === 'ok' && (
                              <span className="text-airbus-green flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {e.proxima_calibracion}
                              </span>
                            )}
                            {cal === 'sin_fecha' && (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  imprimirEtiqueta(e);
                                }}
                                className="p-1.5 text-gray-400 hover:text-airbus-blue hover:bg-airbus-light/10 rounded transition"
                                title="Imprimir etiqueta"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  openEdit(e.id);
                                }}
                                className="text-xs text-airbus-sky hover:text-airbus-blue font-medium"
                              >
                                Editar
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
        </>
      )}

      {/* TAB: KITS */}
      {tab === 'kits' && <KitsTab onCambio={load} />}

      {/* Modal barcode */}
      <Modal
        open={!!barcodeAbierto}
        onClose={() => setBarcodeAbierto(null)}
        title="Códigos de identificación"
        size="sm"
      >
        {barcodeAbierto && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 w-full flex justify-center">
              <Barcode
                value={barcodeAbierto}
                format="CODE128"
                displayValue={true}
                height={60}
                width={2}
                margin={0}
                lineColor="#00205B"
              />
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(barcodeAbierto)}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal crear/editar equipo */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar equipo' : 'Nuevo equipo'}
        size="lg"
      >
        <EquipoForm
          equipoId={editingId ?? undefined}
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Modal Escáner */}
      <Modal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Escanear código de barras"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Apunta la cámara al código de barras del equipo. El código se usará como término de búsqueda y, si coincide con un equipo, se abrirá automáticamente.
          </p>
          <BarcodeScanner onScan={handleScan} />
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// FilterChip (equipos)
// ============================================================
function FilterChip({
  active, onClick, children, count, color = 'default', icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
  color?: 'default' | 'blue' | 'green' | 'orange' | 'red';
  icon?: React.ReactNode;
}) {
  const activeColor = {
    default: 'bg-airbus-blue text-white border-airbus-blue',
    blue:    'bg-airbus-sky text-white border-airbus-sky',
    green:   'bg-airbus-green text-white border-airbus-green',
    orange:  'bg-airbus-orange text-white border-airbus-orange',
    red:     'bg-airbus-red text-white border-airbus-red',
  }[color];

  const countColor = active
    ? 'bg-white/20 text-white'
    : 'bg-gray-200 text-gray-500';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        active
          ? activeColor
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${countColor}`}>
        {count}
      </span>
    </button>
  );
}

// ============================================================
// Kits tab
// ============================================================
function KitsTab({ onCambio }: { onCambio: () => void }) {
  const [kits, setKits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [kitEditando, setKitEditando] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kits')
      .select(`
        *,
        kit_equipos (
          cantidad, notas,
          equipos (id, id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo))
        )
      `)
      .order('codigo');
    if (error) console.error('[Kits] Error:', error);
    setKits(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const abrirNuevo = () => { setKitEditando(null); setModalOpen(true); };
  const abrirEditar = (k: any) => { setKitEditando(k); setModalOpen(true); };

  const handleSuccess = () => {
    setModalOpen(false);
    setKitEditando(null);
    setToast(kitEditando ? 'Kit actualizado' : 'Kit creado');
    setTimeout(() => setToast(null), 3000);
    load();
    onCambio?.();
  };

  const eliminar = async (k: any) => {
    if (!confirm(`¿Eliminar el kit "${k.nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('kits').delete().eq('id', k.id);
    if (error) {
      setToast(error.message);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setToast('Kit eliminado');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return kits;
    return kits.filter((k) => {
      const equipoTexto = (k.kit_equipos ?? [])
        .map((ke: any) => `${ke.equipos?.id_equipo ?? ''} ${ke.equipos?.nombre ?? ''}`)
        .join(' ');
      return [k.codigo, k.nombre, k.descripcion, k.ubicacion, equipoTexto]
        .filter(Boolean).join(' ').toLowerCase().includes(ql);
    });
  }, [kits, q]);

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-airbus-blue">Kits de equipos</h2>
          <p className="text-xs text-gray-500">
            {filtered.length} de {kits.length} kits · agrupaciones de equipos que se usan juntos
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo kit
        </button>
      </div>

      {/* Buscador */}
      <div className="card">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Buscar kit por código, nombre, ubicación o equipo contenido..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando kits...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Boxes className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 mb-4">
            {kits.length === 0 ? 'Aún no hay kits registrados' : 'Sin resultados'}
          </p>
          {kits.length === 0 && (
            <button onClick={abrirNuevo} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((k) => {
            const lineas: any[] = k.kit_equipos ?? [];
            const numEquipos = lineas.length;
            const totalUnidades = lineas.reduce((acc, l) => acc + (l.cantidad ?? 1), 0);
            const expandido = expandidos.has(k.id);

            return (
              <div key={k.id} className="card p-0 overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggle(k.id)}
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {expandido ? (
                      <ChevronDown className="w-5 h-5 text-airbus-sky" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* FOTO (clicable → abre en grande) o icono por defecto */}
                  {k.foto_url ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFotoAbierta(k.foto_url); }}
                      className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden shrink-0 bg-gray-50 hover:border-airbus-sky hover:shadow-md transition relative group/foto"
                      title="Ver foto en grande"
                    >
                      <img
                        src={k.foto_url}
                        alt={k.nombre}
                        className="w-full h-full object-contain"
                        onError={(ev) => {
                          (ev.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/foto:bg-black/20 transition flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover/foto:opacity-100 transition drop-shadow-lg" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl flex items-center justify-center shrink-0">
                      <Boxes className="w-6 h-6 text-airbus-light" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-airbus-blue text-sm">
                        {k.codigo}
                      </span>
                      <span className="font-semibold text-gray-800">{k.nombre}</span>
                      {!k.activo && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded-full uppercase">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {k.descripcion && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{k.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                      {k.ubicacion && <span>📍 {k.ubicacion}</span>}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-sky/10 text-airbus-sky rounded-full font-semibold">
                        <Package className="w-3 h-3" />
                        {numEquipos} equipo{numEquipos !== 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-blue/10 text-airbus-blue rounded-full font-semibold">
                        <Layers className="w-3 h-3" />
                        {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => abrirEditar(k)}
                      className="p-2 text-airbus-sky hover:bg-airbus-sky/10 rounded-lg transition"
                      title="Editar kit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => eliminar(k)}
                      className="p-2 text-gray-400 hover:text-airbus-red hover:bg-airbus-red/10 rounded-lg transition"
                      title="Eliminar kit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {lineas.length === 0 ? (
                      <p className="p-6 text-center text-xs text-gray-400 italic">
                        Este kit no contiene equipos
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {lineas.map((l, i) => {
                          const eq = l.equipos;
                          if (!eq) return null;
                          return (
                            <div key={i} className="flex items-center gap-3 px-4 py-2.5 pl-16">
                              <div className="w-7 h-7 rounded-lg bg-airbus-blue/10 flex items-center justify-center shrink-0">
                                <Package className="w-3.5 h-3.5 text-airbus-blue" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-airbus-blue text-xs">
                                    {eq.id_equipo}
                                  </span>
                                  {eq.tecnicas_ndt?.codigo && (
                                    <span className="badge badge-blue">
                                      {eq.tecnicas_ndt.codigo}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-700 truncate">{eq.nombre}</p>
                              </div>
                              {(l.cantidad ?? 1) > 1 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-sky/15 text-airbus-sky rounded-full text-[10px] font-bold">
                                  × {l.cantidad}
                                </span>
                              )}
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
        </div>
      )}

      {/* Modal Kit */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setKitEditando(null); }}
        title={kitEditando ? `Editar kit ${kitEditando.codigo}` : 'Nuevo kit de equipos'}
        size="lg"
      >
        <KitForm
          kitId={kitEditando?.id}
          onSuccess={handleSuccess}
          onCancel={() => { setModalOpen(false); setKitEditando(null); }}
        />
      </Modal>

      {/* Modal foto ampliada */}
      <Modal
        open={!!fotoAbierta}
        onClose={() => setFotoAbierta(null)}
        title="Foto del kit"
        size="lg"
      >
        {fotoAbierta && (
          <div className="flex items-center justify-center p-2">
            <img
              src={fotoAbierta}
              alt="Foto del kit"
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}