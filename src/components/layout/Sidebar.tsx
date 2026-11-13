import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity, Cable, ChevronDown, ChevronRight,
  LayoutDashboard, Package, Users, Calendar, BarChart3, Barcode,
  Settings, ArrowRightLeft, UserCog, Boxes, FileText, Hash, Grid3x3,
  Wrench, ClipboardList, Plane,
} from 'lucide-react';
import { usePerfil } from '../../hooks/usePerfil';

// ============================================================
// Estructura del menú (link simple o grupo colapsable)
// ============================================================
type NavItem =
  | { kind: 'link'; to: string; label: string; icon: any; soloAdmin?: boolean }
  | { kind: 'group'; label: string; icon: any; items: Array<{ to: string; label: string; icon: any }> };

const items: NavItem[] = [
  { kind: 'link', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    kind: 'group',
    label: 'Taller',
    icon: Wrench,
    items: [
      { to: '/carros',        label: 'Carros',         icon: Boxes },
      { to: '/equipos',       label: 'Equipos',        icon: Package },
      { to: '/sondas',        label: 'Sondas',         icon: Activity },
      { to: '/cables',        label: 'Cables',         icon: Cable },
      { to: '/probetas',      label: 'Probetas',       icon: Hash },
      { to: '/prestamos',     label: 'Préstamos',      icon: Users },
      { to: '/calibraciones', label: 'Calibraciones',  icon: Calendar },
      { to: '/movimientos',   label: 'Movimientos',    icon: ArrowRightLeft },
      { to: '/scan',          label: 'Escanear',       icon: Barcode },
      { to: '/estadisticas',  label: 'Estadísticas',   icon: BarChart3 },
    ],
  },
  { kind: 'link', to: '/informes',          label: 'Informes',          icon: FileText },
  { kind: 'link', to: '/gridmapping',       label: 'Grid Mapping',      icon: Grid3x3 },
  { kind: 'link', to: '/esas',              label: 'EASAs',             icon: Plane },
  { kind: 'link', to: '/trabajos-diarios',  label: 'Trabajos Diarios',  icon: ClipboardList },
  { kind: 'link', to: '/usuarios',          label: 'Usuarios',          icon: UserCog, soloAdmin: true },
  { kind: 'link', to: '/ajustes',           label: 'Ajustes',           icon: Settings },
];

// Rutas hijas de "Taller" para autodetectar si está activo
const TALLER_PATHS = [
  '/carros', '/equipos', '/sondas', '/cables', '/probetas',
  '/prestamos', '/calibraciones', '/movimientos', '/scan', '/estadisticas',
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { perfil } = usePerfil();
  const esAdmin = perfil?.rol === 'admin';
  const location = useLocation();

  const tallerActivo = TALLER_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  const [tallerOpen, setTallerOpen] = useState(tallerActivo);

  // Si entras en cualquier ruta hija de Taller, se abre solo
  useEffect(() => {
    if (tallerActivo) setTallerOpen(true);
  }, [tallerActivo]);

  const itemsVisibles = items.filter((it) => {
    if (it.kind === 'link' && it.soloAdmin && !esAdmin) return false;
    return true;
  });

  return (
    <>
      {open && (
        <div onClick={onClose} className="fixed inset-0 bg-black/40 z-30 lg:hidden" />
      )}

      <aside className={`
        fixed lg:sticky lg:top-[64px] top-[64px] left-0 z-40
        w-64 h-[calc(100vh-64px)] bg-white border-r border-gray-200
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-160px)]">
          {itemsVisibles.map((item) => {
            // -------- Link simple --------
            if (item.kind === 'link') {
              return (
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
                  <item.icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </NavLink>
              );
            }

            // -------- Grupo colapsable (Taller) --------
            const isOpen = tallerOpen;
            const hasActiveChild = item.items.some(
              (sub) =>
                location.pathname === sub.to || location.pathname.startsWith(sub.to + '/')
            );

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setTallerOpen((v) => !v)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors ${
                    hasActiveChild
                      ? 'bg-airbus-blue/10 text-airbus-blue'
                      : 'text-gray-600 hover:bg-airbus-light/10 hover:text-airbus-blue'
                  }`}
                  aria-expanded={isOpen}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-2">
                    {item.items.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-airbus-blue text-white'
                              : 'text-gray-500 hover:bg-airbus-light/10 hover:text-airbus-blue'
                          }`
                        }
                      >
                        <sub.icon className="w-4 h-4 shrink-0" />
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-3 right-3">
          <div className="bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl p-3 text-white">
            <p className="text-xs font-semibold">Sistema NDT</p>
            <p className="text-[10px] opacity-70 mt-0.5">UT · RT · ET · TT</p>
          </div>
        </div>
      </aside>
    </>
  );
}