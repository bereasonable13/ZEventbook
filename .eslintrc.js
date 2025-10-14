module.exports = {
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:jest/recommended',
    'prettier'
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y', 'jest'],
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  globals: {
    CacheService: 'readonly',
    SpreadsheetApp: 'readonly',
    PropertiesService: 'readonly',
    ScriptApp: 'readonly',
    Logger: 'readonly',
    Session: 'readonly',
    UrlFetchApp: 'readonly',
    Utilities: 'readonly',
    DriveApp: 'readonly',
    ContentService: 'readonly',
    HtmlService: 'readonly',
    doGet: 'readonly',
    doPost: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-console': 'warn',
    'no-unused-vars': 'warn',      // WARN instead of ERROR
    'prefer-const': 'warn',         // WARN instead of ERROR  
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'no-empty': 'warn',             // WARN instead of ERROR
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
