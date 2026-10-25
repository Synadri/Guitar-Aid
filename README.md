# Guitar Aid

**Guitar Aid** es una aplicación web para ordenador que ayuda a comprender la teoría musical en la guitarra mostrándola sincronizada con un teclado de piano. Permite explorar notas sueltas, acordes (con navegador de digitaciones adaptadas a cada afinación) y escalas, alternar etiquetas entre nombre de nota, intervalo y grado, escuchar la selección con síntesis Web Audio y recibir sugerencias teóricas razonadas.

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

## Estructura de carpetas (tres capas)

El código de `src/` está organizado en tres capas con dependencias unidireccionales verificadas por ESLint y tests de arquitectura (`ui → state → theory`), más el servicio de sonido:

```text
src/
├── theory/      # Capa 1 — Teoría musical en TypeScript puro (sin React ni DOM):
│                #   catálogos de acordes, escalas, afinaciones y progresiones,
│                #   detección de acordes, ranking de escalas, sugerencias y voicings.
├── state/       # Capa 2 — Estado de la aplicación con Zustand (depende solo de theory):
│                #   sandbox (selección en capas y selectores puros) y settings (persistencia).
├── ui/          # Capa 3 — Interfaz en React 19 + SVG + CSS Modules:
│                #   instrumentos puros (Fretboard, Piano), vista Sandbox, selectores y paneles.
└── audio/       # Síntesis Web Audio (pluck) y planificación pura de acordes, arpegios y escalas.
```

## Documentación

- [Requisitos de la Fase 1](docs/Requisitos.md)
- [Plan de implementación de la Fase 1](docs/plan_fase1.md)
- [Registro de decisiones de diseño](docs/decisiones.md)
- [Catálogo de digitaciones (voicings)](docs/voicings.md)
