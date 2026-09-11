import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera, CameraOff } from 'lucide-react';

export function BarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  const start = async () => {
    setError('');
    readerRef.current = new BrowserMultiFormatReader();
    try {
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, err) => {
          if (result) {
            onScan(result.getText());
          }
        }
      );
      setActive(true);
    } catch (err: any) {
      setError('No se pudo acceder a la cámara: ' + err.message);
      setActive(false);
    }
  };

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  };

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" />

        {active && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2/3 h-1/3 border-2 border-airbus-light rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            <div className="absolute top-3 left-3 bg-airbus-red text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              EN DIRECTO
            </div>
          </>
        )}

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 p-4 text-center">
            <CameraOff className="w-10 h-10 mb-2" />
            <p className="text-sm">Cámara inactiva</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-4 text-center text-sm">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={active ? stop : start}
        className={active ? 'btn-ghost w-full flex items-center justify-center gap-2 border border-gray-300' : 'btn-primary w-full flex items-center justify-center gap-2'}
      >
        {active ? (
          <>
            <CameraOff className="w-4 h-4" />
            Detener escáner
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            Iniciar escáner
          </>
        )}
      </button>
    </div>
  );
}