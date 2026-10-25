// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTuning, STANDARD_TUNING } from '../../theory';
import type { FretMark, KeyMark, MarkRole } from '../../state';
import { Fretboard, Piano } from './index';

afterEach(() => {
  cleanup();
});

describe('Fretboard (componente puro)', () => {
  it('renderiza 6 × 25 = 150 posiciones interactivas por defecto (trastes 0..24)', () => {
    render(<Fretboard tuning={STANDARD_TUNING} />);
    const group = screen.getByRole('group', { name: 'Mástil de guitarra' });
    const positions = within(group).getAllByRole('button');
    expect(positions).toHaveLength(6 * 25);
  });

  it('el aria-label de la posición (5, 7) en afinación estándar contiene E3', () => {
    render(<Fretboard tuning={STANDARD_TUNING} />);
    const pos = screen.getByRole('button', { name: /Cuerda 5, traste 7, E3/ });
    expect(pos.getAttribute('aria-label')).toBe('Cuerda 5, traste 7, E3');
    expect(pos.getAttribute('aria-label')).toContain('E3');
  });

  it('dispara onPositionClick con { string: 5, fret: 7 } al hacer clic, pulsar Enter o Espacio', () => {
    const onPositionClick = vi.fn();
    render(<Fretboard tuning={STANDARD_TUNING} onPositionClick={onPositionClick} />);

    const pos = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });

    fireEvent.click(pos);
    expect(onPositionClick).toHaveBeenCalledTimes(1);
    expect(onPositionClick).toHaveBeenLastCalledWith({ string: 5, fret: 7 });

    fireEvent.keyDown(pos, { key: 'Enter' });
    expect(onPositionClick).toHaveBeenCalledTimes(2);
    expect(onPositionClick).toHaveBeenLastCalledWith({ string: 5, fret: 7 });

    fireEvent.keyDown(pos, { key: ' ' });
    expect(onPositionClick).toHaveBeenCalledTimes(3);
    expect(onPositionClick).toHaveBeenLastCalledWith({ string: 5, fret: 7 });
  });

  it('muestra los nombres de afinación junto a la cejuela y en Drop D la cuerda 6 es D', () => {
    const dropD = getTuning('dropD')!;
    const { container, rerender } = render(<Fretboard tuning={STANDARD_TUNING} />);

    const stdString6 = container.querySelector('[data-tuning-string="6"]');
    expect(stdString6?.textContent).toBe('E');

    rerender(<Fretboard tuning={dropD} />);
    const dropString6 = container.querySelector('[data-tuning-string="6"]');
    const dropString1 = container.querySelector('[data-tuning-string="1"]');
    expect(dropString6?.textContent).toBe('D');
    expect(dropString1?.textContent).toBe('E');
  });

  it('ordena la cuerda 1 arriba y la 6 abajo con mayor grosor en las cuerdas graves, e incluye inlays simples y dobles', () => {
    const { container } = render(<Fretboard tuning={STANDARD_TUNING} />);
    const line1 = container.querySelector('[data-string-line="1"]')!;
    const line6 = container.querySelector('[data-string-line="6"]')!;

    const y1 = Number(line1.getAttribute('y1'));
    const y6 = Number(line6.getAttribute('y1'));
    expect(y1).toBeLessThan(y6);

    const w1 = Number(line1.getAttribute('stroke-width'));
    const w6 = Number(line6.getAttribute('stroke-width'));
    expect(w6).toBeGreaterThan(w1);

    for (const fret of [3, 5, 7, 9, 15, 17, 19, 21]) {
      const inlay = container.querySelector(`[data-inlay-fret="${fret}"]`);
      expect(inlay).not.toBeNull();
    }
    for (const fret of [12, 24]) {
      const doubleInlay = container.querySelector(`[data-inlay-fret="${fret}"]`);
      expect(doubleInlay?.querySelectorAll('circle')).toHaveLength(2);
    }
  });

  it('con leftHanded cambia la orientación (data-mirrored) y refleja la cejuela sin alterar los eventos ni el orden vertical', () => {
    const onPositionClick = vi.fn();
    const { container, rerender } = render(
      <Fretboard tuning={STANDARD_TUNING} leftHanded={false} onPositionClick={onPositionClick} />,
    );

    const wrapper = screen.getByTestId('fretboard');
    const nutRightHandedX = Number(screen.getByTestId('fretboard-nut').getAttribute('x'));
    expect(wrapper.getAttribute('data-mirrored')).toBe('false');

    rerender(
      <Fretboard tuning={STANDARD_TUNING} leftHanded={true} onPositionClick={onPositionClick} />,
    );

    expect(wrapper.getAttribute('data-mirrored')).toBe('true');
    const nutLeftHandedX = Number(screen.getByTestId('fretboard-nut').getAttribute('x'));
    expect(nutLeftHandedX).toBeGreaterThan(nutRightHandedX);

    // El orden vertical de las cuerdas no cambia (1 arriba, 6 abajo)
    const line1 = container.querySelector('[data-string-line="1"]')!;
    const line6 = container.querySelector('[data-string-line="6"]')!;
    expect(Number(line1.getAttribute('y1'))).toBeLessThan(Number(line6.getAttribute('y1')));

    // Los eventos siguen enviando exactamente los mismos datos
    const pos = screen.getByRole('button', { name: 'Cuerda 5, traste 7, E3' });
    fireEvent.click(pos);
    expect(onPositionClick).toHaveBeenCalledWith({ string: 5, fret: 7 });
    fireEvent.keyDown(pos, { key: 'Enter' });
    expect(onPositionClick).toHaveBeenLastCalledWith({ string: 5, fret: 7 });
  });

  it('cada rol de marca produce un elemento distinguible por data-role, clase y geometría, y muestra su label', () => {
    const roles: MarkRole[] = ['pinned', 'equivalent', 'tone', 'root', 'preview'];
    const marks: FretMark[] = roles.map((role, index) => ({
      string: (index + 1) as 1 | 2 | 3 | 4 | 5,
      fret: index + 1,
      role,
      label: `L-${role}`,
    }));

    const { container } = render(<Fretboard tuning={STANDARD_TUNING} marks={marks} />);

    const seenClassNames = new Set<string>();
    for (const mark of marks) {
      const posEl = container.querySelector(
        `[data-string="${mark.string}"][data-fret="${mark.fret}"]`,
      )!;
      expect(posEl.getAttribute('data-role')).toBe(mark.role);
      expect(posEl.textContent).toBe(mark.label);

      const classAttr = posEl.getAttribute('class') ?? '';
      seenClassNames.add(classAttr);

      const markGroup = posEl.querySelector(`[data-mark-role="${mark.role}"]`)!;
      expect(markGroup).not.toBeNull();
    }

    // Las 5 clases de los 5 roles son distintas entre sí
    expect(seenClassNames.size).toBe(roles.length);

    // root tiene doble anillo (2 círculos) y preview tiene borde punteado
    const rootMark = container.querySelector('[data-mark-role="root"]')!;
    expect(rootMark.querySelectorAll('circle')).toHaveLength(2);

    const previewCircle = container.querySelector('[data-mark-role="preview"] circle')!;
    expect(previewCircle.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});

describe('Piano (componente puro)', () => {
  it('renderiza 61 teclas por defecto (C2–C7: 36 blancas y 25 negras) y etiqueta cada Do (C2..C7)', () => {
    const { container } = render(<Piano />);
    const group = screen.getByRole('group', { name: 'Teclado de piano' });
    const keys = within(group).getAllByRole('button');
    expect(keys).toHaveLength(61);

    const whiteKeys = container.querySelectorAll('[data-key-type="white"]');
    const blackKeys = container.querySelectorAll('[data-key-type="black"]');
    expect(whiteKeys).toHaveLength(36);
    expect(blackKeys).toHaveLength(25);

    for (const cLabel of ['C2', 'C3', 'C4', 'C5', 'C6', 'C7']) {
      const labelEl = container.querySelector(`[data-octave-label="${cLabel}"]`);
      expect(labelEl?.textContent).toBe(cLabel);
    }
  });

  it('dispara onKeyClick con el MIDI correcto (E3 = 52) al hacer clic, pulsar Enter o Espacio', () => {
    const onKeyClick = vi.fn();
    render(<Piano onKeyClick={onKeyClick} />);

    const keyE3 = screen.getByRole('button', { name: 'E3' });

    fireEvent.click(keyE3);
    expect(onKeyClick).toHaveBeenCalledTimes(1);
    expect(onKeyClick).toHaveBeenLastCalledWith(52);

    fireEvent.keyDown(keyE3, { key: 'Enter' });
    expect(onKeyClick).toHaveBeenCalledTimes(2);
    expect(onKeyClick).toHaveBeenLastCalledWith(52);

    fireEvent.keyDown(keyE3, { key: ' ' });
    expect(onKeyClick).toHaveBeenCalledTimes(3);
    expect(onKeyClick).toHaveBeenLastCalledWith(52);
  });

  it('cada rol de marca en el piano produce un elemento distinguible y muestra su label', () => {
    const roles: MarkRole[] = ['pinned', 'equivalent', 'tone', 'root', 'preview'];
    const marks: KeyMark[] = roles.map((role, idx) => ({
      midi: 60 + idx,
      role,
      label: `K-${role}`,
    }));

    const { container } = render(<Piano marks={marks} />);

    for (const mark of marks) {
      const keyEl = container.querySelector(`[data-midi="${mark.midi}"]`)!;
      expect(keyEl.getAttribute('data-role')).toBe(mark.role);
      expect(keyEl.textContent).toContain(mark.label);
    }
  });
});
