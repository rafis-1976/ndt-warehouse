import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, Package, Calendar, Clock, Sun, Zap,
  CalendarDays, X, Barcode, Camera, Plus, CheckCircle2, Trash2,
} from 'lucide-react';
import { EquipoSelect, type EquipoOption } from '../ui/EquipoSelect';
import { Modal } from '../ui/Modal';
import { BarcodeScanner } from '../BarcodeScanner';

// ============================================================
// Helpers de fecha y hora
// ============================================================
function nowLocal(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}
function dateToLocal(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}
function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return dateToLocal(d);
}
function addHours(base: string, hours: number): string {
  const d = new Date(base);
  d.setHours(d.getHours() + hours);
  return dateToLocal(d);
}
function finJornada(fechaInicio: string): string {
  const inicio = new Date(fechaInicio);
  const h = inicio.getHours();
  const d = new Date(inicio);
  if (h >= 6 && h < 14) d.setHours(14, 0, 0, 0);
  else if (h >= 14 && h < 22) d.setHours(22, 0, 0, 0);
  else {
    if (h >= 22) d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
  }
  return dateToLocal(d);
}
function toISO(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}
function fmt(local: string): string {
  if (!local) return '—';
  return new Date(local).toLocaleString('es-ES', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ============================================================
// Presets
// ============================================================
interface Preset {
  id: string; label: string; icon: any; descripcion: string;
  calcular: (f: string) => string;
}
const presets: Preset[] = [
  { id: 'hora',        label: '1 hora',            icon: Clock,        descripcion: '+1 hora',                    calcular: (f) => addHours(f, 1) },
  { id: 'medio_dia',   label: 'Medio día',         icon: Sun,          descripcion: '+12 horas',                  calcular: (f) => addHours(f, 12) },
  { id: 'jornada',     label: 'Jornada de trabajo',icon: CalendarDays, descripcion: 'Hasta fin del turno',       calcular: (f) => finJornada(f) },
  { id: 'semana',      label: '1 semana',          icon: Calendar,     descripcion: '+7 días',                    calcular: (f) => addDays(f, 7) },
  { id: 'dos_semanas', label: '2 semanas',         icon: Calendar,     descripcion: '+14 días',                   calcular: (f) => addDays(f, 14) },
];

// ============================================================
// Componente principal
// ============================================================
interface PrestamoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function PrestamoForm({ onSuccess, onCancel }: PrestamoFormProps) {
  const [equiposDisponibles, setEquiposDisponibles] = useState<EquipoOption[]>([]);
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<EquipoOption[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [presetActivo, setPresetActivo] = useState<string>('jornada');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => {
    const now = nowLocal();
    return {
      usuario_id: '',
      fecha_prestamo: now,
      fecha_devolucion_prevista: finJornada(now),
      observaciones: '',
    };
  });

  // ============================================================
  // Cargar equipos disponibles + usuarios
  // ============================================================
  useEffect(() => {
    async function load() {
      const [eq, us] = await Promise.all([
        supabase.from('equipos')
          .select('id, id_equipo, nombre, codigo_barras, estado, tecnicas_ndt(codigo, nombre)')
          .eq('estado', 'disponible'),
        supabase.from('perfiles')
          .select('id, nombre_completo, email')
          .eq('activo', true)
          .order('nombre_completo'),
      ]);

      const sorted = ((eq.data ?? []) as EquipoOption[]).sort((a, b) => {
        const ta = a.tecnicas_ndt?.codigo ?? 'ZZZ';
        const tb = b.tecnicas_ndt?.codigo ?? 'ZZZ';
        if (ta !== tb) return ta.localeCompare(tb);
        return (a.id_equipo ?? '').localeCompare(b.id_equipo ?? '');
      });

      setEquiposDisponibles(sorted);
      setUsuarios(us.data ?? []);
      setLoadingData(false);
    }
    load();
  }, []);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ============================================================
  // Añadir / quitar equipos
  // ============================================================
  const addEquipo = (id: string) => {
    if (!id) return;
    const eq = equiposDisponibles.find((e) => e.id === id);
    if (!eq) return;
    if (equiposSeleccionados.some((e) => e.id === id)) {
      setAviso(`El equipo ${eq.id_equipo ?? eq.nombre} ya está en la lista`);
      setTimeout(() => setAviso(null), 2500);
      return;
    }
    setEquiposSeleccionados((prev) => [...prev, eq]);
    setError('');
  };

  const removeEquipo = (id: string) => {
    setEquiposSeleccionados((prev) => prev.filter((e) => e.id !== id));
  };

  // ============================================================
  // Añadir por código de barras
  // ============================================================
  const addByBarcode = (texto: string) => {
    const codigo = texto.trim();
    if (!codigo) return;

    const eq = equiposDisponibles.find((e) => e.codigo_barras === codigo);
    if (!eq) {
      setAviso(`No hay equipo disponible con código "${codigo}"`);
      setTimeout(() => setAviso(null), 3000);
      return;
    }
    if (equiposSeleccionados.some((e) => e.id === eq.id)) {
      setAviso(`${eq.id_equipo ?? eq.nombre} ya está en la lista`);
      setTimeout(() => setAviso(null), 2500);
      return;
    }
    setEquiposSeleccionados((prev) => [...prev, eq]);
    setBarcodeInput('');
    setError('');
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addByBarcode(barcodeInput);
    }
  };

  // ============================================================
  // Presets
  // ============================================================
  const aplicarPreset = (preset: Preset) => {
    setPresetActivo(preset.id);
    setForm((f) => ({ ...f, fecha_devolucion_prevista: preset.calcular(f.fecha_prestamo) }));
  };

  const cambiarFechaPrestamo = (valor: string) => {
    setForm((f) => {
      const actualizado = { ...f, fecha_prestamo: valor };
      const preset = presets.find((p) => p.id === presetActivo);
      if (preset) actualizado.fecha_devolucion_prevista = preset.calcular(valor);
      return actualizado;
    });
  };

  // ============================================================
  // Duración
  // ============================================================
  const duracion = useMemo(() => {
    if (!form.fecha_prestamo || !form.fecha_devolucion_prevista) return null;
    const diff = new Date(form.fecha_devolucion_prevista).getTime() -
                 new Date(form.fecha_prestamo).getTime();
    if (diff <= 0) return null;
    const horas = Math.floor(diff / 3600000);
    const minutos = Math.floor((diff % 3600000) / 60000);
    const dias = Math.floor(horas / 24);
    if (dias >= 1) {
      const h = horas % 24;
      return `${dias} día${dias !== 1 ? 's' : ''}${h ? ` y ${h}h` : ''}`;
    }
    return `${horas}h${minutos ? ` ${minutos}min` : ''}`;
  }, [form.fecha_prestamo, form.fecha_devolucion_prevista]);

  // ============================================================
  // Enviar formulario (crea un préstamo por equipo)
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.usuario_id) return setError('Selecciona un usuario');
    if (equiposSeleccionados.length === 0) return setError('Añade al menos un equipo');
    if (!form.fecha_prestamo) return setError('Indica la fecha y hora del préstamo');
    if (form.fecha_devolucion_prevista &&
        new Date(form.fecha_devolucion_prevista) < new Date(form.fecha_prestamo)) {
      return setError('La devolución no puede ser anterior al préstamo');
    }

    setLoading(true);
    try {
      // Insertar un préstamo por cada equipo
      const prestamosPayload = equiposSeleccionados.map((eq) => ({
        equipo_id: eq.id,
        usuario_id: form.usuario_id,
        fecha_prestamo: toISO(form.fecha_prestamo),
        fecha_devolucion_prevista: toISO(form.fecha_devolucion_prevista),
        observaciones: form.observaciones.trim() || null,
        estado: 'activo',
      }));

      const { error: insErr } = await supabase.from('prestamos').insert(prestamosPayload);
      if (insErr) throw insErr;

      // Marcar todos los equipos como prestados
      const ids = equiposSeleccionados.map((e) => e.id);
      const { error: updErr } = await supabase
        .from('equipos')
        .update({ estado: 'prestado' })
        .in('id', ids);
      if (updErr) throw updErr;

      // Registrar movimientos de salida
      const movimientosPayload = equiposSeleccionados.map((eq) => ({
        equipo_id: eq.id,
        tipo: 'salida',
        observaciones: 'Préstamo registrado',
      }));
      await supabase.from('movimientos').insert(movimientosPayload);

      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('row-level security'))
        setError('No tienes permisos para crear préstamos.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  if (loadingData) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-airbus-sky" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ============ USUARIO ============ */}
      <Section title="Usuario">
        <Field label="Asignado a *">
          <select
            className="input"
            value={form.usuario_id}
            onChange={(e) => update('usuario_id', e.target.value)}
            required
          >
            <option value="">— Selecciona un usuario —</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre_completo} ({u.email})
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ============ EQUIPOS ============ */}
      <Section title={`Equipos a prestar ${equiposSeleccionados.length > 0 ? `(${equiposSeleccionados.length})` : ''}`}>
        <div className="space-y-3">

          {/* Selector + botón cámara */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <EquipoSelect
              equipos={equiposDisponibles.filter(
                (e) => !equiposSeleccionados.some((s) => s.id === e.id)
              )}
              value=""
              onChange={(id) => addEquipo(id)}
              placeholder="— Añadir equipo del listado —"
            />
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              className="btn-secondary flex items-center justify-center gap-2 whitespace-nowrap"
              title="Escanear con cámara"
            >
              <Camera className="w-4 h-4" />
              Escanear
            </button>
          </div>

          {/* Input de código de barras */}
          <div className="relative">
            <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={barcodeRef}
              className="input pl-10 pr-24 font-mono"
              placeholder="Introduce código de barras y pulsa Enter"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
            />
            <button
              type="button"
              onClick={() => addByBarcode(barcodeInput)}
              disabled={!barcodeInput.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs bg-airbus-sky text-white rounded-md hover:bg-airbus-blue transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Añadir
            </button>
          </div>

          {/* Lista de equipos seleccionados */}
          {equiposSeleccionados.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Sin equipos añadidos
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Selecciona del listado, escribe el código o escanea con la cámara
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {equiposSeleccionados.map((eq) => (
                <div
                  key={eq.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition group"
                >
                  <CheckCircle2 className="w-4 h-4 text-airbus-green shrink-0" />
                  <span className="font-mono font-bold text-airbus-blue shrink-0 w-20 truncate">
                    {eq.id_equipo ?? '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{eq.nombre}</p>
                    <p className="text-[10px] font-mono text-gray-400 truncate">
                      {eq.codigo_barras}
                    </p>
                  </div>
                  <span className="badge badge-blue shrink-0">
                    {eq.tecnicas_ndt?.codigo ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEquipo(eq.id)}
                    className="p-1.5 text-gray-300 hover:text-airbus-red hover:bg-airbus-red/10 rounded transition shrink-0"
                    title="Quitar de la lista"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Aviso */}
          {aviso && (
            <div className="flex items-center gap-2 bg-airbus-orange/10 border border-airbus-orange/30 text-airbus-orange text-xs p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {aviso}
            </div>
          )}
        </div>
      </Section>

      {/* ============ DURACIÓN ============ */}
      <Section title="Duración del préstamo">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {presets.map((preset) => {
            const Icon = preset.icon;
            const activo = presetActivo === preset.id;
            const esDestacado = preset.id === 'jornada';
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => aplicarPreset(preset)}
                title={preset.descripcion}
                className={`
                  relative flex flex-col items-center justify-center gap-1.5
                  px-3 py-3 rounded-lg border-2 transition-all
                  ${activo
                    ? esDestacado
                      ? 'bg-airbus-sky text-white border-airbus-sky shadow-md'
                      : 'bg-airbus-blue text-white border-airbus-blue shadow-md'
                    : esDestacado
                      ? 'bg-airbus-sky/5 text-airbus-sky border-airbus-sky/30 hover:border-airbus-sky hover:bg-airbus-sky/10'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold text-center leading-tight">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ============ FECHAS ============ */}
      <Section title="Fechas y horas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Fecha y hora del préstamo *">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                type="datetime-local"
                className="input pl-10"
                value={form.fecha_prestamo}
                onChange={(e) => cambiarFechaPrestamo(e.target.value)}
                required
              />
            </div>
          </Field>
          <Field label="Devolución prevista">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                type="datetime-local"
                className="input pl-10"
                value={form.fecha_devolucion_prevista}
                onChange={(e) => {
                  update('fecha_devolucion_prevista', e.target.value);
                  setPresetActivo('');
                }}
              />
            </div>
          </Field>
        </div>

        {form.fecha_prestamo && form.fecha_devolucion_prevista && (
          <div className="mt-3 p-4 bg-gradient-to-br from-airbus-sky/5 to-airbus-blue/5 border border-airbus-sky/20 rounded-lg">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Desde</p>
                <p className="text-sm font-medium text-airbus-blue capitalize">{fmt(form.fecha_prestamo)}</p>
              </div>
              <div className="flex items-center gap-3 self-center">
                <div className="hidden sm:block w-12 h-px bg-airbus-sky/40" />
                <div className="flex flex-col items-center">
                  <Zap className="w-4 h-4 text-airbus-orange" />
                  <span className="text-[10px] font-bold text-airbus-orange uppercase tracking-wider mt-0.5">
                    {duracion ?? '—'}
                  </span>
                </div>
                <div className="hidden sm:block w-12 h-px bg-airbus-sky/40" />
              </div>
              <div className="flex-1 min-w-[180px] sm:text-right">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Hasta</p>
                <p className="text-sm font-medium text-airbus-blue capitalize">{fmt(form.fecha_devolucion_prevista)}</p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ============ OBSERVACIONES ============ */}
      <Section title="Observaciones">
        <textarea
          className="input min-h-[70px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Motivo del préstamo, destino, etc."
        />
      </Section>

      {/* ============ ERROR ============ */}
      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ============ BOTONES ============ */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500 order-2 sm:order-1">
          {equiposSeleccionados.length > 0 && (
            <>Se crearán <strong className="text-airbus-blue">{equiposSeleccionados.length}</strong> préstamo{equiposSeleccionados.length !== 1 ? 's' : ''} (uno por equipo)</>
          )}
        </div>
        <div className="flex justify-end gap-3 order-1 sm:order-2">
          <button type="button" onClick={onCancel} className="btn-ghost border border-gray-300">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || equiposSeleccionados.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Registrar {equiposSeleccionados.length > 0 ? `${equiposSeleccionados.length} préstamo${equiposSeleccionados.length !== 1 ? 's' : ''}` : 'préstamo'}
          </button>
        </div>
      </div>
    </form>
  );

  // ============================================================
  // Modales auxiliares (fuera del form)
  // ============================================================
  function CameraModal() {
    return (
      <Modal
        open={camaraAbierta}
        onClose={() => setCamaraAbierta(false)}
        title="Escanear código de barras"
        size="md"
      >
        <div className="space-y-4">
          <BarcodeScanner
            onScan={(code) => {
              addByBarcode(code);
              setCamaraAbierta(false);
            }}
          />
          <p className="text-xs text-gray-500 text-center">
            Apunta la cámara al código de barras del equipo
          </p>
        </div>
      </Modal>
    );
  }
}

// Wrapper para renderizar el modal de cámara fuera del form
// (React necesita que esté fuera del <form> para que no se envíe al pulsar botones)
// Lo montamos al final del componente con un portal o simplemente fuera del return

// ============================================================
// Sub-componentes
// ============================================================
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