import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Plus, Activity, RefreshCw, Printer, ScanBarcode,
  CheckCircle2, Wrench, XCircle, X, Eye, Edit3
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { SondaForm } from '../components/sondas/SondaForm';
import { SondaDetalle } from '../components/sondas/SondaDetalle';
import { BarcodeScanner } from '../components/BarcodeScanner'; // <-- IMPORT CORREGIDO
import Barcode from 'react-barcode';
import { QRCodeSVG } from '../components/ui/QRCodeSVG';

const estadoBadge: Record<string, string> = {
  disponible: 'badge badge-green',
  mantenimiento: 'badge badge-yellow',
  baja: 'badge badge-red',
};

const estadoLabel: Record<string, string> = {
  disponible: 'Disponible',
  mantenimiento: 'En Reparación',
  baja: 'De Baja',
};

const estadosFiltro = [
  { value: 'disponible', label: 'Disponibles' },
  { value: 'mantenimiento', label: 'En Reparación' },
  { value: 'baja', label: 'De Baja' },
];

export function Sondas() {
  const [sondas, setSondas] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filtroTecnica, setFiltroTecnica] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  const [loading, setLoading] = useState(true);
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [barcodeAbierto, setBarcodeAbierto] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Estados para el Detalle
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [sondaDetalle, setSondaDetalle] = useState<any | null>(null);
  const [carroDetalle, setCarroDetalle] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [snd, tec] = await Promise.all([
      supabase
        .from('sondas')
        .select('*, tecnicas_ndt(codigo, nombre), carros(codigo, nombre, ubicacion, num_bandejas, posiciones_por_bandeja, bandejas_fotos)')
        .order('id_sonda', { ascending: true }),
      supabase
        .from('tecnicas_ndt')
        .select('id, codigo, nombre')
        .eq('activa', true)
        .order('codigo'),
    ]);
    if (snd.error) console.error(snd.error);
    setSondas(snd.data ?? []);
    setTecnicas(tec.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return sondas.filter((s) => {
      const campos = [
        s.nombre, s.codigo_barras, s.id_sonda,
        s.carros?.codigo, s.tecnicas_ndt?.codigo,
        s.num_bandeja != null ? `bandeja ${s.num_bandeja}` : '',
      ].filter(Boolean).join(' ').toLowerCase();

      if (qLower && !campos.includes(qLower)) return false;
      if (filtroTecnica !== 'todas' && s.tecnicas_ndt?.codigo !== filtroTecnica) return false;
      if (filtroEstado !== 'todos' && s.estado !== filtroEstado) return false;
      return true;
    });
  }, [sondas, q, filtroTecnica, filtroEstado]);

  const openNew = () => { setEditingId(null); setModalFormOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setModalFormOpen(true); };
  
  const abrirDetalle = (s: any) => {
    setSondaDetalle(s);
    setCarroDetalle(s.carros ?? null);
    setModalDetalleOpen(true);
  };

  const handleSuccess = () => {
    setModalFormOpen(false);
    setToast(editingId ? 'Sonda actualizada' : 'Sonda creada');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const handleScan = (code: string) => {
    setQ(code.trim());
    setScannerOpen(false);
    const match = sondas.find((s) => s.codigo_barras?.toLowerCase() === code.trim().toLowerCase() || s.id_sonda?.toLowerCase() === code.trim().toLowerCase());
    if (match) setTimeout(() => abrirDetalle(match), 150);
  };

  const imprimirEtiqueta = (sonda: any) => {
    const win = window.open('', '_blank', 'width=500,height=500');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Etiqueta ${sonda.id_sonda}</title>
      <style>
        body { font-family: Helvetica, sans-serif; padding: 20px; display: flex; justify-content: center; }
        .etiqueta { border: 1px solid #ccc; padding: 16px; border-radius: 8px; max-width: 300px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .id { font-family: monospace; font-size: 20px; font-weight: bold; color: #00205B; margin-bottom: 4px; }
        .nombre { font-size: 13px; margin-bottom: 4px; }
        .tecnica { font-size: 11px; color: #666; margin-bottom: 8px; }
        .codes { display: flex; flex-direction: column; gap: 8px; align-items: center; width: 100%; border-top: 1px dashed #ddd; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="etiqueta">
        <div class="id">${sonda.id_sonda ?? '—'}</div>
        <div class="nombre">${sonda.nombre}</div>
        <div class="tecnica">${sonda.tecnicas_ndt?.codigo ?? ''}</div>
        <div class="codes">
          <div id="barcode"></div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(sonda.codigo_barras)}" alt="QR" />
        </div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <script>JsBarcode("#barcode", "${sonda.codigo_barras}", { format: "CODE128", displayValue: false, height: 50, width: 2, margin: 0 }); setTimeout(() => window.print(), 500);</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Sondas NDT</h1>
          <p className="text-sm text-gray-500">{filtered.length} de {sondas.length} sondas</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nueva sonda
        </button>
      </div>

      {toast && <div className="fixed top-20 right-6 z-40 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in">{toast}</div>}

      <div className="card space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-10 pr-10" placeholder="Buscar por ID, nombre, código..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" onClick={() => setScannerOpen(true)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-airbus-sky hover:text-airbus-blue"><ScanBarcode className="w-4 h-4" /></button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4">
          {/* Filtro Técnica */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-2">Técnica</label>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFiltroTecnica('todas')} className={`px-3 py-1 rounded-full text-xs font-medium border ${filtroTecnica === 'todas' ? 'bg-airbus-blue text-white' : 'bg-white'}`}>Todas</button>
              {tecnicas.map((t) => (
                <button key={t.id} onClick={() => setFiltroTecnica(t.codigo)} className={`px-3 py-1 rounded-full text-xs font-medium border ${filtroTecnica === t.codigo ? 'bg-airbus-sky text-white' : 'bg-white'}`}>{t.codigo}</button>
              ))}
            </div>
          </div>

          {/* Filtro Estado */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-2">Estado</label>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFiltroEstado('todos')} className={`px-3 py-1 rounded-full text-xs font-medium border ${filtroEstado === 'todos' ? 'bg-airbus-blue text-white' : 'bg-white'}`}>Todos</button>
              {estadosFiltro.map((e) => (
                <button key={e.value} onClick={() => setFiltroEstado(e.value)} className={`px-3 py-1 rounded-full text-xs font-medium border ${filtroEstado === e.value ? 'bg-airbus-blue text-white' : 'bg-white'}`}>{e.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center"><Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">Sin resultados</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Códigos</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Técnica</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => abrirDetalle(s)}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-airbus-blue">{s.id_sonda}</td>
                    <td className="px-4 py-3">
                      {s.codigo_barras ? (
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setBarcodeAbierto(s.codigo_barras);
                          }}
                          className="hover:bg-airbus-light/10 rounded p-1 -m-1 transition flex flex-row items-center gap-3"
                          title="Clic para ampliar"
                        >
                          <Barcode value={s.codigo_barras} format="CODE128" displayValue={false} height={25} width={1} margin={0} background="transparent" lineColor="#00205B" />
                          <QRCodeSVG value={s.codigo_barras} size={40} />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.nombre}</td>
                    <td className="px-4 py-3"><span className="badge badge-blue">{s.tecnicas_ndt?.codigo ?? '—'}</span></td>
                    <td className="px-4 py-3">
                      {s.carros?.codigo ? (
                        <span className="text-xs text-gray-600">
                          {s.carros.codigo} {s.num_bandeja ? `(B${s.num_bandeja})` : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin carro</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={estadoBadge[s.estado] ?? 'badge badge-gray'}>
                        {s.estado === 'disponible' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                        {s.estado === 'mantenimiento' && <Wrench className="w-3 h-3 inline mr-1" />}
                        {s.estado === 'baja' && <XCircle className="w-3 h-3 inline mr-1" />}
                        {estadoLabel[s.estado] ?? s.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => abrirDetalle(s)} className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => imprimirEtiqueta(s)} className="p-1.5 text-gray-400 hover:text-airbus-blue hover:bg-airbus-light/10 rounded transition" title="Imprimir etiqueta">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(s.id)} className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition" title="Editar">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal barcode */}
      <Modal open={!!barcodeAbierto} onClose={() => setBarcodeAbierto(null)} title="Códigos de identificación" size="sm">
        {barcodeAbierto && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 w-full flex justify-center">
              <Barcode value={barcodeAbierto} format="CODE128" displayValue={true} height={60} width={2} margin={0} lineColor="#00205B" />
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex justify-center">
              <QRCodeSVG value={barcodeAbierto} size={200} />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Formulario */}
      <Modal open={modalFormOpen} onClose={() => setModalFormOpen(false)} title={editingId ? 'Editar sonda' : 'Nueva sonda'} size="lg">
        <SondaForm sondaId={editingId ?? undefined} onSuccess={handleSuccess} onCancel={() => setModalFormOpen(false)} />
      </Modal>

      {/* Modal Detalle */}
      <Modal
        open={modalDetalleOpen}
        onClose={() => { setModalDetalleOpen(false); setSondaDetalle(null); setCarroDetalle(null); }}
        title={sondaDetalle ? `Sonda ${sondaDetalle.id_sonda}` : 'Detalle'}
        size="lg"
      >
        {sondaDetalle && (
          <SondaDetalle
            sonda={sondaDetalle}
            carro={carroDetalle}
            onClose={() => { setModalDetalleOpen(false); setSondaDetalle(null); setCarroDetalle(null); }}
            sondasEnBandeja={
              sondaDetalle.carro_id && sondaDetalle.num_bandeja
                ? sondas.filter(
                    (p) =>
                      p.carro_id === sondaDetalle.carro_id &&
                      p.num_bandeja === sondaDetalle.num_bandeja
                  )
                : []
            }
          />
        )}
      </Modal>

      {/* Modal Escáner */}
      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title="Escanear código de barras" size="md">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Apunta la cámara al código de barras. El código se usará como término de búsqueda y, si coincide, se abrirá el detalle automáticamente.
          </p>
          <BarcodeScanner onScan={handleScan} />
        </div>
      </Modal>
    </div>
  );
}