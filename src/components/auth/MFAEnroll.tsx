import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ShieldCheck, Copy, Check, Loader2 } from 'lucide-react';

export function MFAEnroll() {
  const { enrollMFA, verifyMFA } = useAuth();
  const [factor, setFactor] = useState<any>(null);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'idle' | 'enrolling' | 'verifying' | 'done'>('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const startEnroll = async () => {
    setError('');
    setStep('enrolling');
    try {
      const data = await enrollMFA();
      setFactor(data);
      setStep('verifying');
    } catch (err: any) {
      setError(err.message);
      setStep('idle');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await verifyMFA(factor.id, code);
      setStep('done');
    } catch (err: any) {
      setError('Código incorrecto.');
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(factor.totp.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'idle') {
    return (
      <div className="card text-center">
        <div className="w-14 h-14 mx-auto bg-airbus-sky/10 rounded-full flex items-center justify-center mb-3">
          <ShieldCheck className="w-7 h-7 text-airbus-sky" />
        </div>
        <h3 className="font-semibold text-airbus-blue mb-1">Autenticación en dos pasos</h3>
        <p className="text-sm text-gray-500 mb-4">
          Protege tu cuenta con Google Authenticator
        </p>
        <button onClick={startEnroll} className="btn-primary">
          Activar MFA
        </button>
      </div>
    );
  }

  if (step === 'enrolling') {
    return (
      <div className="card text-center">
        <Loader2 className="w-8 h-8 animate-spin text-airbus-sky mx-auto" />
        <p className="text-sm text-gray-500 mt-2">Generando factor...</p>
      </div>
    );
  }

  if (step === 'verifying') {
    return (
      <div className="card">
        <h3 className="font-semibold text-airbus-blue mb-3 text-center">
          Escanea el código QR
        </h3>
        <div className="flex justify-center mb-4">
          <img src={factor.totp.qr_code} alt="QR TOTP" className="w-48 h-48 border rounded-lg" />
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">O introduce el código manualmente:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono flex-1 truncate">{factor.totp.secret}</code>
            <button onClick={copySecret} className="p-1 hover:bg-gray-200 rounded">
              {copied ? <Check className="w-4 h-4 text-airbus-green" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="input text-center text-2xl tracking-widest font-mono"
            placeholder="000000"
            autoFocus
          />
          {error && <p className="text-airbus-red text-sm">{error}</p>}
          <button type="submit" disabled={code.length !== 6} className="btn-primary w-full">
            Verificar y activar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="card text-center">
      <div className="w-14 h-14 mx-auto bg-airbus-green/10 rounded-full flex items-center justify-center mb-3">
        <Check className="w-7 h-7 text-airbus-green" />
      </div>
      <h3 className="font-semibold text-airbus-green mb-1">MFA activado</h3>
      <p className="text-sm text-gray-500">
        Tu cuenta está protegida con autenticación en dos pasos.
      </p>
    </div>
  );
}