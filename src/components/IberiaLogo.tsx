interface IberiaLogoProps {
  className?: string;
  /** Altura del logo en píxeles. El ancho se calcula proporcionalmente */
  height?: number;
  /** 'color' = rojo+amarillo sobre fondo claro · 'white' = todo blanco sobre fondo oscuro */
  variant?: 'color' | 'white';
  /** 'full' = con texto IBERIA MANTENIMIENTO · 'icon' = solo el pájaro */
  layout?: 'full' | 'icon';
}

/**
 * Logo de Iberia Mantenimiento en SVG.
 *
 * - variant="color": rojo + amarillo (para fondos claros y PDFs)
 * - variant="white": todo blanco (para la cabecera sobre fondo rojo)
 * - layout="full": texto IBERIA MANTENIMIENTO + pájaro
 * - layout="icon": solo el pájaro (para espacios reducidos)
 */
export function IberiaLogo({
  className = '',
  height = 40,
  variant = 'color',
  layout = 'full',
}: IberiaLogoProps) {
  // Paleta Iberia
  const red = variant === 'white' ? '#ffffff' : '#E4002B';
  const yellow = variant === 'white' ? '#ffffff' : '#F9C700';
  const textColor = variant === 'white' ? '#ffffff' : '#E4002B';

  // Relación de aspecto del logo completo: ~3.6:1
  const width = layout === 'full' ? height * 3.6 : height;

  if (layout === 'icon') {
    // Solo el pájaro
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        height={height}
        width={height}
        className={className}
        aria-label="Iberia Mantenimiento"
      >
        {/* Ala amarilla (superior) */}
        <path
          d="M 62 22
             Q 78 24 88 38
             Q 82 32 70 32
             Q 66 32 62 34
             Q 66 28 62 22 Z"
          fill={yellow}
        />
        {/* Ala roja (inferior, más grande) */}
        <path
          d="M 60 40
             Q 78 42 90 60
             Q 84 58 72 58
             Q 60 58 52 66
             Q 44 74 40 86
             Q 42 70 50 56
             Q 56 46 60 40 Z"
          fill={red}
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 100"
      height={height}
      width={width}
      className={className}
      aria-label="Iberia Mantenimiento"
    >
      {/* ===== TEXTO IBERIA ===== */}
      <text
        x="0"
        y="48"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="46"
        fontWeight="900"
        letterSpacing="1"
        fill={textColor}
      >
        IBERIA
      </text>

      {/* ===== TEXTO MANTENIMIENTO ===== */}
      <text
        x="2"
        y="78"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="20"
        fontWeight="700"
        letterSpacing="1"
        fill={textColor}
      >
        MANTENIMIENTO
      </text>

      {/* ===== PÁJARO IBÉRICO ===== */}
      {/* Ala amarilla (superior) */}
      <path
        d="M 262 14
           Q 288 16 316 34
           Q 300 28 282 28
           Q 272 28 262 32
           Q 268 24 262 14 Z"
        fill={yellow}
      />

      {/* Ala roja (inferior, más grande) */}
      <path
        d="M 258 40
           Q 296 42 330 68
           Q 314 62 292 62
           Q 268 62 252 76
           Q 236 90 228 92
           Q 234 72 244 56
           Q 250 46 258 40 Z"
        fill={red}
      />
    </svg>
  );
}