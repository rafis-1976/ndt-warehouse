import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Printer, X, CheckCircle2, XCircle, AlertTriangle, Clock,
} from 'lucide-react';
import BarcodeLib from 'react-barcode';

interface InformeDetalleProps {
  informe: any;
  onClose: () => void;
}

const METODO_NOMBRE: Record<string, string> = {
  UT: 'Ultrasonic Testing',
  RT: 'Radiographic Testing',
  ET: 'Eddy Current Testing',
  TT: 'Thermographic Testing',
  MT: 'Magnetic Particle Testing',
  PT: 'Penetrant Testing',
};

export function InformeDetalle({ informe, onClose }: InformeDetalleProps) {
  const [equipo, setEquipo] = useState<any>(null);
  const [probeta, setProbeta] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [eqRes, pbRes] = await Promise.all([
        informe.equipo_id
          ? supabase
              .from('equipos')
              .select('id_equipo, nombre, codigo_barras, marca, modelo, numero_serie, tecnicas_ndt(codigo, nombre), ultima_calibracion, proxima_calibracion')
              .eq('id', informe.equipo_id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
        informe.probeta_id
          ? supabase
              .from('probetas')
              .select('pn, nombre, numero_serie, codigo_barras, material, dimensiones, tecnicas_ndt(codigo), carros(codigo, nombre)')
              .eq('id', informe.probeta_id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setEquipo(eqRes.data);
      setProbeta(pbRes.data);
      setCargando(false);
    }
    load();
  }, [informe.id, informe.equipo_id, informe.probeta_id]);

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

          .metodos {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
          }
          .metodo {
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 4px 10px;
            font-weight: 700;
            font-size: 10px;
            background: white;
            color: #999;
          }
          .metodo.activo {
            background: #00205B;
            color: white;
            border-color: #00205B;
          }

          .resultado {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 12px;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .resultado.aprobado { background: #009F4D; color: white; }
          .resultado.rechazado { background: #E4002B; color: white; }
          .resultado.condicional { background: #FE5000; color: white; }
          .resultado.pendiente { background: #666; color: white; }

          .texto-largo {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px;
            background: #fafafa;
            font-size: 10px;
            min-height: 30px;
            white-space: pre-wrap;
          }

          .firmas {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 20px;
          }
          .firma-box {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            min-height: 80px;
            position: relative;
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

          .sello {
            border: 2px dashed #00205B;
            border-radius: 6px;
            padding: 10px;
            text-align: center;
            color: #00205B;
            font-weight: 800;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: #f0f7ff;
          }

          .footer {
            margin-top: 16px;
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
          <div ref={printRef} className="p-6">
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

            {/* IDENTIFICACIÓN */}
            <div className="section-title">Identificación</div>
            <div className="grid grid-4">
              <Box label="N° Informe" value={informe.numero_informe} mono />
              <Box label="N° SAP" value={informe.numero_sap || '—'} mono />
              <Box label="Revisión" value={`Rev. ${informe.revision ?? 1}`} />
              <Box
                label="Fecha Inspección"
                value={informe.fecha_inspeccion
                  ? new Date(informe.fecha_inspeccion).toLocaleDateString('es-ES')
                  : '—'}
              />
            </div>

            {/* AVIÓN / COMPONENTE */}
            <div className="section-title">Aeronave / Componente</div>
            <div className="grid grid-3">
              <Box label="Matrícula (A/C)" value={informe.matricula || '—'} mono />
              <Box label="Modelo" value={informe.modelo_aeronave || '—'} />
              <Box label="N° Serie A/C" value={informe.numero_serie_aeronave || '—'} mono />
              <Box label="Componente" value={informe.componente || '—'} />
              <Box label="FR" value={informe.numero_fr || '—'} mono />
              <Box label="Zona" value={informe.zona || '—'} />
            </div>

            {/* CERTIFICACIÓN */}
            <div className="section-title">Certificación y Aprobación</div>
            <div className="grid grid-4">
              <Box label="Instalación" value={informe.estacion || '—'} />
              <Box label="EASA Ref." value={informe.easa_ref || '—'} mono />
              <Box label="UK CAA Ref." value={informe.uk_caa_ref || '—'} mono />
              <Box label="Operador" value={informe.operador || '—'} />
            </div>

            {/* MÉTODO NDT */}
            <div className="section-title">Método END (NDT Method)</div>
            <div className="metodos">
              {Object.entries(METODO_NOMBRE).map(([cod, nombre]) => (
                <div
                  key={cod}
                  className={`metodo ${informe.metodo === cod ? 'activo' : ''}`}
                  title={nombre}
                >
                  {cod}
                </div>
              ))}
            </div>

            {/* NTM */}
            <div className="section-title">Norma NTM</div>
            <div className="grid grid-2">
              <Box label="NTM Doc. Ref." value={informe.ntm_referencia || '—'} mono />
              <Box label="Step NTM" value={informe.ntm_step || '—'} mono />
            </div>

            {/* EQUIPO */}
            {equipo && (
              <>
                <div className="section-title">Equipo NDT Utilizado</div>
                <div className="grid grid-4">
                  <Box label="ID Equipo" value={equipo.id_equipo || '—'} mono />
                  <Box label="Nombre" value={equipo.nombre || '—'} />
                  <Box label="Marca / Modelo" value={`${equipo.marca ?? ''} ${equipo.modelo ?? ''}`.trim() || '—'} />
                  <Box label="N° Serie" value={equipo.numero_serie || '—'} mono />
                  <Box label="Técnica" value={equipo.tecnicas_ndt?.codigo || '—'} />
                  <Box label="Última calibración" value={equipo.ultima_calibracion || '—'} />
                  <Box label="Próx. calibración" value={equipo.proxima_calibracion || '—'} />
                  <Box label="Código barras" value={equipo.codigo_barras || '—'} mono />
                </div>
              </>
            )}

            {/* PROBETA */}
            {probeta && (
              <>
                <div className="section-title">Probeta de Calibración</div>
                <div className="grid grid-4">
                  <Box label="P/N" value={probeta.pn || '—'} mono />
                  <Box label="S/N" value={probeta.numero_serie || '—'} mono />
                  <Box label="Nombre" value={probeta.nombre || '—'} />
                  <Box label="Técnica" value={probeta.tecnicas_ndt?.codigo || '—'} />
                  <Box label="Material" value={probeta.material || '—'} />
                  <Box label="Dimensiones" value={probeta.dimensiones || '—'} />
                  <Box label="Carro" value={probeta.carros?.codigo || '—'} mono />
                  <Box label="Código barras" value={probeta.codigo_barras || '—'} mono />
                </div>
              </>
            )}

            {/* RESULTADO */}
            <div className="section-title">Resultado de la Inspección</div>
            <div className="mb-3">
              <div className={`resultado ${informe.resultado || 'pendiente'}`}>
                {informe.resultado === 'aprobado' && '✓ Aprobado'}
                {informe.resultado === 'rechazado' && '✗ Rechazado'}
                {informe.resultado === 'condicional' && '⚠ Condicional'}
                {informe.resultado === 'pendiente' && '● Pendiente'}
              </div>
            </div>

            {informe.hallazgos && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 3, textTransform: 'uppercase', color: '#666', letterSpacing: 0.5 }}>
                  Hallazgos
                </div>
                <div className="texto-largo">{informe.hallazgos}</div>
              </>
            )}

            {informe.conclusion && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 3, textTransform: 'uppercase', color: '#666', letterSpacing: 0.5 }}>
                  Conclusión
                </div>
                <div className="texto-largo">{informe.conclusion}</div>
              </>
            )}

            {informe.observaciones && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 3, textTransform: 'uppercase', color: '#666', letterSpacing: 0.5 }}>
                  Observaciones
                </div>
                <div className="texto-largo">{informe.observaciones}</div>
              </>
            )}

            {/* FIRMAS */}
            <div className="firmas">
              <div className="firma-box">
                <div className="firma-label">Inspector / Firmante</div>
                <div className="firma-nombre">{informe.inspector_nombre || '—'}</div>
                <div className="firma-info">
                  Licencia: {informe.inspector_licencia || '—'}
                </div>
                <div className="firma-info">{informe.inspector_email || ''}</div>
                <div className="linea" />
              </div>
              <div className="firma-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="sello">{informe.sello_texto || 'IBERIA MANTENIMIENTO · NDT'}</div>
              </div>
            </div>

            {/* BARCODE */}
            {informe.numero_informe && (
              <div className="barcode">
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

            {/* FOOTER */}
            <div className="footer">
              Documento generado automáticamente por NDT Warehouse · {new Date().toLocaleString('es-ES')}
              {informe.estado && ` · Estado: ${informe.estado.toUpperCase()}`}
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