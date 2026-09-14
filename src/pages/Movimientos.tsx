import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, RefreshCw, ArrowDownRight, ArrowUpRight, ArrowRightLeft, Sliders } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { MovimientoForm } from '../components/movimientos/MovimientoForm';

const tipoIcon: Record<string, any> = {
  entrada:       { icon: ArrowDownRight, color: 'text-airbus-green', bg: 'bg-airbus-green/10' },
  salida:        { icon: ArrowUpRight,   color: 'text-airbus-orange', bg: 'bg-airbus-orange/10' },
  transferencia: { icon: ArrowRightLeft, color: 'text-airbus-sky',    bg: 'bg-airbus-sky/10' },
  ajuste:        { icon: Sliders,        color: 'text-airbus-purple', bg: 'bg-airbus-purple/10' },
};

export function Movimientos() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('movimientos')
      .select('*, equipos(id_equipo, nombre, codigo_barras)')
      .order('created_at', { ascending: false })
      .limit(100);
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Movimientos</h1>
          <p className="text-sm text-gray-500">
            Historial de entradas, salidas y transferencias
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
        <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">
          {toast}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">Sin movimientos registrados</p>
            <button
              onClick={() => setModalOpen(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Registrar el primero
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3">Origen → Destino</th>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((m) => {
                  const conf = tipoIcon[m.tipo] ?? tipoIcon.ajuste;
                  const Icon = conf.icon;
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${conf.bg}`}>
                            <Icon className={`w-4 h-4 ${conf.color}`} />
                          </div>
                          <span className="text-xs font-medium capitalize">{m.tipo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{m.equipos?.nombre}</p>
                        <p className="text-xs font-mono text-gray-500">
                          {m.equipos?.id_equipo ? `[${m.equipos.id_equipo}] ` : ''}
                          {m.equipos?.codigo_barras}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {m.ubicacion_origen || m.ubicacion_destino ? (
                          <span>
                            {m.ubicacion_origen ?? '—'} → {m.ubicacion_destino ?? '—'}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">
                        {m.referencia ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(m.created_at).toLocaleString('es-ES')}
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
        title="Nuevo movimiento"
        size="lg"
      >
        <MovimientoForm onSuccess={handleSuccess} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}