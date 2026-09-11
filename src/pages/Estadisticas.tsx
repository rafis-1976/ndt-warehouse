import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const COLORS = ['#00205B', '#0085AD', '#74D2E7', '#009F4D', '#FE5000', '#DA1884'];

export function Estadisticas() {
  const [porEstado, setPorEstado] = useState<any[]>([]);
  const [porTecnica, setPorTecnica] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: eq } = await supabase
        .from('equipos')
        .select('estado, tecnicas_ndt(codigo, nombre)');

      const estadoMap: Record<string, number> = {};
      const tecMap: Record<string, number> = {};
      (eq ?? []).forEach((e: any) => {
        estadoMap[e.estado] = (estadoMap[e.estado] ?? 0) + 1;
        const t = e.tecnicas_ndt?.codigo ?? 'Sin técnica';
        tecMap[t] = (tecMap[t] ?? 0) + 1;
      });

      setPorEstado(Object.entries(estadoMap).map(([name, value]) => ({ name, value })));
      setPorTecnica(Object.entries(tecMap).map(([name, value]) => ({ name, value })));
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-airbus-blue">Estadísticas</h1>
        <p className="text-sm text-gray-500">Análisis del estado del almacén NDT</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-airbus-blue mb-4">Equipos por estado</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={porEstado}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {porEstado.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-airbus-blue mb-4">Equipos por técnica NDT</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porTecnica}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Bar dataKey="value" fill="#0085AD" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}