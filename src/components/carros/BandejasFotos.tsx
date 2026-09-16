import { Layers, AlertCircle } from 'lucide-react';
import { CamaraEquipo } from '../equipos/CamaraEquipo';
import { BUCKET_BANDEJAS, type BandejaFoto } from '../../lib/storageFotos';

interface BandejasFotosProps {
  carroId: string;
  numBandejas: number;
  fotos: BandejaFoto[];
  onChange: (fotos: BandejaFoto[]) => void;
  disabled?: boolean;
}

export function BandejasFotos({
  carroId, numBandejas, fotos, onChange, disabled,
}: BandejasFotosProps) {
  if (numBandejas === 0) {
    return (
      <div className="flex items-start gap-2 bg-airbus-orange/10 border border-airbus-orange/30 text-airbus-orange text-xs p-3 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Este carro no tiene bandejas definidas. Indica primero el número de bandejas.
        </p>
      </div>
    );
  }

  const getFoto = (n: number) =>
    fotos.find((f) => f.num_bandeja === n);

  const actualizarFoto = (n: number, nuevasFotos: any[]) => {
    const restantes = fotos.filter((f) => f.num_bandeja !== n);
    const ultima = nuevasFotos[nuevasFotos.length - 1];
    if (ultima) {
      onChange([
        ...restantes,
        {
          num_bandeja: n,
          url: ultima.url,
          path: ultima.path,
          subida_en: ultima.subida_en,
        },
      ].sort((a, b) => a.num_bandeja - b.num_bandeja));
    } else {
      onChange(restantes);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: numBandejas }, (_, i) => i + 1).map((n) => {
        const foto = getFoto(n);
        return (
          <div
            key={n}
            className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-br from-airbus-blue to-airbus-navy">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-airbus-light" />
                <span className="text-xs font-bold text-white">
                  Bandeja {n}
                </span>
              </div>
              {foto && (
                <span className="text-[9px] font-semibold text-airbus-light uppercase tracking-wider">
                  ✓ Con foto
                </span>
              )}
            </div>

            <div className="p-2">
              <CamaraEquipo
                equipoId={`carro-${carroId}-bandeja-${n}`}
                fotos={foto ? [foto] : []}
                onChange={(f) => actualizarFoto(n, f)}
                bucket={BUCKET_BANDEJAS}
                disabled={disabled}
                compacto
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}