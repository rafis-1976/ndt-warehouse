import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft, Save, Loader2, AlertCircle
} from 'lucide-react';

export function TrabajoDiarioEditar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    turno_base: 'TURNO DE MAÑANA', // Guardamos el turno sin la fecha para el select
    fecha_turno: '',
    matricula: '',
    ibe_doc_ref_nr: '',
    doc_ref_nr: '',
    orden_sap: '',
    descripcion: '',
    ndt_meth_tech: '',
    insp_ndt_acomplished: '',
    fecha_cierre_inspeccion: '',
    resultado_inspeccion: '',
    flota: '',
    lugar: '',
    equipo_pn: '',
    equipo_sn: '',
    palpador_pn: '',
    palpador_sn: '',
    ref_standard_pn: '',
    sello: '',
    hh: '',
    is_fod: false,
  });

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  // --------------------------------------------------------
  // Cargar datos del registro
  // --------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      
      const { data, error } = await supabase
        .from('trabajos_diarios')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setError('No se pudo cargar el trabajo diario.');
        setLoading(false);
        return;
      }

      // Extraer el turno base de la cadena (ej. "TURNO DE MAÑANA 13/11/2026" -> "TURNO DE MAÑANA")
      let turnoBase = 'TURNO DE MAÑANA';
      if (data.turno.includes('TARDE')) turnoBase = 'TURNO DE TARDE';
      if (data.turno.includes('NOCHE')) turnoBase = 'TURNO DE NOCHE';

      setForm({
        turno_base: turnoBase,
        fecha_turno: data.fecha_turno,
        matricula: data.matricula || '',
        ibe_doc_ref_nr: data.ibe_doc_ref_nr || '',
        doc_ref_nr: data.doc_ref_nr || '',
        orden_sap: data.orden_sap || '',
        descripcion: data.descripcion || '',
        ndt_meth_tech: data.ndt_meth_tech || '',
        insp_ndt_acomplished: data.insp_ndt_acomplished || '',
        fecha_cierre_inspeccion: data.fecha_cierre_inspeccion || '',
        resultado_inspeccion: data.resultado_inspeccion || '',
        flota: data.flota || '',
        lugar: data.lugar || '',
        equipo_pn: data.equipo_pn || '',
        equipo_sn: data.equipo_sn || '',
        palpador_pn: data.palpador_pn || '',
        palpador_sn: data.palpador_sn || '',
        ref_standard_pn: data.ref_standard_pn || '',
        sello: data.sello || '',
        hh: data.hh || '',
        is_fod: data.is_fod || false,
      });
      setLoading(false);
    }
    loadData();
  }, [id]);

  // --------------------------------------------------------
  // Guardar cambios
  // --------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.fecha_turno) {
      return setError('La fecha del turno es obligatoria');
    }

    setSaving(true);
    try {
      // Formatear fecha y turno
      const [y, m, d] = form.fecha_turno.split('-');
      const fechaFmt = `${d}/${m}/${y}`;
      const turnoCompleto = `${form.turno_base.trim().toUpperCase()} ${fechaFmt}`;

      const payload = {
        turno: turnoCompleto,
        fecha_turno: form.fecha_turno,
        matricula: form.matricula.trim() || null,
        ibe_doc_ref_nr: form.ibe_doc_ref_nr.trim() || null,
        doc_ref_nr: form.doc_ref_nr.trim() || null,
        orden_sap: form.orden_sap.trim() || null,
        descripcion: form.descripcion.trim() || null,
        ndt_meth_tech: form.ndt_meth_tech.trim() || null,
        insp_ndt_acomplished: form.insp_ndt_acomplished.trim() || null,
        fecha_cierre_inspeccion: form.fecha_cierre_inspeccion || null,
        resultado_inspeccion: form.resultado_inspeccion.trim() || null,
        flota: form.flota.trim() || null,
        lugar: form.lugar.trim() || null,
        equipo_pn: form.equipo_pn.trim() || null,
        equipo_sn: form.equipo_sn.trim() || null,
        palpador_pn: form.palpador_pn.trim() || null,
        palpador_sn: form.palpador_sn.trim() || null,
        ref_standard_pn: form.ref_standard_pn.trim() || null,
        sello: form.sello.trim() || null,
        hh: form.hh.trim() || null,
        is_fod: form.is_fod,
      };

      const { error: updErr } = await supabase
        .from('trabajos_diarios')
        .update(payload)
        .eq('id', id);

      if (updErr) throw updErr;

      navigate('/trabajos-diarios');
    } catch (err: any) {
      setError(err.message ?? 'Error al actualizar el trabajo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin" /> Cargando datos...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* CABECERA */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/trabajos-diarios')}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          title="Volver a trabajos diarios"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-airbus-blue">Editar Trabajo Diario</h1>
          <p className="text-sm text-gray-500">
            Modifica los datos del registro de inspección
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* CONFIGURACIÓN DEL TURNO */}
        <div className="card border-l-4 border-airbus-blue bg-airbus-sky/5">
          <h3 className="text-xs uppercase tracking-wide text-airbus-navy font-bold mb-3">
            Configuración del Turno
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Turno *
              </label>
              <select
                className="input"
                value={form.turno_base}
                onChange={(e) => update('turno_base', e.target.value)}
              >
                <option value="TURNO DE MAÑANA">TURNO DE MAÑANA</option>
                <option value="TURNO DE TARDE">TURNO DE TARDE</option>
                <option value="TURNO DE NOCHE">TURNO DE NOCHE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha del Turno *
              </label>
              <input
                type="date"
                className="input"
                value={form.fecha_turno}
                onChange={(e) => update('fecha_turno', e.target.value)}
                required
              />
            </div>
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition w-full">
                <input
                  type="checkbox"
                  checked={form.is_fod}
                  onChange={(e) => update('is_fod', e.target.checked)}
                  className="w-4 h-4 rounded text-airbus-orange focus:ring-airbus-orange"
                />
                <span className="text-sm font-semibold text-gray-700">
                  Fila FOD (Amarilla)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* IDENTIFICACIÓN */}
        <div className="card">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
            Identificación y Referencias
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
              <input className="input" value={form.matricula} onChange={(e) => update('matricula', e.target.value)} placeholder="Ej. EC-LUO" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IBE Doc Ref Nr</label>
              <input className="input" value={form.ibe_doc_ref_nr} onChange={(e) => update('ibe_doc_ref_nr', e.target.value)} placeholder="Ej. FR00116" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doc Ref Nr</label>
              <input className="input" value={form.doc_ref_nr} onChange={(e) => update('doc_ref_nr', e.target.value)} placeholder="Ej. 51-10-08" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden SAP</label>
              <input className="input font-mono text-red-600" value={form.orden_sap} onChange={(e) => update('orden_sap', e.target.value)} placeholder="Ej. 6700501671" />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción de la tarea</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.descripcion}
              onChange={(e) => update('descripcion', e.target.value)}
              placeholder="Ej. MET.64283227 WING LH - CORROSION..."
            />
          </div>
        </div>

        {/* INSPECCIÓN */}
        <div className="card">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
            Datos de la Inspección
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">NDT Meth./Tech.</label>
              <input className="input" value={form.ndt_meth_tech} onChange={(e) => update('ndt_meth_tech', e.target.value)} placeholder="Ej. ET/UT" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resultado</label>
              <input className="input" value={form.resultado_inspeccion} onChange={(e) => update('resultado_inspeccion', e.target.value)} placeholder="Ej. NIL" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Cierre</label>
              <input type="date" className="input" value={form.fecha_cierre_inspeccion} onChange={(e) => update('fecha_cierre_inspeccion', e.target.value)} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Flota</label>
              <input className="input" value={form.flota} onChange={(e) => update('flota', e.target.value)} placeholder="Ej. A32X" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Lugar</label>
              <input className="input" value={form.lugar} onChange={(e) => update('lugar', e.target.value)} placeholder="Ej. H6" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">HH</label>
              <input className="input" value={form.hh} onChange={(e) => update('hh', e.target.value)} placeholder="Horas" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insp NDT Acomplished (S/N órdenes)
              </label>
              <textarea
                className="input resize-none font-mono text-sm"
                rows={2}
                value={form.insp_ndt_acomplished}
                onChange={(e) => update('insp_ndt_acomplished', e.target.value)}
                placeholder="Puedes poner varias líneas..."
              />
            </div>
          </div>
        </div>

        {/* EQUIPAMIENTO */}
        <div className="card">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
            Equipamiento Utilizado
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-xs font-bold text-airbus-blue uppercase">Equipo Principal</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Equipo P/N</label>
                <input className="input" value={form.equipo_pn} onChange={(e) => update('equipo_pn', e.target.value)} placeholder="Ej. ELOTEST M2-5 DAKOTA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Equipo S/N</label>
                <textarea className="input resize-none font-mono text-sm" rows={2} value={form.equipo_sn} onChange={(e) => update('equipo_sn', e.target.value)} />
              </div>
            </div>

            <div className="space-y-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-xs font-bold text-airbus-blue uppercase">Palpador / Sonda</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Palpador P/N</label>
                <input className="input" value={form.palpador_pn} onChange={(e) => update('palpador_pn', e.target.value)} placeholder="Ej. 314P24" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Palpador S/N</label>
                <textarea className="input resize-none font-mono text-sm" rows={2} value={form.palpador_sn} onChange={(e) => update('palpador_sn', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ref Standard P/N</label>
              <textarea className="input resize-none font-mono text-sm" rows={2} value={form.ref_standard_pn} onChange={(e) => update('ref_standard_pn', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sello</label>
              <input className="input" value={form.sello} onChange={(e) => update('sello', e.target.value)} placeholder="Ej. SELLO-1" />
            </div>
          </div>
        </div>

        {/* ERROR Y BOTONES */}
        {error && (
          <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/trabajos-diarios')}
            className="btn-ghost border border-gray-300 w-full sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

      </form>
    </div>
  );
}