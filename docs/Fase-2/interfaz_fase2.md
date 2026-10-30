# Guitar Aid — Especificación de interfaz (Modo Aprender, Fase 2 / Hitos A6–A9)

Documento canónico del diseño visual e interactivo del **Modo Aprender** (Fase 2). Toma como referencia las maquetas situadas en `docs/Fase-2/`:
- [Ejercicios.png](Ejercicios.png)
- [Tarjetas.png](Tarjetas.png)
- [Fórmulas.png](Fórmulas.png)
- [Progreso.png](Progreso.png)

Si este documento y alguna maqueta difieren en un detalle menor, prevalece este documento. El modelo de dominio, la capa `src/learning/`, los stores y los criterios de aceptación están definidos en [plan_fase2.md](plan_fase2.md); este documento especifica la capa `src/ui/` (hitos **A0** y **A6–A9**).

---

## 1. Principios de diseño

1. **Continuidad visual con el Sandbox:** reutiliza el mismo sistema de tokens (`--surface-0` a `--surface-3`, `--border`, `--accent`, etc.), tipografía local (`IBM Plex Sans` e `IBM Plex Mono`, 100 % offline) y navegación lateral (`SideNav`).
2. **Una sola pantalla, sin scroll de ventana:** optimizado para **1920×1080** y **2560×1440** (con adaptación limpia a **1440×900** y caída a 1 columna por debajo de `1100 px`). El contenedor principal mantiene `height: 100vh; overflow: hidden;` y el scroll solo ocurre dentro de las listas internas que lo necesiten.
3. **Foco sin distracciones durante el estudio:** la barra superior del modo Aprender muestra únicamente las 4 sub-secciones (`Ejercicios`, `Tarjetas`, `Fórmulas`, `Progreso`) y el indicador de racha diaria (`Racha: N días`). Los selectores de contexto del Sandbox no aparecen aquí y el atajo <kbd>C</kbd> queda deshabilitado para no borrar accidentalmente la selección del Sandbox.
4. **Visión lineal siempre acompañada del piano:** en los ejercicios, el mástil acotado al rango de trabajo y el piano aparecen sincronizados con las mismas marcas para conectar la geometría de la guitarra con la disposición lineal de semitonos.
5. **Retroalimentación accesible que no depende solo del color:** los estados de corrección se distinguen simultáneamente por **color, forma, trazo de borde y símbolo interior** (`●` referencia, `▢×` respuesta incorrecta, `◌` correcta que faltó, `○✓` acierto).
6. **Flujo ágil por teclado:** todas las acciones repetitivas de estudio tienen atajos directos (<kbd>Enter</kbd> comprobar/siguiente en ejercicios; <kbd>Espacio</kbd> mostrar respuesta y <kbd>1</kbd>–<kbd>4</kbd> valorar en tarjetas).

---

## 2. Estructura general y presupuesto de altura (`AppShell` y `LearnView`)

| Zona | Dimensiones (`1920×1080` / `2560×1440` / `≤ 950 px`) | Contenido |
|---|---|---|
| **Menú lateral (`SideNav`)** | `76 px` de ancho colapsado (`240 px` expandido), `100vh` | Logo, `Sandbox`, **`Aprender`** (icono de diana concéntrica, activo con barra azul e iluminación `#162032`), `Canción` (`próx.`), atajos contextuales y colapsar/expandir |
| **Barra superior (`LearnTopBar`)** | `48 px` / `54 px` / `44 px` de alto · margen `12px 16px 0` | Pestañas `Ejercicios · Tarjetas · Fórmulas · Progreso` a la izquierda; `Racha: N días` (más acceso opcional a `Sonido [M]` y `⚙ Ajustes`) a la derecha |
| **Área de trabajo de la sección** | Resto del alto (`flex: 1; min-height: 0; padding: 12px 16px 16px`) | Grid específico de cada sub-sección (`Ejercicios`, `Tarjetas`, `Fórmulas` o `Progreso`), centrado hasta `--content-max-width: 2440px` |

- **`AppShell` (`src/ui/shell/AppShell.tsx`, Hito A0):**
  - Envuelve a `SideNav`, `SandboxView` y `LearnView` desde `App.tsx`.
  - Cambiar entre `Sandbox` y `Aprender` preserva intacto el estado de `sandboxStore` (`notes`, `context`, `chordFocus`, `harmonyProgression`).
  - El botón **"Abrir en Sandbox"** presente en `Tarjetas` y `Fórmulas` escribe el acorde, digitación o escala en `sandboxStore.setContext(...)` y conmuta `currentMode` a `'sandbox'`.
- **Barra superior de Aprender (`LearnTopBar`):**
  - Contenedor en tarjeta redondeada (`border-radius: 10px`, `background: var(--surface-1)`, `border: 1px solid var(--border)`).
  - Lista de pestañas accesible (`role="tablist"`, `aria-label="Secciones de Aprender"`):
    - Cada pestaña (`role="tab"`, `aria-selected`) tiene `height: 34px`, `padding: 0 16px`, `border-radius: 7px`.
    - La pestaña activa usa fondo `--surface-2` (`#1e293b`), texto blanco en negrita (`font-weight: 600`) y sin salto de ancho.
  - A la derecha (`margin-left: auto`): insignia de racha diaria **`Racha: {n} días`** (`13 px`, `--app-muted`). Un día cuenta para la racha cuando se completa al menos 1 sesión de ejercicio o 1 repaso de tarjeta (cambio de día a las `04:00` hora local).

---

## 3. Roles de marca de aprendizaje y extensiones de `Fretboard` / `Piano`

### 3.1. Nuevos roles en `MarkRole` (`src/state/shared/marks.ts`)

Además de los 6 roles del Sandbox (`pinned`, `root`, `tone`, `scale-bg`, `preview`, `equivalent`), `Fretboard` y `Piano` soportan 4 roles de evaluación:

| Rol (`MarkRole`) | Significado en leyenda | Estilo oscuro / claro | Distinción por forma, borde y símbolo |
|---|---|---|---|
| `question` | `Referencia (pregunta)` | Relleno `#14b8a6` / `#0d9488`, texto `#042f2e` / `#ffffff` | **Círculo sólido opaco** (`r = 12` en mástil, `r = 11` en piano) con etiqueta en negrita (p. ej. `C` o `1`) |
| `wrong` | `Tu respuesta, incorrecta` | Relleno `rgba(127, 29, 29, 0.55)` / `#fee2e2`, trazo `#f87171` / `#dc2626` | **Cuadrado redondeado** (`22×22 px`, `rx = 5`), borde sólido (`2 px`) y aspa central **`×`** |
| `missed` | `Correcta que faltó` | Relleno `rgba(245, 158, 11, 0.14)` / `#fef3c7`, trazo `#f59e0b` / `#d97706`, texto `#fcd34d` / `#92400e` | **Círculo de borde discontinuo** (`stroke-dasharray: 3.5 2.5`, `2 px`) con la etiqueta correcta dentro (p. ej. `M3`, `E`) |
| `correct` | `Acierto` | Relleno `rgba(34, 197, 94, 0.22)` / `#dcfce7`, trazo `#22c55e` / `#16a34a`, texto `#4ade80` / `#14532d` | **Círculo de borde sólido grueso** (`2.25 px`) con marca de verificación **`✓`** o la etiqueta acertada |

- **Prioridad de superposición en `marks`:** `wrong` / `correct` / `missed` > `question` > `pinned` > `root` > `tone` > `scale-bg` > `preview` > `equivalent`.

### 3.2. Nuevas props opcionales en `Fretboard` (`src/ui/instruments/Fretboard.tsx`)

Todas son opcionales y mantienen el comportamiento actual por defecto para no alterar el Sandbox:

```ts
export interface FretboardProps {
  tuning: Tuning;
  frets?: number;
  /** Rango visible de trastes (por defecto { from: 0, to: frets ?? 24 }). */
  fretRange?: { from: number; to: number };
  /** Subconjunto de cuerdas activas (1..6). Las demás se atenúan y no aceptan clic. */
  activeStrings?: ReadonlySet<StringNumber>;
  /** Muestra u oculta los puntos de referencia de los trastes 3, 5, 7, 9, 12… (por defecto true). */
  showInlays?: boolean;
  leftHanded?: boolean;
  marks?: readonly FretMark[];
  mutedStrings?: ReadonlySet<StringNumber>;
  onPositionClick?: (pos: FretPosition) => void;
  onPositionContextMenu?: (pos: FretPosition) => void;
}
```

- **Recorte del rango de trastes (`fretRange`):** cuando el ejercicio configura `0–12` o `0–5`, el SVG del mástil escala el tramo `[from..to]` ocupando el ancho del contenedor (como se observa en [Ejercicios.png](Ejercicios.png), donde los trastes `0` a `12` se ven amplios y legibles con números en `3, 5, 7, 9, 12`).
- **Atenuación de cuerdas inactivas (`activeStrings`):** las cuerdas que pertenecen a `activeStrings` se dibujan con opacidad `1` y grosor normal; las cuerdas fuera del conjunto se dibujan atenuadas (`opacity: 0.28`) y sus celdas tienen `pointer-events: none` y `tabIndex={-1}`.
- **Ocultación de inlays (`showInlays === false`):** omite los círculos de referencia de los trastes (`3, 5, 7, 9, 12…`) para evitar que el usuario cuente trastes apoyándose en los puntos.

---

## 4. Sección 1 — `Ejercicios` ([Ejercicios.png](Ejercicios.png))

### 4.1. Layout de 3 columnas

```
grid-template-columns: 240px minmax(0, 1fr) 260px;
gap: 16px;
height: 100%;
```

### 4.2. Columna izquierda — Selector de Ejercicios (`240 px`)

Tarjeta (`.drillsSidebar`) con título **`Ejercicios`** (`16 px`, `font-weight: 600`) y lista de los 9 ejercicios agrupados en 3 bloques con encabezado en mayúsculas (`11 px`, `--app-muted`, `letter-spacing: 0.06em`):

1. **`NOTAS`**
   - `A1` · **Encuentra la nota**
   - `A2` · **Nombra la nota**
2. **`INTERVALOS`**
   - `B1` · **Intervalo en una cuerda**
   - `B2` · **Entre cuerdas**
   - `B3` · **Nombra el intervalo**
   - `B4` · **Mapa de intervalos**
   - `B5` · **Etiqueta la forma**
3. **`CONSTRUIR`**
   - `C1` · **Construye el acorde**
   - `C2` · **Escala en una cuerda**

- Cada fila es un botón (`role="option"` / `aria-current`) con el código (`A1`…`C2`) en fuente monoespaciada turquesa (`#14b8a6`, `12 px`, `font-weight: 600`) y el título a la derecha (`14 px`).
- El ejercicio seleccionado lleva fondo `#172236` (`border-radius: 8px`) y texto blanco en negrita. Cambiar de ejercicio inicia una nueva sesión con la configuración compatible de ese ejercicio.

### 4.3. Columna central — Pregunta, Instrumentos y Corrección (`1fr`)

Tarjeta principal (`.drillStage`) organizada verticalmente en 4 zonas:

1. **Cabecera de la pregunta:**
   - **Izquierda:**
     - Eyebrow en mayúsculas (`12 px`, `--app-muted`, `letter-spacing: 0.05em`): `{ID} · {NOMBRE DEL EJERCICIO}` (p. ej. `B1 · INTERVALO EN UNA CUERDA`).
     - Enunciado principal (`<h2>`, `22–24 px`, `font-weight: 700`, `line-height: 1.25`): texto directo con el objetivo resaltado en turquesa (`#14b8a6`), p. ej.:
       - **B1:** `Desde C3, sube una ` **`3ª mayor`** ` en la misma cuerda`
       - **B2:** `Desde C4 (cuerda 3), toca una ` **`3ª mayor`** ` en la cuerda 2`
       - **B3:** `¿Qué intervalo hay de ` **`C3`** ` a ` **`E3`** `?`
       - **A1:** `Encuentra la nota ` **`F♯`** ` en las cuerdas activas`
       - **A2:** `¿Qué nota es la posición marcada en la ` **`cuerda 4, traste 7`** `?`
       - **B4:** `Marca todas las ` **`♭3`** ` alrededor de la raíz ` **`A`**
       - **B5:** `Asigna el grado de cada nota del voicing de ` **`Am`**
       - **C1:** `Construye el acorde ` **`Dm7`** ` en la cuerda 4`
       - **C2:** `Toca la escala ` **`G mixolidia`** ` en la cuerda 3`
   - **Derecha:**
     - Texto `Pregunta {n} / {total}` (`12 px`, `--app-muted`, por defecto `20` preguntas por sesión).
     - Barra de progreso horizontal (`120 × 6 px`, `border-radius: 999px`, pista `#1e293b`, relleno turquesa `#14b8a6`).

2. **Mástil interactivo (`Fretboard`):**
   - Muestra el rango de trastes configurado (`0–5`, `0–12` o `0–24`), las cuerdas activas resaltadas (`activeStrings`) y los puntos de referencia según `Ocultar puntos`.
   - En fase de pregunta muestra la referencia con `role: 'question'` (círculo turquesa, p. ej. `C` en cuerda 5, traste 3).
   - Al corregir muestra simultáneamente `wrong` (cuadrado rojo con `×`), `missed` (círculo discontinuo ámbar con la etiqueta del intervalo/nota, p. ej. `M3`) y `correct` (círculo verde).

3. **Fila media — Piano lineal sincronizado + Leyenda (y botonera en ejercicios de elección):**
   - **Piano contextual (`Piano`):** recortado a las 2–3 octavas relevantes del ejercicio (p. ej. `C3–B4`, o desplazado automáticamente a la octava de la pregunta) mostrando exactamente las mismas marcas (`question`, `wrong`, `missed`, `correct`) dispuestas linealmente tecla a tecla.
   - **Leyenda de corrección** (a la derecha del piano, `13 px`):
     - `● Referencia (pregunta)` (círculo turquesa `#14b8a6`)
     - `▢× Tu respuesta, incorrecta` (cuadrado rojo `#f87171`)
     - `◌ Correcta que faltó` (círculo discontinuo ámbar `#f59e0b`)
     - `○✓ Acierto` (círculo verde `#22c55e`)
   - **Botonera de opciones (solo en ejercicios con `answerKind: 'pitchClass' | 'interval' | 'labels'`):**
     - **A2 (Nombra la nota):** fila de 12 botones de nota (`C`, `C♯`, `D`… según `nameMode`, o 7 naturales si se filtra).
     - **B3 (Nombra el intervalo):** fila de botones con los intervalos activos (`m2`, `M2`, `m3`, `M3`, `P4`, `TT`, `P5`, `m6`, `M6`, `m7`, `M7`, `P8`) mostrando abreviatura y nombre corto.
     - **B5 (Etiqueta la forma):** muestra una ficha por cada cuerda activa del voicing (con la raíz ya resuelta como `1`) y una fila de píldoras de grado (`1`, `♭2`, `2`, `♭3`, `3`, `4`, `♭5`, `5`, `♯5`, `6`, `♭7`, `7`, `9`) para asignar el grado a cada posición antes de pulsar `Comprobar · Enter`.

4. **Franja inferior de corrección y acción (`.feedbackBanner`):**
   - **Durante la pregunta (antes de corregir):**
     - En ejercicios de clic único (`mode === 'first'`, `B1`, `B2`, `A2`, `B3`): hacer clic en la posición o botón evalúa al instante sin paso intermedio.
     - En ejercicios de selección múltiple (`mode === 'all'`, `B4`, `B5`, `C1`, `C2`): muestra las posiciones seleccionadas (`pinned`) junto al botón primario **`Comprobar · Enter`** y contador `{seleccionadas} marcadas`.
   - **Tras corregir (`role="status"`, `aria-live="polite"`):**
     - **Si es incorrecto:** contenedor con fondo `rgba(127, 29, 29, 0.22)` y borde `#7f1d1d` (`border-radius: 10px`, `padding: 14px 18px`).
       - Texto explicativo a la izquierda (`14 px`): **`Incorrecto.`** (en coral `#f87171`) + diagnóstico pedagógico comparando los semitonos de la respuesta del usuario con los esperados (p. ej. `Marcaste D♯: 3 semitonos, 3ª menor. La 3ª mayor son 4 semitonos desde C: ` **`E, traste 7.`**).
     - **Si es correcto:** contenedor con fondo `rgba(20, 83, 45, 0.22)` y borde `#14532d`.
       - Texto: **`Correcto.`** (en verde `#4ade80`) + confirmación teórica (p. ej. `E en traste 7: 4 semitonos (3ª mayor) desde C.`).
     - **Acciones a la derecha de la franja:**
       - Botón secundario **`Escuchar`**: reproduce la nota o el intervalo (primero melódico desde la referencia y luego armónico) mediante `intervalEvents`.
       - Botón primario **`Siguiente · Enter`** (`background: #2563eb`, texto blanco en negrita): pasa a la siguiente pregunta (o muestra el resumen de fin de sesión al llegar a `20 / 20`).

### 4.4. Columna derecha — Configuración y Estadísticas de Sesión (`260 px`)

Tarjeta (`.drillConfigPanel`) con título **`Configuración`** (`16 px`, `font-weight: 600`):

- **`CUERDAS`:** fila de 6 botones (`1`, `2`, `3`, `4`, `5`, `6`, `34×34 px`, `border-radius: 6px`, `aria-pressed`). Los activos llevan borde azul `#3b82f6` y fondo `#101b33`. Siempre queda al menos 1 cuerda activa.
- **`TRASTES`:** grupo segmentado de 3 botones: `0–5` · `0–12` (por defecto) · `0–24`.
- **`DIRECCIÓN`** (en ejercicios direccionales `B1`, `B2`, `B3`, `C2`): grupo segmentado `Asc.` · `Desc.` · `Ambas`.
- **`MODO`** (en `A1` y `B4`): grupo segmentado `Todas` · `La primera`.
- **Interruptores de comportamiento (`role="switch"`):**
  - `Adaptativo` (activado por defecto: pondera con mayor probabilidad los `itemKey` con más fallos o mayor tiempo de respuesta).
  - `Ocultar puntos` (oculta los marcadores de los trastes `3, 5, 7, 9, 12…`).
  - `Sonido al corregir` (reproduce automáticamente la nota o intervalo al mostrar la corrección).
- **Sección inferior `ESTA SESIÓN`:**
  - Dos tarjetas en cuadrícula `1fr 1fr` (`gap: 10px`):
    - **`{precisión} %`** (`22 px`, `font-weight: 700`) / `Precisión` (`12 px`, `--app-muted`).
    - **`{tiempoMedio} s`** (`22 px`, `font-weight: 700`, formato `4,2 s`) / `Tiempo medio` (`12 px`, `--app-muted`).

---

## 5. Sección 2 — `Tarjetas` ([Tarjetas.png](Tarjetas.png))

### 5.1. Layout de 2 columnas

```
grid-template-columns: 310px minmax(0, 1fr);
gap: 16px;
height: 100%;
```

### 5.2. Columna izquierda — Lista de Mazos (`310 px`)

Tarjeta (`.decksSidebar`) con:

- Cabecera **`Mazos`** (`16 px`, `font-weight: 600`) y subtítulo de leyenda **`Nuevas · Aprendiendo · Repaso`** (`12 px`, `--app-muted`).
- **Lista de mazos (`role="listbox"`, `aria-label="Mazos de tarjetas"`):**
  - Cada tarjeta de mazo (`padding: 12px 14px`, `border-radius: 8px`) muestra:
    - Nombre del mazo (`15 px`, `font-weight: 600`, p. ej. `Principiante`, `Intermedio`, `Avanzado`, `Tríadas abiertas + modos de C`).
    - Si tiene tarjetas pendientes hoy: fila de 3 números en fuente monoespaciada (`13 px`, `font-weight: 600`, separados por `10 px`):
      - **Nuevas:** azul (`#3b82f6`)
      - **Aprendiendo / Reaprendiendo:** naranja (`#f97316`)
      - **Repaso:** verde (`#22c55e`)
    - Si los 3 contadores son `0`: texto `Al día · 0 pendientes` (`12 px`, `--app-muted`).
  - El mazo activo lleva fondo `#172236` (`--accent-soft`).
- **Botones de acción al pie de la lista:**
  - **`Nuevo mazo`**: abre el modal del constructor de mazos (`DeckBuilderModal`).
  - **`Añadir predefinido`**: abre un menú/modal con los 3 mazos predefinidos (**Principiante**, **Intermedio**, **Avanzado**) describiendo su contenido; al elegir uno se añade como copia editable independiente.

### 5.3. Columna derecha — Lienzo de Estudio de Tarjeta (`1fr`)

Tarjeta (`.flashcardStage`) dividida en cabecera, anverso, separador, reverso y barra de valoración:

1. **Cabecera del lienzo:**
   - **Izquierda:** nombre del mazo activo en mayúsculas (`PRINCIPIANTE`, `12 px`, `--app-muted`), píldora con la categoría del sujeto (`Digitación`, `Acorde`, `Escala`, `Intervalo`, `Grado`, `Progresión`) y píldora con la dirección de la faceta (`nombre → forma`, `forma → nombre`, `nombre → fórmula`, `fórmula → nombre`, `nombre → notas`, `romanos → acordes`…).
   - **Derecha:** contadores restantes de la sesión en monoespaciada (`19` azul · `3` naranja · `12` verde) y botón opcional `Editar` para modificar las reglas del mazo activo.

2. **Anverso (Pregunta, mitad superior):**
   - Centrado horizontalmente (`text-align: center`, `padding: 28px 24px`):
   - **Título de la pregunta (`30–32 px`, `font-weight: 700`):** p. ej. `C mayor`, `1 ♭3 ♭5 ♭7`, `D dórico`, `ii–V–I en C`.
   - **Subtítulo de la pregunta (`15 px`, `--app-muted`):** p. ej. `¿Qué forma abierta se toca?`, `¿Qué calidad de acorde corresponde a esta fórmula?`, `¿Qué notas forman esta escala y cuál es su escala madre?`.
   - En facetas cuyo anverso es visual (`shape>name` o `pos>name`), el diagrama de acorde o el mástil mudo se muestra en el anverso ocultando el nombre de las notas.

3. **Línea divisoria horizontal** (`1px solid var(--border)`).

4. **Reverso (Respuesta, mitad central):**
   - **Estado 1 — Respuesta oculta:**
     - Muestra en el centro el botón primario **`Mostrar respuesta · Espacio`** (`height: 42px`, `padding: 0 24px`).
   - **Estado 2 — Respuesta revelada** (como en [Tarjetas.png](Tarjetas.png)):
     - Contenedor central de dos columnas (`display: flex; align-items: center; justify-content: center; gap: 48px; flex: 1`):
       - **Izquierda (Representación visual):**
         - Para tarjetas de digitación (`voicing`): **Diagrama de acorde (`ChordDiagram`, SVG de `180×190 px`)** con las 6 cuerdas verticales, cejuela superior gruesa (o número de traste inicial a la izquierda si es cejilla en traste `> 1`), símbolos superiores de cuerda muteada (`×`) y cuerda al aire (`○`), y círculos de `26 px` con el número de dedo o grado; las notas que son fundamental (`root`) se rellenan en turquesa (`#14b8a6`, texto oscuro) y el resto en gris claro (`#e2e8f0`, texto oscuro).
         - Para tarjetas de escala o posición en el mástil: vista compacta del mástil/piano con la tónica en `root` y las notas en `tone`.
       - **Derecha (Datos de la respuesta y acciones):**
         - Etiqueta `RESPUESTA` (`11 px`, mayúsculas, `--app-muted`).
         - Valor principal en monoespaciada grande (`20 px`, `font-weight: 700`, p. ej. `x 3 2 0 1 0`, `A · C · E · G` o `Dm – G – C`).
         - Líneas de desglose:
           - `Notas: C · E · G · C · E` (`14 px`)
           - `Grados: 1 · 3 · 5 · 1 · 3` (`13 px`, `--app-muted`)
         - Fila de botones (`margin-top: 14px`, `gap: 10px`):
           - **`Escuchar`**: reproduce el voicing, acorde, escala, intervalo o progresión.
           - **`Abrir en Sandbox`**: carga el elemento en `sandboxStore` y lleva al modo `Sandbox`.

5. **Barra de autoevaluación SRS (parte inferior):**
   - Cuadrícula de 4 botones del mismo ancho (`grid-template-columns: repeat(4, 1fr); gap: 14px; height: 82px`):
     1. **`Otra vez`** — borde rojo (`#ef4444`), intervalo previsto por `previewIntervals` (`1 min`), tecla `1`.
     2. **`Difícil`** — borde ámbar (`#eab308`), intervalo previsto (`5,5 min`), tecla `2`.
     3. **`Bien`** — borde azul (`#3b82f6`), intervalo previsto (`10 min` / `1 d`), tecla `3`.
     4. **`Fácil`** — borde verde (`#22c55e`), intervalo previsto (`4 d`), tecla `4`.
   - Cada botón muestra en columna centrada: etiqueta en negrita (`15 px`), tiempo hasta el próximo repaso (`13 px`, `--app-muted`) y número del atajo (`12 px`, `--app-muted`).
   - Pie informativo bajo los botones (`12 px`, `--app-muted`): `Espacio: mostrar respuesta · 1–4: valorar`.

### 5.4. Modal Constructor / Editor de Mazos (`DeckBuilderModal`)

Diálogo modal accesible (`role="dialog"`, `aria-modal="true"`, cerrable con `Esc`):
- Campo `Nombre del mazo` y selectores numéricos `Nuevas por día` (defecto `20`) y `Repasos por día` (defecto `200`).
- Constructor de reglas (`DeckSource[]`): permite añadir uno o varios bloques de contenido:
  - **Digitaciones de acordes:** selección de calidades (`maj`, `m`, `7`, etc.), familias (`Abiertos`, `Cejilla 6ª`, `Cejilla 5ª`, `Cuerdas 1–4`, `Cuerdas 1–3`), raíces y facetas (`nombre → forma`, `forma → nombre`).
  - **Fórmulas y notas de acordes:** calidades × raíces × facetas (`nombre → fórmula`, `fórmula → nombre`, `nombre → notas`).
  - **Escalas y modos:** tipos de escala × tónicas (con botón rápido **"Añadir los 7 modos de una escala madre"**, p. ej. modos de Do mayor) × facetas (`nombre → notas`, `nombre → fórmula`, `modo → escala madre`).
  - **Armonía diatónica y progresiones:** tonalidades × tríadas/cuatríadas o plantillas de progresión.
  - **Notas e intervalos del mástil:** cuerdas × rango de trastes (`0–12` o `0–24`) × naturales/todas.
- Resumen inferior en vivo: `Total: {N} tarjetas` y botones `Cancelar` / `Guardar mazo`.

---

## 6. Sección 3 — `Fórmulas` ([Fórmulas.png](Fórmulas.png))

### 6.1. Layout simétrico de 2 columnas

```
grid-template-columns: repeat(2, minmax(0, 1fr));
gap: 16px;
height: 100%;
```

### 6.2. Columna izquierda — `Nombre → fórmula`

Tarjeta (`.formulaForwardCard`) con:

1. **Cabecera y selectores:**
   - Título **`Nombre → fórmula`** (`16 px`, `font-weight: 600`).
   - Barra de selección en una fila (`gap: 8px`):
     - Conmutador segmentado `Acorde` | `Escala` (el activo lleva borde `#3b82f6` y fondo `#101b33`).
     - Selector de raíz/tónica (`A`, `C`… según `nameMode`).
     - Selector de calidad de acorde (`m7`, `maj7`, `m7♭5`…) o tipo de escala (`Dórico`, `Bebop dominante`…).
2. **Ecuación principal de la fórmula:**
   - Texto destacado (`28 px`, `font-weight: 700`): `{Nombre} = ` seguido de la secuencia de grados en turquesa (`#14b8a6`), p. ej. **`Am7 = 1 ♭3 5 ♭7`**.
3. **Tabla de composición (`GRADO`, `INTERVALO`, `SEMITONOS`, `NOTA`):**
   - Tabla de 4 columnas con cabeceras en mayúsculas (`11 px`, `--app-muted`) y filas de `38 px` de alto separadas por `1px solid var(--border)`:
     - Columna 1 (`GRADO`): `1`, `♭3`, `5`, `♭7`…
     - Columna 2 (`INTERVALO`): nombre largo en español (`Unísono` / `fundamental`, `3ª menor`, `5ª justa`, `7ª menor`…).
     - Columna 3 (`SEMITONOS`): distancia en semitonos desde la raíz (`0`, `3`, `7`, `10`…; `14` en `9`).
     - Columna 4 (`NOTA`): nota resultante para la raíz elegida (`A`, `C`, `E`, `G`).
4. **Regla cromática lineal (`REGLA CROMÁTICA DESDE LA RAÍZ`):**
   - Encabezado en mayúsculas (`11 px`, `--app-muted`).
   - Cuadrícula horizontal de **13 celdas** (`0` a `12` semitonos, `grid-template-columns: repeat(13, minmax(0, 1fr)); gap: 6px`):
     - Cada celda (`height: 68px`, `border-radius: 7px`) muestra en vertical:
       1. Semitonos (`0..12`, `11 px` monoespaciada).
       2. Nombre de la nota (`A, A♯, B, C…`, `12 px`).
       3. Grado (`1, ♭3, 5, ♭7`, `12 px` en turquesa `#14b8a6` en negrita) si el semitono pertenece a la fórmula (incluyendo extensiones módulo 12 como `9` en la celda `2`).
     - Las celdas activas llevan borde turquesa `#14b8a6` (`1.5 px`) y fondo `rgba(20, 184, 166, 0.14)`; las inactivas llevan borde `--border` y texto atenuado.
5. **Botones de acción inferiores:**
   - **`Escuchar`** (secundario): reproduce las notas del acorde o de la escala.
   - **`Abrir en Sandbox`** (primario azul `#2563eb`): abre el acorde o escala en el Sandbox.

### 6.3. Columna derecha — `Fórmula → nombre`

Tarjeta (`.formulaReverseCard`) con:

1. **Selector interactivo de grados (`GRADOS (EL 1 SIEMPRE ESTÁ)`):**
   - Fila de 13 píldoras conmutables (`role="button"`, `aria-pressed`, `min-width: 38px`, `height: 34px`, `border-radius: 6px`):
     - `1` (siempre activo, no desactivable) · `♭2` · `2` · `♭3` · `3` · `4` · `♭5` (representa 6 semitonos: `♭5 / ♯4`) · `5` · `♭6` (8 semitonos: `♭6 / ♯5`) · `6` (9 semitonos: `6 / ♭♭7`) · `♭7` · `7` · `9` (14 semitonos).
   - Las píldoras activas se resaltan con borde azul `#3b82f6` y fondo `#101b33`.
2. **Filtro `Raíz opcional`:**
   - Selector compacto con las 12 notas (`A`, `C`…) más la opción `Sin raíz`. Con raíz seleccionada, todas las tarjetas de resultado muestran el cifrado y las notas concretas (`Am7` · `A · C · E · G`).
3. **Secciones de resultados (`identifyByFormula`):**
   - **`COINCIDENCIA EXACTA` (`exact`):**
     - Tarjetas destacadas con borde turquesa `#14b8a6` (`1.5 px`) y fondo `rgba(20, 184, 166, 0.14)` (`padding: 12px 16px`, `border-radius: 8px`).
     - Muestra a la izquierda el nombre en negrita (`16 px`, p. ej. `Am7`) y a la derecha las notas separadas por punto medio (`A · C · E · G`).
     - Si no hay ninguna coincidencia exacta para la combinación de grados activa, muestra un aviso discreto (`Ningún acorde o escala del catálogo coincide exactamente`).
   - **`MISMAS NOTAS, OTRA RAÍZ` (`rotations`):**
     - Lista de tarjetas (`border: 1px solid var(--border)`, `background: var(--surface-2)`) con los acordes o escalas que contienen exactamente el mismo conjunto de clases de altura sobre otro grado de la fórmula (p. ej. **`C6`** a la izquierda y `sobre el ♭3` a la derecha en `--app-muted`).
   - **`CERCANAS` (`near`, a 1 nota de distancia):**
     - Lista de tarjetas con los candidatos que se obtienen quitando o añadiendo 1 grado (p. ej. **`Am`** — `quita ♭7`; **`Am9`** — `añade 9`).
   - **Interacción:** hacer clic en cualquier tarjeta de resultado la selecciona automáticamente en la columna izquierda (`Nombre → fórmula`).

---

## 7. Sección 4 — `Progreso` ([Progreso.png](Progreso.png))

### 7.1. Layout de 2 columnas asimétricas

```
grid-template-columns: minmax(0, 1.85fr) minmax(320px, 1fr);
gap: 16px;
height: 100%;
```

### 7.2. Columna izquierda — Mapa de aciertos y Evolución de sesiones

1. **Tarjeta superior — `Mapa de aciertos del mástil`:**
   - **Cabecera:** título `Mapa de aciertos del mástil` a la izquierda y subtítulo `A1 y A2 · últimas 20 respuestas por posición` a la derecha (`12 px`, `--app-muted`).
   - **Matriz del mástil (6 cuerdas `e B G D A E` × trastes `0` a `12`, con opción de ver `0–24`):**
     - Números de traste `0..12` en la fila superior (`12 px`, `--app-muted`) y letras de cuerda `e, B, G, D, A, E` en la columna izquierda.
     - En cada intersección `(cuerda, traste)` se dibuja un círculo de `26 px` que codifica el nivel de dominio por **color y estilo de borde**:
       - **Dominada (`≥ 85 %` de acierto):** círculo verde con borde continuo (`#22c55e`, `2 px`) y relleno `rgba(34, 197, 94, 0.25)`.
       - **Regular (`60 % – 84 %`):** círculo ámbar con **borde discontinuo** (`#d97706`, `stroke-dasharray: 3 2`, `2 px`) y relleno `rgba(217, 119, 6, 0.20)`.
       - **Débil (`< 60 %`):** círculo coral/rojo con **borde continuo grueso** (`#f87171`, `2.5 px`) y relleno `rgba(239, 68, 68, 0.30)`.
       - **Sin datos (`0` intentos):** círculo hueco tenue (`1px solid var(--border)`).
     - Tooltip accesible en cada posición con nota, porcentaje de acierto en las últimas 20 respuestas y tiempo medio.
   - **Pie de leyenda:** `● Dominada · 85 % o más` · `◌ Regular` · `● Débil · menos de 60 %`.

2. **Tarjeta inferior — `Precisión por sesión · últimas 10`:**
   - Gráfico de 10 barras verticales (`grid-template-columns: repeat(10, 1fr); gap: 12px; align-items: end; height: 150px`):
   - La altura de cada barra (`background: #2563eb`, `border-radius: 4px 4px 2px 2px`) es proporcional al porcentaje de acierto (`0–100 %`) de esa sesión.
   - Cada barra tiene `aria-label` y tooltip con el ejercicio, la precisión y la fecha (p. ej. `B1 · 85 % · 3,4 s`). Si hay menos de 10 sesiones registradas, las columnas restantes se muestran como pistas vacías tenues.

### 7.3. Columna derecha — Resumen de Tarjetas, Intervalos débiles y Copia de seguridad

Tres tarjetas apiladas verticalmente (`display: flex; flex-direction: column; gap: 16px`):

1. **Tarjeta 1 — `Tarjetas`:**
   - Cuadrícula `2×2` (`gap: 10px`) de recuadros métricos:
     - **`{pendientesHoy}`** (`24 px`, `font-weight: 700`) / `Pendientes hoy` (`12 px`, `--app-muted`)
     - **`{retención} %`** / `Retención`
     - **`{nuevas}`** / `Nuevas`
     - **`{enAprendizaje}`** / `En aprendizaje`

2. **Tarjeta 2 — `Intervalos débiles`:**
   - Lista los 5 intervalos con menor precisión acumulada en los ejercicios de intervalos (`B1–B4`):
   - Cada fila (`display: grid; grid-template-columns: 32px 1fr 44px; align-items: center; gap: 10px`) muestra:
     - Símbolo del intervalo/grado (`♭5`, `M6`, `m7`, `M3`, `P4`, `13 px` monoespaciada).
     - Barra horizontal (`height: 8px`, pista `#1e293b`, relleno ámbar `#f59e0b`, `border-radius: 999px`).
     - Porcentaje a la derecha (`54 %`, `13 px` monoespaciada).
   - Botón inferior **`Practicar los débiles`**: lleva a la pestaña `Ejercicios` preseleccionando los intervalos débiles en modo `Adaptativo`.

3. **Tarjeta 3 — `Copia de seguridad`:**
   - Párrafo informativo (`12 px`, `--app-muted`, `line-height: 1.45`): `Los datos viven en este navegador. Si los borras, pierdes mazos y progreso: exporta una copia de vez en cuando.`
   - Fila de botones (`gap: 10px`):
     - **`Exportar JSON`** (botón primario azul `#2563eb`): genera y descarga el archivo JSON con el estado completo de `decksStore` y `drillsStore`.
     - **`Importar`** (botón secundario): abre el selector de archivo `.json`, valida el formato y restaura los datos mostrando un mensaje de confirmación o error accesible.

---

## 8. Accesibilidad y atajos de teclado del modo Aprender

| Contexto | Atajo | Acción |
|---|---|---|
| Global (Sandbox y Aprender) | <kbd>M</kbd> | Alternar sonido (mute) |
| Global (solo Sandbox) | <kbd>C</kbd> | Limpiar selección del Sandbox (**ignorado en Aprender**) |
| Ejercicios (selección múltiple / tras corregir) | <kbd>Enter</kbd> | `Comprobar` respuesta actual o pasar a la `Siguiente` pregunta |
| Tarjetas (anverso visible) | <kbd>Espacio</kbd> | `Mostrar respuesta` |
| Tarjetas (reverso visible) | <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> / <kbd>4</kbd> | Valorar tarjeta como `Otra vez` (`1`), `Difícil` (`2`), `Bien` (`3`) o `Fácil` (`4`) |
| Modales (`DeckBuilderModal`, `SettingsPopover`) | <kbd>Esc</kbd> | Cerrar el diálogo activo |

- Todos los atajos se ignoran cuando el foco está en un campo de texto o selector (`input`, `select`, `textarea`) o si se pulsa con modificadores (`Ctrl`, `Alt`, `Meta`).
- Los cambios de estado en ejercicios (corrección de la respuesta) y en tarjetas (revelación del reverso) se anuncian mediante regiones con `aria-live="polite"`.

---

## 9. Mapa de componentes nuevos y modificados (`src/ui/`)

| Hito | Ruta del componente | Responsabilidad |
|---|---|---|
| **A0** | `src/ui/shell/AppShell.tsx` | Contenedor raíz en `App.tsx`: gestiona `SideNav` y conmuta entre `SandboxView`, `LearnView` y la vista de `Canción` conservando el estado del Sandbox |
| **A0 / A6** | `src/ui/learn/LearnView.tsx` | Contenedor del modo Aprender: `LearnTopBar` (4 pestañas + racha) y enrutado interno entre `DrillsView`, `FlashcardsView`, `FormulasView` y `ProgressView` |
| **A6** | `src/ui/instruments/Fretboard.tsx` | Soporte para los roles `question`, `wrong`, `missed`, `correct` y las props opcionales `fretRange`, `activeStrings` y `showInlays` |
| **A6** | `src/ui/instruments/Piano.tsx` | Soporte para los roles `question`, `wrong`, `missed`, `correct` y rango acotado por props |
| **A6** | `src/ui/learn/formulas/FormulasView.tsx` | Sección **Fórmulas**: paneles `Nombre → fórmula` (con regla cromática de 13 celdas) y `Fórmula → nombre` (selector de grados + resultados exactos, otra raíz y cercanos) |
| **A7** | `src/ui/learn/drills/DrillsView.tsx` | Sección **Ejercicios**: selector lateral `A1–C2`, escenario central con mástil, piano, leyenda, botonera de opciones y `FeedbackBanner`, y panel derecho de `Configuración` + `Esta sesión` |
| **A8** | `src/ui/learn/cards/FlashcardsView.tsx` | Sección **Tarjetas**: lista lateral de mazos con contadores `Nuevas · Aprendiendo · Repaso`, lienzo anverso/reverso y los 4 botones SRS con `previewIntervals` |
| **A8** | `src/ui/learn/cards/ChordDiagram.tsx` | Diagrama compacto SVG de 6 cuerdas para mostrar digitaciones (`voicings`) en el anverso o reverso de las tarjetas |
| **A8** | `src/ui/learn/cards/DeckBuilderModal.tsx` | Modal de creación/edición de mazos personalizados por reglas (`DeckSource[]`) y selector de mazos predefinidos |
| **A9** | `src/ui/learn/progress/ProgressView.tsx` | Sección **Progreso**: mapa de aciertos del mástil, gráfico de precisión de las últimas 10 sesiones, métricas de tarjetas, barras de intervalos débiles y exportación/importación JSON |
