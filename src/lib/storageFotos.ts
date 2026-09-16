import { supabase } from './supabase';

export const BUCKET_EQUIPOS = 'equipos-fotos';
export const BUCKET_PROBETAS = 'probetas-fotos';

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
  referenciaId: string,
  bucket: string = BUCKET_EQUIPOS
): Promise<FotoEquipo> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const timestamp = Date.now();
  const path = `${referenciaId}/${timestamp}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    subida_en: new Date().toISOString(),
  };
}

export async function subirFotoBlob(
  blob: Blob,
  referenciaId: string,
  extension: string = 'png',
  bucket: string = BUCKET_EQUIPOS
): Promise<FotoEquipo> {
  const timestamp = Date.now();
  const path = `${referenciaId}/${timestamp}.${extension}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: blob.type });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    subida_en: new Date().toISOString(),
  };
}

export async function subirFotoDataURL(
  dataURL: string,
  referenciaId: string,
  bucket: string = BUCKET_EQUIPOS
): Promise<FotoEquipo> {
  const blob = dataURLtoBlob(dataURL);
  const ext = blob.type.includes('png') ? 'png' : 'jpg';
  return subirFotoBlob(blob, referenciaId, ext, bucket);
}

export async function eliminarFoto(
  path: string,
  bucket: string = BUCKET_EQUIPOS
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}