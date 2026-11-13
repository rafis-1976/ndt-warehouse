import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, Hash, Mail, User as UserIcon,
  ShieldCheck, UserCog, UserCheck, Power, KeyRound,
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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ============================================================
  // Enviar
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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

    setLoading(true);

    try {
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
  // Render
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
          {error}
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
          Guardar cambios
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