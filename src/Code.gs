/************************************************************
* NextUp v4.3.0 — Code.gs (Production Ready + Zero-Config Bootstrap)
* 
* MAJOR CHANGE: Removed all hardcoded IDs
* System now auto-creates and auto-discovers all resources
* 
* Features:
* - Self-healing control spreadsheet
* - Auto-creating template and folders
* - Rate limiting with exponential backoff
* - Idempotent eventbook creation
* - Enhanced shortlinks with analytics
* - Verified QR generation
* - Mobile-first API design
************************************************************/

// [S01] Configuration Constants - ZERO HARDCODED IDS
const BUILD_ID = 'nextup-v4.3.0-bootstrap';
const CONTROL_TITLE = 'NextUp - Control';
const TEMPLATE_TITLE = 'NextUp - Event Template';
const EVENTS_FOLDER_NAME = 'NextUp Events';

const CFG_KEYS = {
  CONTROL_ID: 'NU_CONTROL_SSID',
  TEMPLATE_ID: 'NU_TEMPLATE_SSID',
  EVENTS_DIR: 'NU_EVENTS_FOLDERID',
  ORG_URL: 'NU_ORG_BASE_URL',
  PUB_URL: 'NU_PUBLIC_BASE_URL'
};

const PROP = {
  EVENTS_ETAG: 'NU_EVENTS_ETAG',
  SHORTLINKS_MAP: 'NU_SHORTLINKS_MAP_V2',
  SHORTLINKS_TARGETS: 'NU_SHORTLINKS_TARGETS_V2',
  SHORTLINKS_METADATA: 'NU_SHORTLINKS_METADATA_V1',
  SHORTLINKS_ANALYTICS: 'NU_SHORTLINKS_ANALYTICS_V1'
};

/************************************************************
* [S02] Rate Limiting System
************************************************************/

/**
 * Standardized error response builder
 */
function errorResponse_(code, message, context = {}) {
  const response = {
    success: false,
    error: message,
    code: code,
    retryable: [429, 503, 504].includes(code),
    timestamp: new Date().toISOString()
  };
  
  if (code === 429 && context.retryAfter) {
    response.retryAfter = context.retryAfter;
  }
  
  if (Object.keys(context).length > 0) {
    response.context = context;
  }
  
  return response;
}

/**
 * Standardized success response builder
 */
function successResponse_(data, metadata = {}) {
  return {
    success: true,
    ...data,
    ...metadata,
    timestamp: new Date().toISOString()
  };
}

const RATE_LIMITS = {
  create: { windowMs: 60000, maxRequests: 10 },
  read: { windowMs: 60000, maxRequests: 100 },
  write: { windowMs: 60000, maxRequests: 50 },
  default: { windowMs: 60000, maxRequests: 60 }
};

function checkRateLimit_(operation) {
  const cache = CacheService.getScriptCache();
  const userEmail = Session.getEffectiveUser().getEmail() || 'anonymous';
  const key = `ratelimit_${operation}_${userEmail}`;
  
  const limit = RATE_LIMITS[operation] || RATE_LIMITS.default;
  const now = Date.now();
  
  const data = cache.get(key);
  let requests = [];
  
  if (data) {
    try {
      requests = JSON.parse(data);
      requests = requests.filter(t => now - t < limit.windowMs);
    } catch (e) {
      requests = [];
    }
  }
  
  if (requests.length >= limit.maxRequests) {
    const oldestRequest = Math.min(...requests);
    const retryAfter = Math.ceil((limit.windowMs - (now - oldestRequest)) / 1000);
    return {
      ok: false,
      error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter: retryAfter,
      code: 429
    };
  }
  
  requests.push(now);
  cache.put(key, JSON.stringify(requests), Math.ceil(limit.windowMs / 1000));
  
  return { ok: true };
}

/************************************************************
* [S03] Client Logging System
************************************************************/
function clientLog(entry) {
  try {
    const e = entry || {};
    const level = String(e.level || 'info');
    const where = 'client:' + String(e.where || 'unknown');
    const msg = String(e.msg || '');
    let ts = Number(e.ts);
    if (!isFinite(ts)) ts = Date.now();
    const data = (e.data && typeof e.data === 'object') ? JSON.stringify(e.data) : String(e.data || '');
    
    console.log(`[${level.toUpperCase()}] ${where} - ${msg} ${data}`);
    
    const ss = getControlSafe_();
    if (!ss) return { ok: true };
    
    let logsSheet = ss.getSheetByName('Logs');
    if (!logsSheet) {
      logsSheet = ss.insertSheet('Logs');
      logsSheet.appendRow(['Timestamp', 'Level', 'Where', 'Message', 'Data']);
      logsSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    
    if (logsSheet.getLastRow() > 1000) {
      logsSheet.deleteRows(2, 100);
    }
    
    logsSheet.appendRow([
      new Date(ts),
      level,
      where,
      msg,
      data
    ]);
    
    return { ok: true };
  } catch (err) {
    console.error('clientLog failed:', err);
    return { ok: false, error: err.message };
  }
}

function getLogs(limit) {
  const rl = checkRateLimit_('read');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  const ss = getControlSafe_();
  if (!ss) return { logs: [] };
  
  const logsSheet = ss.getSheetByName('Logs');
  if (!logsSheet) return { logs: [] };
  
  const maxRows = Math.min(limit || 100, logsSheet.getLastRow() - 1);
  if (maxRows <= 0) return { logs: [] };
  
  const data = logsSheet.getRange(2, 1, maxRows, 5).getValues();
  const logs = data.map(row => ({
    timestamp: row[0],
    level: row[1],
    where: row[2],
    message: row[3],
    data: row[4]
  })).reverse();
  
  return { logs };
}

function clearLogs() {
  const rl = checkRateLimit_('write');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  const ss = getControlSafe_();
  if (!ss) return { ok: false, error: 'Control spreadsheet not available' };
  
  const logsSheet = ss.getSheetByName('Logs');
  if (logsSheet && logsSheet.getLastRow() > 1) {
    logsSheet.deleteRows(2, logsSheet.getLastRow() - 1);
  }
  
  return { ok: true };
}

/************************************************************
* [S04] Script Properties Helpers
************************************************************/
function cfgGet_(key, fallback) {
  try {
    const val = PropertiesService.getScriptProperties().getProperty(key);
    return val || fallback || null;
  } catch (err) {
    console.error('cfgGet_ error:', err);
    return fallback || null;
  }
}

function cfgSet_(key, value) {
  try {
    PropertiesService.getScriptProperties().setProperty(key, String(value));
    return true;
  } catch (err) {
    console.error('cfgSet_ error:', err);
    return false;
  }
}

function cfgOrgUrl_() {
  return cfgGet_(CFG_KEYS.ORG_URL) || ScriptApp.getService().getUrl();
}

function cfgPubUrl_() {
  return cfgGet_(CFG_KEYS.PUB_URL) || ScriptApp.getService().getUrl();
}

/************************************************************
* [S05] ZERO-CONFIG BOOTSTRAP SYSTEM
************************************************************/

/**
 * Bootstrap the entire system on first run
 * Auto-creates all missing resources
 */
function ensureControlStrictOnBoot() {
  console.log('[Bootstrap] Starting system initialization...');
  
  const ss = ensureControlSpreadsheet_();
  ensureEventsSheet_(ss);
  ensureTemplateSpreadsheet_();
  ensureEventsFolder_();
  ensureBaseUrls_();
  
  console.log('[Bootstrap] System ready!');
  return ss;
}

/**
 * Ensure control spreadsheet exists (auto-create if missing)
 */
function ensureControlSpreadsheet_() {
  let ssId = cfgGet_(CFG_KEYS.CONTROL_ID);
  let ss = null;
  
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
      if (ss.getName() !== CONTROL_TITLE) {
        ss.rename(CONTROL_TITLE);
      }
      console.log('[Bootstrap] ✓ Control spreadsheet found:', ssId);
      return ss;
    } catch (err) {
      console.warn('[Bootstrap] Control ID invalid, will search/create');
      ss = null;
    }
  }
  
  if (!ss) {
    console.log('[Bootstrap] Searching for existing control spreadsheet...');
    const files = DriveApp.getFilesByName(CONTROL_TITLE);
    if (files.hasNext()) {
      const file = files.next();
      ss = SpreadsheetApp.openById(file.getId());
      ssId = file.getId();
      cfgSet_(CFG_KEYS.CONTROL_ID, ssId);
      console.log('[Bootstrap] ✓ Found existing control spreadsheet:', ssId);
      return ss;
    }
  }
  
  if (!ss) {
    console.log('[Bootstrap] Creating new control spreadsheet...');
    ss = SpreadsheetApp.create(CONTROL_TITLE);
    ssId = ss.getId();
    cfgSet_(CFG_KEYS.CONTROL_ID, ssId);
    console.log('[Bootstrap] ✓ Created control spreadsheet:', ssId);
  }
  
  return ss;
}

/**
 * Ensure Events sheet exists in control spreadsheet
 */
function ensureEventsSheet_(ss) {
  let eventsSheet = ss.getSheetByName('Events');
  
  if (!eventsSheet) {
    console.log('[Bootstrap] Creating Events sheet...');
    eventsSheet = ss.insertSheet('Events');
    eventsSheet.appendRow([
      'id', 'name', 'slug', 'startDateISO', 'ssId', 'ssUrl',
      'formId', 'tag', 'isDefault', 'seedMode', 'elimType'
    ]);
    eventsSheet.getRange(1, 1, 1, 11).setFontWeight('bold');
    console.log('[Bootstrap] ✓ Created Events sheet');
  }
  
  return eventsSheet;
}

/**
 * Ensure template spreadsheet exists (auto-create if missing)
 */
function ensureTemplateSpreadsheet_() {
  let templateId = cfgGet_(CFG_KEYS.TEMPLATE_ID);
  
  if (templateId) {
    try {
      const template = SpreadsheetApp.openById(templateId);
      console.log('[Bootstrap] ✓ Template found:', templateId);
      return templateId;
    } catch (err) {
      console.warn('[Bootstrap] Template ID invalid, will search/create');
      templateId = null;
    }
  }
  
  if (!templateId) {
    console.log('[Bootstrap] Searching for existing template...');
    const files = DriveApp.getFilesByName(TEMPLATE_TITLE);
    if (files.hasNext()) {
      const file = files.next();
      templateId = file.getId();
      cfgSet_(CFG_KEYS.TEMPLATE_ID, templateId);
      console.log('[Bootstrap] ✓ Found existing template:', templateId);
      return templateId;
    }
  }
  
  if (!templateId) {
    console.log('[Bootstrap] Creating new template spreadsheet...');
    const template = SpreadsheetApp.create(TEMPLATE_TITLE);
    templateId = template.getId();
    
    const sheets = ['Home', 'Meta', 'SignupsView', 'Schedule', 'Standings', 'PosterConfig'];
    sheets.forEach(sheetName => {
      if (!template.getSheetByName(sheetName)) {
        template.insertSheet(sheetName);
      }
    });
    
    const sheet1 = template.getSheetByName('Sheet1');
    if (sheet1) {
      template.deleteSheet(sheet1);
    }
    
    cfgSet_(CFG_KEYS.TEMPLATE_ID, templateId);
    console.log('[Bootstrap] ✓ Created template:', templateId);
  }
  
  return templateId;
}

/**
 * Ensure events folder exists (auto-create if missing)
 */
function ensureEventsFolder_() {
  let folderId = cfgGet_(CFG_KEYS.EVENTS_DIR);
  
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      console.log('[Bootstrap] ✓ Events folder found:', folderId);
      return folderId;
    } catch (err) {
      console.warn('[Bootstrap] Folder ID invalid, will search/create');
      folderId = null;
    }
  }
  
  if (!folderId) {
    console.log('[Bootstrap] Searching for existing events folder...');
    const folders = DriveApp.getFoldersByName(EVENTS_FOLDER_NAME);
    if (folders.hasNext()) {
      const folder = folders.next();
      folderId = folder.getId();
      cfgSet_(CFG_KEYS.EVENTS_DIR, folderId);
      console.log('[Bootstrap] ✓ Found existing folder:', folderId);
      return folderId;
    }
  }
  
  if (!folderId) {
    console.log('[Bootstrap] Creating new events folder...');
    const folder = DriveApp.createFolder(EVENTS_FOLDER_NAME);
    folderId = folder.getId();
    cfgSet_(CFG_KEYS.EVENTS_DIR, folderId);
    console.log('[Bootstrap] ✓ Created folder:', folderId);
  }
  
  return folderId;
}

/**
 * Ensure base URLs are configured
 */
function ensureBaseUrls_() {
  const currentUrl = ScriptApp.getService().getUrl();
  
  if (!cfgGet_(CFG_KEYS.ORG_URL)) {
    cfgSet_(CFG_KEYS.ORG_URL, currentUrl);
    console.log('[Bootstrap] ✓ Set ORG_URL:', currentUrl);
  }
  
  if (!cfgGet_(CFG_KEYS.PUB_URL)) {
    cfgSet_(CFG_KEYS.PUB_URL, currentUrl);
    console.log('[Bootstrap] ✓ Set PUB_URL:', currentUrl);
  }
}

/**
 * Get control spreadsheet (uses cached ID with auto-bootstrap)
 */
function getControlSafe_() {
  const ssId = cfgGet_(CFG_KEYS.CONTROL_ID);
  if (!ssId) {
    console.warn('[Bootstrap] Control ID not set, bootstrapping...');
    ensureControlStrictOnBoot();
    return getControlSafe_();
  }
  
  try {
    return SpreadsheetApp.openById(ssId);
  } catch (err) {
    console.error('[Bootstrap] Failed to open control, re-bootstrapping:', err);
    cfgSet_(CFG_KEYS.CONTROL_ID, '');
    ensureControlStrictOnBoot();
    return getControlSafe_();
  }
}

/************************************************************
* [S06] Model Constants & Router
************************************************************/
const EVENTS_SHEET = 'Events';
const IDX = {
  id: 0,
  name: 1,
  slug: 2,
  startDateISO: 3,
  ssId: 4,
  ssUrl: 5,
  formId: 6,
  tag: 7,
  isDefault: 8,
  seedMode: 9,
  elimType: 10
};

const TABS = {
  HOME: 'Home',
  META: 'Meta',
  SIGNUPS: 'SignupsView',
  SCHEDULE: 'Schedule',
  STANDINGS: 'Standings',
  POSTER: 'PosterConfig'
};

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function doGet(e) {
  ensureControlStrictOnBoot();
  
  const p = (e && e.parameter) || {};
  const raw = (p.page || p.p || 'Admin');
  const key = String(raw).trim().toLowerCase();
  
  if (key === 'r' || key === 'redirect') {
    const token = (p.t || p.token || '').toString();
    const context = {
      userAgent: p.ua || '',
      referrer: p.ref || '',
      ip: p.ip || ''
    };
    const target = Shortlinks.resolve(token, context) || cfgPubUrl_();
    return redirectTo_(target);
  }
  
  if (key === 'ping') {
    return ContentService.createTextOutput(JSON.stringify(ping()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const PAGE = {
    admin: 'Admin',
    public: 'Public',
    display: 'Display',
    poster: 'Poster',
    test: 'Test',
    health: 'HealthCheck'
  };
  
  const page = PAGE[key] || 'Admin';
  const tpl = HtmlService.createTemplateFromFile(page);
  tpl.appTitle = 'NextUp';
  tpl.BUILD_ID = BUILD_ID;
  
  return tpl.evaluate()
    .setTitle('NextUp · ' + page)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function redirectTo_(url) {
  return HtmlService.createHtmlOutput(
    `<script>window.top.location.href="${url}";</script>`
  );
}

function ping() {
  return {
    ok: true,
    build: BUILD_ID,
    timestamp: new Date().toISOString()
  };
}

/************************************************************
* [S07] Events API - SWR with ETag
************************************************************/
function getEventsSafe(clientEtag) {
  const rl = checkRateLimit_('read');
  if (!rl.ok) return { error: rl.error, code: rl.code, retryAfter: rl.retryAfter };
  
  const ss = getControlSafe_();
  if (!ss) {
    return { error: 'System initializing - please refresh the page in a few seconds', events: [], isBootstrapping: true };
  }
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) {
    return { error: 'Events sheet not found', events: [] };
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    const serverEtag = 'empty-' + Date.now();
    PropertiesService.getScriptProperties().setProperty(PROP.EVENTS_ETAG, serverEtag);
    return { events: [], etag: serverEtag };
  }
  
  const serverEtag = PropertiesService.getScriptProperties().getProperty(PROP.EVENTS_ETAG) || 
                     'etag-' + Date.now();
  
  if (clientEtag && clientEtag === serverEtag) {
    return { notModified: true, etag: serverEtag };
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const events = data.map(row => ({
    id: row[IDX.id],
    name: row[IDX.name],
    slug: row[IDX.slug],
    startDateISO: row[IDX.startDateISO],
    ssId: row[IDX.ssId],
    ssUrl: row[IDX.ssUrl],
    formId: row[IDX.formId],
    tag: row[IDX.tag],
    isDefault: row[IDX.isDefault] === true || row[IDX.isDefault] === 'TRUE',
    seedMode: row[IDX.seedMode],
    elimType: row[IDX.elimType]
  }));
  
  return { events, etag: serverEtag };
}

function bumpEventsEtag_() {
  const newEtag = 'etag-' + Date.now() + '-' + Math.random().toString(36).substring(7);
  PropertiesService.getScriptProperties().setProperty(PROP.EVENTS_ETAG, newEtag);
  return newEtag;
}

/************************************************************
* [S08] Create Eventbook (WITH ZERO-CONFIG BOOTSTRAP)
************************************************************/
function createEventbook(name, startDateISO) {
  const rl = checkRateLimit_('create');
  if (!rl.ok) return { error: rl.error, code: rl.code, retryAfter: rl.retryAfter };
  
  if (!name || !startDateISO) {
    return { error: 'Name and start date required' };
  }
  
  ensureControlStrictOnBoot();
  
  const ss = getControlSafe_();
  if (!ss) {
    return { error: 'Control spreadsheet not available' };
  }
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) {
    return { error: 'Events sheet not found' };
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
    for (let row of existing) {
      if (row[IDX.name] === name) {
        return {
          event: {
            id: row[IDX.id],
            name: row[IDX.name],
            slug: row[IDX.slug],
            startDateISO: row[IDX.startDateISO],
            ssId: row[IDX.ssId],
            ssUrl: row[IDX.ssUrl],
            formId: row[IDX.formId],
            tag: row[IDX.tag],
            isDefault: row[IDX.isDefault],
            seedMode: row[IDX.seedMode],
            elimType: row[IDX.elimType]
          },
          existed: true
        };
      }
    }
  }
  
  const id = Utilities.getUuid();
  const slug = slugify_(name);
  
  const templateId = ensureTemplateSpreadsheet_();
  const folderId = ensureEventsFolder_();
  
  let newSs;
  try {
    const templateFile = DriveApp.getFileById(templateId);
    const folder = DriveApp.getFolderById(folderId);
    const copiedFile = templateFile.makeCopy(name, folder);
    newSs = SpreadsheetApp.openById(copiedFile.getId());
    console.log('[CreateEvent] ✓ Copied template for:', name);
  } catch (err) {
    console.error('[CreateEvent] Template copy failed:', err);
    return { error: 'Failed to copy template: ' + err.message };
  }
  
  const ssId = newSs.getId();
  const ssUrl = newSs.getUrl();
  
  const publicKey = `event-${id}-public`;
  const publicUrl = `${cfgPubUrl_()}?page=public&eventId=${id}`;
  Shortlinks.set(publicKey, publicUrl, {
    eventId: id,
    type: 'public-page',
    description: `Public page for ${name}`
  });
  
  sheet.appendRow([
    id,
    name,
    slug,
    startDateISO,
    ssId,
    ssUrl,
    '',
    '',
    false,
    'auto',
    'single'
  ]);
  
  bumpEventsEtag_();
  
  console.log('[CreateEvent] ✓ Created event:', id);
  
  return {
    event: {
      id,
      name,
      slug,
      startDateISO,
      ssId,
      ssUrl,
      formId: '',
      tag: '',
      isDefault: false,
      seedMode: 'auto',
      elimType: 'single'
    }
  };
}

function slugify_(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/************************************************************
* [S09] Event Management
************************************************************/
function setDefaultEvent(eventId) {
  const rl = checkRateLimit_('write');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  const ss = getControlSafe_();
  if (!ss) return { error: 'Control not available' };
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return { error: 'Events sheet not found' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'No events found' };
  
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  
  for (let i = 0; i < data.length; i++) {
    const isThisOne = data[i][IDX.id] === eventId;
    sheet.getRange(i + 2, IDX.isDefault + 1).setValue(isThisOne);
  }
  
  bumpEventsEtag_();
  return { ok: true };
}

function archiveEvent(eventId) {
  const rl = checkRateLimit_('write');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  const ss = getControlSafe_();
  if (!ss) return { error: 'Control not available' };
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return { error: 'Events sheet not found' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'No events found' };
  
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][IDX.id] === eventId) {
      sheet.deleteRow(i + 2);
      bumpEventsEtag_();
      
      Shortlinks.expireByEvent(eventId);
      
      return { ok: true };
    }
  }
  
  return { error: 'Event not found' };
}

/************************************************************
* [S10] Shortlinks System
************************************************************/
const Shortlinks = {
  set: function(key, targetUrl, metadata) {
    const props = PropertiesService.getScriptProperties();
    
    let mapData = {};
    try {
      const mapJson = props.getProperty(PROP.SHORTLINKS_MAP);
      if (mapJson) mapData = JSON.parse(mapJson);
    } catch (err) {
      console.error('Error parsing shortlinks map:', err);
    }
    
    let token = mapData[key];
    if (!token) {
      token = this._generateToken();
      mapData[key] = token;
      props.setProperty(PROP.SHORTLINKS_MAP, JSON.stringify(mapData));
    }
    
    let targetsData = {};
    try {
      const targetsJson = props.getProperty(PROP.SHORTLINKS_TARGETS);
      if (targetsJson) targetsData = JSON.parse(targetsJson);
    } catch (err) {
      console.error('Error parsing shortlinks targets:', err);
    }
    
    targetsData[token] = targetUrl;
    props.setProperty(PROP.SHORTLINKS_TARGETS, JSON.stringify(targetsData));
    
    if (metadata) {
      let metaData = {};
      try {
        const metaJson = props.getProperty(PROP.SHORTLINKS_METADATA);
        if (metaJson) metaData = JSON.parse(metaJson);
      } catch (err) {
        console.error('Error parsing shortlinks metadata:', err);
      }
      
      metaData[token] = {
        ...metadata,
        createdAt: new Date().toISOString(),
        active: true,
        key: key
      };
      props.setProperty(PROP.SHORTLINKS_METADATA, JSON.stringify(metaData));
    }
    
    return token;
  },
  
  resolve: function(token, context) {
    if (!token) return null;
    
    const props = PropertiesService.getScriptProperties();
    
    let targetsData = {};
    try {
      const targetsJson = props.getProperty(PROP.SHORTLINKS_TARGETS);
      if (targetsJson) targetsData = JSON.parse(targetsJson);
    } catch (err) {
      console.error('Error parsing shortlinks targets:', err);
      return null;
    }
    
    const targetUrl = targetsData[token];
    if (!targetUrl) return null;
    
    let metaData = {};
    try {
      const metaJson = props.getProperty(PROP.SHORTLINKS_METADATA);
      if (metaJson) metaData = JSON.parse(metaJson);
    } catch (err) {
      console.error('Error parsing shortlinks metadata:', err);
    }
    
    const meta = metaData[token];
    if (meta && !meta.active) return null;
    
    this._trackClick(token, context);
    
    return targetUrl;
  },
  
  getByKey: function(key) {
    const props = PropertiesService.getScriptProperties();
    
    let mapData = {};
    try {
      const mapJson = props.getProperty(PROP.SHORTLINKS_MAP);
      if (mapJson) mapData = JSON.parse(mapJson);
    } catch (err) {
      return null;
    }
    
    const token = mapData[key];
    if (!token) return null;
    
    let targetsData = {};
    try {
      const targetsJson = props.getProperty(PROP.SHORTLINKS_TARGETS);
      if (targetsJson) targetsData = JSON.parse(targetsJson);
    } catch (err) {
      return null;
    }
    
    return {
      token: token,
      url: targetsData[token],
      shortUrl: `${cfgPubUrl_()}?page=r&t=${token}`
    };
  },
  
  verify: function(token) {
    if (!token) return false;
    
    const props = PropertiesService.getScriptProperties();
    
    let targetsData = {};
    try {
      const targetsJson = props.getProperty(PROP.SHORTLINKS_TARGETS);
      if (targetsJson) targetsData = JSON.parse(targetsJson);
    } catch (err) {
      return false;
    }
    
    if (!targetsData[token]) return false;
    
    let metaData = {};
    try {
      const metaJson = props.getProperty(PROP.SHORTLINKS_METADATA);
      if (metaJson) metaData = JSON.parse(metaJson);
    } catch (err) {
      return true;
    }
    
    const meta = metaData[token];
    return !meta || meta.active !== false;
  },
  
  expireByEvent: function(eventId) {
    const props = PropertiesService.getScriptProperties();
    
    let metaData = {};
    try {
      const metaJson = props.getProperty(PROP.SHORTLINKS_METADATA);
      if (metaJson) metaData = JSON.parse(metaJson);
    } catch (err) {
      return;
    }
    
    let changed = false;
    for (let token in metaData) {
      if (metaData[token].eventId === eventId) {
        metaData[token].active = false;
        changed = true;
      }
    }
    
    if (changed) {
      props.setProperty(PROP.SHORTLINKS_METADATA, JSON.stringify(metaData));
    }
  },
  
  _generateToken: function() {
    const uuid = Utilities.getUuid().replace(/-/g, '');
    return Utilities.base64Encode(uuid).substring(0, 12).replace(/[+/=]/g, '');
  },
  
  _trackClick: function(token, context) {
    const props = PropertiesService.getScriptProperties();
    
    let analyticsData = {};
    try {
      const analyticsJson = props.getProperty(PROP.SHORTLINKS_ANALYTICS);
      if (analyticsJson) analyticsData = JSON.parse(analyticsJson);
    } catch (err) {
      console.error('Error parsing analytics:', err);
    }
    
    if (!analyticsData[token]) {
      analyticsData[token] = [];
    }
    
    const clickEvent = {
      timestamp: new Date().toISOString(),
      userAgent: context?.userAgent || '',
      referrer: context?.referrer || '',
      ip: context?.ip || ''
    };
    
    analyticsData[token].push(clickEvent);
    
    if (analyticsData[token].length > 1000) {
      analyticsData[token] = analyticsData[token].slice(-1000);
    }
    
    try {
      props.setProperty(PROP.SHORTLINKS_ANALYTICS, JSON.stringify(analyticsData));
    } catch (err) {
      console.error('Error saving analytics:', err);
    }
  }
};

/************************************************************
* [S11] QR Code Generation
************************************************************/
function getShareQrVerified(eventId) {
  const rl = checkRateLimit_('read');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  if (!eventId) {
    return { error: 'Event ID required' };
  }
  
  const publicKey = `event-${eventId}-public`;
  const shortlinkData = Shortlinks.getByKey(publicKey);
  
  if (!shortlinkData) {
    return {
      status: 'VERIFYING',
      message: 'Shortlink not yet created'
    };
  }
  
  const isActive = Shortlinks.verify(shortlinkData.token);
  if (!isActive) {
    return {
      status: 'EXPIRED',
      message: 'Shortlink has expired'
    };
  }
  
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(shortlinkData.shortUrl)}&size=300`;
  
  return {
    status: 'READY',
    qrCodeUrl: qrUrl,
    shortUrl: shortlinkData.shortUrl,
    targetUrl: shortlinkData.url
  };
}

function repairShortlinks(eventId) {
  const rl = checkRateLimit_('write');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  if (!eventId) {
    return { error: 'Event ID required' };
  }
  
  const ss = getControlSafe_();
  if (!ss) return { error: 'Control not available' };
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return { error: 'Events sheet not found' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'No events found' };
  
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][IDX.id] === eventId) {
      const name = data[i][IDX.name];
      const publicKey = `event-${eventId}-public`;
      const publicUrl = `${cfgPubUrl_()}?page=public&eventId=${eventId}`;
      
      Shortlinks.set(publicKey, publicUrl, {
        eventId: eventId,
        type: 'public-page',
        description: `Public page for ${name}`
      });
      
      return { ok: true };
    }
  }
  
  return { error: 'Event not found' };
}

function repairAllShortlinks() {
  const rl = checkRateLimit_('write');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  const ss = getControlSafe_();
  if (!ss) return { error: 'Control not available' };
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return { error: 'Events sheet not found' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { count: 0 };
  
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  let count = 0;
  
  for (let i = 0; i < data.length; i++) {
    const eventId = data[i][IDX.id];
    const name = data[i][IDX.name];
    const publicKey = `event-${eventId}-public`;
    const publicUrl = `${cfgPubUrl_()}?page=public&eventId=${eventId}`;
    
    Shortlinks.set(publicKey, publicUrl, {
      eventId: eventId,
      type: 'public-page',
      description: `Public page for ${name}`
    });
    
    count++;
  }
  
  return { ok: true, count: count };
}

/************************************************************
* [S12] Public Data Endpoints
************************************************************/
function getPublicBundle(eventId) {
  const rl = checkRateLimit_('read');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  if (!eventId) {
    return { error: 'Event ID required' };
  }
  
  const ss = getControlSafe_();
  if (!ss) return { error: 'Control not available' };
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return { error: 'Events sheet not found' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'No events found' };
  
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][IDX.id] === eventId) {
      return {
        event: {
          id: data[i][IDX.id],
          name: data[i][IDX.name],
          startDateISO: data[i][IDX.startDateISO],
          tag: data[i][IDX.tag]
        }
      };
    }
  }
  
  return { error: 'Event not found' };
}

function getEventQuickLinks(eventId) {
  const rl = checkRateLimit_('read');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  if (!eventId) {
    return { error: 'Event ID required' };
  }
  
  const ss = getControlSafe_();
  if (!ss) return { error: 'Control not available' };
  
  const sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return { error: 'Events sheet not found' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'No events found' };
  
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][IDX.id] === eventId) {
      const formId = data[i][IDX.formId];
      return {
        links: {
          signupUrl: formId ? `https://docs.google.com/forms/d/${formId}/viewform` : ''
        }
      };
    }
  }
  
  return { error: 'Event not found' };
}

/************************************************************
* [S13] Diagnostic Endpoints
************************************************************/
function smokeTest() {
  const rl = checkRateLimit_('read');
  if (!rl.ok) return { error: rl.error, code: rl.code };
  
  const results = [];
  
  try {
    const ss = getControlSafe_();
    results.push({
      test: 'Control Spreadsheet',
      status: ss ? 'PASS' : 'FAIL',
      message: ss ? `Found: ${ss.getName()}` : 'Not found'
    });
  } catch (err) {
    results.push({
      test: 'Control Spreadsheet',
      status: 'FAIL',
      message: err.message
    });
  }
  
  try {
    const ss = getControlSafe_();
    const sheet = ss ? ss.getSheetByName(EVENTS_SHEET) : null;
    results.push({
      test: 'Events Sheet',
      status: sheet ? 'PASS' : 'FAIL',
      message: sheet ? `Found with ${sheet.getLastRow() - 1} events` : 'Not found'
    });
  } catch (err) {
    results.push({
      test: 'Events Sheet',
      status: 'FAIL',
      message: err.message
    });
  }
  
  try {
    const controlId = cfgGet_(CFG_KEYS.CONTROL_ID);
    results.push({
      test: 'Script Properties',
      status: controlId ? 'PASS' : 'WARN',
      message: controlId ? 'Configured' : 'Not configured'
    });
  } catch (err) {
    results.push({
      test: 'Script Properties',
      status: 'FAIL',
      message: err.message
    });
  }
  
  try {
    const props = PropertiesService.getScriptProperties();
    const mapJson = props.getProperty(PROP.SHORTLINKS_MAP);
    const mapData = mapJson ? JSON.parse(mapJson) : {};
    const count = Object.keys(mapData).length;
    results.push({
      test: 'Shortlinks',
      status: 'PASS',
      message: `${count} shortlinks configured`
    });
  } catch (err) {
    results.push({
      test: 'Shortlinks',
      status: 'FAIL',
      message: err.message
    });
  }
  
  return { results };
}

/************************************************************
* [S17] Contract Testing Framework
************************************************************/
function runContractTests() {
  const rl = checkRateLimit_('read');
  if (!rl.ok) {
    return {
      code: 429,
      retryAfter: rl.retryAfter,
      error: 'Rate limit exceeded. Please wait before running tests.'
    };
  }
  
  const results = [];
  const startTime = Date.now();
  
  results.push(testGetEventsSafeContract());
  results.push(testCreateEventbookContract());
  results.push(testGetShareQrVerifiedContract());
  results.push(testGetPublicBundleContract());
  results.push(testShortlinksSetContract());
  results.push(testShortlinksResolveContract());
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = Date.now() - startTime;
  
  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    }
  };
}

function testGetEventsSafeContract() {
  const start = Date.now();
  const contractName = 'getEventsSafe';
  
  try {
    const result = getEventsSafe(null);
    const errors = [];
    
    if (!result.events && !result.notModified) {
      errors.push('Missing events array or notModified flag');
    }
    
    if (result.events) {
      if (!Array.isArray(result.events)) {
        errors.push('events must be an array');
      } else if (result.events.length > 0) {
        const event = result.events[0];
        const required = ['id', 'name', 'slug', 'startDateISO', 'ssId', 'ssUrl'];
        required.forEach(field => {
          if (!(field in event)) {
            errors.push(`Event missing required field: ${field}`);
          }
        });
        
        if (event.id && typeof event.id !== 'string') {
          errors.push('id must be string');
        }
        if (event.name && typeof event.name !== 'string') {
          errors.push('name must be string');
        }
        if (event.ssUrl && !event.ssUrl.startsWith('https://')) {
          errors.push('ssUrl must be valid HTTPS URL');
        }
      }
    }
    
    if (!result.etag) {
      errors.push('Missing etag');
    } else if (typeof result.etag !== 'string') {
      errors.push('etag must be string');
    }
    
    if (result.code === 429) {
      if (!result.retryAfter) {
        errors.push('Rate limited response missing retryAfter');
      }
    }
    
    return {
      contract: contractName,
      passed: errors.length === 0,
      message: errors.length === 0 
        ? `✓ Valid response with ${result.events ? result.events.length : 0} events`
        : '✗ ' + errors.join('; '),
      duration: Date.now() - start
    };
    
  } catch (err) {
    return {
      contract: contractName,
      passed: false,
      message: '✗ Exception: ' + err.message,
      duration: Date.now() - start
    };
  }
}

function testCreateEventbookContract() {
  const start = Date.now();
  const contractName = 'createEventbook';
  
  try {
    const testName = 'Contract Test Event';
    const testDate = new Date().toISOString().split('T')[0];
    
    const result = createEventbook(testName, testDate);
    const errors = [];
    
    if (!result.event && !result.error) {
      errors.push('Missing event or error');
    }
    
    if (result.event) {
      const required = ['id', 'name', 'slug', 'startDateISO', 'ssId', 'ssUrl'];
      required.forEach(field => {
        if (!(field in result.event)) {
          errors.push(`Missing field: ${field}`);
        }
      });
      
      if (result.event.id && result.event.id.length !== 36) {
        errors.push('id must be UUID (36 chars)');
      }
      if (result.event.name !== testName) {
        errors.push('name does not match input');
      }
      if (result.event.startDateISO !== testDate) {
        errors.push('date does not match input');
      }
      
      if (result.event.slug && !/^[a-z0-9-]+$/.test(result.event.slug)) {
        errors.push('slug must be URL-safe');
      }
      
      if (!('existed' in result)) {
        errors.push('Missing existed flag (idempotency indicator)');
      }
    }
    
    if (result.error) {
      if (typeof result.error !== 'string') {
        errors.push('error must be string');
      }
      if (!result.code || typeof result.code !== 'number') {
        errors.push('error response must have numeric code');
      }
    }
    
    return {
      contract: contractName,
      passed: errors.length === 0,
      message: errors.length === 0 
        ? `✓ Event ${result.existed ? 'reused' : 'created'}: ${result.event.name}`
        : '✗ ' + errors.join('; '),
      duration: Date.now() - start
    };
    
  } catch (err) {
    return {
      contract: contractName,
      passed: false,
      message: '✗ Exception: ' + err.message,
      duration: Date.now() - start
    };
  }
}

function testGetShareQrVerifiedContract() {
  const start = Date.now();
  const contractName = 'getShareQrVerified';
  
  try {
    const allEvents = getEventsSafe(null);
    let testEvent = null;
    
    if (allEvents.events && allEvents.events.length > 0) {
      testEvent = allEvents.events[0];
    }
    
    if (!testEvent) {
      const testName = 'QR Test ' + Date.now();
      const testDate = new Date().toISOString().split('T')[0];
      const createResult = createEventbook(testName, testDate);
      
      if (!createResult.event) {
        if (createResult.code === 429) {
          return {
            contract: contractName,
            passed: false,
            message: `⚠ Rate limited and no events available. Wait ${createResult.retryAfter || 60}s.`,
            duration: Date.now() - start
          };
        }
        throw new Error('Failed to create test event: ' + (createResult.error || 'Unknown error'));
      }
      testEvent = createResult.event;
    }
    
    const result = getShareQrVerified(testEvent.id);
    const errors = [];
    
    if (!result.status) {
      errors.push('Missing status field');
    }
    
    const validStatuses = ['READY', 'VERIFYING', 'EXPIRED', 'ERROR'];
    if (result.status && !validStatuses.includes(result.status)) {
      errors.push(`Invalid status: ${result.status} (expected: ${validStatuses.join(', ')})`);
    }
    
    if (result.status === 'READY') {
      if (!result.qrCodeUrl) {
        errors.push('READY status missing qrCodeUrl');
      } else if (!result.qrCodeUrl.startsWith('https://')) {
        errors.push('qrCodeUrl must be HTTPS URL');
      }
      
      if (!result.shortUrl) {
        errors.push('READY status missing shortUrl');
      }
    }
    
    if (result.status === 'ERROR' && !result.error) {
      errors.push('ERROR status missing error message');
    }
    
    if (result.code === 429 && !result.retryAfter) {
      errors.push('Rate limit response missing retryAfter');
    }
    
    return {
      contract: contractName,
      passed: errors.length === 0,
      message: errors.length === 0 
        ? `✓ QR status: ${result.status}`
        : '✗ ' + errors.join('; '),
      duration: Date.now() - start
    };
    
  } catch (err) {
    return {
      contract: contractName,
      passed: false,
      message: '✗ Exception: ' + err.message,
      duration: Date.now() - start
    };
  }
}

function testGetPublicBundleContract() {
  const start = Date.now();
  const contractName = 'getPublicBundle';
  
  try {
    const allEvents = getEventsSafe(null);
    let testEvent = null;
    
    if (allEvents.events && allEvents.events.length > 0) {
      testEvent = allEvents.events[0];
    }
    
    if (!testEvent) {
      const testName = 'Bundle Test ' + Date.now();
      const testDate = new Date().toISOString().split('T')[0];
      const createResult = createEventbook(testName, testDate);
      
      if (!createResult.event) {
        if (createResult.code === 429) {
          return {
            contract: contractName,
            passed: false,
            message: `⚠ Rate limited and no events available. Wait ${createResult.retryAfter || 60}s.`,
            duration: Date.now() - start
          };
        }
        throw new Error('Failed to create test event: ' + (createResult.error || 'Unknown error'));
      }
      testEvent = createResult.event;
    }
    
    const result = getPublicBundle(testEvent.id);
    const errors = [];
    
    if (!result.event && !result.error) {
      errors.push('Missing event or error');
    }
    
    if (result.event) {
      const required = ['id', 'name', 'startDateISO'];
      required.forEach(field => {
        if (!(field in result.event)) {
          errors.push(`Missing field: ${field}`);
        }
      });
      
      const privateFields = ['ssId', 'ssUrl', 'formId'];
      privateFields.forEach(field => {
        if (field in result.event && result.event[field]) {
          errors.push(`Public bundle should not expose: ${field}`);
        }
      });
      
      if (result.event.name && typeof result.event.name !== 'string') {
        errors.push('name must be string');
      }
      if (result.event.startDateISO && !/^\d{4}-\d{2}-\d{2}/.test(result.event.startDateISO)) {
        errors.push('startDateISO must be ISO date format');
      }
    }
    
    return {
      contract: contractName,
      passed: errors.length === 0,
      message: errors.length === 0 
        ? `✓ Bundle for: ${result.event.name}`
        : '✗ ' + errors.join('; '),
      duration: Date.now() - start
    };
    
  } catch (err) {
    return {
      contract: contractName,
      passed: false,
      message: '✗ Exception: ' + err.message,
      duration: Date.now() - start
    };
  }
}

function testShortlinksSetContract() {
  const start = Date.now();
  const contractName = 'Shortlinks.set';
  
  try {
    const testKey = 'test-' + Date.now();
    const testUrl = 'https://example.com/test';
    const testMeta = { source: 'contract-test', timestamp: Date.now() };
    
    const token = Shortlinks.set(testKey, testUrl, testMeta);
    const errors = [];
    
    if (typeof token !== 'string') {
      errors.push('Token must be string');
    }
    
    if (!token || token.length === 0) {
      errors.push('Token must not be empty');
    }
    
    if (token.length < 8 || token.length > 12) {
      errors.push(`Token length ${token.length} outside range 8-12`);
    }
    
    if (!/^[A-Za-z0-9]+$/.test(token)) {
      errors.push('Token must be alphanumeric (base62)');
    }
    
    const token2 = Shortlinks.set(testKey, testUrl, testMeta);
    if (token !== token2) {
      errors.push('Shortlinks.set not idempotent');
    }
    
    return {
      contract: contractName,
      passed: errors.length === 0,
      message: errors.length === 0 
        ? `✓ Token generated: ${token}`
        : '✗ ' + errors.join('; '),
      duration: Date.now() - start
    };
    
  } catch (err) {
    return {
      contract: contractName,
      passed: false,
      message: '✗ Exception: ' + err.message,
      duration: Date.now() - start
    };
  }
}

function testShortlinksResolveContract() {
  const start = Date.now();
  const contractName = 'Shortlinks.resolve';
  
  try {
    const testKey = 'resolve-' + Date.now();
    const testUrl = 'https://example.com/resolve';
    const token = Shortlinks.set(testKey, testUrl);
    
    const resolved = Shortlinks.resolve(token, { source: 'test' });
    const errors = [];
    
    if (resolved !== testUrl) {
      errors.push(`Expected ${testUrl}, got ${resolved}`);
    }
    
    const invalidResolved = Shortlinks.resolve('invalid123', {});
    if (invalidResolved !== null) {
      errors.push(`Invalid token should return null, got ${invalidResolved}`);
    }
    
    const emptyResolved = Shortlinks.resolve('', {});
    if (emptyResolved !== null) {
      errors.push('Empty token should return null');
    }
    
    const resolved2 = Shortlinks.resolve(token, { source: 'test' });
    if (resolved2 !== testUrl) {
      errors.push('Second resolution failed');
    }
    
    return {
      contract: contractName,
      passed: errors.length === 0,
      message: errors.length === 0 
        ? `✓ Resolved: ${token} → ${testUrl.substring(0, 30)}...`
        : '✗ ' + errors.join('; '),
      duration: Date.now() - start
    };
    
  } catch (err) {
    return {
      contract: contractName,
      passed: false,
      message: '✗ Exception: ' + err.message,
      duration: Date.now() - start
    };
  }
}

/************************************************************
* [S19] System Health & Monitoring (WITH BOOTSTRAP STATUS)
************************************************************/
function healthCheck() {
  const checks = {
    timestamp: new Date().toISOString(),
    deployment: BUILD_ID,
    overall: 'healthy',
    checks: {}
  };
  
  try {
    const start = Date.now();
    const ssId = cfgGet_(CFG_KEYS.CONTROL_ID);
    if (!ssId) {
      checks.checks.spreadsheet = { 
        status: 'warning',
        message: 'Not bootstrapped - will auto-create on first use'
      };
    } else {
      const ss = SpreadsheetApp.openById(ssId);
      ss.getSheetByName('Events');
      checks.checks.spreadsheet = { 
        status: 'healthy', 
        latency: Date.now() - start,
        id: ssId.substring(0, 12) + '...'
      };
    }
  } catch (err) {
    checks.checks.spreadsheet = { 
      status: 'unhealthy', 
      error: err.toString() 
    };
    checks.overall = 'unhealthy';
  }
  
  try {
    const templateId = cfgGet_(CFG_KEYS.TEMPLATE_ID);
    if (!templateId) {
      checks.checks.template = {
        status: 'warning',
        message: 'Not bootstrapped - will auto-create on first event'
      };
    } else {
      const template = SpreadsheetApp.openById(templateId);
      checks.checks.template = {
        status: 'healthy',
        name: template.getName()
      };
    }
  } catch (err) {
    checks.checks.template = {
      status: 'degraded',
      error: err.toString()
    };
    if (checks.overall === 'healthy') {
      checks.overall = 'degraded';
    }
  }
  
  try {
    const folderId = cfgGet_(CFG_KEYS.EVENTS_DIR);
    if (!folderId) {
      checks.checks.folder = {
        status: 'warning',
        message: 'Not bootstrapped - will auto-create on first event'
      };
    } else {
      const folder = DriveApp.getFolderById(folderId);
      checks.checks.folder = {
        status: 'healthy',
        name: folder.getName()
      };
    }
  } catch (err) {
    checks.checks.folder = {
      status: 'degraded',
      error: err.toString()
    };
    if (checks.overall === 'healthy') {
      checks.overall = 'degraded';
    }
  }
  
  try {
    const start = Date.now();
    PropertiesService.getScriptProperties().getProperty('test');
    checks.checks.properties = { 
      status: 'healthy', 
      latency: Date.now() - start 
    };
  } catch (err) {
    checks.checks.properties = { 
      status: 'unhealthy', 
      error: err.toString() 
    };
    if (checks.overall === 'healthy') {
      checks.overall = 'degraded';
    }
  }
  
  try {
    const start = Date.now();
    CacheService.getScriptCache().get('test');
    checks.checks.cache = { 
      status: 'healthy', 
      latency: Date.now() - start 
    };
  } catch (err) {
    checks.checks.cache = { 
      status: 'degraded', 
      error: err.toString() 
    };
    if (checks.overall === 'healthy') {
      checks.overall = 'degraded';
    }
  }
  
  try {
    const cache = CacheService.getScriptCache();
    const userEmail = Session.getEffectiveUser().getEmail() || 'anonymous';
    const createKey = `ratelimit_create_${userEmail}`;
    
    const data = cache.get(createKey);
    const now = Date.now();
    let requestCount = 0;
    
    if (data) {
      try {
        const timestamps = JSON.parse(data);
        const windowMs = RATE_LIMITS.create.windowMs;
        requestCount = timestamps.filter(t => now - t < windowMs).length;
      } catch (e) {
        requestCount = 0;
      }
    }
    
    const maxRequests = RATE_LIMITS.create.maxRequests;
    const utilization = (requestCount / maxRequests * 100).toFixed(1);
    
    checks.checks.rateLimit = {
      status: requestCount < maxRequests * 0.8 ? 'healthy' : 'warning',
      used: requestCount,
      available: maxRequests,
      utilization: utilization + '%'
    };
  } catch (err) {
    checks.checks.rateLimit = { 
      status: 'unknown', 
      error: err.toString() 
    };
  }
  
  return checks;
}

function ping() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    deployment: BUILD_ID,
    user: Session.getEffectiveUser().getEmail() || 'anonymous'
  };
}

/**
 * Force a clean bootstrap - clears all IDs and recreates everything
 */
function forceCleanBootstrap() {
  console.log('[Force Bootstrap] Clearing all stored IDs...');
  
  // Clear all configuration
  cfgSet_(CFG_KEYS.CONTROL_ID, '');
  cfgSet_(CFG_KEYS.TEMPLATE_ID, '');
  cfgSet_(CFG_KEYS.EVENTS_DIR, '');
  
  console.log('[Force Bootstrap] Starting fresh bootstrap...');
  
  // Run bootstrap
  const ss = ensureControlStrictOnBoot();
  
  console.log('[Force Bootstrap] Complete!');
  console.log('Control spreadsheet URL:', ss.getUrl());
  
  return {
    controlUrl: ss.getUrl(),
    controlId: ss.getId()
  };
}
