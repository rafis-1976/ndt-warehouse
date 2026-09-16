import { useEffect, useRef, useState } from 'react';
import {
  Camera, Check, RotateCcw, Image as ImageIcon, Loader2,
  AlertCircle, Trash2, Scissors, Sparkles, Crop, Undo2, X,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  subirFotoArchivo, subirFotoDataURL, subirFotoBlob,
  eliminarFoto, BUCKET_EQUIPOS, type FotoEquipo,
} from '../../lib/storageFotos';
import { recortarFondo, dataURLtoBlob } from '../../lib/recorteFondo';

interface CamaraEquipoProps {
  equipoId: string;
  fotos: FotoEquipo[];
  onChange: (fotos: FotoEquipo[]) => void;
  disabled?: boolean;
  bucket?: string;
  compacto?: boolean;
}

type ModoEdicion = 'ver' | 'recorte';
type Rect = { x: number; y: number; w: number; h: number };

export function CamaraEquipo({
  equipoId, fotos, onChange, disabled, bucket = BUCKET_EQUIPOS, compacto = false,
}: CamaraEquipoProps) {
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [captura, setCaptura] = useState<string | null>(null);
  const [imagenActual, setImagenActual] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [camaraActiva, setCamaraActiva] = useState(false);

  const [modoEdicion, setModoEdicion] = useState<ModoEdicion>('ver');
  const [seleccion, setSeleccion] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
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
    if (camaraAbierta) iniciarCamara();
    else {
      detenerCamara();
      setCaptura(null);
      setImagenActual(null);
      setProgreso(0);
      setDebugInfo('');
      setModoEdicion('ver');
      setSeleccion(null);
      setDrag(null);
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
    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    setCaptura(dataURL);
    setImagenActual(dataURL);
    setModoEdicion('ver');
    detenerCamara();
  };

  const repetir = () => {
    setCaptura(null);
    setImagenActual(null);
    setProgreso(0);
    setDebugInfo('');
    setError('');
    setModoEdicion('ver');
    setSeleccion(null);
    setDrag(null);
    iniciarCamara();
  };

  const restablecer = () => {
    if (!captura) return;
    setImagenActual(captura);
    setSeleccion(null);
    setDrag(null);
    setModoEdicion('ver');
    setProgreso(0);
    setDebugInfo('');
    setError('');
  };

  // ============================================================
  // RECORTE MANUAL
  // ============================================================
  const rectActual = (): Rect | null => {
    if (drag) {
      const x = Math.min(drag.sx, drag.cx);
      const y = Math.min(drag.sy, drag.cy);
      const w = Math.abs(drag.cx - drag.sx);
      const h = Math.abs(drag.cy - drag.sy);
      return { x, y, w, h };
    }
    return seleccion;
  };

  const iniciarDrag = (e: React.PointerEvent) => {
    if (modoEdicion !== 'recorte' || !imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setDrag({ sx: x, sy: y, cx: x, cy: y });
    setSeleccion(null);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const moverDrag = (e: React.PointerEvent) => {
    if (!drag || !imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setDrag({ ...drag, cx: x, cy: y });
  };

  const finDrag = () => {
    if (!drag) return;
    const r = rectActual();
    if (!r || r.w < 20 || r.h < 20) {
      setDrag(null);
      setSeleccion(null);
      return;
    }
    setSeleccion(r);
    setDrag(null);
  };

  const aplicarRecorte = async () => {
    const sel = rectActual();
    const img = imgRef.current;
    if (!sel || !img || !imagenActual) return;

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const shownW = img.clientWidth;
    const shownH = img.clientHeight;

    const scaleX = naturalW / shownW;
    const scaleY = naturalH / shownH;

    const sx = Math.round(sel.x * scaleX);
    const sy = Math.round(sel.y * scaleY);
    const sw = Math.round(sel.w * scaleX);
    const sh = Math.round(sel.h * scaleY);

    if (sw < 10 || sh < 10) return;

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageObj = new Image();
    imageObj.crossOrigin = 'anonymous';
    imageObj.src = imagenActual;
    await new Promise<void>((res, rej) => {
      imageObj.onload = () => res();
      imageObj.onerror = () => rej(new Error('Error al cargar imagen'));
    });

    ctx.drawImage(imageObj, sx, sy, sw, sh, 0, 0, sw, sh);
    setImagenActual(canvas.toDataURL('image/png'));
    setModoEdicion('ver');
    setSeleccion(null);
    setDrag(null);
    setDebugInfo(`Recorte manual aplicado: ${sw} × ${sh} px`);
  };

  const cancelarRecorte = () => {
    setModoEdicion('ver');
    setSeleccion(null);
    setDrag(null);
  };

  // ============================================================
  // RECORTE POR IA
  // ============================================================
  const aplicarIA = async () => {
    if (!imagenActual) return;
    setProcesando(true);
    setError('');
    setProgreso(0);
    setDebugInfo('Iniciando recorte con IA...');

    try {
      if (typeof recortarFondo !== 'function') {
        throw new Error('Función de recorte IA no disponible');
      }

      const originalBlob = dataURLtoBlob(imagenActual);
      const recortado = await recortarFondo(originalBlob, (p) => {
        setProgreso(p);
        setDebugInfo(`Procesando IA: ${p}%`);
      });

      if (!recortado || recortado.size === 0) {
        throw new Error('El recorte IA devolvió un archivo vacío');
      }

      const reader = new FileReader();
      const dataURL = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error al leer imagen procesada'));
        reader.readAsDataURL(recortado);
      });

      setImagenActual(dataURL);
      setDebugInfo(
        `Recorte IA aplicado · ${(recortado.size / 1024).toFixed(1)} KB · ${recortado.type}`
      );
    } catch (err: any) {
      console.error('[CamaraEquipo] IA Error:', err);
      const mensaje = err?.message ?? 'Error desconocido';
      setError(`Error IA: ${mensaje}`);
      setDebugInfo(`Detalle: ${err?.name ?? 'Error'} — ${mensaje}`);
    } finally {
      setProcesando(false);
      setProgreso(0);
    }
  };

  // ============================================================
  // GUARDAR
  // ============================================================
  const guardarCaptura = async () => {
    if (!imagenActual) return;
    setSubiendo(true);
    setError('');

    try {
      const foto = await subirFotoDataURL(imagenActual, equipoId, bucket);
      onChange([...fotos, foto]);
      setCamaraAbierta(false);
    } catch (err: any) {
      console.error('[CamaraEquipo] Error subiendo:', err);
      setError(err.message ?? 'Error al subir la imagen');
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
        const foto = await subirFotoArchivo(file, equipoId, bucket);
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
      await eliminarFoto(foto.path, bucket);
      onChange(fotos.filter((f) => f.path !== foto.path));
    } catch (err: any) {
      setError(err.message ?? 'Error al eliminar');
    }
  };

  const rect = rectActual();
  const modoRecorte = modoEdicion === 'recorte';

  return (
    <div className={compacto ? 'space-y-2' : 'space-y-3'}>
      <input
        ref={inputFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleArchivo(e.target.files)}
      />

      <div className={compacto ? 'space-y-2' : 'grid grid-cols-2 sm:grid-cols-4 gap-3'}>
        {fotos.map((foto) => (
          <div
            key={foto.path}
            className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group bg-gradient-to-br from-gray-50 to-gray-100"
          >
            <img src={foto.url} alt="Foto" className="w-full h-full object-contain" />
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

        {!disabled && fotos.length === 0 && (
          <>
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              disabled={subiendo}
              className={`${compacto ? 'w-full py-3' : 'aspect-square'} rounded-lg border-2 border-dashed border-airbus-sky bg-airbus-sky/5 hover:bg-airbus-sky/10 transition flex flex-col items-center justify-center gap-1.5 text-airbus-sky disabled:opacity-50`}
            >
              {subiendo ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Camera className={compacto ? 'w-5 h-5' : 'w-6 h-6'} />
                  <span className="text-xs font-medium">Hacer foto</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => inputFileRef.current?.click()}
              disabled={subiendo}
              className={`${compacto ? 'w-full py-3' : 'aspect-square'} rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition flex flex-col items-center justify-center gap-1.5 text-gray-500 disabled:opacity-50`}
            >
              <ImageIcon className={compacto ? 'w-5 h-5' : 'w-6 h-6'} />
              <span className="text-xs font-medium">Subir imagen</span>
            </button>
          </>
        )}
      </div>

      {fotos.length > 0 && !disabled && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCamaraAbierta(true)}
            disabled={subiendo}
            className="flex-1 text-xs py-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded-lg transition border border-airbus-sky/30 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Camera className="w-3.5 h-3.5" />
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => inputFileRef.current?.click()}
            disabled={subiendo}
            className="flex-1 text-xs py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition border border-gray-200 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Otra
          </button>
        </div>
      )}

      {fotos.length === 0 && disabled && (
        <p className="text-xs text-gray-400 italic text-center py-3">Sin foto</p>
      )}

      {error && !camaraAbierta && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-xs p-2.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{error}</p>
            {debugInfo && (
              <p className="mt-1 opacity-70 font-mono text-[10px]">{debugInfo}</p>
            )}
          </div>
        </div>
      )}

      <Modal
        open={camaraAbierta}
        onClose={() => { if (!subiendo && !procesando) setCamaraAbierta(false); }}
        title={
          !captura
            ? 'Hacer foto'
            : modoRecorte
              ? 'Recorte manual'
              : 'Editar y guardar'
        }
        size="lg"
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
                    <div className="absolute inset-8 border-2 border-white/40 border-dashed rounded-xl" />
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
              {modoRecorte && (
                <div className="flex items-center gap-2 bg-airbus-sky/10 border border-airbus-sky/30 text-airbus-sky text-xs p-3 rounded-lg">
                  <Crop className="w-4 h-4 shrink-0" />
                  <p className="font-medium">
                    Arrastra sobre la imagen para seleccionar el área que quieres conservar
                  </p>
                </div>
              )}

              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 flex justify-center">
                <div ref={imgWrapRef} className="relative inline-block max-w-full">
                  <img
                    ref={imgRef}
                    src={imagenActual ?? captura}
                    alt="Captura"
                    className="max-w-full h-auto select-none block"
                    draggable={false}
                  />

                  {modoRecorte && (
                    <div
                      className="absolute inset-0 cursor-crosshair touch-none"
                      onPointerDown={iniciarDrag}
                      onPointerMove={moverDrag}
                      onPointerUp={finDrag}
                      onPointerCancel={finDrag}
                      style={{ touchAction: 'none' }}
                    >
                      {rect && rect.w > 5 && rect.h > 5 ? (
                        <div
                          className="absolute border-2 border-airbus-sky pointer-events-none"
                          style={{
                            left: rect.x,
                            top: rect.y,
                            width: rect.w,
                            height: rect.h,
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                          }}
                        >
                          <div className="absolute -top-7 left-0 bg-airbus-sky text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap">
                            {Math.round(rect.w)} × {Math.round(rect.h)}
                          </div>
                          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white" />
                          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white" />
                          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white" />
                          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/30" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {procesando && (
                <div className="bg-airbus-sky/5 border border-airbus-sky/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 text-airbus-sky animate-spin" />
                    <span className="text-xs font-medium text-airbus-blue">
                      Procesando con IA...
                    </span>
                    <span className="ml-auto text-xs font-bold text-airbus-sky">
                      {progreso}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-airbus-sky transition-all duration-300"
                      style={{ width: `${progreso}%` }}
                    />
                  </div>
                </div>
              )}

              {debugInfo && !procesando && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                  <p className="text-[10px] font-mono text-gray-600 break-all">
                    {debugInfo}
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-xs p-3 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Error</p>
                    <p className="mt-1 opacity-90">{error}</p>
                  </div>
                </div>
              )}

              {!modoRecorte && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModoEdicion('recorte')}
                    disabled={subiendo || procesando}
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg border-2 border-gray-200 hover:border-airbus-sky hover:bg-airbus-sky/5 transition text-gray-600 hover:text-airbus-sky disabled:opacity-50"
                  >
                    <Crop className="w-5 h-5" />
                    <span className="text-xs font-semibold">Recorte manual</span>
                  </button>
                  <button
                    type="button"
                    onClick={aplicarIA}
                    disabled={subiendo || procesando}
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg border-2 border-gray-200 hover:border-airbus-sky hover:bg-airbus-sky/5 transition text-gray-600 hover:text-airbus-sky disabled:opacity-50"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-xs font-semibold">Quitar fondo IA</span>
                  </button>
                  <button
                    type="button"
                    onClick={restablecer}
                    disabled={subiendo || procesando || imagenActual === captura}
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg border-2 border-gray-200 hover:border-airbus-orange hover:bg-airbus-orange/5 transition text-gray-600 hover:text-airbus-orange disabled:opacity-30"
                  >
                    <Undo2 className="w-5 h-5" />
                    <span className="text-xs font-semibold">Restablecer</span>
                  </button>
                </div>
              )}

              {modoRecorte && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={cancelarRecorte}
                    className="btn-ghost border border-gray-300 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={aplicarRecorte}
                    disabled={!seleccion}
                    className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Crop className="w-4 h-4" />
                    Aplicar recorte
                  </button>
                </div>
              )}

              {!modoRecorte && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={repetir}
                    disabled={subiendo || procesando}
                    className="btn-ghost border border-gray-300 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Repetir
                  </button>
                  <button
                    type="button"
                    onClick={guardarCaptura}
                    disabled={subiendo || procesando}
                    className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {subiendo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {subiendo ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}