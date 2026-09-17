import { useEffect, useRef, useState } from 'react';
import {
  Printer, X, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import BarcodeLib from 'react-barcode';

interface InformeDetalleProps {
  informe: any;
  onClose: () => void;
}

/** Genera el texto unificado del inspector: "#NOMINA - Nombre" */
function formatoInspector(numNomina: string | null | undefined, nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim();
  const num = (numNomina ?? '').trim();
  if (!n && !num) return '—';
  if (!num) return n;
  if (!n) return `#${num}`;
  return `#${num} - ${n}`;
}

const LOGO_PATH = '/iberia-mantenimiento.svg';

export function InformeDetalle({ informe, onClose }: InformeDetalleProps) {
  const [cargando, setCargando] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCargando(false);
  }, [informe.id]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const logoAbs = `${window.location.origin}${LOGO_PATH}`;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Informe ${informe.numero_informe}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111;
            font-size: 11px;
            line-height: 1.4;
            background: white;
          }

          .step-block,
          .barcode-box,
          .box,
          .texto-largo,
          .findings-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .step-row,
          .chips,
          .chip,
          .head,
          .section-title {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .section-title {
            break-after: avoid;
            page-break-after: avoid;
          }
          .head {
            break-after: avoid;
            page-break-after: avoid;
          }

          .head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #00205B;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-img {
            height: 52px;
            width: auto;
            object-fit: contain;
          }
          .brand-text h1 { margin: 0; font-size: 16px; color: #00205B; letter-spacing: 0.5px; }
          .brand-text p { margin: 2px 0 0; font-size: 10px; color: #666; }
          .doc-title { text-align: right; }
          .doc-title h2 { margin: 0; font-size: 17px; color: #00205B; font-weight: 800; }
          .doc-title .sub { font-size: 10px; color: #666; margin-top: 1px; }
          .doc-title .num {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #00205B;
            margin-top: 4px;
            font-weight: 700;
            background: #f0f7ff;
            padding: 2px 8px;
            border-radius: 4px;
            display: inline-block;
          }

          .section-title {
            background: #00205B;
            color: white;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 5px 10px;
            border-radius: 3px;
            margin-top: 14px;
            margin-bottom: 8px;
          }

          .grid { display: grid; gap: 8px; margin-bottom: 10px; }
          .grid-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-3 { grid-template-columns: repeat(3, 1fr); }
          .grid-4 { grid-template-columns: repeat(4, 1fr); }

          .box {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px 10px;
            background: #fafafa;
          }
          .box .label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #777;
            font-weight: 700;
            margin-bottom: 3px;
          }
          .box .value {
            font-size: 12px;
            color: #111;
            font-weight: 600;
            word-break: break-word;
            line-height: 1.3;
          }
          .box .value.mono { font-family: 'Courier New', monospace; }

          .step-block {
            border: 2px solid #00205B;
            border-radius: 8px;
            margin-bottom: 14px;
            overflow: hidden;
            background: #fdfdfd;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .step-body { padding: 14px 16px; }

          .step-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            padding: 8px 0;
            border-bottom: 1px dashed #e0e0e0;
          }
          .step-row:last-child { border-bottom: none; }
          .step-row.full { grid-template-columns: 1fr; }
          .step-row.first { padding-top: 0; }

          .field { min-width: 0; }
          .field .f-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #666;
            font-weight: 800;
            margin-bottom: 4px;
          }
          .field .f-value {
            font-size: 12px;
            color: #111;
            font-weight: 600;
            line-height: 1.35;
          }
          .field .f-value.mono { font-family: 'Courier New', monospace; }
          .field .f-value.big {
            font-size: 14px;
            font-weight: 800;
            color: #00205B;
          }

          .chips { display: flex; flex-wrap: wrap; gap: 6px; }
          .chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 10px;
            background: white;
            border: 1.5px solid #00205B;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            color: #111;
            line-height: 1.2;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .chip .c-id {
            font-family: 'Courier New', monospace;
            font-weight: 800;
            color: #00205B;
            background: #e6efff;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 11px;
          }
          .chip .c-name { color: #333; }
          .chip .c-sn {
            font-family: 'Courier New', monospace;
            color: #666;
            font-size: 10px;
          }
          .chip .c-cal {
            color: #FE5000;
            font-weight: 700;
            font-size: 10px;
          }
          .empty-chips {
            font-size: 11px;
            font-style: italic;
            color: #999;
          }

          .findings-block {
            border: 2px solid #E4002B;
            border-radius: 6px;
            background: #fff5f5;
            padding: 10px 12px;
            margin-top: 10px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .findings-block .f-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #E4002B;
            font-weight: 800;
            margin-bottom: 6px;
          }
          .findings-block .f-text {
            font-size: 12px;
            color: #7a0015;
            font-weight: 500;
            line-height: 1.5;
            white-space: pre-wrap;
          }

          .texto-largo {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px 12px;
            background: #fafafa;
            font-size: 12px;
            line-height: 1.5;
            min-height: 30px;
            white-space: pre-wrap;
            color: #222;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .barcode-box {
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 10px;
            background: #fafafa;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            break-inside: avoid;
            page-break-inside: avoid;
            margin-top: 18px;
          }
          .barcode-box .b-num {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #333;
            margin-top: 4px;
            font-weight: 700;
          }

          .footer {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #ccc;
            font-size: 9px;
            color: #888;
            text-align: center;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>${content.replace(/src="\/iberia-mantenimiento\.svg"/g, `src="${logoAbs}"`)}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const getNtmSteps = () => {
    if (Array.isArray(informe.ntm_steps) && informe.ntm_steps.length > 0) {
      return informe.ntm_steps
        .map((s: any) => {
          let resultado = String(s.resultado ?? 'NIL FINDINGS');
          if (resultado === 'aprobado') resultado = 'NIL FINDINGS';
          else if (resultado === 'rechazado' || resultado === 'condicional') resultado = 'FINDINGS';
          else if (resultado !== 'NIL FINDINGS' && resultado !== 'FINDINGS') resultado = 'NIL FINDINGS';

          return {
            ntm: String(s.ntm ?? '').trim(),
            step: String(s.step ?? '').trim(),
            metodo: String(s.metodo ?? '').trim(),
            fecha: String(s.fecha ?? '').trim(),
            resultado,
            findings_text: String(s.findings_text ?? '').trim(),
            equipos: Array.isArray(s.equipos) ? s.equipos : [],
            probetas: Array.isArray(s.probetas) ? s.probetas : [],
            inspector_num_nomina: String(s.inspector_num_nomina ?? '').trim(),
            inspector_nombre: String(s.inspector_nombre ?? '').trim(),
          };
        })
        .filter((s: any) => s.ntm || s.step || s.equipos.length > 0 || s.probetas.length > 0);
    }
    if (informe.ntm_referencia || informe.ntm_step) {
      return [
        {
          ntm: String(informe.ntm_referencia ?? '').trim(),
          step: String(informe.ntm_step ?? '').trim(),
          metodo: String(informe.metodo ?? '').trim(),
          fecha: String(informe.fecha_inspeccion ?? '').trim(),
          resultado: 'NIL FINDINGS',
          findings_text: '',
          equipos: [],
          probetas: [],
          inspector_num_nomina: '',
          inspector_nombre: '',
        },
      ];
    }
    return [];
  };

  const ntmSteps = getNtmSteps();

  const fmtFecha = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-ES');
    } catch {
      return iso;
    }
  };

  const estacionMostrar =
    informe.estacion === 'MADET' ? 'Madrid'
    : informe.estacion === 'BCNET' ? 'Barcelona'
    : informe.estacion === 'MADRID' ? 'Madrid'
    : informe.estacion === 'BARCELONA' ? 'Barcelona'
    : (informe.estacion || '—');

  const hayFindings = ntmSteps.some((s) => s.resultado === 'FINDINGS');

  const ResultadoIcone = () => {
    if (hayFindings) return <AlertTriangle className="w-5 h-5 text-airbus-red" />;
    return <CheckCircle2 className="w-5 h-5 text-airbus-green" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <ResultadoIcone />
          <span className="text-sm font-semibold text-gray-700">
            Informe {informe.numero_informe}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            hayFindings ? 'bg-airbus-red text-white' : 'bg-airbus-green text-white'
          }`}>
            {hayFindings ? 'FINDINGS' : 'NIL FINDINGS'}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </button>
          <button onClick={onClose} className="btn-ghost border border-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {cargando ? (
        <p className="text-center py-8 text-gray-400">Cargando informe...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div ref={printRef}>
            <div className="p-6">
              <div className="head">
                <div className="brand">
                  <img
                    src={LOGO_PATH}
                    alt="Iberia Mantenimiento"
                    className="brand-img"
                  />
                  <div className="brand-text">
                    <h1>IBERIA MANTENIMIENTO</h1>
                    <p>DT/MNG AVIONES · TALLERES · NDT</p>
                  </div>
                </div>
                <div className="doc-title">
                  <h2>END · INFORME DE INSPECCIÓN</h2>
                  <div className="sub">NDT Inspection Report</div>
                  <div className="num">{informe.numero_informe}</div>
                </div>
              </div>

              <div className="grid grid-2" style={{ marginTop: 0 }}>
                <div>
                  <div className="section-title" style={{ marginTop: 0 }}>Identificación</div>
                  <div className="grid grid-3">
                    <Box label="N° Informe" value={informe.numero_informe} mono />
                    <Box label="N° SAP" value={informe.numero_sap || '—'} mono />
                    <Box label="Revisión" value={`Rev. ${informe.revision ?? 1}`} />
                  </div>
                </div>
                <div>
                  <div className="section-title" style={{ marginTop: 0 }}>Certificación</div>
                  <div className="grid grid-3">
                    <Box label="Instalación" value={estacionMostrar} />
                    <Box label="EASA Ref." value={informe.easa_ref || '—'} mono />
                    <Box label="UK CAA Ref." value={informe.uk_caa_ref || '—'} mono />
                  </div>
                </div>
              </div>

              <div className="section-title">Aeronave / Componente</div>
              <div className="grid grid-4">
                <Box label="Matrícula (A/C)" value={informe.matricula || '—'} mono />
                <Box label="Modelo" value={informe.modelo_aeronave || '—'} />
                <Box label="N° Serie A/C" value={informe.numero_serie_aeronave || '—'} mono />
                <Box label="Componente" value={informe.componente || '—'} />
                <Box label="FR" value={informe.numero_fr || '—'} mono />
                <Box label="Zona" value={informe.zona || '—'} />
                <Box label="Operador" value={informe.operador || '—'} />
                <Box label="Cliente" value={informe.cliente || '—'} />
              </div>

              <div className="section-title">Inspecciones realizadas (NTM / Steps)</div>
              {ntmSteps.length === 0 ? (
                <div className="texto-largo" style={{ textAlign: 'center', fontStyle: 'italic', color: '#999' }}>
                  Sin normas NTM asignadas
                </div>
              ) : (
                <div>
                  {ntmSteps.map((s, i) => (
                    <div key={i} className="step-block">
                      <div className="step-body">
                        <div className="step-row first" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                          <div className="field">
                            <div className="f-label">NTM Doc. Ref. · Step</div>
                            <div className="f-value mono big">
                              {s.ntm || '—'}{s.step ? ` · ${s.step}` : ''}
                            </div>
                          </div>
                          <div className="field">
                            <div className="f-label">Técnica</div>
                            <div className="f-value mono big">{s.metodo || '—'}</div>
                          </div>
                          <div className="field">
                            <div className="f-label">Resultado</div>
                            <div
                              className="f-value"
                              style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                background: s.resultado === 'FINDINGS' ? '#E4002B' : '#009F4D',
                                color: 'white',
                              }}
                            >
                              {s.resultado}
                            </div>
                          </div>
                        </div>

                        <div className="step-row">
                          <div className="field">
                            <div className="f-label">Fecha de realización</div>
                            <div className="f-value big">{fmtFecha(s.fecha)}</div>
                          </div>
                          <div className="field">
                            <div className="f-label">Inspector</div>
                            <div className="f-value big">
                              {formatoInspector(s.inspector_num_nomina, s.inspector_nombre)}
                            </div>
                          </div>
                        </div>

                        <div className="step-row full">
                          <div className="field">
                            <div className="f-label">
                              Equipos utilizados ({s.equipos.length})
                            </div>
                            {s.equipos.length === 0 ? (
                              <div className="empty-chips">Sin equipos asignados</div>
                            ) : (
                              <div className="chips">
                                {s.equipos.map((eq: any, idx: number) => (
                                  <span key={idx} className="chip">
                                    <span className="c-id">{eq.id_equipo ?? '—'}</span>
                                    <span className="c-name">{eq.nombre}</span>
                                    {eq.numero_serie && (
                                      <span className="c-sn">S/N {eq.numero_serie}</span>
                                    )}
                                    {eq.proxima_calibracion && (
                                      <span className="c-cal">
                                        📅 Calib: {fmtFecha(eq.proxima_calibracion)}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="step-row full">
                          <div className="field">
                            <div className="f-label">
                              Probetas utilizadas ({s.probetas.length})
                            </div>
                            {s.probetas.length === 0 ? (
                              <div className="empty-chips">Sin probetas asignadas</div>
                            ) : (
                              <div className="chips">
                                {s.probetas.map((pb: any, idx: number) => (
                                  <span key={idx} className="chip">
                                    <span className="c-id">{pb.pn ?? '—'}</span>
                                    <span className="c-name">{pb.nombre}</span>
                                    {pb.numero_serie && (
                                      <span className="c-sn">S/N {pb.numero_serie}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {s.resultado === 'FINDINGS' && s.findings_text && (
                          <div className="findings-block">
                            <div className="f-label">⚠ Findings detectados</div>
                            <div className="f-text">{s.findings_text}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {informe.observaciones && (
                <>
                  <div className="section-title">Observaciones</div>
                  <div className="texto-largo">{informe.observaciones}</div>
                </>
              )}

              {informe.numero_informe && (
                <div className="barcode-box">
                  <BarcodeLib
                    value={informe.numero_informe}
                    format="CODE128"
                    displayValue={false}
                    height={40}
                    width={1.4}
                    margin={0}
                    lineColor="#00205B"
                  />
                  <div className="b-num">{informe.numero_informe}</div>
                </div>
              )}

              <div className="footer">
                Documento generado automáticamente por NDT Warehouse · {new Date().toLocaleString('es-ES')}
                {informe.estado && ` · Estado: ${informe.estado.toUpperCase()}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="box">
      <div className="label">{label}</div>
      <div className={`value ${mono ? 'mono' : ''}`}>{value}</div>
    </div>
  );
}