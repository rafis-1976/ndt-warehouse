import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// ⚠️ Ajusta esta ruta al cliente Supabase real de tu proyecto
import { supabase } from '../lib/supabase';

/* ------------------------- Constantes y tipos ------------------------- */

const COLS = 'ABCDEFGHIJ'.split('');
const NROWS = 10;

type GridData = Record<string, string>;
type Meta = { matricula: string; wo_sap: string; fr: string; fecha: string };
type Direction = 'right' | 'down';

interface GridMappingRow {
  id: string;
  matricula: string;
  wo_sap: string | null;
  fr: string | null;
  fecha: string;
  grid_data: GridData;
  updated_at: string;
}

interface HistoryRow {
  id: string;
  matricula: string;
  wo_sap: string | null;
  fr: string | null;
  fecha: string;
  updated_at: string;
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

function normalizeVoice(text: string): string {
  let s = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\bhache\b/g, 'h').replace(/\bjota\b/g, 'j');
  s = s
    .split(/\s+/)
    .map((w) => {
      const clean = w.replace(/^[.,;:]+/, '').replace(/[.,;:]+$/, '');
      return NUM_WORDS[clean] !== undefined ? ` ${NUM_WORDS[clean]} ` : w;
    })
    .join(' ');
  s = s
    .replace(/\bcoma\b|\bpunto\b/g, '.')
    .replace(/\s*\.\s*/g, '.')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function parseCoordinates(s: string): Array<{ key: string; value: string }> {
  const re = /(^|[^a-z0-9])([a-j])\s*(\d{1,2})\s*[:=]?\s*(\d+(?:\.\d+)?)/g;
  const out: Array<{ key: string; value: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const row = parseInt(m[3], 10);
    if (row < 1 || row > NROWS) continue;
    out.push({ key: m[2].toUpperCase() + row, value: m[4] });
  }
  return out;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Formatea "A1" + "12.5" → "A 1, 12 coma 5" para que el TTS lo lea bien en español. */
function formatForSpeech(key: string, value: string): string {
  const col = key[0];
  const row = key.slice(1);
  const valor = value.replace(/\./g, ' coma ');
  return `${col} ${row}, ${valor}`;
}

/* ----------------------------- Componente ----------------------------- */

export function GridMappingPage() {
  const [meta, setMeta] = useState<Meta>({
    matricula: 'EC-NAV',
    wo_sap: '6567863537',
    fr: '248',
    fecha: todayISO(),
  });
  const [grid, setGrid] = useState<GridData>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>('right');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [heard, setHeard] = useState<string>('');
  const [manual, setManual] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ---- Repetición por voz ----
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const voiceFeedbackRef = useRef(true);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // ---- Resaltado de la última celda tocada ----
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // ---- Reconocimiento ----
  const recRef = useRef<any>(null);
  const wantListenRef = useRef(false);

  const filled = useMemo(() => Object.values(grid).filter(Boolean).length, [grid]);

  /* --------------------- Sincronizar ref de voz ---------------------- */

  useEffect(() => {
    voiceFeedbackRef.current = voiceFeedback;
  }, [voiceFeedback]);

  /* --------------------- Inicializar speechSynthesis ----------------- */

  useEffect(() => {
    if (!speechSupported) return;
    synthRef.current = window.speechSynthesis;
    // Algunos navegadores cargan las voces de forma asíncrona
    window.speechSynthesis.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = onVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  /* --------------------------- Voz: hablar --------------------------- */

  const speak = useCallback((text: string) => {
    if (!voiceFeedbackRef.current) return;
    const synth = synthRef.current;
    if (!synth) return;

    // Cancela lo anterior para no acumular cola si dictas rápido
    synth.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-ES';
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.volume = 0.95;

    const voices = synth.getVoices();
    const esVoice =
      voices.find((v) => v.lang === 'es-ES') ||
      voices.find((v) => v.lang.startsWith('es'));
    if (esVoice) utter.voice = esVoice;

    synth.speak(utter);
  }, []);

  /* -------------------------- Voz: silenciar ------------------------- */

  const cancelSpeech = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  /* ---------------------- Resaltado de celda ------------------------ */

  const flashCell = useCallback((key: string) => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlashKey(key);
    flashTimerRef.current = window.setTimeout(() => setFlashKey(null), 1000);
  }, []);

  /* --------------------------- Grid helpers -------------------------- */

  const setCell = useCallback((key: string, value: string) => {
    const v = String(value).replace(',', '.').trim();
    setGrid((prev) => {
      const next = { ...prev };
      if (v) next[key] = v;
      else delete next[key];
      return next;
    });
  }, []);

  const advance = useCallback(() => {
    if (!selected) return;
    const ci0 = COLS.indexOf(selected[0]);
    let ci = ci0;
    let ri = parseInt(selected.slice(1), 10);
    if (direction === 'right') {
      ci += 1;
      if (ci >= COLS.length) {
        ci = 0;
        ri += 1;
      }
    } else {
      ri += 1;
      if (ri > NROWS) {
        ri = 1;
        ci += 1;
      }
    }
    if (ri > NROWS || ci >= COLS.length) {
      setSelected(null);
      return;
    }
    setSelected(COLS[ci] + ri);
  }, [selected, direction]);

  /* --------------------------- Interpretación ------------------------ */

  const handleText = useCallback(
    (text: string, isFinal: boolean) => {
      const s = normalizeVoice(text);
      if (!s) return;

      // 1) Coordenada completa (letra + fila + valor) → rellena YA en tiempo real
      const coords = parseCoordinates(s);
      if (coords.length > 0) {
        coords.forEach(({ key, value }) => setCell(key, value));
        flashCell(coords[coords.length - 1].key);
        setStatus(`✔ ${coords.map((c) => `${c.key}=${c.value}`).join('  ')}`);

        // Solo hablamos al confirmar (final) para no spamear con intermedios
        if (isFinal) {
          speak(coords.map((c) => formatForSpeech(c.key, c.value)).join('. '));
        }
        return;
      }

      // 2) Número suelto sobre la celda activa
      if (/^\d+(\.\d+)?$/.test(s) && selected) {
        setCell(selected, s);
        flashCell(selected);
        setStatus(`✔ ${selected} = ${s}`);

        // Actualiza la tabla en tiempo real (interim), avanza solo al final
        if (isFinal) {
          speak(formatForSpeech(selected, s));
          advance();
        }
        return;
      }

      // 3) Comandos solo en final (evita coincidencias parciales)
      if (
        isFinal &&
        /^(borra|borrar|limpia|limpiar|quita)\b/.test(s) &&
        selected
      ) {
        setCell(selected, '');
        flashCell(selected);
        setStatus(`🗑 ${selected} borrada`);
        speak('borrado');
      }
    },
    [selected, setCell, advance, speak, flashCell],
  );

  /* --------------------------- Micrófono ---------------------------- */

  const toggleListen = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      setStatus('❌ Este navegador no soporta voz. Usa Chrome/Edge en Android, o el campo manual.');
      return;
    }

    if (listening) {
      wantListenRef.current = false;
      recRef.current?.stop?.();
      cancelSpeech();
      setListening(false);
      return;
    }

    wantListenRef.current = true;
    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setStatus('Escuchando… dicta «A uno doce coma cinco».');
    };

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript + ' ';
        else interim += r[0].transcript + ' ';
      }
      if (interim) {
        setHeard(interim);
        handleText(interim, false); // ← actualiza tabla en tiempo real
      }
      if (final) {
        setHeard(final);
        handleText(final, true); // ← aplica + repite por voz
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListenRef.current = false;
        setListening(false);
        setStatus('❌ Permiso de micrófono denegado (necesita HTTPS en Vercel).');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setStatus('⚠️ Error de voz: ' + e.error);
      }
    };

    rec.onend = () => {
      if (wantListenRef.current) {
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            /* noop */
          }
        }, 300);
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (err: any) {
      setStatus('⚠️ ' + err.message);
    }
  }, [listening, handleText, cancelSpeech]);

  /* ----------------------- Limpieza al desmontar -------------------- */

  useEffect(
    () => () => {
      wantListenRef.current = false;
      recRef.current?.stop?.();
      synthRef.current?.cancel();
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    },
    [],
  );

  /* ---------------------- Manual / acciones -------------------------- */

  const applyManual = useCallback(() => {
    if (!manual.trim()) return;
    const s = normalizeVoice(manual);
    const coords = parseCoordinates(s);

    if (coords.length === 0) {
      if (/^\d+(\.\d+)?$/.test(s) && selected) {
        setCell(selected, s);
        flashCell(selected);
        setStatus(`✔ ${selected} = ${s}`);
        speak(formatForSpeech(selected, s));
        advance();
      } else {
        setStatus('⚠️ No se reconoció ninguna coordenada.');
      }
    } else {
      coords.forEach(({ key, value }) => setCell(key, value));
      flashCell(coords[coords.length - 1].key);
      setStatus(`✔ ${coords.map((c) => `${c.key}=${c.value}`).join('  ')}`);
      speak(coords.map((c) => formatForSpeech(c.key, c.value)).join('. '));
    }
    setManual('');
  }, [manual, selected, setCell, advance, speak, flashCell]);

  const clearAll = () => {
    if (!confirm('¿Borrar todos los valores de la cuadrícula?')) return;
    setGrid({});
    setSelected(null);
    setStatus('Cuadrícula vacía.');
  };

  const newMapping = () => {
    setRecordId(null);
    setGrid({});
    setSelected(null);
    setMeta((m) => ({ ...m, fecha: todayISO() }));
    setStatus('Nueva cuadrícula lista.');
  };

  /* --------------------------- Persistencia -------------------------- */

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('grid_mappings')
      .select('id, matricula, wo_sap, fr, fecha, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (!error && data) setHistory(data as HistoryRow[]);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const loadRecord = async (id: string) => {
    const { data, error } = await supabase
      .from('grid_mappings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      setStatus('❌ ' + (error?.message ?? 'No encontrado'));
      return;
    }
    const row = data as GridMappingRow;
    setMeta({
      matricula: row.matricula,
      wo_sap: row.wo_sap ?? '',
      fr: row.fr ?? '',
      fecha: row.fecha,
    });
    setGrid(row.grid_data ?? {});
    setRecordId(row.id);
    setStatus(`✔ Cargado: ${row.matricula} · FR ${row.fr ?? '—'}`);
  };

  const save = async () => {
    if (!meta.matricula.trim() || !meta.fecha) {
      setStatus('⚠️ Matrícula y fecha son obligatorias.');
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload = {
        user_id: user?.id ?? null,
        matricula: meta.matricula.trim(),
        wo_sap: meta.wo_sap.trim() || null,
        fr: meta.fr.trim() || null,
        fecha: meta.fecha,
        grid_data: grid,
      };

      if (recordId) {
        const { error } = await supabase
          .from('grid_mappings')
          .update(payload)
          .eq('id', recordId);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase
          .from('grid_mappings')
          .insert(payload)
          .select('id')
          .single();
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
    const rows: (string | number)[][] = [];
    rows.push(['INFORME DE GRID MAPPING']);
    rows.push([
      `MATRICULA: ${meta.matricula}   WO/SAP: ${meta.wo_sap}   FR: ${meta.fr}   FECHA: ${fmtFecha(meta.fecha)}`,
    ]);
    rows.push([]);
    rows.push(['', ...COLS]);
    for (let r = 1; r <= NROWS; r++) {
      rows.push([r, ...COLS.map((c) => grid[`${c}${r}`] ?? '')]);
    }
    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(sep))
        .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `GRID_${meta.matricula || 'EC-NAV'}_FR${meta.fr || ''}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /* ------------------------------ Render ----------------------------- */

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-airbus-navy">Grid Mapping</h1>
          <p className="text-sm text-gray-500">
            Lectura por voz → cuadrícula por coordenadas
            {recordId && (
              <>
                {' · '}
                <span className="text-airbus-green">editando</span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={newMapping}>
            Nueva
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Metadatos */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Matrícula
            </label>
            <input
              className="input"
              value={meta.matricula}
              onChange={(e) => setMeta({ ...meta, matricula: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              WO / SAP
            </label>
            <input
              className="input"
              value={meta.wo_sap}
              onChange={(e) => setMeta({ ...meta, wo_sap: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">FR</label>
            <input
              className="input"
              value={meta.fr}
              onChange={(e) => setMeta({ ...meta, fr: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
              Fecha
            </label>
            <input
              className="input"
              type="date"
              value={meta.fecha}
              onChange={(e) => setMeta({ ...meta, fecha: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Voz */}
      <div className="card space-y-3">
        <div className="flex gap-2 items-stretch">
          <button
            onClick={toggleListen}
            className={`flex-1 py-3 rounded-lg font-semibold text-white transition ${
              listening
                ? 'bg-airbus-red animate-pulse'
                : 'bg-airbus-blue hover:bg-airbus-navy'
            }`}
          >
            {listening ? '⏹ Detener (escuchando…)' : '🎤 Iniciar lectura por voz'}
          </button>

          {speechSupported && (
            <button
              onClick={() => setVoiceFeedback((v) => !v)}
              className={`px-4 py-3 rounded-lg font-semibold border-2 transition ${
                voiceFeedback
                  ? 'bg-airbus-green text-white border-airbus-green'
                  : 'bg-white text-gray-400 border-gray-300'
              }`}
              title={
                voiceFeedback
                  ? 'Silenciar repetición por voz'
                  : 'Activar repetición por voz'
              }
            >
              {voiceFeedback ? '🔊' : '🔇'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <span className="min-h-[16px]">{status}</span>
          {speechSupported && (
            <span className={voiceFeedback ? 'text-airbus-green' : 'text-gray-400'}>
              Repetir: {voiceFeedback ? 'ON' : 'OFF'}
            </span>
          )}
        </div>

        <div className="min-h-[38px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
          {heard || <i className="text-gray-400">Aquí aparecerá lo reconocido…</i>}
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[220px]"
            placeholder="A1 12.5, B2 13.2 …"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyManual();
              }
            }}
          />
          <button className="btn-primary" onClick={applyManual}>
            Aplicar
          </button>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <select
            className="input max-w-[200px]"
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
          >
            <option value="right">Avance → (fila)</option>
            <option value="down">Avance ↓ (columna)</option>
          </select>
          <span className="badge badge-gray">
            {filled} / {COLS.length * NROWS}
          </span>
          <button className="btn-ghost text-airbus-red" onClick={clearAll}>
            Borrar todo
          </button>
          <button className="btn-ghost" onClick={exportCSV}>
            CSV
          </button>
          <button className="btn-ghost" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      {/* Cuadrícula */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="bg-airbus-navy text-white w-9 h-9 border border-gray-200" />
              {COLS.map((c) => (
                <th
                  key={c}
                  className="bg-airbus-navy text-white font-semibold h-9 border border-gray-200 min-w-[36px]"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: NROWS }, (_, i) => i + 1).map((r) => (
              <tr key={r}>
                <th className="bg-gray-100 text-gray-600 font-bold text-xs border border-gray-200 h-10">
                  {r}
                </th>
                {COLS.map((c) => {
                  const key = `${c}${r}`;
                  const v = grid[key] ?? '';
                  const active = selected === key;
                  const flashing = flashKey === key;
                  return (
                    <td
                      key={key}
                      className={`border border-gray-200 h-10 p-0 transition-colors duration-150 ${
                        flashing
                          ? 'bg-yellow-200'
                          : v
                          ? 'bg-airbus-green/10'
                          : 'bg-white'
                      } ${active ? 'outline outline-2 outline-airbus-sky' : ''}`}
                    >
                      <input
                        className="w-full h-full text-center bg-transparent focus:outline-none focus:bg-airbus-sky/10 font-medium"
                        inputMode="decimal"
                        value={v}
                        onChange={(e) => setCell(key, e.target.value)}
                        onFocus={() => setSelected(key)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Historial */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-airbus-navy">Últimas cuadrículas</h2>
          <button
            className="btn-ghost text-sm"
            onClick={loadHistory}
            disabled={loadingHistory}
          >
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
                <button
                  className="btn-ghost text-airbus-blue text-sm"
                  onClick={() => loadRecord(h.id)}
                >
                  Cargar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}