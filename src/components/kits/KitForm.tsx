import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Plus, Search, Package, Loader2, CheckCircle2, AlertTriangle,
  Camera, Save, AlertCircle,
} from 'lucide-react';
import { CamaraEquipo } from '../equipos/CamaraEquipo';
import type { FotoEquipo } from '../../lib/storageFotos';

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

export function KitForm({ kitId, onSuccess, onCancel }: KitFormProps) {
  const [loading, setLoading] = useState(!!kitId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [activo, setActivo] = useState(true);

  // Fotos del kit (mismo patrón que EquipoForm)
  const [fotos, setFotos] = useState<FotoEquipo[]>([]);
  const [uploadKey, setUploadKey] = useState<string>('');

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
  // Cargar kit existente (o preparar uploadKey para uno nuevo)
  // ============================================================
  useEffect(() => {
    if (!kitId) {
      setUploadKey(`tmp-kit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return;
    }
    setUploadKey(kitId);

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

        // Cargar fotos (con soporte para formato nuevo y antiguo)
        const fts: FotoEquipo[] = Array.isArray(k.fotos_urls) ? k.fotos_urls : [];
        if (fts.length === 0 && k.foto_url) {
          // Fallback: migración automática del formato antiguo (solo string)
          fts.push({ url: k.foto_url, nombre: 'foto.jpg' });
        }
        setFotos(fts);
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
        fotos_urls: fotos,
        foto_url: fotos[0]?.url ?? null,   // la primera foto sirve de portada
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
      const msg = e?.message ?? 'Error al guardar';
      if (msg.includes('kits_codigo_key')) setError('Ya existe un kit con ese código');
      else setError(msg);
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
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* FOTOS DEL KIT (mismo componente que equipos: recorte, cámara, IA...) */}
      <Section title="Fotos del kit">
        <div className="flex items-start gap-2 mb-3 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3">
          <Camera className="w-4 h-4 text-airbus-sky shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Haz una foto o sube imágenes. Puedes recortar manualmente o quitar el fondo con IA.
          </p>
        </div>
        <CamaraEquipo
          equipoId={uploadKey}
          fotos={fotos}
          onChange={setFotos}
        />
      </Section>

      {/* DATOS BÁSICOS */}
      <Section title="Datos del kit">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Código *">
            <input
              className="input font-mono"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="KIT-UT-01"
            />
          </Field>
          <Field label="Nombre *">
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Kit de ultrasonidos"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Descripción">
            <textarea
              className="input resize-y"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del kit, uso previsto, contenido..."
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Ubicación">
            <input
              className="input"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Almacén principal · Estantería B2"
            />
          </Field>
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
      </Section>

      {/* EQUIPOS DEL KIT */}
      <Section title={`Equipos del kit (${lineas.length})`}>
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
                  {busqueda ? 'Sin resultados' : 'Todos los equipos ya están en el kit'}
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
      </Section>

      {/* ACCIONES */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-ghost border border-gray-300">
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {kitId ? 'Guardar cambios' : 'Crear kit'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-airbus-blue uppercase tracking-wider mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}