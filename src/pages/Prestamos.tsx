import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Users, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
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

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('prestamos')
      .select('*, equipos(id_equipo, nombre, codigo_barras), perfiles(nombre_completo, email)')
      .order('created_at', { ascending: false });
    setPrestamos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSuccess = () => {
    setModalOpen(false);
    setToast('Préstamo registrado correctamente');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const devolver = async (prestamo: any) => {
    if (!confirm('¿Confirmar devolución del equipo?')) return;

    // 1. Marcar el préstamo como devuelto
    await supabase
      .from('prestamos')
      .update({
        estado: 'devuelto',
        fecha_devolucion_real: new Date().toISOString(),
      })
      .eq('id', prestamo.id);

    // 2. Liberar el equipo
    await supabase
      .from('equipos')
      .update({ estado: 'disponible' })
      .eq('id', prestamo.equipo_id);

    // 3. Registrar movimiento de entrada
    await supabase.from('movimientos').insert({
      equipo_id: prestamo.equipo_id,
      tipo: 'entrada',
      observaciones: 'Devolución de préstamo',
    });

    setToast('Devolución registrada');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const isRetrasado = (p: any) =>
    p.estado === 'activo' &&
    p.fecha_devolucion_prevista &&
    new Date(p.fecha_devolucion_prevista) < new Date();

  return (
    <div className="p-6 space-y-4">
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

      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando...
          </div>
        ) : prestamos.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">Sin préstamos registrados</p>
            <button
              onClick={() => setModalOpen(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Préstamo</th>
                  <th className="px-4 py-3">Devolución prevista</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prestamos.map((p) => {
                  const retrasado = isRetrasado(p);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{p.equipos?.nombre}</p>
                        <p className="text-xs font-mono text-gray-500">
                          {p.equipos?.id_equipo ? `[${p.equipos.id_equipo}] ` : ''}
                          {p.equipos?.codigo_barras}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800">{p.perfiles?.nombre_completo}</p>
                        <p className="text-xs text-gray-500">{p.perfiles?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
  {new Date(p.fecha_prestamo).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })}
</td>

<td className="px-4 py-3 text-xs whitespace-nowrap">
  <span className={retrasado
    ? 'text-airbus-orange font-semibold flex items-center gap-1'
    : 'text-gray-600'}>
    {retrasado && <AlertTriangle className="w-3 h-3" />}
    {p.fecha_devolucion_prevista
      ? new Date(p.fecha_devolucion_prevista).toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—'}
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
                            className="text-xs text-airbus-green hover:text-airbus-navy font-medium"
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo préstamo"
        size="lg"
      >
        <PrestamoForm onSuccess={handleSuccess} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}