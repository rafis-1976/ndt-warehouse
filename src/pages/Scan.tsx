import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarcodeScanner } from '../components/BarcodeScanner';
import {
  CheckCircle2, XCircle, Package, Search, Hash, Layers,
  AlertTriangle, Truck, Building2, Warehouse, Users, FileText,
  Calendar, Wrench, Palette, Ruler, Box, Grid3x3, Download,
  Sparkles,
} from 'lucide-react';
import { usePrestamosExternos } from '../hooks/usePrestamosExternos';
import { formatearTamano, iconoDocumento, type DocumentoEquipo } from '../lib/storage';

const tipoDestinoConfig: Record<string, { label: string; icon: any }> = {
  almacen: { label: 'Almacén', icon: Warehouse },
  seccion: { label: 'Sección', icon: Building2 },
  compania: { label: 'Compañía', icon: Truck },
  cliente: { label: 'Cliente', icon: Users },
  otro: { label: 'Otro', icon: Building2 },
};

type TipoEncontrado = 'equipo' | 'probeta';

interface Resultado {
  tipo: TipoEncontrado;
  data: any;
  coincidencia?: string;
}

export function Scan() {
  const [code, setCode] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { fueraMap } = usePrestamosExternos();

  const handleScan = async (scanned: string) => {
    setCode(scanned);
    await lookup(scanned);
  };

  const lookup = async (value: string) => {
    const termino = value.trim();
    if (!termino) return;

    setLoading(true);
    setError('');
    setResultados([]);
    setTerminoBusqueda(termino);

    try {
      // Buscar en paralelo en equipos y probetas por TODOS los campos
      const [equiposRes, probetasRes] = await Promise.all([
        supabase
          .from('equipos')
          .select('*, tecnicas_ndt(codigo, nombre)')
          .or(
            [
              `codigo_barras.ilike.%${termino}%`,
              `id_equipo.ilike.%${termino}%`,
              `nombre.ilike.%${termino}%`,
              `numero_serie.ilike.%${termino}%`,
              `marca.ilike.%${termino}%`,
              `modelo.ilike.%${termino}%`,
              `ubicacion.ilike.%${termino}%`,
              `observaciones.ilike.%${termino}%`,
            ].join(',')
          )
          .limit(20),
        supabase
          .from('probetas')
          .select('*, tecnicas_ndt(codigo, nombre), carros(codigo, nombre, ubicacion)')
          .or(
            [
              `codigo_barras.ilike.%${termino}%`,
              `pn.ilike.%${termino}%`,
              `nombre.ilike.%${termino}%`,
              `numero_serie.ilike.%${termino}%`,
              `material.ilike.%${termino}%`,
              `dimensiones.ilike.%${termino}%`,
              `observaciones.ilike.%${termino}%`,
              `normas_ntm.ilike.%${termino}%`,
            ].join(',')
          )
          .limit(20),
      ]);

      if (equiposRes.error) console.error('[Scan] Error equipos:', equiposRes.error);
      if (probetasRes.error) console.error('[Scan] Error probetas:', probetasRes.error);

      const listaEquipos: Resultado[] = (equiposRes.data ?? []).map((e) => ({
        tipo: 'equipo',
        data: e,
        coincidencia: detectarCoincidencia(e, termino, 'equipo'),
      }));

      const listaProbetas: Resultado[] = (probetasRes.data ?? []).map((p) => ({
        tipo: 'probeta',
        data: p,
        coincidencia: detectarCoincidencia(p, termino, 'probeta'),
      }));

      // Ordenar: primero coincidencia EXACTA en código de barras, luego exacta en otros identificadores, luego el resto
      const todos = [...listaEquipos, ...listaProbetas];
      todos.sort((a, b) => {
        const scoreA = scoreResultado(a, termino);
        const scoreB = scoreResultado(b, termino);
        return scoreB - scoreA;
      });

      if (todos.length === 0) {
        setError(`No se ha encontrado ningún equipo ni probeta que coincida con "${termino}".`);
      } else {
        setResultados(todos);
      }
    } catch (err: any) {
      setError(err.message ?? 'Error al buscar');
    } finally {
      setLoading(false);
    }
  };

  /** Devuelve en qué campo coincidió para mostrarlo en el resultado */
  const detectarCoincidencia = (item: any, termino: string, tipo: TipoEncontrado): string | undefined => {
    const t = termino.toLowerCase();
    if (item.codigo_barras?.toLowerCase().includes(t)) return 'Código de barras';
    if (tipo === 'equipo') {
      if (item.id_equipo?.toLowerCase().includes(t)) return 'ID de equipo';
    } else {
      if (item.pn?.toLowerCase().includes(t)) return 'P/N';
    }
    if (item.nombre?.toLowerCase().includes(t)) return 'Nombre';
    if (item.numero_serie?.toLowerCase().includes(t)) return 'Nº de serie';
    if (item.marca?.toLowerCase().includes(t)) return 'Marca';
    if (item.modelo?.toLowerCase().includes(t)) return 'Modelo';
    if (item.material?.toLowerCase().includes(t)) return 'Material';
    if (item.dimensiones?.toLowerCase().includes(t)) return 'Dimensiones';
    if (item.ubicacion?.toLowerCase().includes(t)) return 'Ubicación';
    if (item.normas_ntm?.toLowerCase().includes(t)) return 'Norma NTM';
    if (item.observaciones?.toLowerCase().includes(t)) return 'Observaciones';
    return undefined;
  };

  /** Puntuación para ordenar: coincidencia exacta > prefijo > contiene */
  const scoreResultado = (r: Resultado, termino: string): number => {
    const t = termino.toLowerCase();
    const item = r.data;
    let score = 0;

    const campos: string[] = [
      item.codigo_barras,
      r.tipo === 'equipo' ? item.id_equipo : item.pn,
      item.nombre,
      item.numero_serie,
      item.marca,
      item.modelo,
      item.material,
      item.dimensiones,
      item.ubicacion,
      item.normas_ntm,
    ].filter(Boolean);

    campos.forEach((campo) => {
      const c = campo.toLowerCase();
      if (c === t) score += 100;
      else if (c.startsWith(t)) score += 50;
      else if (c.includes(t)) score += 10;
    });

    // Bonus por código de barras
    if (item.codigo_barras?.toLowerCase() === t) score += 200;
    return score;
  };

  const limpiar = () => {
    setCode('');
    setResultados([]);
    setError('');
    setTerminoBusqueda('');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-airbus-blue">Escanear / Buscar</h1>
        <p className="text-sm text-gray-500">
          Busca equipos y probetas por cualquier campo: código de barras, P/N, nombre, serie, marca, NTM...
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ESCÁNER */}
        <div className="card">
          <h3 className="font-semibold text-airbus-blue mb-4">Escáner de cámara</h3>
          <BarcodeScanner onScan={handleScan} />
        </div>

        {/* BÚSQUEDA MANUAL */}
        <div className="card">
          <h3 className="font-semibold text-airbus-blue mb-4">Búsqueda manual</h3>

          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-10"
                placeholder="Código, P/N, nombre, serie, marca, NTM..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup(code)}
              />
            </div>
            <button onClick={() => lookup(code)} className="btn-primary">
              <Search className="w-4 h-4" />
            </button>
            {(code || resultados.length > 0 || error) && (
              <button onClick={limpiar} className="btn-ghost border border-gray-300">
                Limpiar
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-1 self-center">
              Busca en:
            </span>
            {[
              'Código de barras',
              'ID / P/N',
              'Nombre',
              'Nº serie',
              'Marca / Modelo',
              'Material',
              'Ubicación',
              'NTM',
            ].map((c) => (
              <span
                key={c}
                className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[9px] font-medium"
              >
                {c}
              </span>
            ))}
          </div>

          {loading && (
            <p className="text-gray-400 text-sm">Buscando en equipos y probetas...</p>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {!loading && resultados.length > 0 && (
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                <strong className="text-airbus-blue">{resultados.length}</strong>{' '}
                resultado{resultados.length !== 1 ? 's' : ''} para "{terminoBusqueda}"
              </span>
            </div>
          )}

          {!loading && resultados.length === 0 && !error && (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                Escanea o introduce cualquier dato para buscar
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Se buscará automáticamente en todos los campos de equipos y probetas
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RESULTADOS */}
      {!loading && resultados.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-airbus-blue flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-airbus-green" />
            Resultados ({resultados.length})
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {resultados.map((r) => (
              <div key={`${r.tipo}-${r.data.id}`} className="relative">
                {r.coincidencia && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-airbus-yellow text-gray-900 text-[9px] font-bold uppercase rounded-full shadow-sm">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {r.coincidencia}
                    </span>
                  </div>
                )}
                {r.tipo === 'equipo' ? (
                  <EquipoResultado
                    equipo={r.data}
                    fueraInfo={fueraMap.get(r.data.id)}
                    termino={terminoBusqueda}
                  />
                ) : (
                  <ProbetaResultado
                    probeta={r.data}
                    fueraInfo={fueraMap.get(r.data.id)}
                    termino={terminoBusqueda}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Resultado: EQUIPO
// ============================================================
function EquipoResultado({ equipo, fueraInfo, termino }: { equipo: any; fueraInfo?: any; termino?: string }) {
  const destinoConf = fueraInfo?.prestamo.destino_tipo
    ? tipoDestinoConfig[fueraInfo.prestamo.destino_tipo]
    : null;
  const DestIcon = destinoConf?.icon ?? Truck;

  const estadoColor: Record<string, string> = {
    disponible:            'bg-airbus-green/10 text-airbus-green border-airbus-green/30',
    prestado:              'bg-airbus-blue/10 text-airbus-blue border-airbus-blue/30',
    calibracion:           'bg-airbus-yellow/20 text-yellow-800 border-airbus-yellow/40',
    pendiente_calibracion: 'bg-airbus-red/10 text-airbus-red border-airbus-red/30',
    mantenimiento:         'bg-airbus-yellow/20 text-yellow-800 border-airbus-yellow/40',
    baja:                  'bg-gray-100 text-gray-500 border-gray-200',
    salida:                'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <div className="card space-y-4">
      <div className="bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-xl p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <Package className="w-3 h-3" />
            Equipo
          </span>
        </div>
        <div className="flex items-center gap-3">
          {equipo.foto_url ? (
            <div className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0">
              <img src={equipo.foto_url} alt={equipo.nombre} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Package className="w-8 h-8 text-white/70" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-airbus-light opacity-90">
              {resaltar(equipo.id_equipo, termino)}
            </p>
            <p className="font-bold text-base truncate">
              {resaltar(equipo.nombre, termino)}
            </p>
            <p className="text-xs opacity-80 truncate">
              {resaltar(equipo.marca, termino)} {resaltar(equipo.modelo, termino)}
            </p>
            <p className="text-[10px] font-mono text-airbus-light/80 truncate">
              {resaltar(equipo.codigo_barras, termino)}
            </p>
          </div>
          {equipo.tecnicas_ndt?.codigo && (
            <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-bold shrink-0">
              {equipo.tecnicas_ndt.codigo}
            </span>
          )}
        </div>
      </div>

      {fueraInfo && (
        <div className="bg-airbus-orange/10 border border-airbus-orange/40 rounded-lg p-3 flex items-start gap-3">
          <DestIcon className="w-5 h-5 text-airbus-orange shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-airbus-orange uppercase tracking-wider">
              Fuera del almacén
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {destinoConf?.label}: {fueraInfo.prestamo.destino_nombre}
            </p>
            {fueraInfo.prestamo.destino_contacto && (
              <p className="text-xs text-gray-500">
                Contacto: {fueraInfo.prestamo.destino_contacto}
              </p>
            )}
            {fueraInfo.prestamo.fecha_devolucion_prevista && (
              <p className={`text-xs mt-0.5 ${fueraInfo.retrasado ? 'text-airbus-red font-semibold' : 'text-gray-500'}`}>
                Devolución prevista: {new Date(fueraInfo.prestamo.fecha_devolucion_prevista).toLocaleDateString('es-ES')}
                {fueraInfo.retrasado && ' · RETRASADO'}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 border border-gray-200 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Estado</p>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              estadoColor[equipo.estado] ?? 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {equipo.estado}
          </span>
        </div>
        <div className="p-3 border border-gray-200 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ubicación</p>
          <p className="text-sm font-medium text-gray-800 truncate">
            {resaltar(equipo.ubicacion, termino) ?? '—'}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Información
        </p>
        <div className="grid grid-cols-2 gap-2">
          <DatoRow icon={Hash} label="Nº serie" value={equipo.numero_serie} termino={termino} />
          <DatoRow icon={Calendar} label="Próx. calibración" value={equipo.proxima_calibracion} termino={termino} />
        </div>
      </div>

      {equipo.observaciones && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Observaciones
          </p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">
            {resaltar(equipo.observaciones, termino)}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Resultado: PROBETA
// ============================================================
function ProbetaResultado({ probeta, fueraInfo, termino }: { probeta: any; fueraInfo?: any; termino?: string }) {
  const destinoConf = fueraInfo?.prestamo.destino_tipo
    ? tipoDestinoConfig[fueraInfo.prestamo.destino_tipo]
    : null;
  const DestIcon = destinoConf?.icon ?? Truck;

  const ntms: string[] = probeta?.normas_ntm
    ? String(probeta.normas_ntm).split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const certificados: DocumentoEquipo[] = Array.isArray(probeta?.certificados_urls)
    ? probeta.certificados_urls
    : [];

  const estadoColor: Record<string, string> = {
    disponible:    'bg-airbus-green/10 text-airbus-green border-airbus-green/30',
    prestado:      'bg-airbus-orange/10 text-airbus-orange border-airbus-orange/30',
    mantenimiento: 'bg-airbus-yellow/20 text-yellow-800 border-airbus-yellow/40',
    baja:          'bg-gray-100 text-gray-500 border-gray-200',
    salida:        'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <div className="card space-y-4">
      <div className="bg-gradient-to-br from-airbus-sky to-airbus-blue rounded-xl p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <Hash className="w-3 h-3" />
            Probeta
          </span>
        </div>
        <div className="flex items-center gap-3">
          {probeta.foto_url ? (
            <div className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0">
              <img src={probeta.foto_url} alt={probeta.nombre} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Hash className="w-8 h-8 text-white/70" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-airbus-light opacity-90">
              {resaltar(probeta.pn, termino)}
            </p>
            <p className="font-bold text-base truncate">
              {resaltar(probeta.nombre, termino)}
            </p>
            {probeta.material && (
              <p className="text-xs opacity-80 truncate">
                {resaltar(probeta.material, termino)}
              </p>
            )}
            <p className="text-[10px] font-mono text-airbus-light/80 truncate">
              {resaltar(probeta.codigo_barras, termino)}
            </p>
          </div>
          {probeta.tecnicas_ndt?.codigo && (
            <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-bold shrink-0">
              {probeta.tecnicas_ndt.codigo}
            </span>
          )}
        </div>
      </div>

      {fueraInfo && (
        <div className="bg-airbus-orange/10 border border-airbus-orange/40 rounded-lg p-3 flex items-start gap-3">
          <DestIcon className="w-5 h-5 text-airbus-orange shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-airbus-orange uppercase tracking-wider">
              Fuera del almacén
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {destinoConf?.label}: {fueraInfo.prestamo.destino_nombre}
            </p>
            {fueraInfo.prestamo.destino_contacto && (
              <p className="text-xs text-gray-500">
                Contacto: {fueraInfo.prestamo.destino_contacto}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 border border-gray-200 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ubicación</p>
          {probeta.carros?.codigo ? (
            <>
              <p className="text-sm font-semibold text-airbus-blue">
                {resaltar(probeta.carros.codigo, termino)}
              </p>
              {probeta.carros.nombre && (
                <p className="text-[10px] text-gray-500 truncate">
                  {resaltar(probeta.carros.nombre, termino)}
                </p>
              )}
              {probeta.num_bandeja && (
                <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Bandeja {probeta.num_bandeja}
                  {probeta.num_posicion ? ` · Pos. ${probeta.num_posicion}` : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 italic">Sin carro asignado</p>
          )}
        </div>
        <div className="p-3 border border-gray-200 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Estado</p>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
              estadoColor[probeta.estado] ?? 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {probeta.estado ?? 'disponible'}
          </span>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Información
        </p>
        <div className="grid grid-cols-2 gap-2">
          <DatoRow icon={Wrench} label="Nº serie" value={probeta.numero_serie} termino={termino} />
          <DatoRow icon={Ruler} label="Dimensiones" value={probeta.dimensiones} termino={termino} />
          <DatoRow icon={Palette} label="Material" value={probeta.material} termino={termino} />
          <DatoRow
            icon={Grid3x3}
            label="Posición"
            value={probeta.num_posicion ? String(probeta.num_posicion) : (probeta.pos_x !== null ? 'En foto' : null)}
            termino={termino}
          />
        </div>
      </div>

      {ntms.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Normas NTM ({ntms.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {ntms.map((ntm) => (
              <span
                key={ntm}
                className="inline-flex items-center px-2 py-0.5 bg-airbus-sky/10 text-airbus-sky border border-airbus-sky/30 rounded-full text-[10px] font-mono font-bold"
              >
                {resaltar(ntm, termino)}
              </span>
            ))}
          </div>
        </div>
      )}

      {certificados.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            Certificados ({certificados.length})
          </p>
          <div className="space-y-1.5">
            {certificados.map((doc) => (
              <a
                key={doc.url}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 bg-white hover:bg-airbus-sky/5 rounded-lg transition border border-gray-200 group"
              >
                <span className="text-base shrink-0">{iconoDocumento(doc.tipo)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 truncate">{doc.nombre}</p>
                  <p className="text-[9px] text-gray-400">
                    {formatearTamano(doc.tamano)}
                  </p>
                </div>
                <Download className="w-3.5 h-3.5 text-airbus-sky group-hover:text-airbus-blue transition shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {probeta.observaciones && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Observaciones
          </p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">
            {resaltar(probeta.observaciones, termino)}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Fila de dato simple con resaltado
// ============================================================
function DatoRow({
  icon: Icon, label, value, termino,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
  termino?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-medium text-gray-800 truncate">
          {value ? resaltar(value, termino) : '—'}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Resaltado del término buscado
// ============================================================
function resaltar(texto: string | null | undefined, termino?: string) {
  if (!texto) return texto;
  if (!termino || !termino.trim()) return texto;
  const t = termino.trim();
  const lower = texto.toLowerCase();
  const tLower = t.toLowerCase();
  const idx = lower.indexOf(tLower);
  if (idx === -1) return texto;
  return (
    <>
      {texto.slice(0, idx)}
      <mark className="bg-airbus-yellow/70 text-gray-900 rounded px-0.5">
        {texto.slice(idx, idx + t.length)}
      </mark>
      {texto.slice(idx + t.length)}
    </>
  );
}