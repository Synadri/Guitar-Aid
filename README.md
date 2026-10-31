# Guitar Aid

**Guitar Aid** es una aplicación web para ordenador (100 % offline, sin backend) que ayuda a comprender, entrenar y memorizar la teoría musical en la guitarra mostrándola sincronizada con un teclado de piano. Combina dos modos de trabajo principales:

- **Modo Sandbox (Explorar):** selección libre de notas en mástil y piano, navegador de acordes con digitaciones adaptadas a cada afinación, explorador de escalas, armonía diatónica y progresiones, sugerencias teóricas razonadas y síntesis Web Audio.
- **Modo Aprender (Entrenar y memorizar):**
  - **Ejercicios (`A1`–`C2`):** práctica intensiva con corrección automática visual y sonora y selección adaptativa de puntos débiles (notas en el mástil, intervalos en una cuerda y entre cuerdas, mapas de intervalos, etiquetado de formas, construcción de acordes y escalas en una cuerda).
  - **Tarjetas (SRS):** memoria a largo plazo con repetición espaciada (variante Anki SM-2), 3 mazos predefinidos (*Principiante*, *Intermedio*, *Avanzado*) y constructor declarativo con los 11 bloques de contenido del catálogo.
  - **Fórmulas:** traductor bidireccional entre nombre (`Acorde` / `Escala` → grados, intervalos, semitonos y regla cromática) y fórmula (`Grados` → coincidencias exactas, rotaciones con otra raíz y acordes/escalas cercanos).
  - **Progreso:** mapa de aciertos del mástil (`0–12` y `0–24`), evolución de las últimas 10 sesiones, métricas globales de tarjetas, intervalos débiles con práctica directa y copia de seguridad completa (exportar e importar en JSON).

## Instalación y ejecución

Requisitos previos: Node.js y `pnpm`.

```bash
# Instalar dependencias
pnpm install

# Servidor de desarrollo (con recarga en caliente)
pnpm dev

# Ejecutar la batería de pruebas
pnpm test

# Compilar para producción (TypeScript + Vite)
pnpm build

# Previsualizar la compilación de producción
pnpm preview
```

Comandos adicionales de calidad y utilidades:

```bash
pnpm lint            # Reglas de ESLint y verificación de arquitectura por capas
pnpm format:check    # Comprobación de formato con Prettier
pnpm voicings:print  # Imprime digitaciones en tablatura ASCII (p. ej. pnpm voicings:print Am7)
```

## Estructura de carpetas (cuatro capas)

El código de `src/` está organizado en cuatro capas con dependencias unidireccionales verificadas por ESLint y tests de arquitectura (`ui → state → learning → theory`), más el servicio de sonido:

```text
src/
├── theory/      # Capa 1 — Teoría musical en TypeScript puro (sin React ni DOM):
│                #   catálogos de acordes, escalas, afinaciones y progresiones, fórmulas
│                #   bidireccionales, detección de acordes, ranking de escalas, sugerencias y voicings.
├── learning/    # Capa 2 — Motor de aprendizaje en TypeScript puro (depende solo de theory):
│                #   generadores deterministas con semilla y correctores de los 9 ejercicios (A1–C2),
│                #   selección adaptativa, resolución de tarjetas (10 sujetos), constructor y SM-2 (SRS).
├── state/       # Capa 3 — Estado de la aplicación con Zustand (depende de theory y learning):
│                #   sandbox, settings, drills (sesión + estadísticas) y decks (mazos + SRS + backup).
├── ui/          # Capa 4 — Interfaz en React 19 + SVG + CSS Modules:
│                #   AppShell, instrumentos puros (Fretboard, Piano), vista Sandbox y vista Aprender
│                #   (Ejercicios, Tarjetas, Fórmulas y Progreso).
└── audio/       # Síntesis Web Audio (pluck) y planificación pura de acordes, intervalos, arpegios y escalas.
```

## Despliegue

### GitHub Pages

Se activa en **Settings → Pages → Source: GitHub Actions**. El flujo de trabajo en `.github/workflows/deploy.yml` se ejecuta automáticamente con cada `push` a `main` y bajo demanda (`workflow_dispatch`), compilando y desplegando la aplicación en GitHub Pages.

### Opción local

Se puede compilar y servir estáticamente en local con:

```bash
pnpm build
npx serve dist
```

## Documentación

- [Requisitos de la Fase 1](docs/Requisitos.md)
- [Plan de implementación de la Fase 1](docs/Fase-1/plan_fase1.md)
- [Plan de la Fase 1.1](docs/Fase-1/plan_fase1_1.md)
- [Especificación de interfaz (Sandbox, Fase 1.1)](docs/interfaz.md)
- [Plan de la Fase 2 (modo Aprender)](docs/Fase-2/plan_fase2.md)
- [Especificación de interfaz (modo Aprender, Fase 2)](docs/Fase-2/interfaz_fase2.md)
- [Registro de decisiones de la Fase 2](docs/Fase-2/decisiones.md)
- [Registro de decisiones de la Fase 1](docs/decisiones.md)
- [Catálogo de digitaciones (voicings)](docs/voicings.md)
