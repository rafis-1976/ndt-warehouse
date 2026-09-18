import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  Search, X, Package, Hash, Wrench, Calendar, FileText,
  ArrowDownRight, ArrowUpRight, ArrowRightLeft, Truck, CornerDownLeft,
  Sliders, User as UserIcon, Clock, AlertTriangle, CheckCircle2,
  RefreshCw, Layers, ScanBarcode, Building2, Warehouse, Users,
  TrendingUp, BarChart3, History,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { BarcodeScanner } from '../components/BarcodeScanner';

const COLORS = ['#00205B', '#0085AD', '#74D2E7', '#009F4D', '#FE5000', '#DA1884'];

type Tab = 'resumen' | 'historial';
type Objeto = { tipo: 'equipo' | 'probeta'; data: any };

const tipoConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  entrada:            { label: 'Entrada',            icon: ArrowDownRight,  color: 'text-airbus-green',  bg: 'bg-airbus-green/10' },
  salida:             { label: 'Salida',             icon: ArrowUpRight,    color: 'text-airbus-orange', bg: 'bg-airbus-orange/10' },
  transferencia:      { label: 'Transferencia',      icon: ArrowRightLeft,  color: 'text-airbus-sky',    bg: 'bg-airbus-sky/10' },
  ajuste:             { label: 'Ajuste',             icon: Sliders,         color: 'text-airbus-purple', bg: 'bg-airbus-purple/10' },
  prestamo_externo:   { label: 'Préstamo externo',   icon: Truck,           color: 'text-airbus-orange', bg: 'bg-airbus-orange/10' },
  devolucion_externa: { label: 'Devolución externa', icon: CornerDownLeft,  color: 'text-airbus-green',  bg: 'bg-airbus-green/10' },
};

const tipoDestinoConfig: Record<string, { label: string; icon: any }> = {
  almacen: { label: 'Almacén', icon: Warehouse },
  seccion: { label: 'Sección', icon: Building2 },
  compania: { label: 'Compañía', icon: Truck },
  cliente: { label: 'Cliente', icon: Users },
  otro: { label: 'Otro', icon: Building2 },
};

const fmtFecha = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtFechaHora = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// ============================================================
// Cálculo de tiempos de uso a partir de los movimientos
// ============================================================
function calcularTiemposUso(movs: any[]) {
  const sorted = [...movs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  type Ciclo = { inicio: Date; fin: Date | null; tipoInicio: string };
  const ciclos: Ciclo[] = [];
  let abierto: { inicio: Date; tipo: string } | null = null;

  sorted.forEach((m) => {
    const esSalida = m.tipo === 'salida' || m.tipo === 'prestamo_externo';
    const esRetorno = m.tipo === 'entrada' || m.tipo === 'devolucion_externa';

    if (esSalida && !abierto) {
      abierto = { inicio: new Date(m.created_at), tipo: m.tipo };
    } else if (esRetorno && abierto) {
      ciclos.push({ inicio: abierto.inicio, fin: new Date(m.created_at), tipoInicio: abierto.tipo });
      abierto = null;
    }
  });

  if (abierto) {
    ciclos.push({ inicio: (abierto as any).inicio, fin: null, tipoInicio: (abierto as any).tipo });
  }

  const totalMs = ciclos.reduce((acc, c) => {
    const fin = c.fin ?? new Date();
    return acc + (fin.getTime() - c.inicio.getTime());
  }, 0);

  return {
    ciclos,
    totalDias: Math.round((totalMs / 864e5) * 10) / 10,
    totalHoras: Math.round((totalMs / 36e5) * 10) / 10,
    ciclosAbiertos: ciclos.filter((c) => c.fin === null).length,
    enUsoAhora: ciclos.some((c) => c.fin === null),
  };
}

// ============================================================
// Componente principal
// ============================================================
export function Estadisticas() {
  const [tab, setTab] = useState<Tab>('resumen');
  const [porEstado, setPorEstado] = useState<any[]>([]);
  const [porTecnica, setPorTecnica] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: eq } = await supabase
        .from('equipos')
        .select('estado, tecnicas_ndt(codigo, nombre)');

      const estadoMap: Record<string, number> = {};
      const tecMap: Record<string, number> = {};
      (eq ?? []).forEach((e: any) => {
        estadoMap[e.estado] = (estadoMap[e.estado] ?? 0) + 1;
        const t = e.tecnicas_ndt?.codigo ?? 'Sin técnica';
        tecMap[t] = (tecMap[t] ?? 0) + 1;
      });

      setPorEstado(Object.entries(estadoMap).map(([name, value]) => ({ name, value })));
      setPorTecnica(Object.entries(tecMap).map(([name, value]) => ({ name, value })));
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-airbus-blue">Estadísticas</h1>
        <p className="text-sm text-gray-500">Análisis del estado del almacén NDT</p>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('resumen')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
            tab === 'resumen' ? 'bg-white text-airbus-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Resumen general
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
            tab === 'historial' ? 'bg-white text-airbus-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Historial por equipo / probeta
        </button>
      </div>

      {tab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-airbus-blue mb-4">Equipos por estado</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {porEstado.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-airbus-blue mb-4">Equipos por técnica NDT</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porTecnica}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0085AD" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && <HistorialTab />}
    </div>
  );
}

// ============================================================
// Tab de historial por objeto
// ============================================================
function HistorialTab() {
  const [q, setQ] = useState('');
  const [equipos, setEquipos] = useState<any[]>([]);
  const [probetas, setProbetas] = useState<any[]>([]);
  const [informes, setInformes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [ultimoEscaneo, setUltimoEscaneo] = useState<string | null>(null);

  const [objetoSeleccionado, setObjetoSeleccionado] = useState<Objeto | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  // Cargar catálogos al montar
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [eq, pb, inf] = await Promise.all([
        supabase.from('equipos').select('*, tecnicas_ndt(codigo, nombre)').order('id_equipo'),
        supabase
          .from('probetas')
          .select('*, tecnicas_ndt(codigo, nombre), carros(codigo, nombre)')
          .order('pn'),
        supabase
          .from('informes')
          .select('id, numero_informe, numero_sap, fecha_inspeccion, cliente, operador, matricula, ntm_steps, resultado, estado, created_at')
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);
      if (eq.error) console.error(eq.error);
      if (pb.error) console.error(pb.error);
      if (inf.error) console.error(inf.error);
      setEquipos(eq.data ?? []);
      setProbetas(pb.data ?? []);
      setInformes(inf.data ?? []);
      setLoading(false);
    })();
  }, []);

  const qLower = q.trim().toLowerCase();

  const resultados = useMemo<Objeto[]>(() => {
    if (!qLower) return [];
    const eq = equipos
      .filter((e) =>
        [e.id_equipo, e.nombre, e.codigo_barras, e.numero_serie, e.marca, e.modelo, e.ubicacion]
          .filter(Boolean).join(' ').toLowerCase().includes(qLower)
      )
      .map((e) => ({ tipo: 'equipo' as const, data: e }));
    const pb = probetas
      .filter((p) =>
        [p.pn, p.nombre, p.codigo_barras, p.numero_serie, p.material, p.dimensiones, p.normas_ntm, p.carros?.codigo]
          .filter(Boolean).join(' ').toLowerCase().includes(qLower)
      )
      .map((p) => ({ tipo: 'probeta' as const, data: p }));
    return [...eq, ...pb];
  }, [qLower, equipos, probetas]);

  const abrirDetalle = (obj: Objeto) => {
    setObjetoSeleccionado(obj);
    setDetalleOpen(true);
  };

  const handleScan = (code: string) => {
    const limpio = code.trim();
    setQ(limpio);
    setUltimoEscaneo(limpio);
    setScannerOpen(false);

    // Auto-abrir si hay match exacto
    const eqMatch = equipos.find(
      (e) => e.codigo_barras?.toLowerCase() === limpio.toLowerCase() || e.id_equipo?.toLowerCase() === limpio.toLowerCase()
    );
    if (eqMatch) {
      setTimeout(() => abrirDetalle({ tipo: 'equipo', data: eqMatch }), 150);
      return;
    }
    const pbMatch = probetas.find(
      (p) => p.codigo_barras?.toLowerCase() === limpio.toLowerCase() || p.pn?.toLowerCase() === limpio.toLowerCase()
    );
    if (pbMatch) setTimeout(() => abrirDetalle({ tipo: 'probeta', data: pbMatch }), 150);
  };

  const limpiar = () => {
    setQ('');
    setUltimoEscaneo(null);
  };

  return (
    <div className="space-y-4">
      {/* BUSCADOR */}
      <div className="card space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10 pr-10"
            placeholder="Buscar equipo o probeta por ID, P/N, nombre, código de barras, serie, marca..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              title="Limpiar"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-airbus-sky hover:text-airbus-blue hover:bg-airbus-sky/10 rounded transition"
              title="Escanear código de barras"
            >
              <ScanBarcode className="w-4 h-4" />
            </button>
          )}
        </div>

        {ultimoEscaneo && (
          <div className="flex items-center gap-2 text-xs bg-airbus-sky/10 border border-airbus-sky/30 text-airbus-blue px-3 py-1.5 rounded-lg">
            <ScanBarcode className="w-3.5 h-3.5 shrink-0" />
            <span>
              Código escaneado: <span className="font-mono font-bold">{ultimoEscaneo}</span>
            </span>
            <button
              onClick={limpiar}
              className="ml-auto text-airbus-sky hover:text-airbus-blue"
              title="Quitar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* RESULTADOS / ESTADO INICIAL */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando catálogos...
        </div>
      ) : !qLower ? (
        <div className="card p-12 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">Busca un equipo o una probeta para ver su historial completo</p>
          <p className="text-xs text-gray-400">
            {equipos.length} equipos · {probetas.length} probetas indexados
          </p>
        </div>
      ) : resultados.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 mb-1">Sin resultados para "{q}"</p>
          <button
            onClick={limpiar}
            className="btn-ghost border border-gray-300 inline-flex items-center gap-2 mt-4"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            <strong className="text-airbus-blue">{resultados.length}</strong> resultado
            {resultados.length !== 1 ? 's' : ''} para "{q}"
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {resultados.slice(0, 30).map((r) => (
              <ResultadoCard
                key={`${r.tipo}-${r.data.id}`}
                objeto={r}
                onClick={() => abrirDetalle(r)}
              />
            ))}
          </div>
        </>
      )}

      {/* MODAL DETALLE */}
      <Modal
        open={detalleOpen}
        onClose={() => { setDetalleOpen(false); setObjetoSeleccionado(null); }}
        title={objetoSeleccionado ? `Historial · ${objetoSeleccionado.data.nombre}` : 'Historial'}
        size="lg"
      >
        {objetoSeleccionado && (
          <HistorialDetalle objeto={objetoSeleccionado} informes={informes} />
        )}
      </Modal>

      {/* MODAL ESCÁNER */}
      <Modal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Escanear código de barras"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Escanea el código de un equipo o probeta para ver su historial completo.
          </p>
          <BarcodeScanner onScan={handleScan} />
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Tarjeta de resultado
// ============================================================
function ResultadoCard({ objeto, onClick }: { objeto: Objeto; onClick: () => void }) {
  const d = objeto.data;
  const esEquipo = objeto.tipo === 'equipo';

  return (
    <button
      onClick={onClick}
      className="card p-3 flex items-center gap-3 text-left hover:border-airbus-sky hover:shadow-md transition"
    >
      {d.foto_url ? (
        <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
          <img src={d.foto_url} alt={d.nombre} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
          esEquipo ? 'bg-airbus-blue/10' : 'bg-airbus-sky/10'
        }`}>
          {esEquipo
            ? <Package className="w-5 h-5 text-airbus-blue" />
            : <Hash className="w-5 h-5 text-airbus-sky" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-mono font-bold text-xs ${esEquipo ? 'text-airbus-blue' : 'text-airbus-sky'}`}>
            {esEquipo ? d.id_equipo : d.pn}
          </span>
          {d.tecnicas_ndt?.codigo && (
            <span className="badge badge-blue">{d.tecnicas_ndt.codigo}</span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-800 truncate mt-0.5">{d.nombre}</p>
        <p className="text-[10px] text-gray-400 truncate">
          {esEquipo ? (d.marca ? `${d.marca} ${d.modelo ?? ''}` : '') : (d.material ?? '')}
        </p>
      </div>
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
        esEquipo ? 'bg-airbus-blue/10 text-airbus-blue' : 'bg-airbus-sky/10 text-airbus-sky'
      }`}>
        {esEquipo ? 'Equipo' : 'Probeta'}
      </span>
    </button>
  );
}

// ============================================================
// Detalle de historial (carga movimientos y calibraciones)
// ============================================================
function HistorialDetalle({ objeto, informes }: { objeto: Objeto; informes: any[] }) {
  const [movs, setMovs] = useState<any[]>([]);
  const [cals, setCals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const esEquipo = objeto.tipo === 'equipo';
  const d = objeto.data;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const filter = esEquipo ? `equipo_id.eq.${d.id}` : `probeta_id.eq.${d.id}`;

      const [movsRes, calsRes] = await Promise.all([
        supabase
          .from('movimientos')
          .select('*, perfiles(num_nomina, nombre_completo)')
          .or(filter)
          .order('created_at', { ascending: false }),
        esEquipo
          ? supabase.from('calibraciones').select('*').eq('equipo_id', d.id).order('fecha_calibracion', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (movsRes.error) console.error(movsRes.error);
      setMovs(movsRes.data ?? []);
      setCals(calsRes.data ?? []);
      setLoading(false);
    })();
  }, [d.id, esEquipo]);

  // Informes relacionados (filtrado client-side sobre ntm_steps)
  const informesRelacionados = useMemo(() => {
    return informes.filter((inf) => {
      if (!Array.isArray(inf.ntm_steps)) return false;
      return inf.ntm_steps.some((s: any) => {
        if (esEquipo) {
          return Array.isArray(s.equipos) && s.equipos.some((e: any) =>
            (e.id_equipo && e.id_equipo === d.id_equipo) ||
            (e.codigo_barras && e.codigo_barras === d.codigo_barras)
          );
        }
        return Array.isArray(s.probetas) && s.probetas.some((p: any) =>
          (p.pn && p.pn === d.pn) ||
          (p.codigo_barras && p.codigo_barras === d.codigo_barras)
        );
      });
    });
  }, [informes, esEquipo, d.id_equipo, d.codigo_barras, d.pn]);

  const tiempos = useMemo(() => calcularTiemposUso(movs), [movs]);

  const personal = useMemo(() => {
    const map = new Map<string, { num: string; nombre: string; count: number; ultima: string }>();
    movs.forEach((m) => {
      if (!m.perfiles) return;
      const key = `${m.perfiles.num_nomina ?? ''}::${m.perfiles.nombre_completo ?? ''}`;
      const prev = map.get(key);
      if (prev) {
        prev.count++;
        if (new Date(m.created_at) > new Date(prev.ultima)) prev.ultima = m.created_at;
      } else {
        map.set(key, {
          num: m.perfiles.num_nomina ?? '',
          nombre: m.perfiles.nombre_completo ?? '',
          count: 1,
          ultima: m.created_at,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [movs]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Cargando historial...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* CABECERA DEL OBJETO */}
      <div className={`rounded-xl p-4 text-white ${
        esEquipo
          ? 'bg-gradient-to-br from-airbus-blue to-airbus-navy'
          : 'bg-gradient-to-br from-airbus-sky to-airbus-blue'
      }`}>
        <div className="flex items-center gap-3">
          {d.foto_url ? (
            <div className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0">
              <img src={d.foto_url} alt={d.nombre} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              {esEquipo ? <Package className="w-8 h-8 text-white/70" /> : <Hash className="w-8 h-8 text-white/70" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-white/80">
              {esEquipo ? d.id_equipo : d.pn}
            </p>
            <p className="font-bold text-lg truncate">{d.nombre}</p>
            {esEquipo && (d.marca || d.modelo) && (
              <p className="text-xs text-white/80 truncate">
                {d.marca} {d.modelo}
              </p>
            )}
            <p className="text-[10px] font-mono text-white/70 truncate mt-0.5">
              {d.codigo_barras}
            </p>
          </div>
          {d.tecnicas_ndt?.codigo && (
            <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-bold shrink-0">
              {d.tecnicas_ndt.codigo}
            </span>
          )}
        </div>

        {/* Info extra */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
          {esEquipo ? (
            <>
              <InfoMini label="Estado" value={d.estado ?? '—'} />
              <InfoMini label="Ubicación" value={d.ubicacion ?? '—'} />
              <InfoMini label="Nº Serie" value={d.numero_serie ?? '—'} mono />
              <InfoMini label="Próx. calib." value={fmtFecha(d.proxima_calibracion)} />
            </>
          ) : (
            <>
              <InfoMini label="Estado" value={d.estado ?? 'disponible'} />
              <InfoMini label="Carro" value={d.carros?.codigo ?? '—'} mono />
              <InfoMini label="Material" value={d.material ?? '—'} />
              <InfoMini label="Dimensiones" value={d.dimensiones ?? '—'} />
            </>
          )}
        </div>
      </div>

      {/* KPIs PRINCIPALES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Clock}
          label="Tiempo fuera total"
          value={
            tiempos.totalDias >= 1
              ? `${tiempos.totalDias} d`
              : `${tiempos.totalHoras} h`
          }
          sub={tiempos.enUsoAhora ? '⏺ En uso ahora' : undefined}
          color="orange"
        />
        <KpiCard
          icon={ArrowRightLeft}
          label="Ciclos salida/retorno"
          value={String(tiempos.ciclos.length)}
          sub={tiempos.ciclosAbiertos > 0 ? `${tiempos.ciclosAbiertos} abierto${tiempos.ciclosAbiertos !== 1 ? 's' : ''}` : undefined}
          color="blue"
        />
        <KpiCard
          icon={UserIcon}
          label="Personal distinto"
          value={String(personal.length)}
          sub={personal.length > 0 ? `Último: ${personal[0].nombre.split(' ')[0]}` : undefined}
          color="green"
        />
        <KpiCard
          icon={FileText}
          label={esEquipo ? 'Calibraciones' : 'Informes'}
          value={String(esEquipo ? cals.length : informesRelacionados.length)}
          sub={esEquipo ? (cals[0] ? `Última: ${fmtFecha(cals[0].fecha_calibracion)}` : undefined)
                        : (informesRelacionados[0] ? `Último: ${fmtFecha(informesRelacionados[0].fecha_inspeccion)}` : undefined)}
          color="sky"
        />
      </div>

      {/* PERSONAL */}
      {personal.length > 0 && (
        <Seccion titulo={`Personal que lo ha usado (${personal.length})`} icon={UserIcon}>
          <div className="flex flex-wrap gap-1.5">
            {personal.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-full text-[11px]"
              >
                <UserIcon className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="font-medium text-gray-700 truncate max-w-[140px]">
                  {p.nombre || '—'}
                </span>
                {p.num && (
                  <span className="font-mono text-[9px] text-gray-400">#{p.num}</span>
                )}
                <span className="px-1.5 rounded-full bg-airbus-blue/10 text-airbus-blue text-[9px] font-bold">
                  {p.count}
                </span>
              </span>
            ))}
          </div>
        </Seccion>
      )}

      {/* CALIBRACIONES (solo equipos) */}
      {esEquipo && cals.length > 0 && (
        <Seccion titulo={`Historial de calibraciones (${cals.length})`} icon={Wrench}>
          <div className="space-y-1.5">
            {cals.map((c) => {
              const vencida = c.fecha_proxima && new Date(c.fecha_proxima) < new Date();
              return (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                  <div className="w-8 h-8 bg-airbus-sky/15 rounded-lg flex items-center justify-center shrink-0">
                    <Wrench className="w-3.5 h-3.5 text-airbus-sky" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">
                      {fmtFecha(c.fecha_calibracion)}
                      {c.laboratorio && <span className="text-gray-500"> · {c.laboratorio}</span>}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {c.numero_certificado && <span className="font-mono">Cert. {c.numero_certificado}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.resultado === 'aprobado' ? 'bg-airbus-green/15 text-airbus-green'
                      : c.resultado === 'rechazado' ? 'bg-airbus-red/15 text-airbus-red'
                      : c.resultado === 'condicional' ? 'bg-airbus-yellow/20 text-yellow-800'
                      : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.resultado ?? '—'}
                    </span>
                    {c.fecha_proxima && (
                      <p className={`text-[9px] mt-0.5 ${vencida ? 'text-airbus-red font-semibold' : 'text-gray-400'}`}>
                        Próx: {fmtFecha(c.fecha_proxima)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Seccion>
      )}

      {/* INFORMES */}
      {informesRelacionados.length > 0 && (
        <Seccion titulo={`Informes donde se ha usado (${informesRelacionados.length})`} icon={FileText}>
          <div className="space-y-1.5">
            {informesRelacionados.slice(0, 15).map((inf) => (
              <div key={inf.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                <div className="w-8 h-8 bg-airbus-blue/10 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-airbus-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-airbus-blue">{inf.numero_informe}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {inf.matricula ?? '—'}
                    {inf.cliente && ` · ${inf.cliente}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-500">{fmtFecha(inf.fecha_inspeccion)}</p>
                  <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    inf.resultado === 'FINDINGS' ? 'bg-airbus-red/15 text-airbus-red' : 'bg-airbus-green/15 text-airbus-green'
                  }`}>
                    {inf.resultado}
                  </span>
                </div>
              </div>
            ))}
            {informesRelacionados.length > 15 && (
              <p className="text-[10px] text-gray-400 text-center pt-1">
                +{informesRelacionados.length - 15} informes más
              </p>
            )}
          </div>
        </Seccion>
      )}

      {/* TIMELINE DE MOVIMIENTOS */}
      <Seccion titulo={`Historial de movimientos (${movs.length})`} icon={ArrowRightLeft}>
        {movs.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Sin movimientos registrados</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {movs.map((m) => {
              const conf = tipoConfig[m.tipo] ?? tipoConfig.ajuste;
              const Icon = conf.icon;
              const destinoConf = m.destino_tipo ? tipoDestinoConfig[m.destino_tipo] : null;
              const DestIcon = destinoConf?.icon ?? Building2;
              const esExterno = m.tipo === 'prestamo_externo' || m.tipo === 'devolucion_externa';

              return (
                <div key={m.id} className="flex items-start gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${conf.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${conf.color}`}>
                        {conf.label}
                      </span>
                      {esExterno && destinoConf && m.destino_nombre && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-airbus-orange">
                          <DestIcon className="w-2.5 h-2.5" />
                          {m.destino_nombre}
                        </span>
                      )}
                      {!esExterno && (m.ubicacion_origen || m.ubicacion_destino) && (
                        <span className="text-[10px] text-gray-500">
                          {m.ubicacion_origen ?? '—'} → {m.ubicacion_destino ?? '—'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 flex-wrap">
                      <span>{fmtFechaHora(m.created_at)}</span>
                      {m.perfiles && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="w-2.5 h-2.5" />
                          {m.perfiles.nombre_completo}
                        </span>
                      )}
                      {m.referencia && (
                        <span className="font-mono">Ref: {m.referencia}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Seccion>
    </div>
  );
}

// ============================================================
// Helpers UI
// ============================================================
function InfoMini({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">{label}</p>
      <p className={`text-xs text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: any; label: string; value: string; sub?: string;
  color: 'blue' | 'green' | 'orange' | 'sky' | 'red';
}) {
  const map: Record<string, string> = {
    blue:   'text-airbus-blue bg-airbus-blue/10',
    green:  'text-airbus-green bg-airbus-green/10',
    orange: 'text-airbus-orange bg-airbus-orange/10',
    sky:    'text-airbus-sky bg-airbus-sky/10',
    red:    'text-airbus-red bg-airbus-red/10',
  };
  const [textCls, bgCls] = map[color].split(' ');

  return (
    <div className="card p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${bgCls}`}>
        <Icon className={`w-4 h-4 ${textCls}`} />
      </div>
      <p className={`text-xl font-bold ${textCls} leading-none`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 font-semibold">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function Seccion({ titulo, icon: Icon, children }: { titulo: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        {titulo}
      </h4>
      {children}
    </div>
  );
}