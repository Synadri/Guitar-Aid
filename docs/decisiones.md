# Registro de decisiones

Decisiones de diseño y aclaraciones de requisitos. Las más recientes van al final.

## 2026-10-23 — Planificación inicial

### Stack
TypeScript (strict), Vite, React 19, `tonal` (envuelto en `src/theory`), Zustand (+ `persist` solo para ajustes), SVG y Web Audio hechos a mano, CSS Modules, Vitest + Testing Library, ESLint + Prettier, pnpm.

### Arquitectura
Tres capas: `src/theory` (TS puro), `src/state` (depende solo de theory) y `src/ui` (React), más el servicio `src/audio`. ESLint prohíbe importar React o DOM desde `theory`.

### Aclaraciones de requisitos
1. **Numeración de cuerdas:** la cuerda 1 es la más aguda y la 6 la más grave. Se corrige el criterio de aceptación 1: cuerda 5, traste 7 → **E3**.
2. **Catálogo de escalas:** una sola entrada para **Mayor / Jónico** y otra para **Menor natural / Eólico** (con alias).
3. **Disposición por defecto:** horizontal, con la guitarra arriba y el piano debajo.
4. **Mostrar todas las posiciones:** activado por defecto.
   - Una nota pulsada en el piano o elegida en un menú se muestra en todas sus posiciones del mástil como **círculos huecos o translúcidos**.
   - Una posición pulsada en la guitarra queda **fijada** y se dibuja como **círculo lleno (opaco)**. Sus equivalentes se dibujan huecas.
   - Si el modo está desactivado, solo se ven las posiciones fijadas.
5. **Rango del piano:** C2–C7 (61 teclas), que cubre el mástil completo en afinación estándar (E2–E6) y la nota más grave de las afinaciones incluidas (D2). Hay desplazamiento por octavas cuando no cabe (pantallas pequeñas o vertical).
6. **Blues mayor:** 1 – 2 – ♭3 – 3 – 5 – 6.

### Interacción propuesta (pendiente de validar en el hito 2)
- Clic en una posición hueca: la fija (pasa a llena).
- Clic en una posición llena: la desfija. Si la nota se quedó sin posiciones fijadas y no vino del piano ni de un menú, sale de la selección.
- Clic en una tecla activa del piano: quita esa nota de la selección, con todas sus posiciones.

## 2026-10-23 — Revisión del plan (v2)

### Selección en capas
- `notes`: notas concretas con octava, con sus posiciones fijadas y su origen.
- `context`: acorde o escala de menú como **clase de altura de la raíz + tipo**, sin convertirse en notas MIDI. En los acordes guarda también el voicing elegido.
- `preview`: sugerencia previsualizada.
- `rootOverride`: raíz fijada por el usuario.
- El panel de información lista las clases de altura del contexto, no notas MIDI. La detección de acordes solo se aplica a `notes`. "Reproducir escala" toca una octava.

### Componentes de instrumento puros
`Fretboard` y `Piano` reciben marcas (`{ posición o midi, papel, etiqueta }`) por props y emiten eventos. No leen el estado del Sandbox. Las marcas las calculan selectores puros con tests.

### Contrato de la teoría
- Las funciones aceptan notas con peso (`WeightedPc[]`) y una raíz opcional.
- Devuelven siempre `Candidate<T> = { value, score, reasons }`, con razones estructuradas que la UI traduce a texto.

### Raíz
- En el Sandbox, la raíz es la que fija el usuario o, si no fija ninguna, la nota más grave.
- No hay estimación de raíz; queda para el modo Canción.
- La raíz ordena los candidatos pero no los filtra.

### Detección de acordes
- Se hace por clases de altura (máscaras de bits) contra un catálogo propio con intervalos requeridos y opcionales, por ejemplo la 5ª opcional en los acordes de 9.
- A♯ y B♭ dan el mismo resultado. `tonal` queda solo para deletreo de notas.

### Ranking de escalas
- Filtro: la escala debe incluir todas las notas del acorde.
- Orden: raíz coincidente → peso de la escala (en datos) → menos notas sobrantes.
- Si un caso falla, se ajustan los pesos, no la arquitectura.

### Voicings
- Diccionario de formas conocidas para la afinación estándar (abiertas, cejilla/CAGED, drop 2/3, shell sin 5ª), con tests de integridad.
- Para otras afinaciones:
  1. desplazamiento uniforme (Eb, D);
  2. adaptación por cuerda (Drop D);
  3. diccionario pequeño para afinaciones abiertas;
  4. algoritmo de respaldo marcado como "generado".
- Los puntos 3 y 4 son un sub-hito que se puede posponer.

### Orden y pruebas
- Orden: teoría (T1–T4) → estado (S1–S2) → interfaz (U1–U7).
- Cada hito trae sus tests. El criterio 9 queda cubierto al cerrar T3, en `src/theory/acceptance.test.ts`.

## 2026-10-23 — Cierre del plan de la Fase 1

- **El plan canónico está en `docs/plan_fase1.md`** y no solo como artifact, para que otros agentes puedan trabajar con él.
- **Sujeto de las sugerencias:** se analiza la última capa modificada. El panel indica siempre con claridad qué está analizando (objeto y origen). Si hay notas pulsadas y un contexto de menú, se puede cambiar con pestañas.
- **Fijar raíz:** el control principal es un desplegable en el panel de información con "Automática" y las 12 notas. Permite fijar una raíz no pulsada y volver a automático. El clic derecho sobre una nota es solo un atajo opcional.
- **Reproducir escala:** una octava ascendente desde la tónica en la octava 3 hasta la tónica superior (C3–C4; como máximo B3–B4).
- **Voicings en la Fase 1:** diccionario estándar + desplazamiento uniforme (Eb, D) + adaptación por cuerda (Drop D). Se elimina el sub-hito T4b. Si no hay voicing válido, se muestran las notas del acorde en todo el mástil.

## 2026-10-23 — Hito 0: herramientas

- **Dependencias añadidas fuera de la tabla de stack** (aprobadas): `@vitejs/plugin-react` (fast refresh y transformación de JSX en Vite) y `jsdom` (entorno DOM para los tests con Testing Library desde U1; los tests usan `node` por defecto y piden jsdom por archivo).
- **TypeScript fijado a `~6.0`** (instalado 6.0.3), no 7.x.
  - **Motivo:** `typescript-eslint` 8.72 declara el peer `typescript >=4.8.4 <6.1.0`, y ESLint es una pieza clave del plan (regla de capas).
  - **Cuándo revisarlo:** cuando una versión de `typescript-eslint` amplíe su rango de peer para incluir TS 7. Comprobar con `pnpm peers check` al actualizar dependencias; entonces subir `typescript` y quitar esta nota.

## 2026-10-23 — Hito T1: núcleo y mástil

- Deletreo de notas hecho a mano (modo sostenidos/bemoles), sin usar `tonal` por ahora: no hacía falta. Se puede incorporar más adelante si T2/T3 necesitan deletreo contextual de escalas.
- Convención MIDI 60 = C4. Las afinaciones guardan las cuerdas de grave a aguda (cuerda 6 → 1).
- Recolocación al cambiar de afinación: conserva la cuerda si la nota sigue existiendo en ella; si no, el traste más cercano; si no existe, devuelve null (la UI avisará).

## 2026-10-23 — Hito T2: acordes, detección, intervalos y grados

- **Catálogo de acordes (`chords.ts`) y limitación conocida de la 5ª:** las 12 calidades de Requisitos §6.4 (`maj`, `m`, `7`, `maj7`, `m7`, `6`, `m6`, `9`, `sus4`, `sus2`, `dim`, `aug`) se definen con máscaras de bits precalculadas (`requiredMask`, `optionalMask`, `allowedMask`). La 5ª es opcional en `9` y obligatoria en el resto para evitar falsos positivos entre tríadas y cuatríadas incompletas (p. ej. que `Am` no se confunda con `C6` sin 5ª). **Limitación conocida asumida en la Fase 1:** las formas *shell* de acordes de séptima sin 5ª (p. ej. `Am7` tocado como `A-C-G`, habituales en guitarra) no se detectan al pulsar notas sueltas.
- **Pesos y constantes de puntuación centralizados:** los pesos de cada calidad (`CHORD_QUALITY_WEIGHTS`) y los factores de puntuación de `detectChords` (`CHORD_DETECTION_SCORING`: `ROOT_MATCH_BONUS`, `OMITTED_OPTIONAL_PENALTY`, `ROOT_NOTE_WEIGHT_FACTOR`) viven como constantes con nombre en un único lugar (`src/theory/data/chords.ts`) para facilitar su ajuste en T3.
- **Ambigüedad `6` vs `m7` y desempate determinista:** `6` y `m7` tienen el mismo peso de catálogo (`88`). Si hay raíz de entrada, gana el candidato cuya fundamental coincide (`rootMatches`) y el otro se conserva como inversión (`invertedBass`, `bass` en `ChordRef`, formateable como `Am7/C` con `chordDisplayName`). Si no se indica raíz, en caso de empate exacto de puntuación se desempata de forma determinista por la clase de altura de la raíz (`0..11`), sin depender del orden en que vengan las notas de entrada.
- **Códigos de razón estructurados:** `detectChords` emite `containsChordTones` (`{ n, of }`), `rootMatches` (`{ root }`), `invertedBass` (`{ root, bass }`) y `omitsOptionalTones` (`{ count }`).
- **Intervalos y grados:** se añaden nombres descriptivos en español (`intervalLongName`: `fundamental`, `3ª menor`, `5ª justa`, `7ª menor`, etc.) y grados (`degreeName` / `pcDegree`), además de `chordTones` que resuelve intervalos específicos de calidad (`5ª disminuida` / `♭5` en `dim`, `5ª aumentada` / `♯5` en `aug`, `9ª mayor` / `9` en `9`).

## 2026-10-23 — Hito T3a: catálogo de escalas y ranking

- **Alcance:** solo `scales.ts`, `rankScalesForChord`, `scalesContaining` y `scalesOnTonic`. Diatónicos, escalas relacionadas y progresiones quedan para T3b. Sin penalizaciones por notas a evitar.
- **Catálogo (13 entradas):** mayor/jónico y menor natural/eólico con alias (una entrada cada una), armónica, melódica, dórico, frigio, lidio, mixolidio, locrio, pentatónicas, blues (pentatónica menor + ♭5) y blues mayor (1 2 ♭3 3 5 6). Cada una: `id`, `name`, `aliases`, `intervals`, `weight`, `family` y `parentOffset` (semitonos de su tónica sobre la de la escala madre; ausente en blues, que no es modo de ninguna familia).
- **Pesos (`SCALE_WEIGHTS`):** mayor 100, menor natural 98, dórico 92, pentatónica menor 90, pentatónica mayor 88, mixolidio 85, lidio 80, blues 75, armónica 71, blues mayor 70, melódica 68, frigio 60, locrio 40. Am7 → eólico, dórico, pentatónica menor (frigio y blues quedan debajo); Cmaj7 → jónico por encima de lidio.
- **Puntuación (`SCALE_RANKING_SCORING`):** `ROOT_MATCH_BONUS` 1000, `EXTRA_NOTE_PENALTY` 0,01 por nota sobrante (nunca supera 1 punto de peso). El orden real es lexicográfico (raíz → peso → sobrantes) con desempate determinista por orden de catálogo y tónica; `score` es coherente con él.
- **Contrato:** `Candidate`/`Reason` sin cambios. Nuevo tipo `ScaleRef { tonic, type, name }` y un código de razón nuevo, `scaleExtraNotes` (`{ count }`). Se reutilizan `scaleContainsAllNotes` (`{ n }`), `tonicMatches` (`{ tonic }`) y `scaleContainsNote` (`{ pc, degree }`).
- **Razón de popularidad:** código nuevo `scaleCommonness` (`{ weight }`), presente en los tres rankings. Sin él, dos escalas con las mismas notas sobrantes (Cmaj7: jónico y lidio, 3 cada una) no tendrían ninguna razón que explicara su orden.
- **Sin empates de peso:** todos los pesos son distintos para que el orden lo fije un dato explícito y no el orden del catálogo. Se resolvió el empate armónica/blues mayor con armónica 71 y blues mayor 70 por popularidad: la armónica es mucho más común (clásica, metal, flamenco, dominante de la menor) y el blues mayor es un nicho. Un test comprueba que no hay empates y que se mantiene esa diferencia.
- `scalesContaining` ordena por peso; `scalesOnTonic` devuelve las 13 escalas de la tónica, por peso.

## 2026-10-24 — Hito T3b: diatónicos, relacionadas, progresiones y aceptación

- **`diatonicChords(scale)`:** tríadas apiladas en terceras sobre cada grado de escalas heptatónicas, con romanos (`I ii iii°`, `♭III`, `♭III+`…; ♭/♯ respecto a la mayor). **Solo tríadas:** las séptimas diatónicas (m7♭5, mMaj7, dim7) no están en el catálogo de acordes. Las pentatónicas y blues no tienen 7 notas: usan los acordes de su `chordSource` (dato en `scales.ts`: pentatónica menor y blues → menor natural; pentatónica mayor y blues mayor → mayor), necesario para el criterio 6.
- **`relatedScales(scale)`:** tres razones, reutilizando los códigos ya existentes: `relativeScale` (dato `relative` en `scales.ts`: mayor↔menor, pentatónicas, blues↔blues mayor), `sharedParentScale` (misma escala madre mediante `family` y `parentOffset`; las del blues no tienen madre) y `closeScaleVariant` (misma tónica y como máximo 2 notas de diferencia, con `added` y `removed`). Una escala acumula todas las razones que le correspondan. Orden por nivel (`RELATED_SCALE_SCORING`: relativa 1000, madre 400, variante 200) y luego por peso; todas llevan `scaleCommonness`.
- **Progresiones (`progressions.ts`):** 13 plantillas (7 mayores, 6 menores) con pasos `{ roman, offset, quality }`, definidas en datos. `PROGRESSION_WEIGHTS` por popularidad, sin empates (I–V–vi–IV 100, I–IV–V 97, i–♭VII–♭VI–♭VII 96, … blues menor 78). Las séptimas (ii7–V7–Imaj7, blues) quedan por debajo de las de tríadas.
- **`progressionsFor(chord)`:** coincidencia exacta de fundamental y calidad en las 12 tonalidades. Razones nuevas: `progressionCommonness` (`{ weight }`) y el ya existente `appearsInKey` (`{ tonic, mode, degree }`). Orden: peso de la plantilla y tónica de la tonalidad (determinista, no hay preferencia por tonalidad). `progressionChords(plantilla, tónica)` devuelve los acordes que lo acompañan.
- **Alcance omitido:** `chordsContaining` (sugerencia para una nota suelta, `suggestions/forNote`) no estaba en este hito y no se ha implementado.
- **`acceptance.test.ts`:** cubre los criterios 1–6 (teoría) comprobando códigos y datos.

## Ideas posteriores (fuera de la Fase 1)

- **Diccionario de voicings para afinaciones abiertas:** un diccionario pequeño para Open G, Open D y DADGAD (la cejilla da el acorde mayor, más las formas menores y de séptima más comunes).
- **Algoritmo de voicings de respaldo** para afinaciones sin diccionario, con restricciones ergonómicas estrictas:
  - 5ª opcional donde la teoría lo permite;
  - raíz en el bajo;
  - como máximo una cuerda interior muteada;
  - cejilla detectada;
  - al menos 4 cuerdas.

  Sus resultados se marcarían como "generado" y quedarían por debajo de los del diccionario.
- **Estimación de raíz** sin raíz explícita: para el modo Canción.
