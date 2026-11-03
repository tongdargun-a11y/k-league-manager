/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060b18',
          900: '#0a1224',
          850: '#0e1830',
          800: '#121f3b',
          700: '#1a2a4d',
          600: '#26395f',
        },
        gold: {
          300: '#f3dc9a',
          400: '#e8c46a',
          500: '#d4a63f',
          600: '#a9822c',
        },
      },
      fontFamily: {
        sans: ['"Pretendard"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
