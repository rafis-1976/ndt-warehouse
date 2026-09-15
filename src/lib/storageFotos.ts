import { supabase } from './supabase';

const BUCKET = 'equipos-fotos';

export interface FotoEquipo {
  url: string;
  path: string;
  subida_en: string;
}

function dataURLtoBlob(dataURL: string): Blob {
  const [header, base64] = dataURL.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function subirFotoArchivo(
  file: File,
  equipoId: string
): Promise<FotoEquipo> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const timestamp = Date.now();
  const path = `${equipoId}/${timestamp}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    subida_en: new Date().toISOString(),
  };
}

export async function subirFotoBlob(
  blob: Blob,
  equipoId: string,
  extension: string = 'png'
): Promise<FotoEquipo> {
  const timestamp = Date.now();
  const path = `${equipoId}/${timestamp}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: blob.type });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    subida_en: new Date().toISOString(),
  };
}

export async function subirFotoDataURL(
  dataURL: string,
  equipoId: string
): Promise<FotoEquipo> {
  const blob = dataURLtoBlob(dataURL);
  const ext = blob.type.includes('png') ? 'png' : 'jpg';
  return subirFotoBlob(blob, equipoId, ext);
}

export async function eliminarFoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}