import js from '@eslint/js';
import ts from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      '*.config.js',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: ts.parser,
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  eslintConfigPrettier
);
