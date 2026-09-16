import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Save, AlertCircle, Package, ArrowRight, Building2,
  Warehouse, Users, Calendar, Truck, CornerDownLeft, Hash, Info,
} from 'lucide-react';
import { EquipoSelect, type EquipoOption } from '../ui/EquipoSelect';

interface MovimientoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type TipoMov =
  | 'entrada'
  | 'salida'
  | 'transferencia'
  | 'ajuste'
  | 'prestamo_externo'
  | 'devolucion_externa';

type TipoObjeto = 'equipo' | 'probeta';

const tiposMovimiento: { value: TipoMov; label: string; descripcion: string; requiereDestinoExterno?: boolean }[] = [
  { value: 'entrada', label: 'Entrada al almacén', descripcion: 'Ingreso de un objeto al almacén' },
  { value: 'salida', label: 'Salida del almacén', descripcion: 'Retirada definitiva. Deja de estar en el inventario' },
  { value: 'transferencia', label: 'Transferencia interna', descripcion: 'Cambio de ubicación dentro del almacén' },
  { value: 'ajuste', label: 'Ajuste de inventario', descripcion: 'Corrección de inventario' },
  { value: 'prestamo_externo', label: 'Préstamo a terceros', descripcion: 'Envío a otro almacén, sección o compañía', requiereDestinoExterno: true },
  { value: 'devolucion_externa', label: 'Devolución de préstamo externo', descripcion: 'Retorno del objeto prestado a terceros', requiereDestinoExterno: true },
];

const tiposDestino = [
  { value: 'almacen', label: 'Almacén', icon: Warehouse },
  { value: 'seccion', label: 'Sección', icon: Building2 },
  { value: 'compania', label: 'Compañía', icon: Truck },
  { value: 'cliente', label: 'Cliente', icon: Users },
  { value: 'otro', label: 'Otro', icon: Building2 },
];

export function MovimientoForm({ onSuccess, onCancel }: MovimientoFormProps) {
  const [equipos, setEquipos] = useState<EquipoOption[]>([]);
  const [probetas, setProbetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const [tipoObjeto, setTipoObjeto] = useState<TipoObjeto>('equipo');

  const [form, setForm] = useState({
    equipo_id: '',
    probeta_id: '',
    tipo: 'entrada' as TipoMov,
    ubicacion_origen: '',
    ubicacion_destino: '',
    referencia: '',
    observaciones: '',
    destino_tipo: '',
    destino_nombre: '',
    destino_contacto: '',
    fecha_devolucion_prevista: '',
  });

  useEffect(() => {
    Promise.all([
      supabase
        .from('equipos')
        .select('id, id_equipo, nombre, codigo_barras, ubicacion, estado, tecnicas_ndt(codigo, nombre)')
        .order('nombre'),
      supabase
        .from('probetas')
        .select('id, pn, codigo_barras, nombre, carro_id, num_bandeja, estado, carros(codigo, nombre)')
        .order('pn'),
    ]).then(([e, p]) => {
      setEquipos((e.data ?? []) as EquipoOption[]);
      setProbetas(p.data ?? []);
      setLoadingData(false);
    });
  }, []);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const tipoMovActual = tiposMovimiento.find((t) => t.value === form.tipo);
  const requiereDestinoExterno = !!tipoMovActual?.requiereDestinoExterno;
  const esEntrada = form.tipo === 'entrada';

  // ============================================================
  // FILTRADO: solo mostramos objetos que estén dentro del almacén,
  // EXCEPTO cuando el tipo es 'entrada' (para poder recuperarlos)
  // ============================================================
  const equiposDisponibles = useMemo(() => {
    if (esEntrada) {
      // En entrada: mostrar solo los que están FUERA del almacén (para recuperarlos)
      return equipos.filter((e: any) => e.estado === 'salida');
    }
    // En cualquier otro tipo: mostrar solo los que están DENTRO
    return equipos.filter((e: any) => e.estado !== 'salida');
  }, [equipos, esEntrada]);

  const probetasDisponibles = useMemo(() => {
    if (esEntrada) {
      return probetas.filter((p) => p.estado === 'salida');
    }
    return probetas.filter((p) => p.estado !== 'salida');
  }, [probetas, esEntrada]);

  // Si al cambiar el tipo de movimiento, el objeto seleccionado ya no es válido, lo limpiamos
  useEffect(() => {
    if (tipoObjeto === 'equipo') {
      const sigueValido = equiposDisponibles.some((e) => e.id === form.equipo_id);
      if (form.equipo_id && !sigueValido) {
        setForm((f) => ({ ...f, equipo_id: '', ubicacion_origen: '' }));
      }
    } else {
      const sigueValido = probetasDisponibles.some((p) => p.id === form.probeta_id);
      if (form.probeta_id && !sigueValido) {
        setForm((f) => ({ ...f, probeta_id: '' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipo, tipoObjeto, equiposDisponibles, probetasDisponibles]);

  const probetaSeleccionada = probetasDisponibles.find((p) => p.id === form.probeta_id);

  const handleEquipoChange = (id: string) => {
    const eq = equiposDisponibles.find((e) => e.id === id) as any;
    setForm((f) => ({
      ...f,
      equipo_id: id,
      ubicacion_origen: eq?.ubicacion ?? f.ubicacion_origen,
    }));
  };

  const handleProbetaChange = (id: string) => {
    setForm((f) => ({ ...f, probeta_id: id }));
  };

  const cambioTipoObjeto = (tipo: TipoObjeto) => {
    setTipoObjeto(tipo);
    setForm((f) => ({ ...f, equipo_id: '', probeta_id: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tipoObjeto === 'equipo' && !form.equipo_id) {
      return setError(
        esEntrada
          ? 'Selecciona un equipo que esté fuera del almacén para recuperarlo'
          : 'Selecciona un equipo'
      );
    }
    if (tipoObjeto === 'probeta' && !form.probeta_id) {
      return setError(
        esEntrada
          ? 'Selecciona una probeta que esté fuera del almacén para recuperarla'
          : 'Selecciona una probeta'
      );
    }

    if (requiereDestinoExterno) {
      if (!form.destino_tipo) return setError('Selecciona el tipo de destino');
      if (!form.destino_nombre.trim()) return setError('Indica el nombre del destino');
    }

    if (form.tipo === 'salida') {
      const nombre = tipoObjeto === 'equipo'
        ? (equiposDisponibles.find((e) => e.id === form.equipo_id) as any)?.nombre
        : probetaSeleccionada?.nombre;
      const confirmar = confirm(
        `⚠️ ¿Confirmar SALIDA DEFINITIVA del almacén?\n\n` +
        `"${nombre}" dejará de aparecer en el inventario y no podrá prestarse.\n\n` +
        `Solo se podrá recuperar registrando una nueva "Entrada al almacén".`
      );
      if (!confirmar) return;
    }

    setLoading(true);
    try {
      const payload: any = {
        equipo_id: tipoObjeto === 'equipo' ? form.equipo_id : null,
        probeta_id: tipoObjeto === 'probeta' ? form.probeta_id : null,
        tipo: form.tipo,
        ubicacion_origen: form.ubicacion_origen.trim() || null,
        ubicacion_destino: form.ubicacion_destino.trim() || null,
        referencia: form.referencia.trim() || null,
        observaciones: form.observaciones.trim() || null,
        destino_tipo: requiereDestinoExterno ? form.destino_tipo : null,
        destino_nombre: requiereDestinoExterno ? form.destino_nombre.trim() : null,
        destino_contacto: requiereDestinoExterno ? (form.destino_contacto.trim() || null) : null,
        fecha_devolucion_prevista:
          requiereDestinoExterno && form.fecha_devolucion_prevista
            ? new Date(form.fecha_devolucion_prevista).toISOString()
            : null,
      };

      const { error: insErr } = await supabase.from('movimientos').insert(payload);
      if (insErr) throw insErr;

      if (tipoObjeto === 'equipo') {
        if (form.tipo === 'transferencia' && form.ubicacion_destino.trim()) {
          await supabase
            .from('equipos')
            .update({ ubicacion: form.ubicacion_destino.trim() })
            .eq('id', form.equipo_id);
        } else if (form.tipo === 'prestamo_externo') {
          await supabase.from('equipos').update({ estado: 'prestado' }).eq('id', form.equipo_id);
        } else if (form.tipo === 'devolucion_externa') {
          await supabase.from('equipos').update({ estado: 'disponible' }).eq('id', form.equipo_id);
        } else if (form.tipo === 'salida') {
          await supabase.from('equipos').update({ estado: 'salida' }).eq('id', form.equipo_id);
        } else if (form.tipo === 'entrada') {
          const { data: eqActual } = await supabase
            .from('equipos')
            .select('estado, proxima_calibracion')
            .eq('id', form.equipo_id)
            .single();
          const vencida = eqActual?.proxima_calibracion &&
            new Date(eqActual.proxima_calibracion) < new Date();
          await supabase
            .from('equipos')
            .update({ estado: vencida ? 'pendiente_calibracion' : 'disponible' })
            .eq('id', form.equipo_id);
        }
      } else {
        if (form.tipo === 'prestamo_externo') {
          await supabase.from('probetas').update({ estado: 'prestado' }).eq('id', form.probeta_id);
        } else if (form.tipo === 'devolucion_externa') {
          await supabase.from('probetas').update({ estado: 'disponible' }).eq('id', form.probeta_id);
        } else if (form.tipo === 'salida') {
          await supabase.from('probetas').update({ estado: 'salida' }).eq('id', form.probeta_id);
        } else if (form.tipo === 'entrada') {
          await supabase.from('probetas').update({ estado: 'disponible' }).eq('id', form.probeta_id);
        }
      }

      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('row-level security'))
        setError('No tienes permisos para registrar movimientos.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-airbus-sky" />
      </div>
    );
  }

  const IconoTipoDestino = tiposDestino.find((t) => t.value === form.destino_tipo)?.icon ?? Building2;

  const sinDisponibles =
    (tipoObjeto === 'equipo' && equiposDisponibles.length === 0) ||
    (tipoObjeto === 'probeta' && probetasDisponibles.length === 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* TIPO DE OBJETO */}
      <Section title="¿Qué se mueve?">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cambioTipoObjeto('equipo')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition ${
              tipoObjeto === 'equipo'
                ? 'bg-airbus-blue text-white border-airbus-blue shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:border-airbus-blue/40'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="font-semibold">Equipo</span>
          </button>
          <button
            type="button"
            onClick={() => cambioTipoObjeto('probeta')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition ${
              tipoObjeto === 'probeta'
                ? 'bg-airbus-blue text-white border-airbus-blue shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:border-airbus-blue/40'
            }`}
          >
            <Hash className="w-5 h-5" />
            <span className="font-semibold">Probeta</span>
          </button>
        </div>
      </Section>

      {/* TIPO DE MOVIMIENTO */}
      <Section title="Tipo de movimiento">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tiposMovimiento.map((t) => {
            const activo = form.tipo === t.value;
            const esExterno = t.requiereDestinoExterno;
            const esSalida = t.value === 'salida';
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => update('tipo', t.value)}
                className={`text-left p-3 rounded-lg border-2 transition ${
                  activo
                    ? esSalida
                      ? 'bg-airbus-red/10 border-airbus-red text-airbus-red shadow-sm'
                      : esExterno
                        ? 'bg-airbus-orange/10 border-airbus-orange text-airbus-orange shadow-sm'
                        : 'bg-airbus-blue/5 border-airbus-blue text-airbus-blue shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {(esExterno || esSalida) && (
                    <Truck className={`w-4 h-4 shrink-0 ${activo ? '' : esSalida ? 'text-airbus-red' : 'text-airbus-orange'}`} />
                  )}
                  <span className="font-semibold text-sm">{t.label}</span>
                </div>
                <p className="text-[10px] opacity-75 mt-0.5 leading-tight">
                  {t.descripcion}
                </p>
              </button>
            );
          })}
        </div>

        {form.tipo === 'salida' && (
          <div className="mt-3 flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/30 text-airbus-red text-xs p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Salida definitiva del almacén</p>
              <p className="opacity-80 mt-0.5">
                El objeto dejará de aparecer en el inventario y no podrá prestarse.
                Solo se puede recuperar registrando una nueva "Entrada al almacén".
              </p>
            </div>
          </div>
        )}

        {esEntrada && (
          <div className="mt-3 flex items-start gap-2 bg-airbus-green/10 border border-airbus-green/30 text-airbus-green text-xs p-3 rounded-lg">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Recuperar objeto fuera del almacén</p>
              <p className="opacity-80 mt-0.5">
                Solo se muestran los equipos y probetas que actualmente están fuera del
                almacén (estado "salida"). Al guardar volverán al inventario.
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* OBJETO */}
      <Section title={tipoObjeto === 'equipo' ? 'Equipo' : 'Probeta'}>
        {sinDisponibles ? (
          <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
            {esEntrada ? (
              <>
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium mb-1">
                  No hay {tipoObjeto === 'equipo' ? 'equipos' : 'probetas'} fuera del almacén
                </p>
                <p className="text-xs text-gray-400">
                  Todos los objetos de este tipo están actualmente en el inventario.
                </p>
              </>
            ) : (
              <>
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium mb-1">
                  No hay {tipoObjeto === 'equipo' ? 'equipos' : 'probetas'} disponibles
                </p>
                <p className="text-xs text-gray-400">
                  Todos los objetos de este tipo están fuera del almacén.
                  <br />
                  Si quieres recuperar uno, selecciona el tipo de movimiento "Entrada al almacén".
                </p>
              </>
            )}
          </div>
        ) : tipoObjeto === 'equipo' ? (
          <EquipoSelect
            equipos={equiposDisponibles}
            value={form.equipo_id}
            onChange={handleEquipoChange}
            placeholder="— Selecciona un equipo —"
          />
        ) : (
          <>
            <select
              className="input"
              value={form.probeta_id}
              onChange={(e) => handleProbetaChange(e.target.value)}
            >
              <option value="">— Selecciona una probeta —</option>
              {probetasDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pn} · {p.nombre}
                  {p.carros?.codigo ? ` (${p.carros.codigo}${p.num_bandeja ? ` · B${p.num_bandeja}` : ''})` : ''}
                  {p.estado === 'salida' ? ' — FUERA' : ''}
                </option>
              ))}
            </select>

            {probetaSeleccionada && (
              <div className="mt-3 p-3 bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg flex items-center gap-3">
                <div className="w-10 h-10 bg-airbus-sky/20 rounded-lg flex items-center justify-center shrink-0">
                  <Hash className="w-5 h-5 text-airbus-sky" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold text-airbus-blue text-xs">
                    {probetaSeleccionada.pn}
                  </p>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {probetaSeleccionada.nombre}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {probetaSeleccionada.codigo_barras && (
                      <span className="text-[10px] font-mono text-gray-500">
                        {probetaSeleccionada.codigo_barras}
                      </span>
                    )}
                    {probetaSeleccionada.carros?.codigo && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-airbus-sky/15 text-airbus-sky rounded text-[9px] font-bold">
                        {probetaSeleccionada.carros.codigo}
                        {probetaSeleccionada.num_bandeja ? ` · B${probetaSeleccionada.num_bandeja}` : ''}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      probetaSeleccionada.estado === 'disponible'
                        ? 'bg-airbus-green/15 text-airbus-green'
                        : probetaSeleccionada.estado === 'prestado'
                          ? 'bg-airbus-orange/15 text-airbus-orange'
                          : probetaSeleccionada.estado === 'salida'
                            ? 'bg-airbus-red/15 text-airbus-red'
                            : 'bg-gray-100 text-gray-500'
                    }`}>
                      {probetaSeleccionada.estado}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* DESTINO EXTERNO */}
      {requiereDestinoExterno && (
        <Section title="Destino externo">
          <div className="p-4 bg-airbus-orange/5 border-2 border-airbus-orange/30 rounded-lg space-y-4">
            <div className="flex items-start gap-2">
              <Truck className="w-4 h-4 text-airbus-orange shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700">
                Indica a dónde va el objeto prestado. Se registrará como préstamo externo.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Tipo de destino *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {tiposDestino.map((t) => {
                  const Icon = t.icon;
                  const activo = form.destino_tipo === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => update('destino_tipo', t.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border-2 transition ${
                        activo
                          ? 'bg-airbus-orange text-white border-airbus-orange shadow-md'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-airbus-orange/50 hover:text-airbus-orange'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-semibold">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre del destino *
                </label>
                <input
                  className="input"
                  value={form.destino_nombre}
                  onChange={(e) => update('destino_nombre', e.target.value)}
                  placeholder={
                    form.destino_tipo === 'almacen'
                      ? 'Almacén Madrid Norte'
                      : form.destino_tipo === 'seccion'
                        ? 'Sección Inspección'
                        : form.destino_tipo === 'compania'
                          ? 'Applus Services'
                          : 'Nombre del destino'
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Persona de contacto
                </label>
                <input
                  className="input"
                  value={form.destino_contacto}
                  onChange={(e) => update('destino_contacto', e.target.value)}
                  placeholder="Nombre / teléfono / email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fecha de devolución prevista
              </label>
              <input
                type="datetime-local"
                className="input"
                value={form.fecha_devolucion_prevista}
                onChange={(e) => update('fecha_devolucion_prevista', e.target.value)}
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Opcional. Ayuda a controlar cuándo debe volver el objeto.
              </p>
            </div>

            {form.destino_tipo && form.destino_nombre && (
              <div className="pt-3 border-t border-airbus-orange/20 flex items-center gap-3">
                <div className="w-10 h-10 bg-airbus-orange/20 rounded-lg flex items-center justify-center shrink-0">
                  <IconoTipoDestino className="w-5 h-5 text-airbus-orange" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {tiposDestino.find((t) => t.value === form.destino_tipo)?.label}
                  </p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {form.destino_nombre}
                  </p>
                  {form.destino_contacto && (
                    <p className="text-[10px] text-gray-500 truncate">
                      {form.destino_contacto}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* UBICACIONES */}
      {!requiereDestinoExterno && (
        <Section title="Ubicaciones">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <Field label="Ubicación origen">
              <input
                className="input"
                value={form.ubicacion_origen}
                onChange={(e) => update('ubicacion_origen', e.target.value)}
                placeholder="Estante A-3"
              />
            </Field>
            <div className="hidden md:flex items-center justify-center pb-2">
              <ArrowRight className="w-5 h-5 text-airbus-sky" />
            </div>
            <Field label="Ubicación destino">
              <input
                className="input"
                value={form.ubicacion_destino}
                onChange={(e) => update('ubicacion_destino', e.target.value)}
                placeholder="Estante B-1"
              />
            </Field>
          </div>
        </Section>
      )}

      {/* REFERENCIA */}
      <Section title="Referencia">
        <Field label="Referencia / Nº de orden">
          <input
            className="input font-mono"
            value={form.referencia}
            onChange={(e) => update('referencia', e.target.value)}
            placeholder="ORD-2024-1234"
          />
        </Field>
      </Section>

      {/* OBSERVACIONES */}
      <Section title="Observaciones">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.observaciones}
          onChange={(e) => update('observaciones', e.target.value)}
          placeholder="Detalles del movimiento..."
        />
      </Section>

      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-sm p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-ghost border border-gray-300">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || sinDisponibles}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : form.tipo === 'salida' ? (
            <AlertCircle className="w-4 h-4" />
          ) : requiereDestinoExterno && form.tipo === 'prestamo_externo' ? (
            <Truck className="w-4 h-4" />
          ) : requiereDestinoExterno && form.tipo === 'devolucion_externa' ? (
            <CornerDownLeft className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {form.tipo === 'salida'
            ? 'Registrar salida del almacén'
            : requiereDestinoExterno && form.tipo === 'prestamo_externo'
              ? 'Registrar préstamo externo'
              : requiereDestinoExterno && form.tipo === 'devolucion_externa'
                ? 'Registrar devolución'
                : esEntrada
                  ? 'Registrar entrada al almacén'
                  : 'Registrar movimiento'}
        </button>
      </div>
    </form>
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