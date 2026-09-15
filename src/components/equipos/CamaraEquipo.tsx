import { useEffect, useRef, useState } from 'react';
import {
  Camera, X, Check, RotateCcw, Image as ImageIcon, Upload,
  Loader2, AlertCircle, Trash2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  subirFotoArchivo, subirFotoDataURL, eliminarFoto, type FotoEquipo,
} from '../../lib/storageFotos';

interface CamaraEquipoProps {
  equipoId: string;
  fotos: FotoEquipo[];
  onChange: (fotos: FotoEquipo[]) => void;
  disabled?: boolean;
}

export function CamaraEquipo({
  equipoId, fotos, onChange, disabled,
}: CamaraEquipoProps) {
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [captura, setCaptura] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [camaraActiva, setCamaraActiva] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const iniciarCamara = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamaraActiva(true);
    } catch (err: any) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Actívalo en el navegador.'
          : err.name === 'NotFoundError'
            ? 'No se ha detectado ninguna cámara.'
            : err.message ?? 'Error al acceder a la cámara'
      );
    }
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  };

  useEffect(() => {
    if (camaraAbierta) {
      iniciarCamara();
    } else {
      detenerCamara();
      setCaptura(null);
    }
    return () => { detenerCamara(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camaraAbierta]);

  const capturar = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL('image/jpeg', 0.85);
    setCaptura(dataURL);
    detenerCamara();
  };

  const repetir = () => {
    setCaptura(null);
    iniciarCamara();
  };

  const guardarCaptura = async () => {
    if (!captura) return;
    setSubiendo(true);
    setError('');
    try {
      const foto = await subirFotoDataURL(captura, equipoId);
      onChange([...fotos, foto]);
      setCamaraAbierta(false);
      setCaptura(null);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const handleArchivo = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setError('');
    try {
      const subidas: FotoEquipo[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 15 * 1024 * 1024) {
          setError(`"${file.name}" supera los 15 MB`);
          continue;
        }
        const foto = await subirFotoArchivo(file, equipoId);
        subidas.push(foto);
      }
      onChange([...fotos, ...subidas]);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir fotos');
    } finally {
      setSubiendo(false);
      if (inputFileRef.current) inputFileRef.current.value = '';
    }
  };

  const eliminarFotoSeleccionada = async (foto: FotoEquipo) => {
    if (!confirm('¿Eliminar esta foto?')) return;
    try {
      await eliminarFoto(foto.path);
      onChange(fotos.filter((f) => f.path !== foto.path));
    } catch (err: any) {
      setError(err.message ?? 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleArchivo(e.target.files)}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {fotos.map((foto) => (
          <div
            key={foto.path}
            className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group bg-gray-100"
          >
            <img
              src={foto.url}
              alt="Foto equipo"
              className="w-full h-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => eliminarFotoSeleccionada(foto)}
                className="absolute top-1.5 right-1.5 p-1.5 bg-airbus-red text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {!disabled && (
          <>
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              disabled={subiendo}
              className="aspect-square rounded-lg border-2 border-dashed border-airbus-sky bg-airbus-sky/5 hover:bg-airbus-sky/10 transition flex flex-col items-center justify-center gap-1.5 text-airbus-sky disabled:opacity-50"
            >
              {subiendo ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Camera className="w-6 h-6" />
                  <span className="text-xs font-medium">Hacer foto</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => inputFileRef.current?.click()}
              disabled={subiendo}
              className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition flex flex-col items-center justify-center gap-1.5 text-gray-500 disabled:opacity-50"
            >
              <ImageIcon className="w-6 h-6" />
              <span className="text-xs font-medium">Subir imagen</span>
            </button>
          </>
        )}
      </div>

      {fotos.length === 0 && disabled && (
        <p className="text-xs text-gray-400 italic text-center py-3">
          Sin fotos del equipo
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-xs p-2.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <Modal
        open={camaraAbierta}
        onClose={() => setCamaraAbierta(false)}
        title={captura ? 'Revisar foto' : 'Hacer foto al equipo'}
        size="md"
      >
        <div className="space-y-4">
          {!captura ? (
            <>
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {camaraActiva && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-airbus-red text-white text-xs font-bold px-2 py-1 rounded">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      EN DIRECTO
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-xs p-2.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={capturar}
                disabled={!camaraActiva}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Capturar foto
              </button>
            </>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <img src={captura} alt="Captura" className="w-full" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={repetir}
                  disabled={subiendo}
                  className="btn-ghost border border-gray-300 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Repetir
                </button>
                <button
                  type="button"
                  onClick={guardarCaptura}
                  disabled={subiendo}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {subiendo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Guardar foto
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}