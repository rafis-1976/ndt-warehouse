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

const LOGO_PATH = '/iberia-mantenimiento.png';

/** Renderiza una etiqueta bilingüe compacta: "ES · EN" */
function L({ es, en }: { es: string; en: string }) {
  return (
    <span className="lbl">
      <span className="lbl-es">{es}</span>
      <span className="lbl-sep">·</span>
      <span className="lbl-en">{en}</span>
    </span>
  );
}

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
    const numInforme = (informe.numero_informe ?? '').toString();
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Informe ${numInforme}</title>
        <style>
          /* =========================================================
             A4 APAISADA (297 × 210 mm)
             Márgenes por página:
               sup 8mm · inf 16mm · izq 10mm · der 10mm
             El inferior de 16mm reserva espacio para el pie de página
             (nº de página) que dibuja @bottom-center.
             Área útil: 277 × 186 mm
             ========================================================= */
          @page {
            size: A4 landscape;
            margin: 8mm 10mm 16mm 10mm;

            /* 👇 PIE DE PÁGINA REPETIDO EN CADA HOJA */
            @bottom-left {
              content: "NDT Warehouse";
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 8px;
              color: #999;
              padding-left: 2mm;
            }
            @bottom-center {
              content: "Página " counter(page) " de " counter(pages) " · Page " counter(page) " of " counter(pages);
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 8.5px;
              color: #555;
              font-weight: 600;
            }
            @bottom-right {
              content: "${numInforme}";
              font-family: 'Courier New', monospace;
              font-size: 8px;
              color: #666;
              padding-right: 2mm;
            }
          }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111;
            font-size: 8.5px;
            line-height: 1.3;
            background: white;
            padding: 0;
          }

          /* --- CONTROL DE SALTOS DE PÁGINA --- */
          .step-block,
          .step-row,
          .step-body,
          .chips,
          .chip,
          .box,
          .findings-block,
          .texto-largo,
          .section-title,
          .head,
          .barcode-box,
          .footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .section-title,
          .head {
            break-after: avoid;
            page-break-after: avoid;
          }
          p, .texto-largo, .findings-block .f-text, .field .f-value {
            orphans: 3;
            widows: 3;
          }

          /* --- CABECERA --- */
          .head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2.5px solid #00205B;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .brand { display: flex; align-items: center; gap: 10px; }
          .brand-img { height: 36px; width: auto; object-fit: contain; }
          .doc-title { text-align: right; }
          .doc-title h2 { margin: 0; font-size: 13px; color: #00205B; font-weight: 800; }
          .doc-title .sub { font-size: 7.5px; color: #666; margin-top: 1px; }
          .doc-title .num {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            color: #00205B;
            margin-top: 2px;
            font-weight: 700;
            background: #f0f7ff;
            padding: 1px 7px;
            border-radius: 3px;
            display: inline-block;
          }

          /* --- TÍTULOS DE SECCIÓN --- */
          .section-title {
            background: #00205B;
            color: white;
            font-size: 8.5px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            padding: 3px 7px;
            border-radius: 3px;
            margin-top: 7px;
            margin-bottom: 4px;
            display: flex;
            justify-content: space-between;
            gap: 8px;
          }
          .section-title .st-en {
            font-weight: 600;
            opacity: 0.85;
            font-size: 8px;
            letter-spacing: 0.3px;
          }

          /* --- GRIDS --- */
          .grid { display: grid; gap: 4px; margin-bottom: 4px; }
          .grid-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-3 { grid-template-columns: repeat(3, 1fr); }
          .grid-4 { grid-template-columns: repeat(4, 1fr); }

          .box {
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 4px 6px;
            background: #fafafa;
          }
          .box .label {
            font-size: 7px;
            letter-spacing: 0.3px;
            color: #777;
            font-weight: 700;
            margin-bottom: 1px;
            line-height: 1.15;
          }
          .box .value {
            font-size: 9.5px;
            color: #111;
            font-weight: 600;
            word-break: break-word;
            line-height: 1.2;
          }
          .box .value.mono { font-family: 'Courier New', monospace; }

          /* Etiqueta bilingüe */
          .lbl { display: inline-flex; gap: 3px; align-items: baseline; }
          .lbl-es { font-weight: 800; color: #555; }
          .lbl-sep { color: #bbb; font-weight: 400; }
          .lbl-en {
            text-transform: uppercase;
            color: #999;
            font-weight: 600;
            font-size: 6.5px;
            letter-spacing: 0.3px;
          }

          /* --- BLOQUE DE PASO ---
             👇 SIN overflow:hidden → Chrome rompe el salto de página
             cuando un ancestro tiene overflow != visible. */
          .step-block {
            border: 1.5px solid #00205B;
            border-radius: 5px;
            margin-bottom: 6px;
            background: #fdfdfd;
            display: block;
          }
          .step-body { padding: 6px 8px; }

          .step-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 4px 0;
            border-bottom: 1px dashed #e0e0e0;
          }
          .step-row:last-child { border-bottom: none; }
          .step-row.full { grid-template-columns: 1fr; }
          .step-row.first { padding-top: 0; }

          .field { min-width: 0; }
          .field .f-label {
            font-size: 7px;
            letter-spacing: 0.3px;
            color: #666;
            font-weight: 800;
            margin-bottom: 1px;
            line-height: 1.15;
          }
          .field .f-value {
            font-size: 9.5px;
            color: #111;
            font-weight: 600;
            line-height: 1.25;
          }
          .field .f-value.mono { font-family: 'Courier New', monospace; }
          .field .f-value.big {
            font-size: 11px;
            font-weight: 800;
            color: #00205B;
          }

          /* --- CHIPS (equipos / probetas) --- */
          .chips { display: flex; flex-wrap: wrap; gap: 3px; }
          .chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            background: white;
            border: 1.2px solid #00205B;
            border-radius: 4px;
            font-size: 8.5px;
            font-weight: 600;
            color: #111;
            line-height: 1.1;
            max-width: 100%;
          }
          .chip .c-id {
            font-family: 'Courier New', monospace;
            font-weight: 800;
            color: #00205B;
            background: #e6efff;
            padding: 0 4px;
            border-radius: 3px;
            font-size: 8.5px;
            flex-shrink: 0;
          }
          .chip .c-name {
            color: #333;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .chip .c-sn {
            font-family: 'Courier New', monospace;
            color: #666;
            font-size: 7.5px;
            flex-shrink: 0;
          }
          .chip .c-cal {
            color: #FE5000;
            font-weight: 700;
            font-size: 7.5px;
            flex-shrink: 0;
          }
          .empty-chips {
            font-size: 8.5px;
            font-style: italic;
            color: #999;
          }

          /* --- FINDINGS --- */
          .findings-block {
            border: 1.5px solid #E4002B;
            border-radius: 4px;
            background: #fff5f5;
            padding: 5px 8px;
            margin-top: 5px;
          }
          .findings-block .f-label {
            font-size: 7.5px;
            letter-spacing: 0.4px;
            color: #E4002B;
            font-weight: 800;
            margin-bottom: 3px;
          }
          .findings-block .f-text {
            font-size: 9.5px;
            color: #7a0015;
            font-weight: 500;
            line-height: 1.35;
            white-space: pre-wrap;
          }

          /* --- TEXTO LARGO --- */
          .texto-largo {
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 6px 8px;
            background: #fafafa;
            font-size: 9.5px;
            line-height: 1.35;
            min-height: 20px;
            white-space: pre-wrap;
            color: #222;
          }

          /* --- CÓDIGO DE BARRAS --- */
          .barcode-box {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 6px;
            background: #fafafa;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: 8px;
          }
          .barcode-box .b-num {
            font-family: 'Courier New', monospace;
            font-size: 8.5px;
            color: #333;
            margin-top: 2px;
            font-weight: 700;
          }

          /* --- PIE IN-FLOW (solo aparece al final del documento) --- */
          .footer {
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px solid #ccc;
            font-size: 7px;
            color: #888;
            text-align: center;
          }
        </style>
      </head>
      <body>${content.replace(/src="\/iberia-mantenimiento\.png"/g, `src="${logoAbs}"`)}</body>
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
                </div>
                <div className="doc-title">
                  <h2>END · INFORME DE INSPECCIÓN</h2>
                  <div className="sub">NDT Inspection Report</div>
                  <div className="num">{informe.numero_informe}</div>
                </div>
              </div>

              <div className="grid grid-2" style={{ marginTop: 0 }}>
                <div>
                  <div className="section-title" style={{ marginTop: 0 }}>
                    <span>Identificación</span>
                    <span className="st-en">IDENTIFICATION</span>
                  </div>
                  <div className="grid grid-3">
                    <Box labelEs="N° Informe" labelEn="Report No." value={informe.numero_informe} mono />
                    <Box labelEs="N° SAP" labelEn="SAP No." value={informe.numero_sap || '—'} mono />
                    <Box labelEs="Revisión" labelEn="Revision" value={`Rev. ${informe.revision ?? 1}`} />
                  </div>
                </div>
                <div>
                  <div className="section-title" style={{ marginTop: 0 }}>
                    <span>Certificación</span>
                    <span className="st-en">CERTIFICATION</span>
                  </div>
                  <div className="grid grid-3">
                    <Box labelEs="Instalación" labelEn="Facility" value={estacionMostrar} />
                    <Box labelEs="EASA Ref." labelEn="EASA Ref." value={informe.easa_ref || '—'} mono />
                    <Box labelEs="UK CAA Ref." labelEn="UK CAA Ref." value={informe.uk_caa_ref || '—'} mono />
                  </div>
                </div>
              </div>

              <div className="section-title">
                <span>Aeronave / Componente</span>
                <span className="st-en">AIRCRAFT / COMPONENT</span>
              </div>
              <div className="grid grid-4">
                <Box labelEs="Matrícula (A/C)" labelEn="Reg. (A/C)" value={informe.matricula || '—'} mono />
                <Box labelEs="Modelo" labelEn="Model" value={informe.modelo_aeronave || '—'} />
                <Box labelEs="N° Serie A/C" labelEn="A/C S/N" value={informe.numero_serie_aeronave || '—'} mono />
                <Box labelEs="Componente" labelEn="Component" value={informe.componente || '—'} />
                <Box labelEs="FR" labelEn="FR" value={informe.numero_fr || '—'} mono />
                <Box labelEs="Zona" labelEn="Zone" value={informe.zona || '—'} />
                <Box labelEs="Operador" labelEn="Operator" value={informe.operador || '—'} />
                <Box labelEs="Cliente" labelEn="Customer" value={informe.cliente || '—'} />
              </div>

              <div className="section-title">
                <span>Inspecciones realizadas (NTM / Steps)</span>
                <span className="st-en">PERFORMED INSPECTIONS (NTM / STEPS)</span>
              </div>
              {ntmSteps.length === 0 ? (
                <div className="texto-largo" style={{ textAlign: 'center', fontStyle: 'italic', color: '#999' }}>
                  Sin normas NTM asignadas · No NTM assigned
                </div>
              ) : (
                <div>
                  {ntmSteps.map((s, i) => (
                    <div key={i} className="step-block">
                      <div className="step-body">
                        {/* Fila 1: NTM · Step | Técnica | Resultado */}
                        <div className="step-row first" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                          <div className="field">
                            <div className="f-label">
                              <L es="NTM Doc. Ref. · Step" en="NTM Ref." />
                            </div>
                            <div className="f-value mono big">
                              {s.ntm || '—'}{s.step ? ` · ${s.step}` : ''}
                            </div>
                          </div>
                          <div className="field">
                            <div className="f-label">
                              <L es="Técnica" en="Method" />
                            </div>
                            <div className="f-value mono big">{s.metodo || '—'}</div>
                          </div>
                          <div className="field">
                            <div className="f-label">
                              <L es="Resultado" en="Result" />
                            </div>
                            <div
                              className="f-value"
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 9,
                                fontSize: 8.5,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: 0.4,
                                background: s.resultado === 'FINDINGS' ? '#E4002B' : '#009F4D',
                                color: 'white',
                              }}
                            >
                              {s.resultado}
                            </div>
                          </div>
                        </div>

                        {/* Fila 2: Fecha | Inspector */}
                        <div className="step-row">
                          <div className="field">
                            <div className="f-label">
                              <L es="Fecha de realización" en="Date performed" />
                            </div>
                            <div className="f-value big">{fmtFecha(s.fecha)}</div>
                          </div>
                          <div className="field">
                            <div className="f-label">
                              <L es="Inspector" en="Inspector" />
                            </div>
                            <div className="f-value big">
                              {formatoInspector(s.inspector_num_nomina, s.inspector_nombre)}
                            </div>
                          </div>
                        </div>

                        {/* Fila 3: Equipos | Probetas (lado a lado) */}
                        <div className="step-row">
                          <div className="field">
                            <div className="f-label">
                              <L es={`Equipos utilizados (${s.equipos.length})`} en={`Equipment used (${s.equipos.length})`} />
                            </div>
                            {s.equipos.length === 0 ? (
                              <div className="empty-chips">Sin equipos · No equipment</div>
                            ) : (
                              <div className="chips">
                                {s.equipos.map((eq: any, idx: number) => (
                                  <span key={idx} className="chip">
                                    <span className="c-id">{eq.id_equipo ?? '—'}</span>
                                    <span className="c-name" title={eq.nombre}>{eq.nombre}</span>
                                    {eq.numero_serie && (
                                      <span className="c-sn">S/N {eq.numero_serie}</span>
                                    )}
                                    {eq.proxima_calibracion && (
                                      <span className="c-cal">📅 {fmtFecha(eq.proxima_calibracion)}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="field">
                            <div className="f-label">
                              <L es={`Probetas utilizadas (${s.probetas.length})`} en={`Ref. blocks used (${s.probetas.length})`} />
                            </div>
                            {s.probetas.length === 0 ? (
                              <div className="empty-chips">Sin probetas · No ref. blocks</div>
                            ) : (
                              <div className="chips">
                                {s.probetas.map((pb: any, idx: number) => (
                                  <span key={idx} className="chip">
                                    <span className="c-id">{pb.pn ?? '—'}</span>
                                    <span className="c-name" title={pb.nombre}>{pb.nombre}</span>
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
                            <div className="f-label">
                              ⚠ <L es="Findings detectados" en="Findings detected" />
                            </div>
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
                  <div className="section-title">
                    <span>Observaciones</span>
                    <span className="st-en">REMARKS</span>
                  </div>
                  <div className="texto-largo">{informe.observaciones}</div>
                </>
              )}

              {informe.numero_informe && (
                <div className="barcode-box">
                  <BarcodeLib
                    value={informe.numero_informe}
                    format="CODE128"
                    displayValue={false}
                    height={34}
                    width={1.2}
                    margin={0}
                    lineColor="#00205B"
                  />
                  <div className="b-num">{informe.numero_informe}</div>
                </div>
              )}

              <div className="footer">
                Documento generado automáticamente por NDT Warehouse · {new Date().toLocaleString('es-ES')}
                {informe.estado && ` · Estado / Status: ${informe.estado.toUpperCase()}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({
  labelEs,
  labelEn,
  value,
  mono,
}: {
  labelEs: string;
  labelEn: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="box">
      <div className="label">
        <L es={labelEs} en={labelEn} />
      </div>
      <div className={`value ${mono ? 'mono' : ''}`}>{value}</div>
    </div>
  );
}