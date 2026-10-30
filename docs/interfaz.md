# Guitar Aid — Especificación de interfaz (Sandbox, Fase 1.1 / Hito H5 a–e)

Sustituye al layout previo del Sandbox. Mockup de referencia: lienzo Design "Guitar Aid — Rediseño de la interfaz (Sandbox)" (pantalla principal y menú Ajustes). Si este documento y el mockup difieren, prevalece este documento. No cambia la teoría pura ni el modelo de datos de [plan_fase1_1.md](plan_fase1_1.md); reorganiza y optimiza `src/ui/`.

## 1. Principios

1. **Los instrumentos son el protagonista.** Ocupan el ancho completo y nunca se solapan con paneles.
2. **Una sola pantalla, minimizando el scroll en todo momento:** optimizado principalmente para **1920×1080** y **2560×1440** (con adaptación limpia a 1440×900 y fallback a `< 1100 px`). Las listas internas usan cuadrículas multicolumna adaptativas para mostrar todos los grados o sugerencias principales de un vistazo sin scroll vertical.
3. **Lo que se usa a menudo está a la vista; lo demás, en Ajustes.**
4. **Siempre se ve qué se está analizando** (objeto y origen).
5. **Solo orientación horizontal.** Tema oscuro por defecto con variables CSS; el tema claro redefine las mismas variables.
6. **Separación armónica clara en el dashboard:** la Columna 2 se dedica exclusivamente a acordes y progresiones, mientras la Columna 3 se dedica a escalas compatibles y relativas, sin submenús conmutadores duplicados.

## 2. Estructura y presupuesto de altura (1920×1080 y 2560×1440)

| Zona | Alto (1920×1080 / 2560×1440) | Alto (≤ 950 px) | Contenido |
|---|---|---|---|
| Menú lateral | 76 px de ancho (colapsado) o 240 px (expandido), alto completo | 76 px / 240 px | Logo, Sandbox, Tests, Canción, atajos, colapsar/expandir |
| Barra superior | 48 px / 54 px | 46 px | Escala, Acorde, Reproducción, Sonido, Limpiar, Ajustes |
| Instrumentos | 378 px / 462 px | 346 px | Franja de contexto (40 / 44 / 38 px) · Mástil (220 / 270 / 196 px) · Piano (108 / 136 / 96 px) · huecos de 6 px |
| Dashboard | resto (≈ 634 px en 1080p / ≈ 904 px en 1440p) | ≈ 480 px | 3 columnas iguales, margen 4/16/12, hueco 12, cabeceras de 36 px |

- Ancho útil centrado con `--content-max-width: 2440px` para escalar proporcionalmente sin deformar en **2560×1440**. Cuadrícula del dashboard: `repeat(3, minmax(0, 1fr))`.
- `.sandbox { height: 100vh; overflow: hidden }`. Cada columna: cabecera fija de 36 px y cuerpo con `overflow-y: auto` e ítems distribuidos en cuadrícula adaptativa (`repeat(auto-fill, minmax(...))`) para minimizar el scroll en **1920×1080** y **2560×1440**.
- Por debajo de 1100 px de ancho el dashboard pasa a 1 columna y se permite scroll de página (`@media (max-width: 1100px)`). No hay otra adaptación móvil.

## 3. Barra superior (48 px en 1080p / 54 px en 1440p / 46 px en ≤ 950p, una fila)

De izquierda a derecha:

1. *(El logo vive en el menú lateral; la barra empieza por el grupo Escala.)*
2. **Grupo Escala:** `Tónica` (select nativo compacto) + disparador `Tipo` (`ScalePicker`, en marco agrupado `div[role="group"]`). Al abrir el desplegable de `Tipo` se muestra un popover categorizado en 2 columnas (`MAYOR Y MODOS`, `MENORES ALTERADAS`, `PENTATÓNICAS Y BLUES`, `NAPOLITANAS`, `BEBOP`, `SIMÉTRICAS`) con buscador en tiempo real, contador de escalas, fórmula de grados por escala y barra inferior de previsualización en vivo (`Previsualizando <Escala> <fórmula> · <contexto madre>`) más atajos (`↵ aplicar` · `Esc cerrar`).
3. **Grupo Acorde:** `Tónica` (select nativo compacto) + disparador `Calidad` + botón `Quitar` (`ChordPicker`, en marco agrupado `div[role="group"]`). Al abrir el desplegable de `Calidad` se muestra un popover categorizado en 2 columnas (`TRÍADAS`, `SEXTAS Y AÑADIDAS`, `SÉPTIMAS`, `NOVENAS`) con buscador, cifrado dinámico según la tónica actual (`C`, `Cm`, `C°`, `C+`, `Cmaj7`, etc.), nombre en español, fórmula de grados y barra inferior de previsualización en vivo (`Previsualizando <Acorde> <notas> · <calidad>`).
4. **Reproducción** (segmentado): `▶ Acorde · ▶ Arpegio · ▶ Escala`. **Siempre visible**: cuando no hay selección reproducible disponible, los botones se muestran deshabilitados (`disabled` con opacidad atenuada y tooltip descriptivo), evitando saltos o huecos vacíos en la barra.
5. Espacio flexible (`flex: 1`).
6. `Sonido [M]` (`aria-pressed`), `Limpiar [C]`, `Ajustes` (`aria-haspopup="dialog"`, `aria-expanded`).

El grupo cuyo contexto está activo lleva borde y fondo de acento azul (`#3b82f6` / `#101b33`). Solo uno puede estar activo. Un contexto de menú nunca borra las notas pulsadas; `Quitar` solo quita el contexto.

## 4. Franja de contexto (38 px, sobre el mástil)

Diseñada con maquetación rígida para garantizar que ningún botón salte bajo el cursor:

- **Izquierda, "Analizando":**
  - Anclada con `min-width: 290 px` y `max-width: 330 px` para estabilizar el inicio de la sección central.
  - Formato: `Analizando · {nombre} · {origen}` (ej. "Cm(maj7) · menú · raíz C", "notas pulsadas C3 E3 G3").
  - Si conviven notas y contexto, muestra las dos pestañas conmutadoras (`Notas` / `Contexto`) para alternar el sujeto enfocado.
- **Centro, solo si hay acorde** (de contexto o `chordFocus`):
  - Selector `Familia` (select nativo con ancho fijo de 95 px): `Todos · Abiertos · Cejilla · Cuerdas 1–4 · Cuerdas 1–3`. Permanece en posición fija e inmóvil.
  - Navegador de voicings: `‹ {Familia} · {Inversión} · Digitación {N} de {Total} ›`.
  - El texto está contenido en un bloque `.voicingTextWrapper` de ancho fijo (270 px) y alineación centrada. Gracias a esto, los botones `‹` y `›` no se desplazan ni un solo píxel al recorrer las digitaciones consecutivamente.
  - La representación de trastes numéricos (ej. `x-0-2-0-1-0`) se muestra en una insignia monoespaciada compacta (`data-testid="voicing-frets"`).
  - **Formato consistente de digitaciones:** todos los voicings se formatean con guiones separadores entre cuerdas (`x-0-2-0-1-0`, `x-x-1-4-1-3`, `x-x-10-12-11-12`).
  - Con `chordFocus` activo sobre una escala: conmutador `Digitación | Notas en la escala`, botón `Ir al acorde` (para promover el acorde enfocado a contexto principal) y botón `Quitar foco`.
  - Sin voicings para la afinación: aviso descriptivo accesible.
- **Derecha, Etiquetas:**
  - `Etiquetas: Nota · Intervalo · Grado · Ninguna`. Anclada al extremo derecho (`margin-left: auto; flex-shrink: 0;`), protegida de empujes y desbordamientos.

## 5. Mástil (220 px en 1080p / 270 px en 1440p / 196 px en ≤ 950p)

- Un único `<svg>` de 1316×214 px escalado de forma proporcional y nítida dentro de la tarjeta (`max-width: 1960px`).
- Etiqueta de cuerda a la izquierda (E B G D A E), cejuela en `x = 64` y 24 trastes con **espaciado proporcional real decreciente**: $x(n) = 64 + 1236 \cdot \frac{1 - 2^{-n/12}}{0.75}$.
- Las marcas van en el mismo SVG, centradas entre el traste n−1 y el n (al aire: `x = 44`).
- Cuerda 1 arriba, cuerda 6 abajo (con modo zurdo se invierte el eje horizontal dejando la cejuela a la derecha y manteniendo cuerda 1 arriba y cuerda 6 abajo). Cuerdas de 1 a 3,2 px de grosor, de aguda a grave.
- Marcas de traste 3, 5, 7, 9, 12 (doble), 15, 17, 19, 21, 24 (doble). Números bajo el mástil en esos trastes.
- Marcas de 24 px de diámetro. Cuerdas al aire a la izquierda de la cejuela. Cuerda muteada en el voicing activo: `×` (`data-muted-string`).
- Pie derecho: "Afinación · cuerdas · 24 trastes".
- Clic en posición: fija o desfija nota. Clic derecho: "fijar como raíz".

## 6. Piano (108 px en 1080p / 136 px en 1440p / 96 px en ≤ 950p)

- Un único `<svg>` de 1316×108 px escalado de forma proporcional (`max-width: 1960px`).
- Rango C2–C7: 36 teclas blancas de 36 px = 1296 px, centradas. Teclas negras de 22×52 px, centradas sobre la línea entre teclas blancas (tras C, D, F, G y A).
- Marcas de 22 px sobre la parte baja de la tecla. Etiqueta de octava (C2…C7) bajo cada Do.
- Si el ancho disponible se reduce, desplazamiento horizontal dentro de la tarjeta con auto-scroll a la nota activa.

## 7. Roles de marca (mástil y piano)

| Rol | Relleno (oscuro / claro) | Forma |
|---|---|---|
| `pinned` | `#14b8a6` / `#0f766e` | Círculo opaco, borde sólido grueso |
| `root` | `#f59e0b` / `#b45309` | Círculo opaco con doble anillo interior |
| `tone` | `#3b82f6` / `#1d4ed8` | Círculo opaco, borde sencillo |
| `scale-bg` | `#1e293b` / `#dbeafe` | Más pequeño (18 px), borde punteado fino |
| `preview` | `#3b0764` / `#f3e8ff` | Borde discontinuo largo (violeta) |
| `equivalent` | transparente | Hueco, borde del color de `pinned` |

`pinned` + `isRoot` combina relleno verde y anillo interior. Texto sobre relleno con alto contraste ≥ 4,5:1. El rol nunca se distingue únicamente por color.

## 8. Dashboard (3 columnas)

Cada columna es una tarjeta con cabecera fija de 36 px (título a la izquierda, indicación/hint breve y dinámico a la derecha) y cuerpo con scroll independiente.

### Columna 1 — Selección (`InfoPanel`)
- Rediseño simplificado y depurado en estilo oscuro:
  - **Modo contexto (escala o acorde):** título en tamaño destacado (`18 px`, ej. `Am7` o `C mayor`), subtítulo descriptivo con información de escala madre (`scaleParentContext`, p. ej. `"II grado de C mayor"`) o nota de simetría en escalas disminuidas, tarjeta de acorde en foco (`chordFocus`) si aplica, y tabla limpia de 3 columnas (`NOTA`, `INTERVALO`, `GRADO`) con puntos de rol de color (`root`, `tone`).
  - **Modo notas pulsadas:** contador de notas, selector compacto de raíz (`Raíz: Automática ▾` o fija en cualquier nota), tabla de intervalos y detección de acordes ordenados por probabilidad ("No se reconoce ningún acorde" si procede), con aviso de notas fuera del rango físico de la guitarra cuando aplique.
  - **Leyenda:** bloque inferior visual con los marcadores de rol (`Pulsada`, `Raíz`, `Contexto`, `Equivalente`, `Fondo escala`, `Previsualización`).

### Columna 2 — Armonía y Progresiones (`SuggestionsPanel`)
- Cabecera de tarjeta: `Armonía y Progresiones` con hint (`clic = foco` si el contexto es escala; `progresiones` en los demás casos).
- **Sin submenú conmutador:** no hay botones de cambio entre acordes y escalas; la columna central se concentra íntegramente en la parte armónica y de acordes.
- **Cabecera interna compacta:** el encabezado `<h2>` muestra directamente `Analizando: <contexto>` (con `data-testid="suggestions-subject-header"`), eliminando títulos redundantes ("Sugerencias") y optimizando el espacio vertical.
- **Comportamiento según el foco:**
  - *Foco en selección de notas:* sugiere progresiones armónicas populares si las notas forman un acorde reconocido, o acordes que contienen todas las notas si son notas sueltas.
  - *Foco en escala:* incluye el conmutador **`Tríadas` / `Cuatríadas (7ª)`** (para escalas heptatónicas y Bebop) y muestra los acordes diatónicos / dentro de la escala y sus grados romanos (I, ii, iii, IV, V, vi, vii°). Al pulsar un acorde se activa/desactiva `chordFocus` (dejando la escala en `scale-bg`); el botón lateral `↗` (`"Ir al acorde [Nombre]"`) pivota el contexto principal a ese acorde.
  - *Foco en acorde:* muestra progresiones armónicas sugeridas que contienen dicho acorde en distintas funciones y tonalidades, resaltando el acorde actual (`data-current-degree="true"`). Al pulsar otro acorde de la progresión se activa `chordFocus` sobre él mostrando la barra con **`"Volver a [Acorde]"`** e **`"Ir al acorde"`**.

### Columna 3 — Escalas (`ScalesPanel`)
- Cabecera de tarjeta: `Escalas` con hint (`relativas · cercanas` si el sujeto activo es escala; `escalas compatibles` en los demás casos).
- **Siempre activa y complementaria:** nunca queda vacía al enfocar notas o acordes, y respeta la prioridad de capa (`subject.layer`).
- **Comportamiento según el foco:**
  - *Foco en escala:*
    - Bloque desplegable `Escalas relativas (mismas notas)` excluyendo la propia escala activa, ordenadas de `I` a `VII` en escalas heptatónicas y con la relativa directa en primer lugar en pentatónicas/blues (ej. `C Pentatónica mayor` para `A Pentatónica menor`), mostrando los grados respecto a la escala madre.
    - Bloque `Por proximidad y popularidad` con las variantes de escala que difieren en 1 o 2 notas.
  - *Foco en acorde:* sugiere la lista de escalas compatibles que contienen dicho acorde (`rankScalesForChord`).
  - *Foco en selección de notas:* sugiere escalas compatibles que contienen las notas pulsadas (escalas sobre la tónica y escalas contenedoras).
- **Interacción unificada:** todas las escalas sugeridas permiten previsualización en mástil y piano al pasar el cursor (`onMouseEnter` / `onFocus` activa `preview`), cancelación al salir (`onMouseLeave` / `onBlur` o tecla `Escape`) y aplicación como nuevo contexto de escala al hacer clic (`onClick`).

## 9. Menú Ajustes (popover flotante, 392 px)

Anclado bajo el botón con una flecha (caret) que apunta a él, secciones separadas por línea y sombra suave. Se abre sobre el contenido con `role="dialog"`, y se cierra con `Escape`, botón `✕` o clic fuera:

1. `Afinación` (select nativo con 7 afinaciones: Estándar, Drop D, DADGAD, Medio tono abajo, Un tono abajo, Open D, Open G) y fichas informativas de las notas de las cuerdas (`6 → 1`).
2. `Nombres de notas`: selector segmentado `Sostenidos ♯ | Bemoles ♭`.
3. Sección `Vista`: cuatro filas con interruptores deslizantes accesibles (`role="switch"`, `aria-checked`):
   - `Mostrar todas las posiciones` (posiciones equivalentes huecas).
   - `Modo zurdo` (invierte horizontalmente el mástil).
   - `Mostrar guitarra` y `Mostrar piano` (con salvaguarda accesible: si se intenta ocultar el único instrumento visible, se impide y se notifica que siempre debe quedar uno visible).
4. `Volumen` (control deslizante 0–100 % con lectura de valor en tiempo real).
5. Nota de persistencia: "Se guardan en este navegador. La selección no se guarda."

## 10. Tokens y estilos globales

- **Fuentes:** pila tipográfica local con `'IBM Plex Sans'` y `'IBM Plex Mono'` más fallbacks del sistema (100% offline sin peticiones a CDNs externos).
- **Escala tipográfica:** 11 px (etiquetas en mayúsculas, trastes) · 12 px (ayudas, textos de tabla, digitaciones) · 13–14 px (texto base) · 18 px (título de sujeto en selección).
- **Paleta oscura (por defecto):**
  - Fondos: `--surface-0` (`#0a0c10`), `--surface-1` (`#11141a`), `--surface-2` (`#161a22`), `--surface-3` (`#0d1016`).
  - Bordes: `--border` (`#242936`), `--control-border` (`#2a3140`).
  - Acentos: `--accent` (`#3b82f6`), `--accent-soft` (`rgba(59, 130, 246, 0.15)`), fondo de grupo activo `#101b33`.
- **Radios:** controles 6 px, grupos 8 px, tarjetas 10 px. **Alto de controles:** 24–32 px.

## 11. Accesibilidad y atajos de teclado

- Controles nativos (`button`, `select`, `input`), con `aria-label` en controles iconográficos. Contraste de texto ≥ 4,5:1.
- Conmutadores segmentados con `aria-pressed`. Marcas interactivas con `aria-label` descriptivo ("Cuerda 5 traste 7, E3").
- Foco visible en todos los elementos interactivos con anillo de acento.
- Atajos globales del Sandbox:
  - <kbd>C</kbd>: limpiar selección activa.
  - <kbd>M</kbd>: alternar sonido (mute).
  - <kbd>Esc</kbd>: cerrar popover de Ajustes, quitar previsualización o quitar foco de acorde.
  - Flechas <kbd>←</kbd> / <kbd>→</kbd>: navegar entre voicings en el navegador de digitaciones enfocado.

## 12. Mapa de componentes (`src/ui/`)

| Zona | Componente | Descripción |
|---|---|---|
| Menú lateral | `layout/SideNav` | Navegación entre Sandbox, Tests y Canción con soporte colapsado/expandido |
| Barra superior | `toolbar/TopBar` | Contenedor principal de la barra de herramientas superior |
| Pickers de contexto | `pickers/ScalePicker`, `pickers/ChordPicker` | Selectores de escala y acorde en grupos alineados |
| Grupo de reproducción | `toolbar/PlaybackGroup` | Botones de reproducción persistentes con estado deshabilitado según selección |
| Menú Ajustes | `toolbar/SettingsPopover` | Popover modal accesible de ajustes y preferencias |
| Franja de contexto | `sandbox/ContextStrip` | Sujeto analizado, navegador de digitaciones estable y selector de etiquetas |
| Instrumentos | `instruments/Fretboard`, `instruments/Piano` | Componentes visuales SVG puros gobernados por props y eventos |
| Dashboard - Columna 1 | `panels/InfoPanel` | Información teórica del sujeto, tabla de notas/intervalos/grados y leyenda |
| Dashboard - Columna 2 | `panels/SuggestionsPanel` | Armonía, acordes diatónicos de la escala y progresiones armónicas |
| Dashboard - Columna 3 | `panels/ScalesPanel` | Escalas relativas/cercanas y catálogo de escalas compatibles |
| Contenedor Sandbox | `sandbox/SandboxView` | Conector principal de stores (`sandboxStore`, `settingsStore`, `audioEngine`) |
