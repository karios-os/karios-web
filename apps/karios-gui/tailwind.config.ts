export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', '../../libs/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'karios-blue': 'var(--karios-blue)',
        'karios-green': 'var(--karios-green)',
        'karios-hover': 'var(--karios-hover)',
      },
    },
  },
  plugins: [],
  // Add custom utility classes
  corePlugins: {
    // ...
  },
  variants: {
    extend: {
      // ...
    },
  },
  // Add custom utility classes via CSS
  // These will be added to Tailwind's utilities layer
  css: {
    // Add custom utility classes for scrollbar hiding
    '.no-scrollbar::-webkit-scrollbar': {
      display: 'none',
    },
    '.no-scrollbar': {
      '-ms-overflow-style': 'none',
      'scrollbar-width': 'none',
    },
  },
};
