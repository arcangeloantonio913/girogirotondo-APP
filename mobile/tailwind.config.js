/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:    '#4169E1',
        secondary:  '#FF69B4',
        accent:     '#32CD32',
        background: '#FFFDD0',
        pink:  { DEFAULT: '#F4C2C2', light: '#FFF0F7' },
        blue:  { DEFAULT: '#A7C7E7', dark: '#4169E1' },
      },
      fontFamily: {
        nunito:  ['Nunito', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
