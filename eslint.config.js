import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Regla de capas (docs/plan_fase1.md §5):
 *  - theory: TS puro. No importa React, DOM ni state/ui/audio.
 *  - state:  solo importa theory (más librerías de estado como zustand).
 *  - audio:  no importa state ni ui.
 *  - ui:     no importa `tonal` directamente (pasa siempre por theory).
 * `tonal` solo puede usarse dentro de theory.
 */
const REACT = ['react', 'react/*', 'react-dom', 'react-dom/*', '@testing-library/*'];
const TONAL = ['tonal', '@tonaljs/*'];
// Coincide con rutas relativas o alias que apunten a una capa: ../state, ../../ui/App, @/audio…
const layer = (name) => `(^|/)${name}(/|$)`;

const restrict = ({ names = [], layers = [], message }) => ({
  'no-restricted-imports': [
    'error',
    {
      paths: names.map((name) => ({ name, message })),
      patterns: [
        { group: names.filter((n) => n.endsWith('/*')), message },
        ...layers.map((l) => ({ regex: layer(l), message })),
      ].filter((p) => p.group?.length !== 0),
    },
  ],
});

// Globales de navegador que theory no puede tocar.
const DOM_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'location',
  'history',
  'HTMLElement',
  'SVGElement',
  'Element',
  'Node',
  'Event',
  'AudioContext',
  'requestAnimationFrame',
  'fetch',
].map((name) => ({ name, message: 'theory es TS puro: no puede usar el DOM.' }));

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules']),
  ...tseslint.configs.recommended,
  {
    files: ['src/theory/**/*.{ts,tsx}'],
    rules: {
      ...restrict({
        names: [...REACT, 'zustand', 'zustand/*'],
        layers: ['state', 'ui', 'audio'],
        message: 'Capa theory: no puede importar React, DOM ni state/ui/audio.',
      }),
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
    },
  },
  {
    // theory sí puede usar `tonal`, por eso se vuelve a declarar sin él.
    files: ['src/state/**/*.{ts,tsx}'],
    rules: restrict({
      names: [...REACT, ...TONAL],
      layers: ['ui', 'audio'],
      message: 'Capa state: solo puede importar theory.',
    }),
  },
  {
    files: ['src/audio/**/*.{ts,tsx}'],
    rules: restrict({
      names: [...TONAL],
      layers: ['state', 'ui'],
      message: 'Capa audio: no puede importar state ni ui (ni tonal directamente).',
    }),
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: restrict({
      names: [...TONAL],
      layers: [],
      message: 'Capa ui: no puede importar tonal directamente; usa theory.',
    }),
  },
]);
