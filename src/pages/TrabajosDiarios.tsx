import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, Plus, Loader2, Edit3, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

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
  turno: string;
  fecha_turno: string;
  is_fod: boolean;
  orden: number; // <-- NUEVO CAMPO
};

// Datos mock (para que se vea algo si la tabla está vacía)
const MOCK_DATA: Trabajo[] = [
  {
    id: '1', matricula: 'V16957', ibe_doc_ref_nr: 'NP619010', doc_ref_nr: 'R0008710', orden_sap: '41429769',
    descripcion: 'ENGINE TUBE', ndt_meth_tech: 'RT', insp_ndt_acomplished: '653892', fecha_cierre_inspeccion: '2026-11-12',
    resultado_inspeccion: 'NIL', flota: 'V2500-A5', lugar: 'LAB', equipo_pn: null, equipo_sn: null, palpador_pn: null,
    palpador_sn: null, ref_standard_pn: null, turno: 'TURNO DE NOCHE 12/11/2026', fecha_turno: '2026-11-12', is_fod: false, orden: 1
  },
  {
    id: '4', matricula: 'EC-LUO', ibe_doc_ref_nr: 'FR00116', doc_ref_nr: '51-10-08', orden_sap: '6700501671',
    descripcion: 'MET.64283227 WING LH - CORROSION...', ndt_meth_tech: 'ET/UT', insp_ndt_acomplished: '756464\n972921', fecha_cierre_inspeccion: '2026-11-13',
    resultado_inspeccion: 'NIL', flota: 'A32X', lugar: 'H6', equipo_pn: 'ELOTEST M2-5', equipo_sn: 'A019WF', palpador_pn: '314P24', palpador_sn: '17F00ANZ', ref_standard_pn: '29A029', turno: 'TURNO DE MAÑANA 13/11/2026', fecha_turno: '2026-11-13', is_fod: false, orden: 1
  },
];

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

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
        .order('orden', { ascending: true }) // <-- Ordenamos por el nuevo campo
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
    // Aseguramos que dentro de cada grupo estén ordenados por 'orden'
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    });
    return groups;
  }, [filtered]);

  // --------------------------------------------------------
  // Eliminar Trabajo
  // --------------------------------------------------------
  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este trabajo diario?')) return;
    try {
      const { error } = await supabase.from('trabajos_diarios').delete().eq('id', id);
      if (error) throw error;
      setTrabajos((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // --------------------------------------------------------
  // Subir / Bajar Línea
  // --------------------------------------------------------
  const handleMove = async (e: React.MouseEvent, trabajo: Trabajo, direction: 'up' | 'down', groupItems: Trabajo[]) => {
    e.stopPropagation(); // Evita que se abra el editor al hacer clic en la flecha
    
    const index = groupItems.findIndex(t => t.id === trabajo.id);
    if (direction === 'up' && index > 0) {
      const target = groupItems[index - 1];
      await swapOrder(trabajo, target);
    } else if (direction === 'down' && index < groupItems.length - 1) {
      const target = groupItems[index + 1];
      await swapOrder(trabajo, target);
    }
  };

  const swapOrder = async (a: Trabajo, b: Trabajo) => {
    // Si por lo que sea no tienen orden, usamos 0
    const aOrden = a.orden ?? 0;
    const bOrden = b.orden ?? 0;
    
    // Actualizamos en Supabase (intercambiamos valores)
    await Promise.all([
      supabase.from('trabajos_diarios').update({ orden: bOrden }).eq('id', a.id),
      supabase.from('trabajos_diarios').update({ orden: aOrden }).eq('id', b.id)
    ]);
    
    // Actualizamos el estado local para que se mueva visualmente al instante
    setTrabajos((prev) => 
      prev.map(t => {
        if (t.id === a.id) return { ...t, orden: bOrden };
        if (t.id === b.id) return { ...t, orden: aOrden };
        return t;
      })
    );
  };

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
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">INSPECTORES<br/>NDT</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Fecha Cierre<br/>Inspeccion</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Resultado inspeccion</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Flota</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Lugar</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Equipo P/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Equipo S/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Palpador P/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Palpador S/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Ref Standard P/N</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold bg-[#425b91] w-32">Acciones</th>
              </tr>
            </thead>
            
            {Object.entries(grouped).map(([turno, rows]) => (
              <tbody key={turno} className="divide-y divide-gray-300 border-b-2 border-gray-400">
                <tr>
                  <td colSpan={17} className="bg-white text-center font-bold text-[#2563eb] py-2 border border-gray-300 text-xs">
                    {turno}
                  </td>
                </tr>
                
                {rows.map((t, idx) => {
                  const bgRow = t.is_fod ? 'bg-[#ffff00]' : 'bg-white hover:bg-gray-50';
                  const isFirst = idx === 0;
                  const isLast = idx === rows.length - 1;

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
                      
                      {/* BOTONES DE ACCIÓN */}
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          
                          {/* FLECHAS DE ORDENACIÓN */}
                          <div className="flex flex-col mr-1">
                            <button
                              onClick={(e) => handleMove(e, t, 'up', rows)}
                              disabled={isFirst}
                              className={`p-0.5 rounded transition-colors ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-200 hover:text-airbus-blue'}`}
                              title="Subir línea"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleMove(e, t, 'down', rows)}
                              disabled={isLast}
                              className={`p-0.5 rounded transition-colors ${isLast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-200 hover:text-airbus-blue'}`}
                              title="Bajar línea"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* EDITAR Y ELIMINAR */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/trabajos-diarios/editar/${t.id}`);
                            }}
                            className="p-1.5 text-airbus-blue hover:bg-airbus-blue/10 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(t.id);
                            }}
                            className="p-1.5 text-airbus-red hover:bg-airbus-red/10 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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