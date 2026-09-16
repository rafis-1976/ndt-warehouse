import { useEffect, useState } from 'react';
import {
  Layers, Package, Hash, AlertTriangle,
  Ruler, Box, Palette, Wrench, Grid3x3, MapPin, Eye, FileCheck2, Barcode,
  FileText, Download,
} from 'lucide-react';
import BarcodeLib from 'react-barcode';
import { formatearTamano, iconoDocumento, type DocumentoEquipo } from '../../lib/storage';

interface ProbetaDetalleProps {
  probeta: any;
  carro: any;
  onClose: () => void;
  probetasEnBandeja?: any[];
}

export function ProbetaDetalle({ probeta, carro, onClose, probetasEnBandeja = [] }: ProbetaDetalleProps) {
  const [animando, setAnimando] = useState(false);
  const [fotoCargada, setFotoCargada] = useState(false);

  const totalBandejas = carro?.num_bandejas ?? 0;
  const bandejaActiva = probeta?.num_bandeja ?? null;
  const posicionActiva = probeta?.num_posicion ?? null;
  const posiciones = carro?.posiciones_por_bandeja ?? 0;

  const fotoBandeja = carro?.bandejas_fotos?.find?.(
    (f: any) => f.num_bandeja === bandejaActiva
  );

  const fotoMostrar = fotoBandeja?.url ?? probeta?.foto_url ?? null;

  const ntms: string[] = probeta?.normas_ntm
    ? String(probeta.normas_ntm)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];

  const certificados: DocumentoEquipo[] = Array.isArray(probeta?.certificados_urls)
    ? probeta.certificados_urls
    : [];

  useEffect(() => {
    setAnimando(false);
    setFotoCargada(false);
    const t1 = setTimeout(() => setAnimando(true), 150);
    const t2 = setTimeout(() => setFotoCargada(true), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [probeta?.id]);

  const bandejas = Array.from({ length: totalBandejas }, (_, i) => i + 1).reverse();

  const otrasProbetas = probetasEnBandeja.filter((p) => p.id !== probeta?.id);

  return (
    <div className="space-y-4">
      <div className="relative bg-gradient-to-br from-airbus-blue to-airbus-navy rounded-2xl p-6 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-airbus-light rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-airbus-sky rounded-full blur-3xl" />
        </div>

        <div className="relative flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-airbus-light uppercase tracking-wider font-semibold">
              Carro
            </p>
            <p className="text-white font-bold text-lg">
              {carro?.codigo} · {carro?.nombre}
            </p>
            {carro?.ubicacion && (
              <p className="text-xs text-airbus-light/80 mt-0.5">
                📍 {carro.ubicacion}
              </p>
            )}
          </div>
          {bandejaActiva && (
            <div className="text-right">
              <p className="text-xs text-airbus-light uppercase tracking-wider font-semibold">
                Ubicación
              </p>
              <p className="text-white font-bold text-2xl leading-none">
                B{bandejaActiva}{posicionActiva ? ` · P${posicionActiva}` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="relative flex justify-center items-end gap-2 min-h-[300px]">
          <div className="relative flex flex-col-reverse items-center">
            {bandejas.map((n) => {
              const esActiva = n === bandejaActiva;
              return (
                <div key={n} className="relative" style={{ zIndex: esActiva ? 50 : 1 }}>
                  <div
                    className={`
                      relative flex items-center justify-center
                      transition-all duration-700 ease-out
                      ${esActiva && animando ? '-translate-x-32 md:-translate-x-52' : 'translate-x-0'}
                    `}
                    style={{ transitionDelay: esActiva ? '400ms' : '0ms' }}
                  >
                    <div
                      className={`
                        relative w-64 md:w-80 h-14 rounded-md border-2
                        flex flex-col justify-center px-3
                        transition-all duration-500
                        ${esActiva
                          ? 'bg-airbus-sky border-airbus-light shadow-[0_0_30px_rgba(116,210,231,0.6)]'
                          : 'bg-gradient-to-b from-gray-100 to-gray-200 border-gray-400 shadow-inner'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            esActiva ? 'bg-white animate-pulse' : 'bg-gray-400'
                          }`} />
                          <span className={`text-xs font-bold ${
                            esActiva ? 'text-white' : 'text-gray-600'
                          }`}>
                            Bandeja {n}
                          </span>
                        </div>
                        <Layers className={`w-4 h-4 ${
                          esActiva ? 'text-white' : 'text-gray-400'
                        }`} />
                      </div>

                      {esActiva && posiciones > 0 && (
                        <div className="mt-1 flex gap-1 justify-center flex-wrap">
                          {Array.from({ length: posiciones }, (_, i) => i + 1).map((p) => {
                            const esEsta = p === posicionActiva;
                            return (
                              <div
                                key={p}
                                className={`
                                  w-5 h-3 rounded-sm border
                                  transition-all duration-500
                                  ${esEsta
                                    ? 'bg-airbus-green border-white scale-110 shadow-md'
                                    : 'bg-white/30 border-white/40'
                                  }
                                `}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {esActiva && (
                      <div
                        className={`
                          absolute top-1/2 -translate-y-1/2 left-full ml-3
                          w-36 h-28 md:w-44 md:h-32 rounded-lg
                          bg-white border-2 border-airbus-sky shadow-2xl
                          flex items-center justify-center overflow-hidden
                          transition-all duration-700 ease-out
                          ${animando && fotoCargada
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-50'
                          }
                        `}
                      >
                        {fotoMostrar ? (
                          <img
                            src={fotoMostrar}
                            alt={probeta.nombre}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-airbus-sky">
                            <Package className="w-8 h-8" />
                            <span className="text-[9px] font-bold uppercase">
                              Sin foto
                            </span>
                          </div>
                        )}

                        {posicionActiva && (
                          <div className="absolute bottom-1 right-1 bg-airbus-green text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            P{posicionActiva}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="w-72 md:w-88 h-3 bg-gradient-to-b from-gray-600 to-gray-800 rounded-b-md mt-0.5 shadow-lg" />

            <div className="flex justify-between w-72 md:w-88 mt-1">
              <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-500" />
              <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-500" />
            </div>
          </div>
        </div>

        {totalBandejas === 0 && (
          <div className="relative mt-4 flex items-center justify-center gap-2 bg-airbus-orange/20 border border-airbus-orange/40 text-white text-xs p-3 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            Este carro no tiene bandejas definidas
          </div>
        )}
      </div>

      {fotoBandeja && ((probeta?.pos_x !== null && probeta?.pos_y !== null) || otrasProbetas.some((p) => p.pos_x !== null)) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-airbus-sky" />
            <p className="text-xs font-semibold text-airbus-blue uppercase tracking-wider">
              Vista de la bandeja {bandejaActiva}
            </p>
          </div>

          <div className="relative inline-block w-full rounded-lg overflow-hidden border border-gray-200">
            <img
              src={fotoBandeja.url}
              alt={`Bandeja ${bandejaActiva}`}
              className="w-full h-auto select-none"
              draggable={false}
            />

            {probeta?.pos_x !== null && probeta?.pos_y !== null && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${Number(probeta.pos_x) * 100}%`,
                  top: `${Number(probeta.pos_y) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20,
                }}
              >
                <div className="relative">
                  <div className="absolute inset-0 -m-4 rounded-full bg-airbus-green/40 animate-ping" />
                  <div className="relative w-9 h-9 rounded-full bg-airbus-green border-[3px] border-white shadow-xl flex items-center justify-center">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-airbus-green text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                    {probeta.pn}
                  </div>
                </div>
              </div>
            )}

            {otrasProbetas.map((p) => {
              if (p.pos_x === null || p.pos_y === null) return null;
              return (
                <div
                  key={p.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${Number(p.pos_x) * 100}%`,
                    top: `${Number(p.pos_y) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                  }}
                >
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-airbus-red border-2 border-white shadow-md flex items-center justify-center opacity-90">
                      <Package className="w-3 h-3 text-white" />
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 bg-airbus-red text-white text-[8px] font-bold px-1 py-0.5 rounded whitespace-nowrap">
                      {p.pn}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-airbus-green border border-white shadow"></span>
              <span className="text-gray-500">Esta probeta</span>
            </div>
            {otrasProbetas.some((p) => p.pos_x !== null) && (
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-airbus-red border border-white shadow"></span>
                <span className="text-gray-500">Otras probetas</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:col-span-2">
          <div className="flex items-start gap-3">
            {probeta?.foto_url ? (
              <div className="w-20 h-20 rounded-lg border border-gray-200 shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                <img
                  src={probeta.foto_url}
                  alt={probeta.nombre}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-lg border border-gray-200 shrink-0 bg-gray-50 flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-300" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-airbus-blue text-sm">
                  {probeta?.pn}
                </span>
                {probeta?.tecnicas_ndt && (
                  <span className="badge badge-blue">
                    {probeta.tecnicas_ndt.codigo}
                  </span>
                )}
                {!probeta?.activa && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-semibold rounded-full uppercase">
                    Inactiva
                  </span>
                )}
              </div>
              <p className="font-semibold text-gray-800 mt-0.5 truncate">
                {probeta?.nombre}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Ubicación exacta
          </p>
          {bandejaActiva ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-airbus-blue">
                <Layers className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  Bandeja {bandejaActiva}
                </span>
              </div>
              {posicionActiva ? (
                <div className="flex items-center gap-2 text-airbus-green">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    Posición {posicionActiva}
                  </span>
                </div>
              ) : probeta?.pos_x !== null && probeta?.pos_y !== null ? (
                <div className="flex items-center gap-2 text-airbus-green">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm font-semibold">Marcada en foto</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Sin posición específica
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              Sin ubicación asignada
            </p>
          )}
        </div>
      </div>

      {probeta?.codigo_barras && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Barcode className="w-3.5 h-3.5" />
            Código de barras
          </p>
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <BarcodeLib
                value={probeta.codigo_barras}
                format="CODE128"
                displayValue={false}
                height={70}
                width={2.2}
                margin={0}
                lineColor="#00205B"
              />
            </div>
            <p className="font-mono text-xs text-gray-500">
              {probeta.codigo_barras}
            </p>
          </div>
        </div>
      )}

      {certificados.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Certificados ({certificados.length})
          </p>
          <div className="space-y-2">
            {certificados.map((doc) => (
              <a
                key={doc.url}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 bg-gray-50 hover:bg-airbus-sky/5 rounded-lg transition border border-gray-200 group"
              >
                <span className="text-lg shrink-0">{iconoDocumento(doc.tipo)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{doc.nombre}</p>
                  <p className="text-[10px] text-gray-400">
                    {formatearTamano(doc.tamano)}
                    {doc.subido_en && ` · ${new Date(doc.subido_en).toLocaleDateString('es-ES')}`}
                  </p>
                </div>
                <Download className="w-4 h-4 text-airbus-sky group-hover:text-airbus-blue transition shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {ntms.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5" />
            Normas NTM donde es necesaria ({ntms.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ntms.map((ntm) => (
              <span
                key={ntm}
                className="inline-flex items-center px-2.5 py-1 bg-airbus-sky/10 text-airbus-sky border border-airbus-sky/30 rounded-full text-xs font-mono font-bold"
              >
                {ntm}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Información técnica
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <DatoItem icon={Hash} label="P/N" value={probeta?.pn} mono />
          <DatoItem icon={Barcode} label="Código barras" value={probeta?.codigo_barras || '—'} mono />
          <DatoItem icon={Wrench} label="Nº serie" value={probeta?.numero_serie || '—'} mono />
          <DatoItem icon={Palette} label="Material" value={probeta?.material || '—'} />
          <DatoItem icon={Ruler} label="Dimensiones" value={probeta?.dimensiones || '—'} />
          <DatoItem icon={Box} label="Carro" value={carro?.codigo || '—'} mono />
          <DatoItem icon={Layers} label="Bandeja" value={bandejaActiva ? String(bandejaActiva) : '—'} />
          <DatoItem
            icon={Grid3x3}
            label="Posición"
            value={
              posicionActiva
                ? String(posicionActiva)
                : probeta?.pos_x !== null
                  ? 'En foto'
                  : '—'
            }
          />
        </div>
      </div>

      {probeta?.observaciones && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Observaciones
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {probeta.observaciones}
          </p>
        </div>
      )}
    </div>
  );
}

function DatoItem({
  icon: Icon, label, value, mono,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className={`text-sm font-medium truncate text-gray-800 ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}