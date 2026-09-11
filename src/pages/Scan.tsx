import { useState } from 'react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, Package, Search } from 'lucide-react';

export function Scan() {
  const [code, setCode] = useState('');
  const [equipo, setEquipo] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleScan = async (scanned: string) => {
    setCode(scanned);
    await lookup(scanned);
  };

  const lookup = async (value: string) => {
    setLoading(true);
    setError('');
    setEquipo(null);
    const { data } = await supabase
      .from('equipos')
      .select('*, tecnicas_ndt(codigo, nombre)')
      .eq('codigo_barras', value)
      .maybeSingle();
    setLoading(false);
    if (!data) setError('No se ha encontrado ningún equipo con ese código.');
    else setEquipo(data);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-airbus-blue">Escanear código</h1>
        <p className="text-sm text-gray-500">Registra entradas y salidas de equipos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-airbus-blue mb-4">Escáner de cámara</h3>
          <BarcodeScanner onScan={handleScan} />
        </div>

        <div className="card">
          <h3 className="font-semibold text-airbus-blue mb-4">Búsqueda manual</h3>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Introduce el código de barras"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup(code)}
            />
            <button onClick={() => lookup(code)} className="btn-primary">
              <Search className="w-4 h-4" />
            </button>
          </div>

          {loading && <p className="mt-4 text-gray-400 text-sm">Buscando...</p>}

          {error && (
            <div className="mt-4 flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {equipo && (
            <div className="mt-4 bg-airbus-green/5 border border-airbus-green/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3 text-airbus-green">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold text-sm">Equipo encontrado</span>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Nombre"     value={equipo.nombre} />
                <Row label="Código"     value={equipo.codigo_barras} mono />
                <Row label="Técnica"    value={equipo.tecnicas_ndt?.codigo ?? '—'} />
                <Row label="Ubicación"  value={equipo.ubicacion ?? '—'} />
                <Row label="Estado"     value={equipo.estado} />
              </div>
            </div>
          )}

          {!equipo && !error && !loading && (
            <div className="mt-4 text-center py-8">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                Escanea o introduce un código para buscar
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-800 font-medium text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}