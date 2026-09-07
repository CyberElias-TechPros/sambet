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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.04), 0 2px 8px rgba(28,25,23,0.05)',
        pop: '0 4px 16px rgba(28,25,23,0.10), 0 1px 3px rgba(28,25,23,0.08)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.97)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out both',
        'slide-in-right': 'slide-in-right 0.22s ease-out both',
        'scale-in': 'scale-in 0.16s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
