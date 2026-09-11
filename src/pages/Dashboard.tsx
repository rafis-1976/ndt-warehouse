import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Package, Users, Calendar, AlertTriangle, TrendingUp, Barcode, ArrowRight,
} from 'lucide-react';
import { tecnicaImagenes } from '../lib/tecnicasImagenes';

export function Dashboard() {
  const [stats, setStats] = useState({
    equipos: 0, prestamos: 0, calibraciones: 0, alertas: 0,
  });
  const [tecnicas, setTecnicas] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const [eq, pr, cal, tec] = await Promise.all([
        supabase.from('equipos').select('id', { count: 'exact', head: true }),
        supabase.from('prestamos').select('id', { count: 'exact', head: true }).eq('estado', 'activo'),
        supabase.from('equipos').select('id', { count: 'exact', head: true }).lte('proxima_calibracion', new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]),
        supabase.from('tecnicas_ndt').select('*').eq('activa', true),
      ]);
      setStats({
        equipos: eq.count ?? 0,
        prestamos: pr.count ?? 0,
        calibraciones: cal.count ?? 0,
        alertas: 5,
      });
      setTecnicas(tec.data ?? []);
    }
    load();
  }, []);

  const cards = [
    { label: 'Equipos totales',         value: stats.equipos,      icon: Package,       color: 'bg-airbus-sky' },
    { label: 'Préstamos activos',       value: stats.prestamos,    icon: Users,         color: 'bg-airbus-green' },
    { label: 'Calibraciones < 30 días', value: stats.calibraciones, icon: Calendar,      color: 'bg-airbus-orange' },
    { label: 'Alertas',                 value: stats.alertas,      icon: AlertTriangle, color: 'bg-airbus-red' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden h-56 bg-gradient-to-r from-airbus-blue via-airbus-navy to-airbus-blue">
        <div className="absolute inset-0 opacity-20">
          <img
            src="/images/ndt/banner.jpg"
            alt="NDT"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(116,210,231,0.25),transparent_60%)]" />
        <div className="relative z-10 h-full flex flex-col justify-center px-8 md:px-12">
          <span className="badge bg-white/10 text-airbus-light border border-white/20 mb-3 self-start">
            Sistema activo
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Bienvenido al Sistema de Gestión NDT
          </h2>
          <p className="text-airbus-light/90 max-w-2xl text-sm md:text-base">
            Control integral del almacén de equipos de Ensayos No Destructivos:
            UT, RT, ET, TT, MT y PT.
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-start gap-4">
            <div className={`${c.color} w-12 h-12 rounded-lg flex items-center justify-center shrink-0`}>
              <c.icon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
              <p className="text-xs text-gray-500 leading-tight">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Técnicas NDT */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-airbus-blue">Técnicas NDT</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tecnicas.map((t) => (
            <div
              key={t.id}
              className="card p-0 overflow-hidden group cursor-pointer hover:shadow-md transition"
            >
              <div className="h-24 bg-gradient-to-br from-airbus-blue to-airbus-navy relative overflow-hidden">
                <img
                  src={tecnicaImagenes[t.codigo] ?? t.imagen_url}
                  alt={t.nombre}
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="absolute bottom-2 left-2 text-white font-bold text-lg drop-shadow">
                  {t.codigo}
                </span>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-gray-700 leading-tight line-clamp-2">
                  {t.nombre}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickCard icon={Barcode}  title="Escanear código"    desc="Registra entradas y salidas"       to="/scan" />
        <QuickCard icon={Users}    title="Nuevo préstamo"     desc="Registra la salida de un equipo"   to="/prestamos" />
        <QuickCard icon={TrendingUp} title="Ver estadísticas" desc="Analiza el estado del almacén"     to="/estadisticas" />
      </div>
    </div>
  );
}

function QuickCard({
  icon: Icon, title, desc, to,
}: { icon: any; title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="card hover:shadow-md transition group flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-airbus-sky/10 flex items-center justify-center group-hover:bg-airbus-sky transition">
        <Icon className="w-6 h-6 text-airbus-sky group-hover:text-white transition" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-airbus-sky group-hover:translate-x-1 transition" />
    </Link>
  );
}