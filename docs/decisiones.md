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
