import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import {
  Camera, CameraOff, Zap, ZapOff, RefreshCw, CheckCircle2,
  RotateCw,
} from 'lucide-react';

export function BarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [flash, setFlash] = useState(false);
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [modo, setModo] = useState<'native' | 'zxing' | null>(null);

  // ----------------------------------------------------------
  // 1. Enumerar cámaras y preferir la trasera
  // ----------------------------------------------------------
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
        tmp.getTracks().forEach((t) => t.stop());
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelado) return;
        const cams = list.filter((d) => d.kind === 'videoinput');
        setDevices(cams);
        const back =
          cams.find((c) => /back|rear|trasera|environment/i.test(c.label)) ??
          cams[cams.length - 1] ?? cams[0];
        if (back) setDeviceId(back.deviceId);
      } catch (e: any) {
        if (!cancelado) setError(e?.message ?? 'No se pudo acceder a las cámaras');
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // ----------------------------------------------------------
  // 2. Parar todo
  // ----------------------------------------------------------
  const stop = useCallback(() => {
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    detectorRef.current = null;

    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;

    setActive(false);
    setTorchOn(false);
    setTorchAvailable(false);
    setZoomRange(null);
    setModo(null);
  }, []);

  // ----------------------------------------------------------
  // 3. Detección nativa (BarcodeDetector API) — la más fiable para 1D
  // ----------------------------------------------------------
  const startNative = useCallback(async () => {
    const Detector = (window as any).BarcodeDetector;
    const formats = await Detector.getSupportedFormats();
    const det = new Detector({
      formats: formats.filter((f: string) =>
        [
          'code_128', 'code_39', 'code_93', 'codabar', 'itf',
          'ean_13', 'ean_8', 'upc_a', 'upc_e',
          'qr_code', 'data_matrix', 'pdf417', 'aztec',
        ].includes(f)
      ),
    });
    detectorRef.current = det;

    const scanLoop = async () => {
      if (!detectorRef.current || !videoRef.current) return;
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          const now = Date.now();
          if (!(lastScanRef.current.code === code && now - lastScanRef.current.at < 1500)) {
            lastScanRef.current = { code, at: now };
            setFlash(true); setUltimoCodigo(code);
            setTimeout(() => setFlash(false), 220);
            onScan(code);
          }
        }
      } catch {}
      rafRef.current = requestAnimationFrame(scanLoop);
    };
    scanLoop();
  }, [onScan]);

  // ----------------------------------------------------------
  // 4. Detección con ZXing (fallback) con rotación opcional
  // ----------------------------------------------------------
  const startZxing = useCallback(async () => {
    if (!videoRef.current) return;

    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
      BarcodeFormat.CODABAR, BarcodeFormat.ITF,
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417, BarcodeFormat.AZTEC,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ALSO_INVERTED, true);

    const reader = new BrowserMultiFormatReader(hints as any, {
      delayBetweenScanAttempts: 50,
      delayBetweenScanSuccess: 200,
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const scanLoop = async () => {
      const v = videoRef.current;
      if (!v || v.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      try {
        let result;
        if (rotation !== 0) {
          const w = v.videoWidth, h = v.videoHeight;
          canvas.width = rotation === 90 || rotation === 270 ? h : w;
          canvas.height = rotation === 90 || rotation === 270 ? w : h;
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.drawImage(v, -w / 2, -h / 2, w, h);
          ctx.restore();
          result = await reader.decodeFromCanvas(canvas);
        } else {
          result = await reader.decodeFromVideoElement(v);
        }

        if (result) {
          const code = result.getText();
          const now = Date.now();
          if (!(lastScanRef.current.code === code && now - lastScanRef.current.at < 1500)) {
            lastScanRef.current = { code, at: now };
            setFlash(true); setUltimoCodigo(code);
            setTimeout(() => setFlash(false), 220);
            onScan(code);
          }
        }
      } catch {}
      rafRef.current = requestAnimationFrame(scanLoop);
    };
    scanLoop();
  }, [rotation, onScan]);

  // ----------------------------------------------------------
  // 5. Arrancar cámara + elegir motor de detección
  // ----------------------------------------------------------
  const start = useCallback(async () => {
    if (!videoRef.current) return;
    setError('');

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 15 },
          // @ts-ignore
          focusMode: 'continuous',
          // @ts-ignore
          advanced: [{ focusMode: 'continuous' }],
        } as MediaTrackConstraints,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as any;
      setTorchAvailable(!!caps.torch);
      if (caps.zoom) {
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
        setZoom(caps.zoom.min);
      } else {
        setZoomRange(null);
      }

      const hasNative = 'BarcodeDetector' in window;
      setModo(hasNative ? 'native' : 'zxing');
      setActive(true);

      if (hasNative) {
        await startNative();
      } else {
        await startZxing();
      }
    } catch (e: any) {
      console.error('[Scanner] Error al iniciar:', e);
      setError('No se pudo acceder a la cámara: ' + (e?.message ?? ''));
      setActive(false);
    }
  }, [deviceId, startNative, startZxing]);

  // Reiniciar modo ZXing cuando cambia la rotación
  useEffect(() => {
    if (modo === 'zxing' && active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startZxing();
    }
  }, [rotation, modo, active, startZxing]);

  // ----------------------------------------------------------
  // 6. Linterna y zoom
  // ----------------------------------------------------------
  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as any);
      setTorchOn((v) => !v);
    } catch (e) {
      console.warn('[Scanner] Torch no disponible', e);
    }
  };

  const aplicarZoom = async (v: number) => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: v }] } as any);
      setZoom(v);
    } catch {}
  };

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {active && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/3 border-2 border-airbus-yellow rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                <div className="absolute -top-6 left-0 text-[10px] text-white/90 font-semibold tracking-wider">
                  Coloca el código dentro del recuadro
                </div>
              </div>
            </div>

            <div className="absolute top-3 left-3 bg-airbus-red text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              EN DIRECTO {modo === 'native' ? '(nativo)' : '(zxing)'}
            </div>

            {flash && <div className="absolute inset-0 bg-airbus-green/40 pointer-events-none" />}

            {ultimoCodigo && (
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur rounded-lg text-white text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-airbus-green shrink-0" />
                <span className="font-mono truncate">{ultimoCodigo}</span>
              </div>
            )}
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

      <div className="flex flex-wrap gap-2">
        <button
          onClick={active ? stop : start}
          className={
            active
              ? 'btn-ghost flex-1 flex items-center justify-center gap-2 border border-gray-300'
              : 'btn-primary flex-1 flex items-center justify-center gap-2'
          }
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

        {active && modo === 'zxing' && (
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="btn-ghost border border-gray-300 flex items-center gap-2"
            title="Rotar frame (útil para códigos 1D)"
          >
            <RotateCw className="w-4 h-4" />
            {rotation}°
          </button>
        )}

        {torchAvailable && active && (
          <button
            onClick={toggleTorch}
            className={`btn-ghost border flex items-center gap-2 ${
              torchOn
                ? 'border-airbus-yellow text-airbus-yellow bg-airbus-yellow/10'
                : 'border-gray-300'
            }`}
            title="Linterna"
          >
            {torchOn ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          </button>
        )}

        {active && (
          <button
            onClick={() => {
              stop();
              setTimeout(() => start(), 250);
            }}
            className="btn-ghost border border-gray-300 flex items-center gap-2"
            title="Reiniciar cámara"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {devices.length > 1 && (
        <select
          value={deviceId ?? ''}
          onChange={(e) => {
            const id = e.target.value;
            setDeviceId(id);
            if (active) {
              stop();
              setTimeout(() => start(), 250);
            }
          }}
          className="input text-xs w-full"
          title="Cambiar cámara"
        >
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Cámara ${i + 1}`}
            </option>
          ))}
        </select>
      )}

      {zoomRange && active && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Zoom</span>
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={0.1}
            value={zoom}
            onChange={(e) => aplicarZoom(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-[11px] text-gray-500 w-8 text-right">
            {zoom.toFixed(1)}×
          </span>
        </div>
      )}

      <p className="text-[11px] text-gray-400 leading-relaxed">
        💡 Consejos:
        <br />· Acerca el código hasta que ocupe 1/3 del ancho de cámara.
        <br />· Con poca luz, activa la <strong>linterna</strong>.
        {modo === 'zxing' && (
          <>
            <br />· Si no lee códigos 1D, prueba a pulsar el botón de <strong>rotar</strong>.
          </>
        )}
      </p>
    </div>
  );
}