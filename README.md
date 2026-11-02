# Guitar Aid

**Guitar Aid** es una aplicación web para ordenador (100 % offline, sin backend) que ayuda a comprender, entrenar y memorizar la teoría musical en la guitarra mostrándola sincronizada con un teclado de piano. Combina tres modos de trabajo principales:

- **Modo Sandbox (Explorar):** selección libre de notas en mástil y piano, navegador de acordes con digitaciones adaptadas a cada afinación, explorador de escalas, armonía diatónica y progresiones, sugerencias teóricas razonadas y síntesis Web Audio.
- **Modo Canción (Analizar y tocar):**
  - **Reproductor y visor multipista 100 % offline:** renderizado interactivo de partituras y tablaturas con AlphaTab (`Tab`, `Partitura + Tab`, `Partitura`), sintetizador multipista `AlphaSynth` con SoundFont local (`sonivox.sf2`), control de volumen/mute/solo por pista, metrónomo, cuenta atrás, velocidad variable (`0.25×`–`2.0×`) y bucles de sección.
  - **Formatos y biblioteca persistente:** soporte de archivos de Guitar Pro (`.gp`, `.gp3`–`.gp5`, `.gpx`), TuxGuitar (`.tg`), MusicXML (`.xml`) y AlphaTex (`.tex`), biblioteca local persistente en `IndexedDB`, arrastrar y soltar archivos (*Drag & Drop*) y 3 piezas completas de ejemplo integradas.
  - **Sincronización en vivo con mástil y piano:** visualización en tiempo real de las notas del pulso activo superpuestas a la escala activa (`scale-bg`) con adaptación automática a la afinación y cejilla de la pista activa.
  - **Análisis armónico automático y ponderado:** estimación de fundamental, detección de acordes por compás tolerante a notas melódicas de paso, detección de tonalidad con modulaciones y progresión armónica funcional en números romanos con reconocimiento de plantillas.
  - **Sobreescritura manual («criterio del músico»):** fijación reversible de acordes o escalas en cualquier compás con recálculo instantáneo de grados y marcas.
  - **Puentes integrados:** acciones para abrir cualquier acorde, escala o fragmento en **Sandbox** (`↗ Abrir en Sandbox`), exportar a mazo de repetición espaciada en **Aprender** (`Crear / añadir a mazo SRS`), o practicar el pasaje en **Ejercicios** (`Practicar en Ejercicios`).
- **Modo Aprender (Entrenar y memorizar):**
  - **Ejercicios (`A1`–`C2`):** práctica intensiva con corrección automática visual y sonora y selección adaptativa de puntos débiles (notas en el mástil, intervalos en una cuerda y entre cuerdas, mapas de intervalos, etiquetado de formas, construcción de acordes y escalas en una cuerda).
  - **Tarjetas (SRS):** memoria a largo plazo con repetición espaciada (variante Anki SM-2), 3 mazos predefinidos (_Principiante_, _Intermedio_, _Avanzado_) y constructor declarativo con los 11 bloques de contenido del catálogo.
  - **Fórmulas:** traductor bidireccional entre nombre (`Acorde` / `Escala` → grados, intervalos, semitonos y regla cromática) y fórmula (`Grados` → coincidencias exactas, rotaciones con otra raíz y acordes/escalas cercanos).
  - **Progreso:** mapa de aciertos del mástil (`0–12` y `0–24`), evolución de las últimas 10 sesiones, métricas globales de tarjetas, intervalos débiles con práctica directa y copia de seguridad completa (exportar e importar en JSON).

## Instalación y ejecución

Requisitos previos: Node.js y `pnpm`.

```bash
# Instalar dependencias
pnpm install

# Servidor de desarrollo (con recarga en caliente)
pnpm dev

# Ejecutar la batería de pruebas
pnpm test

# Compilar para producción (TypeScript + Vite)
pnpm build

# Previsualizar la compilación de producción
pnpm preview
```

Comandos adicionales de calidad y utilidades:

```bash
pnpm lint            # Reglas de ESLint y verificación de arquitectura por capas
pnpm format:check    # Comprobación de formato con Prettier
pnpm voicings:print  # Imprime digitaciones en tablatura ASCII (p. ej. pnpm voicings:print Am7)
```

## Atajos de teclado

### Modo Canción
- <kbd>Espacio</kbd>: Reproducir / Pausar
- <kbd>L</kbd>: Activar / desactivar bucle de reproducción (*loop*)
- <kbd>←</kbd> / <kbd>→</kbd>: Retroceder o avanzar compás
- <kbd>M</kbd>: Silenciar / activar sonido global
- <kbd>Esc</kbd>: Cerrar modales (Biblioteca / Exportación SRS) o deseleccionar rango de compases

### Modo Aprender y General
- <kbd>1</kbd>–<kbd>4</kbd> (en Tarjetas SRS): Valorar tarjeta (*Otra vez*, *Difícil*, *Bien*, *Fácil*)
- <kbd>Espacio</kbd> (en Tarjetas SRS): Mostrar reverso de la tarjeta
- <kbd>Enter</kbd> (en Ejercicios): Avanzar al siguiente ejercicio tras corrección

## Estructura de carpetas (cinco capas)

El código de `src/` está organizado en cinco capas con dependencias unidireccionales estrictas verificadas por ESLint y tests de arquitectura (`ui → state → song → learning → theory`), más el subsistema de audio:

```text
src/
├── theory/      # Capa 1 — Teoría musical en TypeScript puro (sin React ni DOM):
│                #   catálogos de acordes, escalas, afinaciones y progresiones, fórmulas
│                #   bidireccionales, detección de acordes, ranking de escalas, sugerencias y voicings.
├── learning/    # Capa 2 — Motor de aprendizaje en TypeScript puro (depende solo de theory):
│                #   generadores deterministas con semilla y correctores de los 9 ejercicios (A1–C2),
│                #   selección adaptativa, resolución de tarjetas (10 sujetos), constructor y SM-2 (SRS).
├── song/        # Capa 3 — Modelo y análisis de canciones en TypeScript puro (depende de theory y learning):
│                #   modelo inmutable (SongModel), importador (GP, TG, MusicXML, AlphaTex), canciones de ejemplo,
│                #   estimación ponderada de raíz, acordes por compás, tonalidad/modulaciones y puentes puros.
├── state/       # Capa 4 — Estado reactivo con Zustand (depende de theory, learning y song):
│                #   sandbox, settings, drills (sesión + estadísticas), decks (mazos + SRS) y song (canción activa,
│                #   reproductor, biblioteca IndexedDB y sobreescrituras manuales).
├── ui/          # Capa 5 — Interfaz en React 19 + SVG + CSS Modules:
│                #   AppShell, instrumentos puros (Fretboard, Piano), vista Sandbox, vista Canción
│                #   (AlphaTabViewport, SongTimelineBar, SongAnalysisPanel, SongLibraryModal, SongExportDeckModal)
│                #   y vista Aprender (Ejercicios, Tarjetas, Fórmulas y Progreso).
└── audio/       # Subsistema de sonido:
                 #   síntesis Web Audio (pluck), metrónomo y controlador multipista AlphaSynth (sonivox.sf2).
```

## Recursos de terceros y licencias

- **SoundFont `sonivox.sf2` (`public/soundfont/sonivox.sf2`):** incluido localmente para la síntesis multipista offline de alphaTab; proviene del paquete oficial `@coderline/alphatab` bajo licencia **Mozilla Public License 2.0 (MPL-2.0)**.
- **Tipografías Bravura (`public/font/`):** fuentes de notación musical OpenType/WOFF de Steinberg bajo licencia SIL Open Font License (OFL).

## Despliegue

### GitHub Pages

Se activa en **Settings → Pages → Source: GitHub Actions**. El flujo de trabajo en `.github/workflows/deploy.yml` se ejecuta automáticamente con cada `push` a `main` y bajo demanda (`workflow_dispatch`), compilando y desplegando la aplicación en GitHub Pages.

### Opción local

Se puede compilar y servir estáticamente en local con:

```bash
pnpm build
npx serve dist
```

## Documentación

- [Requisitos de la Fase 1](docs/Requisitos.md)
- [Plan de implementación de la Fase 1](docs/Fase-1/plan_fase1.md)
- [Plan de la Fase 1.1](docs/Fase-1/plan_fase1_1.md)
- [Especificación de interfaz (Sandbox, Fase 1.1)](docs/interfaz.md)
- [Plan de la Fase 2 (modo Aprender)](docs/Fase-2/plan_fase2.md)
- [Especificación de interfaz (modo Aprender, Fase 2)](docs/Fase-2/interfaz_fase2.md)
- [Registro de decisiones de la Fase 2](docs/Fase-2/decisiones.md)
- [Plan de la Fase 3 (modo Canción)](docs/Fase-3/plan_fase3.md)
- [Especificación de interfaz (modo Canción, Fase 3)](docs/Fase-3/interfaz_fase3.md)
- [Registro de decisiones de la Fase 3](docs/Fase-3/decisiones.md)
- [Registro de decisiones general](docs/decisiones.md)
- [Catálogo de digitaciones (voicings)](docs/voicings.md)
