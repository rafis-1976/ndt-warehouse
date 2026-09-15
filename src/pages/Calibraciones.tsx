import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Calendar, Plus, RefreshCw, AlertTriangle, CheckCircle2,
  Package, Wrench, Clock, Hash, X, Filter,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { CalibracionForm } from '../components/calibraciones/CalibracionForm';

// ============================================================
// Componente principal
// ============================================================
export function Calibraciones() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalModo, setModalModo] = useState<'nueva' | 'completar'>('nueva');
  const [calibracionSeleccionada, setCalibracionSeleccionada] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState('');

  // ============================================================
  // Cargar
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('calibraciones')
      .select(`
        *,
        equipos(id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo))
      `)
      .order('created_at', { ascending: false });

    if (error) console.error('[Calibraciones] Error:', error);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ============================================================
  // Separar por estado
  // ============================================================
  const pendientes = useMemo(
    () => items.filter((c) => c.estado === 'pendiente'),
    [items]
  );

  const historial = useMemo(
    () => items.filter((c) => c.estado !== 'pendiente'),
    [items]
  );

  // Filtro de búsqueda
  const filtrar = (lista: any[]) => {
    if (!q.trim()) return lista;
    const qLower = q.toLowerCase();
    return lista.filter((c) =>
      [
        c.equipos?.id_equipo,
        c.equipos?.nombre,
        c.equipos?.codigo_barras,
        c.laboratorio,
        c.numero_certificado,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(qLower)
    );
  };

  const pendientesFiltrados = filtrar(pendientes);
  const historialFiltrado = filtrar(historial);

  // ============================================================
  // Helpers
  // ============================================================
  const fmtFecha = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const fmtFechaHora = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const diasEnCalibracion = (fechaEnvio: string) => {
    if (!fechaEnvio) return 0;
    const diff = Date.now() - new Date(fechaEnvio).getTime();
    return Math.floor(diff / 864e5);
  };

  // ============================================================
  // Acciones
  // ============================================================
  const abrirNueva = () => {
    setModalModo('nueva');
    setCalibracionSeleccionada(null);
    setModalOpen(true);
  };

  const abrirCompletar = (calibracion: any) => {
    setModalModo('completar');
    setCalibracionSeleccionada(calibracion);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setCalibracionSeleccionada(null);
    setToast(
      modalModo === 'completar'
        ? 'Calibración completada. Equipo disponible de nuevo.'
        : 'Calibración registrada correctamente'
    );
    setTimeout(() => setToast(null), 3500);
    load();
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="p-6 space-y-4">

      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Calibraciones</h1>
          <p className="text-sm text-gray-500">
            {pendientes.length} pendientes · {historial.length} completadas
          </p>
        </div>
        <button
          onClick={abrirNueva}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva calibración
        </button>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* AVISO DE PENDIENTES */}
      {pendientes.length > 0 && tab === 'pendientes' && (
        <div className="bg-airbus-sky/10 border border-airbus-sky/30 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-airbus-sky/20 rounded-full flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-airbus-sky" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-airbus-blue">
              {pendientes.length} equipo{pendientes.length !== 1 ? 's' : ''} en calibración
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Estos equipos están bloqueados para préstamos hasta que vuelvan del
              laboratorio.
            </p>
          </div>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="card">
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Buscar por equipo, laboratorio o certificado..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('pendientes')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
            tab === 'pendientes'
              ? 'bg-white text-airbus-blue shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          En calibración
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              tab === 'pendientes'
                ? 'bg-airbus-sky/15 text-airbus-sky'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {pendientes.length}
          </span>
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
            tab === 'historial'
              ? 'bg-white text-airbus-blue shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Historial
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              tab === 'historial'
                ? 'bg-airbus-blue/10 text-airbus-blue'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {historial.length}
          </span>
        </button>
      </div>

      {/* TABLA PENDIENTES */}
      {tab === 'pendientes' && (
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Cargando...
            </div>
          ) : pendientesFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-airbus-green mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">
                No hay equipos en calibración
              </p>
              <p className="text-sm text-gray-500">
                Todos los equipos enviados a calibrar han sido procesados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Técnica</th>
                    <th className="px-4 py-3">Enviado</th>
                    <th className="px-4 py-3">Días</th>
                    <th className="px-4 py-3">Observaciones</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendientesFiltrados.map((c) => {
                    const dias = diasEnCalibracion(c.fecha_envio);
                    const urgente = dias >= 15;

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-gray-50 transition ${
                          urgente ? 'bg-airbus-orange/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-airbus-yellow/20 rounded-lg flex items-center justify-center shrink-0">
                              <Wrench className="w-4 h-4 text-yellow-700" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-airbus-blue text-xs">
                                  {c.equipos?.id_equipo ?? '—'}
                                </span>
                                <span className="text-sm text-gray-800 truncate">
                                  {c.equipos?.nombre}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-gray-400">
                                {c.equipos?.codigo_barras}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge badge-blue">
                            {c.equipos?.tecnicas_ndt?.codigo ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {fmtFechaHora(c.fecha_envio)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              urgente ? 'text-airbus-orange' : 'text-gray-600'
                            }`}
                          >
                            {urgente && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {dias} día{dias !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                          {c.observaciones ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => abrirCompletar(c)}
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Registrar retorno
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TABLA HISTORIAL */}
      {tab === 'historial' && (
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Cargando...
            </div>
          ) : historialFiltrado.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 mb-4">
                {historial.length === 0
                  ? 'Sin calibraciones registradas'
                  : 'Sin resultados para tu búsqueda'}
              </p>
              {historial.length === 0 && (
                <button
                  onClick={abrirNueva}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Registrar la primera
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3">Técnica</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Próxima</th>
                    <th className="px-4 py-3">Laboratorio</th>
                    <th className="px-4 py-3">Certificado</th>
                    <th className="px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historialFiltrado.map((c) => {
                    const proximaVencida =
                      c.fecha_proxima && new Date(c.fecha_proxima) < new Date();
                    const proximaProx =
                      c.fecha_proxima &&
                      !proximaVencida &&
                      new Date(c.fecha_proxima).getTime() - Date.now() < 30 * 864e5;

                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-airbus-blue shrink-0 text-xs">
                              {c.equipos?.id_equipo ?? '—'}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 truncate">
                                {c.equipos?.nombre}
                              </p>
                              <p className="text-[10px] font-mono text-gray-400">
                                {c.equipos?.codigo_barras}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge badge-blue">
                            {c.equipos?.tecnicas_ndt?.codigo ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {fmtFecha(c.fecha_calibracion)}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span
                            className={
                              proximaVencida
                                ? 'text-airbus-red font-semibold flex items-center gap-1'
                                : proximaProx
                                  ? 'text-airbus-orange font-semibold flex items-center gap-1'
                                  : 'text-gray-600'
                            }
                          >
                            {(proximaVencida || proximaProx) && (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            {fmtFecha(c.fecha_proxima)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[140px]">
                          {c.laboratorio ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">
                          {c.numero_certificado ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              c.resultado === 'aprobado'
                                ? 'badge badge-green'
                                : c.resultado === 'rechazado'
                                  ? 'badge badge-red'
                                  : c.resultado === 'condicional'
                                    ? 'badge badge-yellow'
                                    : 'badge badge-gray'
                            }
                          >
                            {c.resultado ?? '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setCalibracionSeleccionada(null);
        }}
        title={modalModo === 'completar' ? 'Registrar retorno de calibración' : 'Nueva calibración'}
        size="lg"
      >
        <CalibracionForm
          onSuccess={handleSuccess}
          onCancel={() => {
            setModalOpen(false);
            setCalibracionSeleccionada(null);
          }}
          calibracionId={modalModo === 'completar' ? calibracionSeleccionada?.id : undefined}
          equipoId={modalModo === 'completar' ? calibracionSeleccionada?.equipo_id : undefined}
        />
      </Modal>
    </div>
  );
}