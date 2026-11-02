import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import {
  PRESET_SONGS,
  loadPresetSongModel,
  importSong,
  type PresetSong,
  type SongModel,
} from '../../song';
import {
  songStore as defaultSongStore,
  resolveDefaultSongStorage,
  type SongStorage,
  type SongStore,
  type StoredSong,
} from '../../state';
import styles from './SongLibraryModal.module.css';

export interface SongLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  songStore?: StoreApi<SongStore>;
  storage?: SongStorage;
  onOpenSong?: (song: SongModel) => void;
}

export const PRESET_SUBTITLES: Record<string, string> = {
  'pop-diatonico-c-am': 'I–V–vi–IV y vi–IV–I–V · modula a A menor',
  'blues-rock-riff-e': 'Pentatónica menor y blue notes · 1 pista',
  'modulacion-menor-armonica-am': 'Arpegios incompletos y notas de paso · 2 pistas',
};

export function formatSongDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'Fecha reciente';
    const months = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun',
      'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
    ];
    const day = d.getDate();
    const month = months[d.getMonth()] ?? '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return 'Fecha reciente';
  }
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  const mb = (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');
  return `${mb} MB`;
}

export function formatSongSubtitle(song: StoredSong): string {
  const artist =
    !song.artist || song.artist.trim().toLowerCase() === 'desconocido'
      ? 'Sin artista'
      : song.artist.trim();
  const dateStr = formatSongDate(song.lastOpenedAt || song.importedAt);
  const sizeStr = formatFileSize(song.fileSize);
  const trackCount = song.model?.tracks?.length ?? 1;
  const tracksStr = `${trackCount} ${trackCount === 1 ? 'pista' : 'pistas'}`;

  return `${artist} · ${dateStr} · ${sizeStr} · ${tracksStr}`;
}

export function SongLibraryModal({
  isOpen,
  onClose,
  songStore = defaultSongStore,
  storage: propStorage,
  onOpenSong,
}: SongLibraryModalProps) {
  const activeSong = useStore(songStore, (s) => s.activeSong);
  const storeError = useStore(songStore, (s) => s.error);

  const resolvedStorage =
    propStorage ??
    (typeof songStore.getState().getStorage === 'function'
      ? songStore.getState().getStorage()
      : undefined) ??
    resolveDefaultSongStorage();

  const [savedSongs, setSavedSongs] = useState<StoredSong[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSongs = useCallback(async () => {
    try {
      const list = await resolvedStorage.listSongs();
      setSavedSongs(list);
    } catch (err) {
      console.warn('Guitar Aid: no se pudieron cargar las canciones de la biblioteca', err);
    }
  }, [resolvedStorage]);

  useEffect(() => {
    if (isOpen) {
      void loadSongs();
      setDeletingId(null);
      setIsClearingAll(false);
      setErrorMessage(storeError);
    }
  }, [isOpen, loadSongs, storeError]);

  // Manejo de atajo Esc para cerrar el modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOpenPreset = async (preset: PresetSong) => {
    try {
      const model = loadPresetSongModel(preset.id);
      await songStore.getState().setActiveSong(model);
      onOpenSong?.(model);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar canción de ejemplo';
      setErrorMessage(msg);
    }
  };

  const handleOpenSaved = async (song: StoredSong) => {
    try {
      const success = await songStore.getState().loadSavedSong(song.id);
      if (success) {
        onOpenSong?.(song.model);
        onClose();
      } else {
        setErrorMessage(songStore.getState().error ?? 'No se pudo abrir la canción');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al abrir la canción guardada';
      setErrorMessage(msg);
    }
  };

  const handleDeleteSong = async (songId: string) => {
    try {
      await songStore.getState().deleteSavedSong(songId);
      setDeletingId(null);
      await loadSongs();
    } catch (err) {
      console.warn('Error al eliminar canción', err);
    }
  };

  const handleClearLibrary = async () => {
    try {
      await songStore.getState().clearSavedSongs();
      setIsClearingAll(false);
      await loadSongs();
    } catch (err) {
      console.warn('Error al vaciar biblioteca', err);
    }
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    songStore.getState().setError(null);

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (bytes.byteLength === 0) {
        throw new Error('El archivo está vacío o dañado.');
      }

      let songModel: SongModel;
      if (ext === '.tex' || ext === '.alphatex') {
        const text = new TextDecoder('utf-8').decode(bytes);
        songModel = importSong(text, { fileName: file.name });
      } else {
        songModel = importSong(bytes, { fileName: file.name });
      }

      await songStore.getState().importSong(songModel, {
        rawData: bytes,
        fileFormat: ext || '.gp',
        fileSize: file.size,
      });

      onOpenSong?.(songModel);
      await loadSongs();
      onClose();
    } catch {
      const failMsg = `No se pudo importar «${file.name}»: el archivo está vacío o dañado. Tu biblioteca no ha cambiado.`;
      setErrorMessage(failMsg);
      songStore.getState().setError(failMsg);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    // Resetear valor para permitir seleccionar el mismo archivo si es necesario
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDropzoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDropzoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDropzoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file) {
          void processFile(file);
        }
      }}
      data-testid="song-library-modal-overlay"
      role="presentation"
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-library-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="song-library-modal"
      >
        {/* Cabecera del modal */}
        <header className={styles.modalHeader}>
          <div className={styles.titleGroup}>
            <h2 id="song-library-title" className={styles.modalTitle}>
              Biblioteca de canciones
            </h2>
            <p className={styles.modalSubtitle}>
              Se guarda en este navegador · funciona sin conexión
            </p>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar biblioteca de canciones"
            data-testid="close-song-library-btn"
          >
            <span className={styles.closeIcon} aria-hidden="true">
              ✕
            </span>
            <span>Cerrar</span>
            <kbd className={styles.escBadge}>Esc</kbd>
          </button>
        </header>

        {/* Cuerpo del modal (2 columnas) */}
        <div className={styles.modalBody}>
          {/* Columna Izquierda: Biblioteca reciente */}
          <section
            className={styles.column}
            aria-label="Biblioteca de canciones recientes"
          >
            <div className={styles.columnHeader}>
              <div className={styles.columnHeaderTitleGroup}>
                <h3 className={styles.columnTitle}>Biblioteca reciente</h3>
                <span
                  className={styles.recentCountBadge}
                  data-testid="recent-songs-count"
                >
                  {savedSongs.length}
                </span>
              </div>
              <span className={styles.sortHint}>Más reciente primero</span>
            </div>

            <div className={styles.recentList} data-testid="recent-songs-list">
              {savedSongs.length === 0 ? (
                <div
                  className={styles.emptyRecentState}
                  data-testid="empty-recent-state"
                >
                  No hay canciones guardadas en la biblioteca todavía.
                </div>
              ) : (
                savedSongs.map((song) => {
                  const isOpen = activeSong?.id === song.id;
                  const formatExt = song.fileFormat || '.gp';
                  const isDeleting = deletingId === song.id;

                  return (
                    <div
                      key={song.id}
                      className={`${styles.recentCard} ${isOpen ? styles.recentCardActive : ''}`}
                      data-testid={`recent-song-${song.id}`}
                    >
                      <div className={styles.formatBadge} aria-hidden="true">
                        {formatExt}
                      </div>

                      <div className={styles.recentInfo}>
                        <div className={styles.recentTitleRow}>
                          <span className={styles.recentTitle} title={song.title}>
                            {song.title}
                          </span>
                          {isOpen && (
                            <span
                              className={styles.openBadge}
                              data-testid={`badge-open-${song.id}`}
                            >
                              Abierta
                            </span>
                          )}
                        </div>
                        <div className={styles.recentSub}>
                          {formatSongSubtitle(song)}
                        </div>
                      </div>

                      <div className={styles.recentActions}>
                        {isDeleting ? (
                          <div className={styles.inlineConfirm}>
                            <span>¿Eliminar?</span>
                            <button
                              type="button"
                              className={styles.confirmDeleteBtn}
                              onClick={() => handleDeleteSong(song.id)}
                              data-testid={`confirm-delete-${song.id}`}
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              className={styles.cancelDeleteBtn}
                              onClick={() => setDeletingId(null)}
                              data-testid={`cancel-delete-${song.id}`}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.openSongBtn}
                              onClick={() => handleOpenSaved(song)}
                              data-testid={`open-song-${song.id}`}
                              aria-label={`Abrir ${song.title}`}
                            >
                              Abrir
                            </button>
                            <button
                              type="button"
                              className={styles.deleteSongBtn}
                              onClick={() => setDeletingId(song.id)}
                              data-testid={`delete-song-${song.id}`}
                              aria-label={`Eliminar canción ${song.title}`}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <footer className={styles.recentFooter}>
              <span className={styles.recentFooterNote}>
                Incluye tus anotaciones y acordes fijados de cada canción.
              </span>
              {isClearingAll ? (
                <div className={styles.inlineConfirm}>
                  <span>¿Vaciar biblioteca?</span>
                  <button
                    type="button"
                    className={styles.confirmDeleteBtn}
                    onClick={handleClearLibrary}
                    data-testid="confirm-clear-library-btn"
                  >
                    Sí, vaciar
                  </button>
                  <button
                    type="button"
                    className={styles.cancelDeleteBtn}
                    onClick={() => setIsClearingAll(false)}
                    data-testid="cancel-clear-library-btn"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.clearLibraryBtn}
                  onClick={() => setIsClearingAll(true)}
                  disabled={savedSongs.length === 0}
                  data-testid="clear-library-btn"
                >
                  Vaciar biblioteca
                </button>
              )}
            </footer>
          </section>

          {/* Columna Derecha: Canciones de ejemplo + Importar archivo */}
          <section
            className={styles.column}
            aria-label="Canciones de ejemplo e importación"
          >
            {/* 1. Canciones de ejemplo */}
            <div className={styles.columnHeader}>
              <h3 className={styles.columnTitle}>Canciones de ejemplo</h3>
            </div>

            <div className={styles.presetsList} data-testid="presets-list">
              {PRESET_SONGS.map((preset) => {
                const isPresetOpen = activeSong?.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`${styles.presetCard} ${isPresetOpen ? styles.presetCardActive : ''}`}
                    data-testid={`preset-card-${preset.id}`}
                  >
                    <div className={styles.presetInfo}>
                      <div className={styles.presetTitleRow}>
                        <span className={styles.presetTitle}>
                          {preset.title}
                        </span>
                        {isPresetOpen && (
                          <span
                            className={styles.openBadge}
                            data-testid={`badge-open-preset-${preset.id}`}
                          >
                            Abierta
                          </span>
                        )}
                      </div>
                      <span className={styles.presetSub}>
                        {PRESET_SUBTITLES[preset.id] ?? preset.description}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.openPresetBtn}
                      onClick={() => handleOpenPreset(preset)}
                      data-testid={`open-preset-${preset.id}`}
                      aria-label={`Abrir ejemplo ${preset.title}`}
                    >
                      Abrir
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 2. Importar archivo */}
            <div
              className={styles.columnHeader}
              style={{ marginTop: '20px' }}
            >
              <h3 className={styles.columnTitle}>Importar archivo</h3>
            </div>

            <div
              className={`${styles.dropzone} ${isDraggingOver ? styles.dropzoneActive : ''}`}
              onDragOver={handleDropzoneDragOver}
              onDragLeave={handleDropzoneDragLeave}
              onDrop={handleDropzoneDrop}
              data-testid="song-dropzone"
            >
              <span className={styles.dropzoneTitle}>
                Arrastra aquí un archivo de Guitar Pro
              </span>
              <span className={styles.dropzoneFormats}>
                .gp · .gp3–.gp5 · .gpx · .tg · .xml
              </span>
              <button
                type="button"
                className={styles.chooseFileBtn}
                onClick={() => fileInputRef.current?.click()}
                data-testid="choose-file-btn"
              >
                Elegir archivo...
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gp,.gp3,.gp4,.gp5,.gpx,.tg,.xml,.musicxml,.tex"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
                data-testid="song-file-input"
              />
            </div>

            {errorMessage && (
              <div
                className={styles.errorAlert}
                role="alert"
                aria-live="assertive"
                data-testid="import-error-alert"
              >
                {errorMessage}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
