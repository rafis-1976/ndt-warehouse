import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, Plus, Loader2, Edit3 } from 'lucide-react';

// ============================================================
// Tipos
// ============================================================
type Trabajo = {
  id: string;
  matricula: string | null;
  ibe_doc_ref_nr: string | null;
  doc_ref_nr: string | null;
  orden_sap: string | null;
  descripcion: string | null;
  ndt_meth_tech: string | null;
  insp_ndt_acomplished: string | null;
  fecha_cierre_inspeccion: string | null;
  resultado_inspeccion: string | null;
  flota: string | null;
  lugar: string | null;
  equipo_pn: string | null;
  equipo_sn: string | null;
  palpador_pn: string | null;
  palpador_sn: string | null;
  ref_standard_pn: string | null;
  sello: string | null;
  hh: string | null;
  turno: string;
  fecha_turno: string;
  is_fod: boolean;
};

// Datos de prueba para que se vea la tabla si está vacía
const MOCK_DATA: Trabajo[] = [
  {
    id: '1', matricula: 'V16957', ibe_doc_ref_nr: 'NP619010', doc_ref_nr: 'R0008710', orden_sap: '41429769',
    descripcion: 'ENGINE TUBE', ndt_meth_tech: 'RT', insp_ndt_acomplished: '653892', fecha_cierre_inspeccion: '2026-11-12',
    resultado_inspeccion: 'NIL', flota: 'V2500-A5', lugar: 'LAB', equipo_pn: null, equipo_sn: null, palpador_pn: null,
    palpador_sn: null, ref_standard_pn: null, sello: null, hh: null, turno: 'TURNO DE NOCHE 12/11/2026', fecha_turno: '2026-11-12', is_fod: false
  },
  {
    id: '4', matricula: 'EC-LUO', ibe_doc_ref_nr: 'FR00116', doc_ref_nr: '51-10-08', orden_sap: '6700501671',
    descripcion: 'MET.64283227 WING LH - CORROSION IN STA3059/RIB06 LH INBOARD FLAP AT TRACK 2. SEE DMR.', ndt_meth_tech: 'ET/UT', insp_ndt_acomplished: '756464\n972921\n471693', fecha_cierre_inspeccion: '2026-11-13',
    resultado_inspeccion: 'NIL', flota: 'A32X', lugar: 'H6', equipo_pn: 'ELOTEST M2-5 DAKOTA CMX DL+', equipo_sn: 'A019WF\n10011', palpador_pn: '314P24 ,187 10MHz', palpador_sn: '17F00ANZ\n432A2', ref_standard_pn: '29A029\n511004PB4', sello: null, hh: null, turno: 'TURNO DE MAÑANA 13/11/2026', fecha_turno: '2026-11-13', is_fod: false
  },
];

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

// ============================================================
// Componente Principal
// ============================================================
export function TrabajosDiarios() {
  const navigate = useNavigate();
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('trabajos_diarios')
        .select('*')
        .order('fecha_turno', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Usando datos mock:', error.message);
        setTrabajos(MOCK_DATA);
      } else if (data && data.length > 0) {
        setTrabajos(data as Trabajo[]);
      } else {
        setTrabajos(MOCK_DATA);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return trabajos;
    const qLower = q.toLowerCase();
    return trabajos.filter((t) => {
      const searchString = [
        t.matricula, t.ibe_doc_ref_nr, t.doc_ref_nr, t.orden_sap, 
        t.descripcion, t.ndt_meth_tech, t.insp_ndt_acomplished,
        t.resultado_inspeccion, t.flota, t.lugar, t.equipo_pn, 
        t.equipo_sn, t.palpador_pn, t.palpador_sn, t.ref_standard_pn,
        t.turno
      ].filter(Boolean).join(' ').toLowerCase();
      return searchString.includes(qLower);
    });
  }, [trabajos, q]);

  const grouped = useMemo(() => {
    const groups: Record<string, Trabajo[]> = {};
    filtered.forEach((t) => {
      if (!groups[t.turno]) groups[t.turno] = [];
      groups[t.turno].push(t);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full overflow-hidden">
      
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Trabajos Diarios</h1>
          <p className="text-sm text-gray-500">Control de inspecciones NDT por turno</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10 w-64"
              placeholder="Buscar trabajo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => navigate('/trabajos-diarios/nuevo')}
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      {/* TABLA */}
      <div className="card p-0 overflow-x-auto border border-gray-300 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No hay trabajos que coincidan con la búsqueda.
          </div>
        ) : (
          <table className="w-full text-[11px] whitespace-nowrap border-collapse">
            <thead>
              <tr className="bg-[#5472b5] text-white">
                <th className="border border-gray-400 px-2 py-1 text-left font-semibold">Matrícula</th>
                <th className="border border-gray-400 px-2 py-1 text-left font-semibold">IBE Doc Ref Nr</th>
                <th className="border border-gray-400 px-2 py-1 text-left font-semibold">Doc Ref Nr</th>
                <th className="border border-gray-400 px-2 py-1 text-left font-semibold">Orden SAP</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold w-1/4">Description</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">NDT<br/>Meth./Tech.</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Insp NDT<br/>Acomplished</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Fecha Cierre<br/>Inspeccion</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Resultado inspeccion</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Flota</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Lugar</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Equipo P/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Equipo S/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Palpador P/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Palpador S/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Ref Standard P/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">SELLO</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">HH</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold bg-[#425b91]">Acciones</th>
              </tr>
            </thead>
            
            {Object.entries(grouped).map(([turno, rows]) => (
              <tbody key={turno} className="divide-y divide-gray-300 border-b-2 border-gray-400">
                <tr>
                  <td colSpan={19} className="bg-white text-center font-bold text-[#2563eb] py-2 border border-gray-300 text-xs">
                    {turno}
                  </td>
                </tr>
                
                {rows.map((t) => {
                  const bgRow = t.is_fod ? 'bg-[#ffff00]' : 'bg-white hover:bg-gray-50';
                  return (
                    <tr 
                      key={t.id} 
                      className={`${bgRow} transition-colors cursor-pointer`}
                      onClick={() => navigate(`/trabajos-diarios/editar/${t.id}`)}
                      title="Haz clic para editar este trabajo"
                    >
                      <td className="border border-gray-300 px-2 py-1">{t.matricula || ''}</td>
                      <td className="border border-gray-300 px-2 py-1">{t.ibe_doc_ref_nr || ''}</td>
                      <td className="border border-gray-300 px-2 py-1">{t.doc_ref_nr || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-red-600 font-bold">{t.orden_sap || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 whitespace-normal break-words min-w-[200px]">
                        {t.descripcion || ''}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.ndt_meth_tech || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-pre-wrap">{t.insp_ndt_acomplished || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{fmtFecha(t.fecha_cierre_inspeccion)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.resultado_inspeccion || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.flota || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.lugar || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-normal break-words max-w-[120px]">{t.equipo_pn || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-pre-wrap">{t.equipo_sn || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-normal break-words max-w-[120px]">{t.palpador_pn || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-pre-wrap">{t.palpador_sn || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-pre-wrap">{t.ref_standard_pn || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.sello || ''}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.hh || ''}</td>
                      
                      {/* BOTÓN DE EDITAR */}
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Evita que se dispare dos veces si hacemos clic en el icono
                            navigate(`/trabajos-diarios/editar/${t.id}`);
                          }}
                          className="p-1.5 text-airbus-blue hover:bg-airbus-blue/10 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        )}
      </div>
    </div>
  );
}