# Registro de decisiones — Fase 3 (Modo Canción)

Decisiones de diseño, arquitectura y alcance adoptadas para la Fase 3.

---

## 2026-11-01 — Decisiones fundacionales y planificación de la Fase 3

El plan completo queda fijado en [plan_fase3.md](plan_fase3.md). A continuación se registran las decisiones arquitectónicas y de producto acordadas:

1. **Motor de reproducción multipista: `AlphaSynth` con SoundFont compacto local (100 % offline) + `pluck.ts` para previsualización**
   - **Decisión:** Utilizar el sintetizador `AlphaSynth` integrado en `@coderline/alphatab` junto con un archivo SoundFont compacto empaquetado localmente en `public/soundfont/sonivox.sf2` (cargado de forma diferida solo al abrir el Modo Canción), manteniendo nuestro motor Web Audio (`src/audio/pluck.ts`) para los clics manuales en `Fretboard`/`Piano` y las previsualizaciones sonoras del panel de análisis.
   - **Justificación:** Permite reproducción multipista real (batería, bajo, varias guitarras), soporte nativo de articulaciones de Guitar Pro (*bends*, *slides*, ligados, *palm mute*), control individual de *Mute / Solo / Volumen* por pista, velocidad variable (`0.25×`–`2.0×`), metrónomo, bucles de sección y sincronización exacta del cursor sin comprometer el requisito de funcionamiento 100 % offline ni el peso de arranque de los demás modos.

2. **Biblioteca de canciones en `IndexedDB` y 3 canciones de ejemplo integradas**
   - **Decisión:** Persistir las canciones importadas por el usuario (`.gp`, `.gp3`–`.gp5`, `.gpx`, `.tg`, `.xml`) y sus anotaciones manuales en **`IndexedDB`** (`guitar-aid-songs-db`), formando una «Biblioteca reciente» persistente entre sesiones, e incluir en datos **3 canciones/fragmentos de ejemplo en formato AlphaTex** (`src/song/presets.ts`).
   - **Justificación:** Los archivos binarios de Guitar Pro suelen ocupar entre cientos de KB y varios MB, por lo que `localStorage` (~5 MB compartidos con mazos y estadísticas) sería insuficiente. `IndexedDB` permite almacenar los binarios y las anotaciones por canción con holgura, mientras que las 3 piezas en AlphaTex permiten usar y probar el Modo Canción desde el primer momento sin requerir archivos externos.

3. **Disposición visual y sincronización en tiempo real con `Fretboard` y `Piano`**
   - **Decisión:** Mantener una vista de pantalla única (`100vh` en `1920×1080` y `2560×1440`) con nuestros componentes puros `Fretboard` y `Piano` siempre visibles en la parte superior, mostrando en tiempo real las notas del pulso activo superpuestas sobre la escala/tonalidad del compás (`scale-bg`) con etiquetas conmutables (`Nota · Intervalo · Grado · Ninguna` y referencia de grados conmutable entre `Tonalidad` y `Acorde`). En la parte inferior se sitúan a la izquierda la cinta armónica de compases (`SongTimelineBar`) + el visor de partitura (`AlphaTabViewport`, conmutable entre `Tab`, `Partitura + Tab` y `Partitura`, con letra) y a la derecha el panel de análisis del fragmento (`SongAnalysisPanel`).
   - **Justificación:** Preserva la identidad visual de Guitar Aid (conectar la tablatura con la geometría del mástil y la disposición lineal del piano) y evita ocultar la información armónica mientras se reproduce o inspecciona la canción.

4. **Nueva capa pura `src/song/` y tolerancia a notas de paso en el análisis**
   - **Decisión:** Crear la capa `src/song/` en TypeScript puro (entre `theory`/`learning` y `state`), protegida por ESLint y `layers.test.ts`. Definir un modelo intermedio inmutable `SongModel` y funciones puras de análisis que ponderan cada nota por su duración rítmica, peso métrico (tiempos fuertes vs. débiles) y registro (bajo), devolviendo siempre `Candidate<T>[]` ordenados con razones estructuradas.
   - **Justificación:** En canciones reales existen notas melódicas de paso, riffs y arpegios incompletos que harían fallar un detector estricto de acordes plaqué. La ponderación métrica/rítmica y el aislamiento en una capa pura permiten probar exhaustivamente en Vitest (Node.js) la estimación de raíz (`estimateRoot`), los acordes por compás (`detectBarChords`), la tonalidad por compás con detección de modulaciones (`detectSongKeysByBar`) y el análisis de progresiones sin acoplarse al DOM ni a `AlphaTabApi`.

5. **Sobreescritura manual («criterio del músico») y puentes con Sandbox y Aprender**
   - **Decisión:**
     - Permitir que el usuario fije o sobreescriba manualmente el acorde o la tonalidad de cualquier compás o sección (`barOverrides`), recalculando al instante las etiquetas de grado del mástil/piano y los numerales romanos de la progresión, y guardando la elección en `IndexedDB`.
     - Incluir botones directos para **«Abrir en Sandbox»** (envía el acorde, escala o pulso al `sandboxStore`) y **«Llevar a Aprender»** (crea o amplía un mazo de tarjetas SRS en `decksStore` con los acordes, escalas y progresiones del fragmento, o abre `Ejercicios` enfocado en ese pasaje).
   - **Justificación:** La teoría musical admite interpretaciones legítimas según el contexto; dar la última palabra al usuario y conectar el repertorio real con la exploración (Sandbox) y la memorización (Aprender) unifica las tres fases de Guitar Aid en un flujo de estudio completo.

---

## 2026-11-01 — Cierre de la especificación de interfaz (`interfaz_fase3.md`) a partir de la maqueta

Queda cerrada la especificación visual e interactiva en [interfaz_fase3.md](interfaz_fase3.md) tomando como guía [Modo Canción · 1920×1080@1x.png](Modo%20Canci%C3%B3n%20%C2%B7%201920%C3%971080%401x.png) e incorporando los siguientes acuerdos sobre los estados dinámicos:

1. **Comportamiento de `SongTimelineBar` en canciones largas (`> 16 compases`):**
   - Cada celda de compás mantiene un ancho mínimo legible (`52 px`) dentro de un contenedor con scroll horizontal suave y **auto-scroll automático** que sigue al compás activo durante la reproducción, permitiendo además saltar y seleccionar secciones enteras al hacer clic en las cabeceras de sección (`Intro`, `Estribillo`, `Estrofa`, `Puente`).
2. **Anclaje del compás inspeccionado (`inspectedBar`) en `SongAnalysisPanel`:**
   - Hacer clic en un chip de la tira de progresión (`c.5`, `c.6`, `c.7`, `c.8`) o en una celda de compás ancla ese compás en `CANDIDATOS DEL COMPÁS X` para que la lista no salte continuamente mientras suena un bucle en segundo plano.
3. **Estado reversible de los overrides manuales (`Fijar` ↔ `✓ Fijado`):**
   - Cuando el usuario fija manualmente un acorde o una tonalidad, el botón de esa tarjeta pasa a estado activo `✓ Fijado` / `✓ Fijada` (permitiendo deshacer el override al volver a pulsarlo), la celda del compás muestra el indicador de punto ámbar `●` en su esquina superior derecha y los desplegables superiores incluyen la opción `Restablecer a automático`.
4. **Representación de Cejilla (`Capo > 0`) en el `Fretboard` y precarga inicial:**
   - Se añade la prop opcional `capoFret?: number` en `Fretboard.tsx` para dibujar la barra de cejilla y atenuar los trastes inferiores cuando la pista declare `Capo > 0`.
   - Al abrir el Modo Canción por primera vez sin canción activa previa, se precarga automáticamente la primera canción de ejemplo (`Pop Diatónico en C/Am`).


---

## 2026-11-01 — Implementación del hito C0 (preparación, `@coderline/alphatab`, SoundFont y capa `src/song/`)

1. **Versión y tipo de dependencia de `@coderline/alphatab`:** se instala `1.8.4` (última publicada con el registro actual) como **`dependency`** de producción. Aún no se importa desde ningún módulo, por lo que no afecta al bundle de arranque; el hito C5 la cargará de forma diferida.
2. **SoundFont `sonivox.sf2` copiado del propio paquete:** se toma `node_modules/@coderline/alphatab/dist/soundfont/sonivox.sf2` (≈ 1,35 MB) y se copia a `public/soundfont/sonivox.sf2`, en vez de descargarlo de internet. Garantiza una fuente verificable, compatible con la versión de alphaTab y 100 % offline. Se descarta `sonivox.sf3` (≈ 0,98 MB, comprimido) para respetar el nombre y formato fijados en el plan; queda como opción si el peso fuese un problema. Licencia del paquete: MPL-2.0 (a mencionar en el README al cierre de la fase en C9).
3. **`src/song/types.ts` literal al plan §3.1**, con `PitchClass` y `Tuning` importados de `src/theory`. Todos los campos son `readonly` en colecciones (`beats`, `notes`, `bars`, `tracks`) para reflejar la inmutabilidad del modelo. `index.ts` solo reexporta tipos por ahora.
4. **Reglas ESLint de la capa `song`:**
   - `src/song/**` no puede importar React, `zustand`, `tonal`, `state`, `ui` ni `audio`, ni usar globales DOM (misma lista que `theory`/`learning`).
   - **`@coderline/alphatab` está prohibido en toda `src/song/**` salvo `src/song/importer.ts`**, mediante un bloque de configuración posterior específico para ese archivo (en ESLint el último bloque sustituye `no-restricted-imports`).
   - `tonal` se prohíbe en `song` (como en `learning`): toda la teoría pasa por `src/theory`.
   - `theory` y `learning` pasan a **prohibir importar `song`** (el flujo de dependencias es unidireccional, según el diagrama §2.1). `state` ya podía importar `song` al no estar en su lista de prohibidos; solo se actualizó el mensaje.
5. **Cobertura en `layers.test.ts`:** se añaden casos prohibidos (React, zustand, state, ui, audio, tonal, alphaTab fuera de `importer.ts`, DOM, y `theory`/`learning` → `song`) y permitidos (theory, learning, alphaTab en `importer.ts`, `state` → `song`).
6. **Sin tocar `AppShell`/`SideNav`:** el badge `próx.` y el placeholder siguen hasta C6, conforme al plan.

---

## 2026-11-01 — Implementación del hito C1 (teoría para Canción: estimación de raíz, escalas de fragmento y secuencias)

1. **Módulo compartido de numerales romanos cromáticos (`src/theory/analysis/roman.ts`):**
   - **Decisión:** Extraer y consolidar la función pura `romanNumeral(tonic, root, quality)` en un módulo reutilizable dentro de `src/theory/analysis/`, refactorizando `src/theory/suggestions/forScale.ts` para usarla y eliminando duplicidades.
   - **Justificación:** Los numerales romanos con alteraciones relativas a la escala mayor (`♭III`, `♭VII`, `♭VI`, etc.) y sufijos de cualidad (`°`, `+`, `7`, `ø7`, `°7`, `(maj7)`, `maj7`, `sus4`) son necesarios tanto para acordes diatónicos en sugerencias como para el análisis funcional de secuencias de compases en el modo Canción. Centralizar la función garantiza coherencia estricta en toda la aplicación.

2. **Normalización y ponderación de factores en `estimateRoot` (`src/theory/analysis/estimateRoot.ts`):**
   - **Decisión:** Normalizar la puntuación dividiendo la suma ponderada entre el peso total acumulado del segmento o compás. Los pesos asignados a cada factor son: bajo (`BASS_FACTOR: 3`), acento en tiempo 1 (`DOWNBEAT_FACTOR: 1.5`), duración/peso total (`TOTAL_FACTOR: 1`) y soporte acústico de 5ª justa (`FIFTH_SUPPORT_FACTOR: 1`).
   - **Criterio de corte para la 5ª justa:** El soporte de quinta solo se activa si la 5ª justa suena con un peso de al menos el 25 % del peso de la clase con más duración (`FIFTH_MIN_RATIO: 0.25`).
   - **Justificación:** Evita que notas de paso ultracortas en subdivisión débil o adornos melódicos refuercen erróneamente fundamentales inexistentes. La normalización asegura que compases con diferente compás o tempo generen puntuaciones en una escala homogénea.

3. **Tolerancia a cromatismos y notas de paso en `rankScalesForFragment` (`src/theory/analysis/rankFragmentScales.ts`):**
   - **Decisión:** Evaluar las 12 tónicas × 22 escalas del catálogo calculando la cobertura ponderada (`scaleCoverage = pesoCubierto / pesoTotal`), listando las notas de paso en `passingTones` ordenadas por relevancia rítmica, y ponderando el encaje con los acordes detectados (`fitsDetectedChords`), la coincidencia de apertura/resolución (`openingRoot`, `closingRoot`) y la armadura (`matchesKeySignature`).
   - **Penalización por tamaño excesivo (`EXTRA_SIZE_PENALTY: 12`):** Penaliza escalas de más de 7 notas (Bebop, disminuidas octatónicas) para que no ganen artificialmente a escalas heptatónicas por el simple hecho de contener más notas; una escala de 8 notas debe explicar un peso sustancialmente superior para imponerse.
   - **Comportamiento defensivo:** Si ningún candidato cumple el umbral de tolerancia (`maxOutsideRatio: 0.20`), la función no devuelve una lista vacía `[]`, sino la lista completa ordenada por cobertura, garantizando que la interfaz siempre disponga de candidatos para orientar al usuario.

4. **Clasificación funcional y reconocimiento de plantillas en `analyzeChordSequence` (`src/theory/analysis/analyzeProgression.ts`):**
   - **Decisión:** Clasificar cada acorde en una categoría funcional explícita con razones estructuradas:
     - `diatonic`: perteneciente a la escala o modo activo.
     - `harmonicMinor`: acorde dominante procedente de la escala menor armónica en contexto de modo menor (p. ej. `V` o `V7`).
     - `secondaryDominant`: acordes mayores o con séptima dominante dirigidos a un grado diatónico distinto de la tónica (`V/vi`, `V7/V`, etc.), indicando además si resuelven inmediatamente en el acorde siguiente (`resolves: 1`).
     - `borrowed`: préstamo modal de modos paralelos sobre la misma tónica (menor natural, dórico, mixolidio, lidio, frigio...).
     - `chromatic`: acordes sin relación modal directa.
     - `unrecognized`: compases en silencio o con acorde nulo (`null`).
   - **Algoritmo de plantillas:** Se compactan los acordes consecutivos repetidos (prolongaciones de un mismo acorde a través de compases) y se toleran compases vacíos intermedios. Las coincidencias se gradúan en `exact` (coincidencia idéntica de la secuencia), `contains` (subsecuencia contigua) y `rotation` (coincidencia cíclica por lectura en bucle), desempatando por el tipo de coincidencia y la popularidad de la plantilla (`PROGRESSION_WEIGHTS`).

5. **Ampliación de razones estructuradas y textos en español (`types.ts` y `texts.ts`):**
   - **Decisión:** Añadir a `ReasonCode` los identificadores estructurados necesarios para la Fase 3 (`bassNoteInBar`, `downbeatAccent`, `fifthSupport`, `longestDuration`, `scaleCoverage`, `passingTones`, `fitsDetectedChords`, `matchesKeySignature`, `diatonicDegree`, `harmonicMinorDegree`, `secondaryDominant`, `modalBorrowing`, `chromaticChord`, `matchesProgression`) y proveer sus correspondientes formateadores en `REASON_FORMATTERS` (`src/ui/panels/texts.ts`).
   - **Justificación:** Mantiene desacoplada la lógica teórica (código y parámetros numéricos o identificadores) de la capa visual de presentación en español accesible.

---

## 2026-11-01 — Implementación del hito C2 (importador puro GP/TG/MusicXML/AlphaTex y canciones de ejemplo)

1. **Aislamiento de `@coderline/alphatab` exclusivamente en `src/song/importer.ts`:**
   - **Decisión:** Mantener el parser y los módulos de `@coderline/alphatab` circunscritos con exclusividad a `src/song/importer.ts`. Ni los tests unitarios (`importer.test.ts`, `presets.test.ts`) ni los presets (`presets.ts`) importan alphaTab directamente; para las pruebas de lectura binaria Guitar Pro se expone la función pura `exportAlphaTexToGp7Bytes` desde el propio importador.
   - **Justificación:** Cumple estrictamente la regla de capas verificada en `eslint.config.js` y `src/architecture/layers.test.ts`, garantizando que ningún cambio en la librería externa impacte al resto del proyecto ni requiera excepciones adicionales.

2. **Inversión y normalización de la numeración de cuerdas (`stringNumber`):**
   - **Decisión:** En alphaTab internamente la cuerda 1 es la más grave y la cuerda $S$ es la más aguda. En Guitar Aid la convención del dominio (definida en `Fretboard` y `src/theory/fretboard/`) fija que la cuerda 1 es la más aguda y la cuerda $S$ es la más grave. El importador realiza la conversión `string = stringCount > 0 ? (stringCount - note.string + 1) : note.string`.
   - **Justificación:** Permite que las posiciones `(string, fret)` de cualquier archivo GP, MusicXML o AlphaTex importado se representen de forma directa sobre el mástil (`Fretboard`) sin cálculos ni transformaciones intermedias en la interfaz.

3. **Resolución bidireccional de afinaciones (`Tuning`) y cuerdas:**
   - **Decisión:** `staff.stringTuning.tunings` almacena las notas al aire en orden aguda a grave (p. ej. `[64, 59, 55, 50, 45, 40]`). El importador invierte el arreglo a grave a aguda (`[40, 45, 50, 55, 59, 64]`) y busca coincidencia con las afinaciones del catálogo de Guitar Aid (`TUNINGS`). Si coincide, reutiliza la definición canónica (`standard`, `dropD`, etc.); si no coincide, genera una afinación personalizada inmutable (`id: custom-...`). Para pistas de percusión (`isPercussion: true`), se asigna `stringCount: 0` y afinación `{ id: 'percussion', name: 'Percusión', strings: [] }`.

4. **Tratamiento de `midi` y `bendSemitones` en notas con bend:**
   - **Decisión:** `SongNote.midi` preserva la altura MIDI física del traste pisado (con la afinación y cejilla/capo aplicadas por alphaTab en `realValue`), mientras que `bendSemitones` refleja el desplazamiento en semitonos hacia la nota destino (`maxBendPoint.value / 2`).
   - **Justificación:** Conserva la coherencia física entre la digitación `(cuerda, traste)` y el sonido de base en el diapasón, permitiendo al mismo tiempo que los algoritmos de análisis armónico y el visor conozcan con exactitud la altura melódica alcanzada en el bend.

5. **Ponderación métrica precalculada por compás (`computeMetricWeight`):**
   - **Decisión:** Implementar la función de cálculo métrico según la especificación §3.1/§3.2 del plan: `1.5` en tiempo 1 (`startTick === 0`), `1.2` en el pulso intermedio fuerte (tiempo 3 en 4/4, tiempo 4 en 6/8, tiempo 7 en 12/8), `1.0` en tiempos a tierra enteros y `0.75` en subdivisiones y contratiempos.

6. **Propagación continua de secciones (`sectionMarker`) y tempo (`tempoBpm`):**
   - **Decisión:** Las secciones (`Intro`, `Estribillo`, etc.) y las automatizaciones de tempo se propagan hacia adelante a todos los compases subsiguientes hasta que aparezca una nueva directiva.
   - **Justificación:** Permite que cualquier compás individual conozca a qué sección pertenece y a qué tempo debe reproducirse o analizarse, facilitando la agrupación visual en `SongTimelineBar`, los bucles de sección y el suavizado contextual de tonalidad en `detectSongKeysByBar`.

7. **Detección robusta de contenido binario vs. texto plano (`isLikelyText`):**
   - **Decisión:** Antes de intentar decodificar bytes como texto AlphaTex en `importSongFromBytes`, se comprueba mediante `isLikelyText` que el búfer no contenga bytes de control o nulos. Si el archivo está corrupto o es binario no soportado, se lanza un error descriptivo (`No se pudo importar la canción: formato no soportado o archivo corrupto.`).
   - **Justificación:** Evita que datos binarios aleatorios o archivos corruptos sean interpretados erróneamente como texto AlphaTex vacío, asegurando una validación defensiva limpia y accesible.

8. **Diseño musical de las 3 canciones de ejemplo en `src/song/presets.ts`:**
   - **Decisión:** Crear tres piezas musicales completas de 8 compases cada una en AlphaTex puro, con dos secciones diferenciadas y anotaciones estructuradas para servir de base a los hitos C3 a C9:
     - `Pop Diatónico en C/Am`: 2 pistas (Guitarra rítmica de 6 cuerdas y Bajo eléctrico de 4 cuerdas), secciones `Intro` y `Estribillo`, progresiones `I–V–vi–IV` y `vi–IV–I–V`, letra y cifrados (`C`, `G`, `Am`, `F`).
     - `Blues & Rock Riff en E`: 2 pistas (Guitarra Lead y Guitarra Rítmica), secciones `Intro Riff` y `Blues Solo & Chords`, power chords (`E5`, `A5`, `B5`), acordes dominantes (`E7`, `A7`, `B7`), ghost notes y bends expresivos (`{b bend (0 4)}`).
     - `Modulación y Menor Armónica en Am/C`: 1 pista (Guitarra Española), sección A en La menor con cadencia `Am–Dm–E7–Am` (con `G♯`, grado sensible de la escala menor armónica) y modulación en sección B a Do mayor con cadencia completa `C–F–Dm–G7–C`.

---

## 2026-11-01 — Implementación del hito C3 (analizador puro de fragmentos, tonalidad por compás y puentes)

1. **Aislamiento y compatibilidad estructural de `MenuContext` en `src/song/types.ts`:**
   - **Decisión:** Definir el tipo puro `SongMenuContext` (reexportado como `MenuContext`) en `src/song/types.ts` con la estructura canónica `{ kind: 'chord'; root: PitchClass; quality: ChordQualityId } | { kind: 'scale'; root: PitchClass; type: ScaleTypeId }`.
   - **Justificación:** La capa `src/song/` tiene prohibido importar `src/state/` por la regla de capas unidireccional (verificada por ESLint y `layers.test.ts`). La compatibilidad estructural de TypeScript permite que los puentes generen contextos de menú consumibles por `sandboxStore.setContext` de forma limpia sin violar la arquitectura ni crear acoplamiento con Zustand.

2. **Detección tolerante de acordes por compás (`detectBarChords` en `src/song/analyzer.ts`):**
   - **Decisión:** Evaluar las 12 raíces $\times$ 19 calidades del catálogo calculando la cobertura ponderada sobre el peso rítmico/métrico del compás (`coverageRatio = coveredWeight / totalWeight`). Exigir la presencia de la fundamental y de al menos un tono característico (3ª mayor/menor, suspensión sus2/sus4 o díada [0, 7] en acordes de quinta `5`), bonificando la coincidencia con la raíz estimada por `estimateRoot` (+40), inversiones con bajo en el acorde (+20) y cifrados anotados en la partitura (+85 con la nueva razón `annotatedInScore`).
   - **Comportamiento ante silencios y notas aisladas:** Si el compás está en silencio o solo contiene 1 clase de altura sin cifrado anotado, devuelve `[]` en lugar de inventar un acorde artificial.
   - **Justificación:** En la música real (arpegios, riffs melódicos), la presencia de notas melódicas de paso en pulsos débiles hacía inviable un detector estricto tipo Sandbox. La ponderación rítmica y métrica permite que `detectBarChords` recupere el acorde principal con precisión (criterio de aceptación c).

3. **Desglose de compases con cambio armónico por mitades (`splitChords`):**
   - **Decisión:** En compases largos ($\ge 1920$ ticks, como 4/4) con al menos dos pulsos, evaluar de forma independiente la primera y la segunda mitad del compás. Si ambas mitades arrojan acordes principales distintos (p. ej. Do mayor en tiempos 1–2 y Sol mayor en tiempos 3–4), exponer `splitChords: { firstHalf, secondHalf }` en `BarChordAnalysis` y alimentar la secuencia de progresión con ambos acordes.
   - **Prevalencia del override manual:** Si el usuario fija manualmente un acorde para el compás (`barOverrides`), el override prevalece sobre `splitChords` y unifica el compás, garantizando que los numerales romanos y las marcas de mástil/piano respondan a la decisión explícita del usuario.

4. **Estabilidad tonal y detección de modulación (`detectSongKeysByBar`):**
   - **Decisión:** Estimar la tonalidad local de cada compás combinando sus pesos con una ventana contextual atenuada de compases vecinos ($[i-1, i+1]$, peso 0.4) acotada estrictamente a la sección activa (`sectionMarker`). Aplicar un bono de continuidad armónica (+18 puntos) a la escala del compás anterior dentro de la misma sección y pasar como `openingRoot` la raíz estimada del compás. Al comenzar una nueva sección, la continuidad se reinicia, lo que permite detectar modulaciones (`isModulation: true`) sin saltos espurios por acordes dominantes transitorios o notas de paso.
   - **Justificación:** Resuelve con fidelidad el criterio de aceptación (f) en piezas con modulación (como la cadencia en La menor con dominante E7 en la Parte A y modulación a Do mayor en la Parte B de la pieza de ejemplo).

5. **Puentes puros con Sandbox y Aprender (`src/song/bridges.ts`):**
   - **Decisión:**
     - **Sandbox:** `songChordToSandboxContext`, `songScaleToSandboxContext`, `songKeyToSandboxContext` y `fragmentToSandboxContext` convierten fragmentos, escalas o acordes detectados al formato `MenuContext`.
     - **Aprender (Tarjetas SRS):** `fragmentToDeckSources` genera de forma declarativa fuentes `ChordsDeckSource`, `VoicingsDeckSource` (con familias `open`, `barre-E`, `barre-A`), `ScalesDeckSource`, `ProgressionsDeckSource` (si el fragmento encaja con una plantilla) y `DegreesDeckSource`, verificando que `buildDeckCardIds` expanda identificadores de tarjeta válidos sin errores (criterio n).
     - **Aprender (Ejercicios):** `fragmentToDrillConfig` examina las notas reales ejecutadas en el fragmento y delimita automáticamente el rango de trastes `[minFret, maxFret]`, las cuerdas activas empleadas, la afinación de la pista y las calidades/escala para una práctica delimitada.

6. **Adición de `annotatedInScore` al catálogo de razones:**
   - **Decisión:** Incorporar el identificador estructurado `'annotatedInScore'` a `ReasonCode` en `src/theory/analysis/types.ts` y su formateador correspondiente en `REASON_FORMATTERS` (`src/ui/panels/texts.ts`).
   - **Justificación:** Permite que los algoritmos de análisis armónico y la interfaz justifiquen formalmente cuándo un candidato coincide o está respaldado por el cifrado explícito presente en la partitura original.

---

## 2026-11-01 — Implementación del hito C4 (estado del Modo Canción, marcas e IndexedDB)

1. **Diseño del repositorio de persistencia `IndexedDB` (`guitar-aid-songs-db`, versión 1) con fallback y adaptador en memoria:**
   - **Decisión:** Implementar la interfaz `SongStorage` con dos almacenes de objetos independientes: `'songs'` (`keyPath: 'id'`) para guardar canciones importadas (`StoredSong` con metadatos de título, artista, formato, tamaño y marcas de tiempo) y `'annotations'` (`keyPath: 'songId'`) para registrar sobreescrituras manuales de compás y rangos de bucle (`UserSongAnnotations`). Implementar `createMemorySongStorage` (con clonado profundo inmutable) y `createIndexedDbSongStorage` (envolviendo el ciclo de vida de transacciones IndexedDB en Promises). Proporcionar la fábrica `resolveDefaultSongStorage()` que detecta la presencia de `globalThis.indexedDB` en tiempo de ejecución.
   - **Justificación:** Cumple el criterio (j) sin dependencias externas en runtime. Garantiza que las pruebas unitarias y de integración en Vitest (Node.js) se ejecuten en milisegundos de forma aislada y determinista, mientras que en el navegador los archivos binarios de Guitar Pro y las anotaciones sobreviven al recargar sin chocar con el límite de 5 MB de `localStorage`.

2. **Estado reactivo en Zustand (`src/state/song/store.ts`) con precarga de la primera pieza de ejemplo:**
   - **Decisión:** Conforme a lo acordado en `interfaz_fase3.md` y `plan_fase3.md`, el store inicializa de forma inmediata cargando el modelo de `Pop Diatónico en C/Am` como canción activa por defecto (`activeSong`), con `currentBar: 1` (1-based), `currentBeat: 0`, `degreeReferenceMode: 'chord'`, `scoreViewMode: 'tab'`, `showLyrics: true` y `analysisSource: 'active-track'`.
   - **Justificación:** Evita estados vacíos rotos al entrar por primera vez al Modo Canción. El usuario y la interfaz encuentran de inmediato una canción estructurada y lista para explorar, practicar e inspeccionar.

3. **Validación defensiva al importar canciones y protección del estado:**
   - **Decisión:** En `importSong`, validar rigurosamente la integridad de `model` (existencia de `id` y `tracks.length > 0`). Si el archivo o modelo está corrupto o vacío, se registra el mensaje descriptivo en `state.error` sin alterar `activeSong` ni corromper el estado en memoria o almacenamiento.
   - **Justificación:** Satisface directamente el criterio de aceptación (j): un archivo inválido muestra un aviso accesible al usuario sin degradar la canción que ya estuviera en reproducción o estudio.

4. **Comportamiento musical de `toggleLoop` y sincronización de secciones:**
   - **Decisión:** Al accionar `toggleLoop`, si el bucle está encendido se apaga. Si está apagado: (1) si hay un rango de compases seleccionado (`selectedBarRange`), se activa sobre él; (2) si no hay selección previa, se activa automáticamente sobre los compases de la sección actual (`sectionMarker`, p. ej. compases 1–4 para "Intro"); (3) si el compás carece de sección, abarca el compás actual. El bucle se persiste de forma asíncrona en las anotaciones de la canción en storage.
   - **Justificación:** Implementa con exactitud el comportamiento fijado en `interfaz_fase3.md` (§3.3 y §8), haciendo que la tecla <kbd>L</kbd> o el botón `Bucle` funcionen de forma intuitiva tanto sobre selecciones manuales como sobre secciones de la canción.

5. **Generación y resolución de marcas del mástil y piano (`selectSongFretboardMarks` y `selectSongPianoMarks`):**
   - **Decisión:** Desacoplar la afinación del mástil de la afinación del Sandbox: `selectSongFretboardMarks` lee la afinación directamente de la pista activa (`track.tuning`), adaptando las marcas a bajos de 4 cuerdas o afinaciones alternativas (Drop D, etc.) sin mutar `sandboxStore.tuning` (criterio i). Superponer las capas visuales con la jerarquía de prioridades `ROLE_PRIORITY`: notas del pulso activo (`pinned`, prioridad 6) sobre el fondo de escala (`scale-bg`, prioridad 3) y previsualización (`preview`, prioridad 2).
   - **Justificación:** Aísla completamente el estado del Modo Canción respecto al Sandbox y asegura que el mástil refleje con fidelidad las posiciones físicas reales de cada instrumento en la tablatura.

6. **Reactividad inmediata a sobreescrituras manuales (`barOverrides`, criterio h):**
   - **Decisión:** `resolveActiveHarmony` evalúa con máxima prioridad cualquier sobreescritura manual fijada por el usuario en `barOverrides[barNumber]` (acorde o tonalidad). Si el conmutador `degreeReferenceMode` está en `'chord'`, la raíz de referencia es la fundamental del acorde (o del acorde fijado con `chordId`); si está en `'key'`, es la tónica de la tonalidad. Al fijar un override, `selectSongFretboardMarks`, `selectSongPianoMarks` y `selectBarProgression` recalculan al instante las etiquetas de grado (`1`, `♭3`, `5`…) y los numerales romanos (p. ej. `vi` en lugar de `I`), y guardan la anotación en el storage.
   - **Justificación:** Cumple estrictamente el criterio de aceptación (h) y respeta el principio del «criterio del músico».

7. **Memorización en selectores de análisis (`src/state/song/selectors/analysis.ts`):**
   - **Decisión:** Memorizar el resultado de `selectActiveFragmentAnalysis` mediante una clave compuesta por el id de la canción, compases de inicio y fin, pista activa, fuente de análisis, hash JSON de `barOverrides` y modo de enarmonía.
   - **Justificación:** Evita recalcular de forma pesada el análisis armónico y ranking de escalas en cada pulso o avance de tiempo dentro del mismo compás o rango seleccionado, garantizando una respuesta fluida a 60 fps durante la reproducción en vivo.




