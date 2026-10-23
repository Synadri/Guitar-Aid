import { describe, expect, it } from 'vitest';

describe('esqueleto', () => {
  it('la API pública de theory se puede importar', async () => {
    const theory = await import('./theory');
    expect(theory).toBeDefined();
  });
});
