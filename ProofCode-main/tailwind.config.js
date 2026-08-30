/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: '#FDFBF7',
          100: '#F7F3E9',
          200: '#ECE3CE',
          300: '#DCCB9E',
          400: '#C5AC6D',
          500: '#B08E41',
          600: '#94702E',
          700: '#755423',
          800: '#5F4322',
          900: '#4F3820',
          950: '#2A1A0E',
        },
        gold: {
          50: '#FFFDF0',
          100: '#FFFBE1',
          200: '#FFF5B8',
          300: '#FFEA85',
          400: '#FFD948',
          500: '#D97706', // Brand accent amber/gold
          600: '#B45309',
          700: '#92400E',
          800: '#78350F',
          900: '#451A03',
        },
        severity: {
          critical: '#DC2626', // Red
          high: '#EA580C',     // Orange
          medium: '#D97706',   // Amber
          low: '#2563EB',      // Blue
        },
        verified: {
          DEFAULT: '#16A34A',  // Strictly for success/verified
          light: '#DCFCE7',
          dark: '#14532D',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
