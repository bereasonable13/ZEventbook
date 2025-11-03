module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2021, sourceType: 'script' },
  plugins: ['html'],
  globals: {
    HtmlService: 'readonly', PropertiesService: 'readonly', SpreadsheetApp: 'readonly',
    UrlFetchApp: 'readonly', Utilities: 'readonly', DriveApp: 'readonly',
    ScriptApp: 'readonly', FormApp: 'readonly', Logger: 'readonly',
    CONFIG: 'readonly', BRANDS: 'readonly', GITHUB: 'readonly', DEFAULT_BRAND: 'readonly',
    doGet: 'writable', include: 'writable', getBrand: 'writable', getAllBrands: 'writable',
    clientCreateEvent: 'writable', clientGetEvents: 'writable', testExportSingleEvent: 'writable',
  },
  rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], 'no-undef': 'error' },
  overrides: [
    { files: ['tests/**/*.js'], env: { jest: true, node: true } },
    { files: ['scripts/**/*.js', 'jest.config.js'], env: { node: true } },
  ],
};
