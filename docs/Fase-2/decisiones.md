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
