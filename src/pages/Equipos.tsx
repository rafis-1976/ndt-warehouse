import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Plus, Package, RefreshCw, Printer, X, Filter,
  AlertTriangle, Calendar, CheckCircle2, AlertCircle, Bell,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { EquipoForm } from '../components/equipos/EquipoForm';
import Barcode from 'react-barcode';

// ============================================================
// Estados y badges
// ============================================================
const estadoBadge: Record<string, string> = {
  disponible:            'badge badge-green',
  prestado:              'badge badge-blue',
  calibracion:           'badge badge-yellow',
  mantenimiento:         'badge badge-yellow',
  baja:                  'badge badge-red',
  pendiente_calibracion: 'badge badge-red',
};

const estadosFiltro = [
  { value: 'disponible',            label: 'Disponible' },
  { value: 'prestado',              label: 'Prestado' },
  { value: 'pendiente_calibracion', label: 'Pendiente de Calibración' },
  { value: 'calibracion',           label: 'En calibración' },
  { value: 'mantenimiento',         label: 'En mantenimiento' },
  { value: 'baja',                  label: 'Baja' },
];

type FiltroCalibracion = 'todas' | 'vencida' | 'proxima' | 'ok' | 'sin_fecha';

// ============================================================
// Helpers de calibración
// ============================================================
/** Determina el estado de calibración según la fecha */
function estadoCalibracion(fecha: string | null): 'vencida' | 'proxima' | 'ok' | 'sin_fecha' {
  if (!fecha) return 'sin_fecha';
  const diff = new Date(fecha).getTime() - Date.now();
  if (diff < 0) return 'vencida';
  if (diff < 30 * 864e5) return 'proxima';
  return 'ok';
}

/**
 * Estado efectivo del equipo: si la calibración está vencida,
 * se muestra como "pendiente_calibracion" (salvo si está dado de baja).
 */
function estadoEfectivo(eq: any): string {
  if (eq.estado === 'baja') return 'baja';
  if (estadoCalibracion(eq.proxima_calibracion) === 'vencida') {
    return 'pendiente_calibracion';
  }
  return eq.estado;
}

/** Etiqueta legible para el estado */
function estadoLabel(estado: string): string {
  if (estado === 'pendiente_calibracion') return 'Pendiente de Calibración';
  return estado;
}

// ============================================================
// Componente principal
// ============================================================
export function Equipos() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filtroTecnica, setFiltroTecnica] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroCalibracion, setFiltroCalibracion] = useState<FiltroCalibracion>('todas');

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [barcodeAbierto, setBarcodeAbierto] = useState<string | null>(null);
  const [avisoCerrado, setAvisoCerrado] = useState(false);

  // ============================================================
  // Cargar datos
  // ============================================================
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

  // ============================================================
  // Alertas: equipos pendientes de calibración
  // ============================================================
  const equiposPendientesCalibracion = useMemo(
    () => equipos.filter((e) => estadoEfectivo(e) === 'pendiente_calibracion'),
    [equipos]
  );

  const equiposProximosCalibracion = useMemo(
    () =>
      equipos.filter(
        (e) => estadoCalibracion(e.proxima_calibracion) === 'proxima'
      ),
    [equipos]
  );

  // ============================================================
  // Filtrado combinado
  // ============================================================
  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return equipos.filter((e) => {
      const coincideBusqueda =
        qLower === '' ||
        [e.nombre, e.codigo_barras, e.numero_serie, e.marca, e.modelo, e.id_equipo]
          .join(' ')
          .toLowerCase()
          .includes(qLower);
      if (!coincideBusqueda) return false;

      if (filtroTecnica !== 'todas' && e.tecnicas_ndt?.codigo !== filtroTecnica) return false;

      // Estado (usando estado efectivo)
      if (filtroEstado !== 'todos') {
        const efectivo = estadoEfectivo(e);
        if (efectivo !== filtroEstado) return false;
      }

      // Calibración
      if (filtroCalibracion !== 'todas') {
        if (estadoCalibracion(e.proxima_calibracion) !== filtroCalibracion) return false;
      }

      return true;
    });
  }, [equipos, q, filtroTecnica, filtroEstado, filtroCalibracion]);

  // ============================================================
  // Contadores para los chips
  // ============================================================
  const contadores = useMemo(() => {
    const porTecnica: Record<string, number> = {};
    const porEstado: Record<string, number> = {};
    const porCalibracion: Record<string, number> = {
      vencida: 0, proxima: 0, ok: 0, sin_fecha: 0,
    };

    equipos.forEach((e) => {
      const t = e.tecnicas_ndt?.codigo ?? 'sin';
      porTecnica[t] = (porTecnica[t] ?? 0) + 1;

      const ef = estadoEfectivo(e);
      porEstado[ef] = (porEstado[ef] ?? 0) + 1;

      porCalibracion[estadoCalibracion(e.proxima_calibracion)]++;
    });

    return { porTecnica, porEstado, porCalibracion };
  }, [equipos]);

  const hayFiltrosActivos =
    filtroTecnica !== 'todas' ||
    filtroEstado !== 'todos' ||
    filtroCalibracion !== 'todas' ||
    q !== '';

  const limpiarFiltros = () => {
    setFiltroTecnica('todas');
    setFiltroEstado('todos');
    setFiltroCalibracion('todas');
    setQ('');
  };

  // ============================================================
  // Acciones
  // ============================================================
  const openNew = () => { setEditingId(null); setModalOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setModalOpen(true); };

  const handleSuccess = () => {
    setModalOpen(false);
    setToast(editingId ? 'Equipo actualizado correctamente' : 'Equipo creado correctamente');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const imprimirEtiqueta = (equipo: any) => {
    const win = window.open('', '_blank', 'width=500,height=400');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Etiqueta ${equipo.id_equipo}</title>
      <style>
        body { font-family: Helvetica, Arial, sans-serif; padding: 20px; display: flex; justify-content: center; }
        .etiqueta { border: 1px solid #ccc; border-radius: 8px; padding: 16px 24px; text-align: center; max-width: 320px; }
        .id { font-family: monospace; font-size: 20px; font-weight: bold; color: #00205B; margin-bottom: 4px; }
        .nombre { font-size: 13px; color: #333; margin-bottom: 2px; }
        .tecnica { font-size: 11px; color: #666; margin-bottom: 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="etiqueta">
        <div class="id">${equipo.id_equipo ?? '—'}</div>
        <div class="nombre">${equipo.nombre}</div>
        <div class="tecnica">${equipo.tecnicas_ndt?.codigo ?? ''}</div>
        <div id="barcode"></div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <script>
        JsBarcode("#barcode", "${equipo.codigo_barras}", {
          format: "CODE128", displayValue: false, height: 60, width: 2, margin: 0
        });
        setTimeout(() => window.print(), 300);
      </script></body></html>
    `);
    win.document.close();
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="p-6 space-y-4">

      {/* ==================================================== */}
      {/* BANNER DE AVISO: equipos pendientes de calibración */}
      {/* ==================================================== */}
      {!avisoCerrado && equiposPendientesCalibracion.length > 0 && (
        <div className="bg-gradient-to-r from-airbus-red to-airbus-orange rounded-xl shadow-lg overflow-hidden animate-in">
          <div className="flex items-start gap-4 p-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-white animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-bold text-base">
                  {equiposPendientesCalibracion.length} equipo
                  {equiposPendientesCalibracion.length !== 1 ? 's' : ''} con calibración vencida
                </h3>
                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">
                  ACCIÓN REQUERIDA
                </span>
              </div>

              <p className="text-white/90 text-sm mt-1">
                Los equipos con calibración vencida no deben usarse para inspecciones hasta
                que se recalibren. Revisa la lista a continuación.
              </p>

              {/* Preview de los 3 primeros */}
              <div className="mt-3 flex flex-wrap gap-2">
                {equiposPendientesCalibracion.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openEdit(e.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full text-xs text-white transition"
                  >
                    <span className="font-mono font-bold">{e.id_equipo}</span>
                    <span className="opacity-80 truncate max-w-[140px]">{e.nombre}</span>
                  </button>
                ))}
                {equiposPendientesCalibracion.length > 3 && (
                  <button
                    onClick={() => {
                      setFiltroEstado('pendiente_calibracion');
                      setAvisoCerrado(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/25 hover:bg-white/35 rounded-full text-xs text-white font-semibold transition"
                  >
                    +{equiposPendientesCalibracion.length - 3} más →
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setAvisoCerrado(true)}
              className="p-1.5 hover:bg-white/10 rounded-full transition shrink-0"
              title="Cerrar aviso"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Aviso secundario: próximos a vencer */}
      {!avisoCerrado && equiposPendientesCalibracion.length === 0 && equiposProximosCalibracion.length > 0 && (
        <div className="bg-airbus-orange/10 border border-airbus-orange/30 rounded-xl p-4 flex items-start gap-3 animate-in">
          <AlertTriangle className="w-5 h-5 text-airbus-orange shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-airbus-orange">
              {equiposProximosCalibracion.length} equipo
              {equiposProximosCalibracion.length !== 1 ? 's' : ''} con calibración próxima a vencer (menos de 30 días)
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Programa su recalibración para evitar que caduquen.
            </p>
          </div>
          <button
            onClick={() => setAvisoCerrado(true)}
            className="p-1 rounded hover:bg-airbus-orange/20 transition"
          >
            <X className="w-4 h-4 text-airbus-orange" />
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* CABECERA */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Equipos NDT</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} de {equipos.length} equipos
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
          {toast}
        </div>
      )}

      {/* ==================================================== */}
      {/* PANEL DE FILTROS */}
      {/* ==================================================== */}
      <div className="card space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por ID, nombre, código, serie, marca..."
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

        {/* Filtro por TÉCNICA */}
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

        {/* Filtro por ESTADO */}
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
                        : esPendiente
                          ? 'red'
                          : 'default'
                  }
                  icon={
                    esPendiente && count > 0 ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : undefined
                  }
                >
                  {e.label}
                </FilterChip>
              );
            })}
          </div>
        </div>

        {/* Filtro por CALIBRACIÓN */}
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

      {/* ==================================================== */}
      {/* TABLA */}
      {/* ==================================================== */}
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
                  <th className="px-4 py-3">Código de barras</th>
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
                  const efectivo = estadoEfectivo(e);
                  const esPendienteCalib = efectivo === 'pendiente_calibracion';

                  return (
                    <tr
                      key={e.id}
                      className={`hover:bg-gray-50 transition cursor-pointer ${
                        esPendienteCalib ? 'bg-airbus-red/5' : ''
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
                          className="hover:bg-airbus-light/10 rounded p-1 -m-1 transition"
                          title="Clic para ampliar"
                        >
                          <Barcode
                            value={e.codigo_barras}
                            format="CODE128"
                            displayValue={false}
                            height={35}
                            width={1.3}
                            margin={0}
                            background="transparent"
                            lineColor="#00205B"
                          />
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{e.nombre}</p>
                        <p className="text-xs text-gray-500">{e.marca} {e.modelo}</p>
                      </td>

                      <td className="px-4 py-3">
                        <span className="badge badge-blue">
                          {e.tecnicas_ndt?.codigo ?? '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-600">{e.ubicacion ?? '—'}</td>

                      {/* ESTADO con override si está pendiente de calibración */}
                      <td className="px-4 py-3">
                        <span
                          className={`${estadoBadge[efectivo] ?? 'badge badge-gray'} ${
                            esPendienteCalib ? 'inline-flex items-center gap-1' : ''
                          }`}
                        >
                          {esPendienteCalib && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {estadoLabel(efectivo)}
                        </span>
                      </td>

                      {/* Próxima calibración con color según estado */}
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
              <Barcode
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

      {/* Modal crear/editar */}
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
    </div>
  );
}

// ============================================================
// Componente FilterChip
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