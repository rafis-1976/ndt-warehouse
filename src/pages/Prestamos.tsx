import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Users, RefreshCw, CheckCircle2, AlertTriangle, Calendar,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { PrestamoForm } from '../components/prestamos/PrestamoForm';

const estadoBadge: Record<string, string> = {
  activo:    'badge badge-blue',
  devuelto:  'badge badge-green',
  retrasado: 'badge badge-yellow',
  perdido:   'badge badge-red',
};

export function Prestamos() {
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'activo' | 'devuelto' | 'retrasado'>('todos');

  // ============================================================
  // Cargar préstamos
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prestamos')
      .select(`
        *,
        equipos(id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo)),
        perfiles(nombre_completo, email)
      `)
      .order('fecha_prestamo', { ascending: false });

    if (error) console.error('[Prestamos] Error cargando:', error);
    setPrestamos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ============================================================
  // Acciones
  // ============================================================
  const handleSuccess = () => {
    setModalOpen(false);
    setToast('Préstamo registrado correctamente');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const devolver = async (prestamo: any) => {
    if (!confirm(`¿Confirmar devolución de "${prestamo.equipos?.nombre}"?`)) return;

    try {
      // 1. Marcar el préstamo como devuelto
      const { error: updPrestamo } = await supabase
        .from('prestamos')
        .update({
          estado: 'devuelto',
          fecha_devolucion_real: new Date().toISOString(),
        })
        .eq('id', prestamo.id);
      if (updPrestamo) throw updPrestamo;

      // 2. Liberar el equipo
      const { error: updEquipo } = await supabase
        .from('equipos')
        .update({ estado: 'disponible' })
        .eq('id', prestamo.equipo_id);
      if (updEquipo) throw updEquipo;

      // 3. Registrar movimiento de entrada
      await supabase.from('movimientos').insert({
        equipo_id: prestamo.equipo_id,
        tipo: 'entrada',
        observaciones: 'Devolución de préstamo',
      });

      setToast('Devolución registrada correctamente');
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (err: any) {
      console.error(err);
      alert('Error al registrar la devolución: ' + err.message);
    }
  };

  // ============================================================
  // Helpers
  // ============================================================
  const isRetrasado = (p: any) =>
    p.estado === 'activo' &&
    p.fecha_devolucion_prevista &&
    new Date(p.fecha_devolucion_prevista) < new Date();

  const fmtFechaHora = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Filtrado
  const filtrados = prestamos.filter((p) => {
    if (filtro === 'todos') return true;
    if (filtro === 'retrasado') return isRetrasado(p);
    return p.estado === filtro && !isRetrasado(p);
  });

  // Contadores para las pestañas
  const contadores = {
    todos: prestamos.length,
    activo: prestamos.filter((p) => p.estado === 'activo' && !isRetrasado(p)).length,
    retrasado: prestamos.filter(isRetrasado).length,
    devuelto: prestamos.filter((p) => p.estado === 'devuelto').length,
  };

  return (
    <div className="p-6 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Préstamos</h1>
          <p className="text-sm text-gray-500">
            Control de salidas y devoluciones de equipos
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo préstamo
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Pestañas de filtro */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'todos',     label: 'Todos',      count: contadores.todos },
          { key: 'activo',    label: 'Activos',    count: contadores.activo },
          { key: 'retrasado', label: 'Retrasados', count: contadores.retrasado },
          { key: 'devuelto',  label: 'Devueltos',  count: contadores.devuelto },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key as any)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
              filtro === t.key
                ? 'bg-white text-airbus-blue shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              filtro === t.key ? 'bg-airbus-blue/10 text-airbus-blue' : 'bg-gray-200 text-gray-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">
              {prestamos.length === 0
                ? 'Aún no hay préstamos registrados'
                : 'Sin préstamos en esta categoría'}
            </p>
            {prestamos.length === 0 && (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear el primero
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
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Préstamo</th>
                  <th className="px-4 py-3">Devolución prevista</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((p) => {
                  const retrasado = isRetrasado(p);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-gray-50 transition ${
                        retrasado ? 'bg-airbus-orange/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-airbus-blue shrink-0">
                            {p.equipos?.id_equipo ?? '—'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">
                              {p.equipos?.nombre}
                            </p>
                            <p className="text-xs font-mono text-gray-500">
                              {p.equipos?.codigo_barras}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge badge-blue">
                          {p.equipos?.tecnicas_ndt?.codigo ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800 truncate">
                          {p.perfiles?.nombre_completo ?? '—'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {p.perfiles?.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {fmtFechaHora(p.fecha_prestamo)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className={retrasado
                          ? 'text-airbus-orange font-semibold flex items-center gap-1'
                          : 'text-gray-600'}>
                          {retrasado && <AlertTriangle className="w-3 h-3" />}
                          {fmtFechaHora(p.fecha_devolucion_prevista)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={estadoBadge[retrasado ? 'retrasado' : p.estado] ?? 'badge badge-gray'}>
                          {retrasado ? 'retrasado' : p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.estado === 'activo' && (
                          <button
                            onClick={() => devolver(p)}
                            className="text-xs text-airbus-green hover:text-airbus-navy font-medium whitespace-nowrap"
                          >
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
        )}
      </div>

      {/* Modal de nuevo préstamo */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo préstamo"
        size="lg"
      >
        <PrestamoForm
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}