const noop = () => undefined;

const scriptProperties = {
  getProperty: noop,
  setProperty: noop,
  deleteProperty: noop,
};

global.PropertiesService = {
  getScriptProperties: () => scriptProperties,
};

global.CacheService = {
  getScriptCache: () => ({ get: noop, put: noop, remove: noop }),
  getUserCache: () => ({ get: noop, put: noop, remove: noop }),
};

global.HtmlService = {
  createTemplateFromFile: () => ({ getCode: () => '' }),
  createHtmlOutputFromFile: () => ({
    evaluate: () => ({ getContent: () => '' }),
  }),
};

global.ContentService = {
  createTextOutput: () => ({
    setMimeType: () => ({})
  }),
};

global.Logger = {
  log: noop,
};

global.Session = {
  getActiveUser: () => ({ getEmail: () => 'test@example.com' }),
  getEffectiveUser: () => ({ getEmail: () => 'test@example.com' }),
};

global.UrlFetchApp = {
  fetch: () => ({ getContentText: () => '' }),
};

global.Utilities = {
  formatDate: () => '',
  getUuid: () => 'uuid',
  sleep: noop,
};

global.ScriptApp = {
  getService: () => ({ getUrl: () => '' }),
};

global.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: () => ({
      getRange: () => ({ getValues: () => [] }),
    }),
  }),
};

global.DriveApp = {
  getFolderById: () => ({ createFolder: () => ({}) }),
};
