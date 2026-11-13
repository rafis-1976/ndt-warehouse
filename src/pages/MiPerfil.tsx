import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePerfil } from '../hooks/usePerfil';
import {
  ArrowLeft, User as UserIcon, Mail, Hash, Phone, ShieldCheck,
  UserCog, UserCheck, Lock, Eye, EyeOff, Save, Loader2,
  AlertCircle, CheckCircle2, KeyRound, AlertTriangle, Send,
} from 'lucide-react';

// ============================================================
// Info de cada rol
// ============================================================
const rolInfo = {
  admin: {
    label: 'Administrador',
    icon: ShieldCheck,
    color: 'text-airbus-red bg-airbus-red/10 border-airbus-red/30',
  },
  supervisor: {
    label: 'Supervisor',
    icon: UserCog,
    color: 'text-airbus-orange bg-airbus-orange/10 border-airbus-orange/30',
  },
  tecnico: {
    label: 'Técnico',
    icon: UserCheck,
    color: 'text-airbus-green bg-airbus-green/10 border-airbus-green/30',
  },
} as const;

// ============================================================
// Componente
// ============================================================
export function MiPerfil() {
  const { perfil, loading: loadingPerfil } = usePerfil();
  const navigate = useNavigate();

  // --- Datos personales ---
  const [formDatos, setFormDatos] = useState({ nombre_completo: '', telefono: '' });
  const [savingDatos, setSavingDatos] = useState(false);
  const [datosError, setDatosError] = useState('');
  const [datosOk, setDatosOk] = useState(false);

  // --- Contraseña (cambio con actual) ---
  const [pwdForm, setPwdForm] = useState({ current: '', nueva: '', confirmar: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdOk, setPwdOk] = useState(false);

  // --- Recuperación por email ---
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  useEffect(() => {
    if (perfil) {
      setFormDatos({
        nombre_completo: perfil.nombre_completo ?? '',
        telefono: perfil.telefono ?? '',
      });
    }
  }, [perfil]);

  const datosValidos = formDatos.nombre_completo.trim().length >= 3;

  const pwdValida =
    pwdForm.current.length >= 1 &&
    pwdForm.nueva.length >= 8 &&
    pwdForm.nueva === pwdForm.confirmar;

  // ------------------------------------------------------------
  // Guardar datos personales
  // ------------------------------------------------------------
  const handleGuardarDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    setDatosError('');
    setDatosOk(false);

    if (!datosValidos) {
      return setDatosError('El nombre debe tener al menos 3 caracteres');
    }

    setSavingDatos(true);
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({
          nombre_completo: formDatos.nombre_completo.trim(),
          telefono: formDatos.telefono.trim() || null,
        })
        .eq('id', perfil!.id);
      if (error) throw error;

      setDatosOk(true);
      setTimeout(() => setDatosOk(false), 4000);
    } catch (err: any) {
      setDatosError(err.message ?? 'Error al guardar los datos');
    } finally {
      setSavingDatos(false);
    }
  };

  // ------------------------------------------------------------
  // Cambiar contraseña con la actual
  // ------------------------------------------------------------
  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdOk(false);

    if (!pwdForm.current) return setPwdError('Introduce tu contraseña actual');
    if (pwdForm.nueva.length < 8) {
      return setPwdError('La nueva contraseña debe tener al menos 8 caracteres');
    }
    if (pwdForm.nueva !== pwdForm.confirmar) {
      return setPwdError('Las contraseñas nuevas no coinciden');
    }

    setSavingPwd(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: perfil!.email,
        password: pwdForm.current,
      });
      if (signInError) {
        throw new Error('La contraseña actual es incorrecta');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: pwdForm.nueva,
      });
      if (updateError) throw updateError;

      setPwdOk(true);
      setPwdForm({ current: '', nueva: '', confirmar: '' });
      setTimeout(() => setPwdOk(false), 6000);
    } catch (err: any) {
      setPwdError(err.message ?? 'Error al cambiar la contraseña');
    } finally {
      setSavingPwd(false);
    }
  };

  // ------------------------------------------------------------
  // Enviar enlace de recuperación por email
  // ------------------------------------------------------------
  const handleEnviarEmail = async () => {
    setPwdError('');
    setEmailEnviado(false);
    setEnviandoEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        perfil!.email,
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (error) throw error;

      setEmailEnviado(true);
      setTimeout(() => setEmailEnviado(false), 15000);
    } catch (err: any) {
      setPwdError(
        err.message ??
          'No se pudo enviar el email. Contacta con un administrador.'
      );
    } finally {
      setEnviandoEmail(false);
    }
  };

  // ------------------------------------------------------------
  // Loading / sin perfil
  // ------------------------------------------------------------
  if (loadingPerfil) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando tu perfil...
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card text-center py-12">
          <AlertCircle className="w-10 h-10 text-airbus-red mx-auto mb-3" />
          <p className="text-gray-700">No se ha encontrado tu perfil</p>
        </div>
      </div>
    );
  }

  const rol = rolInfo[perfil.rol];
  const RolIcon = rol.icon;
  const iniciales = perfil.nombre_completo
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-airbus-blue">Mi perfil</h1>
          <p className="text-sm text-gray-500">
            Consulta tus datos y gestiona tu contraseña
          </p>
        </div>
      </div>

      {/* Tarjeta de identidad */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-airbus-blue to-airbus-navy text-white flex items-center justify-center text-2xl font-bold shrink-0">
            {iniciales}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-gray-800">
              {perfil.nombre_completo}
            </h2>
            <p className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-1">
              <Mail className="w-3.5 h-3.5" />
              {perfil.email}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${rol.color}`}
              >
                <RolIcon className="w-3.5 h-3.5" />
                {rol.label}
              </span>
              {perfil.num_nomina && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-airbus-blue/10 text-airbus-blue border border-airbus-blue/30">
                  <Hash className="w-3.5 h-3.5" />
                  {perfil.num_nomina}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                  perfil.activo
                    ? 'bg-airbus-green/10 text-airbus-green border-airbus-green/30'
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                }`}
              >
                {perfil.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          DATOS PERSONALES
          ============================================================ */}
      <form onSubmit={handleGuardarDatos} className="card space-y-4">
        <h3 className="text-xs font-semibold text-airbus-blue uppercase tracking-wider">
          Datos personales
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nº de nómina
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 bg-gray-50 text-gray-500 cursor-not-allowed font-mono"
                value={perfil.num_nomina ?? ''}
                disabled
                title="El nº de nómina solo lo puede modificar un administrador"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10 bg-gray-50 text-gray-500 cursor-not-allowed"
                value={perfil.email}
                disabled
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className={`input pl-10 ${
                  formDatos.nombre_completo &&
                  formDatos.nombre_completo.trim().length < 3
                    ? 'border-airbus-red'
                    : ''
                }`}
                value={formDatos.nombre_completo}
                onChange={(e) =>
                  setFormDatos((f) => ({ ...f, nombre_completo: e.target.value }))
                }
                placeholder="Tu nombre completo"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10"
                value={formDatos.telefono}
                onChange={(e) =>
                  setFormDatos((f) => ({ ...f, telefono: e.target.value }))
                }
                placeholder="+34 600 000 000"
              />
            </div>
          </div>
        </div>

        {datosError && (
          <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{datosError}</span>
          </div>
        )}

        {datosOk && (
          <div className="flex items-center gap-2 bg-airbus-green/10 border border-airbus-green/20 text-airbus-green text-sm p-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Datos actualizados correctamente</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingDatos || !datosValidos}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingDatos ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingDatos ? 'Guardando...' : 'Guardar datos'}
          </button>
        </div>
      </form>

      {/* ============================================================
          CAMBIAR CONTRASEÑA + RECUPERAR POR EMAIL
          ============================================================ */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-airbus-blue" />
          <h3 className="text-xs font-semibold text-airbus-blue uppercase tracking-wider">
            Contraseña
          </h3>
        </div>

        {/* ---- Opción A: cambio con contraseña actual ---- */}
        <form onSubmit={handleCambiarPassword} className="space-y-3">
          <p className="text-xs text-gray-500">
            <strong>Opción 1:</strong> Cambiar tu contraseña introduciendo la actual.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña actual *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showCurrent ? 'text' : 'password'}
                className="input pl-10 pr-10"
                value={pwdForm.current}
                onChange={(e) =>
                  setPwdForm((f) => ({ ...f, current: e.target.value }))
                }
                placeholder="Tu contraseña actual"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded"
              >
                {showCurrent ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showNueva ? 'text' : 'password'}
                  className={`input pl-10 pr-10 ${
                    pwdForm.nueva && pwdForm.nueva.length < 8
                      ? 'border-airbus-red'
                      : ''
                  }`}
                  value={pwdForm.nueva}
                  onChange={(e) =>
                    setPwdForm((f) => ({ ...f, nueva: e.target.value }))
                  }
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNueva(!showNueva)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded"
                >
                  {showNueva ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showConfirmar ? 'text' : 'password'}
                  className={`input pl-10 pr-10 ${
                    pwdForm.confirmar && pwdForm.confirmar !== pwdForm.nueva
                      ? 'border-airbus-red'
                      : ''
                  }`}
                  value={pwdForm.confirmar}
                  onChange={(e) =>
                    setPwdForm((f) => ({ ...f, confirmar: e.target.value }))
                  }
                  placeholder="Repite la nueva"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmar(!showConfirmar)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded"
                >
                  {showConfirmar ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {pwdError && (
            <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{pwdError}</span>
            </div>
          )}

          {pwdOk && (
            <div className="flex items-center gap-2 bg-airbus-green/10 border border-airbus-green/20 text-airbus-green text-sm p-3 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Contraseña cambiada correctamente</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingPwd || !pwdValida}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPwd ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {savingPwd ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>

        {/* ---- Divisor ---- */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              o
            </span>
          </div>
        </div>

        {/* ---- Opción B: recuperar por email ---- */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            <strong>Opción 2:</strong> Recibir un enlace por email para crear una
            nueva contraseña (útil si no recuerdas la actual).
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={handleEnviarEmail}
              disabled={enviandoEmail || emailEnviado}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition ${
                emailEnviado
                  ? 'bg-airbus-green/10 border-airbus-green/30 text-airbus-green'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-airbus-blue hover:bg-airbus-blue/5'
              } disabled:opacity-60`}
            >
              {enviandoEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : emailEnviado ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {enviandoEmail
                ? 'Enviando...'
                : emailEnviado
                  ? 'Email enviado'
                  : 'Enviar enlace por email'}
            </button>

            {emailEnviado && (
              <p className="text-xs text-gray-500">
                Revisa la bandeja de <strong>{perfil.email}</strong> (mira también
                el spam).
              </p>
            )}
          </div>

          <div className="bg-airbus-orange/5 border border-airbus-orange/20 rounded-lg p-3 flex items-start gap-2 mt-2">
            <AlertTriangle className="w-4 h-4 text-airbus-orange shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              El enlace caduca en 1 hora. Si no lo ves en tu bandeja, revisa la
              carpeta de spam o vuelve a solicitar uno nuevo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}