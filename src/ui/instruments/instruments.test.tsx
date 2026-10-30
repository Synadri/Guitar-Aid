// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTuning, STANDARD_TUNING } from '../../theory';
import type { FretMark, KeyMark, MarkRole } from '../../state';
import { Fretboard, Piano } from './index';

function readInstrumentCss(fileName: string): string {
  const proc = (
    globalThis as unknown as {
      process: {
        getBuiltinModule: (id: string) => { readFileSync: (p: URL, enc: string) => string };
      };
    }
  ).process;
  return proc.getBuiltinModule('node:fs').readFileSync(new URL(fileName, import.meta.url), 'utf-8');
}

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

  it('cada uno de los 6 roles de marca (incluido scale-bg) produce un elemento distinguible por data-role, clase y geometría, y soporta pinned + isRoot', () => {
    const roles: MarkRole[] = ['pinned', 'equivalent', 'tone', 'root', 'scale-bg', 'preview'];
    const marks: FretMark[] = roles.map((role, index) => ({
      string: ((index % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      fret: index + 1,
      role,
      label: `L-${role}`,
    }));
    marks.push({ string: 1, fret: 12, role: 'pinned', isRoot: true, label: 'E-root' });

    const { container } = render(<Fretboard tuning={STANDARD_TUNING} marks={marks} />);

    const seenClassNames = new Set<string>();
    for (const mark of marks.slice(0, roles.length)) {
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

    // Las 6 clases de los 6 roles son distintas entre sí
    expect(seenClassNames.size).toBe(roles.length);

    // root tiene doble anillo (2 círculos), scale-bg y preview tienen borde discontinuo y radios distintos
    const rootMark = container.querySelector('[data-mark-role="root"]')!;
    expect(rootMark.querySelectorAll('circle')).toHaveLength(2);

    const scaleBgCircle = container.querySelector('[data-mark-role="scale-bg"] circle')!;
    expect(scaleBgCircle.getAttribute('stroke-dasharray')).toBe('2 2');
    expect(Number(scaleBgCircle.getAttribute('r'))).toBe(9);

    const previewCircle = container.querySelector('[data-mark-role="preview"] circle')!;
    expect(previewCircle.getAttribute('stroke-dasharray')).toBe('3.5 2');

    // Coexistencia pinned + isRoot: tiene role 'pinned', data-is-root="true" y doble anillo interior
    const pinnedRootPos = container.querySelector('[data-string="1"][data-fret="12"]')!;
    expect(pinnedRootPos.getAttribute('data-role')).toBe('pinned');
    expect(pinnedRootPos.getAttribute('data-is-root')).toBe('true');
    expect(pinnedRootPos.querySelectorAll('circle')).toHaveLength(2);
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

  it('criterio (a) Fase 1.1: en el piano se distinguen pinned (verde), tone (azul), root (ámbar con anillo), scale-bg y preview por rol, variable CSS (claro/oscuro) y forma/borde; y pinned + isRoot conserva ambos indicadores', () => {
    const roles: MarkRole[] = ['pinned', 'equivalent', 'tone', 'root', 'scale-bg', 'preview'];
    const marks: KeyMark[] = [
      ...roles.map((role, idx) => ({
        midi: 60 + idx,
        role,
        label: `K-${role}`,
      })),
      { midi: 72, role: 'pinned', isRoot: true, label: 'C-pinned-root' },
    ];

    const { container } = render(<Piano marks={marks} />);

    const seenRoleClasses = new Set<string>();
    for (const mark of marks.slice(0, roles.length)) {
      const keyEl = container.querySelector(`[data-midi="${mark.midi}"]`)!;
      expect(keyEl.getAttribute('data-role')).toBe(mark.role);
      expect(keyEl.textContent).toContain(mark.label!);
      const markEl = keyEl.querySelector(`[data-mark-role="${mark.role}"]`)!;
      expect(markEl).not.toBeNull();
      seenRoleClasses.add(keyEl.getAttribute('class') ?? '');
    }

    // Cada rol tiene su propia clase visual
    expect(seenRoleClasses.size).toBe(roles.length);

    // root tiene anillo interior (2 círculos)
    const rootKey = container.querySelector('[data-midi="63"]')!;
    expect(rootKey.getAttribute('data-is-root')).toBe('true');
    expect(rootKey.querySelectorAll('circle')).toHaveLength(2);

    // scale-bg tiene borde punteado (stroke-dasharray="2 2") y radio reducido
    const scaleBgCircle = container.querySelector('[data-midi="64"] circle')!;
    expect(scaleBgCircle.getAttribute('stroke-dasharray')).toBe('2 2');

    // pinned + isRoot en C5 (midi 72) conserva role="pinned", data-is-root="true" y el anillo interior
    const pinnedRootKey = container.querySelector('[data-midi="72"]')!;
    expect(pinnedRootKey.getAttribute('data-role')).toBe('pinned');
    expect(pinnedRootKey.getAttribute('data-is-root')).toBe('true');
    expect(pinnedRootKey.querySelectorAll('circle')).toHaveLength(2);
    expect(pinnedRootKey.querySelector('[data-testid="root-inner-ring"]')).not.toBeNull();

    // Verificar variables CSS en modo claro y oscuro en Piano.module.css y Fretboard.module.css
    const pianoCss = readInstrumentCss('./Piano.module.css');
    const fretboardCss = readInstrumentCss('./Fretboard.module.css');
    for (const css of [pianoCss, fretboardCss]) {
      expect(css).toContain('--mark-pinned-fill: #0f766e');
      expect(css).toContain('--mark-pinned-fill: #14b8a6');
      expect(css).toContain('--mark-tone-fill: #1d4ed8');
      expect(css).toContain('--mark-tone-fill: #3b82f6');
      expect(css).toContain('--mark-root-fill: #b45309');
      expect(css).toContain('--mark-root-fill: #f59e0b');
      expect(css).toContain('--mark-scale-bg-fill: #dbeafe');
      expect(css).toContain('--mark-scale-bg-fill: #1e293b');
      expect(css).toContain('@media (prefers-color-scheme: dark)');
    }
  });

  it('Hito A6: Fretboard y Piano soportan los 4 roles de evaluación (question, wrong, missed, correct)', () => {
    const evalFretMarks: FretMark[] = [
      { string: 5, fret: 3, role: 'question', label: 'C' },
      { string: 5, fret: 5, role: 'wrong' },
      { string: 5, fret: 7, role: 'missed', label: 'M3' },
      { string: 4, fret: 2, role: 'correct', label: 'E' },
    ];

    const { container: fbContainer } = render(
      <Fretboard tuning={STANDARD_TUNING} marks={evalFretMarks} />,
    );

    // question: círculo r=12 con etiqueta en negrita
    const qPos = fbContainer.querySelector('[data-string="5"][data-fret="3"]')!;
    expect(qPos.getAttribute('data-role')).toBe('question');
    const qCircle = qPos.querySelector('[data-mark-role="question"] circle')!;
    expect(Number(qCircle.getAttribute('r'))).toBe(12);
    expect(qPos.textContent).toBe('C');

    // wrong: cuadrado redondeado (rect 22x22, rx=5) con '×'
    const wPos = fbContainer.querySelector('[data-string="5"][data-fret="5"]')!;
    expect(wPos.getAttribute('data-role')).toBe('wrong');
    const wRect = wPos.querySelector('[data-mark-role="wrong"] rect')!;
    expect(wRect).not.toBeNull();
    expect(Number(wRect.getAttribute('width'))).toBe(22);
    expect(Number(wRect.getAttribute('height'))).toBe(22);
    expect(Number(wRect.getAttribute('rx'))).toBe(5);
    expect(wPos.textContent).toBe('×');

    // missed: círculo con borde discontinuo '3.5 2.5'
    const mPos = fbContainer.querySelector('[data-string="5"][data-fret="7"]')!;
    expect(mPos.getAttribute('data-role')).toBe('missed');
    const mCircle = mPos.querySelector('[data-mark-role="missed"] circle')!;
    expect(mCircle.getAttribute('stroke-dasharray')).toBe('3.5 2.5');
    expect(mPos.textContent).toBe('M3');

    // correct: círculo con etiqueta o '✓'
    const cPos = fbContainer.querySelector('[data-string="4"][data-fret="2"]')!;
    expect(cPos.getAttribute('data-role')).toBe('correct');
    expect(cPos.textContent).toBe('E');

    // En Piano
    const evalKeyMarks: KeyMark[] = [
      { midi: 48, role: 'question', label: '1' },
      { midi: 50, role: 'wrong' },
      { midi: 52, role: 'correct' },
      { midi: 55, role: 'missed', label: '5' },
    ];

    const { container: pianoContainer } = render(<Piano marks={evalKeyMarks} />);

    const pKey48 = pianoContainer.querySelector('[data-midi="48"]')!;
    expect(pKey48.getAttribute('data-role')).toBe('question');
    const pCircle = pKey48.querySelector('[data-mark-role="question"] circle')!;
    expect(Number(pCircle.getAttribute('r'))).toBe(11);
    expect(pKey48.textContent).toContain('1');

    const pKey50 = pianoContainer.querySelector('[data-midi="50"]')!;
    expect(pKey50.getAttribute('data-role')).toBe('wrong');
    const pRect = pKey50.querySelector('[data-mark-role="wrong"] rect')!;
    expect(pRect).not.toBeNull();
    expect(pKey50.textContent).toContain('×');

    const pKey52 = pianoContainer.querySelector('[data-midi="52"]')!;
    expect(pKey52.getAttribute('data-role')).toBe('correct');
    expect(pKey52.textContent).toContain('✓');
  });

  it('Hito A6: Fretboard soporta fretRange recortando y escalando los trastes visibles', () => {
    const { container } = render(
      <Fretboard tuning={STANDARD_TUNING} fretRange={{ from: 0, to: 12 }} />,
    );
    // 6 cuerdas × 13 trastes (0..12) = 78 posiciones
    const positions = container.querySelectorAll('[data-string]');
    expect(positions).toHaveLength(6 * 13);

    // No debe contener posiciones del traste 13 en adelante
    expect(container.querySelector('[data-fret="13"]')).toBeNull();
    expect(container.querySelector('[data-fret="12"]')).not.toBeNull();
  });

  it('Hito A6: Fretboard soporta activeStrings atenuando las demás cuerdas y bloqueando clics', () => {
    const onPositionClick = vi.fn();
    const { container } = render(
      <Fretboard
        tuning={STANDARD_TUNING}
        activeStrings={new Set([5])}
        onPositionClick={onPositionClick}
      />,
    );

    // Cuerda 5 activa (tabIndex 0)
    const activePos = container.querySelector('[data-string="5"][data-fret="3"]')!;
    expect(activePos.getAttribute('tabindex')).toBe('0');
    fireEvent.click(activePos);
    expect(onPositionClick).toHaveBeenCalledWith({ string: 5, fret: 3 });

    // Cuerda 4 inactiva (tabIndex -1, opacity 0.28, pointer-events none)
    const inactivePos = container.querySelector('[data-string="4"][data-fret="2"]')!;
    expect(inactivePos.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(inactivePos);
    expect(onPositionClick).toHaveBeenCalledTimes(1); // No incrementó
  });

  it('Hito A6: Fretboard soporta showInlays=false ocultando los puntos de referencia', () => {
    const { container } = render(<Fretboard tuning={STANDARD_TUNING} showInlays={false} />);
    const inlays = container.querySelectorAll('[data-inlay-fret]');
    expect(inlays).toHaveLength(0);
  });
});
