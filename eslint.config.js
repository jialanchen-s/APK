const tseslint = require('typescript-eslint');
const js = require('@eslint/js');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  { ignores: ['dist', 'dist-server', 'node_modules', 'client/src/api/gen', '**/*.d.ts', '**/*.js.map'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['client/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
    },
  },
  {
    files: ['server/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      parserOptions: {
        project: './tsconfig.node.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': 'error',
      'prefer-const': 'off',
      'no-empty': 'off',
    },
  },
);
