import { Palette, Type, Moon, Sun, Monitor, Check, RotateCcw, Loader2, Settings as SettingsIcon } from 'lucide-react';
import {
  useSettings,
  type Theme,
  type Accent,
  type FontSize,
} from '../contexts/SettingsContext';

const themeOptions: { value: Theme; label: string; icon: any; desc: string }[] = [
  { value: 'light', label: 'Claro', icon: Sun, desc: 'Fondo blanco clásico' },
  { value: 'dark', label: 'Oscuro', icon: Moon, desc: 'Fondo oscuro, ideal de noche' },
  { value: 'auto', label: 'Automático', icon: Monitor, desc: 'Sigue el sistema operativo' },
];

const accentOptions: { value: Accent; label: string; color: string }[] = [
  // Principales
  { value: 'blue',   label: 'Granate', color: '#780029' },
  { value: 'rose',   label: 'Burdeos', color: '#A6002E' },
  { value: 'red',    label: 'Rojo',    color: '#D7192D' },
  // Secundarios
  { value: 'orange', label: 'Naranja', color: '#F68400' },
  { value: 'green',  label: 'Menta',   color: '#4BC59C' },
  { value: 'teal',   label: 'Cian',    color: '#97E1E1' },
  { value: 'purple', label: 'Magenta', color: '#A20067' },
  { value: 'tan',    label: 'Arena',   color: '#9E8668' },
  { value: 'gray',   label: 'Gris',    color: '#575757' },
];

const fontSizeOptions: { value: FontSize; label: string; sample: string }[] = [
  { value: 'small',  label: 'Pequeño',    sample: 'text-sm' },
  { value: 'normal', label: 'Normal',     sample: 'text-base' },
  { value: 'large',  label: 'Grande',     sample: 'text-lg' },
  { value: 'xlarge', label: 'Muy grande', sample: 'text-xl' },
];

export function Ajustes() {
  const { settings, saveStatus, updateSettings, resetSettings } = useSettings();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#780029]">Ajustes</h1>
        <p className="text-sm text-gray-500">
          Personaliza tu experiencia en NDT Warehouse
        </p>
      </div>

      {saveStatus === 'saving' && (
        <div className="flex items-center gap-2 text-xs text-[#A6002E] bg-[#A6002E]/10 border border-[#A6002E]/30 rounded-lg px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Guardando cambios...
        </div>
      )}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 text-xs text-[#4BC59C] bg-[#4BC59C]/10 border border-[#4BC59C]/30 rounded-lg px-3 py-2">
          <Check className="w-3.5 h-3.5" />
          Cambios guardados
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-xs text-[#D7192D] bg-[#D7192D]/10 border border-[#D7192D]/30 rounded-lg px-3 py-2">
          Error al guardar en el servidor · guardado solo en este dispositivo
        </div>
      )}

      {/* TEMA */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#780029]/10 rounded-lg flex items-center justify-center">
            <Palette className="w-5 h-5 text-[#780029]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Tema</h2>
            <p className="text-xs text-gray-500">Apariencia general de la aplicación</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = settings.theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateSettings({ theme: opt.value })}
                className={`relative p-4 rounded-lg border-2 text-left transition ${
                  active
                    ? 'border-[#780029] bg-[#780029]/5'
                    : 'border-gray-200 hover:border-[#A6002E]/50 hover:bg-gray-50'
                }`}
              >
                {active && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-[#780029] rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <Icon
                  className={`w-6 h-6 mb-2 ${
                    active ? 'text-[#780029]' : 'text-gray-400'
                  }`}
                />
                <p
                  className={`font-semibold ${
                    active ? 'text-[#780029]' : 'text-gray-800'
                  }`}
                >
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* COLOR DE ACENTO */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#780029]/10 rounded-lg flex items-center justify-center">
            <Palette className="w-5 h-5 text-[#780029]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Color de acento</h2>
            <p className="text-xs text-gray-500">
              Botones, enlaces y elementos destacados
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {accentOptions.map((opt) => {
            const active = settings.accent === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateSettings({ accent: opt.value })}
                className={`relative p-3 rounded-lg border-2 transition ${
                  active ? 'border-gray-800' : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div
                  className="w-full h-10 rounded-md mb-2"
                  style={{ backgroundColor: opt.color }}
                />
                <p
                  className={`text-xs font-medium ${
                    active ? 'text-gray-800' : 'text-gray-600'
                  }`}
                >
                  {opt.label}
                </p>
                {active && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
                    <Check className="w-3 h-3 text-gray-800" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAMAÑO DE LETRA */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#780029]/10 rounded-lg flex items-center justify-center">
            <Type className="w-5 h-5 text-[#780029]" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Tamaño de letra</h2>
            <p className="text-xs text-gray-500">Escala todo el texto de la interfaz</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {fontSizeOptions.map((opt) => {
            const active = settings.fontSize === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateSettings({ fontSize: opt.value })}
                className={`relative p-4 rounded-lg border-2 transition ${
                  active
                    ? 'border-[#780029] bg-[#780029]/5'
                    : 'border-gray-200 hover:border-[#A6002E]/50 hover:bg-gray-50'
                }`}
              >
                {active && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-[#780029] rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <span
                  className={`font-bold block mb-1 ${opt.sample} ${
                    active ? 'text-[#780029]' : 'text-gray-800'
                  }`}
                >
                  Aa
                </span>
                <p
                  className={`text-xs font-medium ${
                    active ? 'text-[#780029]' : 'text-gray-600'
                  }`}
                >
                  {opt.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* VISTA PREVIA */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3">Vista previa</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-blue">Ejemplo</span>
            <span className="badge badge-green">Activo</span>
            <span className="badge badge-yellow">Pendiente</span>
            <span className="badge badge-red">Baja</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary">Botón primario</button>
            <button className="btn-ghost border border-gray-300">Botón secundario</button>
          </div>
          <p className="text-sm text-gray-600">
            Este es un texto de ejemplo para que puedas ver cómo se ve la interfaz con
            el tamaño y los colores actuales. Cambia los ajustes arriba y comprueba el
            resultado en tiempo real.
          </p>
          <div className="flex gap-2">
            <input className="input max-w-xs" placeholder="Campo de texto de ejemplo" />
          </div>
        </div>
      </div>

      {/* RESET */}
      <div className="card flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-semibold text-gray-800">Restablecer ajustes</p>
          <p className="text-xs text-gray-500">
            Volver a la configuración por defecto
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm('¿Restablecer todos los ajustes a los valores por defecto?')) {
              resetSettings();
            }
          }}
          className="btn-ghost border border-gray-300 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Restablecer
        </button>
      </div>

      <p className="text-[11px] text-center text-gray-400 flex items-center justify-center gap-1">
        <SettingsIcon className="w-3 h-3" />
        Tus ajustes se guardan en tu cuenta y se aplican automáticamente en todos tus dispositivos.
      </p>
    </div>
  );
}