import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Save, AlertCircle } from 'lucide-react';

interface CarroFormProps {
  carro?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CarroForm({ carro, onSuccess, onCancel }: CarroFormProps) {
  const [form, setForm] = useState({
    codigo: carro?.codigo ?? '',
    nombre: carro?.nombre ?? '',
    descripcion: carro?.descripcion ?? '',
    ubicacion: carro?.ubicacion ?? '',
    activo: carro?.activo ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.codigo.trim()) return setError('El código es obligatorio');
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');

    setLoading(true);
    try {
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        ubicacion: form.ubicacion.trim() || null,
        activo: form.activo,
      };

      if (carro) {
        const { error } = await supabase.from('carros').update(payload).eq('id', carro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('carros').insert(payload);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error desconocido';
      if (msg.includes('carros_codigo_key')) setError('Ya existe un carro con ese código');
      else if (msg.includes('row-level security')) setError('No tienes permisos para esta acción');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Datos del carro">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Código *">
            <input
              className="input font-mono"
              value={form.codigo}
              onChange={(e) => update('codigo', e.target.value.toUpperCase())}
              placeholder="CARRO-04"
              required
            />
          </Field>
          <Field label="Nombre *">
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              placeholder="Carro UT secundario"
              required
            />
          </Field>
          <Field label="Ubicación">
            <input
              className="input"
              value={form.ubicacion}
              onChange={(e) => update('ubicacion', e.target.value)}
              placeholder="Zona A - Estante 3"
            />
          </Field>
          <Field label="Estado">
            <select
              className="input"
              value={form.activo ? 'activo' : 'inactivo'}
              onChange={(e) => update('activo', e.target.value === 'activo')}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Descripción">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.descripcion}
          onChange={(e) => update('descripcion', e.target.value)}
          placeholder="Contenido del carro, tipo de probetas que almacena..."
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
        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {carro ? 'Guardar cambios' : 'Crear carro'}
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