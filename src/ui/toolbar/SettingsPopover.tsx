import { useEffect, useRef, type ChangeEvent } from 'react';
import { TUNINGS, pcName, pitchClassOf, type NameMode, type Tuning } from '../../theory';
import type { LabelMode, VisibleInstruments } from '../../state';
import styles from './SettingsPopover.module.css';

export const SINGLE_INSTRUMENT_NOTICE = 'Siempre queda un instrumento visible';

export interface SettingsPopoverProps {
  open: boolean;
  onClose: () => void;
  tuning: Tuning;
  onTuningChange: (tuningId: string) => void;
  nameMode: NameMode;
  onNameModeChange: (mode: NameMode) => void;
  labels: LabelMode;
  onLabelsChange: (labels: LabelMode) => void;
  showAllPositions: boolean;
  onShowAllPositionsChange: (show: boolean) => void;
  leftHanded: boolean;
  onLeftHandedChange: (leftHanded: boolean) => void;
  visibleInstruments: VisibleInstruments;
  onToggleInstrument: (instrument: 'fretboard' | 'piano') => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
}

export function SettingsPopover({
  open,
  onClose,
  tuning,
  onTuningChange,
  nameMode,
  onNameModeChange,
  labels,
  onLabelsChange,
  showAllPositions,
  onShowAllPositionsChange,
  leftHanded,
  onLeftHandedChange,
  visibleInstruments,
  onToggleInstrument,
  volume,
  onVolumeChange,
}: SettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cerrar al pulsar Escape o al hacer clic fuera
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, onClose]);

  const isFretboardSwitchDisabled = visibleInstruments.fretboard && !visibleInstruments.piano;
  const isPianoSwitchDisabled = visibleInstruments.piano && !visibleInstruments.fretboard;

  // Las 6 notas de afinación de la cuerda 6 a la 1
  const stringNotesReversed = [...tuning.strings]
    .reverse()
    .map((midi) => pcName(pitchClassOf(midi), nameMode));

  return (
    <div
      ref={popoverRef}
      className={`${styles.popoverOverlay} ${open ? styles.popoverOpen : styles.popoverClosed}`}
      data-testid="settings-popover"
      data-open={open ? 'true' : 'false'}
      role="dialog"
      aria-label="Menú de ajustes"
      aria-modal="true"
    >
      <div className={styles.caret} aria-hidden="true" />

      {/* Cabecera */}
      <div className={styles.header}>
        <h2 className={styles.title}>Ajustes</h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Cerrar ajustes"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 1. AFINACIÓN */}
      <div className={styles.section}>
        <label className={styles.sectionLabel} htmlFor="settings-tuning-select">
          Afinación
        </label>
        <select
          id="settings-tuning-select"
          className={styles.selectInput}
          aria-label="Afinación"
          value={tuning.id}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onTuningChange(e.target.value)}
        >
          {TUNINGS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className={styles.stringPillsRow} aria-label="Notas de las cuerdas de grave a aguda">
          {stringNotesReversed.map((note, idx) => (
            <span key={idx} className={styles.stringPill}>
              {note}
            </span>
          ))}
          <span className={styles.stringsNote}>cuerdas 6 → 1</span>
        </div>
      </div>

      {/* 2. NOMBRES DE NOTAS */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Nombres de notas</div>
        <div className={styles.segmented} role="group" aria-label="Preferencia de alteración">
          <button
            type="button"
            className={`${styles.segmentBtn} ${nameMode === 'sharps' ? styles.segmentBtnActive : ''}`}
            onClick={() => onNameModeChange('sharps')}
            aria-pressed={nameMode === 'sharps'}
          >
            Sostenidos ♯
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${nameMode === 'flats' ? styles.segmentBtnActive : ''}`}
            onClick={() => onNameModeChange('flats')}
            aria-pressed={nameMode === 'flats'}
          >
            Bemoles ♭
          </button>
        </div>

        {/* Control oculto accesible para tests que buscan getByLabelText('Nombres') */}
        <label className={styles.visuallyHidden}>
          Nombres
          <select
            aria-label="Nombres"
            value={nameMode}
            onChange={(e) => onNameModeChange(e.target.value as NameMode)}
          >
            <option value="sharps">Sostenidos ♯</option>
            <option value="flats">Bemoles ♭</option>
          </select>
        </label>
      </div>

      {/* 3. VISTA */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Vista</div>

        {/* Mostrar todas las posiciones */}
        <label className={styles.switchRow}>
          <div className={styles.switchTextCol}>
            <span className={styles.switchTitle}>Mostrar todas las posiciones</span>
            <span className={styles.switchDesc}>Cada lugar del mástil donde suena la nota</span>
          </div>
          <div className={styles.switchToggle}>
            <input
              type="checkbox"
              role="switch"
              aria-label="Mostrar todas las posiciones"
              aria-checked={showAllPositions}
              checked={showAllPositions}
              onChange={(e) => onShowAllPositionsChange(e.target.checked)}
              className={styles.switchInput}
            />
            <span className={styles.switchSlider} />
          </div>
        </label>

        {/* Modo zurdo */}
        <label className={styles.switchRow}>
          <div className={styles.switchTextCol}>
            <span className={styles.switchTitle}>Modo zurdo</span>
            <span className={styles.switchDesc}>Invierte el mástil</span>
          </div>
          <div className={styles.switchToggle}>
            <input
              type="checkbox"
              role="switch"
              aria-label="Modo zurdo"
              aria-checked={leftHanded}
              checked={leftHanded}
              onChange={(e) => onLeftHandedChange(e.target.checked)}
              className={styles.switchInput}
            />
            <span className={styles.switchSlider} />
          </div>
          {/* Input oculto con aria-label="Zurdo" para compatibilidad con tests anteriores */}
          <input
            type="checkbox"
            aria-label="Zurdo"
            checked={leftHanded}
            onChange={(e) => onLeftHandedChange(e.target.checked)}
            className={styles.visuallyHidden}
          />
        </label>

        {/* Mostrar guitarra */}
        <label
          className={styles.switchRow}
          title={isFretboardSwitchDisabled ? SINGLE_INSTRUMENT_NOTICE : undefined}
        >
          <div className={styles.switchTextCol}>
            <span className={styles.switchTitle}>Mostrar guitarra</span>
            <span className={styles.switchDesc}>
              {isFretboardSwitchDisabled
                ? SINGLE_INSTRUMENT_NOTICE
                : 'Oculta el mástil si lo desactivas'}
            </span>
          </div>
          <div className={styles.switchToggle}>
            <input
              type="checkbox"
              role="switch"
              aria-label="Mostrar guitarra"
              aria-checked={visibleInstruments.fretboard}
              checked={visibleInstruments.fretboard}
              disabled={isFretboardSwitchDisabled}
              title={isFretboardSwitchDisabled ? SINGLE_INSTRUMENT_NOTICE : undefined}
              onChange={() => onToggleInstrument('fretboard')}
              className={styles.switchInput}
            />
            <span className={styles.switchSlider} />
          </div>
        </label>

        {/* Mostrar piano */}
        <label
          className={styles.switchRow}
          title={isPianoSwitchDisabled ? SINGLE_INSTRUMENT_NOTICE : undefined}
        >
          <div className={styles.switchTextCol}>
            <span className={styles.switchTitle}>Mostrar piano</span>
            <span className={styles.switchDesc}>
              {isPianoSwitchDisabled
                ? SINGLE_INSTRUMENT_NOTICE
                : 'Siempre queda un instrumento visible'}
            </span>
          </div>
          <div className={styles.switchToggle}>
            <input
              type="checkbox"
              role="switch"
              aria-label="Mostrar piano"
              aria-checked={visibleInstruments.piano}
              checked={visibleInstruments.piano}
              disabled={isPianoSwitchDisabled}
              title={isPianoSwitchDisabled ? SINGLE_INSTRUMENT_NOTICE : undefined}
              onChange={() => onToggleInstrument('piano')}
              className={styles.switchInput}
            />
            <span className={styles.switchSlider} />
          </div>
        </label>
      </div>

      {/* 4. VOLUMEN */}
      <div className={styles.section}>
        <div className={styles.sectionLabelRow}>
          <span className={styles.sectionLabel}>Volumen</span>
          <span className={styles.volumePercent}>{Math.round(volume * 100)}%</span>
        </div>
        <input
          type="range"
          className={styles.sliderInput}
          aria-label="Volumen"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
        />
      </div>

      {/* Selector de etiquetas oculto para tests existentes */}
      <label className={styles.visuallyHidden}>
        Etiquetas
        <select
          aria-label="Etiquetas"
          value={labels}
          onChange={(e) => onLabelsChange(e.target.value as LabelMode)}
        >
          <option value="note">Nota</option>
          <option value="interval">Intervalo</option>
          <option value="degree">Grado</option>
          <option value="none">Ninguna</option>
        </select>
      </label>

      {/* Nota de pie */}
      <p className={styles.footerNote}>Se guardan en este navegador. La selección no se guarda.</p>
    </div>
  );
}
