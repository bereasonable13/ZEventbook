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
    React: 'readonly',
    jest: 'readonly',
    expect: 'readonly',
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
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
    'no-console': 'off',           // TURN OFF - allow console statements
    'no-unused-vars': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
    'eqeqeq': ['error', 'always'],
    'no-empty': 'warn',
    'no-undef': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
