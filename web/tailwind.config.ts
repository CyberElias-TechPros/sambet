import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F6F2',
        ink: {
          DEFAULT: '#1C1917',
          soft: '#57534E',
          faint: '#A8A29E',
        },
        leaf: {
          50: '#EEF7F2',
          100: '#D8EFE3',
          200: '#B2DFC9',
          300: '#82C7A8',
          400: '#4FAB84',
          500: '#2E8C65',
          600: '#1F7350',
          700: '#195D42',
          800: '#154B36',
          900: '#113C2C',
          950: '#0A251B',
        },
        bark: {
          800: '#12271D',
          900: '#0D1E16',
          950: '#081510',
        },
        gold: {
          100: '#F8EEDC',
          200: '#F0DFBC',
          300: '#E4BE66',
          400: '#D9A441',
          500: '#C4923A',
          600: '#A87A2F',
          700: '#8A6426',
        },
      },
      spacing: {
        // Fractional steps used across the design system (not in Tailwind's
        // default scale — without these, classes like `h-9.5` silently no-op).
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '8.5': '2.125rem',
        '9.5': '2.375rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.04), 0 2px 8px rgba(28,25,23,0.05)',
        'card-hover': '0 2px 4px rgba(28,25,23,0.05), 0 12px 28px rgba(28,25,23,0.09)',
        pop: '0 4px 16px rgba(28,25,23,0.10), 0 1px 3px rgba(28,25,23,0.08)',
        glow: '0 0 0 1px rgba(46,140,101,0.06), 0 16px 48px -12px rgba(13,30,22,0.22)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.97)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-in-right': 'slide-in-right 0.22s ease-out both',
        'scale-in': 'scale-in 0.16s ease-out both',
        float: 'float 5.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
