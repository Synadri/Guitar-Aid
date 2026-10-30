import { useState } from 'react';
import type { Tuning, NameMode } from '../../theory';
import type { MenuContext, LabelMode, VisibleInstruments } from '../../state';
import { ScalePicker } from '../pickers/ScalePicker';
import { ChordPicker } from '../pickers/ChordPicker';
import { PlaybackGroup } from './PlaybackGroup';
import { SettingsPopover } from './SettingsPopover';
import styles from './TopBar.module.css';

export interface TopBarProps {
  context: MenuContext | null;
  onSelectContext: (ctx: MenuContext | null) => void;
  onPreviewContext?: (ctx: MenuContext | null) => void;
  nameMode: NameMode;
  onNameModeChange: (mode: NameMode) => void;
  labels: LabelMode;
  onLabelsChange: (labels: LabelMode) => void;
  tuning: Tuning;
  onTuningChange: (tuningId: string) => void;
  showAllPositions: boolean;
  onShowAllPositionsChange: (show: boolean) => void;
  leftHanded: boolean;
  onLeftHandedChange: (leftHanded: boolean) => void;
  visibleInstruments: VisibleInstruments;
  onToggleInstrument: (instrument: 'fretboard' | 'piano') => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onClear: () => void;
  onPlayChord: () => void;
  onPlayArpeggio: () => void;
  onPlayScale: () => void;
  playbackDisabled?: boolean;
  canPlayChordAndArpeggio?: boolean;
  canPlayScale?: boolean;
}

export function TopBar({
  context,
  onSelectContext,
  onPreviewContext,
  nameMode,
  onNameModeChange,
  labels,
  onLabelsChange,
  tuning,
  onTuningChange,
  showAllPositions,
  onShowAllPositionsChange,
  leftHanded,
  onLeftHandedChange,
  visibleInstruments,
  onToggleInstrument,
  volume,
  onVolumeChange,
  soundEnabled,
  onToggleSound,
  onClear,
  onPlayChord,
  onPlayArpeggio,
  onPlayScale,
  playbackDisabled = false,
  canPlayChordAndArpeggio = false,
  canPlayScale = false,
}: TopBarProps) {
  const [activePopover, setActivePopover] = useState<'scale' | 'chord' | 'settings' | null>(null);
  const settingsOpen = activePopover === 'settings';

  return (
    <header
      className={styles.topBar}
      data-testid="toolbar"
      role="toolbar"
      aria-label="Barra de herramientas"
    >
      {/* 1. Selector de Escala */}
      <ScalePicker
        context={context}
        nameMode={nameMode}
        onSelectContext={onSelectContext}
        onPreviewContext={onPreviewContext}
        open={activePopover === 'scale'}
        onOpenChange={(open) => {
          setActivePopover((prev) => (open ? 'scale' : prev === 'scale' ? null : prev));
        }}
      />

      {/* 2. Selector de Acorde */}
      <ChordPicker
        context={context}
        nameMode={nameMode}
        onSelectContext={onSelectContext}
        onPreviewContext={onPreviewContext}
        open={activePopover === 'chord'}
        onOpenChange={(open) => {
          setActivePopover((prev) => (open ? 'chord' : prev === 'chord' ? null : prev));
        }}
      />

      {/* 3. Reproducción (segmentado) */}
      <PlaybackGroup
        onPlayChord={onPlayChord}
        onPlayArpeggio={onPlayArpeggio}
        onPlayScale={onPlayScale}
        disabled={playbackDisabled}
        canPlayChordAndArpeggio={canPlayChordAndArpeggio}
        canPlayScale={canPlayScale}
      />

      <div className={styles.spacer} />

      {/* 4. Acciones globales (Sonido, Limpiar, Ajustes) */}
      <div className={styles.actionsGroup}>
        {/* Sonido [M] */}
        <label
          className={`${styles.actionBtn} ${soundEnabled ? styles.actionBtnActive : ''}`}
          aria-pressed={soundEnabled}
          aria-keyshortcuts="M"
          title="Sonido (M)"
        >
          <input
            type="checkbox"
            aria-label="Sonido"
            checked={soundEnabled}
            onChange={onToggleSound}
            aria-keyshortcuts="M"
            title="Sonido (M)"
            className={styles.visuallyHidden}
          />
          <span>Sonido</span>
          <span className={styles.shortcutBadge} aria-hidden="true">
            M
          </span>
        </label>

        {/* Limpiar [C] */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onClear}
          aria-keyshortcuts="C"
          title="Limpiar (C)"
        >
          <span>Limpiar</span>
          <span className={styles.shortcutBadge} aria-hidden="true">
            C
          </span>
        </button>

        {/* Ajustes */}
        <button
          type="button"
          className={`${styles.actionBtn} ${settingsOpen ? styles.actionBtnActive : ''}`}
          onClick={() => {
            onPreviewContext?.(null);
            setActivePopover((prev) => (prev === 'settings' ? null : 'settings'));
          }}
          data-testid="settings-button"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          aria-controls="settings-popover"
        >
          <span>Ajustes</span>
        </button>

        {/* Pista oculta para selector de atajos */}
        <span data-testid="shortcuts-hint" className={styles.visuallyHidden}>
          C · M
        </span>
      </div>

      {/* Menú Ajustes en popover */}
      <SettingsPopover
        open={settingsOpen}
        onClose={() => setActivePopover((prev) => (prev === 'settings' ? null : prev))}
        tuning={tuning}
        onTuningChange={onTuningChange}
        nameMode={nameMode}
        onNameModeChange={onNameModeChange}
        labels={labels}
        onLabelsChange={onLabelsChange}
        showAllPositions={showAllPositions}
        onShowAllPositionsChange={onShowAllPositionsChange}
        leftHanded={leftHanded}
        onLeftHandedChange={onLeftHandedChange}
        visibleInstruments={visibleInstruments}
        onToggleInstrument={onToggleInstrument}
        volume={volume}
        onVolumeChange={onVolumeChange}
      />
    </header>
  );
}
