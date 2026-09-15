import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Loader2, UserPlus, AlertCircle, Hash, Mail, Lock, ShieldCheck,
  UserCog, UserCheck, Power, Eye, EyeOff, CheckCircle2, ArrowLeft,
  Phone, User, X, Sparkles,
} from 'lucide-react';

// ============================================================
// Tipos
// ============================================================
type Rol = 'admin' | 'supervisor' | 'tecnico';

const roles: {
  value: Rol;
  label: string;
  descripcion: string;
  icon: any;
  color: string;
  activoColor: string;
}[] = [
  {
    value: 'admin',
    label: 'Administrador',
    descripcion: 'Control total del sistema, usuarios y configuración',
    icon: ShieldCheck,
    color: 'text-airbus-red',
    activoColor: 'bg-airbus-red/10 border-airbus-red text-airbus-red',
  },
  {
    value: 'supervisor',
    label: 'Supervisor',
    descripcion: 'Gestión de equipos, préstamos, calibraciones y movimientos',
    icon: UserCog,
    color: 'text-airbus-orange',
    activoColor: 'bg-airbus-orange/10 border-airbus-orange text-airbus-orange',
  },
  {
    value: 'tecnico',
    label: 'Técnico',
    descripcion: 'Consulta de equipos y gestión de préstamos propios',
    icon: UserCheck,
    color: 'text-airbus-green',
    activoColor: 'bg-airbus-green/10 border-airbus-green text-airbus-green',
  },
];

// ============================================================
// Generador de contraseñas seguras
// ============================================================
function generarPasswordSegura(): string {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const simbolos = '!@#$%&*';
  const todos = mayus + minus + nums + simbolos;

  let pwd = '';
  pwd += mayus.charAt(Math.floor(Math.random() * mayus.length));
  pwd += minus.charAt(Math.floor(Math.random() * minus.length));
  pwd += nums.charAt(Math.floor(Math.random() * nums.length));
  pwd += simbolos.charAt(Math.floor(Math.random() * simbolos.length));

  for (let i = pwd.length; i < 14; i++) {
    pwd += todos.charAt(Math.floor(Math.random() * todos.length));
  }

  return pwd
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

// ============================================================
// Componente principal
// ============================================================
export function UsuarioNuevo() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    num_nomina: '',
    nombre_completo: '',
    email: '',
    telefono: '',
    password: '',
    rol: 'tecnico' as Rol,
    activo: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any | null>(null);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleGenerarPassword = () => {
    update('password', generarPasswordSegura());
    setShowPassword(true);
  };

  // ============================================================
  // Validaciones
  // ============================================================
  const validaciones = {
    nomina:
      form.num_nomina.trim().length >= 3 && /^\d+$/.test(form.num_nomina.trim()),
    nombre: form.nombre_completo.trim().length >= 3,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
    password: form.password.length >= 8,
  };

  const formularioValido = Object.values(validaciones).every(Boolean);
  const hayDatosIntroducidos =
    form.num_nomina !== '' ||
    form.nombre_completo !== '' ||
    form.email !== '' ||
    form.password !== '';

  // ============================================================
  // Enviar
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (!validaciones.nomina)
      return setError('Nº de nómina inválido (mínimo 3 dígitos)');
    if (!validaciones.nombre)
      return setError('El nombre debe tener al menos 3 caracteres');
    if (!validaciones.email) return setError('Email inválido');
    if (!validaciones.password)
      return setError('La contraseña debe tener al menos 8 caracteres');

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'crear-usuario',
        {
          body: {
            email: form.email.trim().toLowerCase(),
            password: form.password,
            num_nomina: form.num_nomina.trim(),
            nombre_completo: form.nombre_completo.trim(),
            telefono: form.telefono.trim() || null,
            rol: form.rol,
            activo: form.activo,
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setSuccess({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        num_nomina: form.num_nomina.trim(),
        nombre_completo: form.nombre_completo.trim(),
        rol: form.rol,
      });
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('Ya existe un usuario con ese email');
      } else if (
        msg.includes('perfiles_num_nomina_key') ||
        msg.includes('num_nomina')
      ) {
        setError('Ya existe un usuario con ese Nº de nómina');
      } else if (msg.includes('Solo administradores')) {
        setError('Solo los administradores pueden crear usuarios');
      } else if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
        setError(
          'No se pudo conectar con el servidor. Verifica que la Edge Function "crear-usuario" esté desplegada en Supabase.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetFormulario = () => {
    setForm({
      num_nomina: '',
      nombre_completo: '',
      email: '',
      telefono: '',
      password: '',
      rol: 'tecnico',
      activo: true,
    });
    setSuccess(null);
    setError('');
    setShowPassword(false);
  };

  // ============================================================
  // Pantalla de éxito
  // ============================================================
  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card text-center py-10">
          <div className="w-20 h-20 mx-auto bg-airbus-green/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-airbus-green" />
          </div>

          <h2 className="text-2xl font-bold text-airbus-blue mb-2">
            Usuario creado correctamente
          </h2>
          <p className="text-gray-600 mb-6">
            El usuario ya puede iniciar sesión en el sistema
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-left max-w-md mx-auto mb-6">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Credenciales de acceso
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-airbus-blue shrink-0" />
                <span className="text-xs text-gray-500 w-20">Nómina:</span>
                <span className="font-mono font-bold text-airbus-blue">
                  {success.num_nomina}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-airbus-blue shrink-0" />
                <span className="text-xs text-gray-500 w-20">Nombre:</span>
                <span className="font-medium text-gray-800">
                  {success.nombre_completo}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-airbus-blue shrink-0" />
                <span className="text-xs text-gray-500 w-20">Email:</span>
                <span className="font-mono text-gray-800 break-all">
                  {success.email}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-airbus-blue shrink-0" />
                <span className="text-xs text-gray-500 w-20">Contraseña:</span>
                <span className="font-mono bg-airbus-yellow/30 px-2 py-0.5 rounded text-gray-800">
                  {success.password}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-airbus-orange shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600">
                Guarda estas credenciales ahora. La contraseña{' '}
                <strong>no se mostrará de nuevo</strong>. Compártela con el
                usuario por un canal seguro.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Nómina: ${success.num_nomina}\nNombre: ${success.nombre_completo}\nEmail: ${success.email}\nContraseña: ${success.password}`
                );
              }}
              className="btn-ghost border border-gray-300 flex items-center justify-center gap-2"
            >
              📋 Copiar credenciales
            </button>
            <button
              onClick={resetFormulario}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Crear otro usuario
            </button>
            <button
              onClick={() => navigate('/usuarios')}
              className="btn-primary flex items-center justify-center gap-2"
            >
              Ver usuarios
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Formulario
  // ============================================================
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      {/* ============================================================
          CABECERA
          ============================================================ */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/usuarios')}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Volver a usuarios"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-airbus-blue">Alta de Usuario</h1>
          <p className="text-sm text-gray-500">
            Crea una nueva cuenta de acceso al sistema NDT
          </p>
        </div>
        <div className="hidden sm:flex w-12 h-12 bg-airbus-blue rounded-xl items-center justify-center">
          <UserPlus className="w-6 h-6 text-airbus-light" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">

        {/* ============================================================
            PREVIEW DEL USUARIO (solo aparece cuando hay datos)
            ============================================================ */}
        {hayDatosIntroducidos ? (
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl text-white animate-in">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold shrink-0">
              {form.nombre_completo ? (
                form.nombre_completo
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              ) : (
                <UserPlus className="w-7 h-7" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-lg truncate">
                {form.nombre_completo || 'Sin nombre todavía'}
              </p>
              <p className="text-xs text-airbus-light opacity-90 truncate">
                {form.email || 'Sin email todavía'}
              </p>
              {form.num_nomina && (
                <p className="text-xs text-airbus-light opacity-90 font-mono flex items-center gap-1 mt-0.5">
                  <Hash className="w-3 h-3" />
                  {form.num_nomina}
                </p>
              )}
            </div>
            {form.num_nomina &&
              form.nombre_completo &&
              form.email &&
              form.password && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-medium shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Listo para crear
                </div>
              )}
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl text-white">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-7 h-7 text-white/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base">Nuevo usuario</p>
              <p className="text-xs text-airbus-light opacity-75">
                Rellena los campos para dar de alta una nueva cuenta
              </p>
            </div>
          </div>
        )}

        {/* ============================================================
            DATOS DEL USUARIO
            ============================================================ */}
        <Section title="Datos del usuario">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nº de nómina *">
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`input pl-10 font-mono ${
                    form.num_nomina && !validaciones.nomina
                      ? 'border-airbus-red focus:ring-airbus-red'
                      : form.num_nomina && validaciones.nomina
                        ? 'border-airbus-green'
                        : ''
                  }`}
                  value={form.num_nomina}
                  onChange={(e) =>
                    update('num_nomina', e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="471796"
                  maxLength={10}
                  autoFocus
                  required
                />
                {form.num_nomina && validaciones.nomina && (
                  <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-airbus-green" />
                )}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Solo dígitos, sin espacios (ej: 471796)
              </p>
            </Field>

            <Field label="Teléfono">
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-10"
                  value={form.telefono}
                  onChange={(e) => update('telefono', e.target.value)}
                  placeholder="+34 600 000 000"
                />
              </div>
            </Field>

            <Field label="Nombre completo *">
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`input pl-10 ${
                    form.nombre_completo && !validaciones.nombre
                      ? 'border-airbus-red focus:ring-airbus-red'
                      : ''
                  }`}
                  value={form.nombre_completo}
                  onChange={(e) => update('nombre_completo', e.target.value)}
                  placeholder="R. Sánchez Ce"
                  required
                />
              </div>
            </Field>

            <Field label="Email corporativo *">
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  className={`input pl-10 ${
                    form.email && !validaciones.email
                      ? 'border-airbus-red focus:ring-airbus-red'
                      : form.email && validaciones.email
                        ? 'border-airbus-green'
                        : ''
                  }`}
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="usuario@iberia.es"
                  required
                />
                {form.email && validaciones.email && (
                  <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-airbus-green" />
                )}
              </div>
            </Field>
          </div>
        </Section>

        {/* ============================================================
            CONTRASEÑA
            ============================================================ */}
        <Section title="Contraseña inicial">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`input pl-10 pr-10 font-mono ${
                  form.password && !validaciones.password
                    ? 'border-airbus-red'
                    : form.password && validaciones.password
                      ? 'border-airbus-green'
                      : ''
                }`}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded"
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleGenerarPassword}
              className="btn-secondary whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generar segura
            </button>
          </div>

          {/* Indicador de fortaleza */}
          {form.password && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    form.password.length >= 12
                      ? 'bg-airbus-green w-full'
                      : form.password.length >= 8
                        ? 'bg-airbus-orange w-2/3'
                        : 'bg-airbus-red w-1/3'
                  }`}
                />
              </div>
              <span
                className={`text-[11px] font-bold ${
                  form.password.length >= 12
                    ? 'text-airbus-green'
                    : form.password.length >= 8
                      ? 'text-airbus-orange'
                      : 'text-airbus-red'
                }`}
              >
                {form.password.length >= 12
                  ? 'Fuerte'
                  : form.password.length >= 8
                    ? 'Aceptable'
                    : 'Débil'}
              </span>
            </div>
          )}

          <p className="mt-2 text-[11px] text-gray-400 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Comparte esta contraseña con el usuario por un canal seguro. Podrá
            cambiarla en su primer inicio de sesión.
          </p>
        </Section>

        {/* ============================================================
            ROL
            ============================================================ */}
        <Section title="Rol y permisos">
          <div className="space-y-2">
            {roles.map((r) => {
              const Icon = r.icon;
              const activo = form.rol === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => update('rol', r.value)}
                  className={`w-full text-left flex items-start gap-3 p-3.5 rounded-lg border-2 transition ${
                    activo
                      ? r.activoColor
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      activo ? 'bg-white/60' : 'bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${activo ? '' : r.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      {r.descripcion}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center ${
                      activo ? 'border-current bg-current' : 'border-gray-300'
                    }`}
                  >
                    {activo && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ============================================================
            ESTADO INICIAL
            ============================================================ */}
        <Section title="Estado de la cuenta">
          <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
            <Power
              className={`w-5 h-5 shrink-0 ${
                form.activo ? 'text-airbus-green' : 'text-gray-400'
              }`}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">
                {form.activo ? 'Cuenta activa' : 'Cuenta inactiva'}
              </p>
              <p className="text-xs text-gray-500">
                {form.activo
                  ? 'El usuario podrá iniciar sesión inmediatamente'
                  : 'El usuario no podrá iniciar sesión hasta que se active'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => update('activo', !form.activo)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                form.activo ? 'bg-airbus-green' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={form.activo}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  form.activo ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Section>

        {/* ============================================================
            ERROR
            ============================================================ */}
        {error && (
          <div className="flex items-start gap-3 bg-airbus-red/10 border border-airbus-red/30 text-airbus-red text-sm p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">No se pudo crear el usuario</p>
              <p className="mt-0.5 opacity-90 text-xs">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="p-1 hover:bg-airbus-red/10 rounded-full shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================
            BOTONES
            ============================================================ */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 order-2 sm:order-1">
            {!formularioValido && (
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Completa todos los campos obligatorios
              </span>
            )}
            {formularioValido && (
              <span className="flex items-center gap-1.5 text-airbus-green">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Todo listo para crear el usuario
              </span>
            )}
          </div>

          <div className="flex justify-end gap-3 order-1 sm:order-2">
            <button
              type="button"
              onClick={() => navigate('/usuarios')}
              className="btn-ghost border border-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formularioValido}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {loading ? 'Creando usuario...' : 'Crear usuario'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-airbus-blue uppercase tracking-wider mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}