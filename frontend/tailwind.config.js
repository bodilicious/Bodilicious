/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-red': '#3D0A05',
        'grey-beige': '#A58570',
        'grey-beige-dark': '#735D4E',
        'ruby-red': '#7F1F0E',
        'silk': '#DAC1B1',
        'indian-red': '#AC746C',
        'silk-light': '#F2EBE4',
        'silk-dark': '#C9A990',
        'b-bg': '#FAF7F4',
        'b-burgundy': '#6B1E2E',
        'b-gold': '#C9A96E',
        'b-text-primary': '#1A1A1A',
        'b-text-secondary': '#6B6B6B',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':      { transform: 'translateX(-4px)' },
          '40%':      { transform: 'translateX(4px)' },
          '60%':      { transform: 'translateX(-3px)' },
          '80%':      { transform: 'translateX(3px)' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

