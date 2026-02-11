/** @type { import('tailwindcss').Config } */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ray: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#f9d7ac',
          300: '#f5ba77',
          400: '#ef9240',
          500: '#eb751a',
          600: '#dc5b10',
          700: '#b64410',
          800: '#913615',
          900: '#752f14',
          950: '#3f1508',
        },
        groove: {
          950: '#0a0a0f',
          900: '#12121a',
          800: '#1a1a26',
          700: '#252533',
          600: '#35354a',
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
