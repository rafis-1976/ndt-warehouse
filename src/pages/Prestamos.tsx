import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Users, AlertCircle } from 'lucide-react';

export function Prestamos() {
  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prestamos')
        .select('*, equipos(nombre, codigo_barras), perfiles(nombre_completo, email)')
        .order('created_at', { ascending: false });
      setPrestamos(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const badge = (estado: string) => ({
    activo: 'badge badge-blue',
    devuelto: 'badge badge-green',
    retrasado: 'badge badge-yellow',
    perdido: 'badge badge-red',
  }[estado] ?? 'badge badge-gray');

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Préstamos</h1>
          <p className="text-sm text-gray-500">Control de salidas y devoluciones de equipos</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo préstamo
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : prestamos.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Sin préstamos registrados</p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prestamos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{p.equipos?.nombre}</p>
                      <p className="text-xs font-mono text-gray-500">{p.equipos?.codigo_barras}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.perfiles?.nombre_completo}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(p.fecha_prestamo).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {p.fecha_devolucion_prevista
                        ? new Date(p.fecha_devolucion_prevista).toLocaleDateString('es-ES')
                        : '—'}
                    </td>
                    <td className="px-4 py-3"><span className={badge(p.estado)}>{p.estado}</span></td>
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