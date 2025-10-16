module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/tests/**/*.test.[jt]s',
    '**/tests/**/*.spec.[jt]s',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,gs}',
    'verify-deployment.js',
    'scripts/**/*.js',
    '!src/**/__tests__/**',
    '!**/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  moduleFileExtensions: ['js', 'json', 'ts'],
};
