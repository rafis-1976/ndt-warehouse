import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Plus, Cable, RefreshCw, Printer, ScanBarcode,
  CheckCircle2, Wrench, XCircle, Eye, Edit3
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { CableForm } from '../components/cables/CableForm';
import { CableDetalle } from '../components/cables/CableDetalle';

// ⚠️ IMPORTANTE: Verifica que el archivo BarcodeScanner.tsx esté exactamente en esta ruta.
// Si lo tienes en otra carpeta (ej. '../components/ui/BarcodeScanner'), cambia la ruta aquí:
import { BarcodeScanner } from '../components/BarcodeScanner';

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

export function Cables() {
  const [cables, setCables] = useState<any[]>([]);
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
  const [cableDetalle, setCableDetalle] = useState<any | null>(null);
  const [carroDetalle, setCarroDetalle] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cbl, tec] = await Promise.all([
      supabase
        .from('cables')
        .select('*, tecnicas_ndt(codigo, nombre), carros(codigo, nombre, ubicacion, num_bandejas, posiciones_por_bandeja, bandejas_fotos)')
        .order('id_cable', { ascending: true }),
      supabase
        .from('tecnicas_ndt')
        .select('id, codigo, nombre')
        .eq('activa', true)
        .order('codigo'),
    ]);
    if (cbl.error) console.error(cbl.error);
    setCables(cbl.data ?? []);
    setTecnicas(tec.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    return cables.filter((c) => {
      const campos = [
        c.nombre, c.codigo_barras, c.id_cable,
        c.carros?.codigo, c.tecnicas_ndt?.codigo,
        c.num_bandeja != null ? `bandeja ${c.num_bandeja}` : '',
      ].filter(Boolean).join(' ').toLowerCase();

      if (qLower && !campos.includes(qLower)) return false;
      if (filtroTecnica !== 'todas' && c.tecnicas_ndt?.codigo !== filtroTecnica) return false;
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
      return true;
    });
  }, [cables, q, filtroTecnica, filtroEstado]);

  const openNew = () => { setEditingId(null); setModalFormOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setModalFormOpen(true); };

  const abrirDetalle = (c: any) => {
    setCableDetalle(c);
    setCarroDetalle(c.carros ?? null);
    setModalDetalleOpen(true);
  };

  const handleSuccess = () => {
    setModalFormOpen(false);
    setToast(editingId ? 'Cable actualizado' : 'Cable creado');
    setTimeout(() => setToast(null), 3000);
    load();
  };

  const handleScan = (code: string) => {
    setQ(code.trim());
    setScannerOpen(false);
    const match = cables.find((c) => c.codigo_barras?.toLowerCase() === code.trim().toLowerCase() || c.id_cable?.toLowerCase() === code.trim().toLowerCase());
    if (match) setTimeout(() => abrirDetalle(match), 150);
  };

  const imprimirEtiqueta = (cable: any) => {
    const win = window.open('', '_blank', 'width=500,height=500');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Etiqueta ${cable.id_cable}</title>
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
        <div class="id">${cable.id_cable ?? '—'}</div>
        <div class="nombre">${cable.nombre}</div>
        <div class="tecnica">${cable.tecnicas_ndt?.codigo ?? ''}</div>
        <div class="codes">
          <div id="barcode"></div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(cable.codigo_barras)}" alt="QR" />
        </div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <script>JsBarcode("#barcode", "${cable.codigo_barras}", { format: "CODE128", displayValue: false, height: 50, width: 2, margin: 0 }); setTimeout(() => window.print(), 500);</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">Cables NDT</h1>
          <p className="text-sm text-gray-500">{filtered.length} de {cables.length} cables</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nuevo cable
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
          <div className="p-12 text-center"><Cable className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">Sin resultados</p></div>
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
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => abrirDetalle(c)}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-airbus-blue">{c.id_cable}</td>
                    <td className="px-4 py-3">
                      {c.codigo_barras ? (
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setBarcodeAbierto(c.codigo_barras);
                          }}
                          className="hover:bg-airbus-light/10 rounded p-1 -m-1 transition flex flex-row items-center gap-3"
                          title="Clic para ampliar"
                        >
                          <Barcode value={c.codigo_barras} format="CODE128" displayValue={false} height={25} width={1} margin={0} background="transparent" lineColor="#00205B" />
                          <QRCodeSVG value={c.codigo_barras} size={40} />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                    <td className="px-4 py-3"><span className="badge badge-blue">{c.tecnicas_ndt?.codigo ?? '—'}</span></td>
                    <td className="px-4 py-3">
                      {c.carros?.codigo ? (
                        <span className="text-xs text-gray-600">
                          {c.carros.codigo} {c.num_bandeja ? `(B${c.num_bandeja})` : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin carro</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={estadoBadge[c.estado] ?? 'badge badge-gray'}>
                        {c.estado === 'disponible' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                        {c.estado === 'mantenimiento' && <Wrench className="w-3 h-3 inline mr-1" />}
                        {c.estado === 'baja' && <XCircle className="w-3 h-3 inline mr-1" />}
                        {estadoLabel[c.estado] ?? c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => abrirDetalle(c)} className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => imprimirEtiqueta(c)} className="p-1.5 text-gray-400 hover:text-airbus-blue hover:bg-airbus-light/10 rounded transition" title="Imprimir etiqueta">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(c.id)} className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition" title="Editar">
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
      <Modal open={modalFormOpen} onClose={() => setModalFormOpen(false)} title={editingId ? 'Editar cable' : 'Nuevo cable'} size="lg">
        <CableForm cableId={editingId ?? undefined} onSuccess={handleSuccess} onCancel={() => setModalFormOpen(false)} />
      </Modal>

      {/* Modal Detalle */}
      <Modal
        open={modalDetalleOpen}
        onClose={() => { setModalDetalleOpen(false); setCableDetalle(null); setCarroDetalle(null); }}
        title={cableDetalle ? `Cable ${cableDetalle.id_cable}` : 'Detalle'}
        size="lg"
      >
        {cableDetalle && (
          <CableDetalle
            cable={cableDetalle}
            carro={carroDetalle}
            onClose={() => { setModalDetalleOpen(false); setCableDetalle(null); setCarroDetalle(null); }}
            cablesEnBandeja={
              cableDetalle.carro_id && cableDetalle.num_bandeja
                ? cables.filter(
                    (p) =>
                      p.carro_id === cableDetalle.carro_id &&
                      p.num_bandeja === cableDetalle.num_bandeja
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