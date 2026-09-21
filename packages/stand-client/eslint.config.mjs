import tseslint from 'typescript-eslint';

/**
 * Generated output is excluded: it carries a do-not-edit header and is replaced
 * wholesale by `pnpm api:generate`, so linting it would only produce noise a
 * contributor cannot act on.
 */
export default tseslint.config(
  { ignores: ['src/generated/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
);
