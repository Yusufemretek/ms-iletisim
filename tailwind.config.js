/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme: ink = background grays (dark→light reversed)
        ink: {
          950: '#F8FAFC',  // page background (very light gray)
          900: '#FFFFFF',  // card white
          850: '#FFFFFF',
          800: '#FFFFFF',  // primary card bg
          750: '#F1F5F9',
          700: '#F1F5F9',  // light gray sections
          650: '#E8EDF2',
          600: '#E2E8F0',
          500: '#CBD5E1',
          400: '#94A3B8',
        },
        electric: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#3b82f6',
          500: '#2563eb',  // primary blue
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
          DEFAULT: '#2563eb',
        },
        silver: {
          50: '#1E293B',   // dark text (was light)
          100: '#334155',  // heading text
          200: '#475569',  // body text
          300: '#64748B',  // secondary text
          400: '#94A3B8',  // muted text
          500: '#CBD5E1',  // light muted
          600: '#E2E8F0',  // borders light
          700: '#F1F5F9',  // light bg
          800: '#F8FAFC',  // very light bg
          900: '#FFFFFF',  // white
          DEFAULT: '#64748B',
        },
        // slate alias → maps to light theme
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        // Restore white/black to actual values
        white: '#FFFFFF',
        black: '#000000',
        // Light status backgrounds
        red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d' },
        emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
        amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
        blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e3a8a', 900: '#172554' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(37, 99, 235, 0.15)' },
          '100%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)' },
        },
      },
    },
  },
  plugins: [],
};
