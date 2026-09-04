import type { Config } from 'tailwindcss';

// Tokens repris tels quels des maquettes v1.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0B0F',
        card: '#14161D',
        line: '#272B36',
        ink: '#EDEFF5',
        muted: '#8A91A3',
        // Les accents ont chacun UN sens, jamais decoratif.
        money: '#6EF0A5',   // argent, validations
        time: '#C08CF5',    // temps de vente
        todo: '#F5C86E',    // demande une action
        unknown: '#F58E8E', // non reconnu
      },
      fontFamily: {
        // Repli explicite : si Google Fonts ne repond pas, l'app reste lisible.
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // Tailles de controles des maquettes.
        action: '52px',
        chip: '38px',
        icon: '40px',
      },
    },
  },
  plugins: [],
};

export default config;
