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
    // Google Apps Script globals
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
    // Apps Script entry points (these look unused but are called by Apps Script)
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
    'no-unused-vars': ['error', {
      // Ignore Apps Script entry points and common utility functions
      varsIgnorePattern: '^(doGet|doPost|onOpen|onEdit|include|clientLog|getLogs|clearLogs|createEvent|getSharedQty|NU_Debug_.*|errorResponse_|successResponse_|checkRateLimit_|.*_)$',
      argsIgnorePattern: '^_'
    }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'no-empty': ['error', { 
      allowEmptyCatch: true  // Allow empty catch blocks (common in Apps Script for error handling)
    }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      // Special rules for Google Apps Script files
      files: ['*.gs', 'src/**/*.gs'],
      rules: {
        'no-unused-vars': ['warn', {  // More lenient for .gs files
          varsIgnorePattern: '^(doGet|doPost|onOpen|onEdit|include|.*_)$',
          argsIgnorePattern: '^_|^e$'  // e is commonly used for event objects
        }],
        'no-empty': 'warn',  // Warnings instead of errors for .gs files
      }
    }
  ]
};
