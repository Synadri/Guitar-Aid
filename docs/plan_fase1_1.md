# Guitar Aid — Diseño y Plan de la Fase 1.1 (v2)

Este documento define el alcance, diseño técnico, hitos y criterios de aceptación de la **Fase 1.1**, incorporando las correcciones arquitectónicas sobre el catálogo, invariantes de voicings, estado unificado de foco y diseño del layout.

---

## 1. Resumen de mejoras respecto a la Fase 1

| # | Problema en Fase 1 | Solución en Fase 1.1 |
|---|---|---|
| 1 | En el piano no se distinguen las notas pulsadas de las de contexto | En `pianoMarks`, las notas de `state.notes` usan `role: 'pinned'`. Cada rol tiene variables CSS (claro/oscuro) y se distingue además por forma/borde; `pinned` y `root` pueden coincidir en la misma marca (`isRoot`). |
| 2 | Orientación vertical inusable | Se elimina la orientación vertical de la UI y del estado, actualizando `docs/Requisitos.md` (incluido el criterio 8). |
| 3 | Faltan acordes `add9`, power chords (`5`) y todas las cuatríadas diatónicas de las escalas menores | Se añaden 7 calidades en **H1** (`add9`, `madd9`, `m7♭5`, `dim7`, `mMaj7`, `maj7♯5`, `5`) **junto con sus voicings de cejilla** (raíz en 6ª y 5ª) y abiertos para cumplir siempre el invariante *"cada calidad × raíz tiene al menos un voicing"*, y se habilita la detección de díadas `[0, 7]` en `detectChords`. |
| 4 | Faltan escalas de 8 notas (Bebop / disminuidas) y napolitanas | Se añaden las 5 escalas **Bebop** (8 notas), **Napolitana menor** y **Napolitana mayor** (7 notas), y las 2 **Disminuidas simétricas** (semitono–tono y tono–semitono, 8 notas). |
| 5 | Faltan voicings en las 3 y 4 últimas cuerdas | En **H3** se añaden las familias `'strings-1-3'` y `'strings-1-4'` en posición fundamental, 1ª y 2ª inversión, marcando siempre la tónica con `root`. |
| 6 | Al inspeccionar un grado de una escala o un acorde de una progresión se pierde el contexto principal | Nuevo estado unificado **`chordFocus`** (`{ chord, voicingIndex, mode } | null`): un clic inspecciona el acorde dentro del contexto actual (dejando la escala en `scale-bg` o manteniendo la lista de progresiones); el botón explícito **"Ir al acorde"** pivota el contexto principal. |
| 7 | Sugerencias de escalas mezcladas y falta de contexto respecto a la escala madre | `scaleParentContext` muestra la relación con la madre (p. ej. *"II grado de C mayor"*), y las escalas relativas se agrupan en un desplegable mostrando su grado respecto a la madre, seguidas por las sugerencias por proximidad/popularidad. |
| 8 | Barra superior sobrecargada y columna lateral estrecha con 75% de pantalla vacía | Los ajustes poco frecuentes pasan a un menú **`⚙ Ajustes`**; la barra superior integra solo selección de escala, acorde y reproducción; debajo de los instrumentos a ancho completo se sitúa un **dashboard de 3 columnas** sin scroll global. |

---

## 2. Catálogo Teórico (`src/theory/data/`)

### 2.1. Nuevas calidades de acordes (`src/theory/data/chords.ts`)

Se amplía `ChordQualityId` de 12 a **19 calidades**:

| ID | Nombre | Símbolo | Intervalos | Requeridos (clases 0–11) | Papel armónico clave |
|---|---|---|---|---|---|
| `5` | quinta / power chord | `5` | `[0, 7]` | `[0, 7]` | Fundamental y 5ª justa sin 3ª (`C5`, `E5`), neutral a mayor/menor, base del rock y la guitarra |
| `add9` | add9 | `add9` | `[0, 4, 7, 14]` | `[0, 4, 7, 2]` | Tríada mayor con 9ª añadida sin 7ª (`Dadd9`, `Cadd9`) |
| `madd9` | m(add9) | `m(add9)` | `[0, 3, 7, 14]` | `[0, 3, 7, 2]` | Tríada menor con 9ª añadida sin 7ª (`Am(add9)`) |
| `m7b5` | semidisminuido | `m7♭5` | `[0, 3, 6, 10]` | `[0, 3, 6, 10]` | `viiø7` en mayor, `iiø7` en menor natural y armónica, `viø7`/`viiø7` en menor melódica |
| `dim7` | disminuido 7 | `dim7` | `[0, 3, 6, 9]` | `[0, 3, 6, 9]` | `vii°7` en menor armónica (`G♯dim7` en La menor armónica) |
| `mMaj7` | menor maj7 | `m(maj7)` | `[0, 3, 7, 11]` | `[0, 3, 7, 11]` | `i(maj7)` en menor armónica y menor melódica (`Am(maj7)`) |
| `maj7#5` | maj7♯5 | `maj7♯5` | `[0, 4, 8, 11]` | `[0, 4, 8, 11]` | `♭IIImaj7♯5` en menor armónica y menor melódica (`Cmaj7♯5`) |

### 2.2. Detección de power chords (`src/theory/analysis/detectChords.ts`)

- **Díadas de 5ª justa (`[0, 7]`)**: con la inclusión de la calidad `5` en `CHORD_QUALITIES` (`intervals: [0, 7]`, `requiredIntervals: [0, 7]`), `detectChords` identifica de forma inmediata power chords cuando la entrada contiene exclusivamente la fundamental y la 5ª justa (p. ej. notas `C` y `G` $\to$ `C5`).
- **Notas duplicadas en octavas**: las digitaciones habituales en guitarra con fundamental–quinta–octava (p. ej. `E2–B2–E3` o `C3–G3–C4`) colapsan a las clases de altura `{0, 7}` relativas a la tónica, detectándose limpiamente como `E5` o `C5`.
- **Descarte ante la presencia de terceras**: gracias a `allowMask` en el algoritmo de `detectChords`, si el usuario pulsa además una 3ª mayor (`4`) o menor (`3`), la condición `(inputMask & ~allowMask) !== 0` descarta automáticamente `5` y evalúa el acorde mayor o menor completo (`maj` o `m`), previniendo falsos positivos.
- **Puntuación y ranking**: se asigna un peso en `CHORD_QUALITY_WEIGHTS` equilibrado para que `5` puntúe por debajo de tríadas completas pero se elija prioritariamente cuando la entrada contiene únicamente la quinta.

> [!IMPORTANT]
> **Invariante de cobertura de voicings en H1**: En el mismo hito H1 se añaden las formas móviles de cejilla (`barre-E` con raíz en 6ª cuerda y `barre-A` con raíz en 5ª cuerda) para las 7 nuevas calidades en `src/theory/data/voicings/standard.ts` (para `5`, plantillas móviles de 2 y 3 cuerdas como `[0, 2, 2, 'x', 'x', 'x']` y `['x', 0, 2, 2, 'x', 'x']`, más las formas abiertas canónicas `E5` `0-2-2-x-x-x`, `A5` `x-0-2-2-x-x` y `D5` `x-x-0-2-3-x`), garantizando que el test `cada calidad × 12 raíces tiene al menos un voicing` (19 × 12 = 228 combinaciones) pase sin excepciones tras cerrar H1.

### 2.3. Nuevas escalas de 7 y 8 notas (`src/theory/data/scales.ts`)

Se amplía `ScaleType` con `baseScale?: ScaleTypeId` (para escalas de 8 notas derivadas de un modo de 7 notas más una nota de paso) y `symmetric?: boolean`:

#### Escalas heptatónicas (7 notas): Napolitanas
| ID | Nombre | Intervalos | Fórmula | Familia |
|---|---|---|---|---|
| `neapolitanMinor` | Napolitana menor | `[0, 1, 3, 5, 7, 8, 11]` | `1 ♭2 ♭3 4 5 ♭6 7` | `neapolitanMinor` |
| `neapolitanMajor` | Napolitana mayor | `[0, 1, 3, 5, 7, 9, 11]` | `1 ♭2 ♭3 4 5 6 7` | `neapolitanMajor` |

#### Escalas octatónicas (8 notas): Bebop
| ID | Nombre | Intervalos | Fórmula | `baseScale` | Relación con escala madre |
|---|---|---|---|---|---|
| `bebopDominant` | Bebop dominante | `[0, 2, 4, 5, 7, 9, 10, 11]` | `1 2 3 4 5 6 ♭7 7` | `mixolydian` | V grado de Mayor (+ `7` de paso) |
| `bebopDorian` | Bebop dórico | `[0, 2, 3, 4, 5, 7, 9, 10]` | `1 2 ♭3 3 4 5 6 ♭7` | `dorian` | II grado de Mayor (+ `3` de paso) |
| `bebopMajor` | Bebop mayor | `[0, 2, 4, 5, 7, 8, 9, 11]` | `1 2 3 4 5 ♯5 6 7` | `major` | I grado de Mayor (+ `♯5` de paso) |
| `bebopMelodicMinor` | Bebop menor melódica | `[0, 2, 3, 5, 7, 8, 9, 11]` | `1 2 ♭3 4 5 ♯5 6 7` | `melodicMinor` | I grado de Menor melódica (+ `♯5` de paso) |
| `bebopNaturalMinor` | Bebop menor natural | `[0, 2, 3, 5, 7, 8, 10, 11]` | `1 2 ♭3 4 5 ♭6 ♭7 7` | `minor` | VI grado de Mayor (+ `7` de paso) |

#### Escalas octatónicas simétricas (8 notas, opcionales / incluidas con nota de simetría)
| ID | Nombre | Intervalos | Fórmula | `symmetric` |
|---|---|---|---|---|
| `diminishedHalfWhole` | Disminuida semitono-tono | `[0, 1, 3, 4, 6, 7, 9, 10]` | `1 ♭2 ♯2 3 ♯4 5 6 ♭7` | `true` |
| `diminishedWholeHalf` | Disminuida tono-semitono | `[0, 2, 3, 5, 6, 8, 9, 11]` | `1 2 ♭3 4 ♭5 ♭6 6 7` | `true` |

> [!NOTE]
> **Simetría de las escalas disminuidas**: Ambas escalas disminuidas son periódicas cada 3 semitonos (`rotateMask(mask, 3) === mask`). Solo existen 3 conjuntos de alturas distintos en las 12 notas, por lo que **la raíz es intrínsecamente ambigua** entre las 4 notas separadas por terceras menores (`0, 3, 6, 9`). En el panel de información y sugerencias se muestra una nota explícita indicando esta simetría (sus relativas por transposición a `+3, +6, +9` semitonos contienen exactamente las mismas 8 notas) y para sus acordes se usa `chordsWithinScale`.

---

## 3. Armonía Diatónica y Escalas Relativas (`src/theory/suggestions/forScale.ts`)

### 3.1. Numerales romanos y `diatonicChords(scale, nameMode, kind)`

- **Numerales romanos siempre relativos a la tónica de la escala seleccionada**:
  - La función compara el intervalo de cada grado `k` con los intervalos de la escala mayor `[0, 2, 4, 5, 7, 9, 11]` para prefijar `♭` o `♯` respecto a la tónica de la propia escala seleccionada (p. ej. en La menor natural: `i, ii°, ♭III, iv, v, ♭VI, ♭VII`).
- ** Parámetro `kind: 'triads' | 'sevenths' = 'triads'`**:
  - En `'triads'` apila `1–3–5` sobre cada uno de los 7 grados.
  - En `'sevenths'` apila `1–3–5–7` (`iv[k], iv[(k+2)%7], iv[(k+4)%7], iv[(k+6)%7]`) y busca la cuatríada correspondiente en el catálogo (`maj7`, `m7`, `7`, `m7b5`, `dim7`, `mMaj7`, `maj7#5`).
  - **Cobertura completa de los 7 grados en cuatríadas**:
    - **C mayor**: `I Cmaj7`, `ii Dm7`, `iii Em7`, `IV Fmaj7`, `V G7`, `vi Am7`, `viiø7 Bm7♭5`.
    - **A menor natural**: `i Am7`, `iiø7 Bm7♭5`, `♭III Cmaj7`, `iv Dm7`, `v Em7`, `♭VI Fmaj7`, `♭VII G7`.
    - **A menor armónica**: `i(maj7) Am(maj7)`, `iiø7 Bm7♭5`, `♭IIImaj7♯5 Cmaj7♯5`, `iv Dm7`, `V7 E7`, `♭VImaj7 Fmaj7`, `vii°7 G♯dim7`.
    - **A menor melódica**: `i(maj7) Am(maj7)`, `ii Bm7`, `♭IIImaj7♯5 Cmaj7♯5`, `IV7 D7`, `V7 E7`, `viø7 F♯m7♭5`, `viiø7 G♯m7♭5`.
  - Si la escala tiene `baseScale` (las 5 escalas Bebop), `diatonicChords` calcula los 7 grados diatónicos sobre su `baseScale` con la misma tónica. Si no es heptatónica ni tiene `baseScale` (pentatónicas, blues, disminuidas), devuelve `chordsWithinScale`.

### 3.2. `scaleParentContext(scale, nameMode)` y agrupación de `relatedScales`

1. **`scaleParentContext(scale, nameMode)`**:
   - Devuelve `{ parentScale: ScaleRef; degreeNumber: number; degreeRoman: string; isSelfParent: boolean; passingToneNote?: string } | null`.
   - Para modos con `parentOffset > 0`: calcula la tónica de la escala madre (`scale.tonic - parentOffset`) y el grado romano que ocupa la tónica actual dentro de la escala madre.
   - Ejemplo: para **D dórico** devuelve **"II grado de C mayor"**. Para **A menor natural**, **"VI grado de C mayor"**. Para **G bebop dominante**, **"V grado de C mayor (Mixolidio + F♯ de paso)"**.
2. **Agrupación de sugerencias de escala (`groupedRelatedScales(scale, nameMode)`)**:
   - **`relatives`**: todas las escalas que comparten el mismo conjunto de notas de la escala madre (los modos de la misma escala madre + pentatónicas relativas), ordenadas por su grado respecto a la escala madre (`I, II, III, IV, V, VI, VII`), indicando en cada entrada su `degreeRoman` respecto a la madre.
   - **`byProximity`**: variantes cercanas en la misma tónica (diferencia de 1–2 notas, como menor armónica, menor melódica, bebop, pentatónica, blues) ordenadas por cercanía y peso (`SCALE_WEIGHTS`).

---

## 4. Voicings en las 3 y 4 últimas cuerdas (`src/theory/data/voicings/standard.ts`)

En **H3** se amplían las familias de voicings:

```ts
export type VoicingFamily = 'open' | 'barre-E' | 'barre-A' | 'strings-1-4' | 'strings-1-3';
export type VoicingInversion = 'root' | '1st' | '2nd' | '3rd';
```

- **Familia `'strings-1-3'` (cuerdas 3, 2 y 1: `G–B–E`)**:
  - Tríadas cerradas en las 3 posiciones a lo largo del mástil:
    - **Posición fundamental (`inversion: 'root'`)**: raíz en 3ª cuerda (`rootString: 3`, desplazamientos `[x, x, x, 0, -2, -2]` para mayor → en Do mayor, raíz C en `(3, 5)` da **`x-x-x-5-5-3`**).
    - **1ª inversión (`inversion: '1st'`)**: 3ª en el bajo en 3ª cuerda, raíz en 1ª cuerda (`rootString: 1`, desplazamientos `[x, x, x, +1, 0, 0]` para mayor → en Do mayor, raíz C en `(1, 8)` da **`x-x-x-9-8-8`**).
    - **2ª inversión (`inversion: '2nd'`)**: 5ª en el bajo en 3ª cuerda, raíz en 2ª cuerda (`rootString: 2`, desplazamientos `[x, x, x, -1, 0, -1]` para mayor → en Do mayor, raíz C en `(2, 1)` da **`x-x-x-0-1-0`**).
  - Equivalentes para `m`, `dim`, `aug`, `sus2`, `sus4` y formas reducidas de 3 cuerdas para 7ª/add9.
- **Familia `'strings-1-4'` (cuerdas 4, 3, 2 y 1: `D–G–B–E`)**:
  - Formas en posición fundamental con raíz en 4ª cuerda (`rootString: 4`) y Drop 2 en 1ª y 2ª inversión para tríadas y cuatríadas (`maj`, `m`, `7`, `maj7`, `m7`, `m7b5`, `dim7`, `mMaj7`, `maj7#5`, `add9`, `madd9`, `6`, `m6`, `9`). (Los power chords `5` se concentran por ergonomía en las cuerdas graves 6ª–4ª introducidos en H1).
- **Validación en `dictionary.test.ts`**:
  - Si `inversion === 'root'` (valor por defecto), la nota MIDI más grave del voicing tiene la clase de altura de `root`.
  - Si `inversion === '1st' | '2nd' | '3rd'`, la nota MIDI más grave coincide con la 3ª, 5ª o 7ª del acorde, y la fundamental (`pc === root`) está presente en el voicing y recibe `role: 'root'`.

---

## 5. Roles Visuales y Estado (`src/state/sandbox/`)

### 5.1. Roles de marca (`MarkRole`), variables CSS y coexistencia `pinned` + `root`

```ts
export type MarkRole = 'pinned' | 'root' | 'tone' | 'scale-bg' | 'preview' | 'equivalent';

export interface FretMark {
  string: StringNumber;
  fret: number;
  role: MarkRole;
  /** Si la marca (p. ej. una nota 'pinned' o 'preview') es además la raíz/tónica activa. */
  isRoot?: boolean;
  label?: string;
}

export interface KeyMark {
  midi: number;
  role: MarkRole;
  isRoot?: boolean;
  label?: string;
}
```

| Rol | Uso | Estilo claro / oscuro (variables CSS) | Distinción por forma / borde |
|---|---|---|---|
| `pinned` | Nota pulsada manualmente en guitarra o piano | `--mark-pinned-fill` (`#0f766e` / `#14b8a6`) | Círculo opaco con borde sólido grueso (`2.25px`) |
| `root` | Tónica de la escala o fundamental del acorde | `--mark-root-fill` (`#b45309` / `#f59e0b`) | Círculo opaco con **doble anillo interior** (`rootInnerRing`) |
| `tone` | Nota de contexto (acorde o escala activa) | `--mark-tone-fill` (`#1d4ed8` / `#3b82f6`) | Círculo opaco con borde sencillo (`1.75px`) |
| `scale-bg` | Nota de la escala cuando hay un `chordFocus` activo encima | `--mark-scale-bg-fill` (`#dbeafe` / `#1e293b`) | Círculo translúcido más pequeño con **borde punteado fino** (`stroke-dasharray: 2 2`) |
| `preview` | Previsualización temporal (`hover`) | `--mark-preview-fill` (`#f3e8ff` / `#3b0764`) | Borde discontinuo largo (`stroke-dasharray: 4 2`) |
| `equivalent` | Posición equivalente en el mástil de una nota pulsada | `--mark-equivalent-fill` (`#ffffff` / `#18181b`) | Círculo hueco con borde de color `pinned` |

- **Coexistencia `pinned` + `root`**: Si una nota pulsada manualmente (`role: 'pinned'`) coincide con la clase de altura de la raíz activa (`pc === activeRoot`), la marca lleva `role: 'pinned'` y `isRoot: true`. Tanto `Fretboard` como `Piano` dibujan el relleno verde de `pinned` **más** el anillo interior (`rootInnerRing`) de `root`.

### 5.2. Foco de acorde unificado (`chordFocus`) y reglas de reinicio

En `SandboxState` se sustituye cualquier estado disperso de inspección por un único campo `chordFocus`:

```ts
export interface ChordFocus {
  chord: ChordRef;
  /** Etiqueta contextual opcional (p. ej. el grado "V7" en una escala o "V" en una progresión). */
  degree?: string;
  /** Índice del voicing en voicingsForChord(chord, tuning). */
  voicingIndex: number;
  /** 'voicing' dibuja la forma elegida; 'tones' ilumina las notas del acorde en todo el rango. */
  mode: 'voicing' | 'tones';
}
```

Además, `SandboxState` añade:
- `chordFocus: ChordFocus | null`
- `harmonyMode: 'triads' | 'sevenths'` (por defecto `'triads'`)
- `harmonyProgression: { roman: string; chord: ChordRef }[]` (constructor de progresión en escala)

#### Reglas de reinicio explícitas de `chordFocus` (todas verificadas con tests en `sandbox.test.ts`):
1. **Al cambiar de contexto (`setContext` o `applyPreview`)**: `chordFocus` se reinicia a `null` y `harmonyProgression` se vacía (`[]`).
2. **Al cambiar de afinación (`setTuning`)**: si `chordFocus !== null`, se conserva `chord`, `degree` y `mode`, pero `chordFocus.voicingIndex` se reinicia a `0`.
3. **Al pulsar "Quitar" / "Volver a [Contexto]" (`clearChordFocus`) o al hacer un segundo clic sobre el mismo acorde ya enfocado**: `chordFocus` pasa a `null`, restaurando la visualización del contexto principal (la escala completa con `role: 'tone'/'root'` o el acorde de contexto con su propio `voicingIndex`).
4. **Al pulsar "Limpiar" (`clear`)**: vacía `notes`, `context`, `preview`, `rootOverride`, `harmonyProgression` y pone `chordFocus` a `null`.

---

## 6. Interfaz, Barra Compacta y Presupuesto de Altura (Sección 9)

### 6.1. Barra superior compacta y menú `⚙ Ajustes`

- **Barra principal (una sola fila)**:
  - **Selector de Escala**: desplegables compactos de Tónica y Tipo de escala.
  - **Selector de Acorde**: desplegables compactos de Tónica y Calidad de acorde.
  - **Reproducción**: botones `▶ Acorde`, `▶ Arpegio`, `▶ Escala` + interruptor de sonido (`M`).
  - **Acciones globales**: botón **`Limpiar (C)`** y botón **`⚙ Ajustes`** (con popover accesible cerrable con `Escape` o clic fuera).
- **Menú `⚙ Ajustes`**:
  - Afinación (`Estándar`, `Drop D`, `Eb`, `D`, `DADGAD`, `Open G`, `Open D`).
  - Etiquetas (`Nota`, `Intervalo`, `Grado`, `Ninguna`).
  - Nombres (`Sostenidos ♯`, `Bemoles ♭`).
  - Interruptores: `Mostrar todas las posiciones`, `Modo zurdo`, `Mostrar guitarra`, `Mostrar piano` y control deslizante de `Volumen`.

### 6.2. Navegador de Voicings con filtro por grupo

Integrado junto al mástil cuando hay un acorde activo (sea `context.kind === 'chord'` o un `chordFocus` activo):
- Filtros por grupo de cuerdas: **`Todos`**, **`Abiertos`**, **`Cejilla (5ª–6ª)`**, **`4 cuerdas (1–4)`**, **`3 cuerdas (1–3)`**.
- Si el acorde viene de `chordFocus` sobre una escala, incluye el conmutador **`Digitación (Voicing)` / `Notas en la escala`** y el botón **`Quitar foco`**.
- Muestra el nombre de la forma y su inversión (p. ej. `Cuerdas 1–3 · 1ª inversión · x-x-x-9-8-8`).

### 6.3. Dashboard inferior en Grid de 3 columnas

1. **Columna 1 — Selección y Contexto (`InfoPanel`)**:
   - Resumen de lo seleccionado, selector de raíz (para notas manuales) y pestañas `Notas / Contexto` si conviven ambas capas.
   - Si hay una escala activa, muestra destacada la relación con su escala madre (`scaleParentContext`, p. ej. **"II grado de C mayor"**) y nota de simetría si es disminuida.
   - Tabla compacta de notas con su intervalo y grado.
2. **Columna 2 — Armonía / Progresiones**:
   - **En modo Escala → Panel de Análisis Armónico**:
     - Conmutador **`Tríadas` / `Cuatríadas (7ª)`**.
     - Tarjetas de los 7 grados (con su numeral romano relativo a la tónica de la escala y nombre del acorde):
       - **Clic en la tarjeta**: activa/desactiva `chordFocus` sobre ese grado (la escala queda en `scale-bg` atenuada y el grado resalta con sus notas o voicings).
       - **Botón `+`**: añade el grado al constructor de progresión (`harmonyProgression`, en H5f).
       - **Botón `"Ir al acorde"`** (con tooltip y `aria-label="Ir al acorde [Nombre]"`): cambia `context` a ese acorde.
     - Barra del **Constructor de progresión** (en H5f): chips de los grados añadidos, botón **`▶ Reproducir progresión`** y botón de vaciar progresión.
   - **En modo Acorde → Panel de Progresiones**:
     - En cada progresión sugerida, el chip del grado correspondiente al acorde de contexto lleva **color de acento** (`data-current-degree="true"`).
     - **Clic en otro grado de la progresión**: activa `chordFocus` en ese acorde sin cambiar `context`; muestra una barra de aviso con el botón **`"Volver a [Acorde]"`**.
     - **Botón `"Ir al acorde"`** (con tooltip y `aria-label`): pivota `context` a ese acorde.
     - **Botón `"▶ Reproducir"`** (en H5f): reproduce todos los acordes de esa progresión en orden.
3. **Columna 3 — Escalas**:
   - **En modo Escala**:
     - Bloque desplegable **`Escalas relativas (mismas notas)`**: al expandir lista cada escala relativa junto a su grado en la escala madre (`I · C mayor`, `II · D dórico`, etc.).
     - Lista inferior **`Por proximidad y popularidad`**: variantes cercanas en la misma tónica y escalas relacionadas.
   - **En modo Acorde / Notas**: ranking de escalas compatibles para improvisar.

---

## 7. Sección 9 — Presupuesto de Altura y Layout (Criterio `k`)

Para evitar el problema de tener que hacer scroll de página mientras parte de la pantalla queda desaprovechada, optimizando principalmente para **`1920×1080`** y **`2560×1440`** (con soporte también para `1440×900`):

1. **Distribución vertical en pantallas de escritorio (`1920×1080`, `2560×1440` y `1440×900`)**:
   - Barra superior compacta: `48px` en `1080p` (`54px` en `1440p`, `46px` en `≤ 950p`).
   - Área de instrumentos a ancho completo (Franja de contexto + Mástil + Piano horizontal): `378px` en `1080p` (`462px` en `1440p`, `346px` en `≤ 950p`), escalando proporcionalmente hasta `--content-max-width: 2440px`.
   - Dashboard inferior de 3 columnas: ocupa el resto de la altura disponible (`≈ 634px` en `1080p`, `≈ 904px` en `1440p`, `≈ 480px` en `900p`), con cuadrículas multicolumna adaptativas en las listas internas para minimizar el scroll en todo momento.
2. **Regla verificable (Criterio `k`)**:
   - En un viewport de escritorio (`1920×1080`, `2560×1440` o `1440×900`), la altura total del contenedor `.sandbox` no supera `100vh` y tanto el mástil, el piano como las cabeceras y listas principales de las 3 columnas del dashboard son visibles simultáneamente sin scroll vertical del documento.

---

## 8. Fuera de alcance de la Fase 1.1

Quedan explícitamente fuera de la Fase 1.1 (reservados para fases posteriores o descartados):
- Modo Tests (Fase 2), Modo Canción / importación de tabs (Fase 3) y entrada de audio / afinador (Fase 4).
- Orientación vertical del mástil y del piano (eliminada).
- Generación algorítmica de voicings para afinaciones abiertas (`Open G`, `Open D`, `DADGAD` siguen mostrando las notas en el mástil cuando ninguna forma estándar adaptada es válida).
- Acordes alterados de jazz extendidos (`7♭9`, `7♯9`, `7♯11`, `13`) más allá de las 19 calidades del catálogo 1.1.
- Ritmos, compases, tempo configurable o metrónomo en el reproductor de progresiones (la reproducción de progresiones usa una cadencia fija y clara acorde tras acorde).

---

## 9. Orden de Hitos

| Hito | Contenido | Verificación |
|---|---|---|
| **P0 · Roles en piano/mástil, quitar vista vertical y `Requisitos.md`** | Asignar `role: 'pinned'` a `state.notes` en `pianoMarks`; añadir `isRoot` (coexistencia `pinned` + `root`) y el nuevo rol `scale-bg` con variables CSS (claro/oscuro) y formas/bordes diferenciados; eliminar orientación vertical de UI y stores; actualizar `docs/Requisitos.md` (incluido el criterio 8). | Tests de `marks.ts`, `Piano.test.tsx`, `Fretboard.test.tsx`, `SandboxView.test.tsx` |
| **H1 · Catálogo 1.1 + Voicings de cejilla y Power Chords** | Añadir las 7 calidades (`add9`, `madd9`, `m7b5`, `dim7`, `mMaj7`, `maj7#5`, `5`) en `chords.ts` **con sus voicings de cejilla (raíz en 6ª y 5ª)** y formas abiertas canónicas de `5` en `standard.ts`; soporte para díadas `[0, 7]` en `detectChords.ts`; añadir las 5 escalas Bebop, las 2 Napolitanas y las 2 Disminuidas (con metadato de simetría) en `scales.ts`. | `dictionary.test.ts` (cobertura 19 × 12 = 228), `detectChords.test.ts` (`Dadd9`, `C5`, `E5`), `scales` tests (`G bebop dominante`) |
| **H2 · Armonía en cuatríadas y Escalas Relativas** | `diatonicChords(scale, mode, 'triads' \| 'sevenths')` con los 7 grados en mayor, menor natural, armónica y melódica (y soporte `baseScale`); `scaleParentContext` y `groupedRelatedScales` (relativas con su grado en la madre + proximidad). | Tests unitarios para criterios (b), (c), (d), (j) |
| **H3 · Voicings en cuerdas 1–3 y 1–4** | Añadir familias `'strings-1-3'` y `'strings-1-4'` (fundamental, 1ª y 2ª inversión) en `standard.ts`, actualizar `dictionary.ts`, tests de integridad de inversiones y regenerar `docs/voicings.md`. | `dictionary.test.ts` + test explícito del criterio (i) (`x-x-x-5-5-3`, `x-x-x-9-8-8`, `x-x-x-0-1-0`) |
| **H4 · Estado (`chordFocus`, armonía y reglas de reinicio)** | Añadir `chordFocus`, `harmonyMode` y `harmonyProgression` a `sandboxStore`, conectar `marks.ts` para dibujar la escala en `scale-bg` cuando hay `chordFocus`, y probar todas las reglas de reinicio (cambio de contexto, afinación, "Quitar"/"Volver" y "Limpiar"). | `sandbox.test.ts` |
| **H5a–e · Rediseño integral de Interfaz, Navegador de Voicings, Armonía, Progresiones y Escalas** | Rediseñar `SandboxView` según [interfaz.md](interfaz.md) optimizado para `1920×1080` y `2560×1440` (barra superior compacta, menú `⚙ Ajustes`, `ContextStrip` con filtro por familia y soporte `chordFocus`, mástil con `×` en cuerdas muteadas, `InfoPanel` con `scaleParentContext`, `SuggestionsPanel` con `Tríadas / Cuatríadas (7ª)`, `chordFocus` en grados y progresiones con `"Volver a [Acorde]"` e `"Ir al acorde"`, y `ScalesPanel` con escalas relativas y compatibles). | Tests de integración de barra, menú Ajustes, `ContextPickers.test.tsx`, `InfoPanel.test.tsx`, `SuggestionsPanel.test.tsx` y criterios (b), (c), (d), (e), (f), (j), (k) |
| **H5f · Reproducción de Progresiones** | Función `progressionEvents` en `src/audio/playback.ts`, constructor de progresión en Análisis Armónico y botón `▶ Reproducir progresión` tanto en progresiones sugeridas como en el constructor. | Test de audio para criterio (l) |

---

## 10. Criterios de aceptación de la Fase 1.1

La Fase 1.1 está terminada cuando todos los tests existen y pasan para los siguientes casos:

- **(a)** En el piano, una nota pulsada manualmente (`pinned`, verde), una nota de contexto (`tone`, azul) y la tónica (`root`, ámbar con anillo interior) se distinguen por rol, variable CSS (claro/oscuro) y forma/borde; y si una nota pulsada es además la tónica, conserva ambos indicadores (`pinned` + `isRoot`).
- **(b)** Al seleccionar la escala **D dórico**, la interfaz muestra que es el **"II grado de C mayor"**.
- **(c)** Al seleccionar **C mayor** y conmutar el Análisis Armónico a **Cuatríadas (7ª)**, los 7 grados son: `Cmaj7`, `Dm7`, `Em7`, `Fmaj7`, `G7`, `Am7`, `Bm7♭5`.
- **(d)** Al seleccionar **A menor armónica** en **Cuatríadas (7ª)**, los 7 grados son: `Am(maj7)`, `Bm7♭5`, `Cmaj7♯5`, `Dm7`, `E7`, `Fmaj7`, `G♯dim7`.
- **(e)** Con la escala **C mayor** activa, hacer clic en el grado `G7` mantiene la escala de C mayor atenuada de fondo (`scale-bg`) y resalta `G7`; un segundo clic sobre `G7` (o en "Quitar") desactiva el foco y restaura la escala; pulsar **"Ir al acorde"** (con su tooltip y `aria-label`) cambia el contexto principal al acorde `G7`.
- **(f)** Con el acorde **Dm** como contexto, en la progresión `ii–V–I` de Do mayor el grado `Dm` (`ii`) se dibuja con color de acento distinto al resto; hacer clic en `G` (`V`) muestra `G` sin cambiar el contexto principal de `Dm`, y pulsar **"Volver a Dm"** restaura la visualización de `Dm`.
- **(g)** Seleccionar las notas **D, F♯, A, E** con raíz **D** hace que el detector reconozca **`Dadd9`**.
- **(h)** Seleccionar la escala **Bebop dominante de G** produce exactamente las 8 notas **`G, A, B, C, D, E, F, F♯`**.
- **(i)** Para el acorde **C mayor** en afinación estándar, el catálogo de voicings en las **cuerdas 1–3** incluye la posición fundamental **`x-x-x-5-5-3`**, la 1ª inversión **`x-x-x-9-8-8`** y la 2ª inversión **`x-x-x-0-1-0`**.
- **(j)** Al seleccionar **C mayor**, las escalas relativas aparecen agrupadas en un único bloque desplegable y, al expandirlo, cada escala relativa se muestra junto a su grado respecto a la escala madre (`I`, `II`, `III`, `IV`, `V`, `VI`, `VII`).
- **(k)** Se cumple el criterio de altura de la **Sección 9**: en un viewport de escritorio (`1920×1080`, `2560×1440` o `1440×900`), la barra compacta, los instrumentos horizontales y el dashboard de 3 columnas caben dentro de la ventana sin desbordar la altura ni requerir vista vertical.
- **(l)** Reproducir la progresión **`I–V–vi–IV` en Do mayor** programa y reproduce secuencialmente los acordes **`C` → `G` → `Am` → `F`** correctamente.
- **(m)** Al seleccionar las notas **C y G** (o pulsar la digitación de power chord `x-3-5-5-x-x` o `3-5-5-x-x-x`), el detector de acordes reconoce de forma unívoca **`C5`**; y en afinación estándar todas las 12 raíces cuentan con al menos un voicing para la calidad `5` en el catálogo (incluyendo las formas abiertas canónicas `E5` `0-2-2-x-x-x`, `A5` `x-0-2-2-x-x`, `D5` `x-x-0-2-3-x` y las móviles de cejilla en 6ª y 5ª cuerda).
