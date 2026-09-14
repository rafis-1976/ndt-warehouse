import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Plane, LogOut, Bell, User, Menu } from 'lucide-react';

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // DEBUG: estado visible
  const [debug, setDebug] = useState<any>({ status: 'iniciando' });

  useEffect(() => {
    if (!user) {
      setDebug({ status: 'sin usuario' });
      return;
    }

    (async () => {
      setDebug({ status: 'consultando', userId: user.id, email: user.email });
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id);

      setDebug({
        status: 'respuesta',
        userId: user.id,
        email: user.email,
        rows: data?.length ?? 0,
        data,
        error: error ? { message: error.message, code: error.code } : null,
      });
    })();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
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
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-3 p-1.5 pl-3 hover:bg-white/10 rounded-full transition"
              >
                <span className="text-sm hidden sm:inline max-w-[180px] truncate">
                  {user?.email ?? 'sin sesión'}
                </span>
                <div className="w-8 h-8 bg-airbus-light/20 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-100 py-1">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Email</p>
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

      {/* PANEL DE DEBUG FIJO EN PANTALLA */}
      <div className="fixed bottom-4 right-4 z-50 max-w-md bg-black/90 text-white text-xs rounded-lg p-4 font-mono shadow-2xl">
        <p className="font-bold text-airbus-light mb-2">🔍 DEBUG PERFIL</p>
        <pre className="whitespace-pre-wrap break-all">
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>
    </>
  );
}