import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const reactRecommended = reactPlugin.configs.flat.recommended;

const frontendReactConfig = {
  ...reactRecommended,
  name: 'frontend-react',
  files: ['frontend/**/*.{ts,tsx}'],
  languageOptions: {
    ...(reactRecommended.languageOptions ?? {}),
    parser: tseslint.parser,
    ecmaVersion: 2023,
    sourceType: 'module',
    globals: {
      ...globals.browser,
    },
    parserOptions: {
      ...(reactRecommended.languageOptions?.parserOptions ?? {}),
      project: ['./frontend/tsconfig.json', './frontend/tsconfig.node.json'],
      projectService: true,
      tsconfigRootDir: __dirname,
    },
  },
  plugins: {
    ...(reactRecommended.plugins ?? {}),
    'react-hooks': reactHooksPlugin,
  },
  rules: {
    ...(reactRecommended.rules ?? {}),
    ...reactHooksPlugin.configs.recommended.rules,
    'react/react-in-jsx-scope': 'off',
  },
  settings: {
    ...(reactRecommended.settings ?? {}),
    react: {
      version: 'detect',
    },
  },
};

const backendNodeConfig = {
  name: 'backend-node',
  files: ['backend/**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2023,
    sourceType: 'module',
    globals: {
      ...globals.node,
    },
    parserOptions: {
      project: ['./backend/tsconfig.json'],
      projectService: true,
      tsconfigRootDir: __dirname,
    },
  },
};

export default tseslint.config(
  {
    name: 'ignores',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      'backend/vitest.config.ts',
      'coverage',
      'frontend/playwright.config.ts',
      'frontend/tests/**',
      'frontend/src/__tests__/**',
      'frontend/vite.config.ts',
      'frontend/vitest.config.ts',
      'frontend/vitest.setup.ts',
      'my-project/**',
      'tmp',
    ],
  },
  {
    name: 'base-language-options',
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  frontendReactConfig,
  backendNodeConfig,
  eslintConfigPrettier,
);
