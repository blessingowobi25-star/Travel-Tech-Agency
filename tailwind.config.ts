import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#142B3D',
          50: '#F2F5F7',
          100: '#E1E8ED',
          200: '#C2D0DA',
          300: '#93AABB',
          400: '#5D7C94',
          500: '#3B5A72',
          600: '#2A4458',
          700: '#1F3648',
          800: '#142B3D',
          900: '#0D1E2C',
        },
        teal: {
          DEFAULT: '#167C80',
          50: '#EDF7F7',
          100: '#D4EDEE',
          200: '#A9DBDD',
          300: '#6FC2C5',
          400: '#3FA4A8',
          500: '#167C80',
          600: '#11666A',
          700: '#0F5256',
          800: '#0E4346',
          900: '#0D383A',
        },
        ivory: '#F7F4EE',
        coral: {
          DEFAULT: '#E58B72',
          100: '#FCEDE8',
          300: '#F1B9A7',
          500: '#E58B72',
          700: '#B9614C',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 43, 61, 0.06), 0 8px 24px -12px rgba(20, 43, 61, 0.18)',
        lift: '0 12px 32px -16px rgba(20, 43, 61, 0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
