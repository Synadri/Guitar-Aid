# Registro de decisiones — Fase 2 (Modo Aprender)

Decisiones de diseño, arquitectura e implementación adoptadas durante la Fase 2.

---

## 2026-10-30 — Decisiones fundacionales y alcance de la Fase 2

1. **Nombre del modo: «Aprender»**
   - En el menú lateral (`SideNav`), el modo anteriormente llamado *Tests* pasa a denominarse **Aprender**.
   - Justificación: refleja mejor el propósito dual de la fase (no solo evaluar con ejercicios inmediatos, sino memorizar a largo plazo con repetición espaciada y consultar fórmulas).

2. **Traductor de fórmulas en doble vertiente**
   - Coexisten una **sección propia de exploración y consulta** (`Fórmulas`) y **facetas de tarjetas evaluables** en el sistema de repetición espaciada (`name>formula` y `formula>name`).
   - Justificación: permite al usuario consultar de manera ágil e interactiva la relación fórmula ↔ nombre y, al mismo tiempo, incorporar esa teoría a sus mazos de memorización activa.

3. **Algoritmo de repetición espaciada: SM-2 (variante clásica de Anki)**
   - Se implementa el algoritmo SM-2 detrás de una interfaz desacoplada `Scheduler`, posponiendo FSRS para una fase posterior.
   - Justificación: SM-2 es un algoritmo determinista, contrastado, fácil de auditar mediante tests con reloj simulado y sin dependencias externas complejas.

4. **Tarjetas con respuesta verificada (interacción sobre instrumentos): pospuestas a Fase 2.1**
   - En la Fase 2, las tarjetas funcionan con el flujo tradicional de anverso → mostrar respuesta → autoevaluación (1–4), mientras que la corrección automática interactiva se concentra en los 9 ejercicios de la sección `Ejercicios`. La respuesta verificada por clic o audio queda preparada en el modelo para la Fase 2.1.

5. **Nomenclatura de intervalos por semitonos**
   - Se nombran por distancia en semitonos y grados relativos (`♭5` / `♯4` según el contexto armónico del acorde o escala), sin introducir ortografía diatónica compleja adicional (como diferenciar teóricamente 4ª aumentada de 5ª disminuida cuando el semitono es 6).

6. **Mazos predefinidos como copias editables**
   - Al añadir un mazo predefinido (Principiante, Intermedio o Avanzado), se genera una copia editable independiente en el almacén del usuario, con su propio progreso y posibilidad de personalización.

7. **Ámbito del progreso SRS por mazo**
   - Si una misma tarjeta teórica forma parte de dos mazos distintos, cada mazo gestiona y planifica su fecha e intervalo de repaso de forma independiente.

---

## 2026-10-30 — Hito A0: Preparación y Arquitectura

### 1. Desacoplamiento de `SideNav` y gestión de modos en `AppShell`
- **Problema previo:** `SandboxView` contenía dentro de sí el menú lateral `SideNav` y un estado local `currentMode` que mostraba una tarjeta temporal de "Próximamente" cuando se seleccionaba otro modo. Esto impedía albergar el nuevo modo Aprender sin acoplarlo al contenedor del Sandbox.
- **Decisión:** Se creó el componente `AppShell` (`src/ui/shell/AppShell.tsx`), que ahora vive en la raíz de `App.tsx`. `AppShell` es el responsable de montar `SideNav` y conmutar la vista principal entre `SandboxView`, `LearnView` y el placeholder de `Canción`.
- **Preservación del estado del Sandbox (Criterio a):** `SandboxView` se mantiene puramente como vista de exploración. Cuando el usuario cambia al modo Aprender y luego regresa al Sandbox, `sandboxStore` (Zustand) preserva intactas todas las notas pulsadas (`notes`), el contexto (`context`), el foco de inspección (`chordFocus`) y la afinación sin reiniciarse.

### 2. Atajos globales de teclado según el modo activo
- **Problema:** En el Sandbox, la tecla <kbd>C</kbd> limpia la selección y <kbd>M</kbd> conmuta el sonido. En Aprender, pulsar <kbd>C</kbd> no debe borrar accidentalmente el Sandbox que el usuario dejó configurado.
- **Decisión:**
  - El atajo <kbd>C</kbd> pertenece exclusivamente a `SandboxView` y solo se escucha cuando dicha vista está activa.
  - El atajo <kbd>M</kbd> (silenciar/activar sonido) es global: `AppShell` lo gestiona en los modos de aprendizaje y canción, mientras que `SandboxView` lo gestiona cuando está activo, previniendo dobles alternancias.
  - Se verificó mediante tests automatizados en `AppShell.test.tsx`.

### 3. Centralización de tipos de marca en `src/state/shared/marks.ts`
- **Decisión:** Se extrajeron los tipos `MarkRole`, `FretMark`, `KeyMark`, `MarksOptions`, `DEFAULT_PIANO_RANGE` y `ROLE_PRIORITY` a `src/state/shared/marks.ts`, reexportándolos de forma retrocompatible desde `src/state/sandbox/selectors/marks.ts` y `src/state/index.ts`.
- **Ampliación de roles para evaluación:** Se incorporaron a `MarkRole` los 4 roles de evaluación definidos en la especificación de interfaz (`question`, `wrong`, `missed`, `correct`), soportados en `Fretboard` y `Piano` con sus respectivas variables visuales (forma, color, trazo y borde).

### 4. Capa `src/learning/` y regla estricta de capas ESLint (Criterio p)
- **Decisión:** Se creó la capa `src/learning/` como módulo TypeScript puro:
  - Puede importar únicamente de `src/theory/`.
  - Tiene prohibido importar React, DOM, Zustand, `state`, `ui`, `audio` o la librería `tonal`.
  - Se actualizó `eslint.config.js` y se añadieron casos de prueba unitarios exhaustivos en `src/architecture/layers.test.ts` (38 tests pasando).

### 5. Generador pseudoaleatorio determinista (`src/learning/rng.ts`)
- **Decisión:** Se implementó un generador basado en el algoritmo Mulberry32 con utilidades para `pick`, `shuffle`, `randomInt` y `weightedPick` (selección ponderada). Permite inyectar semillas fijas para que todos los generadores de ejercicios de los hitos posteriores sean 100 % deterministas y verificables en tests.

### 6. Contenedor base de Aprender (`src/ui/learn/LearnView.tsx`)
- **Decisión:** Se implementó `LearnView` con la barra superior de pestañas (`Ejercicios`, `Tarjetas`, `Fórmulas`, `Progreso`) y el indicador de racha diaria (`Racha: N días`), con tarjetas de bienvenida preparadas para albergar las vistas detalladas en los hitos A6–A9.

---

## 2026-10-30 — Hito A1: Fórmulas (Teoría pura)

### 1. Modelado bidireccional y tipos de fórmulas (`src/theory/formulas/types.ts`)
- **Decisión:**
  - `FormulaTone`: representa cada tono de la fórmula con semitono (`semitones`), grado relativo (`degree`), nombre descriptivo (`intervalLong`) y clase de altura (`pc`).
  - `FormulaQuery`: admite una colección de semitonos arbitraria, raíz opcional (`root`), tipo de elemento (`kind: 'chord' | 'scale' | 'any'`) y modo de enarmonía (`mode: 'sharps' | 'flats'`).
  - `IdentifyFormulaResult`: estructura separada en tres grupos (`exact`, `near`, `rotations`) con candidatos `Candidate<FormulaItemRef>`.
- **Justificación:** Permite realizar consultas abstractas sin raíz (devolviendo calidades como `m7`, `6`, `Dórico` o `Mayor` para estudio de intervalos puros) o concretas con raíz (devolviendo nombres y notas reales como `Am7`, `C6` o `D Dórico`), garantizando compatibilidad con la UI de la Fase 2.

### 2. Resolución de nombres a fórmulas (`formulaOfChord` y `formulaOfScale`) (Criterio b)
- **Decisión:**
  - `formulaOfChord` aprovecha `chordTones` (`src/theory/data/chords.ts`), extrayendo los grados cromáticos funcionales (`1`, `♭3`, `5`, `♭7`, `♭5`, `♯5`, `9`, `♭♭7`).
  - `formulaOfScale` resuelve los tonos de la escala a partir de su tipo (`ScaleType`), calculando la clase de altura transpuesta y asignando nombres de grado. Especialmente, en la escala lidia el semitono 6 se etiqueta como `♯4` / `4ª aumentada`, mientras que en acordes disminuidos o en la escala locria se etiqueta como `♭5` / `5ª disminuida`.
- **Verificación:** `formulaOfChord(Am7)` da `1 ♭3 5 ♭7` (`A C E G`), `formulaOfChord(Bm7♭5)` da `1 ♭3 ♭5 ♭7`, y `formulaOfScale(D dórico)` da `1 2 ♭3 4 5 6 ♭7`.

### 3. Motor de identificación por fórmula (`identifyByFormula`) (Criterio c)
- **Garantía de fundamental:** Si `0` no está explícito en la consulta, se incluye automáticamente, ya que toda fórmula se define respecto a la tónica/fundamental.
- **Coincidencias exactas (`exact`):**
  - Acordes: evalúa las máscaras `(inputMask & q.requiredMask) === q.requiredMask && (inputMask & ~q.allowedMask) === 0`, permitiendo acordes con notas opcionales (como la 5ª omitida en el acorde de novena `9`).
  - Escalas: exige igualdad estricta de máscara de bits cromática (`inputMask === s.mask`).
- **Rotaciones (`rotations`, «mismas notas con otra raíz»):**
  - Para cada nota no raíz $r \in inputPcs$, rota la máscara con `rotateMask(inputMask, (12 - r) % 12)` para tratar $r$ como la nueva fundamental.
  - Genera la razón `sameNotesOtherRoot` con el grado relativo original (`rootDegree`, ej. `♭3` en `C6 sobre el ♭3` para Am7, o `♭7` en `Mayor sobre el ♭7` para D dórico).
- **Cercanas (`near`, a 1 nota de distancia):**
  - **Sustracción («quita Y» / `formulaMissingTone`):** evalúa omitir cada nota $y \ne 0$; por ejemplo, `[0, 4, 7, 10, 14]` (9) quitando el 14 produce `7` («quita 9»), y `[0, 4, 7, 11]` (maj7) quitando el 11 produce `maj` («quita 7»).
  - **Adición («añade X» / `formulaAddsTone`):** evalúa si un acorde o escala del catálogo tiene una nota más que el conjunto de entrada y contiene todas sus notas; por ejemplo, sobre `[0, 4, 7]` detecta `maj7` («añade 7») y `7` («añade ♭7»).
  - Los candidatos ya presentes en `exact` se descartan de `near`.
- **Ordenación determinista:** Se ordena por puntuación intrínseca del catálogo (`q.weight` / `s.weight`) en orden descendente, desempatando por nombre alfabético.

### 4. Ampliación de intervalos en `src/theory/core/interval.ts`
- **Decisión:**
  - Se incorporaron `P8` (12 semitonos) y `M9` (14 semitonos) a `IntervalShortName` y a la función `intervalName()`.
  - Se añadieron `'octava'`, `'octava justa'`, `'4ª aumentada'` y `'9ª mayor'` a `IntervalLongName` e `intervalLongName()`.
  - Se amplió `Degree` con `'8'` (para 12 semitonos) manteniendo `'9'` (para 14 semitonos).

### 5. Utilidades del mástil en `src/theory/fretboard/index.ts` (Criterios d, e)
- **Decisión:**
  - `intervalBetween(posA, posB, tuning?)`: calcula la distancia en semitonos entre dos posiciones del mástil (con sobrecargas para recibir la afinación como primer o tercer argumento, o usando `STANDARD_TUNING` por defecto). En la misma cuerda opera puramente como `posB.fret - posA.fret`. Entre cuerdas contiguas o distantes refleja fielmente la afinación, distinguiendo la irregularidad Sol–Si ((4, 2) → (3, 2) da 5 semitonos / P4, mientras que (3, 2) → (2, 2) da 4 semitonos / M3).
  - `positionsAtInterval(tuning, pos, semis, options?)`: resuelve todas las posiciones a una distancia de `semis` semitonos respecto a `pos`. Soporta filtros por cuerdas activas (`strings`) y rango de trastes (`fretRange`: tupla `[min, max]` u objeto `{ min, max }`), respetando afinaciones alternativas como Drop D.

### 6. Integración en el sistema de razones y traducción UI
- **Decisión:** Se agregaron `formulaExact`, `formulaAddsTone`, `formulaMissingTone` y `sameNotesOtherRoot` a `ReasonCode` (`src/theory/analysis/types.ts`) y sus respectivos formateadores en español en `REASON_FORMATTERS` (`src/ui/panels/texts.ts`), garantizando consistencia tipada en todo el proyecto.

---

## 2026-10-30 — Hito A2: Motor de ejercicios (Puro)

### 1. Modelo desacoplado de respuestas y corrección (`src/learning/answers.ts`)
- **Decisión:**
  - `AnswerInput`: unión discriminada que contempla `positions` (`FretPosition[]`), `pitchClass` (`PitchClass`), `interval` (`semitones`, `interval`), `labels` (`{ position, label }[]`), `choice` (`string | number`) y `midi` (`number[]`).
  - `ExpectedAnswer`: unión discriminada con las mismas categorías para representar la solución de una pregunta.
  - `Grade`: estructura de resultado con `correct` (booleano), `partial` (booleano opcional), `score` (0 a 1), listas detalladas de `hits` (aciertos), `misses` (faltantes) y `extras` (sobrantes o incorrectos), y `explanation` (texto pedagógico con diagnóstico o confirmación teórica).
- **Justificación:** `AnswerInput` y `grade()` son completamente independientes de React, del DOM y de Zustand. Hoy reciben las entradas generadas por clics en mástil, piano o botones; en la Fase 4 podrán recibir directamente clases de altura o notas MIDI desde el detector de audio sin modificar una sola línea del corrector.

### 2. Modos de evaluación `all` y `first` (Criterio f)
- **Decisión:**
  - En modo `'first'`, la pregunta se considera superada con éxito (`correct: true`, `score: 1`) en cuanto el usuario introduce cualquiera de las posiciones válidas esperadas. Si la posición es incorrecta, se reporta como extra y la corrección informa de los fallos.
  - En modo `'all'`, se exige marcar todas las posiciones esperadas sin sobrantes (`misses.length === 0 && extras.length === 0`). Si el usuario introduce un subconjunto correcto pero incompleto, o incluye sobrantes, `grade()` marca `partial: true` y calcula una puntuación proporcional `score` desglosando con precisión `hits`, `misses` y `extras`.

### 3. Catálogo tipado y modularización de ejercicios (`src/learning/drills/`)
- **Decisión:** Se dividió la lógica generadora en cuatro módulos especializados con tipado estricto:
  - `notes.ts`:
    - **A1 (Encuentra la nota):** genera una clase de altura y resuelve todas las posiciones en las cuerdas activas y rango de trastes configurado.
    - **A2 (Nombra la nota):** selecciona una posición y exige elegir la clase de altura correspondiente.
  - `intervals.ts`:
    - **B1 (Intervalo en una cuerda):** selecciona una posición de referencia y un intervalo a recorrer a lo largo de la misma cuerda (Criterio d).
    - **B2 (Intervalo entre cuerdas):** selecciona origen y destino entre pares de cuerdas distintos, teniendo en cuenta la afinación real (Criterio e).
    - **B3 (Nombra el intervalo):** presenta dos posiciones en el mástil y exige determinar la distancia interválica en semitonos o nombre corto (Criterio e).
    - **B4 (Mapa de intervalos):** proporciona una raíz y un intervalo y pide marcar todas las ocurrencias de ese grado armónico en el mástil.
  - `shapes.ts`:
    - **B5 (Etiqueta la forma):** utiliza el diccionario de voicings (`OPEN_VOICING_SHAPES`) para presentar las posiciones de un acorde conocido y exigir la identificación del grado de cada nota respecto a la fundamental (Criterio g).
  - `build.ts`:
    - **C1 (Construye el acorde):** práctica de construcción de acordes sobre una cuerda única (arpegio lineal) o zona del mástil.
    - **C2 (Escala en una cuerda):** práctica de escalas de forma lineal sobre una sola cuerda elegida.
  - `index.ts`: exporta `generateDrillQuestion(drillId, rng, config, stats)` como despachador maestro determinista.

### 4. Precisión teórica y casos límite verificados
- **Criterio (d) — B1 en misma cuerda:**
  - Referencia en (5, 3) [C3] + 3ª mayor (`M3`, 4 semitones) ascendente en la cuerda 5 da como única respuesta correcta (5, 7) [E3]. Marcar (4, 2) (que es E3 pero en la cuerda 4) es evaluado como incorrecto (`correct: false`, `extras: [(4, 2)]`, `misses: [(5, 7)]`).
- **Criterio (e) — Irregularidad Sol–Si en B2 y B3:**
  - En afinación estándar, B3 distingue que (4, 2) → (3, 2) son 5 semitonos (`P4`), mientras que (3, 2) → (2, 2) son 4 semitonos (`M3`).
  - En B2, desde (3, 5) [C4] una 3ª mayor hacia la cuerda 2 resuelve exactamente en (2, 5) [E4].
- **Criterio (f) — A1 en estándar y modo `all`:**
  - Para la nota «C» en las 6 cuerdas y trastes 0–12, el conjunto esperado calculado es exactamente `{(6, 8), (5, 3), (4, 10), (3, 5), (2, 1), (1, 8)}`.
- **Criterio (g) — B5 con Am abierto:**
  - Para el voicing `x-0-2-2-1-0` (`open-Am`), los grados resueltos para las cuerdas 5 a 1 son exactamente `1, 5, 1, ♭3, 5`.
- **Criterio (o) — Soporte de afinaciones alternativas (Drop D):**
  - Con afinación Drop D (`[38, 45, 50, 55, 59, 64]`), la nota «D» en la cuerda 6 dentro del rango de trastes 0–12 genera exactamente las posiciones `(6, 0)` [D2] y `(6, 12)` [D3].

### 5. Algoritmo adaptativo determinista (`src/learning/drills/adaptive.ts`) (Criterio q)
- **Decisión:**
  - Se diseñó la función `computeItemWeight(key, statsMap)` que pondera los ítems de acuerdo a su historial estadístico:
    - Base de peso = $1.0$.
    - Ponderación por tasa de fallos reciente: hasta $+4.0 \times \text{errorRate}$ sobre los últimos intentos (`recentResults`).
    - Si el último intento fue fallido, aplica un refuerzo de reintento de $+1.0$.
    - Si el tiempo de respuesta medio supera los 4 segundos, añade peso por vacilación.
  - La selección se realiza con `adaptivePick()` mediante el RNG con semilla inyectable (`weightedPick`).
  - **Verificación determinista:** Con una semilla fija (Mulberry32), un ítem con fallos recientes se selecciona más del 65 % de las veces frente a uno sin fallos en 100 iteraciones (test unitario automatizado).

### 6. Cumplimiento estricto de la regla de capas
- Toda la lógica desarrollada en `src/learning/` es TypeScript puro. Importa exclusivamente de `src/theory/` y de utilidades internas de `src/learning/`.
- Queda verificado mediante ESLint y `src/architecture/layers.test.ts`, manteniendo el aislamiento total de UI, DOM, Audio y Zustand.

---

## 2026-10-30 — Hito A3: Tarjetas y Repetición Espaciada pura (SRS)

### 1. Estructura y gramática canónica de IDs de tarjeta (`src/learning/cards/ids.ts`)
- **Decisión:** Se implementó el formato canónico `cardId = "<sujeto>|<faceta>"` para los 10 sujetos musicales del catálogo (§6.1):
  1. `interval:<semitonos>` (`name>semitones`, `semitones>name`)
  2. `fretnote:s<c>f<t>` (`pos>name`, `name>pos`)
  3. `notestring:<pc>:s<c>` (`name>pos`, `pos>name`)
  4. `quality:<id>` (`name>formula`, `formula>name`)
  5. `chord:<pc>:<id>` (`name>notes`, `notes>name`, `name>formula`)
  6. `voicing:<plantilla>@<pc>` (`name>shape`, `shape>name`)
  7. `scaletype:<id>` (`name>formula`, `formula>name`, `mode>parent`)
  8. `scale:<pc>:<id>` (`name>notes`, `notes>name`, `name>parent`, `name>formula`)
  9. `degree:<pc>:<modo>:<grado>:<triads|sevenths>` (`roman>chord`, `chord>roman`)
  10. `progression:<id>:<pc>` (`roman>chords`, `chords>roman`)
- **Validación bidireccional:** `formatCardId` genera el identificador determinista y `parseCardId` valida no solo la sintaxis, sino la coherencia semántica (rechaza facetas incompatibles con el sujeto, números de cuerda fuera de 1–6, trastes negativos o clases de altura fuera de 0–11).

### 2. Resolución de tarjetas y contenido dinámico (`src/learning/cards/facets.ts`)
- **Decisión:** Las tarjetas no almacenan cadenas de texto estáticas ni HTML; su contenido se calcula dinámicamente mediante `resolveCard(cardId, tuning)` a partir de la teoría pura y la afinación activa (`STANDARD_TUNING` por defecto).
- **Estructura de `ResolvedCard`:** Proporciona los datos desacoplados de la interfaz:
  - `front` y `back`: títulos principales, subtítulos descriptivos, detalles, listas de notas, grados y posiciones físicas en el diapasón (`positions`, `voicingFrets`).
  - `audioMidis`: lista de alturas MIDI para reproducción auditiva inmediata con el botón «Escuchar».
  - `sandboxContext`: configuración `{ root, chordQuality, scaleType, mode }` preparada para el botón «Abrir en Sandbox».
- **Tratamiento de tarjetas no resolubles:** Si una digitación (`voicing`) no existe en el catálogo o no puede transportarse dentro del límite físico de 24 trastes con la afinación actual, `resolveCard` devuelve `null` de forma segura. El sistema SRS omite la presentación de dicha tarjeta sin alterar su estado ni borrar su progreso.

### 3. Constructor declarativo de mazos (`src/learning/cards/builder.ts`) (Criterio i)
- **Decisión:** Se creó el motor puro `buildDeckCardIds(sources: DeckSource[])` que procesa colecciones de reglas declarativas basadas en productos cartesianos y fuentes especializadas:
  - `voicings`: filtra formas abiertas por raíz fija y expande formas móviles (`barre-E`, `barre-A`, etc.) por las raíces seleccionadas.
  - `chords` y `qualities`: expansión de calidades y acordes concretos.
  - `scales`, `scaleTypes` y `scaleModes`: soporte del atajo «modos de una escala madre», resolviendo de manera transparente los 7 modos de una tonalidad madre hacia sus facetas de notas o fórmulas.
  - `degrees` y `progressions`: armonía diatónica y secuencias armónicas.
  - `fretNotes` y `stringNotes`: notas en mástil y cuerdas individuales con filtro opcional de notas naturales.
- **Verificación de Criterio (i):** El mazo de ejemplo *«tríadas maj/m en open y cejilla + modos de C mayor»* genera exactamente las tarjetas esperadas (incluyendo `voicing:open-C-maj@0|name>shape` y `scale:2:dorian|name>notes`), sin ninguna tarjeta ajena a las fuentes declaradas.

### 4. Mazos predefinidos y recuentos de tarjetas (`src/learning/cards/presets.ts`) (Criterio l)
- **Decisión:** Se definieron las plantillas declarativas de los 3 mazos predefinidos y la función `createDeckFromPreset` que genera una copia editable e independiente con identificador y marcas de tiempo propios.
- **Recuentos exactos materializados en afinación estándar:**
  - **Mazo Principiante (`112 tarjetas`):**
    - Notas naturales en cuerdas 6 y 5 (trastes 0–12, `pos>name`).
    - Intervalos de `m2` a `P8` en ambos sentidos (nombre ↔ semitonos).
    - Fórmulas de `maj`, `m`, `5`, `7` (ambos sentidos).
    - Digitaciones abiertas de `maj`, `m` y `7` (nombre ↔ forma).
    - Fórmulas de escala mayor, menor natural y pentatónicas.
    - Notas de C, G y D mayor y A y E menor (con sus pentatónicas).
    - Progresiones `I–IV–V` e `I–V–vi–IV` en C, G, D, A y E (ambos sentidos).
  - **Mazo Intermedio (`362 tarjetas`):**
    - Todas las notas (con alteraciones) en las 6 cuerdas, trastes 0–12 (`pos>name`).
    - Fórmulas de 12 calidades de 7ª y extensiones (`m7`, `maj7`, `6`, `m6`, `sus2`, `sus4`, `dim`, `aug`, `add9`, `m7b5`, `dim7`, `9`).
    - Cejillas `barre-E` y `barre-A` de `maj`, `m`, `7`, `m7` y `maj7` en raíces naturales.
    - Los 7 modos de la escala mayor (fórmula, grado en la madre y notas de los modos de C mayor).
    - Fórmulas de menor armónica y menor melódica.
    - Armonía diatónica en tríadas de C, G, D, F, A mayor y A, E, D menor (`roman>chord`).
    - Progresiones `ii–V–I`, `vi–IV–I–V`, andaluza e `i–iv–v` en tonalidades comunes.
  - **Mazo Avanzado (`1022 tarjetas`):**
    - Todo el mástil (0–24) en ambos sentidos (`pos>name` y `name>pos`).
    - Catálogo completo de fórmulas (19 calidades) en ambos sentidos.
    - Digitaciones `strings-1-4` (Drop 2 e inversiones) y `strings-1-3` (inversiones de tríadas) de `maj`, `m`, `maj7`, `m7` y `7` en raíces naturales.
    - Fórmulas de 9 escalas avanzadas (bebop, disminuidas y napolitanas).
    - Armonía diatónica en cuatríadas en las 12 tonalidades mayores y menores (`roman>chord`).
    - Las 10 plantillas de progresiones en las 12 tonalidades (ambos sentidos).
- **Validación del 100 % de resolución (Criterio l):** Se verificó mediante tests automatizados que las 1496 tarjetas generadas por los 3 mazos predefinidos se resuelven satisfactoriamente en afinación estándar sin generar ningún error ni valor `null`.

### 5. Planificador SM-2 y vista previa de intervalos (`src/learning/srs/scheduler.ts`) (Criterio h)
- **Decisión:** Se implementó el planificador puro SM-2 (variante clásica de Anki) con reloj determinista inyectable `now` y sin fluctuación aleatoria (*fuzz*), cumpliendo con exactitud matemática las transiciones especificadas:
  - *Nueva + Bien:* paso 2 de aprendizaje a **10 min**.
  - *Aprendizaje (paso 2) + Bien:* graduación a repaso con intervalo de **1 d**.
  - *Repaso 1 d (facilidad 2,50) + Bien:* $\max(1 + 1, \text{round}(1 \times 2.50)) = $ **3 d**.
  - *Repaso 3 d + Difícil:* $\text{round}(3 \times 1.2) = $ **4 d**, facilidad reducida en $-0.15$ a **2,35**.
  - *Repaso 10 d + Fácil:* $\text{round}(10 \times 2.50 \times 1.3) = $ **33 d**, facilidad incrementada en $+0.15$ a **2,65**.
  - *Repaso 10 d + Otra vez:* paso a reaprendizaje a **10 min**, lapsus $+1$, facilidad reducida en $-0.20$ a **2,30** y, tras pulsar *Bien*, retorno a repaso con intervalo de **1 d**.
  - *Nueva + Fácil:* graduación inmediata con intervalo fácil de **4 d**.
  - *Suelo de facilidad:* límite inferior inmutable de **1,30**, verificado tras 10 fallos consecutivos en repaso.
- **Vista previa accesible (`previewIntervals`):** Se implementó la proyección previa para los 4 botones (`Otra vez`, `Difícil`, `Bien`, `Fácil`), formateando los tiempos de forma concisa y amigable en español (`1 min`, `5,5 min`, `10 min`, `1 d`, `3 d`, `4 d`, `33 d`).

### 6. Cola de estudio, límites diarios y corte a las 04:00 (`src/learning/srs/queue.ts`) (Criterio k)
- **Decisión:**
  - **Corte de día a las 04:00 hora local:** `getStudyDayKey(timestamp)` desplaza 4 horas el reloj de referencia local. De este modo, una sesión a las 03:59:59 pertenece aún al día de estudio previo, y a las 04:00:00 exactas el día avanza y se renuevan automáticamente los cupos diarios sin requerir procesos en segundo plano.
  - **Límites diarios por defecto:** 20 tarjetas nuevas y 200 repasos por mazo.
  - **Ensamblado de cola en `buildStudyQueue`:**
    1. Tarjetas en aprendizaje o reaprendizaje cuyo vencimiento ya ha llegado (`due <= now`), ordenadas por urgencia temporal.
    2. Repasos vencidos (acotados por el límite diario restante) y tarjetas nuevas (acotadas por el cupo de 20 diario restante), intercaladas alternativamente para distribuir la carga cognitiva durante la sesión.

---

## 2026-10-30 — Hito A4: Estado de ejercicios (`state/drills`)

### 1. Arquitectura y modularización desacoplada (`src/state/drills/`)
- **Decisión:** Se creó el módulo `src/state/drills/` organizado en:
  - `types.ts`: contratos de tipos para el ciclo de vida de la sesión (`DrillSessionPhase`), métricas en curso (`SessionRunningStats`), registros de historial (`DrillSessionRecord`), estado global (`DrillsState`), acciones (`DrillsActions`) y esquema persistido (`PersistedDrillsState`).
  - `store.ts`: tienda implementada con Zustand vainilla y middleware `persist`, desacoplada de React y del DOM para permitir su uso directo en la UI o en tests unitarios. Soporta inyección de generador pseudoaleatorio (`rng` o `seed`), reloj inyectable (`now`) y almacenamiento personalizado (`storage`).
  - `selectors/marks.ts`: selectores puros `selectDrillFretboardMarks` y `selectDrillPianoMarks` que transforman el estado de la pregunta y corrección en marcas visuales tipadas para `Fretboard` y `Piano`.
  - `selectors/stats.ts`: selectores de análisis para la futura vista de progreso (`selectFretboardAccuracyMap`, `selectWeakIntervals`, `selectRecentSessionEvolution`).
  - `selectors/index.ts` e `index.ts`: puntos de entrada y reexportación global en `src/state/index.ts`.
- **Cumplimiento de capas (ESLint y layers.test.ts):** `src/state/drills` importa exclusivamente de `src/theory` y `src/learning`, sin dependencias prohibidas de React, DOM, Audio ni Tonal.

### 2. Máquina de estados de la sesión (`configurar → preguntar → responder → corregir → resumen`)
- **Decisión:** Se implementó una máquina de estados determinista para modelar el flujo de práctica intensiva:
  - **`configuring`:** fase de preparación o cambio de ejercicio en la barra lateral (`setDrill`). Carga la configuración predeterminada o previamente personalizada (`configs[drillId]`) y limpia cualquier sesión previa.
  - **`question`:** iniciada mediante `startSession()` o `nextQuestion()`. Invoca `generateDrillQuestion()` con la afinación y configuración activas, inyectando el mapa de estadísticas (`itemStats`) para el algoritmo adaptativo, inicia el cronómetro de respuesta (`questionStartTime = now()`) y presenta la pregunta limpia con sus marcas de referencia (`role: 'question'`).
  - **`answering`:** se activa al interactuar con el mástil (`togglePosition`) en ejercicios de selección múltiple (modo `all`, como B4, B5, C1, C2) o al asignar etiquetas de grado (`assignLabel` en B5), acumulando las respuestas en `pinnedPositions` y `assignedLabels`.
  - **`corrected`:** al invocar `submitAnswer()` o `checkAnswer()` (o de forma instantánea al clicar en ejercicios de modo `first` como B1, B2, A2 o B3):
    1. Ejecuta el corrector puro `grade(currentQuestion, input)`.
    2. Calcula el tiempo exacto transcurrido `elapsedMs`.
    3. Acumula las métricas de la sesión (`questionsAnswered`, `correctCount`, `totalTimeMs`).
    4. Actualiza las estadísticas persistidas por `itemKey`: incrementa intentos y aciertos, añade el booleano al array `recentResults` (acotado a los últimos 20 resultados) y actualiza el promedio móvil de tiempo `averageTimeMs`.
    5. Fija `lastGrade` y transiciona a `'corrected'` para exhibir la corrección visual y explicativa.
  - **`summary`:** al completar la última pregunta de la sesión (`questionNumber >= totalQuestions`), `nextQuestion()` genera un registro inmutable `DrillSessionRecord` en `history` (acotado a las últimas 100 sesiones) con fecha ISO, precisión porcentual y tiempo medio por pregunta, transicionando a la pantalla de resumen.
  - **Reinicio y salida:** `restartSession()` reanuda una nueva tanda con la misma configuración; `endSession()` regresa a `'configuring'`.

### 3. Criterios de evaluación (d) y (g) integrados y verificados en el store
- **Criterio (d) — B1 en estándar:**
  - Pregunta con referencia (5, 3) [C3] y objetivo 3ª mayor ascendente en la misma cuerda.
  - Si el usuario marca (4, 2) (también E3, pero en la cuerda 4), `submitAnswer` evalúa `correct: false`, `score: 0`, `misses: [(5, 7)]` y `extras: [(4, 2)]`.
  - El selector de marcas proyecta (5, 3) como `question`, (5, 7) como `missed` con etiqueta `M3`, y (4, 2) como `wrong`. Marcar (5, 7) evalúa `correct: true` con marca `correct` y etiqueta `M3`.
- **Criterio (g) — B5 con voicing `x-0-2-2-1-0` (Am abierto):**
  - La pregunta proporciona las posiciones físicas del voicing y la raíz en cuerda 5 traste 0.
  - Mediante `assignLabel()`, el usuario introduce los grados de la cuerda 5 a la 1: `1, 5, 1, ♭3, 5`.
  - `checkAnswer()` califica con `correct: true`, `score: 1`, y el selector de marcas proyecta cada cuerda con su grado correspondiente bajo el rol `correct`. Si se asigna un grado incorrecto (ej. `3` en vez de `♭3`), se proyecta con rol `wrong` y la etiqueta errónea introducida.

### 4. Criterio (n) — Selectores de marcas en mástil y piano con etiquetas de intervalo relativas a la referencia
- **Decisión:**
  - `selectDrillFretboardMarks(state, options)`:
    - En fase `question`/`answering`: marca la referencia con `role: 'question'` (y `isRoot: true`), y las selecciones provisionales con `role: 'pinned'`.
    - En fase `corrected`:
      - La referencia permanece con `role: 'question'` y etiqueta `1` (o nombre de nota).
      - Los aciertos (`hits`) llevan `role: 'correct'` con la etiqueta del intervalo en semitonos respecto a la referencia (`intervalName(semis)`, ej. `M3`, `P4`, `P5`), o el grado en B5.
      - Los olvidos (`misses`) llevan `role: 'missed'` con la etiqueta del intervalo esperado respecto a la referencia.
      - Los errores o sobrantes (`extras`) llevan `role: 'wrong'` con la etiqueta del intervalo real que el usuario marcó respecto a la referencia (permitiendo entender pedagógicamente el desvío, ej. `m3` en vez de `M3`).
  - `selectDrillPianoMarks(state, options)`:
    - Traduce cada `FretMark` a tecla MIDI lineal mediante `positionToMidi(tuning, pos)`.
    - Resuelve solapes en la misma tecla MIDI usando la jerarquía estricta `ROLE_PRIORITY` (`correct`/`wrong` [9] > `missed` [8] > `question` [7] > `pinned` [6]), asegurando concordancia visual total entre mástil y piano.

### 5. Criterio (m) — Persistencia (`version: 1`), exportar/importar y tolerancia a datos corruptos
- **Decisión:**
  - **Almacenamiento persistido:** utiliza la clave `guitar-aid:drills` y `version: 1`.
  - **Aislamiento de sesión en recarga:** la función `partialize` solo persiste las estructuras duraderas (`itemStats`, `history`, `configs`, `lastDrillId`). El estado volátil de la sesión activa (`phase`, `currentQuestion`, `lastGrade`, `pinnedPositions`) se descarta intencionadamente al guardar, garantizando que tras recargar el navegador el store siempre inicie limpio en `phase: 'configuring'` sin estados huérfanos.
  - **Ida y vuelta de copia de seguridad:**
    - `exportData()` serializa a JSON la versión 1, `itemStats`, `history` y configuraciones.
    - `importData(json)` valida exhaustivamente la estructura y tipos numéricos antes de aplicar, devolviendo `true` si es válida o `false` seguro si el JSON está mal formado o no cumple el esquema.
  - **Tolerancia a datos corruptos:** la función `merge` del middleware `persist` analiza y sanea cada clave de `itemStats` e `history`. Si el almacenamiento local contiene datos manipulados, tipos incorrectos (ej. cadenas en vez de números) o valores nulos, inicializa con valores por defecto seguros (`itemStats: {}`, `history: []`, `drillId: 'A1'`) sin lanzar ninguna excepción.

### 6. Selectores analíticos de progreso
- **Decisión:** Se crearon tres selectores puros para alimentar la pestaña `Progreso`:
  - `selectFretboardAccuracyMap(state, maxFret)`: genera la cuadrícula de 6 cuerdas × 13 trastes (0..12) categorizando cada posición según su tasa de acierto en las estadísticas acumuladas: `mastered` (≥ 85 %), `learning` (60–84 %), `weak` (< 60 %) o `untested` (0 intentos).
  - `selectWeakIntervals(state, limit)`: agrega las variantes de cuerdas de los ejercicios de intervalos (claves `interval:<nombre>|...`), calcula la precisión combinada de cada intervalo y devuelve los $N$ más débiles ordenados por menor precisión.
  - `selectRecentSessionEvolution(state, limit)`: extrae las últimas sesiones del historial para alimentar el gráfico de barras de evolución temporal.

---

## 2026-10-30 — Hito A5: Estado de mazos y progreso (`state/decks`)

### 1. Arquitectura y modularización desacoplada (`src/state/decks/`)
- **Decisión:** Se creó el módulo `src/state/decks/` organizado en:
  - `types.ts`: contratos de tipos para mazos (`Deck`, `CreateDeckInput`, `UpdateDeckInput`), sesión de estudio (`FlashcardSession`), registros de historial (`ReviewLogEntry`), estado global (`DecksState`), acciones (`DecksActions`), métricas de progreso (`DeckStats`, `GlobalDeckStats`) y esquema persistido (`PersistedDecksState`).
  - `store.ts`: tienda implementada con Zustand vainilla y middleware `persist` (`guitar-aid:decks`, `version: 1`), desacoplada de React y del DOM. Soporta inyección de reloj (`now`), generador de identificadores (`idGenerator`), configuración del planificador (`schedulerConfig`) y almacenamiento configurable (`storage`).
  - `selectors.ts`: selectores puros para la UI: mazo activo, búsqueda por ID, estado SRS por mazo, contadores de cola hoy, proyección previa de intervalos (`previewIntervals`), resolución de tarjeta en anverso y reverso (`resolveCard`) y estadísticas agregadas para la pantalla de Progreso (§7.3: `pendientesHoy`, `retención`, `nuevas`, `enAprendizaje`, `totalRepasos`).
  - `index.ts`: punto de entrada reexportado en `src/state/index.ts`.
- **Cumplimiento de capas (ESLint y layers.test.ts):** `src/state/decks` importa exclusivamente de `src/theory` y `src/learning`, sin dependencias prohibidas de React, DOM, Audio ni Tonal.

### 2. CRUD completo de mazos y conservación de progreso al editar (Criterio j)
- **Decisión:**
  - **Creación (`createDeck`):** genera un identificador único, materializa la lista de tarjetas (`cardIds`) ejecutando el constructor puro `buildDeckCardIds(sources)` e inicializa su diccionario SRS independiente.
  - **Regeneración al editar (`updateDeck`):** si se modifican las reglas declarativas (`DeckSource[]`), regenera `cardIds`. **Las tarjetas que continúan en el mazo conservan intacto su estado SRS** (facilidad, intervalo, fecha de vencimiento `due`, repeticiones y lapsus). Las tarjetas retiradas no se purgan de la memoria SRS para no perder su histórico de aprendizaje y las nuevas entran en estado `'new'`.
  - **Eliminación (`deleteDeck`):** purga el mazo, su diccionario SRS y su registro de uso diario, actualizando la selección activa de forma segura.
  - **Duplicación (`duplicateDeck`):** clona las reglas y límites bajo un nuevo ID con el sufijo `(copia)` y progreso SRS limpio.
  - **Mazos predefinidos (`addPresetDeck` / Criterio l):** permite instanciar los mazos `Principiante`, `Intermedio` y `Avanzado` como copias editables e independientes con progreso propio.
  - **Aislamiento de progreso por mazo (Criterio j):** el progreso se estructura bajo `cardsSRS[deckId][cardId]`. Si una misma tarjeta (ej. `voicing:open-C-maj@0|name>shape` o `interval:4|name>semitones`) existe simultáneamente en dos mazos distintos, valorarla en un mazo no afecta en absoluto a su fecha de vencimiento, intervalo ni facilidad en el otro.

### 3. Límites diarios de tarjetas nuevas y corte a las 04:00 (Criterio k)
- **Decisión:**
  - **Seguimiento por mazo:** el store registra el uso diario en `dailyUsage[deckId] = { studyDay, newCount, reviewCount }`.
  - **Límite diario respetado:** cada vez que se valora por primera vez una tarjeta en estado `'new'`, se incrementa `newCount`. Al alcanzar el límite (por defecto 20 nuevas al día por mazo), `buildStudyQueue` y `getStudyQueueCounts` dejan de presentar tarjetas nuevas para ese mazo durante el resto del día de estudio.
  - **Corte de día a las 04:00 hora local:** `getStudyDayKey(now)` desplaza 4 horas el reloj de referencia local. Sesiones a las 03:59:59 siguen computando en el día previo; al alcanzar las 04:00:00 se reinicia automáticamente el cupo a 20 nuevas disponibles sin necesidad de recargar la aplicación ni procesos de fondo.

### 4. Ciclo de vida de la sesión de estudio de tarjetas
- **Decisión:**
  - **Inicio (`startSession`):** ensambla la cola ordenada de estudio usando `buildStudyQueue` (tarjetas en aprendizaje vencidas primero, seguidas de repasos vencidos y nuevas intercaladas hasta el límite diario) y calcula los contadores pendientes (`counts`).
  - **Revelación (`revealAnswer`):** conmuta `isAnswerRevealed: true`, habilitando el reverso con diagrama de acordes SVG (`ChordDiagram`), notas y opciones de acción.
  - **Valoración (`rateCard`):**
    - Aplica la transición SM-2 mediante `schedule(prevSRS, rating, now, config)`.
    - Genera una entrada en `history` (`ReviewLogEntry`), acotado a las últimas 5000 entradas.
    - Actualiza el uso diario en `dailyUsage`.
    - **Reencolado pedagógico ante fallos:** si el usuario pulsa *Otra vez* (`rating === 'again'`), la tarjeta se vuelve a encolar al final de la sesión activa (`session.queue.push(cardId)`) para que el usuario repita y fije el concepto antes de terminar.
    - Al completar todas las tarjetas de la cola, la sesión finaliza automáticamente (`session = null`).
  - **Salida (`endSession`):** permite abandonar la sesión en cualquier momento regresando a la lista de mazos.

### 5. Persistencia (`version: 1`), exportar/importar y tolerancia a datos corruptos (Criterio m)
- **Decisión:**
  - **Clave de almacenamiento:** utiliza `guitar-aid:decks` con `version: 1`.
  - **Aislamiento de sesión en recarga:** la función `partialize` solo persiste las estructuras duraderas (`decks`, `activeDeckId`, `cardsSRS`, `dailyUsage`, `history`), descartando deliberadamente la sesión volátil `session`. De este modo, tras recargar el navegador, el usuario nunca queda atrapado en una tarjeta a medio contestar.
  - **Ida y vuelta de exportar/importar:** `exportData()` serializa a JSON la copia de seguridad completa; `importData(json)` valida exhaustivamente la integridad del árbol de datos y tipos numéricos antes de aplicarlos (soportando tanto exportaciones directas como paquetes combinados con drills).
  - **Tolerancia a datos corruptos:** las funciones `migrate` y `merge` del middleware `persist` sanean minuciosamente cada clave. Si el almacenamiento local contiene datos malformados, tipos incorrectos o valores nulos, inicializa con valores por defecto seguros (mazo inicial `Principiante`, SRS limpio e historial vacío) sin arrojar ninguna excepción.

### 6. Selectores analíticos para la sección Progreso (§7.3)
- **Decisión:**
  - `selectDeckStats(state, deckId, now)`: calcula el desglose individual de un mazo (total, nuevas, aprendizaje, repasos, pendientes hoy y porcentaje de retención).
  - `selectGlobalStats(state, now)`: consolida las métricas de todos los mazos para alimentar directamente la tarjeta de Tarjetas en la pantalla de Progreso:
    - `{pendientesHoy}`: suma de pendientes en todos los mazos para la fecha actual.
    - `{retención} %`: porcentaje de éxito en repasos acumulados en el historial (`rating !== 'again'`).
    - `{nuevas}`: total de tarjetas que aún no han sido iniciadas.
    - `{enAprendizaje}`: total de tarjetas en fases de aprendizaje o reaprendizaje.
    - `{totalRepasos}`: recuento total de repasos realizados.

---

## 2026-10-30 — Hito A6: UI: shell Aprender + Fórmulas (`src/ui/learn/formulas/`)

### 1. Extensión de instrumentos (`Fretboard` y `Piano`) con roles de evaluación y props de aprendizaje
- **Decisión:**
  - **Soporte de roles de evaluación en `Fretboard` y `Piano` (§3.1):**
    - `question`: círculo sólido opaco (`r = 12` en mástil, `r = 11` en piano) con relleno turquesa (`#14b8a6` / `#0d9488`) y etiqueta en negrita.
    - `wrong`: cuadrado redondeado SVG (`22×22 px`, `rx = 5`) con borde sólido de `2 px`, relleno atenuado (`rgba(127, 29, 29, 0.55)` / `#fee2e2`), trazo rojo (`#f87171` / `#dc2626`) y aspa central `×` (o etiqueta).
    - `missed`: círculo con trazo discontinuo (`stroke-dasharray: 3.5 2.5`, `2 px`), relleno ámbar suave (`rgba(245, 158, 11, 0.14)` / `#fef3c7`) y etiqueta correspondiente.
    - `correct`: círculo con trazo sólido grueso (`2.25 px`), relleno verde translúcido (`rgba(34, 197, 94, 0.22)` / `#dcfce7`) y marca de verificación `✓` (o etiqueta).
  - **Nuevas props en `Fretboard` (§3.2):**
    - `fretRange?: { from: number; to: number }`: escala proporcionalmente el diapasón para abarcar el tramo configurado (ej. `0–12` o `0–5`), reescalando las líneas de trastes con la fórmula física de trastes y manteniendo los 1300 px de ancho útil del mástil.
    - `activeStrings?: ReadonlySet<StringNumber>`: atenúa las cuerdas inactivas al 28 % de opacidad (`opacity: 0.28`), inhabilitando clics (`pointer-events: none`) y retirándolas del orden de tabulación accesible (`tabIndex={-1}`).
    - `showInlays?: boolean` (por defecto `true`): permite ocultar los puntos de referencia en trastes `3, 5, 7, 9, 12…` en ejercicios donde no se deba facilitar el conteo visual de trastes.
    - `mutedStrings`: compatibilidad bidireccional admitiendo tanto `ReadonlySet<StringNumber>` como `readonly StringNumber[]`.
    - `onPositionContextMenu`: soporte para menú contextual / clic derecho junto a `onPositionRightClick`.

### 2. Implementación de la sección Fórmulas (`FormulasView` / §6)
- **Decisión:** Se creó el componente `src/ui/learn/formulas/FormulasView.tsx` y su hoja de estilos modular `FormulasView.module.css` siguiendo con exactitud las especificaciones de diseño y las maquetas:
  - **Layout simétrico de 2 columnas (§6.1):** contenedor en grid `repeat(2, minmax(0, 1fr))` con `gap: 16px; height: 100%`, con adaptación a 1 columna para pantallas `< 1100 px`.
  - **Columna izquierda — `Nombre → fórmula` (§6.2):**
    - Conmutador segmentado `Acorde` | `Escala` con resaltado activo en `#101b33` y borde `#3b82f6`.
    - Selector de tónica/raíz (`0..11`) respetando la ortografía armónica `nameMode` de `settingsStore`.
    - Selector dinámico de calidad de acorde (`CHORD_QUALITIES`) o tipo de escala (`SCALE_TYPES`).
    - Ecuación principal de la fórmula a `28 px` en negrita con los grados en color turquesa (`#14b8a6`), ej. **`Am7 = 1 ♭3 5 ♭7`** o **`D dórico = 1 2 ♭3 4 5 6 ♭7`** (Criterio b).
    - Tabla de composición con cabeceras en mayúsculas (`GRADO`, `INTERVALO`, `SEMITONOS`, `NOTA`) y filas de `38 px`.
    - Regla cromática lineal (`REGLA CROMÁTICA DESDE LA RAÍZ`): cuadrícula horizontal de 13 celdas (`0..12` semitonos), indicando semitono, nombre de la nota y grado destacado si pertenece a la fórmula (incluyendo extensiones módulo 12 como la 9ª en la celda 2).
    - Botón secundario **`Escuchar`**: reproduce arpegios de acordes o escalas con `audioEngine` (`chordFallbackMidis`, `arpeggioEvents`, `scaleEvents`).
    - Botón primario azul **`Abrir en Sandbox`**: compone el `MenuContext` correspondiente y lo transfiere al store del Sandbox conmutando la vista activa.
  - **Columna derecha — `Fórmula → nombre` (§6.3):**
    - Selector interactivo de 13 píldoras (`1` fija, `♭2`, `2`, `♭3`, `3`, `4`, `♭5`, `5`, `♭6`, `6`, `♭7`, `7`, `9`).
    - Filtro de raíz opcional (`Sin raíz` o notas `A` a `B`).
    - Identificación automática e instantánea mediante `identifyByFormula` clasificada en 3 bloques (Criterio c):
      1. `COINCIDENCIA EXACTA`: tarjetas destacadas con borde turquesa y fondo translúcido mostrando el cifrado y notas concretas separadas por punto medio (ej. `Am7` · `A · C · E · G` o `C9` y `Cmaj7`).
      2. `MISMAS NOTAS, OTRA RAÍZ`: lista de inversiones o rotaciones modales (ej. `C6` sobre el `♭3`).
      3. `CERCANAS`: candidatos a 1 nota de distancia indicando el desvío (`quita ♭7`, `añade 9`, etc.).
    - **Interacción bidireccional:** hacer clic en cualquier tarjeta de resultado de la derecha la selecciona de inmediato en la columna izquierda (`Nombre → fórmula`).

### 3. Navegación e integración en el Shell (`AppShell` y `LearnView` / Criterio a)
- **Decisión:**
  - `LearnView`:
    - Integra `FormulasView` en la pestaña `Fórmulas`, conservando los paneles provisionales de `drills`, `cards` y `progress` para los hitos A7–A9.
    - Incorpora el cálculo automático de la racha diaria (`Racha: N días`) a partir del historial real de ejercicios (`drillsStore`) y tarjetas (`decksStore`), utilizando el corte horario de las `04:00` (`getStudyDayKey`).
  - `AppShell`:
    - Conecta `LearnView` con `sandboxStore`, `settingsStore`, `audioEngine` y la acción de navegación `onNavigateToSandbox`.
    - Al pulsar **"Abrir en Sandbox"** en `FormulasView`, se ejecuta `setContext(...)` en el store del Sandbox y conmuta limpiamente a `currentMode = 'sandbox'`.
    - Se verifica mediante tests de integración que la alternancia entre Sandbox y Aprender preserva en su totalidad el estado (`notes`, `context`, `chordFocus`) y que la tecla `C` en Aprender nunca limpia el Sandbox.

---

## 2026-10-30 — Hito A7: UI: Ejercicios (`src/ui/learn/drills/`)

### 1. Arquitectura de presentación y layout de 3 columnas (§4.1)
- **Decisión:** Se creó el componente `src/ui/learn/drills/DrillsView.tsx` y su hoja de estilos modular `DrillsView.module.css` estructurados fielmente a `docs/Fase-2/interfaz_fase2.md` §4 y la maqueta `Ejercicios.png`:
  - **Layout de 3 columnas:** `grid-template-columns: 240px minmax(0, 1fr) 260px; gap: 16px; height: 100%`, con adaptación a 2 columnas o 1 columna en pantallas reducidas (`@media (max-width: 1100px)`).
  - **Columna izquierda — Selector de ejercicios (`240 px` / §4.2):**
    - Contenedor `.drillsSidebar` con encabezado **`Ejercicios`** (`16 px`, semibold).
    - Agrupación en 3 bloques con encabezados en mayúsculas (`11 px`, `--app-muted`, `letter-spacing: 0.06em`): `NOTAS` (A1, A2), `INTERVALOS` (B1, B2, B3, B4, B5) y `CONSTRUIR` (C1, C2).
    - Botones accesibles con `role="option"` y `aria-selected` / `aria-current`, mostrando el código en fuente monoespaciada turquesa (`#14b8a6`, `12 px`, bold) y el nombre del ejercicio a la derecha.
    - El ejercicio seleccionado lleva fondo `#172236`, borde translúcido `#3b82f6` y texto blanco. Cambiar de ejercicio inicia automáticamente una nueva sesión con la configuración compatible (`startSession(drill.id)`).
  - **Columna derecha — Configuración y Estadísticas de sesión (`260 px` / §4.4):**
    - Panel `.drillConfigPanel` interactivo que sincroniza bidireccionalmente con `drillsStore.updateConfig(...)`:
      - **`CUERDAS`:** Fila de 6 botones (`1..6`, `34×34 px`) con fondo `#101b33` y borde `#3b82f6` cuando están activos. Garantiza la restricción de que al menos una cuerda debe permanecer activa.
      - **`TRASTES`:** Grupo segmentado accesible con opciones `0–5`, `0–12` (por defecto) y `0–24`.
      - **`DIRECCIÓN`:** Visible solo en ejercicios direccionales (`B1`, `B2`, `B3`, `C2`) con opciones `Asc.`, `Desc.` y `Ambas`.
      - **`MODO`:** Visible en ejercicios con soporte de modo (`A1`, `B4`) con opciones `Todas` (`all`) y `La primera` (`first`).
      - **Interruptores (`role="switch"`):** `Adaptativo` (activado por defecto), `Ocultar puntos` (`showInlays: false`) y `Sonido al corregir` (`playAudio`).
      - **Sección inferior `ESTA SESIÓN`:** Cuadrícula de 2 métricas en vivo: `{precisión} %` y `{tiempoMedio} s` (formato con coma decimal, p. ej. `4,2 s`).

### 2. Escenario central: Instrumentos sincronizados y botoneras contextuales (§4.3)
- **Decisión:**
  - **Cabecera de la pregunta:**
    - Eyebrow en mayúsculas (`12 px`, `--app-muted`): `{ID} · {NOMBRE}` (ej. `B1 · INTERVALO EN UNA CUERDA`).
    - Enunciado dinámico `<h2>` con resaltado específico en color turquesa (`#14b8a6`) para los objetivos pedagógicos (notas, posiciones, intervalos, acordes y escalas).
    - Indicador `Pregunta {n} / {total}` y barra de progreso horizontal (`120 × 6 px`) animada según el avance.
  - **Mástil interactivo (`Fretboard`):**
    - Conecta con `selectDrillFretboardMarks` para mostrar los roles de evaluación (`question`, `correct`, `wrong`, `missed`) con sus formas diferenciadas (círculo sólido, aspa en cuadrado redondeado, círculo discontinuo y marca de verificación) y etiquetas de intervalo/nota relativas a la referencia.
    - Soporta la afinación activa (`config.tuning` o `STANDARD_TUNING`), `activeStrings`, `fretRange`, `showInlays` y mano zurda.
    - En fases `question` o `answering`: clic en el mástil evalúa directamente en modo `first` o añade/quita posiciones fijadas (`pinnedPositions`) en modo `all`.
    - En fase `corrected`: clic en cualquier posición reproduce su nota sin alterar la corrección.
  - **Piano lineal contextual (`Piano`) y leyenda:**
    - Recorte automático del teclado a las 2–3 octavas (`24..36` semitonos) relevantes para la tesitura del ejercicio y las notas en juego, desplazándose dinámicamente según la pregunta (p. ej. `C3–C5`).
    - Proyección tecla a tecla de las marcas de evaluación (`selectDrillPianoMarks`).
    - Leyenda visual con iconos SVG para los 4 estados de corrección (`Referencia`, `Tu respuesta, incorrecta`, `Correcta que faltó`, `Acierto`).
  - **Botoneras de opciones contextuales (ejercicios de selección):**
    - **A2 (Nombra la nota):** fila de botones de notas cromáticas (o naturales según `naturalOnly`) respetando la ortografía armónica `nameMode` (`sharps` o `flats`). En fase corregida resalta la elección del usuario (verde si acertó, rojo si falló) y la nota correcta esperada.
    - **B3 (Nombra el intervalo):** cuadrícula de 12 intervalos (`m2` a `P8`) mostrando su nombre corto y descripción en español (ej. `M3` · `3ª mayor`).
    - **B5 (Etiqueta la forma):** selector interactivo de posiciones del voicing (fichas por cuerda activa con la raíz ya identificada con grado `1`) y fila de 13 píldoras de grado armónico (`1`, `♭2`, `2`, `♭3`, `3`, `4`, `♭5`, `5`, `♯5`, `6`, `♭7`, `7`, `9`) para asignación ágil antes de comprobar.

### 3. Franja de corrección, síntesis sonora y flujo por teclado (§4.3.4, §8, Criterios d, e, f, g, n, o)
- **Decisión:**
  - **Franja de corrección (`.feedbackBanner`):**
    - Región accesible con `role="status"` y `aria-live="polite"`.
    - **Antes de corregir:** indica el estado actual (`N posiciones marcadas` o instrucción de pulsar) junto al botón primario **`Comprobar · Enter`** en ejercicios de selección múltiple.
    - **Tras corregir:** contenedor tematizado con borde y fondo translúcido verde (`Correcto.` en `#4ade80`) o rojo (`Incorrecto.` en `#f87171`) junto a la explicación teórica comparativa de semitonos e intervalos.
    - Botón **`Escuchar`** y botón primario **`Siguiente · Enter`**.
  - **Función sonora pura `intervalEvents` y motor de audio:**
    - Se incorporó la función `intervalEvents(fromMidi, toMidi)` en `src/audio/playback.ts` para reproducir primero el intervalo melódico (nota A y nota B con espaciado de 0,45 s) y a continuación armónico (ambas notas a la vez durante 0,8 s).
    - Soporte sonoro diferenciado para cada ejercicio: notas individuales en A1/A2, intervalos en B1/B2/B3, y arpegios armónicos en B4, B5, C1 y C2.
    - Reproducción automática al corregir si `config.playAudio !== false` y `soundEnabled` está activo.
  - **Atajos de teclado:**
    - <kbd>Enter</kbd>: comprueba la respuesta en `answering` (o selección múltiple), avanza a la siguiente pregunta en `corrected` y reinicia la sesión en `summary`.
    - Se ignoran estrictamente cuando el foco está sobre `input`, `select`, `textarea` o si se presionan teclas modificadoras (`Ctrl`, `Alt`, `Meta`).

### 4. Pantalla de Resumen de sesión y ciclo de vida (§4.3, Criterio m)
- **Decisión:**
  - Al completar el número de preguntas configurado (`totalQuestions`, por defecto 20), el store pasa a `phase: 'summary'`.
  - La vista renderiza una tarjeta de resumen centrada con icono de trofeo, felicitación pedagógica según la precisión (`>= 80%`), desglose de precisión (`{aciertos} / {total}`), tiempo medio de respuesta por pregunta y total de preguntas.
  - Acciones: botón primario **`Repetir sesión · Enter`** (`restartSession()`) y botón secundario **`Configurar ejercicio`** (`endSession()`).

### 5. Integración arquitectónica y aislamiento para pruebas
- **Decisión:**
  - `LearnView`: sustituyó el marcador de posición provisional de la pestaña `drills` por `DrillsView`. Admite `drillsStore` en sus props (por defecto `defaultDrillsStore`) permitiendo la inyección de stores aislados en pruebas unitarias e integración sin colisiones de estado global.
  - `AppShell`: acepta `drillsStore` opcional y lo transfiere a `LearnView`.
  - Verificación exhaustiva con 14 tests en `src/ui/learn/drills/DrillsView.test.tsx` cubriendo el selector de ejercicios, la botonera de configuración, los atajos de teclado, el resumen de sesión y los criterios de aceptación (d, e, f, g, n, o).

---

## 2026-10-31 — Refinamientos pedagógicos en Ejercicios (A1, B4, B5, C2) y propuesta de rediseño de C1

### 1. Ocultamiento de etiquetas en marcas de usuario en A1 (modo all), B4, C1 y C2
- **Problema previo:** En A1 (modo marcar todas las notas) y B4 (mapa de intervalos), al hacer clic sobre el mástil o piano, la marca colocada mostraba de inmediato el nombre de la nota (`C`, `G`, etc.), permitiendo al usuario saber si había acertado antes de pulsar «Comprobar».
- **Decisión:** En `src/state/drills/selectors/marks.ts`, las marcas con rol `pinned` para A1 (modo `all`), B4, C1 y C2 se generan con `label: '?'`. El nombre de la nota o el grado armónico solo se revela tras pulsar «Comprobar · Enter» en la fase `corrected`.
- **Justificación:** Preserva la integridad pedagógica de los ejercicios de búsqueda exhaustiva y memoria interválica en el mástil.

### 2. Retroalimentación explícita de fallos y correcciones en B5 (Etiqueta la forma)
- **Problema previo:** Al corregir B5, únicamente se destacaba el conteo de aciertos (`hits`), pero las fichas de las cuerdas no indicaban visualmente cuáles habían sido erróneas ni cuál era el grado correcto esperado para cada cuerda.
- **Decisión:**
  - En `src/learning/answers.ts`: la explicación de `grade()` para `labels` desglosa detalladamente cada error (ej. `cuerda 2: era ♭3 (pusiste 3)`) e indica la secuencia completa de grados esperados.
  - En `DrillsView.tsx` y `DrillsView.module.css`: en la fase `corrected`, las fichas de voicing (`.voicingCard`) diferencian el estado de cada cuerda:
    - Cuerdas acertadas: fondo y borde verde (`.voicingCardCorrect`) con insignia `✓ {grado}`.
    - Cuerdas erróneas: fondo y borde rojo (`.voicingCardWrong`) con grupo visual que muestra la respuesta del usuario tachada en rojo (`× {respuesta}`) seguida de una flecha y el grado correcto en verde (`→ ✓ {esperado}`).
- **Justificación:** Permite al usuario comprender de un vistazo en qué cuerda se equivocó y reforzar la asociación interválica en cada nota del acorde.

### 3. Pista interactiva de fórmula y penalización en C2 (Escala en una cuerda)
- **Problema previo:** Si el usuario no recordaba la fórmula interválica de una escala (p. ej. mixolidia o dórica), no disponía de ninguna ayuda conceptual y debía recurrir a probar posiciones a ciegas.
- **Decisión:**
  - En la cabecera de la pregunta de C2 se implementó un disparador doble: el nombre de la escala en el título es interactivo (`.scaleTitleClickable`) y se acompaña de un botón dedicado `💡 Ver grados de la escala (-50% puntos)` (`.scaleFormulaHintButton`).
  - Al activarse, se despliega una caja con la fórmula de la escala resuelta por `formulaOfScale` (ej. `1  2  ♭3  4  5  6  ♭7`), mostrando **únicamente los grados relativos sin los nombres de las notas** para no desvelar directamente las soluciones del mástil.
  - El store admite penalizaciones en `submitAnswer(input, { scoreMultiplier: 0.5, hintExplanation: '...' })`. Si se usó la pista, la pregunta califica con una puntuación máxima de `0.5` (50 %), no cuenta como acierto sin ayuda en el sistema adaptativo, y el banner de feedback lo notifica explícitamente.

### 4. Reimplementación de C1 (Construye el acorde en el mástil)
- **Diagnóstico del diseño anterior:**
  - El diseño inicial generaba una tónica y pedía marcar todas las notas del acorde linealmente sobre una misma cuerda.
  - Musicológicamente, la guitarra se organiza en formas armónicas polifónicas (voicings a través de múltiples cuerdas). La visualización unilineal ya está cubierta con precisión por B1 (intervalo en una cuerda) y C2 (escala en una cuerda). Construir acordes unilinealmente resultaba antinatural y no entrenaba la habilidad real que necesita el guitarrista: visualizar digitaciones y formas de acordes a lo largo de las cuerdas a partir de un bajo o fundamental.
- **Implementación final:**
  - **Enunciado:** *«Construye el acorde {NombreAcorde} desde la cuerda {S}, traste {F}»* (p. ej. *«Construye el acorde C desde la cuerda 5, traste 3»* o *«Construye el acorde G desde la cuerda 6, traste 3»*).
  - **Punto de anclaje:** La posición de la fundamental se presenta prefijada en el mástil como referencia con `role: 'question'` e `isRoot: true` (círculo azul turquesa con `1`).
  - **Generación basada en el diccionario de voicings (`src/learning/drills/build.ts`):** Utiliza `voicingsForChord(root, quality, tuning)` filtrando por el rango de trastes activo (`[minFret, maxFret]`) y cuerdas activas. Selecciona adaptativamente digitaciones canónicas (formas abiertas, cejillas con bajo en 6ª y 5ª cuerda, etc.).
  - **Respuesta esperada:** El usuario marca las notas en las demás cuerdas que completan la digitación del acorde (`expectedPositions = allVoicingPositions.filter(p => !samePosition(p, rootPos))`).
  - **Tolerancia en evaluación (`src/state/drills/store.ts`):** Si el usuario marca únicamente las notas complementarias, acierta al 100 %. Si por hábito también marca la nota de la fundamental dada como referencia, el store la filtra automáticamente antes de evaluar para no penalizarla como elemento sobrante (`extra`).
  - **Síntesis sonora (`src/ui/learn/drills/DrillsView.tsx`):** Al corregir o pulsar «Escuchar», el arpegio se sintetiza uniendo la fundamental con las demás notas del acorde de grave a agudo (`allPositions.sort((a, b) => a - b)`).
  - **Pista de fórmula armónica en C1:** Al igual que en C2, hacer clic en el nombre del acorde o en `💡 Ver grados del acorde (-50% puntos)` despliega los grados armónicos de la fórmula (`formulaOfChord`, ej. `1  3  5` o `1  ♭3  5`) sin notas reales y aplica la penalización del 50 % en la puntuación.

---

## 2026-10-31 — Hito A8: Interfaz de Tarjetas (Tarjetas, Repetición Espaciada y Constructor de Mazos)

### 1. Estructura del lienzo de estudio (`FlashcardsView`) y layout de 2 columnas (§5.1, §5.2, §5.3)
- **Decisión:**
  - Se estructuró la sección **Tarjetas** con una rejilla de dos columnas:
    - **Columna izquierda (`.decksSidebar`, 310 px):** cabecera `Mazos` con leyenda `Nuevas · Aprendiendo · Repaso`, lista de mazos accesible (`role="listbox"`, `aria-label="Mazos de tarjetas"`), selección con fondo destacado `#172236`, contadores diarios codificados en color (Nuevas `#3b82f6`, Aprendiendo `#f97316`, Repaso `#22c55e` o texto `Al día · 0 pendientes`), y botones de acción inferior para `+ Nuevo mazo` y `Añadir predefinido`.
    - **Columna derecha (`.flashcardStage`, 1fr):** lienzo de estudio interactivo. Cuando no hay sesión activa, muestra una tarjeta de resumen del mazo seleccionado con métricas destacadas y el botón primario **`Comenzar estudio`** (o estado de felicitación si el usuario ya está al día). Durante el estudio, se organiza en cabecera de sesión, anverso, divisor, reverso y barra de evaluación SRS.
  - **Adaptabilidad responsiva:** En pantallas menores a 1100 px, la rejilla conmuta a una sola columna vertical sin scroll horizontal global, preservando la ergonomía de pantalla completa.

### 2. Componente SVG de digitaciones (`ChordDiagram`, §5.3)
- **Decisión:**
  - Se implementó `src/ui/learn/cards/ChordDiagram.tsx` como componente vectorial puro SVG (180×190 px, `viewBox="0 0 180 190"`):
    - **6 cuerdas verticales** con calibres decrecientes (2,5 px en la 6ª hasta 1,0 px en la 1ª).
    - **Trastes y cejuela:** si el traste base es 1, dibuja una cejuela superior engrosada (`data-testid="chord-nut"`); si el acorde inicia en un traste superior a 1, dibuja el traste normal e inserta la indicación `{baseFret}fr` a la izquierda del mástil.
    - **Símbolos superiores:** aspas `×` para cuerdas muteadas y círculos `○` para cuerdas al aire.
    - **Círculos de posición (26 px de diámetro):** notas que actúan como fundamental (`root`) coloreadas en turquesa (`#14b8a6`, borde `#0d9488`, texto oscuro) y notas complementarias en gris claro (`#e2e8f0`, borde `#cbd5e1`, texto oscuro).
    - **Modo ciego (`silent`):** cuando la tarjeta pregunta por la forma (`shape>name`), el diagrama se muestra en el anverso suprimiendo etiquetas de grado o nota para no revelar la respuesta antes de tiempo.

### 3. Flujo de autoevaluación SRS con vista previa de intervalos (§5.3, §8, Criterios h, j, k)
- **Decisión:**
  - **Anverso y revelación:** el reverso permanece oculto mostrando el botón primario **`Mostrar respuesta · Espacio`**. Al activarse, se anuncia la revelación mediante una región accesible con `aria-live="polite"`.
  - **Reverso revelado:** despliega el contenedor a dos columnas con el diagrama SVG o mástil compacto a la izquierda, y a la derecha la etiqueta `RESPUESTA`, el valor principal en monoespaciada grande (`20 px`), desglose de `Notas:` y `Grados:`, y los botones de acción `Escuchar` y `Abrir en Sandbox`.
  - **Barra de 4 botones SRS:** cuadrícula con botones proporcionales con bordes temáticos:
    1. **`Otra vez`** (rojo `#ef4444`, intervalo previsto vía `previewIntervals`, tecla `1`).
    2. **`Difícil`** (ámbar `#eab308`, intervalo previsto, tecla `2`).
    3. **`Bien`** (azul `#3b82f6`, intervalo previsto, tecla `3`).
    4. **`Fácil`** (verde `#22c55e`, intervalo previsto, tecla `4`).
  - **Protección de estado:** los botones SRS permanecen estrictamente deshabilitados hasta que el usuario revela la respuesta, impidiendo calificaciones accidentales.

### 4. Atajos de teclado y ergonomía de estudio (§8)
- **Decisión:**
  - En anverso: <kbd>Espacio</kbd> revela la respuesta.
  - En reverso: <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>, <kbd>4</kbd> evalúan la tarjeta y avanzan al siguiente ítem.
  - Los atajos se ignoran si el foco del usuario se encuentra en campos editables (`input`, `select`, `textarea`, `contentEditable`) o si se pulsaron teclas modificadoras (`Ctrl`, `Alt`, `Meta`).
  - En modales: la tecla <kbd>Esc</kbd> cierra el diálogo sin disparar acciones de las tarjetas.

### 5. Constructor y editor de mazos (`DeckBuilderModal`, §5.4, Criterios i, l)
- **Decisión:**
  - Se implementó `src/ui/learn/cards/DeckBuilderModal.tsx` como diálogo modal accesible (`role="dialog"`, `aria-modal="true"`, cerrable con <kbd>Esc</kbd> o clic en el fondo):
    - **Pestaña «Reglas personalizadas»:** edición de nombre del mazo, límites diarios (`Nuevas / día`, `Repasos / día`) y constructor modular de fuentes (`DeckSource[]`): digitaciones (`voicings`), fórmulas y notas de acordes (`chords`), tipos de escala (`scales`), los 7 modos de una escala madre (`scaleModes`), progresiones armónicas (`progressions`), notas en el mástil (`fretNotes`) e intervalos (`intervals`).
    - **Cálculo en vivo de tarjetas:** indicador inferior `Total: {N} tarjetas` calculado en tiempo real con `buildDeckCardIds(sources).length`.
    - **Pestaña «Mazos predefinidos»:** lista los 3 mazos canónicos (**Principiante**, **Intermedio**, **Avanzado**) con su descripción, cuotas diarias y total de tarjetas. Al pulsar «Añadir a mis mazos», invoca `addPresetDeck(presetId)` creando una copia editable e independiente con progreso propio (Criterio l).

### 6. Integración de audio y «Abrir en Sandbox» (§2, §5.3)
- **Decisión:**
  - **Sonido:** el botón `Escuchar` utiliza `audioEngine.playEvents(...)` con `arpeggioEvents` para digitaciones y acordes o `chordEvents` para notas simultáneas si `soundEnabled` está activo.
  - **Sandbox:** el botón `Abrir en Sandbox` lee el `sandboxContext` de la tarjeta resuelta, construye el objeto `MenuContext` (`kind: 'chord'` o `kind: 'scale'`), lo fija mediante `sandboxStore.getState().setContext(...)` y conmuta la aplicación al modo Sandbox a través de `onNavigateToSandbox()`.
  - **Inyección de dependencias:** `LearnView` y `AppShell` aceptan la prop `decksStore` opcional (por defecto `defaultDecksStore`), permitiendo instanciar stores completamente aislados en pruebas unitarias e integración sin colisiones de `localStorage`.






