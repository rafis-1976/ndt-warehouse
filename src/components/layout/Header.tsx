import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePerfil, type Rol } from '../../hooks/usePerfil';
import { supabase } from '../../lib/supabase';
import { estadoCalibracion, estadoEfectivoEquipo } from '../../lib/calibracion';
import {
  Plane, LogOut, Bell, User, Menu, ShieldCheck, AlertTriangle, Wrench,
} from 'lucide-react';

// ============================================================
// Estilos por rol
// ============================================================
const rolStyles: Record<Rol, { label: string; badge: string; dot: string }> = {
  admin: {
    label: 'Administrador',
    badge: 'bg-airbus-red/15 text-airbus-red border-airbus-red/30',
    dot: 'bg-airbus-red',
  },
  supervisor: {
    label: 'Supervisor',
    badge: 'bg-airbus-orange/15 text-airbus-orange border-airbus-orange/30',
    dot: 'bg-airbus-orange',
  },
  tecnico: {
    label: 'Técnico',
    badge: 'bg-airbus-green/15 text-airbus-green border-airbus-green/30',
    dot: 'bg-airbus-green',
  },
};

// ============================================================
// Props
// ============================================================
interface HeaderProps {
  onToggleSidebar?: () => void;
}

// ============================================================
// Componente
// ============================================================
export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { perfil } = usePerfil();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Contadores de calibración
  const [calibVencidas, setCalibVencidas] = useState(0);
  const [calibProximas, setCalibProximas] = useState(0);
  const [equiposEnCalibracion, setEquiposEnCalibracion] = useState(0);

  // ============================================================
  // Cargar alertas de calibración
  // ============================================================
  useEffect(() => {
    async function loadAlertas() {
      const { data, error } = await supabase
        .from('equipos')
        .select('proxima_calibracion, estado')
        .neq('estado', 'baja');

      if (error) {
        console.error('[Header] Error cargando alertas:', error);
        return;
      }

      let vencidas = 0;
      let proximas = 0;
      let enCalibracion = 0;

      (data ?? []).forEach((e: any) => {
        const efectivo = estadoEfectivoEquipo(e);
        if (efectivo === 'pendiente_calibracion') vencidas++;
        else if (efectivo === 'calibracion') enCalibracion++;
        else if (estadoCalibracion(e.proxima_calibracion) === 'proxima') proximas++;
      });

      setCalibVencidas(vencidas);
      setCalibProximas(proximas);
      setEquiposEnCalibracion(enCalibracion);
    }

    loadAlertas();

    // Refrescar cada 5 minutos
    const interval = setInterval(loadAlertas, 5 * 60 * 1000);

    // Refrescar cuando vuelve el foco a la pestaña
    const onFocus = () => loadAlertas();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const rol = perfil?.rol ?? 'tecnico';
  const rolInfo = rolStyles[rol];

  // Total de alertas para el badge (vencidas son las críticas)
  const totalAlertasCriticas = calibVencidas;

  return (
    <header className="bg-airbus-blue text-white shadow-lg sticky top-0 z-30">
      <div className="px-4 py-3 flex items-center justify-between">

        {/* ============================================================
            IZQUIERDA: logo + título
            ============================================================ */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Plane className="w-6 h-6 text-airbus-light" />
          </div>

          <div>
            <h1 className="text-base font-bold tracking-wide leading-tight">
              NDT WAREHOUSE
            </h1>
            <p className="text-[11px] text-airbus-light opacity-80 leading-tight">
              Gestión de Ensayos No Destructivos
            </p>
          </div>
        </div>

        {/* ============================================================
            DERECHA: campana + usuario
            ============================================================ */}
        <div className="flex items-center gap-2">

          {/* ----------------- CAMPANA ----------------- */}
          <div className="relative group">
            <button
              className="p-2 hover:bg-white/10 rounded-full transition relative"
              aria-label="Notificaciones"
            >
              <Bell className="w-5 h-5" />

              {/* Badge rojo si hay vencidas */}
              {calibVencidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-airbus-red text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-airbus-blue">
                  {calibVencidas > 9 ? '9+' : calibVencidas}
                </span>
              )}

              {/* Badge naranja si solo hay próximas */}
              {calibVencidas === 0 && calibProximas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-airbus-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-airbus-blue">
                  {calibProximas > 9 ? '9+' : calibProximas}
                </span>
              )}

              {/* Badge azul si solo hay en calibración */}
              {calibVencidas === 0 && calibProximas === 0 && equiposEnCalibracion > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-airbus-sky text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-airbus-blue">
                  {equiposEnCalibracion > 9 ? '9+' : equiposEnCalibracion}
                </span>
              )}
            </button>

            {/* ----------------- TOOLTIP ----------------- */}
            {(calibVencidas > 0 || calibProximas > 0 || equiposEnCalibracion > 0) && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-100 p-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150 z-50">

                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Alertas del almacén
                </p>

                {calibVencidas > 0 && (
                  <button
                    onClick={() => navigate('/equipos')}
                    className="w-full text-left flex items-start gap-2 mb-2 p-2 hover:bg-airbus-red/5 rounded transition group/item"
                  >
                    <span className="w-2 h-2 bg-airbus-red rounded-full shrink-0 mt-1.5 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-airbus-red">
                        {calibVencidas} equipo{calibVencidas !== 1 ? 's' : ''} con calibración vencida
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        No se pueden prestar hasta recalibrar
                      </p>
                    </div>
                  </button>
                )}

                {calibProximas > 0 && (
                  <button
                    onClick={() => navigate('/equipos')}
                    className="w-full text-left flex items-start gap-2 mb-2 p-2 hover:bg-airbus-orange/5 rounded transition"
                  >
                    <span className="w-2 h-2 bg-airbus-orange rounded-full shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-airbus-orange">
                        {calibProximas} equipo{calibProximas !== 1 ? 's' : ''} próximo{calibProximas !== 1 ? 's' : ''} a vencer
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Vencen en menos de 30 días
                      </p>
                    </div>
                  </button>
                )}

                {equiposEnCalibracion > 0 && (
                  <button
                    onClick={() => navigate('/equipos')}
                    className="w-full text-left flex items-start gap-2 p-2 hover:bg-airbus-sky/5 rounded transition"
                  >
                    <span className="w-2 h-2 bg-airbus-sky rounded-full shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-airbus-sky">
                        {equiposEnCalibracion} equipo{equiposEnCalibracion !== 1 ? 's' : ''} en calibración
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enviados al laboratorio
                      </p>
                    </div>
                  </button>
                )}

                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button
                    onClick={() => navigate('/equipos')}
                    className="w-full text-center text-xs text-airbus-sky hover:text-airbus-blue font-medium py-1"
                  >
                    Ver todos los equipos →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ----------------- USUARIO ----------------- */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 p-1.5 pl-3 hover:bg-white/10 rounded-full transition"
              aria-label="Menú de usuario"
            >
              {/* Email + badge rol (desktop) */}
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-xs max-w-[180px] truncate opacity-90">
                  {user?.email}
                </span>
                <span
                  className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${rolInfo.badge}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${rolInfo.dot}`} />
                  {rolInfo.label}
                </span>
              </div>

              {/* Avatar */}
              <div className="w-8 h-8 bg-airbus-light/20 rounded-full flex items-center justify-center shrink-0">
                {rol === 'admin' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
            </button>

            {/* ----------------- MENÚ DESPLEGABLE ----------------- */}
            {menuOpen && (
              <>
                {/* Overlay para cerrar al hacer clic fuera */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />

                <div className="absolute right-0 mt-2 w-64 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-100 py-1 overflow-hidden z-50">

                  {/* Info del usuario */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-0.5">
                      Sesión iniciada como
                    </p>
                    <p className="text-sm font-medium truncate">
                      {perfil?.nombre_completo ?? user?.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>

                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${rolInfo.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${rolInfo.dot}`} />
                        {rolInfo.label}
                      </span>

                      {perfil?.activo === false && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Resumen rápido de alertas */}
                  {(calibVencidas > 0 || calibProximas > 0) && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-3 text-xs">
                        {calibVencidas > 0 && (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-airbus-red" />
                            <span className="text-airbus-red font-semibold">
                              {calibVencidas} vencida{calibVencidas !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        {calibProximas > 0 && (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-airbus-orange" />
                            <span className="text-airbus-orange font-semibold">
                              {calibProximas} próxima{calibProximas !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        {equiposEnCalibracion > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-airbus-sky" />
                            <span className="text-airbus-sky font-semibold">
                              {equiposEnCalibracion} en calib.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Botón cerrar sesión */}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-airbus-red flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}