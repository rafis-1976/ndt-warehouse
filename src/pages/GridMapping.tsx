import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { WhisperTranscriber } from 'whisper-web-transcriber';

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

type GridData = Record<string, string>;
type Meta = { matricula: string; wo_sap: string; fr: string; fecha: string };
type Direction = 'right' | 'down';
type RowMode = { active: boolean; row: number; colIdx: number };

interface GridMappingRow {
  id: string; matricula: string; wo_sap: string | null; fr: string | null;
  fecha: string; grid_data: GridData; updated_at: string;
}
interface HistoryRow {
  id: string; matricula: string; wo_sap: string | null; fr: string | null;
  fecha: string; updated_at: string;
}

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

const COLOR_STOPS = [
  { t: 0.00, r: 215, g: 48,  b: 39  },
  { t: 0.20, r: 253, g: 174, b: 97  },
  { t: 0.40, r: 255, g: 255, b: 191 },
  { t: 0.60, r: 217, g: 239, b: 139 },
  { t: 0.80, r: 102, g: 189, b: 99  },
  { t: 1.00, r: 0,   g: 104, b: 55  },
];
function colorForValue(v: number, min: number, max: number): string {
  if (max === min) return 'rgb(255, 255, 191)';
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i], b = COLOR_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return `rgb(${Math.round(a.r + (b.r - a.r) * k)}, ${Math.round(a.g + (b.g - a.g) * k)}, ${Math.round(a.b + (b.b - a.b) * k)})`;
    }
  }
  return 'rgb(255, 255, 191)';
}
const LEGEND_GRADIENT =
  'linear-gradient(to right, ' +
  COLOR_STOPS.map((s) => `rgb(${s.r},${s.g},${s.b}) ${(s.t * 100).toFixed(0)}%`).join(', ') +
  ')';

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

function parseCoordinates(s: string, rowsLimit: number, colsLimit: number) {
  const re = /(^|[^a-z0-9])([a-z])\s*('*)\s*(\d{1,2})\s*[:=]?\s*(\d+(?:\.\d+)?)/g;
  const out: Array<{ key: string; value: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const row = parseInt(m[4], 10);
    if (row < 1 || row > rowsLimit) continue;
    const col = m[2].toUpperCase() + m[3];
    const ci = colIndex(col);
    if (ci < 0 || ci >= colsLimit) continue;
    out.push({ key: col + row, value: m[5] });
  }
  return out;
}
function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function nextKey(key: string, direction: Direction, colsN: number, rowsN: number): string | null {
  const m = key.match(/^([A-Z])('*)(\d+)$/);
  if (!m) return null;
  let ci = colIndex(m[1] + m[2]);
  let ri = parseInt(m[3], 10);
  if (direction === 'right') { ci += 1; if (ci >= colsN) { ci = 0; ri += 1; } }
  else { ri += 1; if (ri > rowsN) { ri = 1; ci += 1; } }
  if (ri > rowsN || ci >= colsN) return null;
  return colName(ci) + ri;
}

/* ----------------------------- Componente ----------------------------- */

export function GridMappingPage() {
  const [meta, setMeta] = useState<Meta>({
    matricula: 'EC-NAV', wo_sap: '6567863537', fr: '248', fecha: todayISO(),
  });
  const [grid, setGrid] = useState<GridData>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>('right');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string>('Pulsa «Iniciar lectura por voz» y di «fila 1».');
  const [heard, setHeard] = useState<string>('');
  const [lastNormalized, setLastNormalized] = useState<string>('');
  const [lastReadings, setLastReadings] = useState<string[]>([]);
  const [manual, setManual] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [nominalThickness, setNominalThickness] = useState<string>('');

  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
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

  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);

  const whisperRef = useRef<WhisperTranscriber | null>(null);

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

  const advance = useCallback(() => {
    if (!selected) return;
    setSelected(nextKey(selected, direction, colsRef.current, rowsRef.current));
  }, [selected, direction]);

  const detectRow = (s: string): number => {
    const m1 = s.match(/\bfila\b[^0-9]*?(\d+)/);
    if (m1) return parseInt(m1[1], 10);
    for (const [word, num] of Object.entries(ORDINALS)) {
      if (new RegExp(`\\b${word}\\s+fila\\b`).test(s) || new RegExp(`\\bfila\\s+${word}\\b`).test(s)) return num;
    }
    return -1;
  };
  const isFin = (s: string) => /\b(fin|final|terminar|termine|finalizar|acabar|acabe)\b/.test(s);
  const isSiguienteFila = (s: string) =>
    /\b(siguiente|otra|proxima)\s+fila\b/.test(s) || /\bfila\s+(siguiente|proxima)\b/.test(s);

  const firstEmptyCol = (rowNum: number): number => {
    const g = gridRef.current;
    for (let i = 0; i < colsRef.current; i++) if (!g[colName(i) + rowNum]) return i;
    return colsRef.current;
  };

  /* ------------------ Procesamiento de texto ------------------ */
  const handleVoiceFinal = useCallback((text: string) => {
    const s = normalizeVoice(text);
    setLastNormalized(s);
    if (!s) return;

    if (isSiguienteFila(s)) {
      const currentRow = rowModeRef.current.active ? rowModeRef.current.row : 0;
      const nextRow = Math.min(rowsRef.current, currentRow + 1);
      if (nextRow >= 1) {
        const startCol = firstEmptyCol(nextRow);
        updateRowMode({ active: true, row: nextRow, colIdx: startCol });
        setStatus(`Fila ${nextRow} activa · siguiente: ${colName(startCol)}${nextRow}`);
        return;
      }
    }

    const targetRow = detectRow(s);
    if (targetRow >= 1 && targetRow <= MAX_ROWS) {
      if (targetRow > rowsRef.current) { setRows(targetRow); rowsRef.current = targetRow; }
      const startCol = firstEmptyCol(targetRow);
      updateRowMode({ active: true, row: targetRow, colIdx: startCol });
      setStatus(`Fila ${targetRow} activa · siguiente: ${colName(startCol)}${targetRow}`);
      setHeard(`Fila ${targetRow}`);
      return;
    }

    if (isFin(s)) {
      if (rowModeRef.current.active) {
        const r = rowModeRef.current.row;
        updateRowMode({ active: false, row: 0, colIdx: 0 });
        setStatus(`Fila ${r} terminada · di «fila N» para continuar`);
      } else {
        setStatus('No hay fila activa · di «fila N» primero');
      }
      return;
    }

    if (rowModeRef.current.active) {
      const values = extractReadings(s, true);
      setLastReadings(values);
      if (values.length === 0) {
        setStatus('No se reconoció ningún número · di la lectura de nuevo');
        return;
      }

      const { row } = rowModeRef.current;
      const colsN = colsRef.current;
      let currentColIdx = rowModeRef.current.colIdx;

      for (const value of values) {
        if (currentColIdx >= colsN) break;
        const col = colName(currentColIdx);
        setCell(col + row, value);
        flashCell(col + row);
        currentColIdx++;
      }

      if (currentColIdx >= colsN) {
        updateRowMode({ active: true, row, colIdx: currentColIdx });
        setStatus(`Fila ${row} completa · di FIN`);
      } else {
        const nextCol = colName(currentColIdx);
        updateRowMode({ active: true, row, colIdx: currentColIdx });
        setStatus(`✔ Fila ${row} · siguiente: ${nextCol}${row}`);
      }
      return;
    }

    const coords = parseCoordinates(s, rowsRef.current, colsRef.current);
    if (coords.length > 0) {
      coords.forEach(({ key, value }) => { setCell(key, value); flashCell(key); });
      const lastKey = coords[coords.length - 1].key;
      const nk = nextKey(lastKey, direction, colsRef.current, rowsRef.current);
      setStatus(`✔ ${coords.map((c) => `${c.key}=${format2(c.value)}`).join('  ')}` + (nk ? ` · siguiente: ${nk}` : ''));
      return;
    }

    if (/^\d+(\.\d+)?$/.test(s)) setStatus('Di «fila N» primero para empezar.');
  }, [setCell, flashCell, updateRowMode, direction]);

  const handleVoiceFinalRef = useRef(handleVoiceFinal);
  useEffect(() => { handleVoiceFinalRef.current = handleVoiceFinal; }, [handleVoiceFinal]);

  /* --------------------------- Micrófono / Whisper --------------------- */
  const toggleListen = useCallback(async () => {
    if (listening) {
      whisperRef.current?.stopRecording();
      setListening(false);
      return;
    }

    setModelLoading(true);
    setStatus('Cargando modelo de Whisper (solo la primera vez)…');

    try {
      const transcriber = new WhisperTranscriber({
        modelSize: 'tiny', // 'tiny' (75MB) es suficiente para español y el más rápido. Alternativa: 'base' (142MB).
        language: 'es',
        onProgress: (p) => setModelProgress(p),
        onStatus: (s) => setStatus(s),
        onTranscription: (text) => {
          // La librería puede devolver fragmentos; los pasamos a la lógica de negocio.
          // Si el texto contiene varias lecturas, handleVoiceFinal las procesará todas.
          handleVoiceFinalRef.current(text);
        },
      });

      await transcriber.loadModel();
      whisperRef.current = transcriber;
      await transcriber.startRecording();
      setListening(true);
      setStatus('Escuchando con Whisper (es)… di «fila N» para empezar.');
    } catch (err: any) {
      console.error(err);
      setStatus('❌ Error al iniciar Whisper: ' + (err.message ?? 'desconocido'));
    } finally {
      setModelLoading(false);
    }
  }, [listening]);

  useEffect(() => () => {
    whisperRef.current?.stopRecording();
    whisperRef.current?.destroy();
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  const setRowsCount = (n: number) => {
    if (n < MIN_ROWS || n > MAX_ROWS) return;
    if (n < rows) {
      const lost = Object.keys(grid).some((k) => {
        if (k.startsWith('_')) return false;
        const m = k.match(/(\d+)$/); return m && parseInt(m[0], 10) > n;
      });
      if (lost && !confirm(`¿Eliminar las celdas de las filas ${n + 1}–${rows}?`)) return;
      setGrid((prev) => {
        const next: GridData = {};
        Object.keys(prev).forEach((k) => {
          if (k.startsWith('_')) { next[k] = prev[k]; return; }
          const m = k.match(/(\d+)$/);
          if (m && parseInt(m[0], 10) <= n) next[k] = prev[k];
        });
        return next;
      });
      if (selected) { const m = selected.match(/(\d+)$/); if (m && parseInt(m[0], 10) > n) setSelected(null); }
      if (rowModeRef.current.active && rowModeRef.current.row > n) updateRowMode({ active: false, row: 0, colIdx: 0 });
    }
    setRows(n); rowsRef.current = n;
  };
  const setColsCount = (n: number) => {
    if (n < MIN_COLS || n > MAX_COLS) return;
    if (n < cols) {
      const lost = Object.keys(grid).some((k) => {
        if (k.startsWith('_')) return false;
        const m = k.match(/^([A-Z]*)('*)(\d+)$/);
        return m && colIndex(m[1] + m[2]) >= n;
      });
      if (lost && !confirm(`¿Eliminar las celdas más allá de la columna ${colName(n - 1)}?`)) return;
      setGrid((prev) => {
        const next: GridData = {};
        Object.keys(prev).forEach((k) => {
          if (k.startsWith('_')) { next[k] = prev[k]; return; }
          const m = k.match(/^([A-Z]*)('*)(\d+)$/);
          if (m && colIndex(m[1] + m[2]) < n) next[k] = prev[k];
        });
        return next;
      });
      if (selected) { const m = selected.match(/^([A-Z]*)('*)(\d+)$/); if (m && colIndex(m[1] + m[2]) >= n) setSelected(null); }
      if (rowModeRef.current.active && rowModeRef.current.colIdx >= n) updateRowMode({ active: false, row: 0, colIdx: 0 });
    }
    setCols(n); colsRef.current = n;
  };

  const applyManual = useCallback(() => {
    if (!manual.trim()) return;
    const s = normalizeVoice(manual);
    setLastNormalized(s);
    const coords = parseCoordinates(s, rowsRef.current, colsRef.current);
    if (coords.length === 0) {
      const vals = extractReadings(s, true);
      setLastReadings(vals);
      if (vals.length > 0 && selected) {
        setCell(selected, vals[0]); flashCell(selected);
        const nk = nextKey(selected, direction, colsRef.current, rowsRef.current);
        setStatus(`✔ ${selected} = ${format2(vals[0])}` + (nk ? ` · siguiente: ${nk}` : ''));
        advance();
      } else {
        setStatus('⚠️ No se reconoció ninguna coordenada.');
      }
    } else {
      coords.forEach(({ key, value }) => { setCell(key, value); flashCell(key); });
      const lastKey = coords[coords.length - 1].key;
      const nk = nextKey(lastKey, direction, colsRef.current, rowsRef.current);
      setStatus(`✔ ${coords.map((c) => `${c.key}=${format2(c.value)}`).join('  ')}` + (nk ? ` · siguiente: ${nk}` : ''));
    }
    setManual('');
  }, [manual, selected, setCell, advance, flashCell, direction]);

  const clearAll = () => {
    if (!confirm('¿Borrar todos los valores de la cuadrícula?')) return;
    setGrid({}); setSelected(null);
    updateRowMode({ active: false, row: 0, colIdx: 0 });
    setStatus('Cuadrícula vacía.');
  };
  const newMapping = () => {
    setRecordId(null); setGrid({}); setSelected(null);
    setNominalThickness('');
    updateRowMode({ active: false, row: 0, colIdx: 0 });
    setMeta((m) => ({ ...m, fecha: todayISO() }));
    setStatus('Nueva cuadrícula lista.');
  };

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('grid_mappings')
      .select('id, matricula, wo_sap, fr, fecha, updated_at')
      .order('updated_at', { ascending: false }).limit(20);
    if (!error && data) setHistory(data as HistoryRow[]);
    setLoadingHistory(false);
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const loadRecord = async (id: string) => {
    const { data, error } = await supabase.from('grid_mappings').select('*').eq('id', id).single();
    if (error || !data) { setStatus('❌ ' + (error?.message ?? 'No encontrado')); return; }
    const row = data as GridMappingRow;
    setMeta({ matricula: row.matricula, wo_sap: row.wo_sap ?? '', fr: row.fr ?? '', fecha: row.fecha });
    const rawData = row.grid_data ?? {};
    const normalized: GridData = {};
    let nominalFromGrid = '';
    Object.entries(rawData).forEach(([k, v]) => {
      if (k === RESERVED_NOMINAL_KEY) { nominalFromGrid = v ?? ''; return; }
      normalized[k] = v && isNumeric(v) ? format2(v) : v;
    });
    setGrid(normalized);
    setNominalThickness(nominalFromGrid);
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

  const exportCSV = () => {
    const sep = ';';
    const data: (string | number)[][] = [];
    data.push(['INFORME DE GRID MAPPING']);
    data.push([`MATRICULA: ${meta.matricula}   WO/SAP: ${meta.wo_sap}   FR: ${meta.fr}   FECHA: ${fmtFecha(meta.fecha)}`]);
    if (nominalThickness && isNumeric(nominalThickness)) data.push([`ESPESOR NOMINAL: ${format2(nominalThickness)}`]);
    data.push([]);
    data.push(['', ...Array.from({ length: cols }, (_, ci) => colName(ci))]);
    for (let r = 1; r <= rows; r++) {
      data.push([r, ...Array.from({ length: cols }, (_, ci) => {
        const v = grid[`${colName(ci)}${r}`] ?? '';
        return v ? (isNumeric(v) ? format2(v) : v) : '';
      })]);
    }
    const csv = '\uFEFF' + data.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(sep)).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `GRID_${meta.matricula || 'EC-NAV'}_FR${meta.fr || ''}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const nextCellLabel = rowMode.active && rowMode.colIdx < cols ? `${colName(rowMode.colIdx)}${rowMode.row}` : null;
  const displayValue = (key: string, raw: string): string => {
    if (focusedKey === key) return raw;
    if (raw && isNumeric(raw)) return format2(raw);
    return raw;
  };
  const nominalNum = nominalThickness && isNumeric(nominalThickness)
    ? parseFloat(String(nominalThickness).replace(',', '.')) : null;

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-airbus-navy">Grid Mapping</h1>
          <p className="text-sm text-gray-500">
            Lectura por voz · fila → lecturas → FIN
            {recordId && (<> · <span className="text-airbus-green">editando</span></>)}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={newMapping}>Nueva</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Matrícula</label>
            <input className="input" value={meta.matricula} onChange={(e) => setMeta({ ...meta, matricula: e.target.value })} /></div>
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">WO / SAP</label>
            <input className="input" value={meta.wo_sap} onChange={(e) => setMeta({ ...meta, wo_sap: e.target.value })} /></div>
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">FR</label>
            <input className="input" value={meta.fr} onChange={(e) => setMeta({ ...meta, fr: e.target.value })} /></div>
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Fecha</label>
            <input className="input" type="date" value={meta.fecha} onChange={(e) => setMeta({ ...meta, fecha: e.target.value })} /></div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-airbus-blue mb-1 font-semibold">Espesor nominal</label>
            <input className="input" type="text" inputMode="decimal" placeholder="mm"
              value={nominalThickness}
              onChange={(e) => setNominalThickness(e.target.value)}
              onBlur={() => { if (nominalThickness && isNumeric(nominalThickness)) setNominalThickness(format2(nominalThickness)); }} />
          </div>
        </div>
        {nominalNum !== null && valueStats.hasData && (
          <p className="text-xs text-airbus-blue mt-2">
            ℹ️ Referencia: nominal <b>{format2(nominalNum)}</b> · rango medido <b>{format2(valueStats.min)}</b> – <b>{format2(valueStats.max)}</b>
          </p>
        )}
      </div>

      <div className="card space-y-3">
        <button onClick={toggleListen} disabled={modelLoading}
          className={`w-full py-3 rounded-lg font-semibold text-white transition ${listening ? 'bg-airbus-red animate-pulse' : 'bg-airbus-blue hover:bg-airbus-navy'} disabled:opacity-60`}>
          {modelLoading ? `Cargando modelo… ${modelProgress}%` : listening ? '⏹ Detener (escuchando…)' : '🎤 Iniciar lectura por voz (Whisper)'}
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {rowMode.active ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-airbus-blue text-white text-sm font-medium">
              📋 Fila {rowMode.row} <span className="text-xs opacity-90">{nextCellLabel ? `siguiente: ${nextCellLabel}` : 'completa · di FIN'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">Sin fila activa · di «fila N»</span>
          )}
          <span className="text-xs text-gray-500">{status}</span>
        </div>

        <div className="min-h-[38px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
          {heard || <i className="text-gray-400">Aquí aparecerá lo reconocido…</i>}
        </div>

        {(lastNormalized || lastReadings.length > 0) && (
          <div className="text-[11px] text-gray-400 bg-white border border-dashed border-gray-200 rounded-lg px-3 py-1.5 font-mono">
            Normalizado: <b className="text-gray-600">{lastNormalized || '—'}</b>
            {lastReadings.length > 0 && (
              <> · Valores: <b className="text-gray-600">[{lastReadings.map((v) => format2(v)).join(', ')}]</b></>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 bg-airbus-cream/40 border border-airbus-light/30 rounded-lg px-3 py-2">
          🗣️ Di <b>«fila 1»</b> · dicta lecturas seguidas · <b>«FIN»</b> al terminar.
          La app usa Whisper localmente, sin pitidos ni envío de audio a servidores.
        </p>

        <div className="flex gap-5 items-center flex-wrap pt-2 border-t border-gray-100 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Filas</span>
            <button type="button" onClick={() => setRowsCount(rows - 1)} disabled={rows <= MIN_ROWS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
            <span className="w-8 text-center font-mono text-sm">{rows}</span>
            <button type="button" onClick={() => setRowsCount(rows + 1)} disabled={rows >= MAX_ROWS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Columnas</span>
            <button type="button" onClick={() => setColsCount(cols - 1)} disabled={cols <= MIN_COLS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
            <span className="w-14 text-center font-mono text-sm">{colName(cols - 1)}</span>
            <button type="button" onClick={() => setColsCount(cols + 1)} disabled={cols >= MAX_COLS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input className="input flex-1 min-w-[220px]" placeholder="Manual: A1 12.5, A'2 13.2 …"
            value={manual} onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyManual(); } }} />
          <button className="btn-primary" onClick={applyManual}>Aplicar</button>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <select className="input max-w-[200px]" value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="right">Avance → (fila)</option>
            <option value="down">Avance ↓ (columna)</option>
          </select>
          <span className="badge badge-gray">{filled} / {rows * cols}</span>
          <button className="btn-ghost text-airbus-red" onClick={clearAll}>Borrar todo</button>
          <button className="btn-ghost" onClick={exportCSV}>CSV</button>
          <button className="btn-ghost" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="bg-airbus-navy text-white w-9 h-9 border border-gray-200" />
              {Array.from({ length: cols }, (_, ci) => colName(ci)).map((c) => (
                <th key={c} className="bg-airbus-navy text-white font-semibold h-9 border border-gray-200 min-w-[44px] whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => i + 1).map((r) => {
              const isCurrentRow = rowMode.active && rowMode.row === r;
              return (
                <tr key={r}>
                  <th className={`font-bold text-xs border border-gray-200 h-10 transition-colors ${isCurrentRow ? 'bg-airbus-blue text-white' : 'bg-gray-100 text-gray-600'}`}>{r}</th>
                  {Array.from({ length: cols }, (_, ci) => colName(ci)).map((c, ci) => {
                    const key = `${c}${r}`;
                    const v = grid[key] ?? '';
                    const display = displayValue(key, v);
                    const active = selected === key;
                    const flashing = flashKey === key;
                    const isNext = isCurrentRow && rowMode.colIdx === ci;
                    const numeric = isNumeric(v);
                    const bg = numeric && valueStats.hasData
                      ? colorForValue(parseFloat(String(v).replace(',', '.')), valueStats.min, valueStats.max)
                      : undefined;
                    return (
                      <td
                        key={key}
                        className={`border border-gray-200 h-10 p-0 transition-colors duration-300 ${active ? 'outline outline-2 outline-airbus-sky' : ''} ${isNext && !v ? 'outline outline-2 outline-dashed outline-airbus-blue' : ''}`}
                        style={{ backgroundColor: bg, boxShadow: flashing ? 'inset 0 0 0 3px rgb(251, 146, 60)' : undefined }}
                      >
                        <input
                          className="w-full h-full text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-airbus-sky font-medium tabular-nums px-1"
                          inputMode="decimal"
                          value={display}
                          onChange={(e) => setCellRaw(key, e.target.value)}
                          onFocus={() => { setFocusedKey(key); setSelected(key); }}
                          onBlur={(e) => {
                            setFocusedKey(null);
                            const val = e.target.value.trim();
                            if (val && isNumeric(val)) setCell(key, val);
                            else if (val) setCellRaw(key, val);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
                          }}
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

      <div className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Escala de color</div>
          {valueStats.hasData ? (
            <div className="flex items-center gap-3 text-xs flex-1 min-w-[240px]">
              <span className="font-mono text-gray-700 tabular-nums">{format2(valueStats.min)}</span>
              <div className="flex-1 relative py-2">
                <div className="h-4 rounded-full border border-gray-200" style={{ background: LEGEND_GRADIENT }} />
                {nominalPct !== null && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-blue-600 shadow"
                    style={{ left: `${nominalPct}%`, transform: 'translateX(-50%)' }}
                    title={`Nominal: ${format2(nominalNum ?? 0)}`} />
                )}
              </div>
              <span className="font-mono text-gray-700 tabular-nums">{format2(valueStats.max)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Introduce valores numéricos para ver el gradiente</span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap mt-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'rgb(215,48,39)' }} />
            Mínimo
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'rgb(255,255,191)' }} />
            Medio
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: 'rgb(0,104,55)' }} />
            Máximo
          </span>
          {nominalPct !== null && (
            <span className="inline-flex items-center gap-1 ml-auto text-airbus-blue font-medium">
              <span className="inline-block w-0.5 h-3 bg-blue-600" />
              Nominal: {format2(nominalNum ?? 0)}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-airbus-navy">Últimas cuadrículas</h2>
          <button className="btn-ghost text-sm" onClick={loadHistory} disabled={loadingHistory}>
            {loadingHistory ? 'Cargando…' : 'Refrescar'}
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay cuadrículas guardadas.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((h) => (
              <li key={h.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 truncate">
                    {h.matricula} · WO {h.wo_sap ?? '—'} · FR {h.fr ?? '—'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {fmtFecha(h.fecha)} · {new Date(h.updated_at).toLocaleString('es-ES')}
                  </div>
                </div>
                <button className="btn-ghost text-airbus-blue text-sm" onClick={() => loadRecord(h.id)}>Cargar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}