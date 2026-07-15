/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7C5CFC',
          blue: '#4A9AF4',
          'purple-light': 'rgba(124,92,252,0.15)',
        },
        dark: {
          base: '#0D0D1A',
          card: '#111128',
          surface: 'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.08)',
          'border-md': 'rgba(255,255,255,0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7C5CFC, #4A9AF4)',
        'hero-glow':
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,92,252,0.3), transparent)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
};
