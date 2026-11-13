import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { usePerfil } from '../hooks/usePerfil';
import {
  Search, FileText, Plus, X, Loader2, AlertCircle, CheckCircle2,
  Paperclip, Trash2, Edit3, Upload, Eye,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';

// ============================================================
// Tipos
// ============================================================
type EASAFile = {
  id: string;
  easa_id: string;
  archivo_path: string;
  archivo_nombre: string | null;
  archivo_tipo: string | null;
  archivo_tamano: number | null;
  created_at: string;
};

type EASA = {
  id: string;
  numero_easa: string | null;
  numero_wo: string;
  matricula: string;
  fecha: string;
  descripcion: string | null;
  observaciones: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  easa_archivos: EASAFile[];
};

// ✅ Todos los campos vacíos excepto la fecha (hoy)
const FORM_INICIAL = {
  numero_easa: '',
  numero_wo: '',
  matricula: '',
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

function fileEmoji(tipo: string | null): string {
  if (!tipo) return '📎';
  if (tipo.startsWith('image/')) return '🖼️';
  if (tipo === 'application/pdf') return '📄';
  return '📎';
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

  // Archivos: nuevos (pendientes de subir) y existentes (ya en DB)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<EASAFile[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------
  // Cargar
  // --------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('easas')
      .select('*, easa_archivos(*)')
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
        const haystack = [
          e.numero_easa,
          e.numero_wo,
          e.matricula,
          e.descripcion,
          e.observaciones,
        ]
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
    // ✅ Todos vacíos, solo fecha = hoy
    setForm({ ...FORM_INICIAL });
    setSelectedFiles([]);
    setExistingFiles([]);
    setFilesToDelete(new Set());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (easa: EASA) => {
    setEditing(easa);
    setForm({
      numero_easa: easa.numero_easa ?? '',
      numero_wo: easa.numero_wo,
      matricula: easa.matricula,
      fecha: easa.fecha,
      descripcion: easa.descripcion ?? '',
      observaciones: easa.observaciones ?? '',
    });
    setSelectedFiles([]);
    setExistingFiles(easa.easa_archivos ?? []);
    setFilesToDelete(new Set());
    setError('');
    setModalOpen(true);
  };

  // --------------------------------------------------------
  // Selección de archivos
  // --------------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const valid: File[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`"${f.name}" supera los ${MAX_FILE_SIZE / (1024 * 1024)} MB y se ha ignorado.`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
      if (!error) setError('');
    }
    // Reset input para permitir seleccionar el mismo archivo dos veces
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = (id: string) => {
    setExistingFiles((prev) => prev.filter((f) => f.id !== id));
    setFilesToDelete((prev) => new Set(prev).add(id));
  };

  // --------------------------------------------------------
  // Storage helpers
  // --------------------------------------------------------
  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('easas').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return {
      path,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  };

  // --------------------------------------------------------
  // Guardar (crear o editar)
  // --------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.numero_easa.trim()) return setError('El Nº de EASA es obligatorio');
    if (!form.numero_wo.trim()) return setError('El Nº de WO es obligatorio');
    if (!form.matricula.trim()) return setError('La matrícula es obligatoria');
    if (!form.fecha) return setError('La fecha es obligatoria');

    setSaving(true);

    try {
      const payload = {
        numero_easa: form.numero_easa.trim(),
        numero_wo: form.numero_wo.trim(),
        matricula: form.matricula.trim(),
        fecha: form.fecha,
        descripcion: form.descripcion.trim() || null,
        observaciones: form.observaciones.trim() || null,
        user_id: user?.id ?? null,
      };

      let easaId: string;
      if (editing) {
        const { error: updErr } = await supabase
          .from('easas')
          .update(payload)
          .eq('id', editing.id);
        if (updErr) throw updErr;
        easaId = editing.id;
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('easas')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        easaId = (ins as { id: string }).id;
      }

      // 1) Borrar archivos marcados (storage + DB)
      if (filesToDelete.size > 0) {
        const { data: toDelete } = await supabase
          .from('easa_archivos')
          .select('archivo_path')
          .in('id', Array.from(filesToDelete));

        const pathsFromDB = (toDelete ?? [])
          .map((r: any) => r.archivo_path)
          .filter(Boolean);

        if (pathsFromDB.length > 0) {
          await supabase.storage.from('easas').remove(pathsFromDB).catch(() => {});
        }
        await supabase
          .from('easa_archivos')
          .delete()
          .in('id', Array.from(filesToDelete));
      }

      // 2) Subir nuevos archivos y crear registros
      if (selectedFiles.length > 0) {
        const uploadedRecords: any[] = [];
        for (const file of selectedFiles) {
          const up = await uploadFile(file);
          uploadedRecords.push({
            easa_id: easaId,
            archivo_path: up.path,
            archivo_nombre: up.name,
            archivo_tipo: up.type,
            archivo_tamano: up.size,
          });
        }
        const { error: filesErr } = await supabase
          .from('easa_archivos')
          .insert(uploadedRecords);
        if (filesErr) throw filesErr;
      }

      setToast(
        editing
          ? 'EASA actualizada'
          : `EASA creada${selectedFiles.length > 0 ? ` con ${selectedFiles.length} archivo${selectedFiles.length !== 1 ? 's' : ''}` : ''}`
      );
      setTimeout(() => setToast(null), 3000);
      setModalOpen(false);
      load();
    } catch (err: any) {
      const msg = err.message ?? 'Error al guardar';
      if (msg.includes('easas_numero_easa_key')) {
        setError('Ya existe una EASA con ese Nº de EASA');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------
  // Eliminar EASA (y todos sus archivos)
  // --------------------------------------------------------
  const handleDelete = async (easa: EASA) => {
    if (!confirm(`¿Eliminar la EASA ${easa.numero_easa ?? easa.numero_wo}? Se borrarán también sus ${easa.easa_archivos?.length ?? 0} archivo(s).`)) return;
    try {
      const paths = (easa.easa_archivos ?? [])
        .map((f) => f.archivo_path)
        .filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('easas').remove(paths).catch(() => {});
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
  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('easas')
      .createSignedUrl(path, 3600);
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

      {/* CABECERA */}
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

      {/* FILTROS */}
      <div className="card space-y-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar por Nº EASA, WO, matrícula, descripción..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Desde</label>
            <input
              type="date"
              className="input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Hasta</label>
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

      {/* TABLA */}
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
                  <th className="px-4 py-3">Nº EASA</th>
                  <th className="px-4 py-3">Nº WO</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Adjuntos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => {
                  const files = e.easa_archivos ?? [];
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-airbus-navy text-xs">
                          {e.numero_easa ?? (
                            <span className="text-gray-400 italic font-normal">
                              Sin número
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-airbus-blue text-xs">
                          {e.numero_wo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{e.matricula}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{fmtFecha(e.fecha)}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-gray-700 truncate">
                          {e.descripcion || (
                            <span className="text-gray-400 italic">Sin descripción</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {files.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">Sin adjuntos</span>
                        ) : files.length === 1 ? (
                          <button
                            onClick={() => openAttachment(files[0].archivo_path)}
                            className="inline-flex items-center gap-1.5 text-xs text-airbus-sky hover:text-airbus-blue font-medium"
                            title={files[0].archivo_nombre ?? 'Abrir adjunto'}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[140px]">
                              {files[0].archivo_nombre ?? 'Ver archivo'}
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => openEdit(e)}
                            className="inline-flex items-center gap-1.5 text-xs text-airbus-sky hover:text-airbus-blue font-medium"
                            title="Ver archivos"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {files.length} archivos
                          </button>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar EASA' : 'Nueva EASA'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nº EASA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nº de EASA *
            </label>
            <input
              className="input font-mono"
              value={form.numero_easa}
              onChange={(e) => setForm((f) => ({ ...f, numero_easa: e.target.value }))}
              placeholder="EASA-2025-001"
              required
              autoFocus
            />
          </div>

          {/* WO + Matrícula */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nº WO *
              </label>
              <input
                className="input font-mono"
                value={form.numero_wo}
                onChange={(e) => setForm((f) => ({ ...f, numero_wo: e.target.value }))}
                placeholder="6567863537"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matrícula *
              </label>
              <input
                className="input"
                value={form.matricula}
                onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
                placeholder="EC-NAV"
                required
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
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Breve descripción del documento"
            />
          </div>

          {/* ============ ARCHIVOS ============ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Documentos escaneados
              </label>
              {(existingFiles.length > 0 || selectedFiles.length > 0) && (
                <span className="text-[11px] text-gray-500">
                  {existingFiles.length + selectedFiles.length} archivo{existingFiles.length + selectedFiles.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Archivos existentes (ya en DB) */}
            {existingFiles.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {existingFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <span className="text-base shrink-0">{fileEmoji(f.archivo_tipo)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 truncate font-mono">
                        {f.archivo_nombre ?? 'archivo'}
                      </p>
                      {f.archivo_tamano && (
                        <p className="text-[10px] text-gray-500">
                          {formatBytes(f.archivo_tamano)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openAttachment(f.archivo_path)}
                      className="p-1 text-airbus-sky hover:bg-airbus-sky/10 rounded"
                      title="Ver archivo"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExistingFile(f.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                      title="Marcar para eliminar (se aplicará al guardar)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Archivos nuevos (pendientes de subir) */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {selectedFiles.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 p-2 border border-airbus-green/30 rounded-lg bg-airbus-green/5"
                  >
                    <span className="text-base shrink-0">{fileEmoji(f.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 truncate font-mono">
                        {f.name}
                      </p>
                      <p className="text-[10px] text-airbus-green font-medium">
                        Pendiente · {formatBytes(f.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(i)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                      title="Quitar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Dropzone / botón añadir */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-airbus-blue hover:bg-airbus-blue/5 transition"
            >
              <Upload className="w-5 h-5 text-airbus-blue" />
              <span className="text-sm text-gray-700 font-medium">
                Añadir archivos (uno o varios)
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Imágenes (JPG, PNG) o PDF · máx. {MAX_FILE_SIZE / (1024 * 1024)} MB por archivo
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
              onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
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