import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettierConfig from 'eslint-config-prettier';

// Strict ESLint config mirroring the meta-framework canonical spec (AgentIDE's
// eslint.config.mjs — the strictest/most-recent Vite+React19+TS reference).
// Adapted for Tauri: the security-plugin block (Electron main/preload Node.js
// code) and the react-compiler plugin are dropped — this app's backend is Rust
// (src-tauri/, not linted by ESLint) and there is no Node main/preload surface.
// Strict size/complexity/import rules are preserved at the meta values.
export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      'src-tauri/',
      '*.config.*',
    ],
  },

  // ── Base recommended rules ────────────────────────────────────────
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ── All TS/TSX source: React + complexity + import sorting ────────
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // React recommended (flat config requires manual include)
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // New JSX runtime — no React import needed
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      // ── Complexity / size guards (meta canonical values) ──────────
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 10],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',

      // ── Import sorting (deterministic, diff-friendly) ─────────────
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  // ── Relaxed rules for test files ─────────────────────────────────
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },

  // ── Prettier compat — MUST be last to override formatting rules ───
  prettierConfig,
);
