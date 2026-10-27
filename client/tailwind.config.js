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
          DEFAULT: '#7779C5',
          primary: '#7779C5',
          dark: '#555780',
          accent: '#9691CC',
          soft: '#F0EFF9',
          light: '#F0EFF9',
          border: '#DEDDF0',
        },
        border: {
          subtle: '#E9E7F0',
        },
        surface: {
          neutral: '#F8F7FC',
        },
        evalora: {
          bg: '#F8F7FC',
          surface: '#FFFFFF',
          subtle: '#F1F2F8',
          text: '#49465B',
          muted: '#777486',
          border: '#E9E7F0',
        },
        pastel: {
          bg: '#F8F7FC',
          primary: '#F0EFF9',
          secondary: '#F1EEFF',
          accent: '#E6F6F0',
          warm: '#FDF3EB',
          warning: '#FEF7E6',
          danger: '#FDECEC',
          text: '#49465B',
          muted: '#777486',
          border: '#E9E7F0',
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
