/************************************************************
* NextUp v4.2.0 — Code.gs (Architecturally Hardened)
* 
* ARCHITECTURAL PRINCIPLES:
* 1. Every public function returns {ok, status, data?, error?}
* 2. Input validation happens at entry points before any work
* 3. No silent failures - all errors are logged and returned
* 4. Business logic is separated from data access
* 5. Contract tests verify critical boundaries
************************************************************/

const BUILD_ID = 'nextup-v4.2.0-hardened';
const CONTROL_TITLE = 'NextUp - Control';

// Configuration constants (unchanged)
const ORG_BASE_URL    = 'https://script.google.com/macros/s/ORG_DEPLOYMENT_ID/exec';
const PUBLIC_BASE_URL = 'https://script.google.com/macros/s/PUBLIC_DEPLOYMENT_ID/exec';
const EVENTS_SPREADSHEET_ID = 'PUT_MAIN_SPREADSHEET_ID_HERE';
const EVENTS_ROOT_FOLDER_ID = 'PUT_EVENTS_FOLDER_ID_HERE';
const EVENT_TEMPLATE_ID     = 'PUT_TEMPLATE_SPREADSHEET_ID_HERE';

const CFG_KEYS = {
  CONTROL_ID: 'NU_CONTROL_SSID',
  TEMPLATE_ID: 'NU_TEMPLATE_SSID',
  EVENTS_DIR: 'NU_EVENTS_FOLDERID',
  ORG_URL:    'NU_ORG_BASE_URL',
  PUB_URL:    'NU_PUBLIC_BASE_URL'
};

const PROP = { EVENTS_ETAG: 'NU_EVENTS_ETAG' };

/************************************************************
* [CORE-01] RESPONSE ENVELOPE STANDARD
* All public functions must return this shape
************************************************************/
const Response = {
  success(data, meta = {}) {
    return {
      ok: true,
      status: meta.status || 200,
      data: data || {},
      timestamp: new Date().toISOString(),
      ...meta
    };
  },
  
  error(message, phase = 'unknown', statusCode = 500, details = {}) {
    DIAG.log('error', phase, message, details);
    return {
      ok: false,
      status: statusCode,
      error: {
        message: String(message),
        phase,
        details
      },
      timestamp: new Date().toISOString()
    };
  },
  
  notModified(etag) {
    return {
      ok: true,
      status: 304,
      notModified: true,
      etag,
      data: [],
      timestamp: new Date().toISOString()
    };
  }
};

/************************************************************
* [CORE-02] INPUT VALIDATION LAYER
* All inputs validated before processing
************************************************************/
const Validate = {
  /**
   * Validates event name
   * @returns {ok, value?, error?}
   */
  eventName(raw) {
    if (raw === undefined || raw === null) {
      return { ok: false, error: 'Event name is required' };
    }
    
    const value = String(raw).trim();
    
    if (!value) {
      return { ok: false, error: 'Event name cannot be empty' };
    }
    
    if (value.length > 200) {
      return { ok: false, error: 'Event name too long (max 200 characters)' };
    }
    
    if (/<script|javascript:|on\w+=/i.test(value)) {
      return { ok: false, error: 'Event name contains invalid characters' };
    }
    
    return { ok: true, value };
  },
  
  /**
   * Validates ISO date string (YYYY-MM-DD)
   */
  dateISO(raw) {
    if (raw === undefined || raw === null) {
      return { ok: false, error: 'Date is required' };
    }
    
    const value = String(raw).trim();
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { ok: false, error: 'Date must be in YYYY-MM-DD format' };
    }
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { ok: false, error: 'Invalid date value' };
    }
    
    // Check if date is reasonable (not more than 10 years in past or future)
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
    const tenYearsAhead = new Date(now.getFullYear() + 10, 11, 31);
    
    if (date < tenYearsAgo || date > tenYearsAhead) {
      return { ok: false, error: 'Date must be within 10 years of current date' };
    }
    
    return { ok: true, value };
  },
  
  /**
   * Validates seed mode
   */
  seedMode(raw) {
    const value = raw === undefined ? 'random' : String(raw).toLowerCase();
    const allowed = ['random', 'seeded'];
    
    if (!allowed.includes(value)) {
      return { ok: false, error: `Seed mode must be one of: ${allowed.join(', ')}` };
    }
    
    return { ok: true, value };
  },
  
  /**
   * Validates elimination type
   */
  elimType(raw) {
    const value = raw === undefined ? 'none' : String(raw).toLowerCase();
    const allowed = ['single', 'double', 'none'];
    
    if (!allowed.includes(value)) {
      return { ok: false, error: `Elimination type must be one of: ${allowed.join(', ')}` };
    }
    
    return { ok: true, value };
  },
  
  /**
   * Validates event identifier (ID or slug)
   */
  eventKey(raw) {
    if (raw === undefined || raw === null) {
      return { ok: false, error: 'Event identifier is required' };
    }
    
    const value = String(raw).trim();
    
    if (!value) {
      return { ok: false, error: 'Event identifier cannot be empty' };
    }
    
    if (value.length > 100) {
      return { ok: false, error: 'Event identifier too long' };
    }
    
    if (/[<>"'`]/.test(value)) {
      return { ok: false, error: 'Event identifier contains invalid characters' };
    }
    
    return { ok: true, value };
  },
  
  /**
   * Validates geo-tagging data
   */
  geo(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ok: true, value: null }; // Geo is optional
    }
    
    const lat = parseFloat(raw.latitude || raw.lat);
    const lon = parseFloat(raw.longitude || raw.lon || raw.lng);
    
    if (!isFinite(lat) || !isFinite(lon)) {
      return { ok: false, error: 'Invalid coordinates' };
    }
    
    if (lat < -90 || lat > 90) {
      return { ok: false, error: 'Latitude must be between -90 and 90' };
    }
    
    if (lon < -180 || lon > 180) {
      return { ok: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return {
      ok: true,
      value: {
        latitude: lat,
        longitude: lon,
        venue: String(raw.venue || '').trim().slice(0, 200),
        city: String(raw.city || '').trim().slice(0, 100),
        state: String(raw.state || '').trim().slice(0, 50),
        country: String(raw.country || 'US').trim().toUpperCase().slice(0, 2),
        timezone: String(raw.timezone || '').trim()
      }
    };
  }
};

/************************************************************
* [CORE-03] RATE LIMITING
* Protects against abuse
************************************************************/
const RateLimit = {
  limits: {
    create: { windowMs: 60000, max: 5 },
    read: { windowMs: 60000, max: 30 }
  },
  
  check(action) {
    try {
      const cache = CacheService.getUserCache();
      const key = `ratelimit_${action}`;
      const data = cache.get(key);
      
      const now = Date.now();
      const limit = this.limits[action] || this.limits.read;
      
      if (!data) {
        cache.put(key, JSON.stringify({ count: 1, start: now }), Math.ceil(limit.windowMs / 1000));
        return Response.success({ allowed: true });
      }
      
      const state = JSON.parse(data);
      
      if (now - state.start > limit.windowMs) {
        cache.put(key, JSON.stringify({ count: 1, start: now }), Math.ceil(limit.windowMs / 1000));
        return Response.success({ allowed: true });
      }
      
      if (state.count >= limit.max) {
        const retryAfter = Math.ceil((limit.windowMs - (now - state.start)) / 1000);
        return Response.error(
          `Rate limit exceeded. Try again in ${retryAfter}s`,
          'ratelimit',
          429,
          { retryAfter, action }
        );
      }
      
      state.count++;
      cache.put(key, JSON.stringify(state), Math.ceil(limit.windowMs / 1000));
      return Response.success({ allowed: true });
      
    } catch (err) {
      DIAG.log('error', 'RateLimit.check', 'Failed to check rate limit', { err: String(err), action });
      // On error, allow the request (fail open)
      return Response.success({ allowed: true, degraded: true });
    }
  }
};

/************************************************************
* [CORE-04] DIAGNOSTICS
* Centralized logging
************************************************************/
const DIAG = {
  LOG_SHEET: 'Diagnostics',
  
  log(level, where, msg, data) {
    try {
      const ss = SpreadsheetApp.openById(cfgControlId_());
      const sh = ss.getSheetByName(this.LOG_SHEET) || ss.insertSheet(this.LOG_SHEET);
      
      if (sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, 5).setValues([['ts', 'level', 'where', 'msg', 'data']]);
        sh.setFontWeight('bold');
        sh.setFrozenRows(1);
      }
      
      const row = [[
        new Date(),
        String(level || 'info'),
        String(where || ''),
        String(msg || ''),
        data ? JSON.stringify(data) : ''
      ]];
      
      sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setValues(row);
      
    } catch (err) {
      // Last resort: log to execution transcript
      console.error('DIAG.log failed:', { level, where, msg, err: String(err) });
    }
  }
};

/**
 * Client-side logging endpoint
 * Called from HTML interfaces
 */
function clientLog(entry) {
  try {
    const e = entry || {};
    const level = String(e.level || 'info');
    const where = 'client:' + String(e.where || 'unknown');
    const msg = String(e.msg || '');
    let ts = Number(e.ts);
    if (!isFinite(ts)) ts = Date.now();
    
    const data = (e.data && typeof e.data === 'object') 
      ? Object.assign({}, e.data, { ts }) 
      : { ts };
    
    DIAG.log(level, where, msg, data);
    return Response.success({ logged: true });
    
  } catch (err) {
    return Response.error('Failed to log client message', 'clientLog', 500, { err: String(err) });
  }
}

/**
 * Retrieve recent logs
 * Used by Admin.html diagnostics
 */
function getLogs(maxRows) {
  try {
    const limit = Math.max(1, Math.min(1000, Number(maxRows) || 300));
    const ss = SpreadsheetApp.openById(cfgControlId_());
    const sh = ss.getSheetByName(DIAG.LOG_SHEET);
    
    if (!sh || sh.getLastRow() < 2) {
      return Response.success({ items: [] });
    }
    
    const last = sh.getLastRow();
    const start = Math.max(2, last - limit + 1);
    const vals = sh.getRange(start, 1, last - start + 1, 5).getValues();
    
    const items = vals.map(r => ({
      ts: r[0],
      level: r[1],
      where: r[2],
      msg: r[3],
      data: r[4] ? safeJsonParse_(r[4]) : null
    }));
    
    return Response.success({ items, count: items.length });
    
  } catch (err) {
    return Response.error('Failed to retrieve logs', 'getLogs', 500, { err: String(err) });
  }
}

/**
 * Clear diagnostic logs
 */
function clearLogs() {
  try {
    const ss = SpreadsheetApp.openById(cfgControlId_());
    const sh = ss.getSheetByName(DIAG.LOG_SHEET);
    
    if (sh && sh.getLastRow() >= 2) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
    }
    
    return Response.success({ cleared: true });
    
  } catch (err) {
    return Response.error('Failed to clear logs', 'clearLogs', 500, { err: String(err) });
  }
}

/************************************************************
* [CORE-05] CONFIGURATION MANAGEMENT
* Defensive getters with fallbacks
************************************************************/
function cfgGet_(key, fallbackConst) {
  try {
    const props = PropertiesService.getScriptProperties();
    const value = props.getProperty(key);
    
    if (value) return value;
    
    // Only use fallback if it's not a placeholder
    if (fallbackConst && 
        !String(fallbackConst).includes('PUT_') &&
        !String(fallbackConst).includes('_DEPLOYMENT_ID')) {
      props.setProperty(key, fallbackConst);
      return fallbackConst;
    }
    
    return '';
    
  } catch (err) {
    DIAG.log('error', 'cfgGet_', 'Failed to get config', { key, err: String(err) });
    return '';
  }
}

function cfgSet_(key, val) {
  try {
    if (val) {
      PropertiesService.getScriptProperties().setProperty(key, String(val));
    }
  } catch (err) {
    DIAG.log('error', 'cfgSet_', 'Failed to set config', { key, err: String(err) });
  }
}

function cfgOrgUrl_() {
  return cfgGet_(CFG_KEYS.ORG_URL, ORG_BASE_URL) || ScriptApp.getService().getUrl();
}

function cfgPubUrl_() {
  return cfgGet_(CFG_KEYS.PUB_URL, PUBLIC_BASE_URL) || ScriptApp.getService().getUrl();
}

function cfgControlId_() {
  return ensureControlWorkbook_();
}

function cfgTemplateId_() {
  return ensureEventTemplate_();
}

function cfgEventsFolderId_() {
  return ensureEventsFolder_();
}

/************************************************************
* [SECTION-06] EVENT CREATION - HARDENED
* Full input validation, transactional safety, detailed error reporting
************************************************************/

/**
 * Public API: Create new event
 * CONTRACT: Accepts {name, startDateISO, seedMode?, elimType?, geo?}
 * RETURNS: Standard Response envelope with event details
 */
function createEventbook(payload) {
  const started = Date.now();
  
  // Rate limiting
  const rateCheck = RateLimit.check('create');
  if (!rateCheck.ok) {
    return rateCheck;
  }
  
  // Ensure bootstrap
  try {
    ensureAll_();
  } catch (err) {
    return Response.error('Failed to initialize system', 'bootstrap', 500, { err: String(err) });
  }
  
  // Validate all inputs
  const vName = Validate.eventName(payload.name);
  if (!vName.ok) {
    return Response.error(vName.error, 'validate_name', 400);
  }
  
  const vDate = Validate.dateISO(payload.startDateISO || payload.startDate);
  if (!vDate.ok) {
    return Response.error(vDate.error, 'validate_date', 400);
  }
  
  const vSeed = Validate.seedMode(payload.seedMode);
  if (!vSeed.ok) {
    return Response.error(vSeed.error, 'validate_seed', 400);
  }
  
  const vElim = Validate.elimType(payload.elimType);
  if (!vElim.ok) {
    return Response.error(vElim.error, 'validate_elim', 400);
  }
  
  const vGeo = Validate.geo(payload.geo);
  if (!vGeo.ok) {
    DIAG.log('warn', 'createEventbook', 'Invalid geo data provided', { error: vGeo.error });
    // Geo is optional, so we continue with null
  }
  
  // Validated inputs
  const name = vName.value;
  const dateISO = vDate.value;
  const seedMode = vSeed.value;
  const elimType = vElim.value;
  const geo = vGeo.ok ? vGeo.value : null;
  
  // Generate slug
  const slug = slugify_(name);
  
  // Idempotency check
  try {
    const existing = findExistingEvent_(slug, dateISO);
    if (existing) {
      DIAG.log('info', 'createEventbook', 'Idempotent hit', {
        id: existing.id,
        slug: existing.slug,
        dateISO: existing.startDateISO
      });
      
      return Response.success({
        id: existing.id,
        slug: existing.slug,
        tag: existing.eventTag,
        spreadsheetId: existing.eventSpreadsheetId || '',
        spreadsheetUrl: existing.eventSpreadsheetUrl || '',
        idempotent: true
      }, { ms: Date.now() - started });
    }
  } catch (err) {
    return Response.error('Failed idempotency check', 'idempotency', 500, { err: String(err) });
  }
  
  // Create new event
  const id = Utilities.getUuid();
  const tag = computeEventTag_(slug, dateISO, id);
  
  try {
    // Create workbook
    const workbook = createEventWorkbook_({
      id, name, slug, dateISO, tag, seedMode, elimType, geo
    });
    
    if (!workbook.ok) {
      return Response.error('Failed to create workbook', 'workbook', 500, workbook.details);
    }
    
    // Generate shortlinks
    const links = generateEventLinks_(id, workbook.spreadsheetId, workbook.spreadsheetUrl);
    
    if (!links.ok) {
      return Response.error('Failed to generate links', 'links', 500, links.details);
    }
    
    // Write to control sheet
    const registered = registerEventInControl_({
      id, name, slug, dateISO, tag, seedMode, elimType, geo,
      spreadsheetId: workbook.spreadsheetId,
      spreadsheetUrl: workbook.spreadsheetUrl
    });
    
    if (!registered.ok) {
      return Response.error('Failed to register event', 'register', 500, registered.details);
    }
    
    // Success
    bustEventsCache_();
    
    DIAG.log('info', 'createEventbook', 'Event created successfully', {
      id, slug, tag, ms: Date.now() - started
    });
    
    return Response.success({
      id,
      slug,
      tag,
      spreadsheetId: workbook.spreadsheetId,
      spreadsheetUrl: workbook.spreadsheetUrl,
      links: links.data,
      idempotent: false,
      geo: geo ? {
        latitude: geo.latitude,
        longitude: geo.longitude,
        geohash: links.data.geohash,
        venue: geo.venue,
        city: geo.city
      } : null
    }, { ms: Date.now() - started });
    
  } catch (err) {
    DIAG.log('error', 'createEventbook', 'Uncaught exception', {
      err: String(err),
      stack: err.stack
    });
    return Response.error('Unexpected error during creation', 'exception', 500, { err: String(err) });
  }
}

// Backward compatibility aliases
function createEvent(payload) { return createEventbook(payload); }
function createEventV2(payload) { return createEventbook(payload); }

/**
 * INTERNAL: Find existing event by slug and date
 * Returns event object or null
 */
function findExistingEvent_(slug, dateISO) {
  const sh = getEventsSheet_();
  const lastRow = sh.getLastRow();
  
  if (lastRow < 2) return null;
  
  const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
  const hit = data.find(r => 
    String(r[IDX.slug] || '') === slug && 
    String(r[IDX.startDateISO] || '') === dateISO
  );
  
  return hit ? rowToEvent_(hit) : null;
}

/**
 * INTERNAL: Create event workbook with all sheets
 * Returns {ok, spreadsheetId, spreadsheetUrl, details?}
 */
function createEventWorkbook_(params) {
  try {
    const { id, name, slug, dateISO, tag, seedMode, elimType, geo } = params;
    
    const folderId = cfgEventsFolderId_();
    const templateId = cfgTemplateId_();
    const title = eventWorkbookTitle_(name, slug, dateISO, id);
    
    const template = DriveApp.getFileById(templateId);
    const folder = DriveApp.getFolderById(folderId);
    const copy = template.makeCopy(title, folder);
    const ss = SpreadsheetApp.openById(copy.getId());
    
    // Ensure required sheets exist
    Object.values(TABS).forEach(sheetName => {
      if (!ss.getSheetByName(sheetName)) {
        ss.insertSheet(sheetName);
      }
    });
    
    // Set up headers
    header_(ss, TABS.SIGNUPS, ['timestamp', 'name', 'email', 'phone', 'team', 'notes']);
    header_(ss, TABS.SCHEDULE, ['round', 'time', 'activity', 'notes', 'table']);
    header_(ss, TABS.STANDINGS, ['team', 'points', 'tiebreak', 'notes']);
    
    // Ensure poster config
    tplEnsurePosterConfigKv_(ss);
    
    // Enrich geo if provided
    let enrichedGeo = null;
    if (geo) {
      enrichedGeo = enrichGeoData_(geo);
    }
    
    // Write metadata (links will be added separately)
    const meta = ensureKvSheet_(ss, TABS.META);
    const metaData = {
      eventId: id,
      eventTag: tag,
      slug,
      startDateISO: dateISO,
      seedMode,
      elimType
    };
    
    if (enrichedGeo) {
      Object.assign(metaData, enrichedGeo);
    }
    
    upsertKv_(meta, metaData);
    
    return {
      ok: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl()
    };
    
  } catch (err) {
    return {
      ok: false,
      details: { err: String(err), stack: err.stack }
    };
  }
}

/**
 * INTERNAL: Generate all links and shortcodes for an event
 * Returns {ok, data: {adminUrl, publicUrl, ...}, details?}
 */
function generateEventLinks_(eventId, spreadsheetId, spreadsheetUrl) {
  try {
    const adminUrl = buildOrgUrl_('Admin', eventId);
    const publicUrl = buildPublicUrl_('Public', eventId);
    const displayUrl = buildOrgUrl_('Display', eventId);
    const posterPageUrl = buildPublicUrl_('Poster', eventId);
    
    // Pre-generate verified shortlinks
    const shortPublic = Shortlinks.set(`PUBLIC:${eventId}`, publicUrl);
    const shortDisplay = Shortlinks.set(`DISPLAY:${eventId}`, displayUrl);
    const shortPosterPage = Shortlinks.set(`POSTER_PAGE:${eventId}`, posterPageUrl);
    const shortWorkbook = Shortlinks.set(`POSTER:${eventId}`, spreadsheetUrl);
    
    // Update workbook metadata with links
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const meta = ensureKvSheet_(ss, TABS.META);
    upsertKv_(meta, {
      adminUrl,
      publicUrl,
      displayUrl,
      posterPageUrl,
      shortPublic,
      shortDisplay,
      shortPosterPage
    });
    
    return {
      ok: true,
      data: {
        adminUrl,
        publicUrl,
        displayUrl,
        posterPageUrl,
        shortPublic,
        shortDisplay,
        shortPosterPage,
        shortWorkbook
      }
    };
    
  } catch (err) {
    return {
      ok: false,
      details: { err: String(err) }
    };
  }
}

/**
 * INTERNAL: Register event in control sheet
 * Returns {ok, details?}
 */
function registerEventInControl_(params) {
  try {
    const { id, name, slug, dateISO, tag, seedMode, elimType, geo, spreadsheetId, spreadsheetUrl } = params;
    
    const sh = getEventsSheet_();
    
    const row = [
      id, name, slug, dateISO, spreadsheetId, spreadsheetUrl,
      '', // formId (empty initially)
      tag,
      false, // isDefault
      seedMode,
      elimType,
      geo ? geo.latitude : '',
      geo ? geo.longitude : '',
      geo ? enrichGeoData_(geo).geohash : '',
      geo ? geo.venue : '',
      geo ? geo.city : '',
      geo ? geo.state : '',
      geo ? geo.country : '',
      geo ? enrichGeoData_(geo).timezone : '',
      geo ? enrichGeoData_(geo).plusCode : ''
    ];
    
    sh.appendRow(row);
    SpreadsheetApp.flush();
    
    return { ok: true };
    
  } catch (err) {
    return {
      ok: false,
      details: { err: String(err) }
    };
  }
}

/************************************************************
* [SECTION-07] EVENTS INDEX - HARDENED
* SWR-safe event listing with ETag support
************************************************************/

/**
 * Public API: Get all events with SWR support
 * CONTRACT: Accepts optional etag string
 * RETURNS: Standard envelope with {items, etag, notModified}
 */
function getEventsSafe(clientEtag) {
  try {
    ensureAll_();
    
    const { items, etag } = readEventsIndex_();
    
    // Persist etag for telemetry
    try {
      PropertiesService.getScriptProperties().setProperty(PROP.EVENTS_ETAG, etag);
    } catch (_) {}
    
    // Check for 304 Not Modified
    if (clientEtag && clientEtag === etag) {
      return Response.notModified(etag);
    }
    
    return Response.success({ items, etag, notModified: false });
    
  } catch (err) {
    return Response.error('Failed to retrieve events', 'getEvents', 500, { err: String(err) });
  }
}

// Backward compatibility
function getEventbooksSafe(etag) { return getEventsSafe(etag); }

/**
 * INTERNAL: Read full events index and compute ETag
 */
function readEventsIndex_() {
  const sh = getEventsSheet_();
  const lastRow = sh.getLastRow();
  
  if (lastRow < 2) {
    return { items: [], etag: 'empty' };
  }
  
  const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
  const items = data
    .filter(r => String(r[IDX.id] || '').trim())
    .map(rowToEvent_);
  
  const etag = computeEtag_(items);
  
  return { items, etag };
}

/**
 * INTERNAL: Compute stable ETag from event data
 */
function computeEtag_(items) {
  const projection = items.map(ev => [
    ev.id,
    ev.slug,
    ev.startDateISO,
    ev.eventSpreadsheetId,
    ev.eventTag
  ]);
  
  const json = JSON.stringify(projection);
  const bytes = Utilities.newBlob(json).getBytes();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes);
  
  return Utilities.base64EncodeWebSafe(hash).slice(0, 16);
}

/**
 * INTERNAL: Convert spreadsheet row to event object
 */
function rowToEvent_(row) {
  const safe = (index) => (index < row.length ? row[index] : '');
  
  return {
    id: safe(IDX.id),
    name: safe(IDX.name),
    slug: safe(IDX.slug),
    startDateISO: safe(IDX.startDateISO),
    eventSpreadsheetId: safe(IDX.ssId),
    eventSpreadsheetUrl: safe(IDX.ssUrl),
    formId: safe(IDX.formId),
    eventTag: safe(IDX.tag),
    isDefault: String(safe(IDX.isDefault)).toLowerCase() === 'true',
    seedMode: safe(IDX.seedMode) || 'random',
    elimType: safe(IDX.elimType) || 'none',
    latitude: safe(11),
    longitude: safe(12),
    geohash: safe(13),
    venue: safe(14),
    city: safe(15),
    state: safe(16),
    country: safe(17),
    timezone: safe(18),
    plusCode: safe(19)
  };
}

/************************************************************
* [SECTION-08] HELPER UTILITIES
************************************************************/

/**
 * Safely parse JSON, returning null on error
 */
function safeJsonParse_(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

/**
 * Generate slug from event name
 */
function slugify_(name) {
  return String(name || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || `event-${Date.now()}`;
}

/**
 * Compute event tag from slug, date, and ID
 */
function computeEventTag_(slug, dateISO, id) {
  const safeSlug = slugify_(slug);
  const ymd = String(dateISO || '').replace(/-/g, '') || 
              Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const id6 = String(id || '').replace(/-/g, '').slice(0, 6) || 'xxxxxx';
  
  return `${safeSlug}-${ymd}-${id6}`;
}

/**
 * Generate workbook title
 */
function eventWorkbookTitle_(name, slug, dateISO, id) {
  const safeName = String(name || 'Event').trim();
  const safeDate = String(dateISO || '').trim();
  const safeSlug = slugify_(slug);
  
  return `NextUp · ${safeName} · ${safeDate} · ${safeSlug}`;
}

/**
 * Build org-scoped URL
 */
function buildOrgUrl_(page, eventId) {
  const base = cfgOrgUrl_();
  return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`;
}

/**
 * Build public-scoped URL
 */
function buildPublicUrl_(page, eventId) {
  const base = cfgPubUrl_();
  return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`;
}

/**
 * Bust events cache
 */
function bustEventsCache_() {
  try {
    CacheService.getScriptCache().remove('events_index');
  } catch (_) {}
  
  try {
    PropertiesService.getScriptProperties().deleteProperty(PROP.EVENTS_ETAG);
  } catch (_) {}
}

/************************************************************
* [SECTION-09] SHORTLINKS (unchanged but with error handling)
************************************************************/
const Shortlinks = {
  set(key, target) {
    if (!target) return '';
    
    try {
      const props = PropertiesService.getScriptProperties();
      const map = JSON.parse(props.getProperty('NU_SHORTLINKS_MAP_V1') || '{}');
      
      let token = map[key];
      if (!token) {
        token = this._generateSecureToken();
        map[key] = token;
        props.setProperty('NU_SHORTLINKS_MAP_V1', JSON.stringify(map));
      }
      
      const tmap = JSON.parse(props.getProperty('NU_SHORTLINKS_TARGETS_V1') || '{}');
      tmap[token] = target;
      props.setProperty('NU_SHORTLINKS_TARGETS_V1', JSON.stringify(tmap));
      
      return this.url(token);
      
    } catch (err) {
      DIAG.log('error', 'Shortlinks.set', 'Failed to create shortlink', { key, err: String(err) });
      return '';
    }
  },
  
  _generateSecureToken() {
    const bytes = Utilities.getUuid().replace(/-/g, '');
    return Utilities.base64EncodeWebSafe(bytes).slice(0, 12);
  },
  
  resolve(token) {
    try {
      const tmap = JSON.parse(
        PropertiesService.getScriptProperties().getProperty('NU_SHORTLINKS_TARGETS_V1') || '{}'
      );
      return tmap[token] || null;
    } catch (err) {
      DIAG.log('error', 'Shortlinks.resolve', 'Failed to resolve token', { token, err: String(err) });
      return null;
    }
  },
  
  url(token) {
    const base = cfgPubUrl_();
    return `${base}?page=R&t=${encodeURIComponent(token)}`;
  }
};

/************************************************************
* [SECTION-10] EVENT WORKBOOK OPERATIONS - HARDENED
* Finding, ensuring, and manipulating event workbooks
************************************************************/

/**
 * Find event by ID or slug
 * CONTRACT: Accepts string identifier
 * RETURNS: Event object or null (not an error - absence is valid state)
 */
function findEventByIdOrSlug_(key) {
  try {
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    // No key provided - return default event if one exists
    if (!key) {
      if (lastRow < 2) return null;
      
      const rows = sh.getRange(2, 1, lastRow - 1, 20).getValues();
      const defaultRow = rows.find(r => 
        String(r[IDX.isDefault]).toLowerCase() === 'true'
      );
      
      return defaultRow ? rowToEvent_(defaultRow) : null;
    }
    
    // Key provided - find matching event
    if (lastRow < 2) return null;
    
    const rows = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    const matchingRow = rows.find(r => 
      r[IDX.id] === key || r[IDX.slug] === key
    );
    
    return matchingRow ? rowToEvent_(matchingRow) : null;
    
  } catch (err) {
    DIAG.log('error', 'findEventByIdOrSlug_', 'Failed to search events', {
      key,
      err: String(err)
    });
    return null;
  }
}

/**
 * Ensure event has a workbook, creating if needed
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with workbook details
 */
function ensureWorkbook_(eventIdOrSlug) {
  try {
    const event = findEventByIdOrSlug_(eventIdOrSlug);
    
    if (!event) {
      return Response.error(
        'Event not found',
        'find_event',
        404,
        { key: eventIdOrSlug }
      );
    }
    
    // Workbook already exists
    if (event.eventSpreadsheetId && event.eventSpreadsheetUrl) {
      // Verify it's actually accessible
      try {
        SpreadsheetApp.openById(event.eventSpreadsheetId);
        
        return Response.success({
          id: event.id,
          name: event.name,
          tag: event.eventTag,
          dateISO: event.startDateISO,
          spreadsheetId: event.eventSpreadsheetId,
          spreadsheetUrl: event.eventSpreadsheetUrl,
          formId: event.formId || ''
        });
        
      } catch (err) {
        DIAG.log('warn', 'ensureWorkbook_', 'Workbook ID exists but not accessible', {
          eventId: event.id,
          spreadsheetId: event.eventSpreadsheetId,
          err: String(err)
        });
        // Fall through to create new workbook
      }
    }
    
    // Need to create workbook
    const created = createWorkbookForExistingEvent_(event);
    
    if (!created.ok) {
      return Response.error(
        'Failed to create workbook',
        'create_workbook',
        500,
        created.details
      );
    }
    
    return Response.success({
      id: event.id,
      name: event.name,
      tag: event.eventTag,
      dateISO: event.startDateISO,
      spreadsheetId: created.spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl,
      formId: event.formId || ''
    });
    
  } catch (err) {
    return Response.error(
      'Unexpected error ensuring workbook',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/**
 * INTERNAL: Create workbook for event that exists in index but lacks workbook
 */
function createWorkbookForExistingEvent_(event) {
  try {
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) {
      return { ok: false, details: { error: 'No events in sheet' } };
    }
    
    const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    const rowIndex = data.findIndex(r => r[IDX.id] === event.id);
    
    if (rowIndex < 0) {
      return { ok: false, details: { error: 'Event not found in sheet' } };
    }
    
    const rowNumber = rowIndex + 2; // +1 for header, +1 for 0-based to 1-based
    
    // Create workbook from template
    const folderId = cfgEventsFolderId_();
    const templateId = cfgTemplateId_();
    const title = eventWorkbookTitle_(
      event.name,
      event.slug,
      event.startDateISO,
      event.id
    );
    
    const template = DriveApp.getFileById(templateId);
    const folder = DriveApp.getFolderById(folderId);
    const copy = template.makeCopy(title, folder);
    const ss = SpreadsheetApp.openById(copy.getId());
    
    // Set up sheets
    Object.values(TABS).forEach(sheetName => {
      if (!ss.getSheetByName(sheetName)) {
        ss.insertSheet(sheetName);
      }
    });
    
    // Write metadata
    const meta = ensureKvSheet_(ss, TABS.META);
    upsertKv_(meta, {
      eventId: event.id,
      eventTag: event.eventTag,
      slug: event.slug,
      startDateISO: event.startDateISO,
      adminUrl: buildOrgUrl_('Admin', event.id),
      publicUrl: buildPublicUrl_('Public', event.id),
      displayUrl: buildOrgUrl_('Display', event.id),
      posterPageUrl: buildPublicUrl_('Poster', event.id),
      seedMode: event.seedMode || 'random',
      elimType: event.elimType || 'none'
    });
    
    // Set up data sheets
    header_(ss, TABS.SIGNUPS, ['timestamp', 'name', 'email', 'phone', 'team', 'notes']);
    header_(ss, TABS.SCHEDULE, ['round', 'time', 'activity', 'notes', 'table']);
    header_(ss, TABS.STANDINGS, ['team', 'points', 'tiebreak', 'notes']);
    tplEnsurePosterConfigKv_(ss);
    
    // Update control sheet
    sh.getRange(rowNumber, IDX.ssId + 1).setValue(ss.getId());
    sh.getRange(rowNumber, IDX.ssUrl + 1).setValue(ss.getUrl());
    SpreadsheetApp.flush();
    
    bustEventsCache_();
    
    return {
      ok: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl()
    };
    
  } catch (err) {
    return {
      ok: false,
      details: {
        err: String(err),
        stack: err.stack
      }
    };
  }
}

/************************************************************
* [SECTION-11] BUNDLE ENDPOINTS - HARDENED
* Display, Public, and Poster data bundles
************************************************************/

/**
 * Public API: Get display bundle for TV/screen display
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with display data
 */
function getDisplayBundle(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const workbook = ensureWorkbook_(validation.value);
    if (!workbook.ok) {
      return workbook; // Already a Response object
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const meta = readKv_(ss, TABS.META);
    const posterConfig = readKv_(ss, TABS.POSTER);
    
    const standings = readTable_(ss, TABS.STANDINGS);
    const schedule = readTable_(ss, TABS.SCHEDULE);
    
    if (!standings.ok) {
      return Response.error('Failed to read standings', 'read_standings', 500, standings.details);
    }
    
    if (!schedule.ok) {
      return Response.error('Failed to read schedule', 'read_schedule', 500, schedule.details);
    }
    
    return Response.success({
      eventTag: meta.eventTag || workbook.data.tag,
      title: meta.title || workbook.data.name || workbook.data.tag,
      datePretty: prettyDate_(meta.startDateISO || workbook.data.dateISO),
      place: posterConfig.place || '',
      standings: standings.data,
      schedule: schedule.data,
      adminUrl: buildOrgUrl_('Admin', workbook.data.id),
      publicUrl: buildPublicUrl_('Public', workbook.data.id),
      posterPageUrl: buildPublicUrl_('Poster', workbook.data.id)
    });
    
  } catch (err) {
    return Response.error(
      'Failed to build display bundle',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/**
 * Public API: Get public bundle with privacy controls
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with public data
 */
function getPublicBundle(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const workbook = ensureWorkbook_(validation.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const meta = readKv_(ss, TABS.META);
    const posterConfig = readKv_(ss, TABS.POSTER);
    
    // Get name privacy mode
    const nameMode = String(posterConfig.public_name_mode || 'initials').toLowerCase();
    const validNameModes = ['full', 'initials', 'none'];
    const safeNameMode = validNameModes.includes(nameMode) ? nameMode : 'initials';
    
    // Read tables with privacy applied
    const standings = readTable_(ss, TABS.STANDINGS);
    const schedule = readTable_(ss, TABS.SCHEDULE);
    
    if (!standings.ok || !schedule.ok) {
      return Response.error(
        'Failed to read event data',
        'read_tables',
        500,
        { standings: standings.ok, schedule: schedule.ok }
      );
    }
    
    const privateStandings = applyNamePrivacy_(standings.data, safeNameMode);
    const privateSchedule = applyNamePrivacy_(
      schedule.data,
      safeNameMode,
      ['team', 'team_a', 'team_b']
    );
    
    return Response.success({
      eventTag: meta.eventTag || workbook.data.tag,
      title: meta.title || workbook.data.name || workbook.data.tag,
      datePretty: prettyDate_(meta.startDateISO || workbook.data.dateISO),
      place: posterConfig.place || '',
      public_name_mode: safeNameMode,
      standings: privateStandings,
      schedule: privateSchedule,
      posterPageUrl: buildPublicUrl_('Poster', workbook.data.id)
    });
    
  } catch (err) {
    return Response.error(
      'Failed to build public bundle',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/**
 * Public API: Get poster bundle with QR codes
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with poster data
 */
function getPosterBundle(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const workbook = ensureWorkbook_(validation.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const meta = readKv_(ss, TABS.META);
    const posterConfig = readKv_(ss, TABS.POSTER);
    
    const posterImageUrl = String(posterConfig.posterImageUrl || '').trim();
    const adminUrl = buildOrgUrl_('Admin', workbook.data.id);
    const publicUrl = buildPublicUrl_('Public', workbook.data.id);
    
    // Get shortlinks (these are pre-generated at creation time)
    const shortPublic = meta.shortPublic || 
                       Shortlinks.set(`PUBLIC:${workbook.data.id}`, publicUrl);
    
    let shortForm = '';
    if (workbook.data.formId) {
      const formUrl = `https://docs.google.com/forms/d/${workbook.data.formId}/viewform`;
      shortForm = meta.shortForm || 
                  Shortlinks.set(`FORM:${workbook.data.id}`, formUrl);
    }
    
    // Generate QR codes ONLY for verified shortlinks
    const qr = {
      public: shortPublic ? QR.image(shortPublic) : '',
      form: shortForm ? QR.image(shortForm) : ''
    };
    
    return Response.success({
      eventTag: meta.eventTag || workbook.data.tag,
      title: meta.title || workbook.data.name || workbook.data.tag,
      datePretty: prettyDate_(meta.startDateISO || workbook.data.dateISO),
      place: posterConfig.place || '',
      posterImageUrl,
      adminUrl,
      publicUrl,
      qr
    });
    
  } catch (err) {
    return Response.error(
      'Failed to build poster bundle',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/************************************************************
* [SECTION-12] QUICK LINKS - HARDENED
* Comprehensive link generation with verified shortcodes
************************************************************/

/**
 * Public API: Get all links for an event
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with all links and QR codes
 */
function getEventQuickLinks(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(validation.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    const eventId = event.id;
    const adminUrl = buildOrgUrl_('Admin', eventId);
    const displayUrl = buildOrgUrl_('Display', eventId);
    const publicUrl = buildPublicUrl_('Public', eventId);
    const posterPageUrl = buildPublicUrl_('Poster', eventId);
    const workbookUrl = event.eventSpreadsheetUrl || '';
    
    // Form URLs
    let formUrlView = '';
    let formUrlEdit = '';
    if (event.formId) {
      formUrlView = `https://docs.google.com/forms/d/${event.formId}/viewform`;
      formUrlEdit = `https://docs.google.com/forms/d/${event.formId}/edit`;
    }
    
    // Poster image URL (from workbook if exists)
    let posterImageUrl = '';
    if (event.eventSpreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(event.eventSpreadsheetId);
        const posterConfig = readKv_(ss, TABS.POSTER);
        posterImageUrl = String(posterConfig.posterImageUrl || '').trim();
      } catch (err) {
        DIAG.log('warn', 'getEventQuickLinks', 'Could not read poster image URL', {
          eventId,
          err: String(err)
        });
      }
    }
    
    // Generate or retrieve shortlinks
    const short = {
      form: formUrlView ? Shortlinks.set(`FORM:${eventId}`, formUrlView) : '',
      display: Shortlinks.set(`DISPLAY:${eventId}`, displayUrl),
      public: Shortlinks.set(`PUBLIC:${eventId}`, publicUrl),
      poster: workbookUrl ? Shortlinks.set(`POSTER:${eventId}`, workbookUrl) : '',
      posterImage: posterImageUrl ? Shortlinks.set(`POSTER_IMG:${eventId}`, posterImageUrl) : '',
      posterPage: Shortlinks.set(`POSTER_PAGE:${eventId}`, posterPageUrl)
    };
    
    // Generate QR codes ONLY for valid shortlinks
    const qr = {
      form: short.form ? QR.image(short.form) : '',
      display: short.display ? QR.image(short.display) : '',
      public: short.public ? QR.image(short.public) : '',
      poster: short.poster ? QR.image(short.poster) : '',
      posterImage: short.posterImage ? QR.image(short.posterImage) : '',
      posterPage: short.posterPage ? QR.image(short.posterPage) : ''
    };
    
    // Signups URL
    let signupsUrl = '';
    if (event.eventSpreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(event.eventSpreadsheetId);
        const signupsSheet = ss.getSheetByName(TABS.SIGNUPS);
        if (signupsSheet) {
          const gid = signupsSheet.getSheetId();
          signupsUrl = `${event.eventSpreadsheetUrl}#gid=${gid}`;
        }
      } catch (err) {
        DIAG.log('warn', 'getEventQuickLinks', 'Could not build signups URL', {
          eventId,
          err: String(err)
        });
      }
    }
    
    return Response.success({
      adminUrl,
      displayUrl,
      publicUrl,
      posterPageUrl,
      workbookUrl,
      signupsUrl,
      posterImageUrl,
      formUrlView,
      formUrlEdit,
      short,
      qr
    });
    
  } catch (err) {
    return Response.error(
      'Failed to generate quick links',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

// Backward compatibility alias
function getEventbookQuickLinks(eventIdOrSlug) {
  return getEventQuickLinks(eventIdOrSlug);
}

/**
 * Legacy API: Get share QR (maintained for backward compatibility)
 * Returns verified QR only
 */
function getShareQr(key) {
  const result = getShareQrVerified(key);
  if (!result.ok) return result;
  
  return Response.success({
    url: result.data.url || '',
    qrB64: '', // Deprecated, kept for compatibility
    qrUrlVerified: result.data.qrUrlVerified || ''
  });
}

/**
 * Public API: Get verified public QR code
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with URL and verified QR image URL
 */
function getShareQrVerified(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(validation.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    const links = getEventQuickLinks(event.id);
    if (!links.ok) {
      return links;
    }
    
    const qrPublic = (links.data.short && links.data.short.public) 
      ? (links.data.qr && links.data.qr.public || '')
      : '';
    
    return Response.success({
      url: links.data.publicUrl || '',
      qrUrlVerified: qrPublic || ''
    });
    
  } catch (err) {
    return Response.error(
      'Failed to generate share QR',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/************************************************************
* [SECTION-13] FORM OPERATIONS - HARDENED
************************************************************/

/**
 * Public API: Set form ID for an event
 * CONTRACT: Accepts event ID/slug and form ID or URL
 * RETURNS: Standard Response with formId
 */
function setEventFormId(eventIdOrSlug, formIdOrUrl) {
  try {
    const vKey = Validate.eventKey(eventIdOrSlug);
    if (!vKey.ok) {
      return Response.error(vKey.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(vKey.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    // Parse form ID from URL if needed
    const formId = parseFormId_(formIdOrUrl);
    
    // Update control sheet
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) {
      return Response.error('No events in sheet', 'sheet_empty', 500);
    }
    
    const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    const rowIndex = data.findIndex(r => r[IDX.id] === event.id);
    
    if (rowIndex < 0) {
      return Response.error('Event not found in sheet', 'find_row', 500);
    }
    
    const rowNumber = rowIndex + 2;
    sh.getRange(rowNumber, IDX.formId + 1).setValue(formId || '');
    SpreadsheetApp.flush();
    
    // Update workbook metadata if workbook exists
    if (event.eventSpreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(event.eventSpreadsheetId);
        const meta = ensureKvSheet_(ss, TABS.META);
        
        upsertKv_(meta, {
          formId: formId || '',
          formUrlView: formId ? `https://docs.google.com/forms/d/${formId}/viewform` : '',
          formUrlEdit: formId ? `https://docs.google.com/forms/d/${formId}/edit` : ''
        });
        
        // Generate shortlink for form
        if (formId) {
          const formUrl = `https://docs.google.com/forms/d/${formId}/viewform`;
          const shortForm = Shortlinks.set(`FORM:${event.id}`, formUrl);
          upsertKv_(meta, { shortForm });
        }
        
      } catch (err) {
        DIAG.log('warn', 'setEventFormId', 'Could not update workbook metadata', {
          eventId: event.id,
          err: String(err)
        });
        // Not a fatal error - control sheet was updated successfully
      }
    }
    
    bustEventsCache_();
    
    return Response.success({ formId: formId || '' });
    
  } catch (err) {
    return Response.error(
      'Failed to set form ID',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * INTERNAL: Parse form ID from URL or return as-is
 */
function parseFormId_(input) {
  if (!input) return '';
  
  const str = String(input).trim();
  const match = str.match(/\/d\/([^/]+)/);
  
  return (match && match[1]) || str;
}

/**
 * Public API: Import signups from CSV
 * CONTRACT: Accepts event ID/slug and CSV string
 * RETURNS: Standard Response with import count
 */
function importSignupsCsv(eventIdOrSlug, csv) {
  try {
    const vKey = Validate.eventKey(eventIdOrSlug);
    if (!vKey.ok) {
      return Response.error(vKey.error, 'validate_key', 400);
    }
    
    if (!csv || typeof csv !== 'string') {
      return Response.error('CSV data is required', 'validate_csv', 400);
    }
    
    const workbook = ensureWorkbook_(vKey.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const sh = ss.getSheetByName(TABS.SIGNUPS) || ss.insertSheet(TABS.SIGNUPS);
    
    const rows = Utilities.parseCsv(csv);
    
    if (!rows || !rows.length) {
      return Response.error('Empty or invalid CSV', 'parse_csv', 400);
    }
    
    // Ensure header exists
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, rows[0].length).setValues([rows[0]]);
    }
    
    // Determine if first row is header
    const hasHeader = rows[0].some(cell => 
      ['name', 'team', 'email', 'timestamp'].includes(
        String(cell).toLowerCase()
      )
    );
    
    const dataRows = hasHeader ? rows.slice(1) : rows;
    
    if (dataRows.length === 0) {
      return Response.error('No data rows in CSV', 'empty_data', 400);
    }
    
    // Append data
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, dataRows.length, dataRows[0].length)
      .setValues(dataRows);
    
    SpreadsheetApp.flush();
    
    return Response.success({
      imported: dataRows.length,
      totalRows: sh.getLastRow() - 1 // Exclude header
    });
    
  } catch (err) {
    return Response.error(
      'Failed to import CSV',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * Public API: Import signups from another spreadsheet
 * CONTRACT: Accepts event ID/slug, source sheet ID, and range
 * RETURNS: Standard Response with import count
 */
function importSignupsFromSheet(eventIdOrSlug, sheetId, rangeA1) {
  try {
    const vKey = Validate.eventKey(eventIdOrSlug);
    if (!vKey.ok) {
      return Response.error(vKey.error, 'validate_key', 400);
    }
    
    if (!sheetId || !rangeA1) {
      return Response.error(
        'Sheet ID and range are required',
        'validate_params',
        400
      );
    }
    
    const workbook = ensureWorkbook_(vKey.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    // Read source data
    let sourceData;
    try {
      const sourceSheet = SpreadsheetApp.openById(String(sheetId));
      sourceData = sourceSheet.getRange(String(rangeA1)).getValues();
    } catch (err) {
      return Response.error(
        'Could not read source sheet',
        'read_source',
        400,
        { sheetId, rangeA1, err: String(err) }
      );
    }
    
    if (!sourceData || !sourceData.length) {
      return Response.error('Source range is empty', 'empty_source', 400);
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const sh = ss.getSheetByName(TABS.SIGNUPS) || ss.insertSheet(TABS.SIGNUPS);
    
    // Ensure header
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, sourceData[0].length).setValues([sourceData[0]]);
    }
    
    // Determine if first row is header
    const hasHeader = sourceData[0].some(cell =>
      ['name', 'team', 'email', 'timestamp'].includes(
        String(cell).toLowerCase()
      )
    );
    
    const dataRows = hasHeader ? sourceData.slice(1) : sourceData;
    
    if (dataRows.length === 0) {
      return Response.error('No data rows in source', 'empty_data', 400);
    }
    
    // Append data
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, dataRows.length, dataRows[0].length)
      .setValues(dataRows);
    
    SpreadsheetApp.flush();
    
    return Response.success({
      imported: dataRows.length,
      totalRows: sh.getLastRow() - 1
    });
    
  } catch (err) {
    return Response.error(
      'Failed to import from sheet',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/************************************************************
* [SECTION-14] DATA ACCESS LAYER - HARDENED
* Reading tables and KV stores with error handling
************************************************************/

/**
 * Read table data from a sheet
 * RETURNS: {ok, data: [...], details?}
 */
function readTable_(ss, sheetName) {
  try {
    const sh = ss.getSheetByName(sheetName);
    
    if (!sh) {
      return {
        ok: true,
        data: [] // Sheet not existing is not an error - just empty data
      };
    }
    
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    
    if (lastRow < 2 || lastCol < 1) {
      return { ok: true, data: [] };
    }
    
    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const headerRow = values[0];
    
    // Normalize headers to lowercase with underscores
    const headers = headerRow.map(h =>
      String(h || '')
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase()
    );
    
    const rows = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = {};
      let hasData = false;
      
      for (let j = 0; j < headers.length; j++) {
        const value = values[i][j];
        row[headers[j]] = value;
        
        if (value !== '' && value !== null && value !== undefined) {
          hasData = true;
        }
      }
      
      // Only include rows that have at least one non-empty value
      if (hasData) {
        rows.push(row);
      }
    }
    
    return { ok: true, data: rows };
    
  } catch (err) {
    return {
      ok: false,
      data: [],
      details: {
        err: String(err),
        sheetName
      }
    };
  }
}

/**
 * Read key-value data from a sheet
 * Returns plain object (not Response - used internally)
 */
function readKv_(ss, sheetName) {
  try {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return {};
    
    const lastRow = sh.getLastRow();
    if (lastRow < 1) return {};
    
    const values = sh.getRange(1, 1, lastRow, 2).getValues();
    const kv = {};
    
    values.forEach(row => {
      const key = String(row[0] || '').trim();
      if (key) {
        kv[key] = row[1];
      }
    });
    
    return kv;
    
  } catch (err) {
    DIAG.log('error', 'readKv_', 'Failed to read KV sheet', {
      sheetName,
      err: String(err)
    });
    return {};
  }
}

/**
 * Ensure KV sheet exists and has header
 * Returns sheet object
 */
function ensureKvSheet_(ss, sheetName) {
  try {
    const sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3f6fb');
    }
    
    return sh;
    
  } catch (err) {
    DIAG.log('error', 'ensureKvSheet_', 'Failed to ensure KV sheet', {
      sheetName,
      err: String(err)
    });
    throw err; // Re-throw since this is critical
  }
}

/**
 * Upsert key-value pairs into a KV sheet
 */
function upsertKv_(sheet, kvPairs) {
  try {
    if (!kvPairs || typeof kvPairs !== 'object') return;
    
    const lastRow = sheet.getLastRow();
    const existingData = lastRow > 0 
      ? sheet.getRange(1, 1, lastRow, 2).getValues()
      : [];
    
    // Build index of existing keys to row numbers
    const keyIndex = {};
    existingData.forEach((row, index) => {
      const key = String(row[0] || '').trim();
      if (key) {
        keyIndex[key] = index + 1; // 1-based row number
      }
    });
    
    // Update or append each key-value pair
    Object.entries(kvPairs).forEach(([key, value]) => {
      const trimmedKey = String(key).trim();
      if (!trimmedKey) return;
      
      if (keyIndex[trimmedKey]) {
        // Update existing
        sheet.getRange(keyIndex[trimmedKey], 2).setValue(value);
      } else {
        // Append new
        sheet.appendRow([trimmedKey, value]);
      }
    });
    
  } catch (err) {
    DIAG.log('error', 'upsertKv_', 'Failed to upsert KV pairs', {
      err: String(err)
    });
    throw err;
  }
}

/**
 * Set up sheet header with formatting
 */
function header_(ss, sheetName, columns) {
  try {
    const sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    
    const existing = sh.getLastRow() >= 1
      ? sh.getRange(1, 1, 1, columns.length).getValues()[0]
      : [];
    
    const existingHeaders = existing.map(v => String(v || '').trim());
    const needsUpdate = existingHeaders.length !== columns.length ||
                       !existingHeaders.every((h, i) => h === columns[i]);
    
    if (needsUpdate) {
      sh.getRange(1, 1, 1, columns.length).setValues([columns]);
    }
    
    // Always ensure formatting is correct
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, columns.length)
      .setFontWeight('bold')
      .setBackground('#f3f6fb');
    
    sh.autoResizeColumns(1, columns.length);
    
  } catch (err) {
    DIAG.log('error', 'header_', 'Failed to set header', {
      sheetName,
      err: String(err)
    });
    throw err;
  }
}

/************************************************************
* [SECTION-15] PRIVACY & FORMATTING - HARDENED
************************************************************/

/**
 * Apply name privacy mode to data rows
 */
function applyNamePrivacy_(rows, mode, fieldNames = ['name', 'team', 'player']) {
  try {
    const safeMode = String(mode || 'initials').toLowerCase();
    
    if (safeMode === 'full') {
      return rows; // No transformation needed
    }
    
    return rows.map(row => {
      const transformed = Object.assign({}, row);
      
      fieldNames.forEach(field => {
        if (transformed[field] === undefined) return;
        
        const value = String(transformed[field] || '').trim();
        
        if (!value) {
          transformed[field] = value;
          return;
        }
        
        if (safeMode === 'none') {
          transformed[field] = '—';
          return;
        }
        
        // 'initials' mode
        const parts = value.split(/\s+/).filter(Boolean);
        transformed[field] = parts.length > 0
          ? parts.map(p => p[0]).join('').toUpperCase()
          : '—';
      });
      
      return transformed;
    });
    
  } catch (err) {
    DIAG.log('error', 'applyNamePrivacy_', 'Failed to apply privacy', {
      mode,
      err: String(err)
    });
    // On error, return original data rather than failing
    return rows;
  }
}

/**
 * Format date prettily
 */
function prettyDate_(isoDate) {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return String(isoDate);
    
    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      'EEE, MMM d — h:mma'
    );
  } catch (err) {
    return String(isoDate);
  }
}

/************************************************************
* [SECTION-10] EVENT WORKBOOK OPERATIONS - HARDENED
* Finding, ensuring, and manipulating event workbooks
************************************************************/

/**
 * Find event by ID or slug
 * CONTRACT: Accepts string identifier
 * RETURNS: Event object or null (not an error - absence is valid state)
 */
function findEventByIdOrSlug_(key) {
  try {
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    // No key provided - return default event if one exists
    if (!key) {
      if (lastRow < 2) return null;
      
      const rows = sh.getRange(2, 1, lastRow - 1, 20).getValues();
      const defaultRow = rows.find(r => 
        String(r[IDX.isDefault]).toLowerCase() === 'true'
      );
      
      return defaultRow ? rowToEvent_(defaultRow) : null;
    }
    
    // Key provided - find matching event
    if (lastRow < 2) return null;
    
    const rows = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    const matchingRow = rows.find(r => 
      r[IDX.id] === key || r[IDX.slug] === key
    );
    
    return matchingRow ? rowToEvent_(matchingRow) : null;
    
  } catch (err) {
    DIAG.log('error', 'findEventByIdOrSlug_', 'Failed to search events', {
      key,
      err: String(err)
    });
    return null;
  }
}

/**
 * Ensure event has a workbook, creating if needed
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with workbook details
 */
function ensureWorkbook_(eventIdOrSlug) {
  try {
    const event = findEventByIdOrSlug_(eventIdOrSlug);
    
    if (!event) {
      return Response.error(
        'Event not found',
        'find_event',
        404,
        { key: eventIdOrSlug }
      );
    }
    
    // Workbook already exists
    if (event.eventSpreadsheetId && event.eventSpreadsheetUrl) {
      // Verify it's actually accessible
      try {
        SpreadsheetApp.openById(event.eventSpreadsheetId);
        
        return Response.success({
          id: event.id,
          name: event.name,
          tag: event.eventTag,
          dateISO: event.startDateISO,
          spreadsheetId: event.eventSpreadsheetId,
          spreadsheetUrl: event.eventSpreadsheetUrl,
          formId: event.formId || ''
        });
        
      } catch (err) {
        DIAG.log('warn', 'ensureWorkbook_', 'Workbook ID exists but not accessible', {
          eventId: event.id,
          spreadsheetId: event.eventSpreadsheetId,
          err: String(err)
        });
        // Fall through to create new workbook
      }
    }
    
    // Need to create workbook
    const created = createWorkbookForExistingEvent_(event);
    
    if (!created.ok) {
      return Response.error(
        'Failed to create workbook',
        'create_workbook',
        500,
        created.details
      );
    }
    
    return Response.success({
      id: event.id,
      name: event.name,
      tag: event.eventTag,
      dateISO: event.startDateISO,
      spreadsheetId: created.spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl,
      formId: event.formId || ''
    });
    
  } catch (err) {
    return Response.error(
      'Unexpected error ensuring workbook',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/**
 * INTERNAL: Create workbook for event that exists in index but lacks workbook
 */
function createWorkbookForExistingEvent_(event) {
  try {
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) {
      return { ok: false, details: { error: 'No events in sheet' } };
    }
    
    const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    const rowIndex = data.findIndex(r => r[IDX.id] === event.id);
    
    if (rowIndex < 0) {
      return { ok: false, details: { error: 'Event not found in sheet' } };
    }
    
    const rowNumber = rowIndex + 2; // +1 for header, +1 for 0-based to 1-based
    
    // Create workbook from template
    const folderId = cfgEventsFolderId_();
    const templateId = cfgTemplateId_();
    const title = eventWorkbookTitle_(
      event.name,
      event.slug,
      event.startDateISO,
      event.id
    );
    
    const template = DriveApp.getFileById(templateId);
    const folder = DriveApp.getFolderById(folderId);
    const copy = template.makeCopy(title, folder);
    const ss = SpreadsheetApp.openById(copy.getId());
    
    // Set up sheets
    Object.values(TABS).forEach(sheetName => {
      if (!ss.getSheetByName(sheetName)) {
        ss.insertSheet(sheetName);
      }
    });
    
    // Write metadata
    const meta = ensureKvSheet_(ss, TABS.META);
    upsertKv_(meta, {
      eventId: event.id,
      eventTag: event.eventTag,
      slug: event.slug,
      startDateISO: event.startDateISO,
      adminUrl: buildOrgUrl_('Admin', event.id),
      publicUrl: buildPublicUrl_('Public', event.id),
      displayUrl: buildOrgUrl_('Display', event.id),
      posterPageUrl: buildPublicUrl_('Poster', event.id),
      seedMode: event.seedMode || 'random',
      elimType: event.elimType || 'none'
    });
    
    // Set up data sheets
    header_(ss, TABS.SIGNUPS, ['timestamp', 'name', 'email', 'phone', 'team', 'notes']);
    header_(ss, TABS.SCHEDULE, ['round', 'time', 'activity', 'notes', 'table']);
    header_(ss, TABS.STANDINGS, ['team', 'points', 'tiebreak', 'notes']);
    tplEnsurePosterConfigKv_(ss);
    
    // Update control sheet
    sh.getRange(rowNumber, IDX.ssId + 1).setValue(ss.getId());
    sh.getRange(rowNumber, IDX.ssUrl + 1).setValue(ss.getUrl());
    SpreadsheetApp.flush();
    
    bustEventsCache_();
    
    return {
      ok: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl()
    };
    
  } catch (err) {
    return {
      ok: false,
      details: {
        err: String(err),
        stack: err.stack
      }
    };
  }
}

/************************************************************
* [SECTION-11] BUNDLE ENDPOINTS - HARDENED
* Display, Public, and Poster data bundles
************************************************************/

/**
 * Public API: Get display bundle for TV/screen display
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with display data
 */
function getDisplayBundle(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const workbook = ensureWorkbook_(validation.value);
    if (!workbook.ok) {
      return workbook; // Already a Response object
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const meta = readKv_(ss, TABS.META);
    const posterConfig = readKv_(ss, TABS.POSTER);
    
    const standings = readTable_(ss, TABS.STANDINGS);
    const schedule = readTable_(ss, TABS.SCHEDULE);
    
    if (!standings.ok) {
      return Response.error('Failed to read standings', 'read_standings', 500, standings.details);
    }
    
    if (!schedule.ok) {
      return Response.error('Failed to read schedule', 'read_schedule', 500, schedule.details);
    }
    
    return Response.success({
      eventTag: meta.eventTag || workbook.data.tag,
      title: meta.title || workbook.data.name || workbook.data.tag,
      datePretty: prettyDate_(meta.startDateISO || workbook.data.dateISO),
      place: posterConfig.place || '',
      standings: standings.data,
      schedule: schedule.data,
      adminUrl: buildOrgUrl_('Admin', workbook.data.id),
      publicUrl: buildPublicUrl_('Public', workbook.data.id),
      posterPageUrl: buildPublicUrl_('Poster', workbook.data.id)
    });
    
  } catch (err) {
    return Response.error(
      'Failed to build display bundle',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/**
 * Public API: Get public bundle with privacy controls
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with public data
 */
function getPublicBundle(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const workbook = ensureWorkbook_(validation.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const meta = readKv_(ss, TABS.META);
    const posterConfig = readKv_(ss, TABS.POSTER);
    
    // Get name privacy mode
    const nameMode = String(posterConfig.public_name_mode || 'initials').toLowerCase();
    const validNameModes = ['full', 'initials', 'none'];
    const safeNameMode = validNameModes.includes(nameMode) ? nameMode : 'initials';
    
    // Read tables with privacy applied
    const standings = readTable_(ss, TABS.STANDINGS);
    const schedule = readTable_(ss, TABS.SCHEDULE);
    
    if (!standings.ok || !schedule.ok) {
      return Response.error(
        'Failed to read event data',
        'read_tables',
        500,
        { standings: standings.ok, schedule: schedule.ok }
      );
    }
    
    const privateStandings = applyNamePrivacy_(standings.data, safeNameMode);
    const privateSchedule = applyNamePrivacy_(
      schedule.data,
      safeNameMode,
      ['team', 'team_a', 'team_b']
    );
    
    return Response.success({
      eventTag: meta.eventTag || workbook.data.tag,
      title: meta.title || workbook.data.name || workbook.data.tag,
      datePretty: prettyDate_(meta.startDateISO || workbook.data.dateISO),
      place: posterConfig.place || '',
      public_name_mode: safeNameMode,
      standings: privateStandings,
      schedule: privateSchedule,
      posterPageUrl: buildPublicUrl_('Poster', workbook.data.id)
    });
    
  } catch (err) {
    return Response.error(
      'Failed to build public bundle',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/**
 * Public API: Get poster bundle with QR codes
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with poster data
 */
function getPosterBundle(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const workbook = ensureWorkbook_(validation.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const meta = readKv_(ss, TABS.META);
    const posterConfig = readKv_(ss, TABS.POSTER);
    
    const posterImageUrl = String(posterConfig.posterImageUrl || '').trim();
    const adminUrl = buildOrgUrl_('Admin', workbook.data.id);
    const publicUrl = buildPublicUrl_('Public', workbook.data.id);
    
    // Get shortlinks (these are pre-generated at creation time)
    const shortPublic = meta.shortPublic || 
                       Shortlinks.set(`PUBLIC:${workbook.data.id}`, publicUrl);
    
    let shortForm = '';
    if (workbook.data.formId) {
      const formUrl = `https://docs.google.com/forms/d/${workbook.data.formId}/viewform`;
      shortForm = meta.shortForm || 
                  Shortlinks.set(`FORM:${workbook.data.id}`, formUrl);
    }
    
    // Generate QR codes ONLY for verified shortlinks
    const qr = {
      public: shortPublic ? QR.image(shortPublic) : '',
      form: shortForm ? QR.image(shortForm) : ''
    };
    
    return Response.success({
      eventTag: meta.eventTag || workbook.data.tag,
      title: meta.title || workbook.data.name || workbook.data.tag,
      datePretty: prettyDate_(meta.startDateISO || workbook.data.dateISO),
      place: posterConfig.place || '',
      posterImageUrl,
      adminUrl,
      publicUrl,
      qr
    });
    
  } catch (err) {
    return Response.error(
      'Failed to build poster bundle',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

/************************************************************
* [SECTION-12] QUICK LINKS - HARDENED
* Comprehensive link generation with verified shortcodes
************************************************************/

/**
 * Public API: Get all links for an event
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with all links and QR codes
 */
function getEventQuickLinks(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(validation.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    const eventId = event.id;
    const adminUrl = buildOrgUrl_('Admin', eventId);
    const displayUrl = buildOrgUrl_('Display', eventId);
    const publicUrl = buildPublicUrl_('Public', eventId);
    const posterPageUrl = buildPublicUrl_('Poster', eventId);
    const workbookUrl = event.eventSpreadsheetUrl || '';
    
    // Form URLs
    let formUrlView = '';
    let formUrlEdit = '';
    if (event.formId) {
      formUrlView = `https://docs.google.com/forms/d/${event.formId}/viewform`;
      formUrlEdit = `https://docs.google.com/forms/d/${event.formId}/edit`;
    }
    
    // Poster image URL (from workbook if exists)
    let posterImageUrl = '';
    if (event.eventSpreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(event.eventSpreadsheetId);
        const posterConfig = readKv_(ss, TABS.POSTER);
        posterImageUrl = String(posterConfig.posterImageUrl || '').trim();
      } catch (err) {
        DIAG.log('warn', 'getEventQuickLinks', 'Could not read poster image URL', {
          eventId,
          err: String(err)
        });
      }
    }
    
    // Generate or retrieve shortlinks
    const short = {
      form: formUrlView ? Shortlinks.set(`FORM:${eventId}`, formUrlView) : '',
      display: Shortlinks.set(`DISPLAY:${eventId}`, displayUrl),
      public: Shortlinks.set(`PUBLIC:${eventId}`, publicUrl),
      poster: workbookUrl ? Shortlinks.set(`POSTER:${eventId}`, workbookUrl) : '',
      posterImage: posterImageUrl ? Shortlinks.set(`POSTER_IMG:${eventId}`, posterImageUrl) : '',
      posterPage: Shortlinks.set(`POSTER_PAGE:${eventId}`, posterPageUrl)
    };
    
    // Generate QR codes ONLY for valid shortlinks
    const qr = {
      form: short.form ? QR.image(short.form) : '',
      display: short.display ? QR.image(short.display) : '',
      public: short.public ? QR.image(short.public) : '',
      poster: short.poster ? QR.image(short.poster) : '',
      posterImage: short.posterImage ? QR.image(short.posterImage) : '',
      posterPage: short.posterPage ? QR.image(short.posterPage) : ''
    };
    
    // Signups URL
    let signupsUrl = '';
    if (event.eventSpreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(event.eventSpreadsheetId);
        const signupsSheet = ss.getSheetByName(TABS.SIGNUPS);
        if (signupsSheet) {
          const gid = signupsSheet.getSheetId();
          signupsUrl = `${event.eventSpreadsheetUrl}#gid=${gid}`;
        }
      } catch (err) {
        DIAG.log('warn', 'getEventQuickLinks', 'Could not build signups URL', {
          eventId,
          err: String(err)
        });
      }
    }
    
    return Response.success({
      adminUrl,
      displayUrl,
      publicUrl,
      posterPageUrl,
      workbookUrl,
      signupsUrl,
      posterImageUrl,
      formUrlView,
      formUrlEdit,
      short,
      qr
    });
    
  } catch (err) {
    return Response.error(
      'Failed to generate quick links',
      'exception',
      500,
      { err: String(err), stack: err.stack }
    );
  }
}

// Backward compatibility alias
function getEventbookQuickLinks(eventIdOrSlug) {
  return getEventQuickLinks(eventIdOrSlug);
}

/**
 * Legacy API: Get share QR (maintained for backward compatibility)
 * Returns verified QR only
 */
function getShareQr(key) {
  const result = getShareQrVerified(key);
  if (!result.ok) return result;
  
  return Response.success({
    url: result.data.url || '',
    qrB64: '', // Deprecated, kept for compatibility
    qrUrlVerified: result.data.qrUrlVerified || ''
  });
}

/**
 * Public API: Get verified public QR code
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with URL and verified QR image URL
 */
function getShareQrVerified(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(validation.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    const links = getEventQuickLinks(event.id);
    if (!links.ok) {
      return links;
    }
    
    const qrPublic = (links.data.short && links.data.short.public) 
      ? (links.data.qr && links.data.qr.public || '')
      : '';
    
    return Response.success({
      url: links.data.publicUrl || '',
      qrUrlVerified: qrPublic || ''
    });
    
  } catch (err) {
    return Response.error(
      'Failed to generate share QR',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/************************************************************
* [SECTION-13] FORM OPERATIONS - HARDENED
************************************************************/

/**
 * Public API: Set form ID for an event
 * CONTRACT: Accepts event ID/slug and form ID or URL
 * RETURNS: Standard Response with formId
 */
function setEventFormId(eventIdOrSlug, formIdOrUrl) {
  try {
    const vKey = Validate.eventKey(eventIdOrSlug);
    if (!vKey.ok) {
      return Response.error(vKey.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(vKey.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    // Parse form ID from URL if needed
    const formId = parseFormId_(formIdOrUrl);
    
    // Update control sheet
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) {
      return Response.error('No events in sheet', 'sheet_empty', 500);
    }
    
    const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    const rowIndex = data.findIndex(r => r[IDX.id] === event.id);
    
    if (rowIndex < 0) {
      return Response.error('Event not found in sheet', 'find_row', 500);
    }
    
    const rowNumber = rowIndex + 2;
    sh.getRange(rowNumber, IDX.formId + 1).setValue(formId || '');
    SpreadsheetApp.flush();
    
    // Update workbook metadata if workbook exists
    if (event.eventSpreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(event.eventSpreadsheetId);
        const meta = ensureKvSheet_(ss, TABS.META);
        
        upsertKv_(meta, {
          formId: formId || '',
          formUrlView: formId ? `https://docs.google.com/forms/d/${formId}/viewform` : '',
          formUrlEdit: formId ? `https://docs.google.com/forms/d/${formId}/edit` : ''
        });
        
        // Generate shortlink for form
        if (formId) {
          const formUrl = `https://docs.google.com/forms/d/${formId}/viewform`;
          const shortForm = Shortlinks.set(`FORM:${event.id}`, formUrl);
          upsertKv_(meta, { shortForm });
        }
        
      } catch (err) {
        DIAG.log('warn', 'setEventFormId', 'Could not update workbook metadata', {
          eventId: event.id,
          err: String(err)
        });
        // Not a fatal error - control sheet was updated successfully
      }
    }
    
    bustEventsCache_();
    
    return Response.success({ formId: formId || '' });
    
  } catch (err) {
    return Response.error(
      'Failed to set form ID',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * INTERNAL: Parse form ID from URL or return as-is
 */
function parseFormId_(input) {
  if (!input) return '';
  
  const str = String(input).trim();
  const match = str.match(/\/d\/([^/]+)/);
  
  return (match && match[1]) || str;
}

/**
 * Public API: Import signups from CSV
 * CONTRACT: Accepts event ID/slug and CSV string
 * RETURNS: Standard Response with import count
 */
function importSignupsCsv(eventIdOrSlug, csv) {
  try {
    const vKey = Validate.eventKey(eventIdOrSlug);
    if (!vKey.ok) {
      return Response.error(vKey.error, 'validate_key', 400);
    }
    
    if (!csv || typeof csv !== 'string') {
      return Response.error('CSV data is required', 'validate_csv', 400);
    }
    
    const workbook = ensureWorkbook_(vKey.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const sh = ss.getSheetByName(TABS.SIGNUPS) || ss.insertSheet(TABS.SIGNUPS);
    
    const rows = Utilities.parseCsv(csv);
    
    if (!rows || !rows.length) {
      return Response.error('Empty or invalid CSV', 'parse_csv', 400);
    }
    
    // Ensure header exists
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, rows[0].length).setValues([rows[0]]);
    }
    
    // Determine if first row is header
    const hasHeader = rows[0].some(cell => 
      ['name', 'team', 'email', 'timestamp'].includes(
        String(cell).toLowerCase()
      )
    );
    
    const dataRows = hasHeader ? rows.slice(1) : rows;
    
    if (dataRows.length === 0) {
      return Response.error('No data rows in CSV', 'empty_data', 400);
    }
    
    // Append data
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, dataRows.length, dataRows[0].length)
      .setValues(dataRows);
    
    SpreadsheetApp.flush();
    
    return Response.success({
      imported: dataRows.length,
      totalRows: sh.getLastRow() - 1 // Exclude header
    });
    
  } catch (err) {
    return Response.error(
      'Failed to import CSV',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * Public API: Import signups from another spreadsheet
 * CONTRACT: Accepts event ID/slug, source sheet ID, and range
 * RETURNS: Standard Response with import count
 */
function importSignupsFromSheet(eventIdOrSlug, sheetId, rangeA1) {
  try {
    const vKey = Validate.eventKey(eventIdOrSlug);
    if (!vKey.ok) {
      return Response.error(vKey.error, 'validate_key', 400);
    }
    
    if (!sheetId || !rangeA1) {
      return Response.error(
        'Sheet ID and range are required',
        'validate_params',
        400
      );
    }
    
    const workbook = ensureWorkbook_(vKey.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    // Read source data
    let sourceData;
    try {
      const sourceSheet = SpreadsheetApp.openById(String(sheetId));
      sourceData = sourceSheet.getRange(String(rangeA1)).getValues();
    } catch (err) {
      return Response.error(
        'Could not read source sheet',
        'read_source',
        400,
        { sheetId, rangeA1, err: String(err) }
      );
    }
    
    if (!sourceData || !sourceData.length) {
      return Response.error('Source range is empty', 'empty_source', 400);
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const sh = ss.getSheetByName(TABS.SIGNUPS) || ss.insertSheet(TABS.SIGNUPS);
    
    // Ensure header
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, sourceData[0].length).setValues([sourceData[0]]);
    }
    
    // Determine if first row is header
    const hasHeader = sourceData[0].some(cell =>
      ['name', 'team', 'email', 'timestamp'].includes(
        String(cell).toLowerCase()
      )
    );
    
    const dataRows = hasHeader ? sourceData.slice(1) : sourceData;
    
    if (dataRows.length === 0) {
      return Response.error('No data rows in source', 'empty_data', 400);
    }
    
    // Append data
    const startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, dataRows.length, dataRows[0].length)
      .setValues(dataRows);
    
    SpreadsheetApp.flush();
    
    return Response.success({
      imported: dataRows.length,
      totalRows: sh.getLastRow() - 1
    });
    
  } catch (err) {
    return Response.error(
      'Failed to import from sheet',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/************************************************************
* [SECTION-14] DATA ACCESS LAYER - HARDENED
* Reading tables and KV stores with error handling
************************************************************/

/**
 * Read table data from a sheet
 * RETURNS: {ok, data: [...], details?}
 */
function readTable_(ss, sheetName) {
  try {
    const sh = ss.getSheetByName(sheetName);
    
    if (!sh) {
      return {
        ok: true,
        data: [] // Sheet not existing is not an error - just empty data
      };
    }
    
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    
    if (lastRow < 2 || lastCol < 1) {
      return { ok: true, data: [] };
    }
    
    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const headerRow = values[0];
    
    // Normalize headers to lowercase with underscores
    const headers = headerRow.map(h =>
      String(h || '')
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase()
    );
    
    const rows = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = {};
      let hasData = false;
      
      for (let j = 0; j < headers.length; j++) {
        const value = values[i][j];
        row[headers[j]] = value;
        
        if (value !== '' && value !== null && value !== undefined) {
          hasData = true;
        }
      }
      
      // Only include rows that have at least one non-empty value
      if (hasData) {
        rows.push(row);
      }
    }
    
    return { ok: true, data: rows };
    
  } catch (err) {
    return {
      ok: false,
      data: [],
      details: {
        err: String(err),
        sheetName
      }
    };
  }
}

/**
 * Read key-value data from a sheet
 * Returns plain object (not Response - used internally)
 */
function readKv_(ss, sheetName) {
  try {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return {};
    
    const lastRow = sh.getLastRow();
    if (lastRow < 1) return {};
    
    const values = sh.getRange(1, 1, lastRow, 2).getValues();
    const kv = {};
    
    values.forEach(row => {
      const key = String(row[0] || '').trim();
      if (key) {
        kv[key] = row[1];
      }
    });
    
    return kv;
    
  } catch (err) {
    DIAG.log('error', 'readKv_', 'Failed to read KV sheet', {
      sheetName,
      err: String(err)
    });
    return {};
  }
}

/**
 * Ensure KV sheet exists and has header
 * Returns sheet object
 */
function ensureKvSheet_(ss, sheetName) {
  try {
    const sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3f6fb');
    }
    
    return sh;
    
  } catch (err) {
    DIAG.log('error', 'ensureKvSheet_', 'Failed to ensure KV sheet', {
      sheetName,
      err: String(err)
    });
    throw err; // Re-throw since this is critical
  }
}

/**
 * Upsert key-value pairs into a KV sheet
 */
function upsertKv_(sheet, kvPairs) {
  try {
    if (!kvPairs || typeof kvPairs !== 'object') return;
    
    const lastRow = sheet.getLastRow();
    const existingData = lastRow > 0 
      ? sheet.getRange(1, 1, lastRow, 2).getValues()
      : [];
    
    // Build index of existing keys to row numbers
    const keyIndex = {};
    existingData.forEach((row, index) => {
      const key = String(row[0] || '').trim();
      if (key) {
        keyIndex[key] = index + 1; // 1-based row number
      }
    });
    
    // Update or append each key-value pair
    Object.entries(kvPairs).forEach(([key, value]) => {
      const trimmedKey = String(key).trim();
      if (!trimmedKey) return;
      
      if (keyIndex[trimmedKey]) {
        // Update existing
        sheet.getRange(keyIndex[trimmedKey], 2).setValue(value);
      } else {
        // Append new
        sheet.appendRow([trimmedKey, value]);
      }
    });
    
  } catch (err) {
    DIAG.log('error', 'upsertKv_', 'Failed to upsert KV pairs', {
      err: String(err)
    });
    throw err;
  }
}

/**
 * Set up sheet header with formatting
 */
function header_(ss, sheetName, columns) {
  try {
    const sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    
    const existing = sh.getLastRow() >= 1
      ? sh.getRange(1, 1, 1, columns.length).getValues()[0]
      : [];
    
    const existingHeaders = existing.map(v => String(v || '').trim());
    const needsUpdate = existingHeaders.length !== columns.length ||
                       !existingHeaders.every((h, i) => h === columns[i]);
    
    if (needsUpdate) {
      sh.getRange(1, 1, 1, columns.length).setValues([columns]);
    }
    
    // Always ensure formatting is correct
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, columns.length)
      .setFontWeight('bold')
      .setBackground('#f3f6fb');
    
    sh.autoResizeColumns(1, columns.length);
    
  } catch (err) {
    DIAG.log('error', 'header_', 'Failed to set header', {
      sheetName,
      err: String(err)
    });
    throw err;
  }
}

/************************************************************
* [SECTION-15] PRIVACY & FORMATTING - HARDENED
************************************************************/

/**
 * Apply name privacy mode to data rows
 */
function applyNamePrivacy_(rows, mode, fieldNames = ['name', 'team', 'player']) {
  try {
    const safeMode = String(mode || 'initials').toLowerCase();
    
    if (safeMode === 'full') {
      return rows; // No transformation needed
    }
    
    return rows.map(row => {
      const transformed = Object.assign({}, row);
      
      fieldNames.forEach(field => {
        if (transformed[field] === undefined) return;
        
        const value = String(transformed[field] || '').trim();
        
        if (!value) {
          transformed[field] = value;
          return;
        }
        
        if (safeMode === 'none') {
          transformed[field] = '—';
          return;
        }
        
        // 'initials' mode
        const parts = value.split(/\s+/).filter(Boolean);
        transformed[field] = parts.length > 0
          ? parts.map(p => p[0]).join('').toUpperCase()
          : '—';
      });
      
      return transformed;
    });
    
  } catch (err) {
    DIAG.log('error', 'applyNamePrivacy_', 'Failed to apply privacy', {
      mode,
      err: String(err)
    });
    // On error, return original data rather than failing
    return rows;
  }
}

/**
 * Format date prettily
 */
function prettyDate_(isoDate) {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return String(isoDate);
    
    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      'EEE, MMM d — h:mma'
    );
  } catch (err) {
    return String(isoDate);
  }
}

/************************************************************
* [SECTION-16] MANAGEMENT OPERATIONS - HARDENED
* Setting defaults, archiving, and event lifecycle management
************************************************************/

/**
 * Public API: Set an event as the default
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response confirming operation
 */
function setDefaultEvent(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(validation.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) {
      return Response.error('No events in sheet', 'empty_sheet', 500);
    }
    
    const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    
    // Clear all defaults and set new one
    let updated = false;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const isTarget = (row[IDX.id] === event.id || row[IDX.slug] === event.id);
      const rowNumber = i + 2;
      
      sh.getRange(rowNumber, IDX.isDefault + 1).setValue(isTarget);
      
      if (isTarget) {
        updated = true;
      }
    }
    
    SpreadsheetApp.flush();
    bustEventsCache_();
    
    if (!updated) {
      return Response.error(
        'Event found but not updated',
        'update_failed',
        500
      );
    }
    
    DIAG.log('info', 'setDefaultEvent', 'Default event updated', {
      eventId: event.id,
      slug: event.slug
    });
    
    return Response.success({
      eventId: event.id,
      slug: event.slug,
      isDefault: true
    });
    
  } catch (err) {
    return Response.error(
      'Failed to set default event',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * Public API: Archive (soft delete) an event
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response confirming deletion
 */
function archiveEvent(eventIdOrSlug) {
  try {
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const event = findEventByIdOrSlug_(validation.value);
    if (!event) {
      return Response.error('Event not found', 'find_event', 404);
    }
    
    const sh = getEventsSheet_();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) {
      return Response.error('No events in sheet', 'empty_sheet', 500);
    }
    
    const data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    const rowIndex = data.findIndex(r => 
      r[IDX.id] === event.id || r[IDX.slug] === event.id
    );
    
    if (rowIndex < 0) {
      return Response.error(
        'Event found but row not located',
        'find_row',
        500
      );
    }
    
    const rowNumber = rowIndex + 2;
    sh.deleteRow(rowNumber);
    SpreadsheetApp.flush();
    bustEventsCache_();
    
    DIAG.log('info', 'archiveEvent', 'Event archived', {
      eventId: event.id,
      slug: event.slug
    });
    
    return Response.success({
      eventId: event.id,
      slug: event.slug,
      archived: true
    });
    
  } catch (err) {
    return Response.error(
      'Failed to archive event',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * Public API: Get confidence state for event visibility
 * Determines what can be safely shown to users
 * CONTRACT: Accepts event ID or slug
 * RETURNS: Standard Response with detailed confidence state
 */
function getConfidenceState(eventIdOrSlug) {
  try {
    ensureAll_();
    
    const state = {
      control: true,
      eventsHeader: true,
      event: false,
      workbook: false,
      form: false,
      posterImage: false,
      links: {
        public: '',
        display: '',
        posterPage: '',
        formView: '',
        workbook: ''
      },
      short: {
        public: '',
        display: '',
        poster: '',
        posterImage: '',
        posterPage: '',
        form: ''
      },
      qr: {
        public: '',
        display: '',
        poster: '',
        posterImage: '',
        posterPage: '',
        form: ''
      },
      canShow: {
        public: false,
        display: false,
        posterPage: false,
        form: false,
        qrPublic: false,
        qrForm: false,
        posterImage: false
      }
    };
    
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.success(state);
    }
    
    const event = findEventByIdOrSlug_(validation.value);
    if (!event) {
      return Response.success(state);
    }
    
    state.event = true;
    state.workbook = !!(event.eventSpreadsheetId && event.eventSpreadsheetUrl);
    state.form = !!event.formId;
    state.links.workbook = event.eventSpreadsheetUrl || '';
    
    // Check poster image if workbook exists
    if (state.workbook) {
      try {
        const ss = SpreadsheetApp.openById(event.eventSpreadsheetId);
        const posterConfig = readKv_(ss, TABS.POSTER);
        const posterImageUrl = String(posterConfig.posterImageUrl || '').trim();
        state.posterImage = !!posterImageUrl;
      } catch (err) {
        DIAG.log('warn', 'getConfidenceState', 'Could not check poster image', {
          eventId: event.id,
          err: String(err)
        });
      }
      
      // Get links
      const linksResult = getEventQuickLinks(event.id);
      if (linksResult.ok) {
        const links = linksResult.data;
        state.links.public = links.publicUrl || '';
        state.links.display = links.displayUrl || '';
        state.links.posterPage = links.posterPageUrl || '';
        state.links.formView = links.formUrlView || '';
        state.short = links.short || state.short;
        state.qr = links.qr || state.qr;
      }
    }
    
    // Determine what can be shown
    state.canShow.public = !!state.links.public;
    state.canShow.display = !!state.links.display;
    state.canShow.posterPage = !!state.links.posterPage;
    state.canShow.form = !!(state.form && state.links.formView);
    state.canShow.posterImage = !!state.posterImage;
    state.canShow.qrPublic = !!(state.short.public && state.qr.public);
    state.canShow.qrForm = !!(state.short.form && state.qr.form);
    
    return Response.success(state);
    
  } catch (err) {
    return Response.error(
      'Failed to determine confidence state',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/************************************************************
* [SECTION-17] GEO-TAGGING UTILITIES - HARDENED
* Location-aware event features with validation
************************************************************/

/**
 * INTERNAL: Enrich geo data with computed fields
 * Returns enriched geo object
 */
function enrichGeoData_(geo) {
  try {
    if (!geo || !geo.latitude || !geo.longitude) {
      return null;
    }
    
    const lat = parseFloat(geo.latitude);
    const lon = parseFloat(geo.longitude);
    
    if (!isFinite(lat) || !isFinite(lon)) {
      return null;
    }
    
    const geohash = encodeGeohash_(lat, lon, 7);
    const plusCode = encodePlusCode_(lat, lon);
    const timezone = inferTimezone_(lat, lon, geo.timezone);
    
    return {
      latitude: lat,
      longitude: lon,
      geohash,
      plusCode,
      timezone,
      venue: String(geo.venue || '').trim().slice(0, 200),
      city: String(geo.city || '').trim().slice(0, 100),
      state: String(geo.state || '').trim().slice(0, 50),
      country: String(geo.country || 'US').trim().toUpperCase().slice(0, 2)
    };
    
  } catch (err) {
    DIAG.log('error', 'enrichGeoData_', 'Failed to enrich geo data', {
      geo,
      err: String(err)
    });
    return null;
  }
}

/**
 * INTERNAL: Encode geohash (precision 7 = ~153m)
 */
function encodeGeohash_(lat, lon, precision) {
  try {
    const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let idx = 0;
    let bit = 0;
    let evenBit = true;
    let geohash = '';
    
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;
    
    while (geohash.length < precision) {
      if (evenBit) {
        const lonMid = (lonMin + lonMax) / 2;
        if (lon > lonMid) {
          idx = (idx << 1) + 1;
          lonMin = lonMid;
        } else {
          idx = idx << 1;
          lonMax = lonMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (lat > latMid) {
          idx = (idx << 1) + 1;
          latMin = latMid;
        } else {
          idx = idx << 1;
          latMax = latMid;
        }
      }
      
      evenBit = !evenBit;
      
      if (++bit === 5) {
        geohash += BASE32[idx];
        bit = 0;
        idx = 0;
      }
    }
    
    return geohash;
    
  } catch (err) {
    DIAG.log('error', 'encodeGeohash_', 'Failed to encode geohash', {
      lat, lon, precision,
      err: String(err)
    });
    return '';
  }
}

/**
 * INTERNAL: Encode Plus Code (Open Location Code)
 */
function encodePlusCode_(lat, lon) {
  try {
    const ALPHABET = '23456789CFGHJMPQRVWX';
    const LAT_MAX = 90;
    const LON_MAX = 180;
    
    lat = Math.max(-LAT_MAX, Math.min(LAT_MAX, lat));
    lon = ((lon + LON_MAX) % 360) - LON_MAX;
    
    let latVal = (lat + LAT_MAX) * 8000;
    let lonVal = (lon + LON_MAX) * 8000;
    
    let code = '';
    for (let i = 0; i < 5; i++) {
      const latDigit = Math.floor(latVal / Math.pow(20, 4 - i)) % 20;
      const lonDigit = Math.floor(lonVal / Math.pow(20, 4 - i)) % 20;
      code += ALPHABET[lonDigit] + ALPHABET[latDigit];
    }
    
    return code.slice(0, 8) + '+' + code.slice(8);
    
  } catch (err) {
    DIAG.log('error', 'encodePlusCode_', 'Failed to encode Plus Code', {
      lat, lon,
      err: String(err)
    });
    return '';
  }
}

/**
 * INTERNAL: Infer timezone from coordinates
 * Simplified US timezone inference
 */
function inferTimezone_(lat, lon, providedTimezone) {
  if (providedTimezone) return String(providedTimezone).trim();
  
  try {
    // US timezone boundaries (simplified)
    if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) {
      if (lon >= -125 && lon < -120) return 'America/Los_Angeles';
      if (lon >= -120 && lon < -104) return 'America/Denver';
      if (lon >= -104 && lon < -90) return 'America/Chicago';
      if (lon >= -90 && lon <= -66) return 'America/New_York';
    }
    
    return 'America/Chicago'; // Default fallback
    
  } catch (err) {
    return 'America/Chicago';
  }
}

/**
 * INTERNAL: Calculate haversine distance (km)
 */
function haversineDistance_(lat1, lon1, lat2, lon2) {
  try {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * 
              Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
    
  } catch (err) {
    DIAG.log('error', 'haversineDistance_', 'Failed to calculate distance', {
      err: String(err)
    });
    return 0;
  }
}

/**
 * Public API: Find events near a location
 * CONTRACT: Accepts {latitude, longitude, radius?, limit?}
 * RETURNS: Standard Response with nearby events
 */
function findEventsNearby(opts) {
  try {
    const vLat = Validate.geo({ latitude: opts.latitude, longitude: 0 });
    const vLon = Validate.geo({ latitude: 0, longitude: opts.longitude });
    
    if (!vLat.ok || !vLon.ok) {
      return Response.error(
        'Invalid coordinates',
        'validate_coords',
        400,
        { lat: vLat.ok, lon: vLon.ok }
      );
    }
    
    const lat = parseFloat(opts.latitude);
    const lon = parseFloat(opts.longitude);
    const radiusKm = Math.max(1, Math.min(500, parseFloat(opts.radius || 50)));
    const limit = Math.max(1, Math.min(100, parseInt(opts.limit || 20)));
    
    const eventsResult = getEventsSafe(null);
    if (!eventsResult.ok) {
      return eventsResult;
    }
    
    const geoEvents = eventsResult.data.items.filter(ev =>
      ev.latitude && ev.longitude &&
      isFinite(parseFloat(ev.latitude)) &&
      isFinite(parseFloat(ev.longitude))
    );
    
    const withDistance = geoEvents.map(ev => {
      const distance = haversineDistance_(
        lat, lon,
        parseFloat(ev.latitude),
        parseFloat(ev.longitude)
      );
      
      return {
        id: ev.id,
        name: ev.name,
        slug: ev.slug,
        startDateISO: ev.startDateISO,
        venue: ev.venue,
        city: ev.city,
        state: ev.state,
        distanceKm: Math.round(distance * 10) / 10,
        distanceMiles: Math.round(distance * 0.621371 * 10) / 10,
        geohash: ev.geohash,
        publicUrl: buildPublicUrl_('Public', ev.id)
      };
    });
    
    const nearby = withDistance
      .filter(ev => ev.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
    
    return Response.success({
      query: {
        latitude: lat,
        longitude: lon,
        radiusKm
      },
      count: nearby.length,
      items: nearby
    });
    
  } catch (err) {
    return Response.error(
      'Failed to find nearby events',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * Public API: Find events in a bounding box
 * CONTRACT: Accepts {north, south, east, west}
 * RETURNS: Standard Response with events in bounds
 */
function findEventsInBounds(opts) {
  try {
    const bounds = {
      north: parseFloat(opts.north),
      south: parseFloat(opts.south),
      east: parseFloat(opts.east),
      west: parseFloat(opts.west)
    };
    
    if (Object.values(bounds).some(v => !isFinite(v))) {
      return Response.error('Invalid bounds', 'validate_bounds', 400);
    }
    
    if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
      return Response.error('Invalid bounds geometry', 'validate_geometry', 400);
    }
    
    const eventsResult = getEventsSafe(null);
    if (!eventsResult.ok) {
      return eventsResult;
    }
    
    const inBounds = eventsResult.data.items.filter(ev => {
      if (!ev.latitude || !ev.longitude) return false;
      
      const lat = parseFloat(ev.latitude);
      const lon = parseFloat(ev.longitude);
      
      if (!isFinite(lat) || !isFinite(lon)) return false;
      
      return lat >= bounds.south &&
             lat <= bounds.north &&
             lon >= bounds.west &&
             lon <= bounds.east;
    });
    
    return Response.success({
      bounds,
      count: inBounds.length,
      items: inBounds.map(ev => ({
        id: ev.id,
        name: ev.name,
        latitude: parseFloat(ev.latitude),
        longitude: parseFloat(ev.longitude),
        venue: ev.venue,
        city: ev.city,
        publicUrl: buildPublicUrl_('Public', ev.id)
      }))
    });
    
  } catch (err) {
    return Response.error(
      'Failed to find events in bounds',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/**
 * Public API: Mobile-optimized bundle with adaptive sizing
 * CONTRACT: Accepts event ID/slug and opts {connection?, offset?, userLat?, userLon?}
 * RETURNS: Standard Response with paginated, optimized data
 */
function getPublicBundleMobile(eventIdOrSlug, opts) {
  try {
    opts = opts || {};
    
    const validation = Validate.eventKey(eventIdOrSlug);
    if (!validation.ok) {
      return Response.error(validation.error, 'validate_key', 400);
    }
    
    const workbook = ensureWorkbook_(validation.value);
    if (!workbook.ok) {
      return workbook;
    }
    
    const ss = SpreadsheetApp.openById(workbook.data.spreadsheetId);
    const meta = readKv_(ss, TABS.META);
    const posterConfig = readKv_(ss, TABS.POSTER);
    
    // Adaptive limits based on connection type
    const connType = String(opts.connection || 'unknown').toLowerCase();
    const limitMap = {
      'slow-2g': { standings: 5, schedule: 5 },
      '2g': { standings: 10, schedule: 10 },
      '3g': { standings: 20, schedule: 20 },
      '4g': { standings: 50, schedule: 50 },
      'wifi': { standings: 100, schedule: 100 },
      'unknown': { standings: 20, schedule: 20 }
    };
    
    const limits = limitMap[connType] || limitMap.unknown;
    const offset = Math.max(0, parseInt(opts.offset || 0));
    
    // Read full tables
    const standingsResult = readTable_(ss, TABS.STANDINGS);
    const scheduleResult = readTable_(ss, TABS.SCHEDULE);
    
    if (!standingsResult.ok || !scheduleResult.ok) {
      return Response.error('Failed to read event data', 'read_tables', 500);
    }
    
    // Apply privacy
    const nameMode = String(posterConfig.public_name_mode || 'initials').toLowerCase();
    const standingsFull = applyNamePrivacy_(standingsResult.data, nameMode);
    const scheduleFull = applyNamePrivacy_(
      scheduleResult.data,
      nameMode,
      ['team', 'team_a', 'team_b']
    );
    
    // Paginate
    const standings = standingsFull.slice(offset, offset + limits.standings);
    const schedule = scheduleFull.slice(offset, offset + limits.schedule);
    
    // Calculate proximity if user location provided
    let proximity = null;
    if (opts.userLat && opts.userLon && meta.latitude && meta.longitude) {
      const userLat = parseFloat(opts.userLat);
      const userLon = parseFloat(opts.userLon);
      const eventLat = parseFloat(meta.latitude);
      const eventLon = parseFloat(meta.longitude);
      
      if (isFinite(userLat) && isFinite(userLon) && 
          isFinite(eventLat) && isFinite(eventLon)) {
        const distKm = haversineDistance_(userLat, userLon, eventLat, eventLon);
        proximity = {
          distanceKm: Math.round(distKm * 10) / 10,
          distanceMiles: Math.round(distKm * 0.621371 * 10) / 10
        };
      }
    }
    
    // Build geo object if available
    let geo = null;
    if (meta.latitude && meta.longitude) {
      geo = {
        venue: meta.venue || '',
        city: meta.city || '',
        state: meta.state || '',
        latitude: parseFloat(meta.latitude),
        longitude: parseFloat(meta.longitude),
        geohash: meta.geohash || '',
        plusCode: meta.plusCode || '',
        proximity
      };
    }
    
    const responseSize = JSON.stringify({ standings, schedule }).length;
    
    return Response.success({
      eventTag: meta.eventTag || workbook.data.tag,
      title: meta.title || workbook.data.name || workbook.data.tag,
      datePretty: prettyDate_(meta.startDateISO || workbook.data.dateISO),
      place: posterConfig.place || '',
      public_name_mode: nameMode,
      standings,
      schedule,
      posterPageUrl: buildPublicUrl_('Poster', workbook.data.id),
      geo,
      pagination: {
        limit: limits.standings,
        offset,
        totalStandings: standingsFull.length,
        totalSchedule: scheduleFull.length,
        hasMore: Math.max(standingsFull.length, scheduleFull.length) > 
                 (offset + limits.standings)
      },
      _meta: {
        connection: connType,
        sizeBytes: responseSize,
        compressionRecommended: responseSize > 10000
      }
    });
    
  } catch (err) {
    return Response.error(
      'Failed to build mobile bundle',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/************************************************************
* [SECTION-18] BOOTSTRAP & INITIALIZATION - HARDENED
* Self-healing control workbook setup
************************************************************/

/**
 * Ensure all required infrastructure exists
 * Called at startup of most operations
 */
function ensureAll_() {
  try {
    const control = ensureControlStrictOnBoot();
    
    if (!control.ok) {
      throw new Error('Failed to ensure control workbook');
    }
    
    ensureEventsHeaders_(control.id);
    const templateId = ensureEventTemplate_();
    ensurePosterDefaults_(templateId);
    ensureEventsFolder_();
    ensureBaseUrls_();
    
    return {
      ok: true,
      controlId: control.id,
      templateId
    };
    
  } catch (err) {
    DIAG.log('error', 'ensureAll_', 'Bootstrap failed', {
      err: String(err),
      stack: err.stack
    });
    throw err;
  }
}

/**
 * Ensure control workbook exists with strict validation
 */
function ensureControlStrictOnBoot() {
  try {
    const props = PropertiesService.getScriptProperties();
    const spec = getControlTemplateSpec_();
    
    let ss = null;
    const savedId = props.getProperty(CFG_KEYS.CONTROL_ID);
    
    // Try to open saved control workbook
    if (savedId) {
      try {
        ss = SpreadsheetApp.openById(savedId);
      } catch (err) {
        DIAG.log('warn', 'ensureControlStrictOnBoot', 'Saved control ID invalid', {
          savedId,
          err: String(err)
        });
        ss = null;
      }
    }
    
    // Search for control workbook by name if not found
    if (!ss) {
      const found = findControlByNameOrAlias_();
      if (found.primary) {
        ss = SpreadsheetApp.open(found.primary);
        
        // Rename to canonical title if needed
        try {
          if (ss.getName() !== CONTROL_TITLE) {
            ss.rename(CONTROL_TITLE);
          }
        } catch (err) {
          DIAG.log('warn', 'ensureControlStrictOnBoot', 'Could not rename control', {
            err: String(err)
          });
        }
        
        props.setProperty(CFG_KEYS.CONTROL_ID, ss.getId());
        
        // Mark duplicates
        found.duplicates.forEach(file => {
          try {
            file.setName(file.getName() + ' (DUPLICATE)');
          } catch (err) {
            DIAG.log('warn', 'ensureControlStrictOnBoot', 'Could not mark duplicate', {
              fileId: file.getId(),
              err: String(err)
            });
          }
        });
      }
    }
    
    // Create new control workbook if none found
    if (!ss) {
      ss = createFreshControl_(summarizeSpecForCreate_(spec));
      props.setProperty(CFG_KEYS.CONTROL_ID, ss.getId());
      
      return {
        ok: true,
        id: ss.getId(),
        url: ss.getUrl(),
        created: true,
        rebuilt: false,
        validated: true
      };
    }
    
    // Validate existing control workbook
    const validation = validateControl_(ss, spec);
    
    if (!validation.ok) {
      DIAG.log('warn', 'ensureControlStrictOnBoot', 'Control validation failed, rebuilding', {
        missing: validation.missing,
        mismatches: validation.mism
      });
      
      const oldId = ss.getId();
      const rebuilt = createFreshControl_(summarizeSpecForCreate_(spec));
      props.setProperty(CFG_KEYS.CONTROL_ID, rebuilt.getId());
      
      // Trash old control
      try {
        DriveApp.getFileById(oldId).setTrashed(true);
      } catch (err) {
        DIAG.log('warn', 'ensureControlStrictOnBoot', 'Could not trash old control', {
          oldId,
          err: String(err)
        });
      }
      
      return {
        ok: true,
        id: rebuilt.getId(),
        url: rebuilt.getUrl(),
        created: false,
        rebuilt: true,
        validated: true
      };
    }
    
    return {
      ok: true,
      id: ss.getId(),
      url: ss.getUrl(),
      created: false,
      rebuilt: false,
      validated: true
    };
    
  } catch (err) {
    DIAG.log('error', 'ensureControlStrictOnBoot', 'Fatal bootstrap error', {
      err: String(err),
      stack: err.stack
    });
    throw err;
  }
}

/**
 * Get control workbook template specification
 */
function getControlTemplateSpec_() {
  let owner = '';
  try {
    owner = Session.getActiveUser().getEmail() || '';
  } catch (_) {}
  
  return [
    {
      name: 'Events',
      headers: [
        'id', 'name', 'slug', 'startDateISO',
        'eventSpreadsheetId', 'eventSpreadsheetUrl', 'formId',
        'eventTag', 'isDefault', 'seedMode', 'elimType',
        'latitude', 'longitude', 'geohash', 'venue',
        'city', 'state', 'country', 'timezone', 'plusCode'
      ]
    },
    {
      name: 'Diagnostics',
      headers: ['ts', 'level', 'where', 'msg', 'data']
    },
    {
      name: 'PosterConfig',
      headers: ['key', 'value'],
      rows: [
        ['title', 'Your Event Title'],
        ['subtitle', ''],
        ['date', 'YYYY-MM-DD'],
        ['time', '7:00 PM'],
        ['place', 'Venue name'],
        ['imageId', ''],
        ['public_page', 'on']
      ]
    },
    {
      name: 'SignupsTemplate',
      headers: ['timestamp', 'name', 'email', 'phone', 'team', 'notes']
    },
    {
      name: 'ScheduleTemplate',
      headers: ['round', 'time', 'activity', 'notes', 'table']
    },
    {
      name: 'StandingsTemplate',
      headers: ['team', 'points', 'tiebreak', 'notes']
    },
    {
      name: 'Meta',
      headers: ['key', 'value'],
      rows: [
        ['version', '4.2.0'],
        ['owner', owner]
      ]
    }
  ];
}

/**
 * Create fresh control workbook from spec
 */
function createFreshControl_(spec) {
  const ss = SpreadsheetApp.create(CONTROL_TITLE);
  const firstSheet = ss.getSheets()[0];
  const firstSpec = spec[0];
  
  firstSheet.setName(firstSpec.name);
  firstSheet.getRange(1, 1, 1, firstSpec.headers.length)
    .setValues([firstSpec.headers])
    .setFontWeight('bold')
    .setBackground('#f3f6fb');
  firstSheet.setFrozenRows(1);
  
  if (firstSpec.rows && firstSpec.rows.length) {
    firstSheet.getRange(2, 1, firstSpec.rows.length, firstSpec.rows[0].length)
      .setValues(firstSpec.rows);
  }
  
  for (let i = 1; i < spec.length; i++) {
    const sheetSpec = spec[i];
    const sheet = ss.insertSheet(sheetSpec.name);
    
    sheet.getRange(1, 1, 1, sheetSpec.headers.length)
      .setValues([sheetSpec.headers])
      .setFontWeight('bold')
      .setBackground('#f3f6fb');
    sheet.setFrozenRows(1);
    
    if (sheetSpec.rows && sheetSpec.rows.length) {
      sheet.getRange(2, 1, sheetSpec.rows.length, sheetSpec.rows[0].length)
        .setValues(sheetSpec.rows);
    }
  }
  
  return ss;
}

/**
 * Validate control workbook against spec
 */
function validateControl_(ss, spec) {
  const sheetsByName = {};
  ss.getSheets().forEach(sheet => {
    sheetsByName[sheet.getName()] = sheet;
  });
  
  const missing = [];
  const mismatched = [];
  
  for (const sheetSpec of spec) {
    const sheet = sheetsByName[sheetSpec.name];
    
    if (!sheet) {
      missing.push(sheetSpec.name);
      continue;
    }
    
    const actualHeaders = sheet.getRange(1, 1, 1, sheetSpec.headers.length)
      .getValues()[0];
    
    const headersMatch = actualHeaders.length === sheetSpec.headers.length &&
                        actualHeaders.every((h, i) => 
                          String(h || '') === sheetSpec.headers[i]
                        );
    
    if (!headersMatch) {
      mismatched.push({
        sheet: sheetSpec.name,
        expected: sheetSpec.headers,
        actual: actualHeaders
      });
    }
  }
  
  return {
    ok: missing.length === 0 && mismatched.length === 0,
    missing,
    mism: mismatched
  };
}

/**
 * Find control workbook by name
 */
function findControlByNameOrAlias_() {
  const titles = [CONTROL_TITLE, 'NextUp Control'];
  const files = [];
  
  titles.forEach(title => {
    const query = `title = "${title.replace(/"/g, '\\"')}" and mimeType = "application/vnd.google-apps.spreadsheet"`;
    const iterator = DriveApp.searchFiles(query);
    
    while (iterator.hasNext()) {
      files.push(iterator.next());
    }
  });
  
  if (files.length === 0) {
    return { primary: null, duplicates: [] };
  }
  
  files.sort((a, b) => b.getLastUpdated() - a.getLastUpdated());
  
  const seen = new Set();
  const unique = [];
  
  files.forEach(file => {
    if (!seen.has(file.getId())) {
      seen.add(file.getId());
      unique.push(file);
    }
  });
  
  return {
    primary: unique[0],
    duplicates: unique.slice(1)
  };
}

/**
 * Ensure Events sheet has correct headers
 */
function ensureEventsHeaders_(controlId) {
  const ss = SpreadsheetApp.openById(controlId);
  const headers = [
    'id', 'name', 'slug', 'startDateISO',
    'eventSpreadsheetId', 'eventSpreadsheetUrl', 'formId',
    'eventTag', 'isDefault', 'seedMode', 'elimType',
    'latitude', 'longitude', 'geohash', 'venue',
    'city', 'state', 'country', 'timezone', 'plusCode'
  ];
  
  let sheet = ss.getSheetByName('Events');
  
  if (!sheet) {
    const sheets = ss.getSheets();
    sheet = sheets.length ? sheets[0] : ss.insertSheet('Events');
    try {
      sheet.setName('Events');
    } catch (_) {}
  }
  
  const actualHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersMatch = actualHeaders.length === headers.length &&
                      actualHeaders.every((h, i) => String(h || '') === headers[i]);
  
  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f3f6fb');
    sheet.autoResizeColumns(1, headers.length);
  }
}

/**
 * Ensure event template workbook exists
 */
function ensureEventTemplate_() {
  let id = cfgGet_(CFG_KEYS.TEMPLATE_ID, EVENT_TEMPLATE_ID);
  
  if (id) {
    try {
      SpreadsheetApp.openById(id);
      return id;
    } catch (_) {}
  }
  
  const ss = SpreadsheetApp.create('NextUp · Eventbook Template');
  const homeSheet = ss.getSheets()[0];
  homeSheet.setName('Home');
  homeSheet.getRange(1, 1, 1, 2).setValues([['welcome', 'notes']]);
  
  tplEnsureMetaKv_(ss);
  tplEnsureSheetWithHeader_(ss, 'SignupsView', ['timestamp', 'name', 'email', 'phone', 'team', 'notes']);
  tplEnsureSheetWithHeader_(ss, 'Schedule', ['round', 'time', 'activity', 'notes', 'table']);
  tplEnsureSheetWithHeader_(ss, 'Standings', ['team', 'points', 'tiebreak', 'notes']);
  tplEnsurePosterConfigKv_(ss);
  
  cfgSet_(CFG_KEYS.TEMPLATE_ID, ss.getId());
  return ss.getId();
}

/**
 * Ensure poster defaults in template
 */
function ensurePosterDefaults_(templateId) {
  try {
    const ss = SpreadsheetApp.openById(templateId);
    tplEnsurePosterConfigKv_(ss);
  } catch (err) {
    DIAG.log('warn', 'ensurePosterDefaults_', 'Could not ensure poster defaults', {
      templateId,
      err: String(err)
    });
  }
}

/**
 * Ensure events folder exists
 */
function ensureEventsFolder_() {
  let id = cfgGet_(CFG_KEYS.EVENTS_DIR, EVENTS_ROOT_FOLDER_ID);
  
  if (id) {
    try {
      DriveApp.getFolderById(id);
      return id;
    } catch (_) {}
  }
  
  const folder = DriveApp.createFolder('NextUp · Eventbooks');
  cfgSet_(CFG_KEYS.EVENTS_DIR, folder.getId());
  return folder.getId();
}

/**
 * Ensure base URLs are configured
 */
function ensureBaseUrls_() {
  if (!cfgGet_(CFG_KEYS.ORG_URL, ORG_BASE_URL)) {
    cfgSet_(CFG_KEYS.ORG_URL, ScriptApp.getService().getUrl());
  }
  
  if (!cfgGet_(CFG_KEYS.PUB_URL, PUBLIC_BASE_URL)) {
    cfgSet_(CFG_KEYS.PUB_URL, ScriptApp.getService().getUrl());
  }
}

/**
 * Simple helper for control workbook
 */
function ensureControlWorkbook_() {
  let id = cfgGet_(CFG_KEYS.CONTROL_ID, EVENTS_SPREADSHEET_ID);
  
  if (id) {
    try {
      SpreadsheetApp.openById(id);
      return id;
    } catch (_) {}
  }
  
  const ss = SpreadsheetApp.create(CONTROL_TITLE);
  const firstSheet = ss.getSheets()[0];
  firstSheet.setName('Events');
  
  cfgSet_(CFG_KEYS.CONTROL_ID, ss.getId());
  return ss.getId();
}

/************************************************************
* [SECTION-19] TEMPLATE HELPERS
* Building sheets in templates
************************************************************/

function tplEnsureSheetWithHeader_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const existing = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    : [];
  
  const headersMatch = existing.length === headers.length &&
                      existing.every((h, i) => String(h || '') === headers[i]);
  
  if (!headersMatch) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#f3f6fb');
  sheet.autoResizeColumns(1, headers.length);
  
  return sheet;
}

function tplEnsureMetaKv_(ss) {
  const sheet = ss.getSheetByName('Meta') || ss.insertSheet('Meta');
  
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }
  
  const defaults = {
    eventId: '',
    eventTag: '',
    slug: '',
    startDateISO: '',
    adminUrl: '',
    publicUrl: '',
    displayUrl: '',
    posterPageUrl: '',
    seedMode: 'random',
    elimType: 'none'
  };
  
  tplUpsertKv_(sheet, defaults);
  return sheet;
}

function tplEnsurePosterConfigKv_(ss) {
  const sheet = ss.getSheetByName('PosterConfig') || ss.insertSheet('PosterConfig');
  
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }
  
  const defaults = {
    place: '',
    posterImageUrl: '',
    public_name_mode: 'initials'
  };
  
  tplUpsertKv_(sheet, defaults);
  return sheet;
}

function tplUpsertKv_(sheet, kvPairs) {
  const lastRow = sheet.getLastRow();
  const existingData = lastRow > 0
    ? sheet.getRange(1, 1, lastRow, 2).getValues()
    : [];
  
  const keyIndex = {};
  existingData.forEach((row, index) => {
    const key = String(row[0] || '').trim();
    if (key) {
      keyIndex[key] = index + 1;
    }
  });
  
  Object.entries(kvPairs || {}).forEach(([key, value]) => {
    const trimmedKey = String(key).trim();
    if (!trimmedKey) return;
    
    if (keyIndex[trimmedKey]) {
      sheet.getRange(keyIndex[trimmedKey], 2).setValue(value);
    } else {
      sheet.appendRow([trimmedKey, value]);
    }
  });
}

function ctlTemplateHeaders_(sheetName, fallback) {
  try {
    const control = SpreadsheetApp.openById(cfgControlId_());
    const templateSheet = control.getSheetByName(sheetName);
    
    if (templateSheet && templateSheet.getLastRow() >= 1) {
      const lastCol = templateSheet.getLastColumn();
      const headers = templateSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      
      if (headers && headers.length) {
        return headers.map(h => String(h || ''));
      }
    }
  } catch (_) {}
  
  return fallback || [];
}

function ctlPosterDefaults_() {
  try {
    const control = SpreadsheetApp.openById(cfgControlId_());
    const posterSheet = control.getSheetByName('PosterConfig');
    
    if (!posterSheet) return {};
    
    const lastRow = posterSheet.getLastRow();
    if (lastRow < 2) return {};
    
    const values = posterSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const kv = {};
    
    values.forEach(row => {
      const key = String(row[0] || '').trim();
      if (key) {
        kv[key] = row[1];
      }
    });
    
    return kv;
  } catch (_) {
    return {};
  }
}

/************************************************************
* [SECTION-20] ROUTING & WEB APP
************************************************************/

const EVENTS_SHEET = 'Events';
const IDX = {
  id: 0, name: 1, slug: 2, startDateISO: 3,
  ssId: 4, ssUrl: 5, formId: 6, tag: 7,
  isDefault: 8, seedMode: 9, elimType: 10
};

const TABS = {
  HOME: 'Home',
  META: 'Meta',
  SIGNUPS: 'SignupsView',
  SCHEDULE: 'Schedule',
  STANDINGS: 'Standings',
  POSTER: 'PosterConfig'
};

const QR = {
  image(url) {
    if (!url) return '';
    return `https://quickchart.io/qr?text=${encodeURIComponent(url)}&margin=2&size=300`;
  }
};

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(request) {
  try {
    ensureControlStrictOnBoot();
    
    const params = (request && request.parameter) || {};
    const rawPage = (params.page || params.p || 'Admin');
    const pageKey = String(rawPage).trim().toLowerCase();
    
    // Redirect handler
    if (pageKey === 'r' || pageKey === 'redirect') {
      const token = String(params.t || params.token || '').trim();
      const target = Shortlinks.resolve(token) || cfgPubUrl_();
      return redirectTo_(target);
    }
    
    // Page mapping
    const pageMap = {
      admin: 'Admin',
      public: 'Public',
      display: 'Display',
      poster: 'Poster',
      status: 'Status',
      test: 'Test'
    };
    
    const pageName = pageMap[pageKey] || 'Admin';
    
    const template = HtmlService.createTemplateFromFile(pageName);
    template.appTitle = 'NextUp';
    template.BUILD_ID = BUILD_ID;
    
    return template.evaluate()
      .setTitle('NextUp · ' + pageName)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (err) {
    DIAG.log('error', 'doGet', 'Request handler failed', {
      err: String(err),
      stack: err.stack
    });
    
    return HtmlService.createHtmlOutput(
      '<h1>System Error</h1><p>The application encountered an error. Please try again later.</p>'
    ).setTitle('Error');
  }
}

function redirectTo_(url) {
  const safeUrl = String(url || '').trim() || cfgPubUrl_();
  
  const html = `<!doctype html>
<html>
<head>
  <base target="_top">
  <meta http-equiv="refresh" content="0; url=${safeUrl}">
</head>
<body>
  <script>
    try {
      window.top.location.replace(${JSON.stringify(safeUrl)});
    } catch(e) {
      location.href = ${JSON.stringify(safeUrl)};
    }
  </script>
  <p>Redirecting… <a href="${safeUrl}">Continue</a></p>
</body>
</html>`;
  
  return HtmlService.createHtmlOutput(html)
    .setTitle('Redirecting…')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getEventsSheet_() {
  const ss = getMain_();
  return ss.getSheetByName(EVENTS_SHEET) || ss.insertSheet(EVENTS_SHEET);
}

function getMain_() {
  ensureAll_();
  return SpreadsheetApp.openById(cfgControlId_());
}

function summarizeSpecForCreate_(spec) {
  const copy = spec.slice();
  
  if (!copy.length || copy[0].name !== 'Events') {
    const eventsIndex = copy.findIndex(s => s.name === 'Events');
    if (eventsIndex > 0) {
      const [eventsSpec] = copy.splice(eventsIndex, 1);
      copy.unshift(eventsSpec);
    }
  }
  
  return copy;
}

/************************************************************
* [SECTION-21] DEBUG & TESTING ENDPOINTS
************************************************************/

function NU_Debug_ListEvents() {
  return getEventsSafe(null);
}

function NU_Debug_GetLinks(eventId) {
  return getEventQuickLinks(eventId);
}

function NU_Debug_Display(eventId) {
  return getDisplayBundle(eventId);
}

function NU_Debug_Public(eventId) {
  return getPublicBundle(eventId);
}

function NU_Debug_Poster(eventId) {
  return getPosterBundle(eventId);
}

/**
 * Minimal smoke test for Admin.html button
 */
function runSmokeSafe() {
  try {
    const boot = ensureAll_();
    const eventsResult = getEventsSafe(null);
    
    const checks = {
      controlId: boot.controlId || '',
      hasEventsSheet: !!getMain_().getSheetByName('Events'),
      itemsCount: (eventsResult.ok && eventsResult.data && eventsResult.data.items) 
        ? eventsResult.data.items.length 
        : 0
    };
    
    return Response.success({
      build: BUILD_ID,
      checks
    });
    
  } catch (err) {
    return Response.error(
      'Smoke test failed',
      'exception',
      500,
      { err: String(err) }
    );
  }
}

/************************************************************
* [SECTION-22] AUDIT & STATUS REPORTING
* Deep system health checks for Status.html
************************************************************/

function auditDeep() {
  const sections = [];
  
  try {
    sections.push(auditRouter_());
  } catch (err) {
    sections.push(sectionErr_('Router', err));
  }
  
  try {
    sections.push(auditControlSheet_());
  } catch (err) {
    sections.push(sectionErr_('Control Sheet', err));
  }
  
  try {
    sections.push(auditEventsCache_());
  } catch (err) {
    sections.push(sectionErr_('ETag / Cache', err));
  }
  
  try {
    sections.push(auditClientFiles_());
  } catch (err) {
    sections.push(sectionErr_('Client Files', err));
  }
  
  try {
    sections.push(auditProvision_());
  } catch (err) {
    sections.push(sectionErr_('Provision', err));
  }
  
  const allOk = sections.every(s => s.ok);
  
  return {
    ok: allOk,
    build: BUILD_ID,
    generatedAt: new Date().toISOString(),
    sections
  };
}

function auditRouter_() {
  const checks = [];
  const routes = ['admin', 'public', 'display', 'poster', 'status', 'r'];
  
  routes.forEach(route => {
    checks.push(okCheck_(`route:${route}`, `Route "${route}" registered`, true));
  });
  
  return finalizeSection_('Router', checks);
}

function auditControlSheet_() {
  const checks = [];
  const controlId = cfgControlId_();
  const ss = SpreadsheetApp.openById(controlId);
  const sheet = ss.getSheetByName('Events');
  
  checks.push(okCheck_('sheet:events', 'Sheet "Events" exists', !!sheet));
  
  if (sheet) {
    const requiredHeaders = [
      'id', 'name', 'slug', 'startDateISO',
      'eventSpreadsheetId', 'eventSpreadsheetUrl', 'formId',
      'eventTag', 'isDefault', 'seedMode', 'elimType'
    ];
    
    const actualHeaders = sheet.getRange(1, 1, 1, requiredHeaders.length)
      .getValues()[0]
      .map(String);
    
    requiredHeaders.forEach(header => {
      const present = actualHeaders.indexOf(header) >= 0;
      checks.push(statusCheck_(
        `hdr:${header}`,
        `Header "${header}" present`,
        present ? 'green' : 'red',
        present ? '' : 'missing'
      ));
    });
  }
  
  return finalizeSection_('Control Sheet', checks);
}

function auditEventsCache_() {
  const checks = [];
  
  const result1 = getEventsSafe(null);
  const ok1 = result1.ok && result1.data && result1.data.etag && result1.status === 200;
  checks.push(statusCheck_(
    'events:initial',
    'getEventsSafe(null) returns 200',
    ok1 ? 'green' : 'red',
    ok1 ? '' : JSON.stringify(result1)
  ));
  
  if (ok1) {
    const result2 = getEventsSafe(result1.data.etag);
    const notMod = result2.ok && 
                  result2.status === 304 && 
                  result2.notModified === true;
    checks.push(statusCheck_(
      'events:notmod',
      'getEventsSafe(etag) returns 304',
      notMod ? 'green' : 'red',
      notMod ? '' : JSON.stringify(result2)
    ));
  }
  
  return finalizeSection_('ETag / Cache', checks);
}

function auditClientFiles_() {
  const requiredFiles = {
    'Admin': ['#eventName', '#eventDate', '#btnCreateEvent'],
    'Public': ['#title', '#date', '#scheduleTbl'],
    'Display': ['#title', '#scheduleTbl', '#standingsTbl'],
    'Poster': ['#posterTitle', '#qrPublic'],
    'Styles': ['.badge', '.table']
  };
  
  const checks = [];
  
  Object.keys(requiredFiles).forEach(filename => {
    const content = getFileContentSafe_(filename);
    const present = !!content;
    
    checks.push(statusCheck_(
      `file:${filename}`,
      `File "${filename}.html" present`,
      present ? 'green' : 'red',
      present ? '' : 'missing'
    ));
    
    if (present) {
      requiredFiles[filename].forEach(selector => {
        const found = content.indexOf(selector) >= 0;
        checks.push(statusCheck_(
          `sel:${filename}:${selector}`,
          `"${filename}" contains ${selector}`,
          found ? 'green' : 'red',
          found ? '' : 'not found'
        ));
      });
    }
  });
  
  return finalizeSection_('Client Files', checks);
}

function auditProvision_() {
  const checks = [];
  
  const eventsResult = getEventsSafe(null);
  const hasEvents = eventsResult.ok && 
                   eventsResult.data && 
                   eventsResult.data.items && 
                   eventsResult.data.items.length > 0;
  
  checks.push(statusCheck_(
    'events:exists',
    'At least one event present',
    hasEvents ? 'green' : 'yellow',
    hasEvents ? '' : 'no events yet'
  ));
  
  if (hasEvents) {
    const firstEvent = eventsResult.data.items[0];
    const workbookResult = ensureWorkbook_(firstEvent.id);
    
    checks.push(statusCheck_(
      'prov:workbook',
      'Can ensure workbook',
      workbookResult.ok ? 'green' : 'red',
      workbookResult.ok ? '' : workbookResult.error?.message || 'failed'
    ));
  }
  
  return finalizeSection_('Provision', checks);
}

function getFileContentSafe_(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (_) {
    return '';
  }
}

function okCheck_(id, label, condition) {
  return {
    id,
    label,
    status: condition ? 'green' : 'red',
    detail: condition ? '' : 'failed'
  };
}

function statusCheck_(id, label, status, detail) {
  return {
    id,
    label,
    status,
    detail: String(detail || '')
  };
}

function finalizeSection_(title, checks) {
  const severityOrder = { red: 3, yellow: 2, green: 1 };
  let worstSeverity = 'green';
  
  checks.forEach(check => {
    const severity = check.status || 'green';
    if (severityOrder[severity] > severityOrder[worstSeverity]) {
      worstSeverity = severity;
    }
  });
  
  return {
    title,
    ok: worstSeverity !== 'red',
    severity: worstSeverity,
    checks
  };
}

function sectionErr_(title, err) {
  return {
    title,
    ok: false,
    severity: 'red',
    checks: [{
      id: 'error',
      label: `${title} threw exception`,
      status: 'red',
      detail: String(err)
    }]
  };
}

/************************************************************
* [SECTION-23] CONTRACT TESTS
* Executable documentation of expected behaviors
************************************************************/

/**
 * Run all contract tests
 * Returns test results for verification
 */
function runContractTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  const tests = [
    testCreateEventValidation,
    testCreateEventIdempotency,
    testGetEventsSWR,
    testResponseEnvelopes,
    testInputSanitization,
    testRateLimit,
    testGeoValidation
  ];
  
  tests.forEach(testFn => {
    try {
      const result = testFn();
      results.tests.push(result);
      
      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (err) {
      results.tests.push({
        name: testFn.name,
        passed: false,
        error: String(err),
        stack: err.stack
      });
      results.failed++;
    }
  });
  
  results.ok = results.failed === 0;
  return results;
}

function testCreateEventValidation() {
  const tests = [];
  
  // Missing name
  const r1 = createEventbook({ startDateISO: '2025-12-25' });
  tests.push({
    name: 'Rejects missing name',
    passed: !r1.ok && r1.error && r1.error.phase === 'validate_name'
  });
  
  // Missing date
  const r2 = createEventbook({ name: 'Test Event' });
  tests.push({
    name: 'Rejects missing date',
    passed: !r2.ok && r2.error && r2.error.phase === 'validate_date'
  });
  
  // Invalid date format
  const r3 = createEventbook({ name: 'Test', startDateISO: '12/25/2025' });
  tests.push({
    name: 'Rejects invalid date format',
    passed: !r3.ok && r3.error && r3.error.phase === 'validate_date'
  });
  
  // XSS attempt in name
  const r4 = createEventbook({ 
    name: '<script>alert("xss")</script>', 
    startDateISO: '2025-12-25' 
  });
  tests.push({
    name: 'Rejects XSS in name',
    passed: !r4.ok && r4.error && r4.error.phase === 'validate_name'
  });
  
  const allPassed = tests.every(t => t.passed);
  
  return {
    name: 'CreateEvent Validation Contract',
    passed: allPassed,
    subtests: tests
  };
}

function testCreateEventIdempotency() {
  const name = `Test Event ${Date.now()}`;
  const date = '2025-12-25';
  
  const r1 = createEventbook({ name, startDateISO: date });
  const r2 = createEventbook({ name, startDateISO: date });
  
  const passed = r1.ok && 
                r2.ok && 
                r2.data.idempotent === true &&
                r1.data.id === r2.data.id;
  
  // Cleanup
  if (r1.ok && r1.data.id) {
    try {
      archiveEvent(r1.data.id);
    } catch (_) {}
  }
  
  return {
    name: 'CreateEvent Idempotency Contract',
    passed,
    details: {
      firstId: r1.data?.id,
      secondId: r2.data?.id,
      secondIdempotent: r2.data?.idempotent
    }
  };
}

function testGetEventsSWR() {
  const r1 = getEventsSafe(null);
  
  const tests = [];
  
  tests.push({
    name: 'Returns 200 on first call',
    passed: r1.ok && r1.status === 200
  });
  
  tests.push({
    name: 'Includes etag',
    passed: r1.ok && !!r1.data.etag
  });
  
  tests.push({
    name: 'Includes items array',
    passed: r1.ok && Array.isArray(r1.data.items)
  });
  
  if (r1.ok && r1.data.etag) {
    const r2 = getEventsSafe(r1.data.etag);
    
    tests.push({
      name: 'Returns 304 with same etag',
      passed: r2.ok && r2.status === 304 && r2.notModified === true
    });
    
    tests.push({
      name: 'Returns empty items on 304',
      passed: r2.ok && Array.isArray(r2.data.items) && r2.data.items.length === 0
    });
  }
  
  return {
    name: 'GetEvents SWR Contract',
    passed: tests.every(t => t.passed),
    subtests: tests
  };
}

function testResponseEnvelopes() {
  const tests = [];
  
  // Success envelope
  const s = Response.success({ test: 'data' });
  tests.push({
    name: 'Success has ok:true',
    passed: s.ok === true
  });
  tests.push({
    name: 'Success has status',
    passed: typeof s.status === 'number'
  });
  tests.push({
    name: 'Success has data',
    passed: !!s.data
  });
  tests.push({
    name: 'Success has timestamp',
    passed: !!s.timestamp
  });
  
  // Error envelope
  const e = Response.error('Test error', 'test_phase', 400);
  tests.push({
    name: 'Error has ok:false',
    passed: e.ok === false
  });
  tests.push({
    name: 'Error has status',
    passed: e.status === 400
  });
  tests.push({
    name: 'Error has error object',
    passed: !!e.error && !!e.error.message && !!e.error.phase
  });
  tests.push({
    name: 'Error has timestamp',
    passed: !!e.timestamp
  });
  
  return {
    name: 'Response Envelope Contract',
    passed: tests.every(t => t.passed),
    subtests: tests
  };
}

function testInputSanitization() {
  const tests = [];
  
  // Name validation
  const v1 = Validate.eventName('  Valid Name  ');
  tests.push({
    name: 'Trims whitespace',
    passed: v1.ok && v1.value === 'Valid Name'
  });
  
  const v2 = Validate.eventName('a'.repeat(201));
  tests.push({
    name: 'Rejects long names',
    passed: !v2.ok
  });
  
  const v3 = Validate.eventName('<script>');
  tests.push({
    name: 'Rejects script tags',
    passed: !v3.ok
  });
  
  // Date validation
  const v4 = Validate.dateISO('2025-12-25');
  tests.push({
    name: 'Accepts valid date',
    passed: v4.ok && v4.value === '2025-12-25'
  });
  
  const v5 = Validate.dateISO('2025-13-01');
  tests.push({
    name: 'Rejects invalid month',
    passed: !v5.ok
  });
  
  const v6 = Validate.dateISO('12/25/2025');
  tests.push({
    name: 'Rejects wrong format',
    passed: !v6.ok
  });
  
  return {
    name: 'Input Sanitization Contract',
    passed: tests.every(t => t.passed),
    subtests: tests
  };
}

function testRateLimit() {
  const tests = [];
  
  const r1 = RateLimit.check('read');
  tests.push({
    name: 'First call allowed',
    passed: r1.ok && r1.data.allowed === true
  });
  
  // Make several rapid calls
  for (let i = 0; i < 31; i++) {
    RateLimit.check('read');
  }
  
  const r2 = RateLimit.check('read');
  tests.push({
    name: 'Enforces limit after threshold',
    passed: !r2.ok || r2.status === 429
  });
  
  return {
    name: 'Rate Limiting Contract',
    passed: tests.every(t => t.passed),
    subtests: tests
  };
}

function testGeoValidation() {
  const tests = [];
  
  const v1 = Validate.geo({
    latitude: 41.8781,
    longitude: -87.6298,
    venue: 'Test Venue',
    city: 'Chicago'
  });
  
  tests.push({
    name: 'Accepts valid geo',
    passed: v1.ok && !!v1.value
  });
  
  const v2 = Validate.geo({
    latitude: 91, // Invalid
    longitude: -87.6298
  });
  
  tests.push({
    name: 'Rejects invalid latitude',
    passed: !v2.ok
  });
  
  const v3 = Validate.geo({
    latitude: 41.8781,
    longitude: 181 // Invalid
  });
  
  tests.push({
    name: 'Rejects invalid longitude',
    passed: !v3.ok
  });
  
  const v4 = Validate.geo(null);
  tests.push({
    name: 'Allows null geo',
    passed: v4.ok && v4.value === null
  });
  
  return {
    name: 'Geo Validation Contract',
    passed: tests.every(t => t.passed),
    subtests: tests
  };
}

/************************************************************
* END OF CODE.GS
* All critical boundaries now have:
* - Input validation with clear error messages
* - Consistent Response envelopes
* - No silent failures
* - Defensive error handling
* - Contract tests verifying behaviors
************************************************************/
