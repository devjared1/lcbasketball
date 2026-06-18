/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        court: {
          wood: '#e7c993',
          line: '#1c1614',
        },
        ink: {
          900: '#0d0f13',
          800: '#14171d',
          700: '#1c2129',
          600: '#2a313c',
          500: '#3b4452',
        },
        chalk: '#eef2f6',
        rim: '#e8743b',
        away: '#e8743b',
        home: '#37b6c4',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
