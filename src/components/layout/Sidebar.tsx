import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, Calendar, BarChart3, Barcode, Settings,
  ArrowRightLeft, UserCog,
} from 'lucide-react';
import { usePerfil } from '../../hooks/usePerfil';

interface Item {
  to: string;
  label: string;
  icon: any;
  soloAdmin?: boolean;
}

const items: Item[] = [
  { to: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/equipos',       label: 'Equipos',        icon: Package },
  { to: '/prestamos',     label: 'Préstamos',      icon: Users },
  { to: '/calibraciones', label: 'Calibraciones',  icon: Calendar },
  { to: '/movimientos',   label: 'Movimientos',    icon: ArrowRightLeft },
  { to: '/scan',          label: 'Escanear',       icon: Barcode },
  { to: '/estadisticas',  label: 'Estadísticas',   icon: BarChart3 },
  { to: '/usuarios',      label: 'Usuarios',       icon: UserCog, soloAdmin: true },
  { to: '/ajustes',       label: 'Ajustes',        icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { perfil } = usePerfil();
  const esAdmin = perfil?.rol === 'admin';

  const itemsVisibles = items.filter((it) => !it.soloAdmin || esAdmin);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed lg:sticky lg:top-[64px] top-[64px] left-0 z-40
          w-64 h-[calc(100vh-64px)] bg-white border-r border-gray-200
          transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-160px)]">
          {itemsVisibles.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-airbus-blue text-white shadow-sm'
                    : 'text-gray-600 hover:bg-airbus-light/10 hover:text-airbus-blue'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-4 left-3 right-3">
          <div className="bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl p-3 text-white">
            <p className="text-xs font-semibold">Sistema NDT</p>
            <p className="text-[10px] opacity-70 mt-0.5">
              UT · RT · ET · TT · MT · PT
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}