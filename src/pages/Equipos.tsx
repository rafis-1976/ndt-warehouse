import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Plus, Package, RefreshCw, Printer, X, Filter,
  AlertTriangle, Calendar, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { EquipoForm } from '../components/equipos/EquipoForm';
import Barcode from 'react-barcode';

const estadoBadge: Record<string, string> = {
  disponible:    'badge badge-green',
  prestado:      'badge badge-blue',
  calibracion:   'badge badge-yellow',
  mantenimiento: 'badge badge-yellow',
  baja:          'badge badge-red',
};

const estados = [
  { value: 'disponible',    label: 'Disponible' },
  { value: 'prestado',      label: 'Prestado' },
  { value: 'calibracion',   label: 'En calibración' },
  { value: 'mantenimiento', label: 'En mantenimiento' },
  { value: 'baja',          label: 'Baja' },
];

type FiltroCalibracion = 'todas' | 'vencida' | 'proxima' | 'ok' | 'sin_fecha';

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
  // Helpers de calibración
  // ============================================================
  const estadoCalibracion = (fecha: string | null): 'vencida' | 'proxima' | 'ok' | 'sin_fecha' => {
    if (!fecha) return 'sin_fecha';
    const diff = new Date(fecha).getTime() - Date.now();
    if (diff < 0) return 'vencida';
    if (diff < 30 * 864e5) return 'proxima';
    return 'ok';
  };

  // ============================================================
  // Filtrado combinado
  // ============================================================
  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return equipos.filter((e) => {
      // Buscador
      const coincideBusqueda = qLower === '' ||
        [e.nombre, e.codigo_barras, e.numero_serie, e.marca, e.modelo, e.id_equipo]
          .join(' ').toLowerCase().includes(qLower);
      if (!coincideBusqueda) return false;

      // Técnica
      if (filtroTecnica !== 'todas' && e.tecnicas_ndt?.codigo !== filtroTecnica) return false;

      // Estado
      if (filtroEstado !== 'todos' && e.estado !== filtroEstado) return false;

      // Calibración
      if (filtroCalibracion !== 'todas') {
        if (estadoCalibracion(e.proxima_calibracion) !== filtroCalibracion) return false;
      }

      return true;
    });
  }, [equipos, q, filtroTecnica, filtroEstado, filtroCalibracion]);

  // ============================================================
  // Contadores para mostrar en cada chip
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
      porEstado[e.estado] = (porEstado[e.estado] ?? 0) + 1;
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
      {/* Cabecera */}
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
        {/* Buscador + botón limpiar */}
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
            {estados.map((e) => (
              <FilterChip
                key={e.value}
                active={filtroEstado === e.value}
                onClick={() => setFiltroEstado(e.value)}
                count={contadores.porEstado[e.value] ?? 0}
                color={e.value === 'disponible' ? 'green' : e.value === 'baja' ? 'red' : 'default'}
              >
                {e.label}
              </FilterChip>
            ))}
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
              <button onClick={limpiarFiltros} className="btn-ghost border border-gray-300 inline-flex items-center gap-2">
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
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => openEdit(e.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-airbus-blue">
                        {e.id_equipo ?? '—'}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setBarcodeAbierto(e.codigo_barras); }}
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

                      <td className="px-4 py-3">
                        <span className={estadoBadge[e.estado] ?? 'badge badge-gray'}>
                          {e.estado}
                        </span>
                      </td>

                      {/* Calibración con color según estado */}
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
                            onClick={(ev) => { ev.stopPropagation(); imprimirEtiqueta(e); }}
                            className="p-1.5 text-gray-400 hover:text-airbus-blue hover:bg-airbus-light/10 rounded transition"
                            title="Imprimir etiqueta"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); openEdit(e.id); }}
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

      {/* Modal: barcode ampliado */}
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

      {/* Modal: crear/editar */}
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
        active ? activeColor : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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