/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        airbus: {
          blue:    '#00205B',
          sky:     '#0085AD',
          light:   '#74D2E7',
          steel:   '#48A9C5',
          navy:    '#005670',
          green:   '#009F4D',
          lime:    '#84BD00',
          yellow:  '#EFDF00',
          orange:  '#FE5000',
          red:     '#E4002B',
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