// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import {
  TrackMixerPopover,
  getTrackDescription,
  type TrackMixerPopoverProps,
} from './TrackMixerPopover';
import type { SongTrack } from '../../song';
import { STANDARD_TUNING, TUNINGS } from '../../theory/data/tunings';

describe('TrackMixerPopover — Rediseño del mezclador', () => {
  afterEach(() => {
    cleanup();
  });
  const sampleTracks: SongTrack[] = [
    {
      index: 0,
      name: 'Guitarra 1',
      isPercussion: false,
      stringCount: 6,
      tuning: TUNINGS[1]!, // Drop D
      capoFret: 0,
      bars: [],
    },
    {
      index: 1,
      name: 'Guitarra 2',
      isPercussion: false,
      stringCount: 6,
      tuning: STANDARD_TUNING,
      capoFret: 0,
      bars: [],
    },
    {
      index: 2,
      name: 'Bajo',
      isPercussion: false,
      stringCount: 4,
      tuning: { id: 'bass-4', name: '4 cuerdas', strings: [28, 33, 38, 43] },
      capoFret: 0,
      bars: [],
    },
    {
      index: 3,
      name: 'Batería',
      isPercussion: true,
      stringCount: 0,
      tuning: { id: 'percussion', name: 'Percusión', strings: [] },
      capoFret: 0,
      bars: [],
    },
    {
      index: 4,
      name: 'Teclado',
      isPercussion: false,
      stringCount: 0,
      tuning: { id: 'piano', name: 'Estándar', strings: [] },
      capoFret: 0,
      bars: [],
    },
  ];

  const defaultProps: TrackMixerPopoverProps = {
    open: true,
    onClose: vi.fn(),
    tracks: sampleTracks,
    activeTrackIndex: 0,
    onSelectTrack: vi.fn(),
    trackMixer: {
      0: { muted: false, solo: false, volume: 0.8 },
      1: { muted: false, solo: false, volume: 0.62 },
      2: { muted: false, solo: false, volume: 0.7 },
      3: { muted: false, solo: false, volume: 0.75 },
      4: { muted: true, solo: false, volume: 0.5 },
    },
    onSetMute: vi.fn(),
    onSetSolo: vi.fn(),
    onSetVolume: vi.fn(),
    masterVolume: 0.85,
    onSetMasterVolume: vi.fn(),
    countInEnabled: true,
    onToggleCountIn: vi.fn(),
    metronomeSubdivision: '1/4',
    onSetMetronomeSubdivision: vi.fn(),
    onResetMixer: vi.fn(),
  };

  it('no se renderiza si open es false', () => {
    const { container } = render(<TrackMixerPopover {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('describe correctamente instrumentos según tipo y afinación (getTrackDescription)', () => {
    expect(getTrackDescription(sampleTracks[0]!)).toBe('Guitarra eléctrica · Drop D');
    expect(getTrackDescription(sampleTracks[1]!)).toBe('Guitarra acústica · Estándar');
    expect(getTrackDescription(sampleTracks[2]!)).toBe('Bajo eléctrico · 4 cuerdas');
    expect(getTrackDescription(sampleTracks[3]!)).toBe('Percusión');
    expect(getTrackDescription(sampleTracks[4]!)).toBe('Piano · acompañamiento');
  });

  it('renderiza la cabecera con el título, contador dinámico de pistas y botón Restablecer', () => {
    render(<TrackMixerPopover {...defaultProps} />);

    expect(screen.getByText('Mezclador')).toBeTruthy();
    expect(screen.getByText('· 5 pistas')).toBeTruthy();

    const resetBtn = screen.getByRole('button', { name: 'Restablecer' });
    expect(resetBtn).toBeTruthy();
    fireEvent.click(resetBtn);
    expect(defaultProps.onResetMixer).toHaveBeenCalledTimes(1);
  });

  it('renderiza la tarjeta de Maestro con control de volumen general (0..100)', () => {
    const onSetMasterVolume = vi.fn();
    render(
      <TrackMixerPopover
        {...defaultProps}
        masterVolume={0.85}
        onSetMasterVolume={onSetMasterVolume}
      />,
    );

    expect(screen.getByText('Maestro')).toBeTruthy();
    expect(screen.getByText('85')).toBeTruthy();

    const masterSlider = screen.getByRole('slider', { name: 'Volumen maestro' });
    expect(masterSlider).toBeTruthy();
    fireEvent.change(masterSlider, { target: { value: '0.9' } });
    expect(onSetMasterVolume).toHaveBeenCalledWith(0.9);
  });

  it('renderiza las pistas con selector radio, insignia Activa, subtítulo, M/S y volumen', () => {
    const onSelectTrack = vi.fn();
    const onSetMute = vi.fn();
    const onSetSolo = vi.fn();
    const onSetVolume = vi.fn();

    render(
      <TrackMixerPopover
        {...defaultProps}
        onSelectTrack={onSelectTrack}
        onSetMute={onSetMute}
        onSetSolo={onSetSolo}
        onSetVolume={onSetVolume}
      />,
    );

    // La pista 0 es activa
    const track0Row = screen.getByTestId('track-mixer-popover').querySelector('[data-track-index="0"]')!;
    expect(within(track0Row as HTMLElement).getByText('Activa')).toBeTruthy();
    expect(within(track0Row as HTMLElement).getByText('Guitarra eléctrica · Drop D')).toBeTruthy();
    expect(within(track0Row as HTMLElement).getByText('80')).toBeTruthy();

    // Cambiar de pista activa al pulsar en el radio de la pista 1
    const track1Row = screen.getByTestId('track-mixer-popover').querySelector('[data-track-index="1"]')!;
    const radio1 = within(track1Row as HTMLElement).getByRole('radio');
    fireEvent.click(radio1);
    expect(onSelectTrack).toHaveBeenCalledWith(1);

    // Mute y Solo
    const muteBtn0 = within(track0Row as HTMLElement).getByRole('button', { name: /Silenciar Guitarra 1/i });
    fireEvent.click(muteBtn0);
    expect(onSetMute).toHaveBeenCalledWith(0, true);

    const soloBtn0 = within(track0Row as HTMLElement).getByRole('button', { name: /Solo Guitarra 1/i });
    fireEvent.click(soloBtn0);
    expect(onSetSolo).toHaveBeenCalledWith(0, true);

    // Slider de volumen de pista
    const slider0 = within(track0Row as HTMLElement).getByRole('slider', { name: /Volumen de Guitarra 1/i });
    fireEvent.change(slider0, { target: { value: '0.95' } });
    expect(onSetVolume).toHaveBeenCalledWith(0, 0.95);
  });

  it('permite alternar la cuenta atrás de 1 compás', () => {
    const onToggleCountIn = vi.fn();
    render(<TrackMixerPopover {...defaultProps} onToggleCountIn={onToggleCountIn} countInEnabled={false} />);

    const countInBtn = screen.getByRole('button', { name: /Cuenta atrás/i });
    expect(countInBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(countInBtn);
    expect(onToggleCountIn).toHaveBeenCalledTimes(1);
  });

  it('renderiza el selector de subdivisión de metrónomo (1, 1/3, 1/4, 1/8, 1/16)', () => {
    const onSetMetronomeSubdivision = vi.fn();
    render(
      <TrackMixerPopover
        {...defaultProps}
        metronomeSubdivision="1/4"
        onSetMetronomeSubdivision={onSetMetronomeSubdivision}
      />,
    );

    expect(screen.getByText('METRÓNOMO · SUBDIVISIÓN')).toBeTruthy();

    // Se muestra la subdivisión actual en el encabezado
    const values = screen.getAllByText('1/4');
    expect(values.length).toBeGreaterThanOrEqual(1);

    // Pulsar en la subdivisión 1/8
    const tick18 = screen.getByRole('radio', { name: 'Subdivisión 1/8' });
    fireEvent.click(tick18);
    expect(onSetMetronomeSubdivision).toHaveBeenCalledWith('1/8');

    // Mover el slider de subdivisión
    const slider = screen.getByRole('slider', { name: 'Subdivisión del metrónomo' });
    fireEvent.change(slider, { target: { value: '4' } }); // 4 = '1/16'
    expect(onSetMetronomeSubdivision).toHaveBeenCalledWith('1/16');
  });

  it('cierra con la tecla Escape', () => {
    const onClose = vi.fn();
    render(<TrackMixerPopover {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
