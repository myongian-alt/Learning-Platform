/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#1a1a2e',
        paper: '#fbfaf7',
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b3ccff',
          300: '#80a8ff',
          400: '#4d7fff',
          500: '#2b5cf0',
          600: '#1e44c4',
          700: '#183699',
          800: '#152a74',
          900: '#101f57',
        },
      },
    },
  },
  plugins: [],
};
