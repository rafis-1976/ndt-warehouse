/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        airbus: {
          // ========================================================
          // PALETA CORPORATIVA IBERIA (según manual de identidad)
          // ========================================================
          
          // Rojos Iberia
          blue:    '#790029',  // Rojo oscuro Iberia - color corporativo principal
          navy:    '#A6002E',  // Rojo Iberia medio
          sky:     '#D71920',  // Rojo Iberia brillante
          steel:   '#E4002B',  // Rojo Iberia clásico (variante)
          
          // Amarillos / Dorados Iberia
          light:   '#FCD100',  // Amarillo Iberia (acentos sobre fondo oscuro)
          yellow:  '#FBB800',  // Dorado Iberia
          orange:  '#FFA100',  // Naranja/dorado Iberia
          
          // Verde funcional (no es de Iberia, se mantiene para estados "disponible")
          green:   '#009F4D',
          lime:    '#84BD00',
          
          // Rojo de error (usa el rojo brillante Iberia)
          red:     '#D71920',
          
          // Neutros Iberia
          gray:    '#948881',  // Gris piedra Iberia
          stone:   '#C5B9AC',  // Gris claro Iberia
          cream:   '#E8E3DE',  // Beige muy claro Iberia
          
          // Colores de clasificación (mantener)
          magenta: '#DA1884',
          purple:  '#A51890',
        },
      },
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};