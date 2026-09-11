import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Plane, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [showMFA, setShowMFA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, verifyMFA } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified');

      if (verifiedTotp) {
        setFactorId(verifiedTotp.id);
        setShowMFA(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError('');
    setLoading(true);
    try {
      await verifyMFA(factorId, mfaCode);
      navigate('/dashboard');
    } catch (err: any) {
      setError('Código incorrecto. Inténtalo de nuevo.');
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-airbus-blue via-airbus-navy to-airbus-blue p-4">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none">
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-airbus-light blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-96 h-96 rounded-full bg-airbus-sky blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {/* Cabecera */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-airbus-blue rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Plane className="w-9 h-9 text-airbus-light" />
          </div>
          <h1 className="text-2xl font-bold text-airbus-blue tracking-tight">
            NDT WAREHOUSE
          </h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Gestión de Ensayos No Destructivos
          </p>
        </div>

        {!showMFA ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="usuario@empresa.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Iniciar sesión
            </button>
          </form>
        ) : (
          <form onSubmit={handleMFAVerify} className="space-y-4">
            <div className="flex flex-col items-center mb-4">
              <div className="w-12 h-12 bg-airbus-sky/10 rounded-full flex items-center justify-center mb-2">
                <ShieldCheck className="w-6 h-6 text-airbus-sky" />
              </div>
              <h2 className="text-lg font-semibold text-airbus-blue">
                Verificación en dos pasos
              </h2>
              <p className="text-xs text-gray-500 text-center mt-1">
                Introduce el código de 6 dígitos de Google Authenticator
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="input text-center text-3xl tracking-[0.5em] font-mono"
              placeholder="000000"
              autoFocus
            />

            {error && (
              <div className="bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verificar código
            </button>

            <button
              type="button"
              onClick={() => { setShowMFA(false); setMfaCode(''); setError(''); }}
              className="btn-ghost w-full text-sm"
            >
              Volver
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} NDT Warehouse · v1.0
        </p>
      </div>
    </div>
  );
}