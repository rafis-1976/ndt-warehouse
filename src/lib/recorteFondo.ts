import { removeBackground } from '@imgly/background-removal';

export async function recortarFondo(
  imagen: Blob | string,
  onProgress?: (porcentaje: number) => void
): Promise<Blob> {
  const blob = await removeBackground(imagen, {
    output: { format: 'image/png' },
    progress: (key: string, current: number, total: number) => {
      if (onProgress && total > 0) {
        onProgress(Math.round((current / total) * 100));
      }
    },
  });
  return blob;
}

export function dataURLtoBlob(dataURL: string): Blob {
  const [header, base64] = dataURL.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}