import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Verifica la regla de capas de eslint.config.js lintando fragmentos de código
 * como si estuvieran en cada capa (docs/plan_fase1.md §5).
 */
const eslint = new ESLint();

async function violations(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter(
    (m) => m.ruleId === 'no-restricted-imports' || m.ruleId === 'no-restricted-globals',
  );
}

const forbidden: [string, string, string][] = [
  // theory
  ['theory', 'src/theory/core/x.ts', "import { useState } from 'react';"],
  ['theory', 'src/theory/core/x.ts', "import { createRoot } from 'react-dom/client';"],
  ['theory', 'src/theory/core/x.ts', "import { create } from 'zustand';"],
  ['theory', 'src/theory/core/x.ts', "import { s } from '../../state/sandbox/store';"],
  ['theory', 'src/theory/core/x.ts', "import { App } from '../../ui/App';"],
  ['theory', 'src/theory/core/x.ts', "import { e } from '../../audio/engine';"],
  ['theory', 'src/theory/core/x.ts', 'export const w = window.innerWidth;'],
  ['theory', 'src/theory/core/x.ts', "export const el = document.createElement('div');"],
  // state
  ['state', 'src/state/sandbox/x.ts', "import { e } from '../../audio/engine';"],
  ['state', 'src/state/sandbox/x.ts', "import { App } from '../../ui/App';"],
  ['state', 'src/state/sandbox/x.ts', "import { useState } from 'react';"],
  ['state', 'src/state/sandbox/x.ts', "import { Note } from 'tonal';"],
  // audio
  ['audio', 'src/audio/x.ts', "import { s } from '../state/sandbox/store';"],
  ['audio', 'src/audio/x.ts', "import { App } from '../ui/App';"],
  // ui
  ['ui', 'src/ui/panels/x.ts', "import { Note } from 'tonal';"],
  ['ui', 'src/ui/panels/x.ts', "import { Note } from '@tonaljs/note';"],
];

const allowed: [string, string, string][] = [
  ['theory', 'src/theory/analysis/x.ts', "import { a } from '../core/pitch';"],
  ['state', 'src/state/sandbox/x.ts', "import { create } from 'zustand';"],
  ['state', 'src/state/sandbox/x.ts', "import { a } from '../../theory';"],
  ['audio', 'src/audio/x.ts', "import { a } from '../theory';"],
  ['ui', 'src/ui/panels/x.tsx', "import { useState } from 'react';"],
  ['ui', 'src/ui/panels/x.ts', "import { a } from '../../state/sandbox/store';"],
  ['ui', 'src/ui/panels/x.ts', "import { a } from '../../theory';"],
  ['ui', 'src/ui/panels/x.ts', "import { a } from '../../audio/playback';"],
];

describe('regla de capas', () => {
  it.each(forbidden)('[%s] prohíbe: %s → %s', async (_layer, file, code) => {
    expect(await violations(file, code)).not.toHaveLength(0);
  });

  it.each(allowed)('[%s] permite: %s → %s', async (_layer, file, code) => {
    expect(await violations(file, code)).toHaveLength(0);
  });

  it('el código real de src/ cumple la regla', async () => {
    const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
    const bad = results.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId?.startsWith('no-restricted-'))
        .map((m) => `${r.filePath}: ${m.message}`),
    );
    expect(bad).toEqual([]);
  });
});
