import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Package } from 'lucide-react';

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

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('equipos')
        .select('*, tecnicas_ndt(codigo, nombre)')
        .order('created_at', { ascending: false });
      setEquipos(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = equipos.filter((e) =>
    [e.nombre, e.codigo_barras, e.numero_serie, e.marca, e.modelo]
      .join(' ').toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Equipos NDT</h1>
          <p className="text-sm text-gray-500">
            Inventario completo de equipos del almacén
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo equipo
        </button>
      </div>

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

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Sin equipos registrados</p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}