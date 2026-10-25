# Guitar Aid — Documento de requisitos (Fase 1)

Documento pensado para entregarse a un agente de desarrollo con IA (Antigravity IDE/CLI). El autor no escribirá código: todo lo necesario para construir la Fase 1 debe estar aquí. Ante cualquier discrepancia con [plan_fase1.md](plan_fase1.md), prevalece el plan.

## 1. Visión

Guitar Aid es una aplicación web para ordenador que ayuda a entender la guitarra visualizándola junto al piano. En la guitarra, las afinaciones por cuartas y terceras mayores hacen que los patrones sean fáciles de reconocer pero que las notas subyacentes, los intervalos y los grados sean difíciles de inferir. En el piano todo es lineal y visible. La aplicación muestra ambos instrumentos sincronizados para que el usuario piense en notas, intervalos y grados, y no solo en trastes.

**Usuario objetivo:** un único usuario (el autor), guitarrista principiante-intermedio que aprende con tabs y quiere entender la teoría que hay detrás.

**Principio de diseño:** cada fase debe ser útil por sí sola. La Fase 1 debe poder usarse a diario sin necesitar el resto.

## 2. Alcance de la Fase 1

La Fase 1 incluye únicamente el modo **Sandbox**: un mástil de guitarra y un teclado de piano sincronizados, con selección de notas, acordes y escalas, y sugerencias teóricas.

### Dentro del alcance

- Mástil de guitarra y teclado de piano interactivos y sincronizados.
- Afinación estándar y varias afinaciones comunes.
- Selección de notas sueltas, acordes y escalas desde cualquiera de los dos instrumentos o desde menús.
- Reproducción de sonido al pulsar (sonido sencillo, sin amp sim).
- Sugerencias teóricas según lo seleccionado (acordes, escalas, progresiones).
- Etiquetas conmutables: nombre de nota, intervalo respecto a la tónica, grado.

### Fuera del alcance (fases posteriores)

- Modo Tests.
- Modo Canción (importar y reproducir tabs, análisis de selecciones).
- Entrada de audio, afinador, detección de notas, amp sim.
- Versión móvil, versión desktop nativa, cuentas de usuario, backend.
- Vista de partitura.

## 3. Plataforma y stack recomendado

- **Plataforma:** aplicación web, optimizada para ordenador (ratón y teclado). No hay requisito de móvil, pero el diseño no debe romperse en pantallas pequeñas.
- **Sin backend.** Todo se ejecuta en el navegador; la configuración se guarda en el almacenamiento local del navegador.
- **Stack sugerido** El stack está definido en [plan_fase1.md](plan_fase1.md).
- **Regla importante:** la teoría musical (acordes, escalas, intervalos, sugerencias) debe vivir en un módulo independiente de la interfaz, con pruebas unitarias, para poder reutilizarlo en las fases de Tests y Canción.

## 4. Modelo de dominio

- **Nota:** clase de altura (12 posibles) más octava. Se representa con nombre (por ejemplo C#4) y número MIDI.
- **Enarmonía:** la aplicación debe mostrar el nombre correcto según contexto (por ejemplo Bb en lugar de A# en tonalidad de F mayor). Si no hay contexto, preferencia configurable entre sostenidos y bemoles.
- **Afinación:** lista ordenada de notas de las cuerdas al aire, de grave a aguda (6 cuerdas en esta fase).
- **Posición en el mástil:** par (cuerda, traste). Cuerda 1 = la más aguda, cuerda 6 = la más grave. Traste 0 = cuerda al aire. Mástil de 0 a 24 trastes.
- **Selección:** Modelo en capas especificado en la sección 2 de [plan_fase1.md](plan_fase1.md)
- **Acorde:** tónica más calidad (mayor, menor, 7, maj7, m7, dim, aug, sus2, sus4 como mínimo).
- **Escala:** tónica más tipo (ver sección 6.4).

## 5. Interfaz

### 5.1 Disposición general

- Barra superior con: selector de afinación, selector de modo de nombres (sostenidos/bemoles), botón de limpiar selección, interruptor de sonido.
- Zona central con los dos instrumentos. Por defecto: disposición horizontal, con la guitarra arriba y el piano debajo. El usuario puede cambiar la orientación (horizontal/vertical) y ocultar cualquiera de los dos. La preferencia se guarda.
- Panel lateral o inferior de **sugerencias** y de **información de la selección**.

### 5.2 Guitarra

- Mástil de 24 trastes con 6 cuerdas, marcas de posición (3, 5, 7, 9, 12, 15, 17, 19, 21, 24).
- Clic en una posición: activa o desactiva la nota (aparece un círculo).
- Opción de modo **zurdo** (invertir el mástil).
- Etiquetas en los círculos conmutables entre: nombre de nota, intervalo respecto a la tónica, grado, nada.
- Cuando hay varias notas en una misma altura, se resaltan todas las posiciones equivalentes del mástil (modo "mostrar todas las posiciones", activable y **activado por defecto**). La posición pulsada en la guitarra se dibuja como círculo lleno (opaco); las equivalentes, como círculos huecos o translúcidos. Las notas seleccionadas desde el piano o los menús se muestran como equivalentes (huecas) en todas sus posiciones.

### 5.3 Piano

- Rango por defecto C2–C7 (61 teclas), que cubre todo el mástil de 24 trastes en afinación estándar (E2–E6). Desplazamiento por octavas cuando el espacio no alcanza (pantallas pequeñas u orientación vertical).
- Clic en una tecla: activa o desactiva la nota.
- Mismas etiquetas conmutables que la guitarra.
- Cuando se selecciona en un instrumento, el otro refleja la selección de forma inmediata. Si la guitarra tiene la nota en una octava fuera del rango visible del piano, el piano debe poder mostrarla desplazándose automáticamente.

### 5.4 Sincronización

- La fuente de verdad es el conjunto de **notas con octava**. Ambos instrumentos son vistas de ese conjunto.
- Al seleccionar en el piano una nota que existe en varias posiciones de la guitarra, la aplicación puede mostrar todas las posibles (modo opcional) o ninguna hasta que el usuario elija una posición concreta.

## 6. Funcionalidades

### 6.1 Selección por menús

- Selector de **acorde**: elegir tónica y calidad. Se muestran las notas del acorde en ambos instrumentos. Para la guitarra se ofrecen varias digitaciones (voicings) comunes del acorde, navegables.
- Selector de **escala**: elegir tónica y tipo. Se muestran todas las notas de la escala en el mástil completo y en el piano.
- Las selecciones por menú y las manuales conviven; el usuario puede limpiar todo con un botón.

### 6.2 Información de la selección

Siempre que haya notas activas, el panel muestra:

- Nombres de las notas seleccionadas, ordenadas de grave a aguda.
- Intervalos entre notas consecutivas y respecto a la raíz.
- Si el conjunto forma un acorde reconocible: su nombre, con alternativas cuando sea ambiguo (por ejemplo C6 y Am7 comparten notas).
- Si no se reconoce ningún acorde, se indica explícitamente en lugar de inventar uno.

### 6.3 Sugerencias

El panel de sugerencias tiene dos modos conmutables: **Acordes** y **Escalas**.

**Una única nota seleccionada**

- Modo Acordes: acordes que contienen esa nota, indicando qué papel tiene la nota en cada uno (tónica, tercera, quinta, etc.).
- Modo Escalas: escalas que contienen esa nota, y escalas que tienen esa nota como tónica con todos sus modos y variantes disponibles.

**Un acorde seleccionado**

- Escalas que se pueden tocar sobre ese acorde, ordenadas por cuántas notas del acorde contienen y por lo "natural" del encaje.
- Posibles progresiones de acordes que incluyen ese acorde (por ejemplo, en qué tonalidades aparece y con qué grado, y qué acordes diatónicos lo acompañan).

**Una escala seleccionada**

- Acordes diatónicos de la escala (con numeración romana).
- Escalas relacionadas: modos de la misma escala madre, relativa mayor/menor, variantes que difieren en pocas notas.

**Ordenación y explicación:** cada sugerencia debe mostrar brevemente por qué encaja (por ejemplo "contiene las 3 notas del acorde"). Si hay muchas sugerencias, se ordenan por relevancia y se pueden expandir.

**Al pulsar una sugerencia:** se previsualiza en ambos instrumentos (con un color distinto al de la selección) y puede aplicarse como nueva selección con un clic.

### 6.4 Catálogo mínimo de escalas y acordes

Escalas: mayor / jónico (una sola entrada), menor natural / eólico (una sola entrada), menor armónica, menor melódica, el resto de modos de la mayor (dórico, frigio, lidio, mixolidio, locrio), pentatónica mayor, pentatónica menor, blues (pentatónica menor con blue note) y blues mayor.

Acordes: mayor, menor, 7, maj7, m7, dim, aug, sus2, sus4, 6, m6, 9.

El catálogo debe definirse en datos (no en código disperso) para poder ampliarlo.

### 6.5 Afinaciones

Afinaciones incluidas en la Fase 1: estándar (E A D G B E), Drop D, DADGAD, Open G, Open D, medio tono abajo (Eb) y un tono abajo (D). La lista se define en datos para poder añadir más. Por ahora, las digitaciones sugeridas solo existen en estándar, Eb, D y Drop D, los detalles se definen en la sección 4 de [plan_fase1.md](plan_fase1.md). Cambiar de afinación **no borra la selección de notas**: se recolocan las notas en el mástil usando la nueva afinación cuando sea posible, y si una nota no existe en ninguna posición se avisa.

### 6.6 Sonido

- Al activar una nota, suena brevemente (sonido sintético sencillo, por ejemplo Web Audio con envolvente de pluck).
- Botón para reproducir la selección actual: como acorde (todas a la vez), arpegio (de grave a aguda) o escala (ascendente).
- Interruptor global de sonido y control de volumen.

### 6.7 Persistencia

Se guardan en el navegador: afinación, orientación, instrumentos visibles, modo zurdo, preferencia de sostenidos/bemoles, etiquetas, modo de sugerencias y volumen. La selección actual no se guarda entre sesiones.

## 7. Requisitos no funcionales

- Respuesta instantánea: cambiar la selección o la afinación debe reflejarse en menos de 100 ms.
- Funciona en las últimas versiones de Chrome y Firefox.
- Sin dependencias de servicios externos en tiempo de ejecución.
- Accesibilidad básica: contraste suficiente, atajos de teclado para limpiar la selección y alternar sonido.
- Código organizado en tres capas separadas: teoría musical, estado de la aplicación e interfaz.

## 8. Criterios de aceptación

La Fase 1 está terminada cuando:

1. Al pulsar la cuerda 5, traste 7 (afinación estándar), el piano marca E3 y la etiqueta muestra el nombre correcto (E).
2. Al pulsar una tecla del piano con la opción "mostrar todas las posiciones" activa, se resaltan todas las posiciones equivalentes del mástil.
3. Seleccionar acorde Am7 muestra A, C, E, G en ambos instrumentos y el panel indica los intervalos (fundamental, 3ª menor, 5ª justa, 7ª menor).
4. Seleccionar C, E y G a mano hace que el panel reconozca C mayor.
5. Seleccionar C, E, G y A a mano muestra que puede ser C6 o Am7, sin elegir una por el usuario.
6. Seleccionar escala de La menor pentatónica muestra todas sus notas en el mástil completo y sugiere acordes y escalas relacionadas.
7. Cambiar a Drop D mantiene las notas seleccionadas y recoloca sus posiciones en el mástil.
8. Se puede ocultar la guitarra o el piano, cambiar a orientación horizontal y la configuración se recuerda al recargar.
9. Existen pruebas unitarias del módulo de teoría que cubren los criterios 1 a 6.

## 9. Hoja de ruta posterior

1. **Fase 2 — Tests:** dada una nota (en texto, piano o partitura), encontrar sus posiciones en la guitarra; lo mismo con acordes, escalas y progresiones; modo "todas las posiciones" o "la primera que se te ocurra"; estadísticas de aciertos.
2. **Fase 3 — Canción:** importar tabs (Guitar Pro y TuxGuitar; se recomienda alphaTab), reproducción con loop de secciones, selección de fragmentos con análisis de escala o progresión (devolviendo candidatos ordenados, no una única respuesta), tonalidad por compás, vistas de trastes, letra y partitura.
3. **Fase 4 — Audio:** afinador y detección de notas desde la interfaz de audio (viable en navegador). Amp sim y baja latencia solo si se valora una versión de escritorio.

## 10. Instrucciones para el agente de desarrollo

- Empieza por el módulo de teoría musical con sus pruebas, después el estado, después la interfaz.
- Antes de escribir código, propón la estructura de carpetas y confirma el stack.
- Entrega por hitos pequeños y verificables, los hitos y su orden están en [plan_fase1.md](plan_fase1.md), sección 6.
- Cuando haya ambigüedad teórica (enarmonías, acordes con las mismas notas, escalas que encajan), devuelve siempre varios candidatos ordenados y explica el criterio.
- Mantén los catálogos de acordes, escalas y afinaciones en archivos de datos separados.
- Al terminar cada hito, indica cómo ejecutar y probar la aplicación.
