/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0071CE',
          50:  '#E6F3FF',
          100: '#CCE6FF',
          200: '#99CDFF',
          500: '#0071CE',
          600: '#005FA8',
          700: '#004D87',
        },
        accent: '#FFC220',
      }
    }
  },
  plugins: []
}
