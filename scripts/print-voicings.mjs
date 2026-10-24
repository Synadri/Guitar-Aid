import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const parentDir = dirname(fileURLToPath(context.parentURL));
      const base = resolvePath(parentDir, specifier);
      for (const candidate of [`${base}.ts`, resolvePath(base, 'index.ts')]) {
        if (existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  CHORD_QUALITIES,
  formatChordName,
  formatVoicingLine,
  formatVoicingsAsTab,
  generateVoicingsMarkdown,
  parseChordSymbol,
  voicingsForChord,
} = await import('../src/theory/index.ts');

const rootDir = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const docsFile = resolvePath(rootDir, 'docs/voicings.md');

mkdirSync(dirname(docsFile), { recursive: true });
writeFileSync(docsFile, generateVoicingsMarkdown(), 'utf8');

const args = process.argv.slice(2).filter((arg) => arg !== '--');

if (args.length > 0) {
  for (const rawChord of args) {
    const parsed = parseChordSymbol(rawChord);
    if (!parsed) {
      console.error(`Acorde no reconocido: "${rawChord}"`);
      process.exitCode = 1;
      continue;
    }
    const voicings = voicingsForChord(parsed.root, parsed.quality);
    for (const v of voicings) {
      console.log(formatVoicingLine(v, parsed.mode));
    }
    console.log('');
    console.log(formatVoicingsAsTab(voicings));
  }
} else {
  for (const quality of CHORD_QUALITIES) {
    for (let r = 0; r < 12; r++) {
      const chordName = formatChordName(r, quality.id);
      const voicings = voicingsForChord(r, quality.id);
      console.log(`# ${chordName}`);
      for (const v of voicings) {
        console.log(formatVoicingLine(v));
      }
      console.log(formatVoicingsAsTab(voicings));
      console.log('');
    }
  }
  console.log(`Generado: docs/voicings.md`);
}
