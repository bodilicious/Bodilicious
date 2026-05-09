/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-red': '#3D0A05',
        'grey-beige': '#A58570',
        'ruby-red': '#7F1F0E',
        'silk': '#DAC1B1',
        'indian-red': '#AC746C',
        'silk-light': '#F2EBE4',
        'silk-dark': '#C9A990',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
