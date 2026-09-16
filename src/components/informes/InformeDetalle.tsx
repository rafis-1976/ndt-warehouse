import { useEffect, useRef, useState } from 'react';
import {
  Printer, X, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import BarcodeLib from 'react-barcode';

interface InformeDetalleProps {
  informe: any;
  onClose: () => void;
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
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Informe ${informe.numero_informe}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111;
            font-size: 9px;
            line-height: 1.25;
            margin: 0;
            padding: 0;
            background: white;
          }
          .page {
            padding: 0;
            min-height: 100%;
          }
          .head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #00205B;
            padding-bottom: 5px;
            margin-bottom: 8px;
          }
          .brand { display: flex; align-items: center; gap: 8px; }
          .brand-logo {
            width: 36px; height: 36px;
            background: #00205B; color: #74D2E7;
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; font-size: 17px; font-weight: 900;
          }
          .brand-text h1 { margin: 0; font-size: 12px; color: #00205B; letter-spacing: 0.3px; }
          .brand-text p { margin: 0; font-size: 8px; color: #666; }
          .doc-title { text-align: right; }
          .doc-title h2 { margin: 0; font-size: 13px; color: #00205B; font-weight: 800; }
          .doc-title .sub { font-size: 8px; color: #666; }
          .doc-title .num { font-family: monospace; font-size: 10px; color: #111; margin-top: 1px; font-weight: 700; }

          .grid { display: grid; gap: 4px; margin-bottom: 6px; }
          .grid-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-3 { grid-template-columns: repeat(3, 1fr); }
          .grid-4 { grid-template-columns: repeat(4, 1fr); }

          .box {
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 3px 6px;
            background: #fafafa;
          }
          .box .label {
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #777;
            font-weight: 700;
            margin-bottom: 1px;
          }
          .box .value {
            font-size: 9px;
            color: #111;
            font-weight: 600;
            word-break: break-word;
          }
          .box .value.mono { font-family: 'Courier New', monospace; }

          .section-title {
            background: #00205B;
            color: white;
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            padding: 3px 6px;
            border-radius: 2px;
            margin-top: 6px;
            margin-bottom: 4px;
          }

          .step-block {
            border: 1px solid #00205B;
            border-radius: 4px;
            margin-bottom: 5px;
            overflow: hidden;
          }
          .step-header {
            background: #00205B;
            color: white;
            padding: 3px 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 9px;
            font-weight: 700;
          }
          .step-header .num {
            width: 16px; height: 16px;
            border-radius: 50%;
            background: white;
            color: #00205B;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 900;
            flex-shrink: 0;
          }
          .step-header .badge {
            background: rgba(255,255,255,0.2);
            padding: 1px 6px;
            border-radius: 8px;
            font-size: 8px;
          }
          .step-header .res {
            padding: 1px 6px;
            border-radius: 8px;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .step-header .res.nil      { background: #009F4D; color: white; }
          .step-header .res.findings { background: #E4002B; color: white; }

          .step-body {
            padding: 4px 8px;
            background: #fafafa;
            display: grid;
            gap: 4px;
          }
          .step-body .row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          .step-body .label {
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #777;
            font-weight: 700;
            margin-bottom: 1px;
          }
          .step-body .val {
            font-size: 9px;
            font-weight: 600;
          }
          .step-body .chips { display: flex; flex-wrap: wrap; gap: 3px; }
          .step-body .chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 1px 6px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            font-size: 8px;
            font-weight: 600;
          }
          .step-body .chip .mono { font-family: 'Courier New', monospace; }
          .step-body .chip .cal { color: #FE5000; }
          .step-body .chip .sn { color: #666; }

          .findings-box {
            border: 1px solid #E4002B;
            border-radius: 3px;
            padding: 4px 6px;
            background: #fff5f5;
            font-size: 9px;
            white-space: pre-wrap;
            color: #7a0015;
          }

          .texto-largo {
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 4px 6px;
            background: #fafafa;
            font-size: 9px;
            min-height: 20px;
            white-space: pre-wrap;
          }

          .firma-box {
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 6px 8px;
            min-height: 60px;
            position: relative;
            margin-top: 8px;
          }
          .firma-box .firma-label {
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #777;
            font-weight: 700;
          }
          .firma-box .firma-nombre {
            font-size: 10px;
            font-weight: 700;
            margin-top: 3px;
          }
          .firma-box .firma-info {
            font-size: 8px;
            color: #666;
            margin-top: 1px;
          }
          .firma-box .linea {
            position: absolute;
            bottom: 8px;
            left: 8px;
            right: 8px;
            border-top: 1px solid #ccc;
          }

          .footer {
            margin-top: 8px;
            padding-top: 4px;
            border-top: 1px solid #ccc;
            font-size: 7px;
            color: #999;
            text-align: center;
          }

          .barcode { text-align: center; margin-top: 4px; }
        </style>
      </head>
      <body>${content}</body>
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
            <div className="page p-6">
              {/* HEADER */}
              <div className="head">
                <div className="brand">
                  <div className="brand-logo">I</div>
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

              {/* IDENTIFICACIÓN Y CERTIFICACIÓN en 2 columnas compactas */}
              <div className="grid grid-2">
                <div>
                  <div className="section-title">Identificación</div>
                  <div className="grid grid-3">
                    <Box label="N° Informe" value={informe.numero_informe} mono />
                    <Box label="N° SAP" value={informe.numero_sap || '—'} mono />
                    <Box label="Revisión" value={`Rev. ${informe.revision ?? 1}`} />
                  </div>
                </div>
                <div>
                  <div className="section-title">Certificación</div>
                  <div className="grid grid-3">
                    <Box label="Instalación" value={estacionMostrar} />
                    <Box label="EASA Ref." value={informe.easa_ref || '—'} mono />
                    <Box label="UK CAA Ref." value={informe.uk_caa_ref || '—'} mono />
                  </div>
                </div>
              </div>

              {/* AERONAVE / COMPONENTE */}
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

              {/* NTM / STEPS */}
              <div className="section-title">Inspecciones realizadas (NTM / Steps)</div>
              {ntmSteps.length === 0 ? (
                <div className="texto-largo" style={{ textAlign: 'center', fontStyle: 'italic', color: '#999' }}>
                  Sin normas NTM asignadas
                </div>
              ) : (
                <div>
                  {ntmSteps.map((s, i) => (
                    <div key={i} className="step-block">
                      <div className="step-header">
                        <div className="num">{i + 1}</div>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.ntm || 'Sin NTM'}{s.step ? ` · ${s.step}` : ''}
                        </span>
                        {s.metodo && <span className="badge">{s.metodo}</span>}
                        <span style={{ fontSize: 8, opacity: 0.9 }}>📅 {fmtFecha(s.fecha)}</span>
                        <span className={`res ${s.resultado === 'FINDINGS' ? 'findings' : 'nil'}`}>
                          {s.resultado}
                        </span>
                      </div>

                      <div className="step-body">
                        <div className="row">
                          <div>
                            <div className="label">Inspector</div>
                            <div className="val">{s.inspector_nombre || '—'}</div>
                          </div>
                          <div>
                            <div className="label">Fecha realización</div>
                            <div className="val">{fmtFecha(s.fecha)}</div>
                          </div>
                        </div>

                        <div>
                          <div className="label">Equipos utilizados</div>
                          {s.equipos.length === 0 ? (
                            <div style={{ fontSize: 8, fontStyle: 'italic', color: '#999' }}>Sin equipos</div>
                          ) : (
                            <div className="chips">
                              {s.equipos.map((eq: any, idx: number) => (
                                <span key={idx} className="chip">
                                  <span className="mono">{eq.id_equipo ?? '—'}</span>
                                  <span>·</span>
                                  <span>{eq.nombre}</span>
                                  {eq.numero_serie && (
                                    <>
                                      <span>·</span>
                                      <span className="mono sn">S/N {eq.numero_serie}</span>
                                    </>
                                  )}
                                  {eq.proxima_calibracion && (
                                    <>
                                      <span>·</span>
                                      <span className="cal">📅 {fmtFecha(eq.proxima_calibracion)}</span>
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="label">Probetas utilizadas</div>
                          {s.probetas.length === 0 ? (
                            <div style={{ fontSize: 8, fontStyle: 'italic', color: '#999' }}>Sin probetas</div>
                          ) : (
                            <div className="chips">
                              {s.probetas.map((pb: any, idx: number) => (
                                <span key={idx} className="chip">
                                  <span className="mono">P/N {pb.pn ?? '—'}</span>
                                  <span>·</span>
                                  <span>{pb.nombre}</span>
                                  {pb.numero_serie && (
                                    <>
                                      <span>·</span>
                                      <span className="mono sn">S/N {pb.numero_serie}</span>
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {s.resultado === 'FINDINGS' && s.findings_text && (
                          <div>
                            <div className="label">Findings detectados</div>
                            <div className="findings-box">{s.findings_text}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* OBSERVACIONES */}
              {informe.observaciones && (
                <>
                  <div className="section-title">Observaciones</div>
                  <div className="texto-largo">{informe.observaciones}</div>
                </>
              )}

              {/* FIRMA + BARCODE EN LA MISMA FILA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginTop: 8 }}>
                <div className="firma-box" style={{ marginTop: 0 }}>
                  <div className="firma-label">Inspector responsable del informe</div>
                  <div className="firma-nombre">{informe.inspector_nombre || '—'}</div>
                  <div className="firma-info">{informe.inspector_email || ''}</div>
                  <div className="linea" />
                </div>
                {informe.numero_informe && (
                  <div className="barcode" style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div>
                      <BarcodeLib
                        value={informe.numero_informe}
                        format="CODE128"
                        displayValue={false}
                        height={30}
                        width={1.1}
                        margin={0}
                        lineColor="#00205B"
                      />
                      <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#666', marginTop: 1, textAlign: 'center' }}>
                        {informe.numero_informe}
                      </div>
                    </div>
                  </div>
                )}
              </div>

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