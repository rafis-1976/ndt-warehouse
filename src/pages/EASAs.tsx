import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { usePerfil } from '../hooks/usePerfil';
import {
  Search, FileText, Plus, X, Loader2, AlertCircle, CheckCircle2,
  Paperclip, Trash2, Edit3, Upload,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';

// ============================================================
// Tipos
// ============================================================
type EASA = {
  id: string;
  numero_wo: string;
  matricula: string;
  fr: string | null;
  fecha: string;
  descripcion: string | null;
  observaciones: string | null;
  archivo_path: string | null;
  archivo_nombre: string | null;
  archivo_tipo: string | null;
  archivo_tamano: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

const FORM_INICIAL = {
  numero_wo: '',
  matricula: '',
  fr: '',
  fecha: new Date().toISOString().slice(0, 10),
  descripcion: '',
  observaciones: '',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Componente
// ============================================================
export function EASAs() {
  const { user } = useAuth();
  const { perfil } = usePerfil();
  const esAdminOSupervisor = perfil?.rol === 'admin' || perfil?.rol === 'supervisor';

  const [esas, setEsas] = useState<EASA[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EASA | null>(null);
  const [form, setForm] = useState({ ...FORM_INICIAL });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<{ path: string; name: string } | null>(null);

  // --------------------------------------------------------
  // Cargar
  // --------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('easas')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EASAs] Error:', error);
      setToastError(error.message);
      setTimeout(() => setToastError(null), 4000);
    }
    setEsas((data ?? []) as EASA[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // --------------------------------------------------------
  // Filtrado
  // --------------------------------------------------------
  const filtered = useMemo(() => {
    const qLower = q.toLowerCase().trim();
    return esas.filter((e) => {
      if (qLower) {
        const haystack = [e.numero_wo, e.matricula, e.fr, e.descripcion, e.observaciones]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(qLower)) return false;
      }
      if (fechaDesde && e.fecha < fechaDesde) return false;
      if (fechaHasta && e.fecha > fechaHasta) return false;
      return true;
    });
  }, [esas, q, fechaDesde, fechaHasta]);

  const hayFiltros = q !== '' || fechaDesde !== '' || fechaHasta !== '';
  const limpiarFiltros = () => { setQ(''); setFechaDesde(''); setFechaHasta(''); };

  // --------------------------------------------------------
  // Abrir modales
  // --------------------------------------------------------
  const openCreate = () => {
    setEditing(null);
    setForm({ ...FORM_INICIAL });
    setSelectedFile(null);
    setExistingFile(null);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (easa: EASA) => {
    setEditing(easa);
    setForm({
      numero_wo: easa.numero_wo,
      matricula: easa.matricula,
      fr: easa.fr ?? '',
      fecha: easa.fecha,
      descripcion: easa.descripcion ?? '',
      observaciones: easa.observaciones ?? '',
    });
    setSelectedFile(null);
    setExistingFile(
      easa.archivo_path
        ? { path: easa.archivo_path, name: easa.archivo_nombre ?? 'archivo' }
        : null
    );
    setError('');
    setModalOpen(true);
  };

  // --------------------------------------------------------
  // Ficheros
  // --------------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(`El archivo supera los ${MAX_FILE_SIZE / (1024 * 1024)} MB`);
      return;
    }
    setSelectedFile(file);
    setError('');
  };

  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('easas').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return { path, name: file.name, type: file.type, size: file.size };
  };

  // --------------------------------------------------------
  // Guardar
  // --------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.numero_wo.trim()) return setError('El Nº de WO es obligatorio');
    if (!form.matricula.trim()) return setError('La matrícula es obligatoria');
    if (!form.fecha) return setError('La fecha es obligatoria');

    setSaving(true);
    let uploadedPath: string | null = null;

    try {
      let archivoPath = existingFile?.path ?? null;
      let archivoNombre = existingFile?.name ?? null;
      let archivoTipo: string | null = editing?.archivo_tipo ?? null;
      let archivoTamano: number | null = editing?.archivo_tamano ?? null;

      if (selectedFile) {
        const uploaded = await uploadFile(selectedFile);
        uploadedPath = uploaded.path;
        archivoPath = uploaded.path;
        archivoNombre = uploaded.name;
        archivoTipo = uploaded.type;
        archivoTamano = uploaded.size;
      } else if (!existingFile) {
        archivoPath = null;
        archivoNombre = null;
        archivoTipo = null;
        archivoTamano = null;
      }

      const payload = {
        numero_wo: form.numero_wo.trim(),
        matricula: form.matricula.trim(),
        fr: form.fr.trim() || null,
        fecha: form.fecha,
        descripcion: form.descripcion.trim() || null,
        observaciones: form.observaciones.trim() || null,
        archivo_path: archivoPath,
        archivo_nombre: archivoNombre,
        archivo_tipo: archivoTipo,
        archivo_tamano: archivoTamano,
        user_id: user?.id ?? null,
      };

      if (editing) {
        const { error: updErr } = await supabase
          .from('easas')
          .update(payload)
          .eq('id', editing.id);
        if (updErr) throw updErr;

        // Eliminar archivo anterior si se reemplazó o se quitó
        const fileReplaced = selectedFile && editing.archivo_path;
        const fileRemoved = !selectedFile && !existingFile && editing.archivo_path;
        if (fileReplaced || fileRemoved) {
          await supabase.storage.from('easas').remove([editing.archivo_path!]).catch(() => {});
        }
        setToast('EASA actualizada');
      } else {
        const { error: insErr } = await supabase.from('easas').insert(payload);
        if (insErr) throw insErr;
        setToast('EASA creada');
      }

      setTimeout(() => setToast(null), 3000);
      setModalOpen(false);
      load();
    } catch (err: any) {
      if (uploadedPath) {
        await supabase.storage.from('easas').remove([uploadedPath]).catch(() => {});
      }
      setError(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------
  // Eliminar
  // --------------------------------------------------------
  const handleDelete = async (easa: EASA) => {
    if (!confirm(`¿Eliminar la EASA WO ${easa.numero_wo} · ${easa.matricula}?`)) return;
    try {
      if (easa.archivo_path) {
        await supabase.storage.from('easas').remove([easa.archivo_path]).catch(() => {});
      }
      const { error } = await supabase.from('easas').delete().eq('id', easa.id);
      if (error) throw error;
      setToast('EASA eliminada');
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (err: any) {
      setToastError(err.message ?? 'Error al eliminar');
      setTimeout(() => setToastError(null), 4000);
    }
  };

  // --------------------------------------------------------
  // Abrir adjunto
  // --------------------------------------------------------
  const openAttachment = async (easa: EASA) => {
    if (!easa.archivo_path) return;
    const { data, error } = await supabase.storage
      .from('easas')
      .createSignedUrl(easa.archivo_path, 3600);
    if (error) {
      setToastError('No se pudo abrir el archivo: ' + error.message);
      setTimeout(() => setToastError(null), 4000);
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 space-y-4">

      {/* ==================================================== */}
      {/* CABECERA */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-airbus-blue">EASAs</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} de {esas.length} EASAs
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva EASA
        </button>
      </div>

      {/* Toasts */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-airbus-green text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
      {toastError && (
        <div className="fixed top-20 right-6 z-50 bg-airbus-red text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-in flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {toastError}
        </div>
      )}

      {/* ==================================================== */}
      {/* FILTROS */}
      {/* ==================================================== */}
      <div className="card space-y-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por WO, matrícula, FR, descripción..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">
              Desde
            </label>
            <input
              type="date"
              className="input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">
              Hasta
            </label>
            <input
              type="date"
              className="input"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              className="btn-ghost border border-gray-300 flex items-center gap-2 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* TABLA */}
      {/* ==================================================== */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando EASAs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">
              {esas.length === 0
                ? 'Aún no hay EASAs registradas'
                : 'Sin resultados con los filtros actuales'}
            </p>
            {hayFiltros ? (
              <button
                onClick={limpiarFiltros}
                className="btn-ghost border border-gray-300 inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            ) : (
              <button
                onClick={openCreate}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Crear la primera
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">WO / FR</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Archivo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-airbus-blue text-xs">
                        {e.numero_wo}
                      </div>
                      {e.fr && (
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          FR {e.fr}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">
                        {e.matricula}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{fmtFecha(e.fecha)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-gray-700 truncate">
                        {e.descripcion || (
                          <span className="text-gray-400 italic">
                            Sin descripción
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {e.archivo_path ? (
                        <button
                          onClick={() => openAttachment(e)}
                          className="inline-flex items-center gap-1.5 text-xs text-airbus-sky hover:text-airbus-blue font-medium"
                          title={e.archivo_nombre ?? 'Abrir adjunto'}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          Ver archivo
                          {e.archivo_tamano && (
                            <span className="text-gray-400">
                              · {formatBytes(e.archivo_tamano)}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          Sin adjunto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {esAdminOSupervisor && (
                          <button
                            onClick={() => handleDelete(e)}
                            className="p-1.5 text-airbus-red hover:bg-airbus-red/10 rounded transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* MODAL CREAR / EDITAR */}
      {/* ==================================================== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar EASA' : 'Nueva EASA'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* WO + Matrícula + FR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nº WO *
              </label>
              <input
                className="input font-mono"
                value={form.numero_wo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, numero_wo: e.target.value }))
                }
                placeholder="6567863537"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matrícula *
              </label>
              <input
                className="input"
                value={form.matricula}
                onChange={(e) =>
                  setForm((f) => ({ ...f, matricula: e.target.value }))
                }
                placeholder="EC-NAV"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FR
              </label>
              <input
                className="input"
                value={form.fr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fr: e.target.value }))
                }
                placeholder="248"
              />
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha *
            </label>
            <input
              type="date"
              className="input"
              value={form.fecha}
              onChange={(e) =>
                setForm((f) => ({ ...f, fecha: e.target.value }))
              }
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.descripcion}
              onChange={(e) =>
                setForm((f) => ({ ...f, descripcion: e.target.value }))
              }
              placeholder="Breve descripción del documento"
            />
          </div>

          {/* Archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Documento escaneado
            </label>

            {existingFile && !selectedFile && (
              <div className="flex items-center gap-2 p-2 mb-2 border border-gray-200 rounded-lg bg-gray-50">
                <Paperclip className="w-4 h-4 text-airbus-blue shrink-0" />
                <span className="flex-1 text-xs text-gray-700 truncate font-mono">
                  {existingFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setExistingFile(null)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Quitar archivo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {selectedFile && (
              <div className="flex items-center gap-2 p-2 mb-2 border border-airbus-green/30 rounded-lg bg-airbus-green/5">
                <Paperclip className="w-4 h-4 text-airbus-green shrink-0" />
                <span className="flex-1 text-xs text-gray-700 truncate font-mono">
                  {selectedFile.name}
                </span>
                <span className="text-[10px] text-gray-500">
                  {formatBytes(selectedFile.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Quitar archivo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-airbus-blue hover:bg-airbus-blue/5 transition">
              <Upload className="w-5 h-5 text-airbus-blue" />
              <span className="text-sm text-gray-700 font-medium">
                {selectedFile || existingFile
                  ? 'Reemplazar archivo'
                  : 'Seleccionar archivo'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <p className="mt-1 text-[11px] text-gray-400">
              Imágenes (JPG, PNG) o PDF · máx. {MAX_FILE_SIZE / (1024 * 1024)} MB
            </p>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.observaciones}
              onChange={(e) =>
                setForm((f) => ({ ...f, observaciones: e.target.value }))
              }
              placeholder="Notas adicionales (opcional)"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-ghost border border-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {saving
                ? 'Guardando...'
                : editing
                  ? 'Guardar cambios'
                  : 'Crear EASA'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}