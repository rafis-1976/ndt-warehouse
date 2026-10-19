import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// ⚠️ Ajusta esta ruta al cliente Supabase real de tu proyecto
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

/* ------------------------- Constantes y tipos ------------------------- */

const MIN_ROWS = 1, MAX_ROWS = 50;
const MIN_COLS = 1, MAX_COLS = 78;

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

function colorForValue(v: number, min: number, max: number): string {
  if (max === min) return 'rgb(253, 224, 71)';
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  if (t <= 0.5) {
    const k = t * 2;
    const r = Math.round(134 + (253 - 134) * k);
    const g = Math.round(239 + (224 - 239) * k);
    const b = Math.round(172 + (71 - 172) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const k = (t - 0.5) * 2;
  const r = Math.round(253 + (252 - 253) * k);
  const g = Math.round(224 + (165 - 224) * k);
  const b = Math.round(71 + (165 - 71) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

/* ------------------------- Utilidades de voz ------------------------- */

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

  s = s.replace(/\bcoma\b|\bpunto\b/g, ' DEC ');

  const tokens = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let state: 'normal' | 'waitDec' | 'inDec' = 'normal';

  for (const tok of tokens) {
    if (tok === 'DEC') { state = 'waitDec'; continue; }

    if (state === 'waitDec') {
      if (/^\d+$/.test(tok) && out.length > 0 && /\d$/.test(out[out.length - 1])) {
        out[out.length - 1] += '.' + tok;
        state = /^\d$/.test(tok) ? 'inDec' : 'normal';
        continue;
      }
      state = 'normal';
    }

    if (state === 'inDec' && /^\d$/.test(tok)) {
      out[out.length - 1] += tok;
      continue;
    }

    state = 'normal';
    out.push(tok);
  }
  s = out.join(' ');

  s = s.replace(/\bdoble\s+prima\b/g, "''")
       .replace(/\bprima\b/g, "'")
       .replace(/\bprimas\b/g, "'")
       .replace(/(\d),(\d)/g, '$1.$2')
       .replace(/\s+/g, ' ')
       .trim();
  return s;
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
  if (direction === 'right') {
    ci += 1;
    if (ci >= colsN) { ci = 0; ri += 1; }
  } else {
    ri += 1;
    if (ri > rowsN) { ri = 1; ci += 1; }
  }
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
  const [manual, setManual] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  /* --------- NUEVO: flag para saber cuándo está hablando la app -------- */
  const isSpeakingRef = useRef(false);

  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const voiceFeedbackRef = useRef(true);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [flashKey, setFlashKey] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const recRef = useRef<any>(null);
  const wantListenRef = useRef(false);

  const filled = useMemo(() => Object.values(grid).filter(Boolean).length, [grid]);

  const valueStats = useMemo(() => {
    const nums: number[] = [];
    Object.values(grid).forEach((v) => {
      if (isNumeric(v)) nums.push(parseFloat(String(v).replace(',', '.')));
    });
    if (nums.length === 0) return { min: 0, max: 0, hasData: false };
    return { min: Math.min(...nums), max: Math.max(...nums), hasData: true };
  }, [grid]);

  useEffect(() => {
    let needsUpdate = false;
    const next: GridData = { ...grid };
    Object.keys(next).forEach((k) => {
      if (k === focusedKey) return;
      const v = next[k];
      if (v && isNumeric(v)) {
        const f = format2(v);
        if (f !== v) { next[k] = f; needsUpdate = true; }
      }
    });
    if (needsUpdate) setGrid(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, focusedKey]);

  useEffect(() => { voiceFeedbackRef.current = voiceFeedback; }, [voiceFeedback]);

  useEffect(() => {
    if (!speechSupported) return;
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = onVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  /* -------------------------- Hablar ------------------------- */
  const speak = useCallback((text: string, interrupt = false) => {
    if (!voiceFeedbackRef.current) return;
    const synth = synthRef.current;
    if (!synth) return;

    // Marcar que la app va a hablar → el reconocedor ignorará lo que llegue
    isSpeakingRef.current = true;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-ES'; utter.rate = 1.15; utter.pitch = 1.0; utter.volume = 0.95;
    const voices = synth.getVoices();
    const esVoice = voices.find((v) => v.lang === 'es-ES') || voices.find((v) => v.lang.startsWith('es'));
    if (esVoice) utter.voice = esVoice;

    // Cuando empieza a sonar, confirmamos el flag
    utter.onstart = () => { isSpeakingRef.current = true; };
    // Cuando termina (o se cancela / falla), lo liberamos
    utter.onend = () => { isSpeakingRef.current = false; };
    utter.onerror = () => { isSpeakingRef.current = false; };

    if (interrupt) {
      synth.cancel();
      setTimeout(() => synth.speak(utter), 60);
    } else {
      synth.speak(utter);
    }
  }, []);
  const cancelSpeech = useCallback(() => {
    synthRef.current?.cancel();
    isSpeakingRef.current = false;
  }, []);

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
    const nk = nextKey(selected, direction, colsRef.current, rowsRef.current);
    setSelected(nk);
  }, [selected, direction]);

  /* ------------------ Detección de comandos ------------------ */
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
    for (let i = 0; i < colsRef.current; i++) {
      if (!g[colName(i) + rowNum]) return i;
    }
    return colsRef.current;
  };

  /* ------------------ Procesado de voz ----------------------- */
  const handleVoiceFinal = useCallback((text: string) => {
    const s = normalizeVoice(text);
    if (!s) return;

    if (isSiguienteFila(s)) {
      const currentRow = rowModeRef.current.active ? rowModeRef.current.row : 0;
      const nextRow = Math.min(rowsRef.current, currentRow + 1);
      if (nextRow >= 1) {
        const startCol = firstEmptyCol(nextRow);
        updateRowMode({ active: true, row: nextRow, colIdx: startCol });
        setStatus(`Fila ${nextRow} activa · siguiente: ${colName(startCol)}${nextRow}`);
        speak(`Fila ${nextRow}, adelante`, true);
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
      speak(`Fila ${targetRow}, adelante`, true);
      return;
    }

    if (isFin(s)) {
      if (rowModeRef.current.active) {
        const r = rowModeRef.current.row;
        updateRowMode({ active: false, row: 0, colIdx: 0 });
        setStatus(`Fila ${r} terminada · di «fila N» para continuar`);
        speak(`Fila ${r} terminada`, true);
      } else {
        setStatus('No hay fila activa · di «fila N» primero');
      }
      return;
    }

    if (rowModeRef.current.active) {
      const values = [...s.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
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
        speak('Di fin', true);
      } else {
        const nextCol = colName(currentColIdx);
        updateRowMode({ active: true, row, colIdx: currentColIdx });
        setStatus(`✔ Fila ${row} · siguiente: ${nextCol}${row}`);
        speak(`${nextCol} ${row}`, true);
      }
      return;
    }

    const coords = parseCoordinates(s, rowsRef.current, colsRef.current);
    if (coords.length > 0) {
      coords.forEach(({ key, value }) => { setCell(key, value); flashCell(key); });
      const lastKey = coords[coords.length - 1].key;
      const nk = nextKey(lastKey, direction, colsRef.current, rowsRef.current);
      setStatus(`✔ ${coords.map((c) => `${c.key}=${format2(c.value)}`).join('  ')}`);
      if (nk) speak(nk, true);
      return;
    }

    if (/^\d+(\.\d+)?$/.test(s)) {
      setStatus('Di «fila N» primero para empezar.');
      speak('Di fila, y el número', true);
    }
  }, [setCell, flashCell, speak, updateRowMode, direction]);

  const handleVoiceFinalRef = useRef(handleVoiceFinal);
  useEffect(() => { handleVoiceFinalRef.current = handleVoiceFinal; }, [handleVoiceFinal]);

  /* --------------------------- Micrófono --------------------- */
  const toggleListen = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus('❌ Este navegador no soporta voz. Usa Chrome/Edge en Android, o el campo manual.'); return; }
    if (listening) {
      wantListenRef.current = false;
      recRef.current?.stop?.();
      cancelSpeech();
      setListening(false);
      return;
    }
    wantListenRef.current = true;
    const rec = new SR();
    rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onstart = () => { setListening(true); setStatus('Escuchando… di «fila N» para empezar.'); };
    rec.onresult = (e: any) => {
      // 🔇 Si la app está hablando, ignoramos completamente el audio
      if (isSpeakingRef.current) return;

      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript + ' ';
        else interim += r[0].transcript + ' ';
      }
      if (interim) setHeard(interim);
      if (final) { setHeard(final); handleVoiceFinalRef.current(final); }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListenRef.current = false; setListening(false);
        setStatus('❌ Permiso de micrófono denegado (necesita HTTPS en Vercel).');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setStatus('⚠️ Error de voz: ' + e.error);
      }
    };
    rec.onend = () => {
      if (wantListenRef.current) setTimeout(() => { try { rec.start(); } catch { /* noop */ } }, 300);
      else setListening(false);
    };
    recRef.current = rec;
    try { rec.start(); } catch (err: any) { setStatus('⚠️ ' + err.message); }
  }, [listening, cancelSpeech]);

  useEffect(() => () => {
    wantListenRef.current = false;
    isSpeakingRef.current = false;
    recRef.current?.stop?.();
    synthRef.current?.cancel();
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  /* ------------------- Cambiar tamaño ----------------------- */
  const setRowsCount = (n: number) => {
    if (n < MIN_ROWS || n > MAX_ROWS) return;
    if (n < rows) {
      const lost = Object.keys(grid).some((k) => {
        const m = k.match(/(\d+)$/); return m && parseInt(m[0], 10) > n;
      });
      if (lost && !confirm(`¿Eliminar las celdas de las filas ${n + 1}–${rows}?`)) return;
      setGrid((prev) => {
        const next: GridData = {};
        Object.keys(prev).forEach((k) => {
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
        const m = k.match(/^([A-Z]*)('*)(\d+)$/);
        if (!m) return false;
        return colIndex(m[1] + m[2]) >= n;
      });
      if (lost && !confirm(`¿Eliminar las celdas más allá de la columna ${colName(n - 1)}?`)) return;
      setGrid((prev) => {
        const next: GridData = {};
        Object.keys(prev).forEach((k) => {
          const m = k.match(/^([A-Z]*)('*)(\d+)$/);
          if (!m) return;
          if (colIndex(m[1] + m[2]) < n) next[k] = prev[k];
        });
        return next;
      });
      if (selected) { const m = selected.match(/^([A-Z]*)('*)(\d+)$/); if (m && colIndex(m[1] + m[2]) >= n) setSelected(null); }
      if (rowModeRef.current.active && rowModeRef.current.colIdx >= n) updateRowMode({ active: false, row: 0, colIdx: 0 });
    }
    setCols(n); colsRef.current = n;
  };

  /* ------------------- Manual / acciones ------------------- */
  const applyManual = useCallback(() => {
    if (!manual.trim()) return;
    const s = normalizeVoice(manual);
    const coords = parseCoordinates(s, rowsRef.current, colsRef.current);
    if (coords.length === 0) {
      if (/^\d+(\.\d+)?$/.test(s) && selected) {
        setCell(selected, s); flashCell(selected);
        const nk = nextKey(selected, direction, colsRef.current, rowsRef.current);
        setStatus(`✔ ${selected} = ${format2(s)}`);
        advance();
        if (nk) speak(nk, true);
      } else {
        setStatus('⚠️ No se reconoció ninguna coordenada.');
      }
    } else {
      coords.forEach(({ key, value }) => { setCell(key, value); flashCell(key); });
      const lastKey = coords[coords.length - 1].key;
      const nk = nextKey(lastKey, direction, colsRef.current, rowsRef.current);
      setStatus(`✔ ${coords.map((c) => `${c.key}=${format2(c.value)}`).join('  ')}`);
      if (nk) speak(nk, true);
    }
    setManual('');
  }, [manual, selected, setCell, advance, flashCell, direction, speak]);

  const clearAll = () => {
    if (!confirm('¿Borrar todos los valores de la cuadrícula?')) return;
    setGrid({}); setSelected(null);
    updateRowMode({ active: false, row: 0, colIdx: 0 });
    setStatus('Cuadrícula vacía.');
  };
  const newMapping = () => {
    setRecordId(null); setGrid({}); setSelected(null);
    updateRowMode({ active: false, row: 0, colIdx: 0 });
    setMeta((m) => ({ ...m, fecha: todayISO() }));
    setStatus('Nueva cuadrícula lista.');
  };

  /* ------------------- Persistencia ------------------------ */
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
    const normalized: GridData = {};
    Object.keys(row.grid_data ?? {}).forEach((k) => {
      const v = (row.grid_data ?? {})[k];
      normalized[k] = v && isNumeric(v) ? format2(v) : v;
    });
    setGrid(normalized);
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
        const v = grid[k];
        if (v) cleanGrid[k] = isNumeric(v) ? format2(v) : v;
      });
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
      setStatus('✔ Guardado en Supabase.');
      void loadHistory();
    } catch (err: any) {
      setStatus('❌ ' + (err?.message ?? 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const sep = ';';
    const data: (string | number)[][] = [];
    data.push(['INFORME DE GRID MAPPING']);
    data.push([`MATRICULA: ${meta.matricula}   WO/SAP: ${meta.wo_sap}   FR: ${meta.fr}   FECHA: ${fmtFecha(meta.fecha)}`]);
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

  /* ------------------------------ Render ----------------------------- */

  const nextCellLabel = rowMode.active && rowMode.colIdx < cols ? `${colName(rowMode.colIdx)}${rowMode.row}` : null;

  const displayValue = (key: string, raw: string): string => {
    if (focusedKey === key) return raw;
    if (raw && isNumeric(raw)) return format2(raw);
    return raw;
  };

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-4">
      {/* Cabecera */}
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

      {/* Metadatos */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Matrícula</label>
            <input className="input" value={meta.matricula} onChange={(e) => setMeta({ ...meta, matricula: e.target.value })} /></div>
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">WO / SAP</label>
            <input className="input" value={meta.wo_sap} onChange={(e) => setMeta({ ...meta, wo_sap: e.target.value })} /></div>
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">FR</label>
            <input className="input" value={meta.fr} onChange={(e) => setMeta({ ...meta, fr: e.target.value })} /></div>
          <div><label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Fecha</label>
            <input className="input" type="date" value={meta.fecha} onChange={(e) => setMeta({ ...meta, fecha: e.target.value })} /></div>
        </div>
      </div>

      {/* Voz */}
      <div className="card space-y-3">
        <div className="flex gap-2 items-stretch">
          <button onClick={toggleListen}
            className={`flex-1 py-3 rounded-lg font-semibold text-white transition ${listening ? 'bg-airbus-red animate-pulse' : 'bg-airbus-blue hover:bg-airbus-navy'}`}>
            {listening ? '⏹ Detener (escuchando…)' : '🎤 Iniciar lectura por voz'}
          </button>
          {speechSupported && (
            <button onClick={() => setVoiceFeedback((v) => !v)}
              className={`px-4 py-3 rounded-lg font-semibold border-2 transition ${voiceFeedback ? 'bg-airbus-green text-white border-airbus-green' : 'bg-white text-gray-400 border-gray-300'}`}
              title={voiceFeedback ? 'Silenciar repetición' : 'Activar repetición'}>
              {voiceFeedback ? '🔊' : '🔇'}
            </button>
          )}
        </div>

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

        <p className="text-xs text-gray-500 bg-airbus-cream/40 border border-airbus-light/30 rounded-lg px-3 py-2">
          🗣️ Di <b>«fila 1»</b> · dicta lecturas seguidas (<i>dos coma cero dos, dos coma cero cinco</i>) · <b>«FIN»</b> al terminar.
          Tras cada valor te dirá la <b>coordenada siguiente</b>. El micrófono se silencia mientras la app habla.
        </p>

        {/* Controles de tamaño */}
        <div className="flex gap-5 items-center flex-wrap pt-2 border-t border-gray-100 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Filas</span>
            <button type="button" onClick={() => setRowsCount(rows - 1)} disabled={rows <= MIN_ROWS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Quitar fila">−</button>
            <span className="w-8 text-center font-mono text-sm">{rows}</span>
            <button type="button" onClick={() => setRowsCount(rows + 1)} disabled={rows >= MAX_ROWS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Añadir fila">+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Columnas</span>
            <button type="button" onClick={() => setColsCount(cols - 1)} disabled={cols <= MIN_COLS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Quitar columna">−</button>
            <span className="w-14 text-center font-mono text-sm">{colName(cols - 1)}</span>
            <button type="button" onClick={() => setColsCount(cols + 1)} disabled={cols >= MAX_COLS}
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Añadir columna">+</button>
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

      {/* Cuadrícula */}
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
                        style={{
                          backgroundColor: bg,
                          boxShadow: flashing ? 'inset 0 0 0 3px rgb(251, 146, 60)' : undefined,
                        }}
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
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                            }
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

      {/* 🎨 Leyenda */}
      <div className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Escala de color</div>
          {valueStats.hasData ? (
            <div className="flex items-center gap-3 text-xs flex-1 min-w-[240px]">
              <span className="font-mono text-gray-700 tabular-nums">{format2(valueStats.min)}</span>
              <div className="flex-1 h-4 rounded-full border border-gray-200"
                style={{ background: 'linear-gradient(to right, rgb(134,239,172), rgb(253,224,71), rgb(252,165,165))' }}
              />
              <span className="font-mono text-gray-700 tabular-nums">{format2(valueStats.max)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Introduce valores numéricos para ver el gradiente</span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Verde = mínimo · Amarillo = medio · Rojo = máximo. Se recalcula automáticamente.
        </p>
      </div>

      {/* Historial */}
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