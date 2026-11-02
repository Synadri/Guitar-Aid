# Guitar Aid — Especificación de interfaz (Modo Canción, Fase 3 / Hitos C5–C9)

Documento canónico del diseño visual e interactivo del **Modo Canción** (Fase 3). Toma como referencia la maqueta situada en `docs/Fase-3/`:
- [Modo Canción · 1920×1080@1x.png](Modo%20Canci%C3%B3n%20%C2%B7%201920%C3%971080%401x.png)

Si este documento y la maqueta difieren en un detalle menor o en un estado dinámico, prevalece este documento. El modelo de dominio (`src/song/`), los motores teóricos (`src/theory/analysis/`), el estado (`src/state/song/`), los hitos y los criterios de aceptación están definidos en [plan_fase3.md](plan_fase3.md); este documento especifica la capa visual e interactiva (`src/ui/song/`, hitos **C5–C9**).

---

## 1. Principios de diseño

1. **Continuidad visual con Sandbox y Aprender:** reutiliza el mismo sistema de tokens (`--surface-0` a `--surface-3`, `--border`, `--accent`, etc.), tipografía local (`IBM Plex Sans` e `IBM Plex Mono`, 100 % offline) y navegación lateral (`SideNav`).
2. **Una sola pantalla, sin scroll de ventana:** optimizado principalmente para **1920×1080** y **2560×1440** (con adaptación limpia a **1440×900** y caída a 1 columna por debajo de `1100 px`). El contenedor `.songView` mantiene `height: 100vh; overflow: hidden;` y el desplazamiento ocurre únicamente dentro del visor de tablatura, la cinta horizontal de compases y las listas internas del panel de análisis.
3. **Trazabilidad visual en 4 puntos mediante semántica de color:**
   - **Turquesa (`#14b8a6`):** foco de reproducción y selección activa (botón `Pausa`, sección activa `Estribillo`, rango seleccionado `5–8`, cursor vertical de pulso en la tablatura, candidato `#1` activo de escala/acorde y botón principal `↗ Abrir en Sandbox`).
   - **Ámbar (`#f59e0b`):** compás y acorde en foco de inspección. Conecta de un vistazo cuatro elementos simultáneos: la píldora superior `Acorde: Am (vi) ▾`, la celda `7 · Am` en la cinta de compases, el compás `7` resaltado en la tablatura y el chip `c.7 [Am vi]` en la progresión del panel derecho. También identifica mediante un punto ámbar (`●`) los compases que tienen una anotación fijada manualmente (*override*).
   - **Violeta (`#a855f7`):** bloques de sección donde el analizador detecta una **modulación** o cambio de centro tonal (p. ej. `Puente · A menor (modulación)`).
   - **Azul (`#3b82f6` / `#101b33`):** controles de vista y filtros activos en barras de herramientas (`Bucle 5–8`, `Tab`, `Letra`, `Acorde`, `Grado`, `Pista activa`).
4. **Los instrumentos arriba, siempre sincronizados:** el `Fretboard` y el `Piano` muestran en tiempo real las notas del pulso actual (`pinned` / `root`) superpuestas sobre las notas de la escala/tonalidad del compás (`scale-bg`), adoptando la afinación y cejilla (`Capo`) de la pista activa.
5. **Estabilidad de inspección durante la reproducción:** mientras suena un bucle, el usuario puede anclar cualquier compás en el panel derecho (`CANDIDATOS DEL COMPÁS X`) haciendo clic en su chip o celda sin que la lista salte con cada cambio de compás del reproductor.

---

## 2. Estructura general y presupuesto de altura (`AppShell` y `SongView`)

| Zona | Dimensiones (`1920×1080` / `2560×1440` / `≤ 950 px`) | Contenido |
|---|---|---|
| **Menú lateral (`SideNav`)** | `76 px` colapsado (`240 px` expandido), `100vh` | Logo, `Sandbox`, `Aprender`, **`Canción`** (icono de corchea doble, activo con barra lateral e iluminación `#162032`), colapsar/expandir y versión |
| **1. Barra superior (`SongTopBar`)** | `48 px` / `54 px` / `44 px` de alto · margen `8px 12px 0` | `📂 Canciones`, título/subtítulo de canción, grupo `PISTA` + `Mezclador`, grupo de transporte (`⏮`, `⏸ Pausa`, `Bucle`, `VEL.`, `Metrónomo`), grupo `VISTA` (`Tab` \| `Partitura + Tab` \| `Partitura` + `Letra`), `Sonido M` y `Ajustes` |
| **2. Tarjeta de Instrumentos (`SongInstrumentsCard`)** | `300 px` / `378 px` / `264 px` de alto · margen `8px 12px 0` | `SongContextStrip` (`38 px`) + `Fretboard` (`236 px`) + `Piano` compacto (`72 px`). Control de visibilidad en Ajustes para ocultar Piano (+116 px) o ambos (+350 px). |
| **3. Área inferior (2 columnas)** | Resto del alto (`≈ 652 px` en `1080p` / `≈ 920 px` en `1440p`) · padding `8px 12px 12px` | `grid-template-columns: minmax(0, 1.62fr) minmax(420px, 1fr); gap: 12px;` — Izquierda: `SongTimelineBar` + `AlphaTabViewport`; Derecha: `SongAnalysisPanel` |

- **Carga inicial sin estado vacío roto:** al entrar por primera vez al Modo Canción (si no hay ninguna canción activa en la sesión), se carga automáticamente la primera canción de ejemplo integrada (**`Pop Diatónico en C/Am`**) para que la pantalla sea inmediatamente explorable y funcional tal como muestra la maqueta.

---

## 3. Barra superior (`SongTopBar`)

Contenedor en una sola fila (`display: flex; align-items: center; gap: 10px; padding: 0 12px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px`):

1. **Canción y Biblioteca (izquierda):**
   - Botón **`📁 Canciones`** (`height: 32px`, `padding: 0 12px`, `border-radius: 7px`, `background: var(--surface-2)`, `border: 1px solid var(--control-border)`): abre `SongLibraryModal`.
   - **Bloque de metadatos de la canción activa** (dos líneas compactas, `min-width: 150px`, `max-width: 240px`):
     - Línea 1: título en negrita con elipsis (`14 px`, `font-weight: 700`, texto blanco, p. ej. `Pop Diatónico en C/Am`).
     - Línea 2: origen/artista, compás y tempo base (`11 px`, `--app-muted`, p. ej. `Ejemplo · 4/4 · 96 BPM`).
2. **Grupo `PISTA` y Mezclador** (`div[role="group"]` enmarcado):
   - Etiqueta `PISTA` (`10.5 px`, mayúsculas, `--app-muted`, `letter-spacing: 0.05em`).
   - Selector desplegable de pista activa mostrando nombre y afinación (p. ej. `Guitarra 1 · Drop D ▾`, `height: 28px`).
   - Botón **`Mezclador`** (`aria-haspopup="dialog"`, `aria-expanded`): abre `TrackMixerPopover` justo debajo con los controles `Mute (M)`, `Solo (S)` y deslizador de `Volumen` de cada pista de la canción, más el interruptor de `Cuenta atrás (1 compás)`.
3. **Grupo de Transporte, Bucle, Velocidad y Metrónomo** (`div[role="group"]` enmarcado):
   - Botón **`⏮`** (`aria-label="Ir al inicio"`, `30×28 px`).
   - Botón principal **`▶ Reproducir` / `⏸ Pausa`** (`height: 28px`, `padding: 0 12px`, `border-radius: 6px`; en reproducción usa fondo turquesa `#14b8a6`, texto oscuro `#042f2e` en negrita).
   - Botón **`Bucle` / `Bucle {A}–{B}`** (`aria-pressed`):
     - Cuando hay un rango de compases seleccionado (p. ej. `5–8`), muestra `Bucle 5–8`. Si el bucle está activo lleva borde `#3b82f6` y fondo `#101b33`.
     - Si se pulsa sin rango seleccionado previamente, activa el bucle sobre los compases de la **sección actual** (p. ej. `Bucle 5–8` para *Estribillo*).
   - Control de velocidad **`VEL.`**: etiqueta `VEL.` (`10.5 px`, `--app-muted`), botón `−` (`24×24 px`), lectura monoespaciada `1.0×` (`min-width: 36px`, `text-align: center`) y botón `+` (`24×24 px`), recorriendo los pasos `0.25×`, `0.5×`, `0.75×`, `1.0×`, `1.25×`, `1.5×`, `2.0×`.
   - Botón **`Metrónomo`** (`aria-pressed`, activo con borde `#3b82f6` y fondo `#101b33`).
4. **Grupo `VISTA`** (`div[role="group"]` enmarcado):
   - Etiqueta `VISTA` (`10.5 px`, mayúsculas, `--app-muted`).
   - Conmutador segmentado de 3 opciones: **`Tab`** · **`Partitura + Tab`** · **`Partitura`** (la opción activa lleva borde `#3b82f6` y fondo `#101b33`).
   - Botón interruptor **`Letra`** (`aria-pressed`, muestra u oculta la fila de letra bajo los compases; activo con borde `#3b82f6` y fondo `#101b33`).
5. **Acciones globales (derecha, `margin-left: auto`):**
   - Botón **`Sonido M`** (`aria-pressed`, activo con borde `#3b82f6` y fondo `#101b33`) y botón **`Ajustes`** (abre el `SettingsPopover` compartido).

---

## 4. Zona de Instrumentos Sincronizados (`SongContextStrip`, `Fretboard` y `Piano`)

### 4.1. Franja de contexto de la canción (`SongContextStrip`, `38 px`)

Diseñada con anchos estables para que ningún control salte mientras avanza la reproducción:

- **Izquierda — Posición actual y rango seleccionado:**
  - Indicador `Compás {N} · Pulso {B}` (`13 px`, con los números en blanco semibold y las palabras en `--app-muted`).
  - Insignia de sección actual (p. ej. **`Estribillo`**, `font-size: 11px`, `padding: 2px 8px`, `border-radius: 5px`, fondo `rgba(20, 184, 166, 0.16)`, borde `1px solid #0d9488`, texto `#2dd4bf`).
  - Cuando hay un rango de compases seleccionado: texto `Seleccionado: compases {A}–{B}` (`12 px`, `--app-muted`) acompañado del botón compacto **`× Quitar selección`** (`height: 24px`, `padding: 0 8px`, `border-radius: 5px`, `border: 1px solid var(--control-border)`).
- **Centro — Tonalidad activa, Acorde en foco y Referencia de Grados:**
  - **Desplegable `Tonalidad: {Nombre} ▾`:** muestra la tonalidad vigente del compás/fragmento (p. ej. `Tonalidad: C mayor ▾`, `height: 26px`, `border-radius: 6px`). Si la tonalidad fue fijada manualmente por el usuario, incluye un punto ámbar `●` y la primera opción del menú es `Restablecer a automática`.
  - **Desplegable `Acorde: {Nombre} ({Grado}) ▾`:** muestra el acorde vigente del compás activo junto con su grado romano en la tonalidad (p. ej. **`Acorde: Am (vi) ▾`**). Se estiliza con **borde ámbar `#f59e0b`**, fondo `rgba(245, 158, 11, 0.14)` y texto `#fbbf24` (`font-weight: 600`) para enlazar visualmente con la celda del compás en la cinta inferior y el chip de la progresión. Si fue fijado manualmente, incluye el indicador `●` y la opción `Restablecer a automático`.
  - **Conmutador `GRADOS`:** etiqueta `GRADOS` (`10.5 px`, mayúsculas, `--app-muted`) + grupo segmentado **`Tonalidad`** | **`Acorde`**:
    - En **`Acorde`** (seleccionado en la maqueta): las etiquetas de grado (`1`, `♭3`, `5`…) e intervalo del mástil y del piano se calculan respecto a la **fundamental del acorde actual** (`Am` → `A = 1`, `C = ♭3`, `E = 5`).
    - En **`Tonalidad`**: las etiquetas se calculan respecto a la **tónica de la tonalidad activa** (`C mayor` → `C = 1`, `A = 6`, `E = 3`).
- **Derecha (`margin-left: auto; flex-shrink: 0`) — Etiquetas:**
  - Etiqueta `ETIQUETAS` (`10.5 px`, mayúsculas, `--app-muted`) + grupo segmentado **`Nota`** · **`Intervalo`** · **`Grado`** · **`Ninguna`**.

### 4.2. Comportamiento de `Fretboard` y `Piano` en el Modo Canción

1. **Afinación y Cejilla (`Capo`) de la pista activa:**
   - El `Fretboard` muestra a la izquierda de la cejuela las letras de afinación reales de la pista activa (p. ej. `e B G D A D` en *Drop D*, como en la maqueta).
   - Nueva prop opcional `capoFret?: number` en `Fretboard.tsx`: cuando la pista declara `capoFret > 0` (p. ej. `Capo 2`), se dibuja una barra vertical translúcida de cejilla sobre ese traste y los trastes `0 .. capoFret - 1` quedan atenuados (`opacity: 0.28`), reflejando con exactitud la geometría física de la guitarra.
2. **Capas de marcas (`selectSongFretboardMarks` y `selectSongPianoMarks`):**
   - **Fondo de escala (`role: 'scale-bg'`):** todas las posiciones del mástil y teclas del piano que pertenecen a la tonalidad/escala activa del compás se dibujan con círculos pequeños discretos (`r = 9` en mástil).
   - **Notas activas del pulso/compás (`role: 'pinned'` y `isRoot`):**
     - Las posiciones `(cuerda, traste)` que suenan en el pulso actual (o las posiciones del acorde del compás cuando se inspecciona un compás) se dibujan con círculos grandes de `24 px` en relleno turquesa (`#14b8a6`).
     - Aquellas cuya clase de altura coincide con la raíz de referencia activa (`Acorde` o `Tonalidad` según el conmutador `GRADOS`) llevan además **`isRoot: true`**, mostrando el **doble anillo interior concéntrico blanco/oscuro** (como se observa en las etiquetas `1` en cuerda 5 traste 0, cuerda 6 traste 7 y cuerda 3 traste 2 en la maqueta).
   - **Previsualización (`role: 'preview'`):** al pasar el ratón sobre cualquier escala o acorde candidato en el panel derecho, se superponen sus marcas con borde discontinuo sin perder el estado del compás.

---

## 5. Columna izquierda inferior: Cinta de Compases (`SongTimelineBar`) y Visor (`AlphaTabViewport`)

### 5.1. Cinta armónica de secciones y compases (`SongTimelineBar`)

Tarjeta superior (`.timelineCard`, `padding: 8px 12px`, `border-radius: 10px`, `background: var(--surface-1)`, `border: 1px solid var(--border)`) organizada en dos filas sincronizadas horizontalmente, con botón de colapso rápido para liberar espacio a la partitura:

1. **Fila 1 — Bloques de Sección con su Tonalidad:**
   - Cada sección abarca el ancho correspondiente a sus compases (`grid-column: span K`) y muestra `{NombreSección} · {Tonalidad}` (`11.5 px`, `font-weight: 600`, `padding: 3px 10px`, `border-radius: 5px`):
     - **Sección normal (`Intro · C mayor`, `Estrofa · C mayor`):** fondo `--surface-2` (`#161a22`), borde `--border`, texto `--app-text`.
     - **Sección activa / seleccionada (`Estribillo · C mayor`):** fondo `rgba(20, 184, 166, 0.16)`, borde `#14b8a6`, texto `#2dd4bf`.
     - **Sección con modulación detectada (`Puente · A menor (modulación)`):** fondo `rgba(168, 85, 247, 0.16)`, borde `#a855f7`, texto `#c084fc`.
   - **Interacción:** hacer clic en una cabecera de sección selecciona automáticamente todos los compases de esa sección (actualizando el análisis del fragmento a la derecha) y desplaza la vista hacia ella.
   - **Botón de colapso/expansión:** en el extremo superior derecho, un botón discreto `[−]` / `[+]` permite colapsar la cinta armónica a una línea compacta para maximizar la tablatura.

2. **Fila 2 — Celdas de Compases (`1 .. N`) y Segmentos Armónicos Intra-compás:**
   - Cada celda (`.barCell`, ancho fijo/confortable de `120 px`, `height: 42 px`, `border-radius: 6px`, `position: relative`) muestra:
     - Arriba a la izquierda: número del compás (`1`..`N`, `9.5 px`, `--app-muted`).
     - Arriba a la derecha (solo si el compás tiene un override manual fijado por el usuario): **punto ámbar `●`** (`width: 5px; height: 5px; border-radius: 50%; background: #f59e0b`).
     - **Cuerpo de acordes con subdivisión proporcional (`BarChordSegment[]`):**
       - Si el compás tiene **1 acorde**: un único bloque centrado (`C`, `Am`, `12 px`, `font-weight: 700`).
       - Si el compás tiene **2 o más acordes** (cambios en mitades, tiempos asimétricos o cadencias de 3–4 acordes): la celda se divide en sub-slots proporcionales según la duración relativa de cada acorde (`durationRatio`), con ancho suficiente (~55–60 px por acorde en divisiones de 2) para evitar truncar acordes compuestos como `Dsus4` o `Dm/F#`.
   - **Estados visuales e iluminación en vivo:**
     - **Por defecto:** fondo `var(--surface-2)`, borde `1px solid var(--border)`.
     - **Dentro del rango seleccionado / bucle (`compases 5–8`):** borde turquesa `#14b8a6` (`1.25 px`) y fondo `rgba(20, 184, 166, 0.08)`.
     - **Compás y sub-slot activo en reproducción:** el sub-slot que está sonando en el pulso actual se ilumina con fondo ámbar `rgba(245, 158, 11, 0.28)`, borde ámbar `#f59e0b` y texto `#fbbf24`, sincronizado con el tiempo exacto de cambio armónico.
   - **Escalado ergonómico y auto-scroll (4 a 6 compases visibles):**
     - En lugar de comprimir 15 compases en anchos ilegibles, la cinta presenta de 4 a 6 compases simultáneos a tamaño confortable (`120 px/celda`).
     - El contenedor de la cinta tiene desplazamiento horizontal suave (`overflow-x: auto; scrollbar-width: thin`) y ejecuta **auto-scroll horizontal automático** siguiendo al compás activo durante la reproducción.
     - En la fila 1, el título de cada sección se mantiene visible con `position: sticky; left: 8px` mientras se navega por sus compases.
   - **Interacción con ratón:**
     - **Clic simple en el compás (o en un sub-slot):** sitúa el cursor en ese compás y lo enfoca en el panel de análisis.
     - **`Shift + Clic` (o arrastrar entre celdas):** selecciona el rango de compases `[startBar, endBar]`.

### 5.2. Visor de Partitura / Tablatura (`AlphaTabViewport`)

Tarjeta inferior (`.scoreCard`, `flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 10px; background: var(--surface-1); border: 1px solid var(--border)`):

1. **Cabecera interna fija (`36 px`, `padding: 0 14px`, `border-bottom: 1px solid var(--border)`):**
   - **Izquierda:** insignia del modo de vista activo (`TABLATURA`, `PARTITURA + TAB` o `PARTITURA`) · separador · nombre de la pista activa en mayúsculas (`11 px`, `--app-muted`, `letter-spacing: 0.06em`, p. ej. `TABLATURA · GUITARRA 1`).
   - **Derecha:** botón **`[🔒 Seguir] / [🔓 Libre]`** (conmutador de vista guiada vs vista libre) + resumen técnico en fuente monoespaciada (`Drop D · Capo 0 · compás 7 de 16`).
   - *Nota:* Se elimina la barra intermedia redundante `contextOverlayBar` (+34 px liberados netos para el lienzo musical).

2. **Lienzo nativo de AlphaTab con tema oscuro integrado (`flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px`):**
   - El renderizado de partituras y tablaturas está **100 % delegado a `@coderline/alphatab`** en un contenedor DOM visible (`.alphaTabHost`), eliminando cualquier motor de grabado artesanal o SVG manual:
     - **Técnicas de guitarra y articulaciones nativas:** AlphaTab renderiza de forma automática y matemáticamente exacta todas las articulaciones complejas (*bends*, *pre-bends*, *release*, *slides*, *hammer-on / pull-off*, *vibrato*, *palm mute*, *armónicos*, ligaduras de prolongación, tresillos y compases perfectos).
     - **Configuración de Tema Oscuro de alto contraste:**
       - `display.resources.staffLineColor`: `#334155` (pautas discretas y nítidas de 5 líneas para pentagrama o 6/4 líneas para tablatura).
       - `display.resources.barSeparatorColor`: `#475569` (barras verticales divisorias de compás).
       - `display.resources.mainGlyphColor`: `#f8fafc` (blanco nítido de alto contraste para cabezas de nota, números de digitación en tablatura, plicas, barras de unión rítmica, alteraciones accidentales, claves y métrica).
       - `display.resources.secondaryGlyphColor`: `#94a3b8` (indicaciones dinámicas y técnicas auxiliares).
       - `display.resources.barNumberColor`: `#64748b` (numeración de compases en gris legible).
       - Tipografía musical SMuFL: fuente `Bravura` local (`public/font/`, 100 % offline).
       - Estilos CSS de cursores nativos: cursor de compás y pulso activo con estilos turquesa (`#14b8a6` / `#2dd4bf`) y halo translúcido. Sombreado de bucle en ámbar cálido (`data-highlight-mode="loop"`, `rgba(245, 158, 11, 0.22)`) y selección de compases en turquesa suave sin bordes distorsionados (`data-highlight-mode="selection"`, `rgba(20, 184, 166, 0.16)`).
     - **Modos nativos conmutables (`settings.display.staveProfile`):**
       - **Tablatura (`Tab`):** modo de tablatura pura (`at.StaveProfile.Tab`) con digitaciones sobre las cuerdas, articulaciones de guitarra completas y plicas rítmicas (`TabRhythmMode.ShowWithBars`).
       - **Partitura (`Score`):** pentagrama clásico (`at.StaveProfile.Score`) con clave (sol 8vb para guitarra, clave de fa `\clef bass` para bajo), armadura, compás, plicas calculadas, figuras rítmicas y líneas adicionales.
       - **Partitura + Tablatura (`ScoreTab`):** sistema dual acoplado (`at.StaveProfile.ScoreTab`) con barras de compás continuas y alineación temporal exacta entre notas de solfeo y trastes.
       - **Letra:** conmutación nativa de la fila de lírica bajo los compases mediante `settings.notation.elements.set(at.NotationElement.EffectLyrics, showLyrics)`.
   - **Interacción y sincronización con el ecosistema Guitar Aid:**
     - Control de interacción delegado en Guitar Aid (`enableUserInteraction: false`): `Shift + Clic` selecciona compases sin desplazar el cursor de reproducción ni seekear; arrastrar con el ratón (`beatMouseMove`) selecciona rangos continuos; clic sin Shift posiciona inmediatamente (`seekToTick`) actualizando en tiempo real `currentBar` y `currentBeat` en `songStore`.
     - Inhibición de selección de texto nativa del navegador mediante `user-select: none` y prevención de evento por defecto en `onMouseDown`.
     - Esto sincroniza de inmediato las notas sonando en el `Fretboard` y `Piano` (marcas `pinned` y `root` sobre `scale-bg`), y actualiza la celda enfocada en la cinta `SongTimelineBar` y la barra contextual (con actualización dinámica pulso a pulso del chip de acorde).

---

## 6. Columna derecha inferior: Panel `Análisis del fragmento` (`SongAnalysisPanel`)

Tarjeta de altura completa (`.analysisPanel`, `display: flex; flex-direction: column; height: 100%; border-radius: 10px; background: var(--surface-1); border: 1px solid var(--border)`):

### 6.1. Cabecera del panel (`flex-shrink: 0`, `padding: 12px 16px 10px`, `border-bottom: 1px solid var(--border)`)

- **Izquierda:**
  - Título **`Análisis del fragmento`** (`16 px`, `font-weight: 700`).
  - Subtítulo dinámico (`12 px`, `--app-muted`): `Analizando: compases {A}–{B} ({Sección})` cuando hay un rango seleccionado, o `Analizando: compás {N}` cuando se inspecciona un único compás.
- **Derecha:**
  - Etiqueta `FUENTE` (`10.5 px`, mayúsculas, `--app-muted`) + conmutador segmentado **`Pista activa`** | **`Todas`** (permite elegir si el análisis armónico pondera solo las notas de la pista de guitarra visible o combina todas las pistas melódicas/armónicas de la canción, excluyendo percusión).

### 6.2. Cuerpo central con scroll (`.analysisBody`, `flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px`)

Dividido en dos bloques principales:

#### Bloque 1 — `Tonalidad y escalas sugeridas`
- Encabezado de sección **`Tonalidad y escalas sugeridas`** (`13 px`, `font-weight: 600`, `margin-bottom: 8px`).
- Lista de tarjetas de candidatos ordenados (`1`, `2`, `3`…):
  - **Diseño de cada tarjeta (`.candidateCard`, `padding: 10px 12px`, `border-radius: 8px`, `display: flex; align-items: center; gap: 10px`):**
    - El candidato actualmente vigente/seleccionado lleva **borde turquesa `#14b8a6` (`1.5 px`)** y fondo `rgba(20, 184, 166, 0.08)`; los demás llevan borde `var(--border)` y fondo `var(--surface-2)`.
    - **Columna de orden (`20 px`):** número `1`, `2`, `3` en monoespaciada (`12 px`, `--app-muted`).
    - **Columna central (`flex: 1; min-width: 0`):**
      - Fila superior: nombre de la escala en negrita (`14 px`, p. ej. **`C mayor · Jónico`**, **`A menor natural · Eólico`**, **`C lidio`**) + insignia de porcentaje en monoespaciada (`11 px`, `padding: 1px 6px`, `border-radius: 4px`: verde `#10b981` / fondo `rgba(16, 185, 129, 0.16)` si `≥ 95 %`; ámbar `#f59e0b` / fondo `rgba(245, 158, 11, 0.16)` si `< 95 %`).
      - Fila inferior (`12 px`, `--app-muted`): razones estructuradas separadas por `·` (p. ej. `Cubre el 98 % de la duración · encaja con 4 de 4 acordes · 1 nota de paso: F♯`).
    - **Columna de acciones (`display: flex; gap: 6px; flex-shrink: 0`):**
      - Botón **`▶`** (`28×26 px`, reproduce la escala en 1 octava con `pluck.ts`).
      - Botón **`Fijar tonalidad`** (`height: 26px`, `padding: 0 9px`, `font-size: 11.5px`): fija manualmente esa escala/tonalidad para el fragmento o compás. Si ya está fijada manualmente, muestra **`✓ Fijada`** (con borde ámbar/turquesa) y volver a pulsarlo elimina el override manual restaurando el cálculo automático.
      - Botón **`↗ Sandbox`** (`height: 26px`, `padding: 0 9px`, `font-size: 11.5px`): envía esa escala al modo Sandbox.

#### Bloque 2 — `Acordes y progresión en {Tonalidad}`
- Encabezado **`Acordes y progresión`** seguido en tono atenuado de `en {Tonalidad activa}` (p. ej. `Acordes y progresión en C mayor`).
- **Tira horizontal de chips de la progresión (`.progressionStrip`):**
  - Muestra cada compás del fragmento como `c.{N}` (`11 px`, `--app-muted`) + botón chip **`{Acorde} {Grado}`** (p. ej. `c.5 [C I] → c.6 [G V] → c.7 [Am vi] → c.8 [F IV]`).
  - El chip del **compás inspeccionado (`c.7 [Am vi]`)** se resalta con **borde ámbar `#f59e0b` (`1.5 px`)**, fondo `rgba(245, 158, 11, 0.18)` y texto `#fbbf24`.
  - **Anclaje de inspección:** hacer clic en cualquier chip (`c.5`, `c.6`, `c.7`, `c.8`) ancla ese compás como **compás inspeccionado** en la subsección inferior (`CANDIDATOS DEL COMPÁS X`). Mientras haya un compás anclado por el usuario, la lista de candidatos inferior permanece fija en ese compás aunque el reproductor siga avanzando en bucle por la canción.
- **Fila de diagnóstico de plantilla y audio:**
  - Izquierda (`12 px`, `--app-muted`): indica si la secuencia coincide con una plantilla del catálogo (p. ej. `Coincide con la plantilla ` **`I–V–vi–IV`** ` · progresión habitual`).
  - Derecha: botón **`▶ Escuchar progresión`** (`height: 26px`, reproduce secuencialmente los acordes del fragmento usando `progressionEvents` y `pluck.ts`).
- **Subsección `CANDIDATOS DEL COMPÁS {X}`:**
  - Encabezado en mayúsculas (`11 px`, `--app-muted`, `letter-spacing: 0.05em`): `CANDIDATOS DEL COMPÁS {X}`.
  - Lista de tarjetas de candidatos de acorde para ese compás (`1. Am vi 94 %`, `2. Am7 vi7 72 %`…):
    - Muestra orden, nombre del acorde en negrita (`14 px`), grado romano respecto a la tonalidad activa (`vi`, `vi7`), insignia porcentual y razones detalladas (`Contiene las 3 notas (A C E) · bajo en A en tiempo 1` / `Falta la 7ª (G) en el compás`).
    - Botones a la derecha: **`▶`** (escuchar acorde/arpegio), **`Fijar`** (fija el acorde para ese compás marcándolo con el punto ámbar `●` en la cinta; si ya está fijado muestra **`✓ Fijado`** y permite deshacerlo al pulsarlo de nuevo) y **`↗ Sandbox`**.

### 6.3. Pie fijo del panel: `Llevar este fragmento a otro modo` (`flex-shrink: 0`)

Separado por `border-top: 1px solid var(--border)` (`padding: 10px 16px 12px`):
- Título **`Llevar este fragmento a otro modo`** (`12.5 px`, `font-weight: 600`, `margin-bottom: 8px`).
- Cuadrícula de 3 botones (`grid-template-columns: repeat(3, 1fr); gap: 8px`):
  1. **`↗ Abrir en Sandbox`** (`height: 34px`, botón primario con fondo turquesa `#14b8a6`, texto oscuro `#042f2e`, `font-weight: 700`): transfiere el contexto activo (escala o acorde enfocado) al `sandboxStore` y cambia a la vista `Sandbox`.
  2. **`Crear / añadir a mazo SRS`** (`height: 34px`, botón secundario): abre el diálogo rápido de exportación a `decksStore` con las tarjetas de los acordes, digitaciones, escala y progresión del fragmento.
  3. **`Practicar en Ejercicios`** (`height: 34px`, botón secundario): navega a la pestaña `Ejercicios` del modo `Aprender` preconfigurando las cuerdas y el rango de trastes utilizados en el fragmento.

---

## 7. Modales y Popovers secundarios

1. **`SongLibraryModal` (al pulsar `📁 Canciones` o arrastrar un archivo):**
   - Diálogo modal accesible (`role="dialog"`, `aria-modal="true"`, cerrable con `Esc`):
     - **Zona superior de importación (*Drag & Drop* + selector de archivo):** acepta `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`, `.tg`, `.xml`/`.musicxml` y `.tex`. Muestra aviso accesible (`role="alert"`) si un archivo está corrupto sin alterar la canción en curso.
     - **Pestaña `Biblioteca reciente` (IndexedDB):** lista las canciones importadas por el usuario con título, artista, afinación, fecha de última apertura, número de anotaciones manuales guardadas (`●`) y botón de eliminar con confirmación en línea.
     - **Pestaña `Canciones de ejemplo`:** lista las 3 canciones integradas en AlphaTex (`Pop Diatónico en C/Am`, `Blues & Rock Riff en E`, `Modulación y Menor Armónica en Am/C`) con descripción de qué conceptos teóricos ejemplifica cada una.
2. **`TrackMixerPopover` (al pulsar `Mezclador`):**
   - Popover flotante anclado bajo el botón `Mezclador` (`width: 340px`, cerrable con `Esc` o clic fuera):
     - Fila por cada pista de la canción (`Guitarra 1`, `Guitarra 2`, `Bajo`, `Batería`): nombre e icono, botones **`M`** (*Mute*) y **`S`** (*Solo*) y deslizador de volumen (`0–100 %`).
     - Pie del popover: interruptor **`Cuenta atrás (1 compás al reproducir)`** y control de volumen del metrónomo.

---

## 8. Accesibilidad y atajos de teclado del Modo Canción

| Contexto | Atajo | Acción |
|---|---|---|
| Modo Canción | <kbd>Espacio</kbd> | `Reproducir` / `Pausa` |
| Modo Canción | <kbd>L</kbd> | Activar / desactivar `Bucle` sobre el rango o sección actual |
| Modo Canción | <kbd>←</kbd> / <kbd>→</kbd> | Ir al compás anterior / siguiente |
| Modo Canción | <kbd>Home</kbd> | Ir al primer compás de la canción (o del bucle activo) |
| Global | <kbd>M</kbd> | Alternar sonido global (silencia tanto `AlphaSynth` como `pluck.ts`) |
| Global (solo Sandbox) | <kbd>C</kbd> | Ignorado en Canción (no limpia el Sandbox) |
| Modales / Selección | <kbd>Esc</kbd> | Cerrar popover/modal abierto o, si no hay ninguno abierto, quitar la selección de compases |

---

## 9. Mapa de componentes (`src/ui/song/`)

| Hito | Ruta del componente | Responsabilidad |
|---|---|---|
| **C5 / C6b** | `src/ui/song/AlphaTabViewport.tsx` | Contenedor visible de AlphaTab en tema oscuro integrado (modos nativos `Tab`, `Partitura`, `Partitura + Tab` y `Letra`), con barra contextual superior de acordes analizados, secciones y bucle |
| **C6** | `src/ui/song/SongView.tsx` | Contenedor principal (`100vh`) conectado a `songStore`, `settingsStore`, `sandboxStore`, `decksStore`, `drillsStore`, `audioEngine` y `alphaSynthController` |
| **C6** | `src/ui/song/SongTopBar.tsx` | Barra superior compacta con biblioteca, selector de pista, mezclador, transporte, bucle, velocidad y selector de vista |
| **C6** | `src/ui/song/TrackMixerPopover.tsx` | Popover multipista con `Mute`, `Solo`, `Volumen` por pista y cuenta atrás |
| **C6** | `src/ui/song/SongContextStrip.tsx` | Franja superior de instrumentos con compás/pulso, sección, selectores de tonalidad y acorde (con soporte de override), referencia de grados (`Tonalidad \| Acorde`) y etiquetas |
| **C6** | `src/ui/instruments/Fretboard.tsx` | Extensión opcional `capoFret?: number` para dibujar la cejilla cuando la pista lleva `Capo > 0` |
| **C7** | `src/ui/song/SongLibraryModal.tsx` | Modal de Biblioteca reciente (`IndexedDB`), canciones de ejemplo e importación de archivos `.gp`/`.tg`/`.xml` con *Drag & Drop* |
| **C8** | `src/ui/song/SongTimelineBar.tsx` | Cinta horizontal de secciones (con aviso de modulación en violeta) y celdas de compases (con auto-scroll, foco en ámbar e indicador `●` de override manual) |
| **C8 / C9** | `src/ui/song/SongAnalysisPanel.tsx` | Panel derecho con selector `Fuente: Pista activa \| Todas`, candidatos de tonalidad/escala, tira de progresión, candidatos del compás anclado, botones `Fijar` / `✓ Fijado` y pie de puentes a Sandbox y Aprender |
