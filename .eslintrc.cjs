module.exports = {
  root: true,
  ignorePatterns: ['node_modules', 'dist', 'build'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: 'module'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      files: ['frontend/**/*.{ts,tsx}'],
      env: {
        browser: true,
        es2021: true
      },
      parserOptions: {
        project: './frontend/tsconfig.json'
      },
      rules: {
        'react/react-in-jsx-scope': 'off'
      }
    },
    {
      files: ['backend/**/*.ts'],
      env: {
        node: true,
        es2021: true
      },
      parserOptions: {
        project: './backend/tsconfig.json'
      }
    }
  ]
};
