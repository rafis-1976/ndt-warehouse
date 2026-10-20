import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ---------------------- Nombres de columna dinámicos ------------------ */

function colName(idx: number): string {
  if (idx < 0) return '';
  const letter = String.fromCharCode(65 + (idx % 26));
  const primes = Math.floor(idx / 26);
  return letter + "'".repeat(primes);
}
function colIndex(name: string): number {
  const m = name.toUpperCase().match(/^([A-Z])('*)$/);
  if (!m) return -1;
  return m[1].charCodeAt(0) - 65 + m[2].length * 26;
}

const MIN_ROWS = 1, MAX_ROWS = 50;
const MIN_COLS = 1, MAX_COLS = 78;
const RESERVED_NOMINAL_KEY = '_nominal';
const RESERVED_EQUIPO_ID_KEY = '_equipo_ut_id';
const RESERVED_EQUIPO_SERIAL_KEY = '_equipo_ut_serial';
const RESERVED_EQUIPO_NOMBRE_KEY = '_equipo_ut_nombre';
const LISTEN_TIMEOUT_MS = 10000;

type GridData = Record<string, string>;
type Meta = { matricula: string; wo_sap: string; fr: string; fecha: string; operador: string; };
type RowMode = { active: boolean; row: number; colIdx: number };
type ListenMode = 'none' | 'cell' | 'command';
type Marker = { id: string; arrow: string; text: string };

interface EquipoUT {
  id: string;
  id_equipo: string;
  nombre: string;
  numero_serie: string | null;
  codigo_barras: string | null;
  estado: string | null;
  proxima_calibracion: string | null;
  tecnicas_ndt?: { codigo: string; nombre: string } | { codigo: string; nombre: string }[] | null;
}

interface GridMappingRow {
  id: string; matricula: string; wo_sap: string | null; fr: string | null;
  fecha: string; grid_data: GridData; updated_at: string;
}
interface HistoryRow {
  id: string; matricula: string; wo_sap: string | null; fr: string | null;
  fecha: string; updated_at: string;
}

/* ------------------------- Utilidades numéricas ---------------------- */

function format2(v: string | number): string {
  const raw = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (isNaN(raw) || !isFinite(raw)) return String(v);
  return raw.toFixed(2);
}
function isNumeric(v: string): boolean {
  if (!v) return false;
  const s = String(v).trim().replace(',', '.');
  if (!s) return false;
  const n = Number(s);
  return !isNaN(n) && isFinite(n);
}

// 🎨 Escala de colores pastel para que los números negros se lean bien
const COLOR_STOPS = [
  { t: 0.00, r: 254, g: 202, b: 202 },
  { t: 0.20, r: 253, g: 230, b: 138 },
  { t: 0.40, r: 254, g: 240, b: 138 },
  { t: 0.60, r: 187, g: 247, b: 208 },
  { t: 0.80, r: 134, g: 239, b: 172 },
  { t: 1.00, r: 74,  g: 222, b: 128 },
];
function colorForValue(v: number, min: number, max: number): string {
  if (max === min) return 'rgb(254, 240, 138)';
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i], b = COLOR_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return `rgb(${Math.round(a.r + (b.r - a.r) * k)}, ${Math.round(a.g + (b.g - a.g) * k)}, ${Math.round(a.b + (b.b - a.b) * k)})`;
    }
  }
  return 'rgb(254, 240, 138)';
}
const LEGEND_GRADIENT =
  'linear-gradient(to right, ' +
  COLOR_STOPS.map((s) => `rgb(${s.r},${s.g},${s.b}) ${(s.t * 100).toFixed(0)}%`).join(', ') +
  ')';

// Utilidad para convertir RGB string a Hex (ARGBN) para Excel
function rgbToHex(rgbStr: string): string {
  const match = rgbStr.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return 'FFFFFFFF';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `FF${r}${g}${b}`.toUpperCase();
}

/* ------------------------- Voz ------------------------- */

const NUM_WORDS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};
const ORDINALS: Record<string, number> = {
  primera: 1, primero: 1, segunda: 2, segundo: 2, tercera: 3, tercero: 3,
  cuarta: 4, cuarto: 4, quinta: 5, quinto: 5, sexta: 6, sexto: 6,
  septima: 7, septimo: 7, setima: 7, setimo: 7, octava: 8, octavo: 8,
  novena: 9, noveno: 9, decima: 10, decimo: 10,
};

function normalizeVoice(text: string): string {
  let s = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\bhache\b/g, 'h').replace(/\bjota\b/g, 'j');
  s = s.split(/\s+/).map((w) => {
    const clean = w.replace(/^[.,;:]+/, '').replace(/[.,;:]+$/, '');
    return NUM_WORDS[clean] !== undefined ? ` ${NUM_WORDS[clean]} ` : w;
  }).join(' ');
  s = s.replace(/\bcoma\b|\bpunto\b/g, ' . ');
  s = s.replace(/\s*\.\s*/g, '.');
  let prev;
  do { prev = s; s = s.replace(/(\d+)\.(\d)\s+(\d)(?![\d.])/g, '$1.$2$3'); } while (s !== prev);
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/\bdoble\s+prima\b/g, "''").replace(/\bprima\b/g, "'").replace(/\bprimas\b/g, "'");
  return s.replace(/\s+/g, ' ').trim();
}

function extractReadings(normalized: string, expectSingle: boolean): string[] {
  const values = [...normalized.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
  if (!expectSingle) return values;
  if (values.length === 0) return values;
  if (/\./.test(normalized)) return values;
  if (values.length === 1) return values;
  if (values.length >= 4 && values.length % 2 === 0) {
    const paired: string[] = [];
    for (let i = 0; i < values.length; i += 2) paired.push(values[i] + '.' + values[i + 1]);
    return paired;
  }
  const first = values[0], rest = values.slice(1).join('');
  if (rest.length <= 2) return [first + '.' + rest];
  return values;
}

function parseCoordinates(s: string) {
  const re = /(^|[^a-z0-9])(?:([a-z])\s*('*)\s*(\d{1,2})|(\d{1,2})\s*([a-z])\s*('*))\s*[:=]?\s*(\d+(?:\.\d+)?)/g;
  const out: Array<{ rawCoord: string; value: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    let coord = '';
    if (m[2]) coord = `${m[2].toUpperCase()}${m[3]}${m[4]}`;
    else coord = `${m[5]}${m[6].toUpperCase()}${m[7]}`;
    out.push({ rawCoord: coord, value: m[8] });
  }
  return out;
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/* --------------- Utilidades del selector de equipos UT --------------- */

function estadoEmoji(estado: string | null | undefined): string {
  if (!estado) return '';
  const e = estado.toLowerCase();
  if (e === 'baja') return '⛔ ';
  if (e === 'prestado') return '🔵 ';
  if (e === 'calibracion' || e === 'mantenimiento' || e === 'pendiente_calibracion') return '🟡 ';
  if (e === 'salida') return '🚚 ';
  return '';
}

function getTecnicaCodigo(eq: EquipoUT): string | null {
  const t = eq.tecnicas_ndt;
  if (!t) return null;
  if (Array.isArray(t)) return t[0]?.codigo ?? null;
  return t.codigo ?? null;
}

function equipoLabel(eq: EquipoUT): string {
  const serial = eq.numero_serie || eq.id_equipo || 'S/N';
  return `${estadoEmoji(eq.estado)}[${serial}] ${eq.nombre}`;
}

/* ----------------------------- Componente ----------------------------- */

export function GridMappingPage() {
  const [meta, setMeta] = useState<Meta>({
    matricula: 'EC-NAV', wo_sap: '6567863537', fr: '248', fecha: todayISO(), operador: '',
  });
  const [grid, setGrid] = useState<GridData>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Toca una celda para dictar su valor, o pulsa «Dictar fila N / FIN».');
  const [heard, setHeard] = useState<string>('');
  const [lastNormalized, setLastNormalized] = useState<string>('');
  const [lastReadings, setLastReadings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [nominalThickness, setNominalThickness] = useState<string>('');

  /* ---- Tamaño y Ejes ---- */
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [swapAxes, setSwapAxes] = useState(false);
  const [invertRows, setInvertRows] = useState(false);
  const [invertCols, setInvertCols] = useState(false);

  /* ---- Imagen y Orientación ---- */
  const [referenceImage, setReferenceImage] = useState<string>('');
  const [markers, setMarkers] = useState<Marker[]>([]);

  /* ---- Equipo UT ---- */
  const [equiposUT, setEquiposUT] = useState<EquipoUT[]>([]);
  const [loadingEquipos, setLoadingEquipos] = useState(false);
  const [equipoUtId, setEquipoUtId] = useState<string>('');
  const [debugEquipos, setDebugEquipos] = useState<{
    totalEnDB: number;
    totalUT: number;
    codigosEncontrados: string[];
    errorMsg: string | null;
  }>({ totalEnDB: 0, totalUT: 0, codigosEncontrados: [], errorMsg: null });

  /* ---- Escucha ---- */
  const [listenMode, setListenMode] = useState<ListenMode>('none');
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);

  const rowsRef = useRef(rows);
  const colsRef = useRef(cols);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { colsRef.current = cols; }, [cols]);

  const [rowMode, setRowModeState] = useState<RowMode>({ active: false, row: 0, colIdx: 0 });
  const rowModeRef = useRef<RowMode>(rowMode);
  const updateRowMode = useCallback((next: RowMode) => {
    rowModeRef.current = next;
    setRowModeState(next);
  }, []);

  const gridRef = useRef(grid);
  useEffect(() => { gridRef.current = grid; }, [grid]);

  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const [flashKey, setFlashKey] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  /* ---- Refs de reconocimiento ---- */
  const recRef = useRef<any>(null);
  const modeRef = useRef<ListenMode>('none');
  const cellRef = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const wantsStopRef = useRef<boolean>(false);

  const filled = useMemo(
    () => Object.keys(grid).filter((k) => !k.startsWith('_') && grid[k]).length,
    [grid],
  );
  const valueStats = useMemo(() => {
    const nums: number[] = [];
    Object.entries(grid).forEach(([k, v]) => {
      if (k.startsWith('_')) return;
      if (isNumeric(v)) nums.push(parseFloat(String(v).replace(',', '.')));
    });
    if (nums.length === 0) return { min: 0, max: 0, hasData: false };
    return { min: Math.min(...nums), max: Math.max(...nums), hasData: true };
  }, [grid]);
  const nominalPct = useMemo(() => {
    if (!nominalThickness || !isNumeric(nominalThickness)) return null;
    if (!valueStats.hasData) return null;
    const n = parseFloat(String(nominalThickness).replace(',', '.'));
    if (valueStats.max === valueStats.min) return 50;
    const t = (n - valueStats.min) / (valueStats.max - valueStats.min);
    return Math.max(0, Math.min(100, t * 100));
  }, [nominalThickness, valueStats]);

  const getLabels = useCallback(() => {
    const rl = Array.from({ length: rows }, (_, i) => swapAxes ? colName(i) : String(i + 1));
    const cl = Array.from({ length: cols }, (_, i) => swapAxes ? String(i + 1) : colName(i));
    if (invertRows) rl.reverse();
    if (invertCols) cl.reverse();
    return { rowLabels: rl, colLabels: cl };
  }, [rows, cols, swapAxes, invertRows, invertCols]);

  const { rowLabels, colLabels } = getLabels();

  useEffect(() => {
    let needsUpdate = false;
    const next: GridData = { ...grid };
    Object.keys(next).forEach((k) => {
      if (k.startsWith('_')) return;
      if (k === focusedKey) return;
      const v = next[k];
      if (v && isNumeric(v)) {
        const f = format2(v);
        if (f !== v) { next[k] = f; needsUpdate = true; }
      }
    });
    if (needsUpdate) setGrid(next);
  }, [grid, focusedKey]);

  const flashCell = useCallback((key: string) => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlashKey(key);
    flashTimerRef.current = window.setTimeout(() => setFlashKey(null), 700);
  }, []);

  const setCell = useCallback((key: string, value: string) => {
    let v = String(value).replace(',', '.').trim();
    if (v && isNumeric(v)) v = format2(v);
    setGrid((prev) => {
      const next = { ...prev };
      if (v) next[key] = v; else delete next[key];
      return next;
    });
  }, []);

  const setCellRaw = useCallback((key: string, value: string) => {
    const v = String(value).replace(',', '.').trim();
    setGrid((prev) => {
      const next = { ...prev };
      if (v) next[key] = v; else delete next[key];
      return next;
    });
  }, []);

  const advanceFromKey = useCallback((currentKey: string) => {
    const { rowLabels, colLabels } = getLabels();
    let rIdx = -1, cIdx = -1;
    for (let r = 0; r < rowLabels.length; r++) {
      for (let c = 0; c < colLabels.length; c++) {
        if (`${colLabels[c]}${rowLabels[r]}` === currentKey) {
          rIdx = r; cIdx = c; break;
        }
      }
    }
    if (rIdx === -1) return null;
    cIdx++;
    if (cIdx >= colLabels.length) { cIdx = 0; rIdx++; }
    if (rIdx >= rowLabels.length) {
      setSelected(null);
      return null;
    }
    const next = `${colLabels[cIdx]}${rowLabels[rIdx]}`;
    setSelected(next);
    return next;
  }, [getLabels]);

  const normalizeCoordKey = (rawCoord: string, cLabels: string[], rLabels: string[]): string => {
    const matchA1 = rawCoord.match(/^([A-Z])('*)(\d+)$/);
    const match1A = rawCoord.match(/^(\d+)([A-Z])('*)$/);
    if (matchA1) {
      const c = matchA1[1] + matchA1[2];
      const r = matchA1[3];
      if (cLabels.includes(c) && rLabels.includes(r)) return `${c}${r}`;
      if (cLabels.includes(r) && rLabels.includes(c)) return `${r}${c}`;
    } else if (match1A) {
      const r = match1A[1];
      const c = match1A[2] + match1A[3];
      if (cLabels.includes(c) && rLabels.includes(r)) return `${c}${r}`;
      if (cLabels.includes(r) && rLabels.includes(c)) return `${r}${c}`;
    }
    return rawCoord;
  };

  const detectRow = (s: string, labels: string[]): number => {
    const m1 = s.match(/\bfila\b[^a-z0-9]*?([a-z0-9])/);
    if (m1) {
      const val = m1[1].toUpperCase();
      const idx = labels.indexOf(val);
      if (idx !== -1) return idx;
    }
    for (const [word, num] of Object.entries(ORDINALS)) {
      const m2 = new RegExp(`\\b${word}\\s+fila\\b`).test(s) || new RegExp(`\\bfila\\s+${word}\\b`).test(s);
      if (m2) {
        const idx = labels.indexOf(String(num));
        if (idx !== -1) return idx;
      }
    }
    return -1;
  };

  const isFin = (s: string) => /\b(fin|final|terminar|termine|finalizar|acabar|acabe)\b/.test(s);
  const isSiguienteFila = (s: string) =>
    /\b(siguiente|otra|proxima)\s+fila\b/.test(s) || /\bfila\s+(siguiente|proxima)\b/.test(s);

  const firstEmptyCol = (rowIdx: number): number => {
    const g = gridRef.current;
    const { rowLabels, colLabels } = getLabels();
    const rowLabel = rowLabels[rowIdx];
    for (let i = 0; i < colLabels.length; i++) {
      if (!g[`${colLabels[i]}${rowLabel}`]) return i;
    }
    return colLabels.length;
  };

  /* ------------------ Procesamiento de texto ------------------ */
  const handleVoice = useCallback((text: string, targetCell: string | null) => {
    const s = normalizeVoice(text);
    setLastNormalized(s);
    if (!s) return;

    const { rowLabels, colLabels } = getLabels();

    if (isSiguienteFila(s)) {
      const currentRow = rowModeRef.current.active ? rowModeRef.current.row : 0;
      const nextRow = Math.min(rowLabels.length - 1, currentRow + 1);
      if (nextRow >= 0) {
        const startCol = firstEmptyCol(nextRow);
        updateRowMode({ active: true, row: nextRow, colIdx: startCol });
        setStatus(`Fila ${rowLabels[nextRow]} activa · siguiente: ${colLabels[startCol]}${rowLabels[nextRow]}`);
        return;
      }
    }

    const targetRow = detectRow(s, rowLabels);
    if (targetRow !== -1) {
      const startCol = firstEmptyCol(targetRow);
      updateRowMode({ active: true, row: targetRow, colIdx: startCol });
      setStatus(`Fila ${rowLabels[targetRow]} activa · siguiente: ${colLabels[startCol]}${rowLabels[targetRow]}`);
      setHeard(`Fila ${rowLabels[targetRow]}`);
      return;
    }

    if (isFin(s)) {
      if (rowModeRef.current.active) {
        const r = rowModeRef.current.row;
        updateRowMode({ active: false, row: 0, colIdx: 0 });
        setStatus(`Fila ${rowLabels[r]} terminada · toca una celda o di «fila N»`);
      } else {
        setStatus('No hay fila activa · di «fila N» primero');
      }
      return;
    }

    if (targetCell) {
      const values = extractReadings(s, true);
      setLastReadings(values);
      if (values.length === 0) {
        setStatus('No se reconoció ningún número · repite la lectura');
        return;
      }
      const v = values[0];
      setCell(targetCell, v);
      flashCell(targetCell);
      const nk = advanceFromKey(targetCell);
      setStatus(`✔ ${targetCell} = ${format2(v)}` + (nk ? ` · siguiente: ${nk}` : ''));
      return;
    }

    if (rowModeRef.current.active) {
      const values = extractReadings(s, true);
      setLastReadings(values);
      if (values.length === 0) {
        setStatus('No se reconoció ningún número · repite la lectura');
        return;
      }

      const { row } = rowModeRef.current;
      let currentColIdx = rowModeRef.current.colIdx;
      const rowLabel = rowLabels[row];

      for (const value of values) {
        if (currentColIdx >= colLabels.length) break;
        const col = colLabels[currentColIdx];
        setCell(`${col}${rowLabel}`, value);
        flashCell(`${col}${rowLabel}`);
        currentColIdx++;
      }

      if (currentColIdx >= colLabels.length) {
        updateRowMode({ active: true, row, colIdx: currentColIdx });
        setStatus(`Fila ${rowLabel} completa · di FIN`);
      } else {
        const nextCol = colLabels[currentColIdx];
        updateRowMode({ active: true, row, colIdx: currentColIdx });
        setStatus(`✔ Fila ${rowLabel} · siguiente: ${nextCol}${rowLabel}`);
      }
      return;
    }

    const coords = parseCoordinates(s);
    if (coords.length > 0) {
      coords.forEach(({ rawCoord, value }) => {
        const key = normalizeCoordKey(rawCoord, colLabels, rowLabels);
        setCell(key, value);
        flashCell(key);
      });
      const lastCoord = coords[coords.length - 1].rawCoord;
      const lastKey = normalizeCoordKey(lastCoord, colLabels, rowLabels);
      const nk = advanceFromKey(lastKey);
      setStatus(`✔ ${coords.map((c) => `${c.rawCoord}=${format2(c.value)}`).join('  ')}` + (nk ? ` · siguiente: ${nk}` : ''));
      return;
    }

    if (/^\d+(\.\d+)?$/.test(s)) {
      setStatus('Toca una celda primero o di «fila N».');
    }
  }, [setCell, flashCell, updateRowMode, getLabels, advanceFromKey]);

  const handleVoiceRef = useRef(handleVoice);
  useEffect(() => { handleVoiceRef.current = handleVoice; }, [handleVoice]);

  /* ------------------ Reconocimiento one-shot ------------------ */
  const stopRecognition = useCallback((reason?: string) => {
    wantsStopRef.current = true;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recRef.current) {
      try { recRef.current.stop(); } catch { /* noop */ }
      try { recRef.current.abort?.(); } catch { /* noop */ }
    }
    recRef.current = null;
    modeRef.current = 'none';
    cellRef.current = null;
    setListenMode('none');
    setActiveCellKey(null);
    if (reason) setStatus(reason);
  }, []);

  const startRecognition = useCallback((mode: ListenMode, cell: string | null) => {
    if (modeRef.current !== 'none') {
      stopRecognition();
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setStatus('❌ Este navegador no soporta voz. Usa Chrome o Edge.');
      return;
    }

    wantsStopRef.current = false;
    modeRef.current = mode;
    cellRef.current = cell;
    setListenMode(mode);
    setActiveCellKey(cell);
    setHeard('');

    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      if (mode === 'cell' && cell) {
        setStatus(`🎤 Escuchando para ${cell}… di el valor.`);
      } else {
        setStatus('🎤 Escuchando… di «fila N» o «FIN».');
      }
    };

    rec.onresult = (e: any) => {
      const result = e.results[e.resultIndex];

      if (!result.isFinal) {
        let interim = '';
        for (let i = 0; i < result.length; i++) interim += result[i].transcript + ' ';
        setHeard(interim.trim());
        return;
      }

      const best = result[0]?.transcript?.trim() ?? '';
      setHeard(best);

      const target = modeRef.current === 'cell' ? cellRef.current : null;
      stopRecognition();
      handleVoiceRef.current(best, target);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopRecognition('❌ Permiso de micrófono denegado (necesita HTTPS).');
      } else if (e.error === 'no-speech') {
        stopRecognition('⏸ No se detectó voz.');
      } else if (e.error === 'aborted') {
        // silencio
      } else {
        stopRecognition('⚠️ Error de voz: ' + e.error);
      }
    };

    rec.onend = () => {
      if (!wantsStopRef.current) {
        stopRecognition('⏸ Sin resultado. Toca la celda de nuevo.');
      }
    };

    recRef.current = rec;
    try { rec.start(); } catch (err: any) {
      stopRecognition('⚠️ ' + err.message);
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      stopRecognition('⏸ Tiempo agotado. Toca la celda de nuevo.');
    }, LISTEN_TIMEOUT_MS);
  }, [stopRecognition]);

  const onCellClick = useCallback((key: string) => {
    if (modeRef.current === 'cell' && cellRef.current === key) {
      stopRecognition('Cancelado.');
      return;
    }
    setSelected(key);
    startRecognition('cell', key);
  }, [startRecognition, stopRecognition]);

  const toggleCommandMic = useCallback(() => {
    if (modeRef.current === 'command') {
      stopRecognition('Detenido.');
    } else {
      startRecognition('command', null);
    }
  }, [startRecognition, stopRecognition]);

  useEffect(() => () => {
    wantsStopRef.current = true;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (recRef.current) {
      try { recRef.current.abort?.(); } catch { /* noop */ }
    }
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  /* ------------------ Cargar equipos UT ------------------ */
  const loadEquiposUT = useCallback(async () => {
    setLoadingEquipos(true);
    setDebugEquipos({ totalEnDB: 0, totalUT: 0, codigosEncontrados: [], errorMsg: null });

    try {
      const { data, error } = await supabase
        .from('equipos')
        .select(`
          id, id_equipo, nombre, numero_serie, codigo_barras, estado, proxima_calibracion, tecnicas_ndt ( codigo, nombre )
        `)
        .order('id_equipo', { ascending: true });

      if (error) {
        setDebugEquipos({ totalEnDB: 0, totalUT: 0, codigosEncontrados: [], errorMsg: error.message });
        return;
      }

      const all = (data ?? []) as EquipoUT[];
      const codigosSet = new Set<string>();
      all.forEach((eq) => { const c = getTecnicaCodigo(eq); if (c) codigosSet.add(c); });
      const codigosEncontrados = Array.from(codigosSet).sort();

      const uts = all.filter((eq) => {
        const codigo = getTecnicaCodigo(eq);
        return codigo ? codigo.toUpperCase().startsWith('UT') : false;
      });

      setEquiposUT(uts);
      setDebugEquipos({ totalEnDB: all.length, totalUT: uts.length, codigosEncontrados, errorMsg: null });

    } catch (err: any) {
      setDebugEquipos({ totalEnDB: 0, totalUT: 0, codigosEncontrados: [], errorMsg: err?.message ?? 'Error desconocido' });
    } finally {
      setLoadingEquipos(false);
    }
  }, []);

  useEffect(() => { void loadEquiposUT(); }, [loadEquiposUT]);

  /* ------------------ Cambiar tamaño ------------------ */
  const setRowsCount = (n: number) => {
    if (n < MIN_ROWS || n > MAX_ROWS) return;
    if (n < rows) {
      const { rowLabels } = getLabels();
      const lost = Object.keys(grid).some((k) => {
        if (k.startsWith('_')) return false;
        return rowLabels.slice(n).some(r => k.endsWith(r));
      });
      if (lost && !confirm(`¿Eliminar las celdas de las filas sobrantes?`)) return;
      setGrid((prev) => {
        const next: GridData = {};
        Object.keys(prev).forEach((k) => {
          if (k.startsWith('_')) { next[k] = prev[k]; return; }
          if (!rowLabels.slice(n).some(r => k.endsWith(r))) next[k] = prev[k];
        });
        return next;
      });
    }
    setRows(n); rowsRef.current = n;
  };

  const setColsCount = (n: number) => {
    if (n < MIN_COLS || n > MAX_COLS) return;
    if (n < cols) {
      const { colLabels } = getLabels();
      const lost = Object.keys(grid).some((k) => {
        if (k.startsWith('_')) return false;
        return colLabels.slice(n).some(c => k.startsWith(c));
      });
      if (lost && !confirm(`¿Eliminar las celdas de las columnas sobrantes?`)) return;
      setGrid((prev) => {
        const next: GridData = {};
        Object.keys(prev).forEach((k) => {
          if (k.startsWith('_')) { next[k] = prev[k]; return; }
          if (!colLabels.slice(n).some(c => k.startsWith(c))) next[k] = prev[k];
        });
        return next;
      });
    }
    setCols(n); colsRef.current = n;
  };

  const clearAll = () => {
    if (!confirm('¿Borrar todos los valores de la cuadrícula?')) return;
    stopRecognition();
    setGrid({}); setSelected(null);
    updateRowMode({ active: false, row: 0, colIdx: 0 });
    setStatus('Cuadrícula vacía.');
  };
  
  const newMapping = () => {
    stopRecognition();
    setRecordId(null); setGrid({}); setSelected(null);
    setNominalThickness(''); setEquipoUtId('');
    setReferenceImage(''); setMarkers([]);
    setSwapAxes(false); setInvertRows(false); setInvertCols(false);
    setRows(4); setCols(4);
    updateRowMode({ active: false, row: 0, colIdx: 0 });
    setMeta((m) => ({ ...m, fecha: todayISO(), operador: '' }));
    setStatus('Nueva cuadrícula lista.');
  };

  /* ------------------ Persistencia ------------------ */
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('grid_mappings')
      .select('id, matricula, wo_sap, fr, fecha, updated_at')
      .order('updated_at', { ascending: false }).limit(50);
    if (!error && data) setHistory(data as HistoryRow[]);
    setLoadingHistory(false);
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter(h =>
      (h.matricula && h.matricula.toLowerCase().includes(q)) ||
      (h.wo_sap && h.wo_sap.toLowerCase().includes(q)) ||
      (h.fr && h.fr.toLowerCase().includes(q)) ||
      (h.fecha && h.fecha.includes(q))
    );
  }, [history, historySearch]);

  const loadRecord = async (id: string) => {
    const { data, error } = await supabase.from('grid_mappings').select('*').eq('id', id).single();
    if (error || !data) { setStatus('❌ ' + (error?.message ?? 'No encontrado')); return; }
    const row = data as GridMappingRow;
    const rawData = row.grid_data ?? {};
    const normalized: GridData = {};
    let nominalFromGrid = '', equipoIdFromGrid = '', operadorFromGrid = '';
    
    Object.entries(rawData).forEach(([k, v]) => {
      if (k === RESERVED_NOMINAL_KEY) { nominalFromGrid = v ?? ''; return; }
      if (k === RESERVED_EQUIPO_ID_KEY) { equipoIdFromGrid = v ?? ''; return; }
      if (k === RESERVED_EQUIPO_SERIAL_KEY) return;
      if (k === RESERVED_EQUIPO_NOMBRE_KEY) return;
      if (k === '_operador') { operadorFromGrid = v ?? ''; return; }
      if (k === '_reference_image') { setReferenceImage(v); return; }
      if (k === '_markers') { try { setMarkers(JSON.parse(v)); } catch { setMarkers([]); } return; }
      normalized[k] = v && isNumeric(v) ? format2(v) : v;
    });
    
    setMeta({ matricula: row.matricula, wo_sap: row.wo_sap ?? '', fr: row.fr ?? '', fecha: row.fecha, operador: operadorFromGrid });
    setGrid(normalized);
    setNominalThickness(nominalFromGrid);
    setEquipoUtId(equipoIdFromGrid);
    setRecordId(row.id);
    setStatus(`✔ Cargado: ${row.matricula} · FR ${row.fr ?? '—'}`);
  };

  const save = async () => {
    if (!meta.matricula.trim() || !meta.fecha) { setStatus('⚠️ Matrícula y fecha son obligatorias.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cleanGrid: GridData = {};
      Object.keys(grid).forEach((k) => {
        if (k.startsWith('_')) return;
        const v = grid[k];
        if (v) cleanGrid[k] = isNumeric(v) ? format2(v) : v;
      });
      if (nominalThickness && isNumeric(nominalThickness)) cleanGrid[RESERVED_NOMINAL_KEY] = format2(nominalThickness);
      if (meta.operador.trim()) cleanGrid['_operador'] = meta.operador.trim();
      if (referenceImage) cleanGrid['_reference_image'] = referenceImage;
      if (markers.length > 0) cleanGrid['_markers'] = JSON.stringify(markers);
      if (equipoUtId) {
        cleanGrid[RESERVED_EQUIPO_ID_KEY] = equipoUtId;
        const eq = equiposUT.find((e) => e.id === equipoUtId);
        if (eq) {
          cleanGrid[RESERVED_EQUIPO_SERIAL_KEY] = eq.numero_serie || eq.id_equipo;
          cleanGrid[RESERVED_EQUIPO_NOMBRE_KEY] = eq.nombre;
        }
      }

      const payload = {
        user_id: user?.id ?? null,
        matricula: meta.matricula.trim(),
        wo_sap: meta.wo_sap.trim() || null,
        fr: meta.fr.trim() || null,
        fecha: meta.fecha,
        grid_data: cleanGrid,
      };
      if (recordId) {
        const { error } = await supabase.from('grid_mappings').update(payload).eq('id', recordId);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase.from('grid_mappings').insert(payload).select('id').single();
        if (error) throw error;
        setRecordId((ins as { id: string }).id);
      }
      setStatus('✔ Guardado.');
      void loadHistory();
    } catch (err: any) {
      setStatus('❌ ' + (err?.message ?? 'Error al guardar'));
    } finally { setSaving(false); }
  };

  /* ------------------ Exportar a EXCEL ------------------ */
  const exportExcel = async () => {
    setStatus('Generando Excel...');

    try {
      if (!(window as any).ExcelJS) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('No se pudo cargar ExcelJS'));
          document.head.appendChild(s);
        });
      }
      const ExcelJS = (window as any).ExcelJS;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Informe Grid Mapping');

      worksheet.columns = [
        { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 },
        { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 },
      ];

      let currentRow = 1;

      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const titleCell = worksheet.getCell(`A${currentRow}`);
      titleCell.value = 'INFORME DE GRID MAPPING';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center' };
      currentRow += 2;

      const addMeta = (label: string, value: string) => {
        worksheet.getCell(`A${currentRow}`).value = label;
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        worksheet.mergeCells(`B${currentRow}:D${currentRow}`);
        worksheet.getCell(`B${currentRow}`).value = value;
        currentRow++;
      };

      addMeta('Matrícula:', meta.matricula);
      addMeta('WO / SAP:', meta.wo_sap);
      addMeta('FR:', meta.fr);
      addMeta('Fecha:', fmtFecha(meta.fecha));
      addMeta('Operador:', meta.operador);
      currentRow++;

      const eqSel = equiposUT.find((e) => e.id === equipoUtId);
      if (eqSel) {
        addMeta('Equipo UT:', eqSel.nombre);
        addMeta('Nº Serie:', eqSel.numero_serie || eqSel.id_equipo);
        addMeta('Calibración:', eqSel.proxima_calibracion ? fmtFecha(eqSel.proxima_calibracion) : '—');
      }
      if (nominalThickness) addMeta('Espesor Nominal:', nominalThickness + ' mm');
      currentRow++;

      if (markers.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'Flechas y Orientación:';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        markers.forEach(m => {
          worksheet.getCell(`A${currentRow}`).value = m.arrow;
          worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
          worksheet.getCell(`B${currentRow}`).value = m.text;
          currentRow++;
        });
        currentRow++;
      }

      if (referenceImage) {
        worksheet.getCell(`A${currentRow}`).value = 'Imagen de Referencia:';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;

        try {
          const base64Data = referenceImage.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

          const imageId = workbook.addImage({
            buffer: bytes.buffer,
            extension: 'png',
          });

          worksheet.addImage(imageId, {
            tl: { col: 0, row: currentRow - 1 },
            ext: { width: 300, height: 200 },
          });
          currentRow += 10;
        } catch (err) {
          console.warn('No se pudo incrustar la imagen:', err);
          worksheet.getCell(`A${currentRow}`).value = '[Error al cargar imagen]';
          currentRow++;
        }
      }

      worksheet.getCell(`A${currentRow}`).value = 'Resultados de la Medición:';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;

      worksheet.getCell(`A${currentRow}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      colLabels.forEach((c, i) => {
        const cell = worksheet.getCell(currentRow, i + 2);
        cell.value = c;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });
      currentRow++;

      rowLabels.forEach(rLabel => {
        const cellR = worksheet.getCell(`A${currentRow}`);
        cellR.value = rLabel;
        cellR.font = { bold: true };
        cellR.alignment = { horizontal: 'center' };
        cellR.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cellR.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        colLabels.forEach((cLabel, cIdx) => {
          const key = `${cLabel}${rLabel}`;
          const v = grid[key] ?? '';
          const numeric = isNumeric(v);
          const bg = numeric && valueStats.hasData ? colorForValue(parseFloat(v), valueStats.min, valueStats.max) : undefined;
          
          const cell = worksheet.getCell(currentRow, cIdx + 2);
          cell.value = v;
          cell.alignment = { horizontal: 'center' };
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          if (bg) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rgbToHex(bg) } };
          }
        });
        currentRow++;
      });

      if (valueStats.hasData) {
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = `Escala: MIN=${format2(valueStats.min)} | MAX=${format2(valueStats.max)}`;
        worksheet.getCell(`A${currentRow}`).font = { italic: true };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `GRID_${meta.matricula || 'EC-NAV'}_FR${meta.fr || ''}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      
      setStatus('✔ Excel generado correctamente.');
    } catch (err: any) {
      console.error(err);
      setStatus('❌ Error generando Excel: ' + err.message);
    }
  };

  const nextCellLabel = rowMode.active && rowMode.colIdx < colLabels.length ? `${colLabels[rowMode.colIdx]}${rowLabels[rowMode.row]}` : null;
  const displayValue = (key: string, raw: string): string => {
    if (focusedKey === key) return raw;
    if (raw && isNumeric(raw)) return format2(raw);
    return raw;
  };
  const nominalNum = nominalThickness && isNumeric(nominalThickness) ? parseFloat(String(nominalThickness).replace(',', '.')) : null;
  const equipoSeleccionado = equiposUT.find((e) => e.id === equipoUtId) ?? null;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4 portrait; }
          header, aside, nav, .app-header, .app-sidebar { display: none !important; }
          body, #root, .min-h-screen, .flex-1, main { 
            display: block !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: white !important; overflow: visible !important;
          }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>

      <div className="p-4 md:p-6 max-w-full mx-auto space-y-4 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-airbus-navy">Grid Mapping</h1>
            <p className="text-sm text-gray-500">
              Toca una celda para dictar su valor
              {recordId && (<> · <span className="text-airbus-green">editando</span></>)}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={newMapping}>Nueva</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar Grid Mapping'}</button>
          </div>
        </div>

        {/* ========== TARJETA 1: METADATOS ========== */}
        <div className="card">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">Datos del informe</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Matrícula</label>
              <input className="input" value={meta.matricula} onChange={(e) => setMeta({ ...meta, matricula: e.target.value })} /></div>
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">WO / SAP</label>
              <input className="input" value={meta.wo_sap} onChange={(e) => setMeta({ ...meta, wo_sap: e.target.value })} /></div>
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">FR</label>
              <input className="input" value={meta.fr} onChange={(e) => setMeta({ ...meta, fr: e.target.value })} /></div>
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Fecha</label>
              <input className="input" type="date" value={meta.fecha} onChange={(e) => setMeta({ ...meta, fecha: e.target.value })} /></div>
            <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Operador (Nº Usuario)</label>
              <input className="input" value={meta.operador} onChange={(e) => setMeta({ ...meta, operador: e.target.value })} placeholder="Ej. 12345" /></div>
          </div>
        </div>

        {/* ========== TARJETA 2: EQUIPO DE MEDICIÓN ========== */}
        <div className="card border-2 border-airbus-blue/30 bg-airbus-sky/5">
          <h3 className="text-xs uppercase tracking-wide text-airbus-navy font-bold mb-3 flex items-center gap-2">
            🔧 Configuración de medición
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-wide text-airbus-navy mb-1 font-semibold">
                Equipo de medición UT
                {loadingEquipos && <span className="ml-2 text-airbus-sky font-normal normal-case">(cargando…)</span>}
                {!loadingEquipos && (
                  <span className="ml-2 text-gray-400 font-normal normal-case">({equiposUT.length} disponible{equiposUT.length !== 1 ? 's' : ''})</span>
                )}
              </label>
              <select className="input text-base" value={equipoUtId} onChange={(e) => setEquipoUtId(e.target.value)} disabled={loadingEquipos}>
                <option value="">{loadingEquipos ? 'Cargando…' : equiposUT.length === 0 ? '— No hay equipos UT —' : '— Selecciona equipo UT —'}</option>
                {equiposUT.map((eq) => {
                  const baja = (eq.estado ?? '').toLowerCase() === 'baja';
                  return <option key={eq.id} value={eq.id} disabled={baja}>{equipoLabel(eq)}</option>;
                })}
              </select>

              {equipoSeleccionado && (
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-airbus-navy text-white font-mono font-bold">
                    {equipoSeleccionado.numero_serie || equipoSeleccionado.id_equipo}
                  </span>
                  <span className="text-gray-700 font-medium">{equipoSeleccionado.nombre}</span>
                  {equipoSeleccionado.codigo_barras && <span className="text-gray-400 font-mono">· CB: {equipoSeleccionado.codigo_barras}</span>}
                </div>
              )}

              <div className="mt-2 text-[10px] font-mono bg-white border border-dashed border-gray-300 rounded px-2 py-1 text-gray-500">
                <b>DEBUG:</b> equipos en BD: <b>{debugEquipos.totalEnDB}</b> · UT: <b>{debugEquipos.totalUT}</b>
                {debugEquipos.codigosEncontrados.length > 0 && <> · códigos: <b>{debugEquipos.codigosEncontrados.join(', ')}</b></>}
                {debugEquipos.errorMsg && <> · <span className="text-red-600">ERROR: {debugEquipos.errorMsg}</span></>}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-airbus-blue mb-1 font-semibold">Espesor nominal (mm)</label>
              <input className="input text-base" type="text" inputMode="decimal" placeholder="0.00"
                value={nominalThickness}
                onChange={(e) => setNominalThickness(e.target.value)}
                onBlur={() => { if (nominalThickness && isNumeric(nominalThickness)) setNominalThickness(format2(nominalThickness)); }} />
            </div>
          </div>
        </div>

        {/* ========== TARJETA 3: IMAGEN Y ORIENTACIÓN ========== */}
        <div className="card">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">Imagen y Orientación</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Subida de Imagen */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Imagen de Referencia</label>
              <input 
                type="file" accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setReferenceImage(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-airbus-blue/10 file:text-airbus-blue hover:file:bg-airbus-blue/20"
              />
              
              {referenceImage && (
                <div className="mt-3 relative inline-block border rounded-lg p-2 bg-gray-50">
                  <img src={referenceImage} alt="Referencia" className="max-h-48 object-contain" />
                  <button onClick={() => setReferenceImage('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow hover:bg-red-600" title="Eliminar imagen">✕</button>
                </div>
              )}
            </div>

            {/* Flechas y Textos */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Flechas y Textos de Referencia</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { arrow: '↑', text: 'UP' }, { arrow: '↓', text: 'DOWN' },
                  { arrow: '←', text: 'INBOARD' }, { arrow: '→', text: 'OUTBOARD' },
                  { arrow: '↖', text: 'FWD' },
                ].map((preset) => (
                  <button key={preset.text} onClick={() => setMarkers([...markers, { id: crypto.randomUUID(), ...preset }])} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs font-semibold text-gray-700 transition">
                    + {preset.arrow} {preset.text}
                  </button>
                ))}
                <button onClick={() => setMarkers([...markers, { id: crypto.randomUUID(), arrow: '↑', text: '' }])} className="px-2 py-1 bg-airbus-blue text-white rounded text-xs font-semibold hover:bg-airbus-navy transition">
                  + Personalizado
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {markers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <select value={m.arrow} onChange={(e) => setMarkers(markers.map(x => x.id === m.id ? { ...x, arrow: e.target.value } : x))} className="input text-sm w-16 text-center font-bold">
                      {['↑','↓','←','→','↖','↗','↘','↙'].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <input type="text" value={m.text} onChange={(e) => setMarkers(markers.map(x => x.id === m.id ? { ...x, text: e.target.value } : x))} placeholder="Texto (ej. FWD)" className="input text-sm flex-1" />
                    <button onClick={() => setMarkers(markers.filter(x => x.id !== m.id))} className="text-red-500 hover:text-red-700 p-1" title="Eliminar">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Voz */}
        <div className="card space-y-3">
          <button onClick={toggleCommandMic} className={`w-full py-3 rounded-lg font-semibold text-white transition ${listenMode === 'command' ? 'bg-airbus-red animate-pulse' : 'bg-airbus-blue hover:bg-airbus-navy'}`}>
            {listenMode === 'command' ? '⏹ Cancelar comando' : '🎤 Dictar fila N / FIN (comando)'}
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {rowMode.active ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-airbus-blue text-white text-sm font-medium">
                📋 Fila {rowLabels[rowMode.row]} <span className="text-xs opacity-90">{nextCellLabel ? `siguiente: ${nextCellLabel}` : 'completa · di FIN'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">Sin fila activa</span>
            )}
            <span className="text-xs text-gray-500">{status}</span>
          </div>

          <div className="min-h-[38px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
            {heard ? (
              <>
                {listenMode === 'cell' && activeCellKey && <span className="mr-2 text-[11px] px-2 py-0.5 rounded bg-airbus-blue text-white font-mono">{activeCellKey}</span>}
                {heard}
              </>
            ) : (
              <i className="text-gray-400">Aquí aparecerá lo reconocido…</i>
            )}
          </div>

          {(lastNormalized || lastReadings.length > 0) && (
            <div className="text-[11px] text-gray-400 bg-white border border-dashed border-gray-200 rounded-lg px-3 py-1.5 font-mono">
              Normalizado: <b className="text-gray-600">{lastNormalized || '—'}</b>
              {lastReadings.length > 0 && <> · Valores: <b className="text-gray-600">[{lastReadings.map((v) => format2(v)).join(', ')}]</b></>}
            </div>
          )}

          <p className="text-xs text-gray-500 bg-airbus-cream/40 border border-airbus-light/30 rounded-lg px-3 py-2">
            🗣️ <b>Toca una celda</b> → habla → di el valor (p. ej. <i>«dos coma cero dos»</i>). El micrófono se cierra solo.
          </p>

          <div className="flex gap-5 items-center flex-wrap pt-2 border-t border-gray-100 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Filas</span>
              <button type="button" onClick={() => setRowsCount(rows - 1)} disabled={rows <= MIN_ROWS} className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
              <span className="w-8 text-center font-mono text-sm">{rows}</span>
              <button type="button" onClick={() => setRowsCount(rows + 1)} disabled={rows >= MAX_ROWS} className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Columnas</span>
              <button type="button" onClick={() => setColsCount(cols - 1)} disabled={cols <= MIN_COLS} className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
              <span className="w-14 text-center font-mono text-sm">{colLabels[colLabels.length - 1] || '—'}</span>
              <button type="button" onClick={() => setColsCount(cols + 1)} disabled={cols >= MAX_COLS} className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-gray-100 text-xs font-medium text-gray-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={swapAxes} onChange={(e) => setSwapAxes(e.target.checked)} className="rounded text-airbus-blue focus:ring-airbus-blue" />
              Cambiar Ejes (Letras ↔ Números)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={invertRows} onChange={(e) => setInvertRows(e.target.checked)} className="rounded text-airbus-blue focus:ring-airbus-blue" />
              Invertir Filas
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={invertCols} onChange={(e) => setInvertCols(e.target.checked)} className="rounded text-airbus-blue focus:ring-airbus-blue" />
              Invertir Columnas
            </label>
          </div>

          <div className="flex gap-2 flex-wrap items-center pt-2">
            <span className="badge badge-gray">{filled} / {rows * cols}</span>
            <button className="btn-ghost text-airbus-red" onClick={clearAll}>Borrar todo</button>
            <button className="btn-ghost" onClick={exportExcel}>Exportar a Excel</button>
            <button className="btn-ghost flex items-center gap-2 text-airbus-blue font-semibold" onClick={() => window.print()}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Generar PDF
            </button>
          </div>
        </div>

        {/* Cuadrícula */}
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="bg-airbus-navy text-white w-9 h-9 border border-gray-200" />
                {colLabels.map((c) => (
                  <th key={c} className="bg-airbus-navy text-white font-semibold h-9 border border-gray-200 min-w-[44px] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((rLabel, rIdx) => {
                const isCurrentRow = rowMode.active && rowLabels[rowMode.row] === rLabel;
                return (
                  <tr key={rLabel}>
                    <th className={`font-bold text-xs border border-gray-200 h-10 transition-colors ${isCurrentRow ? 'bg-airbus-blue text-white' : 'bg-gray-100 text-gray-600'}`}>{rLabel}</th>
                    {colLabels.map((cLabel, cIdx) => {
                      const key = `${cLabel}${rLabel}`;
                      const v = grid[key] ?? '';
                      const display = displayValue(key, v);
                      const active = selected === key;
                      const listening = listenMode === 'cell' && activeCellKey === key;
                      const flashing = flashKey === key;
                      const numeric = isNumeric(v);
                      const bg = numeric && valueStats.hasData ? colorForValue(parseFloat(String(v).replace(',', '.')), valueStats.min, valueStats.max) : undefined;
                      return (
                        <td key={key} className={`border border-gray-200 h-10 p-0 transition-colors duration-300 ${active ? 'outline outline-2 outline-airbus-sky' : ''} ${listening ? 'outline outline-2 outline-red-500' : ''}`} style={{ backgroundColor: bg, boxShadow: flashing ? 'inset 0 0 0 3px rgb(251, 146, 60)' : undefined }}>
                          <input
                            className="w-full h-full text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-airbus-sky font-medium tabular-nums px-1"
                            inputMode="decimal"
                            value={display}
                            onClick={() => onCellClick(key)}
                            onChange={(e) => setCellRaw(key, e.target.value)}
                            onFocus={() => { setFocusedKey(key); setSelected(key); }}
                            onBlur={(e) => { setFocusedKey(null); const val = e.target.value.trim(); if (val && isNumeric(val)) setCell(key, val); else if (val) setCellRaw(key, val); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Leyenda */}
        <div className="card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Escala de color</div>
            {valueStats.hasData ? (
              <div className="flex items-center gap-3 text-xs flex-1 min-w-[240px]">
                <span className="font-mono text-gray-700 tabular-nums">{format2(valueStats.min)}</span>
                <div className="flex-1 relative py-2">
                  <div className="h-4 rounded-full border border-gray-200" style={{ background: LEGEND_GRADIENT }} />
                  {nominalPct !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-blue-600 shadow" style={{ left: `${nominalPct}%`, transform: 'translateX(-50%)' }} title={`Nominal: ${format2(nominalNum ?? 0)}`} />}
                </div>
                <span className="font-mono text-gray-700 tabular-nums">{format2(valueStats.max)}</span>
              </div>
            ) : <span className="text-xs text-gray-400">Introduce valores numéricos para ver el gradiente</span>}
          </div>
        </div>

        {/* Historial con Buscador */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-airbus-navy">Cuadrículas guardadas</h2>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 py-1.5 text-sm"
                  placeholder="Buscar por matrícula, WO, FR..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <button className="btn-ghost text-sm py-1.5 whitespace-nowrap" onClick={loadHistory} disabled={loadingHistory}>
                {loadingHistory ? 'Cargando…' : 'Refrescar'}
              </button>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              {history.length === 0
                ? 'Aún no hay cuadrículas guardadas.'
                : 'No se encontraron resultados para tu búsqueda.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto pr-2">
              {filteredHistory.map((h) => (
                <li key={h.id} className="py-2 flex items-center justify-between gap-3 text-sm hover:bg-gray-50 px-2 rounded transition">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {h.matricula} · WO {h.wo_sap ?? '—'} · FR {h.fr ?? '—'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {fmtFecha(h.fecha)} · {new Date(h.updated_at).toLocaleString('es-ES')}
                    </div>
                  </div>
                  <button className="btn-ghost text-airbus-blue text-sm whitespace-nowrap" onClick={() => loadRecord(h.id)}>Cargar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VISTA DE IMPRESIÓN (oculta en pantalla, visible al imprimir)        */}
      {/* ==================================================================== */}
      <div className="hidden print:block bg-white text-black" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-gray-900 m-0">Informe de Grid Mapping</h1>
            <p className="text-sm text-gray-600 mt-1">Inspección de Espesores por Ultrasonidos (UT)</p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p><strong>Fecha Emisión:</strong> {fmtFecha(meta.fecha)}</p>
            <p><strong>Impreso el:</strong> {new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <table className="w-full text-sm border-collapse border border-gray-400">
            <tbody>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold w-1/3">Matrícula</td><td className="border border-gray-400 px-2 py-1">{meta.matricula}</td></tr>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">WO / SAP</td><td className="border border-gray-400 px-2 py-1">{meta.wo_sap || '—'}</td></tr>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">FR</td><td className="border border-gray-400 px-2 py-1">{meta.fr || '—'}</td></tr>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">Operador</td><td className="border border-gray-400 px-2 py-1">{meta.operador || '—'}</td></tr>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">Espesor Nominal</td><td className="border border-gray-400 px-2 py-1">{nominalThickness ? format2(nominalThickness) + ' mm' : '—'}</td></tr>
            </tbody>
          </table>

          <table className="w-full text-sm border-collapse border border-gray-400">
            <tbody>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold w-1/3">Equipo UT</td><td className="border border-gray-400 px-2 py-1">{equipoSeleccionado ? equipoSeleccionado.nombre : '—'}</td></tr>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">Nº Serie / ID</td><td className="border border-gray-400 px-2 py-1 font-mono">{equipoSeleccionado ? (equipoSeleccionado.numero_serie || equipoSeleccionado.id_equipo) : '—'}</td></tr>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">Código de Barras</td><td className="border border-gray-400 px-2 py-1 font-mono">{equipoSeleccionado ? (equipoSeleccionado.codigo_barras || '—') : '—'}</td></tr>
              <tr><td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">Próx. Calibración</td><td className="border border-gray-400 px-2 py-1 font-medium text-gray-800">{equipoSeleccionado?.proxima_calibracion ? fmtFecha(equipoSeleccionado.proxima_calibracion) : '—'}</td></tr>
            </tbody>
          </table>
        </div>

        {referenceImage && (
          <div className="mb-6 flex justify-center">
            <img src={referenceImage} alt="Referencia" className="max-h-64 object-contain border border-gray-300 p-1" />
          </div>
        )}

        {markers.length > 0 && (
          <div className="mb-6 p-3 bg-gray-50 border border-gray-300 rounded">
            <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Indicaciones de Orientación:</div>
            <div className="flex flex-wrap gap-6">
              {markers.map(m => (
                <div key={m.id} className="flex items-center gap-2 text-sm font-bold"><span className="text-lg">{m.arrow}</span><span>{m.text}</span></div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-bold mb-2 border-l-4 border-gray-800 pl-2 mt-6">Resultados de la Medición</h2>
        <table className="w-full border-collapse border border-gray-800 text-xs text-center">
          <thead>
            <tr>
              <th className="border border-gray-800 bg-gray-200 px-1 py-1 w-8"></th>
              {colLabels.map((c) => <th key={c} className="border border-gray-800 bg-gray-200 px-1 py-1 font-bold">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rLabel) => (
              <tr key={rLabel}>
                <th className="border border-gray-800 bg-gray-200 px-1 py-1 font-bold">{rLabel}</th>
                {colLabels.map((cLabel) => {
                  const key = `${cLabel}${rLabel}`;
                  const v = grid[key] ?? '';
                  const numeric = isNumeric(v);
                  const bg = numeric && valueStats.hasData ? colorForValue(parseFloat(String(v).replace(',', '.')), valueStats.min, valueStats.max) : undefined;
                  return (
                    <td key={cLabel} className="border border-gray-800 px-1 py-1 font-mono font-medium" style={{ backgroundColor: bg, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {valueStats.hasData && (
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span className="font-bold uppercase text-gray-700">Escala de medición:</span>
            <div className="flex items-center gap-2">
              <span>{format2(valueStats.min)}</span>
              <div className="w-48 h-3 border border-gray-400" style={{ background: LEGEND_GRADIENT, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
              <span>{format2(valueStats.max)}</span>
            </div>
            {nominalNum !== null && <span className="ml-4"><strong>Espesor nominal:</strong> {format2(nominalNum)} mm</span>}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-gray-400 text-[10px] text-gray-500 text-center">
          Este documento ha sido generado automáticamente por el sistema NDT Warehouse.
        </div>
      </div>
    </>
  );
}