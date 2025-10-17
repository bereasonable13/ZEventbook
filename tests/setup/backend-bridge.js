// Backend Bridge - Loads Code.js for testing

// Mock GAS globals
global.SpreadsheetApp = {
  openById: jest.fn(() => ({
    getSheetByName: jest.fn(() => ({
      appendRow: jest.fn(),
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [[]])
      }))
    }))
  }))
};

global.Session = {
  getActiveUser: jest.fn(() => ({
    getEmail: jest.fn(() => 'test@example.com')
  }))
};

global.Utilities = {
  getUuid: jest.fn(() => 'test-uuid-123')
};

global.Logger = {
  log: jest.fn()
};

global.ContentService = {
  createTextOutput: jest.fn((text) => ({
    setMimeType: jest.fn(),
    setText: jest.fn()
  }))
};

// Load your Code.js
const backend = require('../../Code.js');

module.exports = {
  ...backend,
  __mocks: {
    SpreadsheetApp: global.SpreadsheetApp,
    Session: global.Session,
    Utilities: global.Utilities,
    Logger: global.Logger,
    ContentService: global.ContentService
  }
};
