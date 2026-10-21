import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Loader2 } from 'lucide-react';

interface CableFormProps {
  cableId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CableForm({ cableId, onSuccess, onCancel }: CableFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    id_cable: '',
    nombre: '',
    codigo_barras: '',
    estado: 'disponible',
    tecnica_id: '',
  });

  useEffect(() => {
    supabase.from('tecnicas_ndt').select('id, codigo, nombre').eq('activa', true).order('codigo')
      .then(({ data }) => setTecnicas(data ?? []));

    if (cableId) {
      setLoading(true);
      supabase.from('cables').select('*').eq('id', cableId).single()
        .then(({ data, error }) => {
          if (data) {
            setFormData({
              id_cable: data.id_cable || '',
              nombre: data.nombre || '',
              codigo_barras: data.codigo_barras || '',
              estado: data.estado || 'disponible',
              tecnica_id: data.tecnica_id || '',
            });
          }
          setLoading(false);
        });
    }
  }, [cableId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_cable.trim() || !formData.nombre.trim()) return;

    setSaving(true);
    try {
      const payload = {
        id_cable: formData.id_cable.trim(),
        nombre: formData.nombre.trim(),
        codigo_barras: formData.codigo_barras.trim() || null,
        estado: formData.estado,
        tecnica_id: formData.tecnica_id || null,
      };

      if (cableId) {
        const { error } = await supabase.from('cables').update(payload).eq('id', cableId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cables').insert([payload]);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">ID Cable *</label>
          <input
            className="input"
            value={formData.id_cable}
            onChange={(e) => setFormData({ ...formData, id_cable: e.target.value })}
            placeholder="Ej. CBL-001"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nombre *</label>
          <input
            className="input"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Ej. Cable LEMO 00"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Código de Barras</label>
          <input
            className="input"
            value={formData.codigo_barras}
            onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Técnica</label>
          <select
            className="input"
            value={formData.tecnica_id}
            onChange={(e) => setFormData({ ...formData, tecnica_id: e.target.value })}
          >
            <option value="">— Seleccionar —</option>
            {tecnicas.map((t) => (
              <option key={t.id} value={t.id}>{t.codigo} - {t.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Estado</label>
          <select
            className="input"
            value={formData.estado}
            onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
          >
            <option value="disponible">Disponible</option>
            <option value="mantenimiento">En Reparación</option>
            <option value="baja">De Baja</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-ghost" disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}