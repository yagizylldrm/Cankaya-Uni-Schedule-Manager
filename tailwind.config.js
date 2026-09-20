/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cankaya: {
          blue: '#002855',
          navy: '#001a38',
          gold: '#d49a17',
          goldLight: '#f5b024',
          accent: '#0284c7',
        },
        dark: {
          bg: '#181825',
          surface: '#1e1e2e',
          card: '#24273a',
          border: '#313244',
          text: '#cdd6f4',
          subtext: '#a6adc8',
        }
      }
    },
  },
  plugins: [],
}
