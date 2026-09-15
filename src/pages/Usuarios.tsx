import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Users as UsersIcon, RefreshCw, ShieldCheck, ShieldOff,
  UserCog, Hash, X, Filter, Mail, CheckCircle2, AlertCircle,
  UserCheck, UserX, KeyRound, Edit3,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { UsuarioForm } from '../components/usuarios/UsuarioForm';
import { useAuth } from '../hooks/useAuth';

// ============================================================
// Configuración de roles
// ============================================================
type Rol = 'admin' | 'supervisor' | 'tecnico';

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
// Componente principal
// ============================================================
export function Usuarios() {
  const { user } = useAuth();
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // ============================================================
  // Cargar perfiles
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('nombre_completo', { ascending: true });

    if (error) {
      console.error('[Usuarios] Error:', error);
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
    }
    setPerfiles(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ============================================================
  // Filtrado
  // ============================================================
  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return perfiles.filter((p) => {
      const coincideBusqueda =
        qLower === '' ||
        [p.nombre_completo, p.email, p.num_nomina]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(qLower);
      if (!coincideBusqueda) return false;

      if (filtroRol !== 'todos' && p.rol !== filtroRol) return false;

      if (filtroEstado === 'activos' && !p.activo) return false;
      if (filtroEstado === 'inactivos' && p.activo) return false;

      return true;
    });
  }, [perfiles, q, filtroRol, filtroEstado]);

  // ============================================================
  // Contadores
  // ============================================================
  const contadores = useMemo(() => {
    const porRol: Record<string, number> = { admin: 0, supervisor: 0, tecnico: 0 };
    let activos = 0;
    let inactivos = 0;

    perfiles.forEach((p) => {
      porRol[p.rol] = (porRol[p.rol] ?? 0) + 1;
      if (p.activo) activos++;
      else inactivos++;
    });

    return { porRol, activos, inactivos, total: perfiles.length };
  }, [perfiles]);

  const hayFiltrosActivos =
    q !== '' || filtroRol !== 'todos' || filtroEstado !== 'todos';

  const limpiarFiltros = () => {
    setQ('');
    setFiltroRol('todos');
    setFiltroEstado('todos');
  };

  // ============================================================
  // Acciones rápidas
  // ============================================================
  const cambiarRolRapido = async (perfil: any, nuevoRol: Rol) => {
    if (perfil.id === user?.id) {
      setToastError('No puedes cambiar tu propio rol');
      setTimeout(() => setToastError(null), 3000);
      return;
    }
    if (!confirm(`¿Cambiar rol de ${perfil.nombre_completo} a "${rolStyles[nuevoRol].label}"?`)) return;

    const { error } = await supabase
      .from('perfiles')
      .update({ rol: nuevoRol })
      .eq('id', perfil.id);

    if (error) {
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
      return;
    }
    setToast(`Rol actualizado a ${rolStyles[nuevoRol].label}`);
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const toggleActivo = async (perfil: any) => {
    if (perfil.id === user?.id) {
      setToastError('No puedes desactivar tu propio usuario');
      setTimeout(() => setToastError(null), 3000);
      return;
    }
    const accion = perfil.activo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${perfil.nombre_completo}?`)) return;

    const { error } = await supabase
      .from('perfiles')
      .update({ activo: !perfil.activo })
      .eq('id', perfil.id);

    if (error) {
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
      return;
    }
    setToast(`Usuario ${perfil.activo ? 'desactivado' : 'activado'}`);
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const openEdit = (perfil: any) => {
    setEditingPerfil(perfil);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setEditingPerfil(null);
    setToast('Usuario actualizado correctamente');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="p-6 space-y-4">

      {/* ==================================================== */}
      {/* CABECERA */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} de {contadores.total} usuarios
          </p>
        </div>
      </div>

      {/* Toasts */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
      {toastError && (
        <div className="fixed top-20 right-6 z-50 bg-airbus-red text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {toastError}
        </div>
      )}

      {/* ==================================================== */}
      {/* ESTADÍSTICAS RÁPIDAS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total usuarios"
          value={contadores.total}
          icon={UsersIcon}
          color="blue"
        />
        <StatCard
          label="Administradores"
          value={contadores.porRol.admin ?? 0}
          icon={ShieldCheck}
          color="red"
        />
        <StatCard
          label="Supervisores"
          value={contadores.porRol.supervisor ?? 0}
          icon={UserCog}
          color="orange"
        />
        <StatCard
          label="Técnicos"
          value={contadores.porRol.tecnico ?? 0}
          icon={UserCheck}
          color="green"
        />
        <StatCard
          label="Inactivos"
          value={contadores.inactivos}
          icon={UserX}
          color="gray"
        />
      </div>

      {/* ==================================================== */}
      {/* FILTROS */}
      {/* ==================================================== */}
      <div className="card space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por nómina, nombre o email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="btn-ghost border border-gray-300 flex items-center gap-2 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>

        {/* Filtro por rol */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Filter className="w-3 h-3" />
            Rol
          </label>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={filtroRol === 'todos'}
              onClick={() => setFiltroRol('todos')}
              count={contadores.total}
            >
              Todos
            </FilterChip>
            {(['admin', 'supervisor', 'tecnico'] as Rol[]).map((r) => (
              <FilterChip
                key={r}
                active={filtroRol === r}
                onClick={() => setFiltroRol(r)}
                count={contadores.porRol[r] ?? 0}
                color={
                  r === 'admin' ? 'red' : r === 'supervisor' ? 'orange' : 'green'
                }
              >
                {rolStyles[r].label}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Filtro por estado */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Filter className="w-3 h-3" />
            Estado
          </label>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={filtroEstado === 'todos'}
              onClick={() => setFiltroEstado('todos')}
              count={contadores.total}
            >
              Todos
            </FilterChip>
            <FilterChip
              active={filtroEstado === 'activos'}
              onClick={() => setFiltroEstado('activos')}
              count={contadores.activos}
              color="green"
              icon={<UserCheck className="w-3 h-3" />}
            >
              Activos
            </FilterChip>
            <FilterChip
              active={filtroEstado === 'inactivos'}
              onClick={() => setFiltroEstado('inactivos')}
              count={contadores.inactivos}
              color="red"
              icon={<UserX className="w-3 h-3" />}
            >
              Inactivos
            </FilterChip>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* TABLA */}
      {/* ==================================================== */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando usuarios...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">
              {perfiles.length === 0
                ? 'Aún no hay usuarios registrados'
                : 'Sin usuarios con los filtros actuales'}
            </p>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="btn-ghost border border-gray-300 inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Nº Nómina</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => {
                  const rolInfo = rolStyles[p.rol as Rol] ?? rolStyles.tecnico;
                  const esYo = p.id === user?.id;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-gray-50 transition ${
                        !p.activo ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Nº nómina */}
                      <td className="px-4 py-3">
                        {p.num_nomina ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-airbus-blue text-xs">
                            <Hash className="w-3 h-3" />
                            {p.num_nomina}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sin asignar</span>
                        )}
                      </td>

                      {/* Nombre + email + avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-airbus-blue text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {p.nombre_completo
                              .split(' ')
                              .map((n: string) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate flex items-center gap-2">
                              {p.nombre_completo}
                              {esYo && (
                                <span className="px-1.5 py-0.5 bg-airbus-sky/10 text-airbus-sky text-[9px] font-bold rounded-full uppercase tracking-wider">
                                  Tú
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {p.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border ${rolInfo.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${rolInfo.dot}`} />
                          {rolInfo.label}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        {p.activo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-airbus-green/10 text-airbus-green border border-airbus-green/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            <UserX className="w-3 h-3" />
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* Acciones rápidas */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Cambio rápido de rol */}
                          <select
                            value={p.rol}
                            onChange={(e) => cambiarRolRapido(p, e.target.value as Rol)}
                            disabled={esYo}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-airbus-sky disabled:opacity-50 disabled:cursor-not-allowed"
                            title={esYo ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                          >
                            <option value="admin">Admin</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="tecnico">Técnico</option>
                          </select>

                          {/* Toggle activo */}
                          <button
                            onClick={() => toggleActivo(p)}
                            disabled={esYo}
                            className={`p-1.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
                              p.activo
                                ? 'text-airbus-red hover:bg-airbus-red/10'
                                : 'text-airbus-green hover:bg-airbus-green/10'
                            }`}
                            title={
                              esYo
                                ? 'No puedes desactivar tu propio usuario'
                                : p.activo
                                  ? 'Desactivar usuario'
                                  : 'Activar usuario'
                            }
                          >
                            {p.activo ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>

                          {/* Editar */}
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                            title="Editar usuario"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal editar usuario */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPerfil(null);
        }}
        title="Editar usuario"
        size="md"
      >
        {editingPerfil && (
          <UsuarioForm
            perfil={editingPerfil}
            onSuccess={handleSuccess}
            onCancel={() => {
              setModalOpen(false);
              setEditingPerfil(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// StatCard
// ============================================================
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: 'blue' | 'red' | 'orange' | 'green' | 'gray';
}) {
  const colorMap = {
    blue: 'bg-airbus-blue',
    red: 'bg-airbus-red',
    orange: 'bg-airbus-orange',
    green: 'bg-airbus-green',
    gray: 'bg-gray-400',
  };

  return (
    <div className="card flex items-center gap-3 py-3">
      <div
        className={`${colorMap[color]} w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-gray-800">{value}</p>
        <p className="text-[11px] text-gray-500 leading-tight truncate">{label}</p>
      </div>
    </div>
  );
}

// ============================================================
// FilterChip
// ============================================================
function FilterChip({
  active,
  onClick,
  children,
  count,
  color = 'default',
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
  color?: 'default' | 'blue' | 'green' | 'orange' | 'red';
  icon?: React.ReactNode;
}) {
  const activeColor = {
    default: 'bg-airbus-blue text-white border-airbus-blue',
    blue: 'bg-airbus-sky text-white border-airbus-sky',
    green: 'bg-airbus-green text-white border-airbus-green',
    orange: 'bg-airbus-orange text-white border-airbus-orange',
    red: 'bg-airbus-red text-white border-airbus-red',
  }[color];

  const countColor = active
    ? 'bg-white/20 text-white'
    : 'bg-gray-200 text-gray-500';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        active
          ? activeColor
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${countColor}`}>
        {count}
      </span>
    </button>
  );
}