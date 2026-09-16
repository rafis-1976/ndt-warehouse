import { useEffect, useRef, useState } from 'react';
import {
  Printer, X, CheckCircle2, XCircle, AlertTriangle, Clock,
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
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #111;
            font-size: 10px;
            line-height: 1.35;
            margin: 0;
            padding: 0;
            background: white;
          }
          .page {
            page-break-after: always;
            padding: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .page:last-child { page-break-after: auto; }
          .head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #00205B;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-logo {
            width: 48px; height: 48px;
            background: #00205B; color: #74D2E7;
            display: flex; align-items: center; justify-content: center;
            border-radius: 8px; font-size: 22px; font-weight: 900;
          }
          .brand-text h1 { margin: 0; font-size: 14px; color: #00205B; letter-spacing: 0.5px; }
          .brand-text p { margin: 1px 0 0; font-size: 9px; color: #666; }
          .doc-title { text-align: right; }
          .doc-title h2 { margin: 0; font-size: 15px; color: #00205B; font-weight: 800; }
          .doc-title .sub { font-size: 9px; color: #666; }
          .doc-title .num { font-family: monospace; font-size: 11px; color: #111; margin-top: 2px; font-weight: 700; }
          .doc-title .pagina { font-size: 9px; color: #666; margin-top: 2px; font-weight: 600; }
          .grid { display: grid; gap: 6px; margin-bottom: 10px; }
          .grid-3 { grid-template-columns: repeat(3, 1fr); }
          .grid-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-4 { grid-template-columns: repeat(4, 1fr); }
          .box {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 6px 8px;
            background: #fafafa;
          }
          .box .label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #777;
            font-weight: 700;
            margin-bottom: 2px;
          }
          .box .value {
            font-size: 10px;
            color: #111;
            font-weight: 600;
            word-break: break-word;
          }
          .box .value.mono { font-family: 'Courier New', monospace; }
          .section-title {
            background: #00205B;
            color: white;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 4px 8px;
            border-radius: 3px;
            margin-top: 10px;
            margin-bottom: 6px;
          }
          .step-block {
            border: 1px solid #00205B;
            border-radius: 6px;
            margin-bottom: 10px;
            overflow: hidden;
          }
          .step-header {
            background: #00205B;
            color: white;
            padding: 6px 10px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 10px;
            font-weight: 700;
          }
          .step-header .num {
            width: 20px; height: 20px;
            border-radius: 50%;
            background: white;
            color: #00205B;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 900;
          }
          .step-header .badge {
            background: rgba(255,255,255,0.2);
            padding: 1px 8px;
            border-radius: 10px;
            font-size: 9px;
          }
          .step-header .fecha {
            margin-left: auto;
            font-size: 9px;
            opacity: 0.9;
          }
          .step-header .res {
            padding: 1px 8px;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .step-header .res.aprobado    { background: #009F4D; color: white; }
          .step-header .res.condicional { background: #FE5000; color: white; }
          .step-header .res.rechazado   { background: #E4002B; color: white; }
          .step-header .res.pendiente   { background: #666; color: white; }
          .step-body { padding: 8px 10px; background: #fafafa; }
          .step-body .row { margin-bottom: 6px; }
          .step-body .row:last-child { margin-bottom: 0; }
          .step-body .label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #777;
            font-weight: 700;
            margin-bottom: 2px;
          }
          .step-body .val {
            font-size: 10px;
            font-weight: 600;
            font-family: 'Courier New', monospace;
          }
          .step-body .chips { display: flex; flex-wrap: wrap; gap: 4px; }
          .step-body .chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 10px;
            font-size: 9px;
            font-weight: 600;
          }
          .step-body .chip .mono { font-family: 'Courier New', monospace; }
          .empty-chips {
            font-size: 9px;
            font-style: italic;
            color: #999;
          }
          .texto-largo {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px;
            background: #fafafa;
            font-size: 10px;
            min-height: 30px;
            white-space: pre-wrap;
          }
          .firma-box {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            min-height: 100px;
            position: relative;
            margin-top: 20px;
          }
          .firma-box .firma-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #777;
            font-weight: 700;
          }
          .firma-box .firma-nombre {
            font-size: 11px;
            font-weight: 700;
            margin-top: 4px;
          }
          .firma-box .firma-info {
            font-size: 9px;
            color: #666;
            margin-top: 2px;
          }
          .firma-box .linea {
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            border-top: 1px solid #ccc;
          }
          .footer {
            margin-top: auto;
            padding-top: 8px;
            border-top: 1px solid #ccc;
            font-size: 8px;
            color: #999;
            text-align: center;
          }
          .barcode { text-align: center; margin-top: 6px; }
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
        .map((s: any) => ({
          ntm: String(s.ntm ?? '').trim(),
          step: String(s.step ?? '').trim(),
          metodo: String(s.metodo ?? '').trim(),
          fecha: String(s.fecha ?? '').trim(),
          resultado: String(s.resultado ?? 'pendiente').trim(),
          equipos: Array.isArray(s.equipos) ? s.equipos : [],
          probetas: Array.isArray(s.probetas) ? s.probetas : [],
          inspector_nombre: String(s.inspector_nombre ?? '').trim(),
        }))
        .filter((s: any) => s.ntm || s.step || s.equipos.length > 0 || s.probetas.length > 0);
    }
    if (informe.ntm_referencia || informe.ntm_step) {
      return [
        {
          ntm: String(informe.ntm_referencia ?? '').trim(),
          step: String(informe.ntm_step ?? '').trim(),
          metodo: String(informe.metodo ?? '').trim(),
          fecha: String(informe.fecha_inspeccion ?? '').trim(),
          resultado: String(informe.resultado ?? 'pendiente').trim(),
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

  const ResultadoIcone = () => {
    if (informe.resultado === 'aprobado') return <CheckCircle2 className="w-5 h-5" />;
    if (informe.resultado === 'rechazado') return <XCircle className="w-5 h-5" />;
    if (informe.resultado === 'condicional') return <AlertTriangle className="w-5 h-5" />;
    return <Clock className="w-5 h-5" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <ResultadoIcone />
          <span className="text-sm font-semibold text-gray-700">
            Informe {informe.numero_informe}
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
            {/* PÁGINA 1 */}
            <div className="page p-6">
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
                  <div className="pagina">Página 1 de 2</div>
                </div>
              </div>

              <div className="section-title">Identificación</div>
              <div className="grid grid-3">
                <Box label="N° Informe" value={informe.numero_informe} mono />
                <Box label="N° SAP" value={informe.numero_sap || '—'} mono />
                <Box label="Revisión" value={`Rev. ${informe.revision ?? 1}`} />
              </div>

              <div className="section-title">Aeronave / Componente</div>
              <div className="grid grid-3">
                <Box label="Matrícula (A/C)" value={informe.matricula || '—'} mono />
                <Box label="Modelo" value={informe.modelo_aeronave || '—'} />
                <Box label="N° Serie A/C" value={informe.numero_serie_aeronave || '—'} mono />
                <Box label="Componente" value={informe.componente || '—'} />
                <Box label="FR" value={informe.numero_fr || '—'} mono />
                <Box label="Zona" value={informe.zona || '—'} />
              </div>

              <div className="section-title">Certificación y Aprobación</div>
              <div className="grid grid-4">
                <Box label="Instalación" value={estacionMostrar} />
                <Box label="EASA Ref." value={informe.easa_ref || '—'} mono />
                <Box label="UK CAA Ref." value={informe.uk_caa_ref || '—'} mono />
                <Box label="Operador" value={informe.operador || '—'} />
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
                      <div className="step-header">
                        <div className="num">{i + 1}</div>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.ntm || 'Sin NTM'}{s.step ? ` · ${s.step}` : ''}
                        </span>
                        {s.metodo && <span className="badge">{s.metodo}</span>}
                        {s.fecha && (
                          <span className="fecha">📅 {fmtFecha(s.fecha)}</span>
                        )}
                        {s.resultado && (
                          <span className={`res ${s.resultado}`}>{s.resultado}</span>
                        )}
                      </div>

                      <div className="step-body">
                        <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div>
                            <div className="label">NTM Doc. Ref.</div>
                            <div className="val">{s.ntm || '—'}</div>
                          </div>
                          <div>
                            <div className="label">Step</div>
                            <div className="val">{s.step || '—'}</div>
                          </div>
                          <div>
                            <div className="label">Fecha realización</div>
                            <div className="val">{fmtFecha(s.fecha)}</div>
                          </div>
                        </div>

                        <div className="row">
                          <div className="label">Equipos utilizados</div>
                          {s.equipos.length === 0 ? (
                            <div className="empty-chips">Sin equipos asignados</div>
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
                                      <span className="mono">S/N {eq.numero_serie}</span>
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="row">
                          <div className="label">Probetas utilizadas</div>
                          {s.probetas.length === 0 ? (
                            <div className="empty-chips">Sin probetas asignadas</div>
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
                                      <span className="mono">S/N {pb.numero_serie}</span>
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="row">
                          <div className="label">Inspector</div>
                          <div className="val" style={{ fontFamily: 'inherit' }}>
                            {s.inspector_nombre || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {informe.hallazgos && (
                <>
                  <div className="section-title">Hallazgos</div>
                  <div className="texto-largo">{informe.hallazgos}</div>
                </>
              )}

              {informe.conclusion && (
                <>
                  <div className="section-title">Conclusión</div>
                  <div className="texto-largo">{informe.conclusion}</div>
                </>
              )}

              {informe.observaciones && (
                <>
                  <div className="section-title">Observaciones</div>
                  <div className="texto-largo">{informe.observaciones}</div>
                </>
              )}

              <div className="firma-box">
                <div className="firma-label">Inspector responsable del informe</div>
                <div className="firma-nombre">{informe.inspector_nombre || '—'}</div>
                <div className="firma-info">{informe.inspector_email || ''}</div>
                <div className="linea" />
              </div>

              <div className="footer">
                Documento generado automáticamente por NDT Warehouse · {new Date().toLocaleString('es-ES')}
                {informe.estado && ` · Estado: ${informe.estado.toUpperCase()}`}
              </div>
            </div>

            {/* PÁGINA 2 */}
            <div className="page p-6">
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
                  <div className="pagina">Página 2 de 2</div>
                </div>
              </div>

              <div className="section-title">Resumen de la inspección</div>
              <div className="grid grid-3">
                <Box label="N° Informe" value={informe.numero_informe} mono />
                <Box label="N° NTM/Steps" value={String(ntmSteps.length)} />
                <Box label="Instalación" value={estacionMostrar} />
              </div>

              <div className="section-title">Trazabilidad de NTM / Steps</div>
              {ntmSteps.length === 0 ? (
                <div className="texto-largo" style={{ textAlign: 'center', fontStyle: 'italic', color: '#999' }}>
                  Sin normas NTM asignadas
                </div>
              ) : (
                <div>
                  {ntmSteps.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        padding: '6px 10px',
                        background: '#fafafa',
                        marginBottom: 6,
                        display: 'grid',
                        gridTemplateColumns: '30px 1fr 70px 80px 90px 100px',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 22, height: 22,
                          borderRadius: '50%',
                          background: '#00205B', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700 }}>
                          {s.ntm || '—'}{s.step ? ` · ${s.step}` : ''}
                        </div>
                        <div style={{ fontSize: 8, color: '#666', marginTop: 1 }}>
                          {s.equipos.length} eq · {s.probetas.length} pb
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            background: '#00205B', color: 'white',
                            fontSize: 9, fontWeight: 700,
                            padding: '2px 8px', borderRadius: 10,
                          }}
                        >
                          {s.metodo || '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: 8, color: '#666', textAlign: 'center' }}>
                        {fmtFecha(s.fecha)}
                      </div>
                      <div style={{ fontSize: 8, color: '#666', textAlign: 'center' }}>
                        {s.inspector_nombre || '—'}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: 9, fontWeight: 800,
                            padding: '2px 8px', borderRadius: 10,
                            textTransform: 'uppercase',
                            background:
                              s.resultado === 'aprobado' ? '#009F4D'
                              : s.resultado === 'condicional' ? '#FE5000'
                              : s.resultado === 'rechazado' ? '#E4002B'
                              : '#666',
                            color: 'white',
                          }}
                        >
                          {s.resultado || '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="section-title">Firmas</div>
              <div className="firma-box">
                <div className="firma-label">Inspector responsable del informe</div>
                <div className="firma-nombre">{informe.inspector_nombre || '—'}</div>
                <div className="firma-info">{informe.inspector_email || ''}</div>
                <div className="linea" />
              </div>

              {informe.numero_informe && (
                <div className="barcode" style={{ marginTop: 12 }}>
                  <BarcodeLib
                    value={informe.numero_informe}
                    format="CODE128"
                    displayValue={false}
                    height={40}
                    width={1.5}
                    margin={0}
                    lineColor="#00205B"
                  />
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#666', marginTop: 2 }}>
                    {informe.numero_informe}
                  </div>
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