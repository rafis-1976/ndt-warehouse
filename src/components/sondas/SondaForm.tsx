import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, X, Loader2 } from 'lucide-react';

interface SondaFormProps {
  sondaId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SondaForm({ sondaId, onSuccess, onCancel }: SondaFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    id_sonda: '',
    nombre: '',
    codigo_barras: '',
    estado: 'disponible',
    tecnica_id: '',
  });

  useEffect(() => {
    // Cargar técnicas
    supabase.from('tecnicas_ndt').select('id, codigo, nombre').eq('activa', true).order('codigo')
      .then(({ data }) => setTecnicas(data ?? []));

    // Cargar datos si es edición
    if (sondaId) {
      setLoading(true);
      supabase.from('sondas').select('*').eq('id', sondaId).single()
        .then(({ data, error }) => {
          if (data) {
            setFormData({
              id_sonda: data.id_sonda || '',
              nombre: data.nombre || '',
              codigo_barras: data.codigo_barras || '',
              estado: data.estado || 'disponible',
              tecnica_id: data.tecnica_id || '',
            });
          }
          setLoading(false);
        });
    }
  }, [sondaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_sonda.trim() || !formData.nombre.trim()) return;

    setSaving(true);
    try {
      const payload = {
        id_sonda: formData.id_sonda.trim(),
        nombre: formData.nombre.trim(),
        codigo_barras: formData.codigo_barras.trim() || null,
        estado: formData.estado,
        tecnica_id: formData.tecnica_id || null,
      };

      if (sondaId) {
        const { error } = await supabase.from('sondas').update(payload).eq('id', sondaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sondas').insert([payload]);
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
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">ID Sonda *</label>
          <input
            className="input"
            value={formData.id_sonda}
            onChange={(e) => setFormData({ ...formData, id_sonda: e.target.value })}
            placeholder="Ej. SND-001"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nombre *</label>
          <input
            className="input"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Ej. Sonda Angular 45º"
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