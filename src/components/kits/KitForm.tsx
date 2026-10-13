import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Plus, Search, Package, Hash, Loader2, CheckCircle2, AlertTriangle,
  Upload, Trash2, ImageIcon, Camera,
} from 'lucide-react';

interface KitFormProps {
  kitId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface LineaEquipo {
  equipo_id: string;
  cantidad: number;
  notas: string;
}

// 👇 Ajusta al bucket que uses para las fotos de equipos
const BUCKET_FOTOS = 'equipos';

export function KitForm({ kitId, onSuccess, onCancel }: KitFormProps) {
  const [loading, setLoading] = useState(!!kitId);
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [activo, setActivo] = useState(true);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  // Input para subir desde archivo/galería
  const fileRef = useRef<HTMLInputElement>(null);
  // Input para hacer foto directamente con la cámara (móviles)
  const cameraRef = useRef<HTMLInputElement>(null);

  const [equipos, setEquipos] = useState<any[]>([]);
  const [lineas, setLineas] = useState<LineaEquipo[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Cargar catálogo de equipos
  // ============================================================
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('equipos')
        .select('id, id_equipo, nombre, codigo_barras, tecnicas_ndt(codigo)')
        .order('id_equipo');
      setEquipos(data ?? []);
    })();
  }, []);

  // ============================================================
  // Cargar kit existente
  // ============================================================
  useEffect(() => {
    if (!kitId) return;
    (async () => {
      setLoading(true);
      const [kitRes, lineasRes] = await Promise.all([
        supabase.from('kits').select('*').eq('id', kitId).single(),
        supabase
          .from('kit_equipos')
          .select('equipo_id, cantidad, notas')
          .eq('kit_id', kitId),
      ]);
      if (kitRes.error) setError(kitRes.error.message);
      const k = kitRes.data;
      if (k) {
        setCodigo(k.codigo ?? '');
        setNombre(k.nombre ?? '');
        setDescripcion(k.descripcion ?? '');
        setUbicacion(k.ubicacion ?? '');
        setActivo(k.activo ?? true);
        setFotoUrl(k.foto_url ?? null);
      }
      setLineas(
        (lineasRes.data ?? []).map((l: any) => ({
          equipo_id: l.equipo_id,
          cantidad: l.cantidad ?? 1,
          notas: l.notas ?? '',
        }))
      );
      setLoading(false);
    })();
  }, [kitId]);

  // Cerrar picker al hacer clic fuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // ============================================================
  // Subir foto (sirve para cámara y para archivo)
  // ============================================================
  const subirFoto = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5 MB');
      return;
    }

    setSubiendo(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `kits/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path);
      setFotoUrl(data.publicUrl);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Error al subir la imagen');
    } finally {
      setSubiendo(false);
    }
  };

  const quitarFoto = async () => {
    if (!fotoUrl) return;
    if (!confirm('¿Quitar la foto del kit?')) return;
    setFotoUrl(null);
  };

  // ============================================================
  // Picker de equipos
  // ============================================================
  const idsYaEnKit = useMemo(() => new Set(lineas.map((l) => l.equipo_id)), [lineas]);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return equipos
      .filter((e) => !idsYaEnKit.has(e.id))
      .filter((e) => {
        if (!q) return true;
        return [e.id_equipo, e.nombre, e.codigo_barras, e.tecnicas_ndt?.codigo]
          .filter(Boolean).join(' ').toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [equipos, busqueda, idsYaEnKit]);

  const añadirEquipo = (eq: any) => {
    setLineas((prev) => [...prev, { equipo_id: eq.id, cantidad: 1, notas: '' }]);
    setBusqueda('');
    setPickerOpen(false);
  };

  const quitarEquipo = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.equipo_id !== id));
  };

  const setCantidad = (id: string, cantidad: number) => {
    setLineas((prev) =>
      prev.map((l) => (l.equipo_id === id ? { ...l, cantidad: Math.max(1, cantidad) } : l))
    );
  };

  const getEquipo = (id: string) => equipos.find((e) => e.id === id);

  // ============================================================
  // Guardar
  // ============================================================
  const guardar = async () => {
    setError(null);
    if (!codigo.trim()) { setError('El código es obligatorio'); return; }
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }

    setSaving(true);
    try {
      const payload = {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        ubicacion: ubicacion.trim() || null,
        activo,
        foto_url: fotoUrl,
      };

      let finalKitId = kitId;

      if (kitId) {
        const { error: upErr } = await supabase.from('kits').update(payload).eq('id', kitId);
        if (upErr) throw upErr;
        const { error: delErr } = await supabase.from('kit_equipos').delete().eq('kit_id', kitId);
        if (delErr) throw delErr;
      } else {
        const { data, error: insErr } = await supabase
          .from('kits')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        finalKitId = data!.id;
      }

      if (lineas.length > 0) {
        const rows = lineas.map((l) => ({
          kit_id: finalKitId,
          equipo_id: l.equipo_id,
          cantidad: l.cantidad,
          notas: l.notas.trim() || null,
        }));
        const { error: kitErr } = await supabase.from('kit_equipos').insert(rows);
        if (kitErr) throw kitErr;
      }

      onSuccess();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-airbus-red/10 border border-airbus-red/30 text-airbus-red text-xs p-2.5 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* FOTO + DATOS BÁSICOS */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* FOTO */}
        <div className="shrink-0">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
            Foto del kit
          </label>

          {/* Preview */}
          <div className="w-40 h-40 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden relative group">
            {fotoUrl ? (
              <>
                <img
                  src={fotoUrl}
                  alt="Kit"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={quitarFoto}
                  className="absolute top-1 right-1 p-1 bg-white/90 rounded-lg text-gray-500 hover:text-airbus-red hover:bg-airbus-red/10 transition shadow-sm opacity-0 group-hover:opacity-100"
                  title="Quitar foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
                {subiendo ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-airbus-sky" />
                    <span className="text-[10px] font-medium text-airbus-sky">Subiendo...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-7 h-7" />
                    <span className="text-[10px] font-medium">Sin foto</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Botones: cámara + galería */}
          <div className="flex gap-1.5 mt-2 w-40">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={subiendo}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-airbus-blue text-white rounded-lg text-[10px] font-semibold hover:bg-airbus-navy transition disabled:opacity-60"
              title="Hacer foto con la cámara"
            >
              <Camera className="w-3.5 h-3.5" />
              Cámara
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-[10px] font-semibold hover:bg-gray-50 transition disabled:opacity-60"
              title="Elegir imagen de la galería o archivo"
            >
              <Upload className="w-3.5 h-3.5" />
              Galería
            </button>
          </div>

          {fotoUrl && !subiendo && (
            <p className="mt-1 text-[10px] text-gray-400 text-center w-40">
              Usa los botones para cambiar la foto
            </p>
          )}

          {/* Input cámara (abre directamente la cámara trasera en móvil) */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subirFoto(f);
              e.target.value = '';
            }}
          />

          {/* Input archivo / galería */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subirFoto(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* CAMPOS */}
        <div className="flex-1 space-y-3 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                Código *
              </label>
              <input
                className="input font-mono"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="KIT-UT-01"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                Nombre *
              </label>
              <input
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Kit de ultrasonidos"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
              Descripción
            </label>
            <textarea
              className="input"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del kit, uso previsto, contenido..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                Ubicación
              </label>
              <input
                className="input"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Almacén principal · Estantería B2"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Kit activo</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* LÍNEAS DE EQUIPOS */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Equipos del kit ({lineas.length})
          </label>
        </div>

        {/* Picker */}
        <div className="relative mb-3" ref={pickerRef}>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar equipo por ID, nombre, técnica..."
              value={busqueda}
              onFocus={() => setPickerOpen(true)}
              onChange={(e) => { setBusqueda(e.target.value); setPickerOpen(true); }}
            />
          </div>

          {pickerOpen && (
            <div className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
              {resultados.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 italic text-center">
                  {busqueda
                    ? 'Sin resultados'
                    : 'Todos los equipos ya están en el kit'}
                </p>
              ) : (
                resultados.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => añadirEquipo(e)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-airbus-sky/5 text-left transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-airbus-blue/10 flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5 text-airbus-blue" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-airbus-blue text-xs">
                          {e.id_equipo}
                        </span>
                        {e.tecnicas_ndt?.codigo && (
                          <span className="badge badge-blue">{e.tecnicas_ndt.codigo}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 truncate">{e.nombre}</p>
                    </div>
                    <Plus className="w-4 h-4 text-airbus-green shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Lista actual */}
        {lineas.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              Este kit no tiene equipos. Usa el buscador para añadirlos.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
            {lineas.map((l) => {
              const eq = getEquipo(l.equipo_id);
              if (!eq) return null;
              return (
                <div key={l.equipo_id} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-7 h-7 rounded-lg bg-airbus-blue/10 flex items-center justify-center shrink-0">
                    <Package className="w-3.5 h-3.5 text-airbus-blue" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-airbus-blue text-xs">
                        {eq.id_equipo}
                      </span>
                      {eq.tecnicas_ndt?.codigo && (
                        <span className="badge badge-blue">{eq.tecnicas_ndt.codigo}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 truncate">{eq.nombre}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={l.cantidad}
                    onChange={(e) => setCantidad(l.equipo_id, parseInt(e.target.value) || 1)}
                    className="input w-16 text-center text-xs py-1"
                    title="Cantidad"
                  />
                  <button
                    type="button"
                    onClick={() => quitarEquipo(l.equipo_id)}
                    className="p-1.5 text-gray-400 hover:text-airbus-red hover:bg-airbus-red/10 rounded transition shrink-0"
                    title="Quitar del kit"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACCIONES */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={onCancel} className="btn-ghost border border-gray-300" disabled={saving}>
          Cancelar
        </button>
        <button onClick={guardar} className="btn-primary flex items-center gap-2" disabled={saving || subiendo}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {kitId ? 'Guardar cambios' : 'Crear kit'}
        </button>
      </div>
    </div>
  );
}