import { supabase } from './supabase';

export const BUCKET_EQUIPOS_DOCS = 'equipos-documentos';
export const BUCKET_PROBETAS_CERT = 'probetas-certificados';

export interface DocumentoEquipo {
  nombre: string;
  url: string;
  tipo: string;
  tamano: number;
  subido_en: string;
}

export async function subirDocumento(
  file: File,
  referenciaId: string,
  categoria: 'manual' | 'certificado' | 'otros' = 'otros',
  bucket: string = BUCKET_EQUIPOS_DOCS
): Promise<DocumentoEquipo> {
  const timestamp = Date.now();
  const path = `${referenciaId}/${categoria}/${timestamp}_${file.name}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    nombre: file.name,
    url: urlData.publicUrl,
    tipo: file.type,
    tamano: file.size,
    subido_en: new Date().toISOString(),
  };
}

export async function eliminarDocumento(
  url: string,
  bucket: string = BUCKET_EQUIPOS_DOCS
): Promise<void> {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.substring(idx + marker.length);

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function iconoDocumento(tipo: string): string {
  if (tipo.startsWith('image/')) return '🖼️';
  if (tipo === 'application/pdf') return '📄';
  if (tipo.includes('word')) return '📝';
  if (tipo.includes('excel') || tipo.includes('spreadsheet')) return '📊';
  if (tipo.includes('zip') || tipo.includes('compressed')) return '🗜️';
  return '📎';
}