import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface EquipoOption {
  id: string;
  id_equipo: string | null;
  nombre: string;
  codigo_barras: string;
  tecnicas_ndt?: { codigo: string; nombre: string } | null;
}

interface EquipoSelectProps {
  equipos: EquipoOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Dropdown de equipos agrupado por técnica NDT.
 * - ID de equipo en azul monoespaciado
 * - Nombre en gris oscuro
 * - Cabeceras sticky por técnica
 * - Buscador en vivo
 */
export function EquipoSelect({
  equipos, value, onChange,
  placeholder = '— Selecciona un equipo —',
  disabled = false,
}: EquipoSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = equipos.find((e) => e.id === value);

  // Agrupar por técnica
  const grouped = useMemo(() => {
    const map = new Map<string, EquipoOption[]>();
    equipos.forEach((eq) => {
      const cod = eq.tecnicas_ndt?.codigo ?? '— Sin técnica —';
      if (!map.has(cod)) map.set(cod, []);
      map.get(cod)!.push(eq);
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === '— Sin técnica —') return 1;
      if (b[0] === '— Sin técnica —') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [equipos]);

  // Filtrar por búsqueda
  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped
      .map(([cod, list]) => [
        cod,
        list.filter((eq) =>
          [eq.id_equipo, eq.nombre, eq.codigo_barras]
            .join(' ').toLowerCase().includes(q)
        ),
      ] as [string, EquipoOption[]])
      .filter(([, list]) => list.length > 0);
  }, [grouped, search]);

  const close = () => { setOpen(false); setSearch(''); };

  return (
    <div ref={ref} className="relative">
      {/* Botón */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input text-left flex items-center justify-between gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {selected ? (
          <span className="flex items-center gap-3 min-w-0 flex-1">
            <span className="font-mono font-bold text-airbus-blue shrink-0">
              {selected.id_equipo ?? '—'}
            </span>
            <span className="text-gray-700 truncate">
              {selected.nombre}
            </span>
          </span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Panel desplegable */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-2xl max-h-80 flex flex-col overflow-hidden">
          {/* Buscador */}
          <div className="p-2 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-airbus-sky"
                placeholder="Buscar por ID, nombre, código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-sm text-center text-gray-400">
                {search ? 'Sin resultados' : 'No hay equipos disponibles'}
              </p>
            )}

            {filtered.map(([cod, list]) => (
              <div key={cod}>
                {/* Cabecera del grupo: técnica */}
                <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500 sticky top-0 border-b border-gray-100">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-airbus-sky" />
                    {cod}
                    <span className="text-gray-400 font-normal normal-case">
                      · {list.length} equipo{list.length !== 1 ? 's' : ''}
                    </span>
                  </span>
                </div>

                {/* Equipos del grupo */}
                {list.map((eq) => {
                  const isSelected = eq.id === value;
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => { onChange(eq.id); close(); }}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                        isSelected
                          ? 'bg-airbus-sky/10'
                          : 'hover:bg-airbus-light/10'
                      }`}
                    >
                      <span className="font-mono font-bold text-airbus-blue shrink-0 w-20 truncate">
                        {eq.id_equipo ?? '—'}
                      </span>
                      <span className="text-gray-700 truncate flex-1">
                        {eq.nombre}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0 hidden sm:inline">
                        {eq.codigo_barras}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-airbus-sky shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}