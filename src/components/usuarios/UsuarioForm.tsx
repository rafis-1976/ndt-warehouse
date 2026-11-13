import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, Hash, Mail, User as UserIcon,
  ShieldCheck, UserCog, UserCheck, Power, KeyRound,
  Eye, EyeOff, Sparkles, Copy, Check, Send, Lock, AlertTriangle,
} from 'lucide-react';

// ============================================================
// Tipos
// ============================================================
type Rol = 'admin' | 'supervisor' | 'tecnico';

interface UsuarioFormProps {
  perfil: any;
  onSuccess: () => void;
  onCancel: () => void;
}

// ============================================================
// Opciones de rol con iconos
// ============================================================
const roles: {
  value: Rol;
  label: string;
  descripcion: string;
  icon: any;
  color: string;
}[] = [
  {
    value: 'admin',
    label: 'Administrador',
    descripcion: 'Control total del sistema y usuarios',
    icon: ShieldCheck,
    color: 'text-airbus-red bg-airbus-red/10 border-airbus-red/30',
  },
  {
    value: 'supervisor',
    label: 'Supervisor',
    descripcion: 'Gestión de equipos, préstamos y calibraciones',
    icon: UserCog,
    color: 'text-airbus-orange bg-airbus-orange/10 border-airbus-orange/30',
  },
  {
    value: 'tecnico',
    label: 'Técnico',
    descripcion: 'Consulta y préstamos propios',
    icon: UserCheck,
    color: 'text-airbus-green bg-airbus-green/10 border-airbus-green/30',
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

  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// ============================================================
// Componente
// ============================================================
export function UsuarioForm({ perfil, onSuccess, onCancel }: UsuarioFormProps) {
  const [form, setForm] = useState({
    num_nomina: perfil.num_nomina ?? '',
    nombre_completo: perfil.nombre_completo ?? '',
    email: perfil.email ?? '',
    telefono: perfil.telefono ?? '',
    rol: perfil.rol ?? 'tecnico',
    activo: perfil.activo ?? true,
    password: '', // NUEVO: campo opcional
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estado para el email de recuperación
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  // Estado para la pantalla de confirmación de contraseña
  const [nuevaPassword, setNuevaPassword] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleGenerarPassword = () => {
    update('password', generarPasswordSegura());
    setShowPassword(true);
  };

  // ============================================================
  // Enviar email de recuperación (alternativa al cambio directo)
  // ============================================================
  const handleEnviarEmail = async () => {
    setError('');
    setEnviandoEmail(true);
    setEmailEnviado(false);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        form.email,
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (resetErr) throw resetErr;
      setEmailEnviado(true);
      setTimeout(() => setEmailEnviado(false), 6000);
    } catch (err: any) {
      setError(err.message ?? 'No se pudo enviar el email de recuperación');
    } finally {
      setEnviandoEmail(false);
    }
  };

  // ============================================================
  // Enviar formulario
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (!form.num_nomina.trim()) {
      return setError('El Nº de nómina es obligatorio');
    }
    if (!/^\d+$/.test(form.num_nomina.trim())) {
      return setError('El Nº de nómina solo puede contener dígitos');
    }
    if (!form.nombre_completo.trim()) {
      return setError('El nombre completo es obligatorio');
    }
    if (!form.email.trim()) {
      return setError('El email es obligatorio');
    }
    // Validar contraseña SOLO si se ha rellenado
    if (form.password && form.password.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres');
    }

    setLoading(true);

    try {
      // 1. Actualizar el perfil
      const payload = {
        num_nomina: form.num_nomina.trim(),
        nombre_completo: form.nombre_completo.trim(),
        telefono: form.telefono.trim() || null,
        rol: form.rol,
        activo: form.activo,
      };

      const { error: updErr } = await supabase
        .from('perfiles')
        .update(payload)
        .eq('id', perfil.id);
      if (updErr) throw updErr;

      // 2. Si el admin rellenó contraseña, resetearla vía Edge Function
      if (form.password.trim()) {
        const { data, error: fnError } = await supabase.functions.invoke(
          'resetear-password',
          {
            body: {
              user_id: perfil.id,
              password: form.password,
            },
          }
        );

        if (fnError) {
          const body = await (fnError as any).context?.json?.().catch(() => null);
          const msg = body?.error ?? fnError.message ?? '';
          if (
            msg.includes('non-2xx') ||
            msg.includes('Failed to send') ||
            msg.includes('Failed to fetch')
          ) {
            throw new Error(
              'El perfil se actualizó, pero no se pudo cambiar la contraseña. Verifica que la Edge Function "resetear-password" esté desplegada en Supabase.'
            );
          }
          throw new Error(`El perfil se actualizó, pero no se pudo cambiar la contraseña: ${msg}`);
        }
        if (data?.error) {
          throw new Error(`El perfil se actualizó, pero no se pudo cambiar la contraseña: ${data.error}`);
        }

        // Mostrar la nueva contraseña al admin en una pantalla de confirmación
        setNuevaPassword(form.password);
        return; // NO cerramos el modal todavía
      }

      // Sin cambio de contraseña: cerrar directamente
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('perfiles_num_nomina_key')) {
        setError('Ya existe un usuario con ese Nº de nómina');
      } else if (msg.includes('row-level security')) {
        setError('No tienes permisos para editar este usuario');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // PANTALLA DE CONFIRMACIÓN DE NUEVA CONTRASEÑA
  // ============================================================
  if (nuevaPassword) {
    return (
      <div className="space-y-5">
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto bg-airbus-green/10 rounded-full flex items-center justify-center mb-3">
            <Check className="w-8 h-8 text-airbus-green" />
          </div>
          <h3 className="text-lg font-bold text-airbus-blue mb-1">
            Usuario actualizado
          </h3>
          <p className="text-sm text-gray-500">
            La contraseña se ha cambiado correctamente
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Nueva contraseña
          </p>

          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-airbus-blue shrink-0" />
            <code className="flex-1 font-mono font-bold text-airbus-blue bg-airbus-yellow/30 px-3 py-2 rounded break-all">
              {nuevaPassword}
            </code>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-airbus-orange shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              Guarda esta contraseña ahora.{' '}
              <strong>No se mostrará de nuevo.</strong> Compártela con el
              usuario por un canal seguro (no por email sin cifrar).
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(nuevaPassword);
              setCopiada(true);
              setTimeout(() => setCopiada(false), 2000);
            }}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {copiada ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copiada ? 'Copiada al portapapeles' : 'Copiar contraseña'}
          </button>
          <button
            type="button"
            onClick={onSuccess}
            className="btn-primary flex-1"
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // FORMULARIO
  // ============================================================
  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Cabecera con avatar */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl text-white">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold shrink-0">
          {form.nombre_completo
            ? form.nombre_completo
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
            : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-lg truncate">
            {form.nombre_completo || 'Sin nombre'}
          </p>
          <p className="text-xs text-airbus-light opacity-90 truncate">
            {form.email}
          </p>
          {form.num_nomina && (
            <p className="text-xs text-airbus-light opacity-90 font-mono flex items-center gap-1 mt-0.5">
              <Hash className="w-3 h-3" />
              {form.num_nomina}
            </p>
          )}
        </div>
      </div>

      {/* ============================================================
          DATOS BÁSICOS
          ============================================================ */}
      <Section title="Datos básicos">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nº de nómina *">
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 font-mono"
                value={form.num_nomina}
                onChange={(e) =>
                  update('num_nomina', e.target.value.replace(/\D/g, ''))
                }
                placeholder="471796"
                maxLength={10}
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Solo dígitos, sin espacios
            </p>
          </Field>

          <Field label="Teléfono">
            <input
              className="input"
              value={form.telefono}
              onChange={(e) => update('telefono', e.target.value)}
              placeholder="+34 600 000 000"
            />
          </Field>

          <Field label="Nombre completo *">
            <input
              className="input"
              value={form.nombre_completo}
              onChange={(e) => update('nombre_completo', e.target.value)}
              placeholder="R. Sánchez Ce"
              required
            />
          </Field>

          <Field label="Email *">
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 bg-gray-50 text-gray-500 cursor-not-allowed"
                value={form.email}
                disabled
                title="El email se gestiona desde Supabase Auth"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              El email no puede modificarse desde aquí
            </p>
          </Field>
        </div>
      </Section>

      {/* ============================================================
          CONTRASEÑA (NUEVA SECCIÓN)
          ============================================================ */}
      <Section title="Contraseña">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Dejar vacío para no cambiar"
                autoComplete="new-password"
                className={`input pl-10 pr-10 font-mono ${
                  form.password && form.password.length < 8
                    ? 'border-airbus-red focus:ring-airbus-red'
                    : form.password && form.password.length >= 8
                      ? 'border-airbus-green'
                      : ''
                }`}
              />
              {form.password && (
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
              )}
            </div>
            <button
              type="button"
              onClick={handleGenerarPassword}
              className="btn-secondary whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generar
            </button>
          </div>

          {/* Indicador de fortaleza */}
          {form.password && (
            <div className="flex items-center gap-3">
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

          {/* Aviso sobre contraseña actual */}
          <div className="bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              La contraseña actual <strong>no se puede mostrar</strong> (está
              hasheada con bcrypt). Solo puedes asignar una nueva. Si dejas el
              campo vacío, se mantiene la actual.
            </p>
          </div>

          {/* Botón de enviar email de recuperación */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleEnviarEmail}
              disabled={enviandoEmail}
              className="btn-ghost border border-gray-300 flex items-center gap-2 text-xs"
            >
              {enviandoEmail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {enviandoEmail
                ? 'Enviando...'
                : 'Enviar enlace de recuperación por email'}
            </button>
            {emailEnviado && (
              <span className="text-xs text-airbus-green flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Email enviado a {form.email}
              </span>
            )}
          </div>
        </div>
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
                className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border-2 transition ${
                  activo
                    ? `${r.color} border-current`
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    activo ? 'bg-white/60' : 'bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{r.label}</p>
                  <p className="text-xs opacity-70">{r.descripcion}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                    activo ? 'border-current bg-current' : 'border-gray-300'
                  }`}
                >
                  {activo && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ============================================================
          ESTADO
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
                ? 'El usuario puede iniciar sesión y usar el sistema'
                : 'El usuario no puede iniciar sesión'}
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
          INFO MFA (solo lectura)
          ============================================================ */}
      <div className="bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3 flex items-start gap-2">
        <KeyRound className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
        <div className="text-xs text-gray-600">
          <p className="font-medium text-airbus-blue">
            Autenticación en dos pasos (MFA)
          </p>
          <p className="mt-0.5 opacity-80">
            Cada usuario activa su propio MFA desde su perfil. Como administrador
            puedes resetearlo desde el panel de Supabase Auth si es necesario.
          </p>
        </div>
      </div>

      {/* ============================================================
          ERROR
          ============================================================ */}
      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* ============================================================
          BOTONES
          ============================================================ */}
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost border border-gray-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading
            ? 'Guardando...'
            : form.password
              ? 'Guardar y cambiar contraseña'
              : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Sub-componentes
// ============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-airbus-blue uppercase tracking-wider mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}