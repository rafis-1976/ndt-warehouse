import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, AlertTriangle } from 'lucide-react';

export function Calibraciones() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('calibraciones')
        .select('*, equipos(nombre, codigo_barras)')
        .order('fecha_calibracion', { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const isProxima = (fecha: string) => {
    if (!fecha) return false;
    const diff = new Date(fecha).getTime() - Date.now();
    return diff > 0 && diff < 30 * 864e5;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Calibraciones</h1>
          <p className="text-sm text-gray-500">Seguimiento de calibraciones y certificados</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva calibración
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Sin calibraciones registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Próxima</th>
                  <th className="px-4 py-3">Laboratorio</th>
                  <th className="px-4 py-3">Certificado</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.equipos?.nombre}</p>
                      <p className="text-xs font-mono text-gray-500">{c.equipos?.codigo_barras}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.fecha_calibracion}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isProxima(c.fecha_proxima) ? 'text-airbus-orange font-semibold flex items-center gap-1' : 'text-gray-600'}`}>
                        {isProxima(c.fecha_proxima) && <AlertTriangle className="w-3 h-3" />}
                        {c.fecha_proxima}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.laboratorio ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{c.numero_certificado ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={
                        c.resultado === 'aprobado' ? 'badge badge-green' :
                        c.resultado === 'rechazado' ? 'badge badge-red' :
                        'badge badge-yellow'
                      }>
                        {c.resultado ?? '—'}
                      </span>
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