import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        spotify: {
          400: '#1ed760',
          500: '#1db954'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
