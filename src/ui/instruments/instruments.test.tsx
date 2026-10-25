// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTuning, STANDARD_TUNING } from '../../theory';
import type { FretMark, KeyMark, MarkRole } from '../../state';
import { Fretboard, PIANO_VERTICAL_LOW_AT_TOP, Piano } from './index';

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

  it('en vertical, Fretboard tiene 150 posiciones, cejuela arriba, cuerda 6 a la izquierda y 1 a la derecha, se refleja con leftHanded, etiquetas sin rotar y mismos datos y aria-label que en horizontal', () => {
    const onHorizontalClick = vi.fn();
    const { container: hContainer, unmount: unmountH } = render(
      <Fretboard
        tuning={STANDARD_TUNING}
        orientation="horizontal"
        onPositionClick={onHorizontalClick}
      />,
    );
    const hGroup = screen.getByRole('group', { name: 'Mástil de guitarra' });
    const hLabels = within(hGroup)
      .getAllByRole('button')
      .map((el) => el.getAttribute('aria-label'));
    fireEvent.click(within(hGroup).getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    expect(
      hContainer.querySelector('[data-testid="fretboard"]')?.getAttribute('data-orientation'),
    ).toBe('horizontal');
    unmountH();

    const onVerticalClick = vi.fn();
    const marks: FretMark[] = [
      { string: 5, fret: 7, role: 'pinned', label: 'E' },
      { string: 6, fret: 5, role: 'root', label: 'A' },
    ];
    const { container, rerender } = render(
      <Fretboard
        tuning={STANDARD_TUNING}
        orientation="vertical"
        marks={marks}
        onPositionClick={onVerticalClick}
      />,
    );

    const wrapper = screen.getByTestId('fretboard');
    expect(wrapper.getAttribute('data-orientation')).toBe('vertical');

    const vGroup = screen.getByRole('group', { name: 'Mástil de guitarra' });
    const vPositions = within(vGroup).getAllByRole('button');
    expect(vPositions).toHaveLength(150);
    expect(vPositions.map((el) => el.getAttribute('aria-label'))).toEqual(hLabels);

    // Cejuela arriba y trastes hacia abajo (traste 1 más arriba que traste 12)
    const nutY = Number(screen.getByTestId('fretboard-nut').getAttribute('y'));
    const inlay3Y = Number(container.querySelector('[data-inlay-fret="3"]')?.getAttribute('cy'));
    const inlay9Y = Number(container.querySelector('[data-inlay-fret="9"]')?.getAttribute('cy'));
    expect(nutY).toBeLessThan(inlay3Y);
    expect(inlay3Y).toBeLessThan(inlay9Y);

    // Cuerda 6 (más grave) a la izquierda y cuerda 1 (más aguda) a la derecha
    const line6 = container.querySelector('[data-string-line="6"]')!;
    const line1 = container.querySelector('[data-string-line="1"]')!;
    expect(Number(line6.getAttribute('x1'))).toBeLessThan(Number(line1.getAttribute('x1')));

    // Con leftHanded, el mástil vertical se refleja de izquierda a derecha (cuerda 1 a la izquierda y 6 a la derecha)
    rerender(
      <Fretboard
        tuning={STANDARD_TUNING}
        orientation="vertical"
        leftHanded={true}
        marks={marks}
        onPositionClick={onVerticalClick}
      />,
    );
    expect(screen.getByTestId('fretboard').getAttribute('data-mirrored')).toBe('true');
    const mirroredLine6 = container.querySelector('[data-string-line="6"]')!;
    const mirroredLine1 = container.querySelector('[data-string-line="1"]')!;
    expect(Number(mirroredLine1.getAttribute('x1'))).toBeLessThan(
      Number(mirroredLine6.getAttribute('x1')),
    );

    // Las etiquetas de texto están derechas (sin transform rotate)
    for (const textEl of Array.from(container.querySelectorAll('text'))) {
      expect(textEl.getAttribute('transform')).toBeNull();
    }

    // Clic en (5, 7) devuelve los mismos datos que en horizontal
    fireEvent.click(within(vGroup).getByRole('button', { name: 'Cuerda 5, traste 7, E3' }));
    expect(onVerticalClick).toHaveBeenCalledTimes(1);
    expect(onVerticalClick).toHaveBeenLastCalledWith(onHorizontalClick.mock.calls[0]?.[0]);
    expect(onVerticalClick).toHaveBeenLastCalledWith({ string: 5, fret: 7 });
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

  it('en vertical, Piano tiene 61 teclas como barras horizontales con agudas arriba y graves abajo (PIANO_VERTICAL_LOW_AT_TOP = false), etiquetas derechas y mismos datos (MIDI 52) y aria-label que en horizontal', () => {
    expect(PIANO_VERTICAL_LOW_AT_TOP).toBe(false);

    const onHorizontalKeyClick = vi.fn();
    const { unmount: unmountH } = render(
      <Piano orientation="horizontal" onKeyClick={onHorizontalKeyClick} />,
    );
    const hGroup = screen.getByRole('group', { name: 'Teclado de piano' });
    const hLabels = within(hGroup)
      .getAllByRole('button')
      .map((el) => el.getAttribute('aria-label'));
    fireEvent.click(within(hGroup).getByRole('button', { name: 'E3' }));
    unmountH();

    const onVerticalKeyClick = vi.fn();
    const marks: KeyMark[] = [
      { midi: 52, role: 'tone', label: 'E' },
      { midi: 57, role: 'root', label: 'A' },
    ];
    const { container } = render(
      <Piano orientation="vertical" marks={marks} onKeyClick={onVerticalKeyClick} />,
    );

    const wrapper = screen.getByTestId('piano');
    expect(wrapper.getAttribute('data-orientation')).toBe('vertical');

    const vGroup = screen.getByRole('group', { name: 'Teclado de piano' });
    const vKeys = within(vGroup).getAllByRole('button');
    expect(vKeys).toHaveLength(61);
    expect(vKeys.map((el) => el.getAttribute('aria-label'))).toEqual(hLabels);

    // Barras horizontales: las blancas son más largas (width) que altas (height) y más largas que las negras
    const whiteRectC2 = container.querySelector('[data-midi="36"] rect')!;
    const blackRectCs2 = container.querySelector('[data-midi="37"] rect')!;
    const whiteRectC7 = container.querySelector('[data-midi="96"] rect')!;

    const whiteWidth = Number(whiteRectC2.getAttribute('width'));
    const whiteHeight = Number(whiteRectC2.getAttribute('height'));
    const blackWidth = Number(blackRectCs2.getAttribute('width'));
    expect(whiteWidth).toBeGreaterThan(whiteHeight);
    expect(whiteWidth).toBeGreaterThan(blackWidth);

    // Notas agudas arriba (menor Y) y graves abajo (mayor Y)
    const yC7 = Number(whiteRectC7.getAttribute('y'));
    const yC2 = Number(whiteRectC2.getAttribute('y'));
    expect(yC7).toBeLessThan(yC2);

    // Etiquetas de texto derechas (sin rotación)
    for (const textEl of Array.from(container.querySelectorAll('text'))) {
      expect(textEl.getAttribute('transform')).toBeNull();
    }

    // Clic en E3 devuelve MIDI 52 igual que en horizontal
    fireEvent.click(within(vGroup).getByRole('button', { name: 'E3' }));
    expect(onVerticalKeyClick).toHaveBeenCalledTimes(1);
    expect(onVerticalKeyClick).toHaveBeenLastCalledWith(onHorizontalKeyClick.mock.calls[0]?.[0]);
    expect(onVerticalKeyClick).toHaveBeenLastCalledWith(52);
  });
});
