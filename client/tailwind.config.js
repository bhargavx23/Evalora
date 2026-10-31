/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5288B8',
          primary: '#5288B8',
          dark: '#3C648E',
          accent: '#D98768',
          soft: '#EAF1F9',
          light: '#EAF1F9',
          border: '#D9E2EF',
        },
        border: {
          subtle: '#E0E5EF',
        },
        surface: {
          neutral: '#F7F8FC',
        },
        text: {
          primary: '#3C4B63',
          secondary: '#526178',
          muted: '#748199',
        },
        status: {
          success: '#4C765D',
          successSoft: '#E5F2EB',
          successBorder: '#C6DFD2',
          danger: '#A36162',
          dangerSoft: '#F8EDEF',
          dangerBorder: '#EACBC4',
          warning: '#8A7047',
          warningSoft: '#F8F3E8',
          warningBorder: '#E9DAB5',
        },
        evalora: {
          bg: '#F7F8FC',
          surface: '#FFFFFF',
          subtle: '#EFF2F8',
          text: '#3C4B63',
          muted: '#748199',
          border: '#E0E5EF',
        },
        pastel: {
          bg: '#F7F8FC',
          primary: '#EAF1F9',
          secondary: '#F0EDFA',
          accent: '#E7F3ED',
          warm: '#FAEEE8',
          warning: '#FAF3E3',
          danger: '#F9EAE8',
          text: '#3C4B63',
          muted: '#748199',
          border: '#E0E5EF',
          surface: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      }
    },
  },
  plugins: [],
}
