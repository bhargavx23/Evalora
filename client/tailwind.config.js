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
          DEFAULT: '#5B5CE2',
          primary: '#5B5CE2',
          dark: '#34358F',
          accent: '#7C6FF2',
          soft: '#EEF0FF',
          light: '#EEF0FF',
          border: '#D6DAFF',
        },
        border: {
          subtle: '#E8E8EF',
        },
        surface: {
          neutral: '#F7F7FB',
        },
        evalora: {
          bg: '#F7F7FB',
          surface: '#FFFFFF',
          subtle: '#F1F2F8',
          text: '#18181F',
          muted: '#6B6B78',
          border: '#E8E8EF',
        },
        pastel: {
          bg: '#F7F7FB',
          primary: '#EEF0FF',
          secondary: '#F1EEFF',
          accent: '#E6F6F0',
          warm: '#FDF3EB',
          warning: '#FEF7E6',
          danger: '#FDECEC',
          text: '#18181F',
          muted: '#6B6B78',
          border: '#E8E8EF',
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
