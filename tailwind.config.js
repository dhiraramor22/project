/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f2f9f5',
          100: '#e1f2e8',
          200: '#c0e3d0',
          300: '#8ac8a7',
          400: '#5cab86',
          500: '#3a916b',
          600: '#2d7a58',
          700: '#236349',
          800: '#1b4a36',
          900: '#143527',
          950: '#0d231a',
        },
        sand: {
          50: '#fbf9f3',
          100: '#f5f0e3',
          200: '#eae1c9',
          300: '#dccdaa',
          400: '#c8b184',
          500: '#b39663',
          600: '#94794c',
          700: '#725d3b',
          800: '#4f4029',
          900: '#332a1b',
        },
        clay: {
          50: '#fdf8ed',
          100: '#f9edd1',
          200: '#f2d89f',
          300: '#e8bd66',
          400: '#dda23e',
          500: '#c98a2e',
          600: '#a86d27',
          700: '#865324',
          800: '#6d4323',
          900: '#5a3820',
        },
        ink: {
          50: '#f6f7f7',
          100: '#e9eceb',
          200: '#d5dad7',
          300: '#b3beb8',
          400: '#8a9a91',
          500: '#677a70',
          600: '#516159',
          700: '#424e48',
          800: '#37403b',
          900: '#2c332f',
          950: '#181d1a',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Inter', 'Tahoma', 'Arial', 'sans-serif'],
        arabic: ['Tahoma', '"Segoe UI"', 'Arial', 'sans-serif'],
        display: ['Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 36, 27, 0.04), 0 4px 14px rgba(16, 36, 27, 0.04)',
        pop: '0 12px 40px rgba(13, 35, 26, 0.18)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-in': 'slide-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};
