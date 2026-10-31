/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChordDiagram } from './ChordDiagram';

describe('Hito A8 — ChordDiagram (src/ui/learn/cards/ChordDiagram.tsx)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza un SVG accesible con role="img" y aria-label', () => {
    render(
      <ChordDiagram
        frets={[-1, 3, 2, 0, 1, 0]}
        root={0}
        ariaLabel="C mayor abierto"
      />,
    );

    const svg = screen.getByRole('img', { name: 'C mayor abierto' });
    expect(svg).toBeDefined();
    expect(svg.getAttribute('viewBox')).toBe('0 0 180 190');
  });

  it('renderiza cejuela gruesa en traste base 1 para acordes abiertos', () => {
    render(<ChordDiagram frets={[-1, 3, 2, 0, 1, 0]} root={0} />);

    const nut = screen.getByTestId('chord-nut');
    expect(nut).toBeDefined();
    expect(screen.queryByTestId('chord-base-fret')).toBeNull();
  });

  it('renderiza indicador de traste inicial cuando el acorde empieza en traste > 1', () => {
    // Cejilla en traste 3 (ej. G con forma de E en traste 3: [3, 5, 5, 4, 3, 3])
    render(<ChordDiagram frets={[3, 5, 5, 4, 3, 3]} root={7} />);

    const baseFret = screen.getByTestId('chord-base-fret');
    expect(baseFret).toBeDefined();
    expect(baseFret.textContent).toBe('3fr');
    expect(screen.queryByTestId('chord-nut')).toBeNull();
  });

  it('distingue cuerdas muteadas (×) y cuerdas al aire (○)', () => {
    // Acorde D abierto: [-1, -1, 0, 2, 3, 2]
    render(<ChordDiagram frets={[-1, -1, 0, 2, 3, 2]} root={2} />);

    // Cuerdas 6 y 5 muteadas
    const mute6 = screen.getByTestId('mute-string-6');
    const mute5 = screen.getByTestId('mute-string-5');
    expect(mute6.textContent).toBe('×');
    expect(mute5.textContent).toBe('×');

    // Cuerda 4 al aire
    const open4 = screen.getByTestId('open-string-4');
    expect(open4).toBeDefined();
  });

  it('colorea en turquesa (#14b8a6) las fundamentales y en gris claro el resto', () => {
    // C mayor abierto: [-1, 3, 2, 0, 1, 0] con raíz C (0)
    // Cuerda 5, traste 3 es C (root)
    // Cuerda 4, traste 2 es E (3ª mayor)
    // Cuerda 2, traste 1 es C (root)
    render(<ChordDiagram frets={[-1, 3, 2, 0, 1, 0]} root={0} />);

    const noteC5 = screen.getByTestId('chord-note-s5-f3');
    const noteE4 = screen.getByTestId('chord-note-s4-f2');
    const noteC2 = screen.getByTestId('chord-note-s2-f1');

    expect(noteC5.getAttribute('data-is-root')).toBe('true');
    expect(noteE4.getAttribute('data-is-root')).toBe('false');
    expect(noteC2.getAttribute('data-is-root')).toBe('true');

    // Etiquetas por defecto: '1' para fundamental, '3' para 3ª mayor
    expect(noteC5.textContent).toContain('1');
    expect(noteE4.textContent).toContain('3');
    expect(noteC2.textContent).toContain('1');
  });

  it('en modo silent (anverso visual ciego) no revela los textos de grados ni notas', () => {
    render(<ChordDiagram frets={[-1, 3, 2, 0, 1, 0]} root={0} silent={true} />);

    const noteC5 = screen.getByTestId('chord-note-s5-f3');
    expect(noteC5.textContent).toBe('');
  });
});
