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
          DEFAULT: '#007AFF',
          primary: '#007AFF',
          dark: '#0056CC',
          accent: '#007AFF',
          soft: '#E5F1FF',
          light: '#E5F1FF',
          border: '#D2D2D7',
        },
        border: {
          subtle: '#D2D2D7',
        },
        surface: {
          neutral: '#F5F5F7',
        },
        text: {
          primary: '#1D1D1F',
          secondary: '#424245',
          muted: '#6E6E73',
        },
        status: {
          success: '#248A3D',
          successSoft: '#E8F7EC',
          successBorder: '#B7E4C2',
          danger: '#D70015',
          dangerSoft: '#FFF0F0',
          dangerBorder: '#FFC7C7',
          warning: '#9A6700',
          warningSoft: '#FFF5D6',
          warningBorder: '#F2D675',
        },
        evalora: {
          bg: '#F5F5F7',
          surface: '#FFFFFF',
          subtle: '#F5F5F7',
          text: '#1D1D1F',
          muted: '#6E6E73',
          border: '#D2D2D7',
        },
        pastel: {
          bg: '#F5F5F7',
          primary: '#E5F1FF',
          secondary: '#F5F0FA',
          accent: '#E7F3ED',
          warm: '#FAEEE8',
          warning: '#FAF3E3',
          danger: '#F9EAE8',
          text: '#1D1D1F',
          muted: '#6E6E73',
          border: '#D2D2D7',
          surface: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      }
    },
  },
  plugins: [],
}
