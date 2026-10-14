// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['playwright-report/**', 'test-results/**', '.auth/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
