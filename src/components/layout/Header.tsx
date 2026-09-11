import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Plane, LogOut, Bell, User, Menu } from 'lucide-react';

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="bg-airbus-blue text-white shadow-lg sticky top-0 z-30">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Plane className="w-6 h-6 text-airbus-light" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide leading-tight">NDT WAREHOUSE</h1>
            <p className="text-[11px] text-airbus-light opacity-80 leading-tight">
              Gestión de Ensayos No Destructivos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/10 rounded-full transition relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-airbus-orange rounded-full" />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1.5 pl-3 hover:bg-white/10 rounded-full transition"
            >
              <span className="text-sm hidden sm:inline max-w-[180px] truncate">
                {user?.email}
              </span>
              <div className="w-8 h-8 bg-airbus-light/20 rounded-full flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-100 py-1 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500">Sesión iniciada como</p>
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-airbus-red flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}