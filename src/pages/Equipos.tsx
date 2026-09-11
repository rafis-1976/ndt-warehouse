import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Package, RefreshCw } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { EquipoForm } from '../components/equipos/EquipoForm';

const estadoBadge: Record<string, string> = {
  disponible:    'badge badge-green',
  prestado:      'badge badge-blue',
  calibracion:   'badge badge-yellow',
  mantenimiento: 'badge badge-yellow',
  baja:          'badge badge-red',
};

export function Equipos() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('equipos')
      .select('*, tecnicas_ndt(codigo, nombre)')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setEquipos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = equipos.filter((e) =>
    [e.nombre, e.codigo_barras, e.numero_serie, e.marca, e.modelo]
      .join(' ').toLowerCase().includes(q.toLowerCase())
  );

  const openNew = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setToast(editingId ? 'Equipo actualizado correctamente' : 'Equipo creado correctamente');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Equipos NDT</h1>
          <p className="text-sm text-gray-500">
            Inventario completo de equipos del almacén
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

      {/* Buscador */}
      <div className="card">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Buscar por nombre, código, serie, marca..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
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
                : 'Sin resultados para tu búsqueda'}
            </p>
            {equipos.length === 0 && (
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
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Técnica</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Próx. calibración</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => openEdit(e.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.codigo_barras}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{e.nombre}</p>
                      <p className="text-xs text-gray-500">{e.marca} {e.modelo}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-blue">{e.tecnicas_ndt?.codigo ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.ubicacion ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={estadoBadge[e.estado] ?? 'badge badge-gray'}>
                        {e.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {e.proxima_calibracion ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); openEdit(e.id); }}
                        className="text-xs text-airbus-sky hover:text-airbus-blue font-medium"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
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