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






---

## 2026-11-01 — Implementación del hito C5 (Controlador `AlphaSynth` offline y visor `AlphaTabViewport`)

1. **Controlador desacoplado `AlphaSynthController` (`src/audio/alphaSynthController.ts`) sin violar la regla de capas:**
   - **Decisión:** Implementar `AlphaSynthController` dentro de `src/audio/` como fachada unificada del sintetizador multipista. La regla de capas prohíbe terminantemente que `src/audio/` importe de `src/state/` o `src/ui/`. Para la sincronización con `settingsStore` (`soundEnabled`, `volume`), se definió un contrato duck-type (`SoundSettingsStoreLike` con `getState()` y `subscribe()`) en los métodos `syncWithSettings` y `bindSettings`.
   - **Justificación:** Respeta escrupulosamente `layers.test.ts` y la arquitectura unidireccional de capas, permitiendo sincronizar en tiempo real el silenciado global y el volumen del usuario sin acoplar la capa de audio a Zustand ni a tiendas específicas.

2. **Carga diferida (*lazy loading*) y offline del SoundFont local (`/soundfont/sonivox.sf2`):**
   - **Decisión:** El controlador se instancia sin inicializar Web Audio ni descargar buffers de sonido en el arranque. El método `ensureReady()` ejecuta la inicialización diferida e idempotente en el primer gesto de reproducción (`play()`) o cuando el consumidor lo solicita explícitamente, cargando `public/soundfont/sonivox.sf2` (1.3 MB) de forma 100 % local.
   - **Justificación:** Cumple la decisión de diseño de C0 y optimiza el tiempo de arranque de la aplicación (TBT/FCP), evitando que usuarios que únicamente utilicen el Sandbox o Aprender consuman memoria de audio o inicialicen contexts innecesariamente.

3. **Control de transporte, velocidad acotada, metrónomo, cuenta atrás y bucle A–B:**
   - **Decisión:**
     - **Transporte:** Métodos `play()`, `pause()`, `playPause()` y `stop()` con emisión reactiva de eventos `stateChange`, `positionChange` y `finish`.
     - **Velocidad:** Factor acotado estrictamente en el rango `[0.25, 2.0]` (`clampSpeed`), sincronizado con `player.playbackSpeed`.
     - **Metrónomo y cuenta atrás:** Manejados mediante `metronomeVolume` y `countInVolume`, activándose/desactivándose al enviar el volumen correspondiente o 0 al reproductor.
     - **Bucle A–B:** Controlado mediante `isLooping` y `playbackRange` (límites `startTick` y `endTick`), delegando directamente a las propiedades nativas de `AlphaSynth` / `AlphaTabApi`.

4. **Mezclador multipista independiente (*Mute / Solo / Volumen* por pista):**
   - **Decisión:** Mantener en el controlador un mapa reactivo `trackMixer: Record<number, TrackMixerItem>`. Los métodos `setTrackMute`, `setTrackSolo`, `setTrackVolume` y `applyTrackMixer` actualizan el estado interno y delegan de forma compatible a `changeTrackMute`/`changeTrackSolo`/`changeTrackVolume` (o a `setChannelMute`/`setChannelSolo`/`setChannelVolume`). Al conectar un nuevo reproductor (`attachPlayer`), todos los ajustes vigentes del mezclador se inyectan inmediatamente en el reproductor entrante.
   - **Justificación:** Garantiza que cambiar de pista o reinicializar el visor preserve intacto el equilibrio de mezcla del usuario (criterio k).

5. **Visor de partitura y tablatura reactivo (`AlphaTabViewport.tsx`):**
   - **Decisión:** Implementar la tarjeta `.scoreCard` con su cabecera fija de 36 px (mostrando el modo de vista activo en mayúsculas, el nombre de la pista y el resumen técnico monoespaciado: afinación, cejilla y posición de compás) y el lienzo de sistemas `.scoreViewport`.
   - **Conmutación de vista:** Conecta con `scoreViewMode` para alternar entre `'tab'` (tablatura pura con números de traste claros y líneas de cuerda), `'score-tab'` (pentagrama estándar + tablatura) y `'score'` (pentagrama estándar puro), mapeando a `StaveProfile` de alphaTab.
   - **Línea de letra:** Responde reactivamente a `showLyrics`, mostrando las sílabas cursivas debajo de cada compás en estribillos y estrofas cuando está activo, y ocultándolas por completo cuando está inactivo.
   - **Cursor de pulso y selección:** Dibuja el compás activo con fondo cálido ambarino (`rgba(245, 158, 11, 0.10)`), el cursor del pulso activo con barra turquesa `#14b8a6` e iluminación del traste activo, los compases seleccionados con fondo turquesa suave (`rgba(20, 184, 166, 0.08)`) y el icono `🔁` al final del rango de bucle.

6. **Interacción con ratón para navegación y selección de compases:**
   - **Decisión:**
     - **Clic simple:** Sitúa el cursor de reproducción en el compás pulsado (`currentBar`), resetea `currentBeat = 0`, enfoca `inspectedBar` y limpia la selección previa.
     - **Shift + Clic:** Selecciona el rango continuo de compases entre el compás previo y el pulsado (`selectedBarRange: [min, max]`).
     - **Arrastre (drag selection):** `onMouseDown` + `onMouseEnter` sobre las celdas permite seleccionar intuitivamente un bloque de compases con el ratón.
     - **Accesibilidad:** Cada celda de compás es un elemento interactivo accesible (`role="button"`, `tabIndex={0}`, `aria-label="Compás X..."`) operable con teclado (<kbd>Enter</kbd> / <kbd>Espacio</kbd>).

7. **Arquitectura de pruebas con doble inyectable (`createApi` y `createMockPlayer`):**
   - **Decisión:** Dado que `@coderline/alphatab` comprueba en su constructor la presencia de un entorno de navegador real y arroja un error en JSDOM/Node.js, se diseñó la prop opcional `createApi?: (container: HTMLElement, settings?: unknown) => AlphaSynthLike` en `AlphaTabViewport` y la interfaz `AlphaSynthLike` en `alphaSynthController`. En pruebas de Vitest, `createApi` inyecta un doble espía que emite eventos (`playedBeatChanged`, `playerStateChanged`, etc.), mientras que en tiempo de ejecución del navegador real se carga dinámicamente `AlphaTabApi`.
   - **Justificación:** Permite ejecutar la batería completa de pruebas unitarias y de integración de UI y audio en JSDOM en menos de 1.5 segundos con aislamiento absoluto y determinismo sin requerir emulación pesada de Canvas/WebGL.

---

## 2026-11-01 — Implementación del hito C6 (UI Parte 1: `SongView`, `SongTopBar`, `SongContextStrip` e instrumentos en vivo)

1. **Conexión de `SongView` en `AppShell.tsx` e independencia estricta entre modos (Criterio l):**
   - **Decisión:** Retirar el contenedor de sustitución provisional (*Próximamente*) de `AppShell.tsx` y renderizar directamente `SongView` al seleccionar el modo Canción (`currentMode === 'cancion'`). Añadir la prop opcional inyectable `songStore?: StoreApi<SongStore>` a `AppShellProps` para facilitar pruebas aisladas.
   - **Aislamiento de estado y atajos:** Al alternar libremente entre `Sandbox`, `Aprender` y `Canción`, el estado de cada modo (selección de notas, contexto activo, tarjetas en estudio, compás y bucle de canción) se conserva íntegro. El atajo global <kbd>M</kbd> conmuta el sonido en todos los modos, mientras que pulsar <kbd>C</kbd> en Canción no limpia ni altera la selección del Sandbox.

2. **Barra superior (`SongTopBar`) y mezclador multipista (`TrackMixerPopover`) (Criterio k):**
   - **Decisión:** Implementar `SongTopBar` con altura fija de 48 px enmarcada según la maqueta y la especificación de `interfaz_fase3.md`:
     - **Izquierda:** Botón accesible `📁 Canciones` y bloque de metadatos de la pieza activa (título en negrita y subtítulo dinámico con artista, compás y tempo BPM).
     - **Grupo PISTA y Mezclador:** Selector desplegable de pista activa mostrando nombre y afinación, y botón `Mezclador` con despliegue flotante accesible de `TrackMixerPopover` (`width: 360px`, cerrable con <kbd>Esc</kbd> o clic exterior), controlando individualmente *Mute (M)*, *Solo (S)* y deslizador de volumen de cada pista de la canción, más el interruptor de cuenta atrás (`Cuenta atrás (1 compás)`).
     - **Grupo de Transporte:** Botón `⏮` de salto al inicio (o inicio del bucle), botón principal `▶ Reproducir / ⏸ Pausa` (con resaltado turquesa `#14b8a6` durante reproducción), botón dinámico de `Bucle` (que refleja el rango activo p. ej. `Bucle 5–8`), control de velocidad en pasos discretos normalizados `[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0]` y botón de metrónomo.
     - **Grupo VISTA:** Conmutador segmentado de 3 opciones (`Tab`, `Partitura + Tab`, `Partitura`) y botón de conmutación de `Letra`.
     - **Acciones globales:** Botón `Sonido M` y botón `⚙ Ajustes` compartidos.

3. **Franja de contexto (`SongContextStrip`) y reactividad armónica (Criterio i y h):**
   - **Decisión:** Implementar `SongContextStrip` con altura de 38 px fijada justo sobre el mástil para estabilidad visual absoluta durante la reproducción:
     - **Izquierda:** Posición en vivo monoespaciada (`Compás {N} · Pulso {B}`), insignia coloreada de la sección actual (`Estribillo`, `Intro`) y aviso de rango seleccionado con botón compacto `✕ Quitar selección`.
     - **Centro:** Desplegable de tonalidad activa con indicador de punto ámbar `●` cuando existe una sobreescritura manual y opción de restablecimiento a cálculo automático; desplegable de acorde activo en ámbar (`#f59e0b` / `#fbbf24`) mostrando el acorde vigente y su numeral romano (calculado mediante `romanNumeral` respecto a la tonalidad activa) con opción de sobreescritura manual inmediata a partir de los candidatos analizados del compás; y conmutador segmentado `GRADOS` (`Tonalidad` vs `Acorde`).
     - **Derecha:** Selector de etiquetas sincronizado con los ajustes (`Nota` · `Intervalo` · `Grado` · `Ninguna`).

4. **Representación de cejilla (`capoFret > 0`) y adaptación de afinación en `Fretboard` y `Piano`:**
   - **Decisión:**
     - Añadir la prop opcional `capoFret?: number` a `FretboardProps` y la clase `.capoBar` en `Fretboard.module.css`. Cuando una pista declara cejilla (`capoFret > 0`), se dibuja un rectángulo translúcido vertical sobre ese traste y los trastes anteriores (`0 .. capoFret - 1`) adoptan opacidad atenuada (`opacity: 0.28`).
     - En `Fretboard.tsx`, ajustar el mapeo de cuerdas al tamaño real de `tuning.strings` (p. ej. 4 cuerdas en el bajo eléctrico) para evitar índices inexistentes o cálculos `NaN` al conmutar de pista.
     - Conectar las marcas de `selectSongFretboardMarks` y `selectSongPianoMarks` para que reflejen en vivo las notas activas del pulso (`pinned`, con anillo concéntrico si es la fundamental de referencia) sobre el fondo de escala (`scale-bg`) con la afinación y cejilla exactas de la pista activa, sin mutar `sandboxStore.tuning`.

5. **Atajos de teclado del Modo Canción:**
   - **Decisión:** Habilitar en `SongView` los atajos <kbd>Espacio</kbd> (Play/Pausa), <kbd>L</kbd> (alternar bucle sobre selección o sección actual), <kbd>←</kbd> y <kbd>→</kbd> (avanzar/retroceder de compás), <kbd>Home</kbd> (volver al inicio de la pieza o del bucle) y <kbd>Esc</kbd> (deseleccionar compases o cerrar popovers).

6. **Refinamientos del hito C6 derivados de la verificación interactiva:**
   - **Estabilidad de layout y ergonomía en `SongTopBar`:**
     - El botón de Reproducir/Pausa se configuró con anchura fija (`32px`) y solo icono (`▶` / `⏸`), eliminando el ensanchamiento al conmutar texto que desplazaba los controles y ocultaba el botón de Ajustes fuera de la pantalla.
     - Botón de ajustes reducido a icono `⚙` para ahorrar ~50px de espacio horizontal.
     - Icono de carpeta de canciones sustituido por un icono SVG vectorial con `stroke="currentColor"` en lugar del emoji amarillo del sistema operativo.
     - Botones de metrónomo (icono SVG) y bucle (`🔁`) simplificados a iconos compactos accesibles.
     - Añadido `overflow-x: auto; scrollbar-width: none;` y `flex-shrink: 0;` a los grupos para garantizar que ningún botón quede fuera de vista en resoluciones compactas.
   - **Aislamiento visual de AlphaTab y síntesis de audio real:**
     - El contenedor `.alphaTabContainer` se posicionó fuera de pantalla (`top: -9999px; left: -9999px; width: 800px; height: 600px; opacity: 0; visibility: hidden; pointer-events: none;`). Esto impide que el lienzo por defecto de AlphaTab se filtre en la parte superior del visor o distorsione los modos de partitura y tablatura de Guitar Aid.
     - Al instanciar `AlphaTabApi`, se alimenta la partitura mediante `api.tex(alphaTex, [activeTrackIndex])` para que AlphaSynth cargue los datos de la pista y el SoundFont local (`/soundfont/sonivox.sf2`), posibilitando la reproducción audible de audio en tiempo real.
     - En `staffContainer`, se implementó la representación visual de notas mediante cabezas de nota (`●`) posicionadas verticalmente según la altura MIDI de cada pulso, junto con el símbolo de clave (`𝄞` o `𝄢`), resolviendo la partitura vacía en los modos `score` y `score-tab`.
   - **Visualización completa del rango de bucle (Loop):**
     - Se añadió el cálculo de `isInLoop`, `isLoopStart` e `isLoopEnd`.
     - Todos los compases dentro del bucle activo reciben la clase `.barCellInLoop` (fondo y borde cálido ambarino resaltado), el compás inicial muestra la insignia `[ 🔁` y el final `🔁 ]` (o `]` si coinciden), haciendo evidente qué compases están en bucle y dónde empieza y termina.
   - **Corrección crítica de restablecimiento de sobreescrituras (overrides):**
     - Anteriormente, `setBarOverride` realizaba `{ ...current, ...override }`. Al borrar solo la escala (o solo el acorde) mediante `delete override.tonic`, el spread fusionaba los campos anteriores de `current` restaurando la escala/acorde borrado.
     - Se implementaron métodos específicos `clearBarScaleOverride(barNumber)` y `clearBarChordOverride(barNumber)` en `store.ts` y se actualizó `setBarOverride` para limpiar valores `undefined` y eliminar la entrada del diccionario cuando no quedan propiedades. Esto permite restablecer la escala automática sin perder el acorde fijado y viceversa.
   - **Correcciones en `TrackMixerPopover`:**
     - El deslizador de volumen de cada pista (`.volumeControl` y `.volumeSlider`) se acotó con `flex-shrink: 0; box-sizing: border-box; width: 100%` para evitar que desborde de la tarjeta.
     - Se reforzó la escucha de la tecla <kbd>Escape</kbd> en fase de captura (`capture: true`) en `window` y `document` para asegurar el cierre inmediato del popover independientemente del elemento con foco.

7. **Anotaciones y tareas críticas para el Hito C8 (Panel de Análisis y Cinta Armónica):**
   - **[CRÍTICO C8] Normalización de puntuación en ranking de candidatos de acorde:**
     - En `SongContextStrip`, los candidatos de `analyzeBarChords` mostraban porcentajes incoherentes superiores al 100 % (p. ej. `235%`, `191%`) debido a que la función `detectChords` devuelve puntuaciones acumulativas de ajuste (pesos de fundamental, cobertura y popularidad) y no un valor probabilístico normalizado de 0 a 100. En C6 se normalizó visualmente respecto al candidato superior (`Math.round((score / maxScore) * 100)%`), pero se registra como **tarea crítica para C8** formalizar la escala de confianza o calibración porcentual en el motor de análisis y en el panel detallado.
   - **[DISEÑO C8] Reubicación del indicador de sobreescritura (punto ámbar `●`):**
     - El punto ámbar de sobreescritura manual en la píldora de acorde/tonalidad de `SongContextStrip` debe trasladarse a la cinta armónica (`SongTimelineBar`) para C8, señalizando visualmente los compases modificados a lo largo de la línea temporal de la pieza musical.

8. **Segunda ronda de refinamientos del hito C6 (Feedback interactivo y corrección visual):**
   - **Iconografía monocromática SVG unificada:** Sustitución de los emojis restantes (`🔁`, `🔊`, `🔇`) en `SongTopBar` y `AlphaTabViewport` por iconos SVG vectoriales monocromáticos (`Lucide-style`: `Repeat`, `Volume2`, `VolumeX`) que respetan la paleta oscura de la interfaz (`currentColor`, `#94a3b8`, `#14b8a6`).
   - **Comportamiento de Bucle sobre compás individual:** Al hacer clic en el botón de bucle sin una selección multirango activa (`selectedBarRange === null`), el bucle se aplica con exactitud al compás activo `[currentBar, currentBar]` en lugar de abarcar toda la sección musical.
   - **Corrección de espaciado y layout de compases:** En `AlphaTabViewport`, se eliminó la fragmentación rígida en bloques de 4 compases y se implementó una cuadrícula unificada CSS Grid (`repeat(auto-fill, minmax(180px, 1fr))`), eliminando los espacios excesivos al inicio/final y los compases huérfanos.
   - **Adaptación y corrección de Tablatura (`tab`):** Renderizado de las líneas horizontales según el número de cuerdas de la pista (6 para guitarra, 4 para bajo), posicionamiento de los números de traste (`fretBadge`) centrados directamente sobre su línea con fondo opaco que enmascara la línea subyacente, y cursor de pulso vertical turquesa `#14b8a6`.
   - **Apertura de `TrackMixerPopover` y gestión de eventos:** Se corrigió el recorte del popover configurando `overflow: visible` y `position: relative` en `.topBar`, se incrementó el `z-index` a `1000` y se añadió `triggerRef` para que el clic sobre el botón de Mezclador abra y cierre el popover sin ser interceptado prematuramente por el detector de clics exteriores.
   - **Eliminación del espacio vacío en la cabecera del visor:** El elemento host de AlphaTab (`alphaTabHostRef`) se extrajo completamente fuera del contenedor con scroll `.scoreViewport` y se aisló con `position: fixed !important; top: -99999px !important;`. Anteriormente, al residir dentro de `.scoreViewport` (que tiene `display: block`), AlphaTab inyectaba su contenedor de renderizado (`.at-surface`) directamente antes de `.systemsContainer`, ocupando ~170px de espacio vertical invisible en el flujo del DOM que empujaba los compases hasta la parte inferior del visor.



---

## 2026-11-01 — Corrección de bugs post-C6: persistencia del mezclador multipista, conmutación de pista sin pausa y sincronización de posición de transporte

Tras la primera implementación de C6, se identificaron y solucionaron dos problemas críticos en el motor de reproducción multipista y la interfaz:

1. **Persistencia del ciclo de vida de `AlphaTabApi` frente a cambios de pista activa (`activeTrackIndex`):**
   - **Problema:** El hook `useEffect` de inicialización de AlphaTab en `AlphaTabViewport.tsx` incluía `activeTrackIndex` en su lista de dependencias. Cada vez que el usuario cambiaba de pista en el desplegable de `SongTopBar`, se ejecutaba la función de limpieza (`controller.detachPlayer()` y `api.destroy()`) y se instanciaba un nuevo `AlphaTabApi`. Esto provocaba:
     - Detención forzosa de la reproducción en curso (pausa involuntaria al cambiar de pista).
     - Reseteo de la posición interna del reproductor al tick 0 (inicio de la pieza).
     - Pérdida de los niveles configurados en el sintetizador AlphaSynth: al procesar la nueva partitura, AlphaTab reinicializaba los canales al volumen por defecto del archivo (100%), mientras la interfaz visual seguía mostrando los porcentajes configurados.
   - **Decisión y solución:**
     - Desacoplar el ciclo de vida del reproductor de `activeTrackIndex`, manteniéndolo en una referencia persistente (`apiRef`).
     - Al conmutar de pista en el desplegable, se invoca exclusivamente `api.renderTracks([trackObj])`. AlphaTab actualiza la notación visual de forma instantánea sin destruir la instancia, sin pausar la reproducción de audio en marcha, sin resetear ticks y preservando intactos los volúmenes, silencios y solos de cada pista.
     - Los cambios en modo de visualización (`scoreViewMode`) y letra (`showLyrics`) se gestionan mediante `updateSettings()` y `render()`, evitando también cualquier reinicio del motor de audio.

2. **Resolución del direccionamiento de pistas en el mezclador multipista (`applySingleTrackToPlayer`):**
   - **Problema:** En `alphaSynthController.ts`, `applySingleTrackToPlayer` intentaba indexar `player.tracks[trackIndex]`. En AlphaTab, la propiedad `api.tracks` solo contiene las pistas **que se están dibujando en pantalla** (longitud 1 al renderizar una sola pista). Cuando la pista activa era la 1 (p. ej. Bajo eléctrico), `player.tracks[0]` apuntaba al objeto de la pista 1 y `player.tracks[1]` era `undefined`. Como resultado:
     - Modificar el volumen de la pista 0 (Guitarra) en el mezclador enviaba `[track1]`, modificando el volumen del Bajo en vez de la Guitarra.
     - Modificar la pista 1 (Bajo) caía en el fallback `[1]`, modificando también el Bajo.
     - Era imposible modificar la pista 0 mientras la pista 1 estuviese activa en pantalla.
   - **Decisión y solución:**
     - Pasar siempre el arreglo numérico directo `[trackIndex]` a `player.changeTrackVolume`, `changeTrackMute` y `changeTrackSolo`.
     - La fachada interna de AlphaTab (`_trackIndexesToTracks(uiFacade.parseTracks(tracks))`) resuelve los índices numéricos contra `score.tracks` (la colección completa de pistas de la canción), permitiendo que el mezclador controle cualquier pista independientemente de cuál se esté visualizando en el visor.

3. **Sincronización en el evento `playerReady` y método `resetTrackMixer`:**
   - **Problema:** Cuando AlphaTab termina de cargar el SoundFont y el archivo MIDI de la partitura, su evento interno `readyForPlayback` restablece los canales a `volume / 16`. Si el controlador no escuchaba este evento, los ajustes del mezclador quedaban anulados hasta que el usuario moviera manualmente un control deslizante. Además, pulsar «Restablecer» en el mezclador ejecutaba `applyTrackMixer({})`, lo cual no revertía los cambios previos en el reproductor.
   - **Decisión y solución:**
     - En `registerPlayerListeners`, se añade la escucha del evento `player.playerReady` para re-aplicar automáticamente todos los niveles de `trackMixer` (`applyAllTracksToPlayer`) en cuanto el sintetizador esté listo.
     - Se implementa el método `resetTrackMixer()` en `AlphaSynthController`, el cual restablece todos los canales a volumen `1.0`, desactiva mutes y solos, y limpia el estado del mezclador al pulsar «Restablecer» en `TrackMixerPopover`.

4. **Cálculo de ticks y sincronización de transporte (`calculateTickForBarBeat`):**
   - **Problema:** Al hacer clic en un compás en el visor o navegar con las teclas de flecha, el store actualizaba `currentBar` y `currentBeat`, pero el reproductor AlphaTab no recibía el comando de posicionamiento de cursor / ticks (`seekToTick`). Como consecuencia, al pulsar Reproducir, el motor de audio siempre arrancaba desde el tick donde se hubiese quedado o desde el inicio (tick 0).
   - **Decisión y solución:**
     - Se añade la función pura [`src/song/ticks.ts`](../../src/song/ticks.ts) (`calculateTickForBarBeat(bars, barNumber, beatIndex)`), que calcula el tick MIDI exacto acumulando las duraciones de los compases previos según sus fórmulas de compás (base 960 ticks/negra) y sumando el desplazamiento del pulso relativo.
     - Se sincroniza la posición con `controller.seekToTick(tick)` al hacer clic simple en cualquier compás de `AlphaTabViewport`, al iniciar la reproducción desde pausa con la barra espaciadora o el botón Play de `SongTopBar`, al saltar al inicio (<kbd>Home</kbd> o botón `⏮`), y al desplazarse con las flechas de dirección (<kbd>←</kbd> / <kbd>→</kbd>).

---

## 2026-11-01 — Configuración de producción para AlphaTab en Vite (`pnpm preview` / `pnpm build`), workers, fuentes SMuFL y code-splitting

Tras la implementación de los componentes visuales de Fase 3, se identificó que la reproducción funcionaba en `pnpm dev` pero fallaba en el build de producción (`pnpm preview`), arrojando errores en la consola del navegador y advertencias de empaquetado.

### 1. Problemas identificados
1. **Fallo en la carga del Web Worker y de las fuentes musicales SMuFL en `pnpm preview`:**
   - La consola del navegador mostraba:
     - `Loading Worker from "http://localhost:4173/assets/alphaTab.worker.mjs" was blocked because of a disallowed MIME type ("text/html")`.
     - `downloadable font: rejected by sanitizer ... source: http://localhost:4173/assets/font/Bravura.woff2`.
     - `[AlphaTab][Font] [alphaTab] Loading Failed, rendering cannot start Font not available`.
   - **Causa raíz:** En producción, Vite empaqueta los módulos bajo `dist/assets/`. AlphaTab autodetecta su script base (`Environment._detectScriptFile`) a través de `import.meta.url`, infiriendo que sus workers (`alphaTab.worker.mjs`) y sus fuentes (`font/Bravura.woff2`) residen junto a él en `assets/`. Al no existir en `dist/`, el servidor SPA de Vite servía `index.html` (MIME `text/html`) con código 200, provocando que el navegador bloqueara el worker y el sanitizador de fuentes rechazara el HTML descargado. Sin fuentes, el motor de AlphaTab abortaba inmediatamente la inicialización del lienzo y del reproductor.
2. **Advertencia de importación dinámica ineficaz (`[INEFFECTIVE_DYNAMIC_IMPORT]`):**
   - El compilador advertía que `alphaTab.mjs` era importado dinámicamente en `AlphaTabViewport.tsx`, pero a la vez estaba importado estáticamente por `src/song/importer.ts` (arrastrado al bundle de entrada por `presets.ts` y `store.ts`), impidiendo aislar alphaTab en un chunk secundario.
3. **Advertencia de tamaño de chunks (`> 500 kB`):**
   - El chunk principal `index.js` alcanzaba ~1,8 MB minificado al contener la totalidad de la librería alphaTab (~1,1 MB) junto con el core de la aplicación y React.
4. **Petición 404 en `favicon.ico`:**
   - El navegador solicitaba por defecto `/favicon.ico`, que no estaba presente ni declarado en `index.html`.

### 2. Decisiones y soluciones adoptadas
1. **Adopción del plugin oficial `@coderline/alphatab-vite`:**
   - Se instaló `@coderline/alphatab-vite` (v1.8.4) y se configuró en [`vite.config.ts`](../../vite.config.ts).
   - El plugin intercepta las llamadas a `alphaTabUrl` dentro de alphaTab y empaqueta automáticamente `alphaTab.worker` y `alphaTab.worklet` como artefactos gestionados por Vite en `dist/assets/alphaTab.worker-[hash].js`.
   - Se configuró `worker: { format: 'es' }` en `vite.config.ts` para compilar los workers como módulos ES nativos sin advertencias de `import.meta`.
2. **Configuración explícita de `fontDirectory` y `soundFont` en `AlphaTabViewport.tsx`:**
   - Se configuró en `new at.Settings()`:
     ```ts
     const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
     settings.core.fontDirectory = `${baseUrl}/font/`;
     settings.player.soundFont = `${baseUrl}/soundfont/sonivox.sf2`;
     ```
   - Las fuentes Bravura (`Bravura.woff2`, `Bravura.woff`, `Bravura.otf`, etc.) se alojaron en `public/font/` y adicionalmente en `public/assets/font/`, garantizando disponibilidad tanto si se resuelven contra la raíz como contra la subcarpeta `assets/`.
3. **Estrategia de división de código (`manualChunks`) en `vite.config.ts`:**
   - Se definió una función `manualChunks` en `rollupOptions.output`:
     - `@coderline/alphatab` se traslada a su propio chunk independiente (`alphatab-[hash].js`, ~1,14 MB).
     - Las dependencias de `react` y `react-dom` se aíslan en `react-vendor-[hash].js` (~218 kB).
     - El código de la aplicación en `index-[hash].js` se reduce drásticamente a **~429 kB** (< 500 kB).
   - Se ajustó `chunkSizeWarningLimit: 1500` para reflejar con realismo el peso de los motores pesados de notación/audio de terceros.
   - Se eliminaron por completo las advertencias de compilación.
4. **Favicon SVG inline:**
   - Se añadió `<link rel="icon" href="data:image/svg+xml,...">` con el icono 🎸 en [`index.html`](../../index.html) para eliminar la petición 404.

---

## 2026-11-01 — Corrección del bucle de reproducción (playback looping), cálculo de ticks y continuidad de posición al conmutar de pista

1. **Sincronización del rango de compases en la interfaz con los ticks de `AlphaSynth`:**
   - **Problema:** En `songStore`, el bucle se modelaba en números de compás `[startBar, endBar]` (lo que permitía resaltar visualmente las celdas en el visor), pero nunca se calculaban ni enviaban los ticks MIDI correspondientes (`PlaybackRangeBounds { startTick, endTick }`) a `AlphaSynthController` ni a la instancia de `AlphaTabApi`. Como resultado, `player.playbackRange` permanecía `null` y el sintetizador continuaba reproduciendo los compases posteriores como si no hubiera ningún bucle activo. Además, al completarse cada iteración de un bucle, el evento nativo `finished` de AlphaSynth apagaba `isPlaying = false`, deteniendo erróneamente la reproducción.
   - **Decisión y solución:**
     - Se implementó la función pura `calculatePlaybackRangeForBars(bars, loopRange)` en [`src/song/ticks.ts`](../../src/song/ticks.ts), la cual calcula de manera robusta el tick inicial (`calculateTickForBarBeat(bars, startBar, 0)`) y el tick final (`calculateTickForBarBeat(bars, endBar + 1, 0)`), ordenando automáticamente rangos invertidos y soportando métricas variables.
     - En `AlphaTabViewport.tsx`, se añadió un hook `useEffect` que sincroniza reactivamente `loopRange` y `loopEnabled` con `controller.setPlaybackRange` y `controller.setLoopEnabled`.
     - En `alphaSynthController.ts`, se modificó `applyLoopToPlayer` para asignar `player.playbackRange = state.isLooping ? state.loopRange : null`, asegurando que al desactivar el bucle el reproductor elimine cualquier restricción de rango. Asimismo, en `emitFinish` se omite pausar la reproducción (`isPlaying = false`) si el bucle está encendido (`state.isLooping && state.loopRange`).
     - En `SongTopBar.tsx` y `SongView.tsx`, al iniciar la reproducción con Play o <kbd>Espacio</kbd>, si el cursor activo queda fuera de los compases en bucle, se reposiciona automáticamente en el inicio del bucle. Al hacer clic simple fuera del bucle, este se desactiva permitiendo la libre navegación.

2. **Continuidad de reproducción al cambiar de pista en bucle (prevención del reinicio forzado a `startTick`):**
   - **Problema:** En la librería AlphaTab, el setter nativo `api.playbackRange = value` ejecuta incondicionalmente `if (value) this.tickPosition = value.startTick;`. Al conmutar de pista en el selector de `SongTopBar`, la referencia de `track.bars` cambiaba, disparando el efecto de sincronización y reasignando `player.playbackRange` con los mismos ticks. Esto provocaba que, en medio de la reproducción, el cursor y el audio saltaran inmediatamente al compás inicial del bucle en lugar de continuar reproduciendo de forma fluida.
   - **Decisión y solución:**
     - Se implementó la función auxiliar `areRangesEqual(a, b)` en `alphaSynthController.ts`. Si `setPlaybackRange` recibe un rango con ticks idénticos (`startTick` y `endTick`) a los ya presentes, se omite por completo reasignar la propiedad en `player`. De igual forma, en `setLoopEnabled` se omite la reasignación si `state.isLooping` ya coincide.
     - Si el rango cambia mientras la reproducción está activa (`state.isPlaying === true`), el controlador captura `player.tickPosition` antes de la asignación y, si dicho tick queda comprendido en el nuevo rango, restaura inmediatamente `player.tickPosition = curTick`, garantizando la continuidad ininterrumpida de la reproducción activa al cambiar de pista.


---

## 2026-11-01 — Especificación de reimplementación del visor musical en sistemas continuos (Tablatura, Partitura y Tab+Partitura) [Hito C6b]

### 1. Diagnóstico de los problemas del visor actual
Tras la primera versión visual desarrollada en C6, se identificaron limitaciones arquitectónicas y estéticas que no cumplían con el diseño original ni con las reglas estándar de notación musical:
1. **Troceado en tarjetas/cajas por compás (`.barCell` en CSS Grid):**
   - Los compases se maquetaban como tarjetas rectangulares aisladas con borde, margen y relleno propio. Esto generaba un aspecto fragmentado y fatigante a nivel visual, en vez de la lectura horizontal fluida propia de una partitura o tablatura real.
2. **Imposibilidad de navegar el cursor a notas o pulsos concretos:**
   - El control de navegación e interactividad estaba restringido a nivel de compás: hacer clic sobre un compás situaba la reproducción en el compás completo con `currentBeat = 0`. No era posible hacer clic sobre una nota o pulso específico para examinarlo o pausar sobre él.
3. **Suposición rígida de un único acorde por compás en la esquina superior:**
   - El componente forzaba la visualización del cifrado armónico en la esquina superior derecha (`.metaRight`) de cada caja, asumiendo implícitamente que solo hay un acorde por compás y que coincide con el inicio del mismo. En canciones reales, los cambios armónicos ocurren frecuentemente en subdivisiones o tiempos secundarios (p. ej. Do en tiempo 1 y Sol en tiempo 3), quedando invisibles o mal representados.
4. **Violación de las reglas de grabado musical en el modo Partitura:**
   - Cada tarjeta de compás intentaba dibujar su propio símbolo de clave (`𝄞`) y sus 5 líneas aisladas. En la notación musical académica, la clave, la armadura de tonalidad y la fórmula de compás se dibujan **exclusivamente al inicio de cada sistema**, repitiéndose únicamente cuando ocurre un cambio explícito de tonalidad (modulación) o de métrica.
5. **Partitura rota y rudimentaria:**
   - Las notas del pentagrama se representaban como caracteres Unicode `●` flotantes sin plicas (stems), sin barras de unión rítmica (beams), sin alteraciones accidentales ni silencios.
6. **Dificultad de sincronización en el modo Tablatura + Partitura:**
   - Al estar troceado por columnas, apilar partitura y tablatura duplicaba la fragmentación y desalineaba las alturas melódicas respecto a las digitaciones.

---

### 2. Arquitectura del Modelo de Sistemas Continuos
Se adopta el modelo de **Sistemas Continuos** estándar en la edición musical profesional (similar a Guitar Pro, TuxGuitar y Soundslice):

1. **Sistemas horizontales continuos (`ScoreSystem`):**
   - La pista se divide en una secuencia de sistemas (filas horizontales) que agrupan típicamente 4 compases contiguos (o adaptables al ancho del contenedor).
   - Cada sistema tiene pautas horizontales continuas que atraviesan todos sus compases de izquierda a derecha.
   - Los compases se delimitan únicamente por **barras divisorias verticales finas** (`|`), líneas de inicio/fin de sección o barras de repetición (`|:`, `:|`), sin cajas cerradas ni márgenes entre compases.

2. **Cabecera única de sistema (margen izquierdo):**
   - **Tablatura:** un único rótulo vertical «T A B» al inicio del sistema.
   - **Partitura:** clave (sol 8vb `𝄞₈` para guitarra o fa `𝄢` para bajo) + armadura (número de sostenidos o bemoles de la tonalidad activa) + fórmula de compás (p. ej. 4/4) dibujadas únicamente al inicio del sistema. En compases intermedios, solo se dibujan si hay un cambio real de tonalidad o métrica.
   - **Tablatura + Partitura:** pentagrama superior con clave/armadura/métrica y tablatura inferior con «T A B», acoplados verticalmente.

3. **Posicionamiento temporal y métrico proporcional ($x$ continuo):**
   - Dentro de cada compás, los pulsos y notas se distribuyen horizontalmente en función de su posición temporal relativa (`startTick / totalBarTicks`).
   - Cada nota posee una coordenada horizontal precisa, garantizando alineación vertical en acordes plaqué y coherencia rítmica.

4. **Posicionamiento libre y múltiple de acordes:**
   - Los cifrados de acordes se sitúan flotando sobre el sistema en la **coordenada $x$ exacta del pulso** donde comienzan a sonar.
   - Si un compás tiene cambios en varios tiempos (p. ej. pulso 1 y pulso 3), cada acorde se dibuja sobre su pulso correspondiente.
   - El acorde activo en el pulso en reproducción se resalta con brillo ámbar (`#fbbf24`), y los overrides manuales se identifican con un punto ámbar sutil.

5. **Cursor de pulso y nota interactivo:**
   - El cursor de reproducción es una barra vertical turquesa (`#14b8a6`, ~14px con halo translúcido y línea central nítida) que viaja nota a nota.
   - **Navegación interactiva:** hacer clic directamente en cualquier nota o pulso específico sitúa el cursor en esa nota (`currentBar`, `currentBeat`), calcula el tick con `calculateTickForBarBeat` y sincroniza el audio con `controller.seekToTick(tick)`. Arrastrar entre pulsos/compases establece la selección de rango (`selectedBarRange`).

6. **Letra musical sincronizada:**
   - Las sílabas de letra (`lyrics`) se sitúan debajo de la pauta centradas exactamente en el pulso donde se cantan.

---

### 3. Especificación detallada por modo de visualización

#### 3.1. Modo Tablatura (`tab`)
- **Pauta:** $S$ líneas horizontales continuas en `#334155` (6 para guitarra, 4 para bajo eléctrico).
- **Encabezado:** bloque «T A B» vertical fijado en la cabecera izquierda de cada sistema.
- **Números de traste:** dígitos monoespaciados legibles (`IBM Plex Mono` bold, blanco `#f8fafc`) centrados verticalmente sobre su cuerda, con un recuadro de oclusión opaco del color de fondo (`var(--surface-1)`) que enmascara la línea de cuerda subyacente.
- **Metadatos del compás:**
  - Número de compás en monoespaciada gris (`#64748b`) situado en la esquina superior izquierda de cada barra divisoria.
  - Insignia de sección (`Intro`, `Estribillo`) en turquesa `#2dd4bf` sobre el primer compás de la sección.
  - Icono de bucle `🔁` e inicio/fin de bucle mediante corchetes luminosos `[ 🔁` y `🔁 ]`.
- **Cursor:** barra vertical turquesa que abarca la altura total de las cuerdas en la coordenada $x$ del pulso activo.

#### 3.2. Modo Partitura (`score`)
- **Pauta:** pentagrama clásico de 5 líneas continuas con separación uniforme (≈8px entre líneas).
- **Clave musical:** clave de sol octavada inferior (8vb, indicando que la guitarra suena una octava por debajo de lo escrito) para pistas de guitarra; clave de fa para bajo eléctrico. Ubicada únicamente al inicio del sistema.
- **Armadura:** alteraciones de sostenidos o bemoles correspondientes a la tonalidad activa al inicio del sistema o tras una modulación.
- **Fórmula de compás:** dígitos de compás (p. ej. `4/4`) en notación musical al inicio del primer sistema o ante cambios de métrica.
- **Notación musical:** cabezas de nota elípticas en líneas y espacios según altura MIDI real; plicas hacia arriba (para notas por debajo de la 3ª línea Si3) o hacia abajo (en la 3ª línea o superior); barras de unión (beams) horizontales para agrupar corcheas y semicorcheas; líneas adicionales (ledger lines) para notas graves (Mi/Re bajo el pentagrama) o agudas.
- **Cifrados:** ubicados por encima del pentagrama en el pulso correspondiente.

#### 3.3. Modo Tablatura + Partitura (`score-tab`)
- **Cabecera técnica:** título `PARTITURA + TAB · {NOMBRE_PISTA}` y subtítulo en monoespaciada a la derecha: `Clave, compás y TAB: solo al inicio y en los cambios · compás {N} de {Total}` (conforme a la maqueta oficial).
- **Sistema dual acoplado:** cada sistema horizontal contiene el pentagrama estándar en la parte superior y la tablatura en la inferior.
- **Unión vertical continua de compases:** las barras de compás divisorias verticales descienden atravesando continuamente ambas pautas y el espacio intermedio (desde la 1ª línea superior del pentagrama hasta la última línea inferior de la tablatura), vinculando cada compás visual y temporalmente de punta a punta.
- **Cabecera de sistema:** clave de sol (`𝄞₈`) o fa (`𝄢`), armadura y compás en el pentagrama superior; bloque vertical «T A B» en la tablatura inferior. Solo se dibujan al inicio de cada sistema o ante modulaciones/cambios métricos.
- **Sincronización $x$ estricta:** las notas en el pentagrama y los números de traste en la tablatura comparten rigurosamente la misma coordenada horizontal $x$.
- **Cifrados de acordes:** situados por encima del pentagrama superior en la coordenada horizontal exacta del pulso donde ocurren, con resaltado ámbar (`#fbbf24`) en el acorde del compás/pulso activo.
- **Marcadores de sección y bucle:** situados en la parte superior derecha del compás correspondiente (p. ej. `Estribillo · bucle A–B` en verde turquesa `#2dd4bf` sobre el compás 8, `Estrofa` sobre el compás 12).
- **Cursor unificado:** una sola columna vertical turquesa continua (`#14b8a6` con halo translúcido de ~14px) que atraviesa el pentagrama y la tablatura al unísono en el pulso activo, iluminando la nota en el solfeo y el número de traste en la tablatura simultáneamente.
- **Letra musical:** situada debajo de la tablatura al pie del sistema, centrada bajo el pulso correspondiente.

---

### 4. Plan de ejecución por etapas (Nuevo Hito C6b)
Para mantener entregas incrementales verificadas:
1. **Paso 1 (Inmediato - C6b): Reimplementación de la Vista Tablatura Continua:**
   - Eliminar el maquetado de tarjetas `.barCell`.
   - Construir el renderizado de sistemas continuos en `AlphaTabViewport.tsx`.
   - Implementar el posicionamiento temporal proporcional de notas y múltiples acordes por compás.
   - Habilitar el cursor interactivo con clic directo a nivel de nota y pulso (`seekToTick`).
   - Adaptar los tests automatizados y verificar `pnpm test`, `pnpm lint` y `pnpm build`.
2. **Paso 2 (Posterior): Implementación de la Vista Partitura y Vista Dual:**
   - Renderizado de clave, armadura en cambios y grabado de figuras musicales (cabezas, plicas, barras).
   - Emparejamiento del sistema dual pentagrama + tablatura.

---

## 2026-11-01 — Decisiones de diseño e implementación del Hito C6b (Vista Tablatura Continua)

1. **Estructura y separación estricta de carriles verticales en la cabecera del compás (`systemTopLane`):**
   - **Problema detectado:** Al eliminar las tarjetas cerradas, los números de compás, insignias de sección y cifrados armónicos compartían espacio, provocando que las etiquetas se colaran dentro de las cuerdas de la tablatura y que los acordes en el primer tiempo (p. ej. `Am` en compás 5) se solaparan horizontalmente con la numeración del compás.
   - **Decisión:** Establecer una jerarquía vertical de dos filas con altura acotada (`height: 46px; margin-bottom: 8px`):
     - **Fila superior (`metaTopRow`, 18px):** Aloja en el extremo izquierdo (`metaTopLeft`) el número de compás (`bar.number`) y la insignia de sección (`sectionBadge`), y en el extremo derecho (`metaTopRight`) los marcadores de bucle (`loopBadge` y `loopMarker`).
     - **Fila inferior (`metaBottomRow`, 24px):** Reservada **exclusivamente para los cifrados armónicos** (`chordName`), alineados con precisión temporal sobre el centro de cada pulso (`left: percent%`). Esto garantiza que los acordes se ubiquen con claridad musical sobre sus notas sin colisionar jamás con los números de compás ni con las etiquetas.

2. **Propagación y visibilidad controlada de etiquetas de sección (`isSectionHeader`):**
   - **Decisión:** Aunque el importador propaga `sectionMarker` a cada compás individual para fines de análisis tonal y bucles, en la vista del visor la insignia de sección solo se renderiza visualmente si:
     - Es el compás donde inicia una nueva sección (`track.bars[bar.index - 1]?.sectionMarker !== bar.sectionMarker`).
     - O es el primer compás de un nuevo sistema horizontal (`bar.index % 4 === 0`).
   - **Justificación:** Evita la polución visual y redundancia de repetir «INTRO» o «ESTRIBILLO» compás a compás, manteniendo la claridad de lectura conforme al diseño original.

3. **Interactividad y navegación a nivel de pulso (`calculateTickForBarBeat` y `seekToTick`):**
   - **Decisión:** Cada pulso dentro de un compás se mapea a un contenedor interactivo (`tabBeatColumn`) con un ancho ergonómico de 28px centrado en su coordenada horizontal relativa.
   - **Comportamiento:** Al pulsar sobre una nota/pulso, se calcula la posición absoluta en ticks (`calculateTickForBarBeat = sum(barTicks[0..n-1]) + beat.startTick`), actualizando la posición en el estado global (`setCurrentPosition`) y disparando `controller.seekToTick(tick)`. El cursor de reproducción vertical (halo turquesa de 16px con bordes nítidos) viaja nota a nota con resaltado luminoso sobre los números de traste activos.

4. **Máscaras de oclusión de fondo en números de traste (`fretBadge`):**
   - **Decisión:** En lugar de dejar que las líneas de las cuerdas atraviesen los números de traste, cada dígito de traste cuenta con un fondo opaco del color de la superficie (`var(--surface-1)`), padding horizontal de 3px y `z-index: 5`.
   - **Justificación:** Ocluye limpiamente la cuerda subyacente y ofrece una legibilidad nítida e instantánea de las digitaciones, idéntica al estándar editorial de Guitar Pro y tablaturas comerciales.

---

## 2026-11-01 — Decisiones de diseño e implementación del Hito C6b (Reimplementación de la Vista Partitura)

1. **Grabado musical estándar de sistemas continuos sin cabeceras repetitivas:**
   - **Problema previo:** El modo partitura previo renderizaba una cabecera con clave de sol (`𝄞`) en cada sistema horizontal y caracteres Unicode `●` flotantes sin plicas, barras rítmicas ni líneas adicionales.
   - **Decisión:** Implementar la regla canónica de notación editorial reflejada en la maqueta original:
     - **Compás 1 (Inicio de la obra):** Se dibuja la clave musical (clave de sol octavada inferior `𝄞₈` para guitarra o clave de fa `𝄢` para bajo) y la fórmula de compás (p. ej. `4/4` con numerador sobre denominador) en el extremo izquierdo del pentagrama.
     - **Compases 2 en adelante:** La pauta de 5 líneas continuas atraviesa el sistema de izquierda a derecha sin repetir la clave ni el compás, dibujándolos únicamente ante modulaciones de armadura o cambios de métrica métricos explícitos («solo se dibujan al inicio y en los cambios»).
     - **Subtítulo técnico conciso:** En la cabecera de la tarjeta se muestra información relevante y concisa para el músico: `Clave de sol (8vb) · compás {N} de {Total}` (o `Clave de fa · ...` para bajo, `Percusión · ...` para percusión).

2. **Mapeo de tonos con transposición 8vb y líneas adicionales (ledger lines):**
   - **Decisión:** La guitarra y el bajo eléctrico son instrumentos transpositores que suenan una octava más grave de lo escrito (`8vb`). Se implementó en `ScoreRenderer.tsx` la función pura `midiToDiatonicStep`:
     - Altura escrita: `writtenMidi = soundingMidi + 12`.
     - Paso relativo a la 1ª línea inferior del pentagrama (`relStep`): `0 = Línea 1 (Mi4)`, `4 = Línea 3 (Si4)`, `8 = Línea 5 (Fa5)`.
     - Notas graves por debajo del pentagrama (como Mi2 al aire en cuerda 6, `relStep = -7`): se calculan y graban dinámicamente sus líneas adicionales (`ledgerLines = [-2, -4, -6]`). En Drop D (Re2, `relStep = -8`), se añade la 4ª línea adicional en `-8`.
     - Notas agudas por encima del pentagrama: líneas adicionales automáticas en pasos pares superiores (`10, 12...`).
     - Alteraciones accidentales: renderizado de sostenidos (`♯`) y bemoles (`♭`) a la izquierda de la cabeza de la nota cuando no pertenecen a la armadura natural.

3. **Plicas (stems), unión rítmica por barras (beams), corcheas y semicorcheas:**
   - **Decisión:**
     - **Dirección de plica:** En notación de guitarra (que suena 8vb), la convención editorial estándar sitúa las plicas hacia arriba (`'up'`) para despejar el pentagrama y evitar que las plicas atraviesen los acordes. Solo se orientan hacia abajo si todas las notas del grupo o pulso están en el registro muy agudo (Línea 4 Re5 o superior, `relStep >= 6`).
     - **Geometría sincronizada de plicas y barras:** Se unificó la función de posicionamiento horizontal `getBarBeatPercent`. Para cada grupo de barras, la altura y pendiente suave (`slopeDy` acotada a ±6px) se calculan de forma que todas las plicas del grupo toquen exactamente la línea de la barra (`stemEndY = y1 + t * slopeDy`) sin desfase ni sobrepaso.
     - **Corcheas y semicorcheas (beams dobles y banderolas):**
       - Corcheas (`durationTicks <= 480`): barra simple de 3.2px o banderola simple si está aislada (`score-flag-primary`).
       - Semicorcheas (`durationTicks <= 240`): barra doble paralela desplazada 5px hacia las notas (`score-beam-secondary`) o doble banderola si está aislada (`score-flag-secondary`).
       - Fusas (`durationTicks <= 120`): barra terciaria o triple banderola.

4. **Cursor interactivo unificado y compatibilidad total:**
   - **Decisión:** Cada pulso dentro del pentagrama es un contenedor interactivo con cursor turquesa vertical iluminado (`#14b8a6`, ~16px con halo translúcido) y resaltado `#2dd4bf` sobre la cabeza y plica de la nota activa. Clicar sobre cualquier nota o pulso posiciona inmediatamente el cursor y ejecuta `seekToTick` en el controlador de audio.
   - **Alcance acotado:** Conforme a los requisitos, se reimplementó exclusivamente el modo Partitura (`scoreViewMode === 'score'`), manteniendo intacta la tablatura y postergando el acoplamiento dual pentagrama + tablatura.

---

## 2026-11-01 — Re-especificación y delegación íntegra del renderizado visual de partituras y tablaturas a AlphaTab

### 1. Diagnóstico y contexto del problema
Durante las iteraciones del Hito C6b, se intentó implementar un motor de grabado musical propio en SVG y HTML dentro de React (`ScoreRenderer.tsx` y sistemas de tablatura manuales en `AlphaTabViewport.tsx`), relegando a `@coderline/alphatab` a un contenedor fuera de pantalla (`top: -99999`) únicamente como disparador de audio.

Esta estrategia generó graves inconvenientes arquitectónicos y de producto:
1. **Reinvención innecesaria de la rueda:** La notación musical para guitarra y bajo exige manejar una enorme cantidad de técnicas y detalles editoriales: *bends* (cuarto, medio, entero, *pre-bends*, *release*), *slides* (cambio de posición, ligados), ligados de articulación (*hammer-on* y *pull-off*), vibrato, *palm mute*, armónicos, plicas, barras de unión de notas (*beams*), tresillos, líneas adicionales, compases imperfectos, silencios, armaduras, claves y saltos de línea automáticos.
2. **Fragilidad y sobrecarga de código:** El motor artesanal en SVG requería cientos de líneas de cálculo manual de coordenadas, pendientes de barras, posiciones de cabezas de nota y anchos de compás, produciendo errores visuales, desalineaciones con el audio y una gran deuda técnica.
3. **Desaprovechamiento de AlphaTab:** AlphaTab ya está integrado en el proyecto (`@coderline/alphatab`), incluye la fuente SMuFL `Bravura` y los renderizadores SVG/canvas de nivel editorial más avanzados del ecosistema web. Intentar competir contra su propio renderizador carecía de sentido práctico.

### 2. Decisiones adoptadas

1. **Delegación total del renderizado gráfico a AlphaTab:**
   - Se desmantela el renderizado artesanal (`ScoreRenderer.tsx` y sistemas manuales) y se elimina cualquier truco de ocultar AlphaTab fuera de pantalla (`top: -99999`).
   - `AlphaTabViewport.tsx` renderiza de forma visible y a pantalla completa el contenedor nativo de `AlphaTabApi` (`.alphaTabHost`), con scroll vertical nativo y tamaño responsivo.

2. **Modos nativos directos de AlphaTab (`settings.display.staveProfile`):**
   - **`Tab` (`at.StaveProfile.Tab`):** tablatura pura con cuerdas, trastes y todas las articulaciones de guitarra.
   - **`Score` (`at.StaveProfile.Score`):** partitura clásica en solfeo con clave (sol 8vb / fa), armadura, plicas automáticas y figuras rítmicas.
   - **`ScoreTab` (`at.StaveProfile.ScoreTab`):** notación dual acoplada sincronizada al milímetro.
   - **Soporte inmediato de técnicas:** Se obtiene de inmediato y de forma nativa soporte perfecto para *bends*, *slides*, *hammer-on/pull-off*, *vibrato*, *ties*, *tuplets*, *lyrics*, etc., sin escribir una sola línea de grabado manual.

3. **Tema oscuro integrado en AlphaTab:**
   - La apariencia oscura de la aplicación se inyecta directamente en las propiedades de renderizado de AlphaTab mediante `settings.display.resources`:
     - `staffLineColor`: `#334155`
     - `barSeparatorColor`: `#475569`
     - `mainGlyphColor`: `#f8fafc` (blanco nítido de alto contraste para notas, números de traste, plicas y claves)
     - `secondaryGlyphColor`: `#94a3b8`
     - `barNumberColor`: `#64748b`
     - `scoreInfoColor`: `#f8fafc`
   - Se configuran las fuentes locales (`public/font/` con `Bravura`) y estilos CSS para el contenedor (`background: var(--surface-1)`) y los cursores nativos (`.at-cursor-bar`, `.at-cursor-beat`, `.at-selection`) con la paleta turquesa de Guitar Aid (`#14b8a6` / `#2dd4bf`).

4. **Conservación de la Barra Contextual de Guitar Aid sobre el visor:**
   - Encima del lienzo de AlphaTab se sitúa fija nuestra barra contextual, preservando el valor teórico y diferencial de Guitar Aid:
     - **Acordes analizados:** cifrado y grado del acorde calculado para el compás activo (con resaltado ámbar `#fbbf24` y el punto `●` de override manual).
     - **Marcador de sección:** insignia de la sección actual (`Intro`, `Estribillo`, etc.).
     - **Marcadores de bucle y selección:** estado del bucle `[🔁 A–B]` y compases seleccionados.

5. **Sincronización interactiva bidireccional:**
   - **AlphaTab → Guitar Aid:**
     - El cursor nativo de AlphaTab y los eventos `playedBeatChanged` y `beatMouseDown` actualizan `currentBar` y `currentBeat` en `songStore`.
     - Esto sincroniza en tiempo real las notas activas en el mástil (`Fretboard`) y el piano (`Piano`), superpuestas sobre la escala activa (`scale-bg`) con sus marcas `pinned` y `root`.
   - **Guitar Aid → AlphaTab:**
     - Cambios en el transporte, tempo, pista activa o selección de compás reposicionan o re-renderizan AlphaTab a través de `alphaSynthController` y `AlphaTabApi`.

