import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Plane,
} from 'lucide-react';

export function ResetPassword() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [listo, setListo] = useState(false);
  const [pwd, setPwd] = useState({ nueva: '', confirmar: '' });
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // El cliente Supabase (con detectSessionInUrl:true) procesa el token
    // del hash de la URL y emite el evento PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setListo(true);
          setChecking(false);
        }
      }
    );

    // Fallback: si el link ya se procesó al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setListo(true);
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pwd.nueva.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres');
    }
    if (pwd.nueva !== pwd.confirmar) {
      return setError('Las contraseñas no coinciden');
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: pwd.nueva,
      });
      if (updateError) throw updateError;

      setOk(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2500);
    } catch (err: any) {
      setError(err.message ?? 'Error al actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  // --- Verificando enlace ---
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-airbus-blue mx-auto mb-2" />
          <p className="text-sm text-gray-500">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // --- Enlace inválido / expirado ---
  if (!listo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-airbus-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-airbus-red" />
          </div>
          <h1 className="text-xl font-bold text-airbus-blue mb-2">
            Enlace inválido o expirado
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            El enlace de recuperación no es válido o ha caducado. Solicita uno
            nuevo desde tu perfil o desde la pantalla de login.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary w-full"
          >
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  // --- Éxito ---
  if (ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-airbus-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-airbus-green" />
          </div>
          <h1 className="text-xl font-bold text-airbus-blue mb-2">
            Contraseña actualizada
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Tu contraseña se ha cambiado correctamente. Redirigiendo...
          </p>
          <Loader2 className="w-5 h-5 animate-spin text-airbus-blue mx-auto" />
        </div>
      </div>
    );
  }

  // --- Formulario ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-airbus-blue via-airbus-navy to-airbus-blue p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-airbus-blue rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Plane className="w-9 h-9 text-airbus-light" />
          </div>
          <h1 className="text-2xl font-bold text-airbus-blue tracking-tight">
            Nueva contraseña
          </h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Introduce tu nueva contraseña para acceder al sistema
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showNueva ? 'text' : 'password'}
                value={pwd.nueva}
                onChange={(e) =>
                  setPwd((p) => ({ ...p, nueva: e.target.value }))
                }
                className="input pl-10 pr-10"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
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
              Confirmar nueva contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={pwd.confirmar}
                onChange={(e) =>
                  setPwd((p) => ({ ...p, confirmar: e.target.value }))
                }
                className="input pl-10 pr-10"
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
                required
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

          {error && (
            <div className="bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !pwd.nueva || !pwd.confirmar}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {saving ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}