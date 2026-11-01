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
