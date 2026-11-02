// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import {
  SongLibraryModal,
  formatSongDate,
  formatFileSize,
  formatSongSubtitle,
} from './SongLibraryModal';
import {
  createMemorySongStorage,
  createSongStore,
  type SongStorage,
  type SongStore,
  type StoredSong,
} from '../../state';
import {
  PRESET_POP_DIATONIC,
  PRESET_BLUES_ROCK,
  PRESET_MODULATION,
  loadPresetSongModel,
  exportAlphaTexToGp7Bytes,
} from '../../song';
import type { StoreApi } from 'zustand/vanilla';

describe('Hito C7 — SongLibraryModal y Drag & Drop', () => {
  let memoryStorage: SongStorage;
  let store: StoreApi<SongStore>;

  beforeEach(() => {
    memoryStorage = createMemorySongStorage();
    store = createSongStore({ storage: memoryStorage });
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Utilidades puras de formato', () => {
    it('formatSongDate: formatea fechas de forma consistente en español', () => {
      const formatted = formatSongDate('2026-10-28T14:30:00.000Z');
      expect(formatted).toBe('28 oct 2026');

      expect(formatSongDate('fecha-invalida')).toBe('Fecha reciente');
    });

    it('formatFileSize: formatea tamaños en KB y MB con coma decimal', () => {
      expect(formatFileSize(undefined)).toBe('0 KB');
      expect(formatFileSize(0)).toBe('0 KB');
      expect(formatFileSize(214 * 1024)).toBe('214 KB');
      expect(formatFileSize(96 * 1024)).toBe('96 KB');
      expect(formatFileSize(1.2 * 1024 * 1024)).toBe('1,2 MB');
      expect(formatFileSize(41 * 1024)).toBe('41 KB');
    });

    it('formatSongSubtitle: genera la tira informativa (artista · fecha · tamaño · pistas)', () => {
      const model = loadPresetSongModel(PRESET_POP_DIATONIC.id);
      const song: StoredSong = {
        id: 'test-1',
        title: 'Riff en Drop D',
        artist: 'Desconocido',
        model,
        fileFormat: '.gp5',
        fileSize: 214 * 1024,
        importedAt: '2026-10-28T10:00:00.000Z',
        lastOpenedAt: '2026-10-28T10:00:00.000Z',
      };

      const sub = formatSongSubtitle(song);
      expect(sub).toBe('Sin artista · 28 oct 2026 · 214 KB · 2 pistas');
    });
  });

  describe('2. Renderizado del diálogo y estructura accesible', () => {
    it('no renderiza nada en el DOM cuando isOpen es false', () => {
      render(
        <SongLibraryModal
          isOpen={false}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renderiza la estructura completa del modal cuando isOpen es true', async () => {
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const dialog = screen.getByRole('dialog', { name: /Biblioteca de canciones/i });
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      // Título y subtítulo
      expect(screen.getByText('Biblioteca de canciones')).toBeTruthy();
      expect(
        screen.getByText('Se guarda en este navegador · funciona sin conexión'),
      ).toBeTruthy();

      // Botón cerrar
      expect(screen.getByRole('button', { name: /Cerrar biblioteca de canciones/i })).toBeTruthy();

      // Cabeceras de columnas
      expect(screen.getByRole('heading', { name: 'Biblioteca reciente' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Canciones de ejemplo' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Importar archivo' })).toBeTruthy();

      // Estado vacío inicial de biblioteca reciente
      expect(
        await screen.findByText(/No hay canciones guardadas en la biblioteca todavía/i),
      ).toBeTruthy();
      expect(screen.getByTestId('recent-songs-count').textContent).toBe('0');
    });
  });

  describe('3. Pestaña de Canciones de ejemplo', () => {
    it('muestra las 3 canciones integradas con su título y badge de activa', () => {
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      expect(screen.getByText('Pop Diatónico en C/Am')).toBeTruthy();
      expect(screen.getByText('Blues & Rock Riff en E')).toBeTruthy();
      expect(screen.getByText('Modulación y Menor Armónica en Am/C')).toBeTruthy();

      // La primera canción es la activa por defecto en el store
      expect(screen.getByTestId('badge-open-preset-pop-diatonico-c-am').textContent).toBe('Abierta');
    });

    it('al pulsar Abrir en un ejemplo, actualiza la canción activa en songStore y cierra el modal', async () => {
      let closed = false;
      let openedSongTitle = '';

      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
          onOpenSong={(s) => {
            openedSongTitle = s.title;
          }}
        />,
      );

      const openBluesBtn = screen.getByRole('button', {
        name: `Abrir ejemplo ${PRESET_BLUES_ROCK.title}`,
      });
      fireEvent.click(openBluesBtn);

      await waitFor(() => {
        expect(store.getState().activeSong?.id).toBe(PRESET_BLUES_ROCK.id);
        expect(openedSongTitle).toBe(PRESET_BLUES_ROCK.title);
        expect(closed).toBe(true);
      });
    });
  });

  describe('4. Biblioteca reciente en IndexedDB / MemoryStorage (Criterio j)', () => {
    beforeEach(async () => {
      const model = loadPresetSongModel(PRESET_MODULATION.id);
      await memoryStorage.saveSong({
        id: 'custom-song-1',
        title: 'Mi Riff Personalizado',
        artist: 'Adan',
        model: { ...model, id: 'custom-song-1', title: 'Mi Riff Personalizado', artist: 'Adan' },
        fileFormat: '.gp5',
        fileSize: 214 * 1024,
        importedAt: '2026-10-28T10:00:00.000Z',
        lastOpenedAt: '2026-10-28T10:00:00.000Z',
      });
      await memoryStorage.saveSong({
        id: 'custom-song-2',
        title: 'Ejercicio de Arpegios',
        artist: 'Desconocido',
        model: { ...model, id: 'custom-song-2', title: 'Ejercicio de Arpegios', artist: '' },
        fileFormat: '.gp',
        fileSize: 96 * 1024,
        importedAt: '2026-10-24T10:00:00.000Z',
        lastOpenedAt: '2026-10-24T10:00:00.000Z',
      });
    });

    it('muestra las canciones guardadas con su formato, metadatos y contador', async () => {
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      expect(await screen.findByText('Mi Riff Personalizado')).toBeTruthy();
      expect(screen.getByText('Ejercicio de Arpegios')).toBeTruthy();
      expect(screen.getByTestId('recent-songs-count').textContent).toBe('2');

      // Badges de formato
      expect(screen.getByText('.gp5')).toBeTruthy();
      expect(screen.getByText('.gp')).toBeTruthy();
    });

    it('al pulsar Abrir en una canción reciente, la carga en songStore y cierra el modal', async () => {
      let closed = false;

      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const openBtn = await screen.findByRole('button', { name: 'Abrir Mi Riff Personalizado' });
      fireEvent.click(openBtn);

      await waitFor(() => {
        expect(store.getState().activeSong?.id).toBe('custom-song-1');
        expect(closed).toBe(true);
      });
    });

    it('al pulsar Eliminar, solicita confirmación en línea y al confirmar borra la canción', async () => {
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const deleteBtn = await screen.findByRole('button', {
        name: 'Eliminar canción Mi Riff Personalizado',
      });
      fireEvent.click(deleteBtn);

      // Confirmación en línea
      expect(screen.getByText('¿Eliminar?')).toBeTruthy();
      const cancelBtn = screen.getByTestId('cancel-delete-custom-song-1');
      fireEvent.click(cancelBtn);

      // No se eliminó tras cancelar
      expect(screen.getByText('Mi Riff Personalizado')).toBeTruthy();

      // Pulsar eliminar y luego confirmar
      const deleteBtnAgain = screen.getByRole('button', {
        name: 'Eliminar canción Mi Riff Personalizado',
      });
      fireEvent.click(deleteBtnAgain);

      const confirmBtn = screen.getByTestId('confirm-delete-custom-song-1');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.queryByText('Mi Riff Personalizado')).toBeNull();
        expect(screen.getByTestId('recent-songs-count').textContent).toBe('1');
      });
      expect(await memoryStorage.getSong('custom-song-1')).toBeUndefined();
    });

    it('al pulsar Vaciar biblioteca, solicita confirmación y vacía todas las canciones', async () => {
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const clearBtn = await screen.findByTestId('clear-library-btn');
      fireEvent.click(clearBtn);

      expect(screen.getByText('¿Vaciar biblioteca?')).toBeTruthy();
      const confirmClear = screen.getByTestId('confirm-clear-library-btn');
      fireEvent.click(confirmClear);

      await waitFor(() => {
        expect(screen.getByTestId('recent-songs-count').textContent).toBe('0');
        expect(
          screen.getByText(/No hay canciones guardadas en la biblioteca todavía/i),
        ).toBeTruthy();
      });
      expect(await memoryStorage.listSongs()).toHaveLength(0);
    });
  });

  describe('5. Importación de archivos y Drag & Drop (Criterios e, j)', () => {
    it('importa un archivo binario válido de Guitar Pro (.gp7) y lo añade a la biblioteca', async () => {
      let closed = false;
      const gpBytes = exportAlphaTexToGp7Bytes(PRESET_POP_DIATONIC.alphaTex);
      const validFile = new File([gpBytes.buffer as ArrayBuffer], 'MiRiff.gp', {
        type: 'application/octet-stream',
      });

      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const input = screen.getByTestId('song-file-input') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(store.getState().activeSong?.title).toBe('Pop Diatónico en C/Am');
        expect(closed).toBe(true);
      });

      const saved = await memoryStorage.listSongs();
      expect(saved.some((s) => s.fileFormat === '.gp')).toBe(true);
    });

    it('importa un archivo en texto plano AlphaTex (.tex)', async () => {
      let closed = false;
      const texContent = `\\title "Canción AlphaTex"
\\tempo 120
.
\\track "Guitar"
:4 0.1 1.2 2.3 3.4 |`;
      const texFile = new File([texContent], 'ejercicio.tex', { type: 'text/plain' });

      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const input = screen.getByTestId('song-file-input') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [texFile] } });

      await waitFor(() => {
        expect(store.getState().activeSong?.title).toBe('Canción AlphaTex');
        expect(closed).toBe(true);
      });
    });

    it('manejo defensivo: un archivo corrupto o vacío muestra aviso accesible role="alert" sin alterar la canción', async () => {
      const prevActiveSongId = store.getState().activeSong?.id;
      const corruptFile = new File([new Uint8Array([0, 1, 2, 3])], 'riff-roto.gp5', {
        type: 'application/octet-stream',
      });

      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const input = screen.getByTestId('song-file-input') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [corruptFile] } });

      const alert = await screen.findByRole('alert');
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain(
        'No se pudo importar «riff-roto.gp5»: el archivo está vacío o dañado. Tu biblioteca no ha cambiado.',
      );

      // La canción activa no cambió
      expect(store.getState().activeSong?.id).toBe(prevActiveSongId);
    });

    it('manejo defensivo: un archivo de 0 bytes muestra aviso accesible', async () => {
      const emptyFile = new File([new Uint8Array(0)], 'vacio.gp', {
        type: 'application/octet-stream',
      });

      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const dropzone = screen.getByTestId('song-dropzone');
      fireEvent.drop(dropzone, {
        dataTransfer: { files: [emptyFile] },
      });

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(
        'No se pudo importar «vacio.gp»: el archivo está vacío o dañado. Tu biblioteca no ha cambiado.',
      );
    });

    it('interacción de arrastre (dragover / dragleave) activa estilos en dropzone', () => {
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {}}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const dropzone = screen.getByTestId('song-dropzone');
      expect(dropzone.className).not.toContain('dropzoneActive');

      fireEvent.dragOver(dropzone);
      expect(dropzone.className).toContain('dropzoneActive');

      fireEvent.dragLeave(dropzone);
      expect(dropzone.className).not.toContain('dropzoneActive');
    });
  });

  describe('6. Accesibilidad y cierre del modal', () => {
    it('cierra el modal al pulsar la tecla Escape', () => {
      let closed = false;
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      expect(closed).toBe(true);
    });

    it('cierra el modal al pulsar el botón ✕ Cerrar', () => {
      let closed = false;
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const closeBtn = screen.getByTestId('close-song-library-btn');
      fireEvent.click(closeBtn);
      expect(closed).toBe(true);
    });

    it('cierra el modal al hacer clic en el backdrop overlay', () => {
      let closed = false;
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const overlay = screen.getByTestId('song-library-modal-overlay');
      fireEvent.click(overlay);
      expect(closed).toBe(true);
    });

    it('no cierra el modal al hacer clic dentro del contenedor de la tarjeta', () => {
      let closed = false;
      render(
        <SongLibraryModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          songStore={store}
          storage={memoryStorage}
        />,
      );

      const modal = screen.getByTestId('song-library-modal');
      fireEvent.click(modal);
      expect(closed).toBe(false);
    });
  });
});
