/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0078d4',    // Microsoft blue
        secondary: '#50e6ff',
        success: '#10893e',
        warning: '#ffb900',
        danger: '#d13438',
      }
    }
  },
  plugins: []
};
