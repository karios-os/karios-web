export default {
  content: ['./apps/**/index.html', './apps/**/*.{js,jsx,ts,tsx}', './libs/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'karios-blue': 'var(--karios-blue)',
        'karios-green': 'var(--karios-green)',
      },
      borderColor: {
        'karios-blue': 'var(--karios-blue)',
        'karios-green': 'var(--karios-green)',
      },
      textColor: {
        'karios-blue': 'var(--karios-blue)',
        'karios-green': 'var(--karios-green)',
      },
    },
  },
  plugins: [],
};
