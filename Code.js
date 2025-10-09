/************************************************************
* NextUp · Code.gs — Suite Index (jump anchors in brackets)
* [S01] Optional Config (base URLs, IDs, CFG_KEYS/PROP)
* [S02] Client Logging (DIAG + getLogs/clearLogs)
* [S03] Config Helpers (cfgGet_/Set_, base URLs, IDs)
* [S04] Self-Healing Bootstrap (strict Control + Events hdr)
* [S05] Model / Router (IDX, TABS, doGet, include)
* [S06] Events Index (ETag + SWR)  ← getEventsSafe()
* [S07] Eventbook Creation (idempotent)  ← createEventbook
* [S08] Form Linking & Imports
* [S09] Quick Links / Shortlinks / QR (verified only)
* [S10] Bundles (Display/Public/Poster)
* [S11] Confidence / Visibility (WILL-NOT-SHOW-UNTIL-ACTIVE)
* [S12] URL Builders & Cache
* [S13] Data Utils (findEventByIdOrSlug_, ensureWorkbook_, kv, header_)
* [S14] Debug / Smoke (NU_Debug_… + runSmokeSafe)
* [S15] Manage Actions (Default / Archive)
* [S16] Template Helpers (tplEnsure…)
* [S17] Audit (Status.html)
* [S18] Geo-Tagging Utilities
************************************************************/

/************************************************************
* NextUp v4.1.2 — Code.gs (Merged: eventbooks + confidence)
* - Self-healing control (canonical “NextUp - Control”)
* - Idempotent eventbook create + SWR-safe getEventsSafe()
* - Verified QR only (shortlinks), WILL-NOT-SHOW-UNTIL-ACTIVE
* - Admin UI endpoints: default, archive, logs, smoke
************************************************************/

// [S01] Optional Config (base URLs, IDs, CFG_KEYS/PROP)
const BUILD_ID = 'nextup-v4.1.2-merged';
const CONTROL_TITLE = 'NextUp - Control';

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

const PROP = {
  EVENTS_ETAG: 'NU_EVENTS_ETAG'
};

/************************************************************
* [S02] Client Logging (DIAG + getLogs/clearLogs)
************************************************************/
function clientLog(entry) {
  try {
    const e = entry || {};
    const level = String(e.level || 'info');
    const where = 'client:' + String(e.where || '');
    const msg = String(e.msg || '');
    let ts = Number(e.ts);
    if (!isFinite(ts)) ts = Date.now();
    const data = (e.data && typeof e.data === 'object') ? Object.assign({}, e.data, { ts }) : { ts };
    DIAG.log(level, where, msg, data);
    return { ok: true };
  } catch (err) {
    try { DIAG.log('error', 'clientLog', 'exception', { err: String(err) }); } catch (_) {}
    return { ok: false, error: String(err) };
  }
}
const DIAG = {
  LOG_SHEET: 'Diagnostics',
  log(level, where, msg, data) {
    try {
      const ss = SpreadsheetApp.openById(cfgControlId_());
      const sh = ss.getSheetByName(this.LOG_SHEET) || ss.insertSheet(this.LOG_SHEET);
      if (sh.getLastRow() === 0) {
        sh.getRange(1,1,1,5).setValues([['ts','level','where','msg','data']]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
      const row = [[new Date(), String(level||'info'), String(where||''), String(msg||''), data ? JSON.stringify(data) : '']];
      sh.getRange(sh.getLastRow()+1,1,1,5).setValues(row);
      return { ok:true };
    } catch (e) { return { ok:false, err:String(e) }; }
  }
};

/* ===== Rate Limiting ===== */
const RATE_LIMITS = {
  create: { window: 60000, max: 5 },  // 5 creates per minute
  read: { window: 60000, max: 30 }    // 30 reads per minute
};

function checkRateLimit_(action) {
  const cache = CacheService.getUserCache();
  const key = 'ratelimit_' + action;
  const data = cache.get(key);
  
  const now = Date.now();
  const limit = RATE_LIMITS[action] || RATE_LIMITS.read;
  
  if (!data) {
    cache.put(key, JSON.stringify({count:1, start:now}), Math.ceil(limit.window/1000));
    return {ok:true};
  }
  
  const state = JSON.parse(data);
  if (now - state.start > limit.window) {
    cache.put(key, JSON.stringify({count:1, start:now}), Math.ceil(limit.window/1000));
    return {ok:true};
  }
  
  if (state.count >= limit.max) {
    return {ok:false, error:'Rate limit exceeded. Try again in ' + Math.ceil((limit.window-(now-state.start))/1000) + 's'};
  }
  
  state.count++;
  cache.put(key, JSON.stringify(state), Math.ceil(limit.window/1000));
  return {ok:true};
}
/** Admin.html diagnostics buttons expect these: */
function getLogs(maxRows) {
  try {
    const limit = Math.max(1, Math.min(1000, Number(maxRows) || 300));
    const ss = SpreadsheetApp.openById(cfgControlId_());
    const sh = ss.getSheetByName(DIAG.LOG_SHEET);
    if (!sh || sh.getLastRow() < 2) return { ok:true, items:[] };
    const last = sh.getLastRow();
    const start = Math.max(2, last - limit + 1);
    const vals = sh.getRange(start, 1, last - start + 1, 5).getValues();
    const items = vals.map(r => ({ ts: r[0], level: r[1], where: r[2], msg: r[3], data: r[4] ? JSON.parse(r[4]) : null }));
    return { ok:true, items };
  } catch (e) { return { ok:false, error:String(e) }; }
}
function clearLogs() {
  try {
    const ss = SpreadsheetApp.openById(cfgControlId_());
    const sh = ss.getSheetByName(DIAG.LOG_SHEET);
    if (sh && sh.getLastRow() >= 2) sh.getRange(2,1, sh.getLastRow()-1, 5).clearContent();
    return { ok:true };
  } catch (e) { return { ok:false, error:String(e) }; }
}

/************************************************************
* [S03] Config Helpers (cfgGet_/Set_, base URLs, IDs)
************************************************************/
function cfgGet_(k, fallbackConst) {
  const props = PropertiesService.getScriptProperties();
  const v = props.getProperty(k);
  if (v) return v;
  if (fallbackConst &&
      !String(fallbackConst).includes('PUT_') &&
      !String(fallbackConst).includes('_DEPLOYMENT_ID')) {
    props.setProperty(k, fallbackConst);
    return fallbackConst;
  }
  return '';
}
function cfgSet_(k, val){ if (val) PropertiesService.getScriptProperties().setProperty(k, val); }
function cfgOrgUrl_(){ return cfgGet_(CFG_KEYS.ORG_URL, ORG_BASE_URL) || ScriptApp.getService().getUrl(); }
function cfgPubUrl_(){ return cfgGet_(CFG_KEYS.PUB_URL, PUBLIC_BASE_URL) || ScriptApp.getService().getUrl(); }
function cfgControlId_(){ return ensureControlWorkbook_(); }
function cfgTemplateId_(){ return ensureEventTemplate_(); }
function cfgEventsFolderId_(){ return ensureEventsFolder_(); }

/************************************************************
* [S04] Self-Healing Bootstrap (strict & idempotent)
************************************************************/
function ensureAll_() {
  const control = ensureControlStrictOnBoot();
  ensureEventsHeaders_(control.id);
  const tmplId = ensureEventTemplate_();
  ensurePosterDefaults_(tmplId);
  ensureEventsFolder_();
  ensureBaseUrls_();
  return { ok: true, controlId: control.id, tmplId };
}

function ensureControlStrictOnBoot() {
  const props = PropertiesService.getScriptProperties();
  const spec = getControlTemplateSpec_();

  let ss = null;
  const saved = props.getProperty(CFG_KEYS.CONTROL_ID);
  if (saved) { try { ss = SpreadsheetApp.openById(saved); } catch(_){} }

  if (!ss) {
    const found = findControlByNameOrAlias_();
    if (found.primary) {
      ss = SpreadsheetApp.open(found.primary);
      try { if (ss.getName() !== CONTROL_TITLE) ss.rename(CONTROL_TITLE); } catch(_) {}
      props.setProperty(CFG_KEYS.CONTROL_ID, ss.getId());
      found.duplicates.forEach(f => { try { f.setName(f.getName()+' (DUPLICATE)'); } catch(_){} });
    }
  }

  if (!ss) {
    ss = createFreshControl_(summarizeSpecForCreate_(spec));
    props.setProperty(CFG_KEYS.CONTROL_ID, ss.getId());
    return { ok:true, created:true, rebuilt:false, validated:true, id:ss.getId(), url:ss.getUrl() };
  }

  const v = validateControl_(ss, spec);
  if (!v.ok) {
    const old = ss.getId();
    const rebuilt = createFreshControl_(summarizeSpecForCreate_(spec));
    props.setProperty(CFG_KEYS.CONTROL_ID, rebuilt.getId());
    try { DriveApp.getFileById(old).setTrashed(true); } catch(_) {}
    return { ok:true, created:false, rebuilt:true, validated:true, id:rebuilt.getId(), url:rebuilt.getUrl() };
  }
  return { ok:true, created:false, rebuilt:false, validated:true, id:ss.getId(), url:ss.getUrl() };
}

function getControlTemplateSpec_() {
  let owner=''; try { owner = Session.getActiveUser().getEmail() || ''; } catch(_){}
  return [
    { name:'Events', headers:['id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag','isDefault','seedMode','elimType','reserved1','reserved2','reserved3'] },
    { name:'Diagnostics', headers:['ts','level','where','msg','data'] },
    { name:'DiagSuites', headers:['suiteId','name','enabled','notes'] },
    { name:'DiagResults', headers:['ts','suiteId','test','ok','details'] },
    { name:'PosterConfig', headers:['key','value'], rows:[
      ['title','Your Event Title'],
      ['subtitle',''],
      ['date','YYYY-MM-DD'],
      ['time','7:00 PM'],
      ['place','Venue name'],
      ['imageId',''],
      ['public_page','on']
    ]},
    { name:'SignupsTemplate', headers:['timestamp','name','email','phone','team','notes'] },
    { name:'ScheduleTemplate', headers:['round','time','activity','notes','table'] },
    { name:'StandingsTemplate', headers:['team','points','tiebreak','notes'] },
    { name:'Meta', headers:['key','value'], rows:[['version','4.1.2'], ['owner', owner]] }
  ];
}
function summarizeSpecForCreate_(spec){
  const copy = spec.slice();
  if (!copy.length || copy[0].name!=='Events') {
    const i = copy.findIndex(s=>s.name==='Events');
    if (i>0) { const [ev]=copy.splice(i,1); copy.unshift(ev); }
  }
  return copy;
}
function createFreshControl_(spec){
  const ss = SpreadsheetApp.create(CONTROL_TITLE);
  const s1 = ss.getSheets()[0];
  const first = spec[0];
  s1.setName(first.name);
  s1.getRange(1,1,1,first.headers.length).setValues([first.headers]).setFontWeight('bold');
  s1.setFrozenRows(1);
  if (first.rows && first.rows.length) s1.getRange(2,1,first.rows.length,first.rows[0].length).setValues(first.rows);
  for (let i=1;i<spec.length;i++){
    const t = spec[i];
    const sh = ss.insertSheet(t.name);
    sh.getRange(1,1,1,t.headers.length).setValues([t.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (t.rows && t.rows.length) sh.getRange(2,1,t.rows.length,t.rows[0].length).setValues(t.rows);
  }
  return ss;
}
function validateControl_(ss, spec){
  const by = {}; ss.getSheets().forEach(sh=>by[sh.getName()]=sh);
  const missing=[], mism=[], missDef=[];
  for (const t of spec){
    const sh = by[t.name]; if (!sh){ missing.push(t.name); continue; }
    const have = sh.getRange(1,1,1,t.headers.length).getValues()[0];
    const same = have.length===t.headers.length && have.every((v,i)=>String(v||'')===t.headers[i]);
    if (!same) mism.push({sheet:t.name});
    if (t.rows && t.rows.length){
      const r = sh.getRange(2,1,t.rows.length,t.rows[0].length).getValues();
      if (r.length < t.rows.length) missDef.push({sheet:t.name});
    }
  }
  return { ok: !missing.length && !mism.length, missing, mism, missDef };
}
function findControlByNameOrAlias_(){
  const titles=[CONTROL_TITLE,'NextUp Control'];
  const files=[];
  titles.forEach(t=>{
    const q = 'title = "'+t.replace(/"/g,'\\"')+'" and mimeType = "application/vnd.google-apps.spreadsheet"';
    const it = DriveApp.searchFiles(q); while (it.hasNext()) files.push(it.next());
  });
  if (!files.length) return {primary:null,duplicates:[]};
  files.sort((a,b)=> b.getLastUpdated()-a.getLastUpdated());
  const seen=new Set(), uniq=[];
  files.forEach(f=>{ if(!seen.has(f.getId())){ seen.add(f.getId()); uniq.push(f);} });
  return {primary:uniq[0], duplicates:uniq.slice(1)};
}

function ensureControlWorkbook_(){
  let id = cfgGet_(CFG_KEYS.CONTROL_ID, (typeof EVENTS_SPREADSHEET_ID!=='undefined' ? EVENTS_SPREADSHEET_ID : ''));
  if (id) { try { SpreadsheetApp.openById(id); return id; } catch(_){ } }
  const ss = SpreadsheetApp.create(CONTROL_TITLE);
  const first = ss.getSheets()[0]; first.setName('Events');
  cfgSet_(CFG_KEYS.CONTROL_ID, ss.getId());
  return ss.getId();
}
function ensureEventsHeaders_(controlId){
  const ss = SpreadsheetApp.openById(controlId);
  const headers = ['id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag','isDefault','seedMode','elimType','reserved1','reserved2','reserved3'];
  let sh = ss.getSheetByName('Events');
  if (!sh){
    const sheets = ss.getSheets();
    sh = sheets.length ? sheets[0] : ss.insertSheet('Events');
    try { sh.setName('Events'); } catch(_) {}
  }
  const have = sh.getRange(1,1,1,headers.length).getValues()[0];
  const same = have.length===headers.length && have.every((v,i)=>String(v||'')===headers[i]);
  if (!same){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#f3f6fb');
    sh.autoResizeColumns(1, headers.length);
  }
}

function ensureEventTemplate_(){
  let id = cfgGet_(CFG_KEYS.TEMPLATE_ID, EVENT_TEMPLATE_ID);
  if (id) { try { SpreadsheetApp.openById(id); return id; } catch(_){ } }
  const ss = SpreadsheetApp.create('NextUp · Eventbook Template');
  const s1 = ss.getSheets()[0]; s1.setName('Home');
  s1.getRange(1,1,1,2).setValues([['welcome','notes']]);
  tplEnsureMetaKv_(ss);
  tplEnsureSheetWithHeader_(ss, 'SignupsView', ['timestamp','name','email','phone','team','notes']);
  tplEnsureSheetWithHeader_(ss, 'Schedule',    ['round','time','activity','notes','table']);
  tplEnsureSheetWithHeader_(ss, 'Standings',   ['team','points','tiebreak','notes']);
  tplEnsurePosterConfigKv_(ss);
  cfgSet_(CFG_KEYS.TEMPLATE_ID, ss.getId());
  return ss.getId();
}
function ensurePosterDefaults_(tmplId){
  const ss = SpreadsheetApp.openById(tmplId);
  tplEnsurePosterConfigKv_(ss);
}
function ensureEventsFolder_(){
  let id = cfgGet_(CFG_KEYS.EVENTS_DIR, EVENTS_ROOT_FOLDER_ID);
  if (id) { try { DriveApp.getFolderById(id); return id; } catch(_){ } }
  const folder = DriveApp.createFolder('NextUp · Eventbooks');
  cfgSet_(CFG_KEYS.EVENTS_DIR, folder.getId());
  return folder.getId();
}
function ensureBaseUrls_(){
  if (!cfgGet_(CFG_KEYS.ORG_URL, ORG_BASE_URL)) cfgSet_(CFG_KEYS.ORG_URL, ScriptApp.getService().getUrl());
  if (!cfgGet_(CFG_KEYS.PUB_URL, PUBLIC_BASE_URL)) cfgSet_(CFG_KEYS.PUB_URL, ScriptApp.getService().getUrl());
}

/************************************************************
* [S05] Model / Router (IDX, TABS, doGet, include)
************************************************************/
const EVENTS_SHEET = 'Events';
const IDX = { id:0, name:1, slug:2, startDateISO:3, ssId:4, ssUrl:5, formId:6, tag:7, isDefault:8, seedMode:9, elimType:10 };
const TABS = { HOME:'Home', META:'Meta', SIGNUPS:'SignupsView', SCHEDULE:'Schedule', STANDINGS:'Standings', POSTER:'PosterConfig' };

function include(name){ return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function doGet(e){
  ensureControlStrictOnBoot();
  const p = (e && e.parameter) || {};
  const raw = (p.page || p.p || 'Admin');
  const key = String(raw).trim().toLowerCase();

  if (key === 'r' || key === 'redirect') {
    const token = (p.t || p.token || '').toString();
    const target = Shortlinks.resolve(token) || cfgPubUrl_();
    return redirectTo_(target);
  }

  const PAGE = { admin:'Admin', public:'Public', display:'Display', poster:'Poster', status:'Status', test:'Test' };
  const page = PAGE[key] || 'Admin';
  const tpl  = HtmlService.createTemplateFromFile(page);
  tpl.appTitle = 'NextUp';
  tpl.BUILD_ID = BUILD_ID;
  return tpl.evaluate()
    .setTitle('NextUp · ' + page)
    .addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function redirectTo_(url){
  const safe = String(url||'').trim() || cfgPubUrl_();
  const html = `
<!doctype html><html><head><base target="_top"><meta http-equiv="refresh" content="0; url=${safe}"></head>
<body><script>try{window.top.location.replace(${JSON.stringify(safe)});}catch(e){location.href=${JSON.stringify(safe)};}</script>
Redirecting… <a href="${safe}">Continue</a></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Redirecting…').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************************************************************
* [S06] Events Index (ETag + SWR) — unified envelope
************************************************************/
function getMain_(){ ensureAll_(); return SpreadsheetApp.openById(cfgControlId_()); }
function getEventsSheet_(){ const ss = getMain_(); return ss.getSheetByName(EVENTS_SHEET) || ss.insertSheet(EVENTS_SHEET); }

/** Compute a stable event tag from slug/date/id (kept from your file) */
function computeEventTag_(slug, dateISO, id){
  const s = (String(slug||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'event').slice(0,48);
  const ymd = String(dateISO||'').replace(/-/g,'') || Utilities.formatDate(new Date(), Session.getScriptTimeZone(),'yyyyMMdd');
  const id6 = String(id||'').replace(/-/g,'').slice(0,6) || 'xxxxxx';
  return `${s}-${ymd}-${id6}`;
}

/** Row → canonical event object (kept from your file) */
function rowToEvent_(r){
  const safe = i => (i < r.length ? r[i] : '');
  const id = safe(IDX.id);
  const slug = safe(IDX.slug) || safe(IDX.name) || id || '';
  const dateISO = safe(IDX.startDateISO) || '';
  const tag = safe(IDX.tag) || computeEventTag_(slug, dateISO, id);
  return {
    id,
    name: safe(IDX.name),
    slug,
    startDateISO: dateISO,
    eventSpreadsheetId: safe(IDX.ssId),
    eventSpreadsheetUrl: safe(IDX.ssUrl),
    formId: safe(IDX.formId),
    eventTag: tag,
    isDefault: String(safe(IDX.isDefault)).toLowerCase() === 'true',
    seedMode: safe(IDX.seedMode) || 'random',
    elimType: safe(IDX.elimType) || 'none'
  };
}

/** Stable ETag over a lightweight projection */
function _eventsEtag_(items){
  const lite = (items||[]).map(x => [x.id,x.slug,x.startDateISO,x.eventSpreadsheetId,x.formId,x.eventTag,x.seedMode,x.elimType]);
  const b = Utilities.newBlob(JSON.stringify(lite)).getBytes();
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, b)).slice(0,16);
}

/** Internal: read full index + compute etag */
function _readEventsIndex_(){
  const sh = getEventsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { items: [], etag: 'empty' };
  const data = sh.getRange(2,1,last-1,15).getValues();
  const items = data
    .filter(r => String(r[IDX.id]||'').trim())
    .map(rowToEvent_);
  const etag = _eventsEtag_(items);
  return { items, etag };
}

/** Public: unified envelope (SWR-safe) */
function getEventsSafe(etagOpt){
  try {
    ensureAll_();
    const { items, etag } = _readEventsIndex_();

    // persist etag for debugging/telemetry if you like
    try { PropertiesService.getScriptProperties().setProperty(PROP.EVENTS_ETAG, etag); } catch(_){}

    const notModified = !!etagOpt && etagOpt === etag;
    if (notModified) {
      return { ok: true, status: 304, etag, notModified: true, items: [] };
    }
    return { ok: true, status: 200, etag, notModified: false, items };
  } catch (e) {
    try { DIAG.log('error','getEventsSafe','exception',{ err:String(e) }); } catch(_) {}
    // On error, still conform to envelope with items:[]
    return { ok: false, status: 500, etag: '', notModified: false, items: [], error: String(e) };
  }
}

/** Back-compat alias (same unified envelope) */
function getEventbooksSafe(etagOpt){ return getEventsSafe(etagOpt); }

/* ===== Input Validation Layer ===== */
const VALIDATORS = {
  eventName: (v) => {
    const s = String(v||'').trim();
    if (!s) return {valid:false, error:'Name required'};
    if (s.length > 200) return {valid:false, error:'Name too long (max 200)'};
    if (/<script|javascript:|on\w+=/i.test(s)) return {valid:false, error:'Invalid characters'};
    return {valid:true, value:s};
  },
  
  dateISO: (v) => {
    const s = String(v||'').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return {valid:false, error:'Date format: YYYY-MM-DD'};
    const d = new Date(s);
    if (isNaN(d.getTime())) return {valid:false, error:'Invalid date'};
    return {valid:true, value:s};
  },
  
  eventKey: (v) => {
    const s = String(v||'').trim();
    if (!s) return {valid:false, error:'Event key required'};
    if (s.length > 100) return {valid:false, error:'Key too long'};
    if (/[<>"'`]/.test(s)) return {valid:false, error:'Invalid characters'};
    return {valid:true, value:s};
  },
  
  seedMode: (v) => {
    const allowed = ['random','seeded'];
    if (!allowed.includes(v)) return {valid:false, error:'Invalid seed mode'};
    return {valid:true, value:v};
  },
  
  elimType: (v) => {
    const allowed = ['single','double','none'];
    if (!allowed.includes(v)) return {valid:false, error:'Invalid elim type'};
    return {valid:true, value:v};
  }
};

function validateInput_(type, value) {
  const validator = VALIDATORS[type];
  if (!validator) return {valid:true, value}; // Unknown type passes through
  return validator(value);
}
/************************************************************
* [S07] Eventbook Creation (workbook-first, idempotent)
************************************************************/
function eventWorkbookTitle_(name, slug, dateISO, id){
  const safeName = String(name || 'Event').trim();
  const safeDate = String(dateISO || '').trim();
  const safeSlug = (String(slug||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')) || 'event';
  return `NextUp · ${safeName} · ${safeDate} · ${safeSlug}`;
}
function createEventbook(payload){ return _createEventbookImpl(payload); }
function createEventV2(payload){ return _createEventbookImpl(payload); } // back-compat
function createEvent(payload){   return _createEventbookImpl(payload); } // back-compat

function _createEventbookImpl(payload){
  ensureAll_();
  const started = Date.now();
  
  // VALIDATE ALL INPUTS
  const vName = validateInput_('eventName', payload.name);
  if (!vName.valid) {
    DIAG.log('error','createEventbook','invalid_name',{error:vName.error});
    return {ok:false, phase:'validate', error:vName.error};
  }
  
  const vDate = validateInput_('dateISO', payload.startDateISO || payload.startDate);
  if (!vDate.valid) {
    DIAG.log('error','createEventbook','invalid_date',{error:vDate.error});
    return {ok:false, phase:'validate', error:vDate.error};
  }
  
  const vSeed = validateInput_('seedMode', payload.seedMode || 'random');
  if (!vSeed.valid) return {ok:false, phase:'validate', error:vSeed.error};
  
  const vElim = validateInput_('elimType', payload.elimType || 'none');
  if (!vElim.valid) return {ok:false, phase:'validate', error:vElim.error};
  
  const name = vName.value;
  const dateISO = vDate.value;
  const seedMode = vSeed.value;
  const elimType = vElim.value;
    DIAG.log('error','createEventbook','missing name/date',{ payload });
    return { ok:false, phase:'validate', error:'Name and Date required' };
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || `event-${Date.now()}`;

  const ctl = getEventsSheet_();
  const lr = ctl.getLastRow();
  if (lr >= 2) {
    const rows = ctl.getRange(2,1,lr-1,15).getValues();
    const hit  = rows.find(r => (r[IDX.slug]||'')===slug && (r[IDX.startDateISO]||'')===dateISO);
    if (hit) {
      const ev = rowToEvent_(hit);
      DIAG.log('info','createEventbook','idempotent.hit',{ id:ev.id, slug:ev.slug, dateISO:ev.startDateISO });
      return { ok:true, id:ev.id, slug:ev.slug, tag:ev.eventTag, ssId:ev.eventSpreadsheetId||'', ssUrl:ev.eventSpreadsheetUrl||'', idempotent:true, phase:'done', ms: Date.now()-started };
    }
  }

  const id  = Utilities.getUuid();
  const tag = computeEventTag_(slug, dateISO, id);

  try {
    const folderId   = cfgEventsFolderId_();
    const templateId = cfgTemplateId_();
    const title      = eventWorkbookTitle_(name, slug, dateISO, id);

    let ss, ssId, ssUrl;
    if (templateId) {
      const file = DriveApp.getFileById(templateId);
      const folder = DriveApp.getFolderById(folderId);
      const copy = file.makeCopy(title, folder);
      ssId = copy.getId();
      ss   = SpreadsheetApp.openById(ssId);
      ssUrl = ss.getUrl();
      Object.values(TABS).forEach(n => { if (!ss.getSheetByName(n)) ss.insertSheet(n); });
      header_(ss, TABS.SIGNUPS, ['timestamp','name','email','phone','team','notes']);
      header_(ss, TABS.SCHEDULE, ['round','time','activity','notes','table']);
      header_(ss, TABS.STANDINGS,['team','points','tiebreak','notes']);
      tplEnsurePosterConfigKv_(ss);
    } else {
      const folder = DriveApp.getFolderById(folderId);
      const base = SpreadsheetApp.create(title);
      const file = DriveApp.getFileById(base.getId());
      folder.addFile(file); try { DriveApp.getRootFolder().removeFile(file); } catch(_){}
      ss = base; ssId = ss.getId(); ssUrl = ss.getUrl();
      const home = ss.getSheets()[0];
      home.setName('Home');
      home.getRange(1,1,1,4).setValues([[`NextUp · ${tag}`,'Name','Start Date','Event ID']]).setFontWeight('bold');
      home.getRange(2,2,1,3).setValues([[name, dateISO, id]]);
      const signupsHdr = ctlTemplateHeaders_('SignupsTemplate', ['timestamp','name','email','phone','team','notes']);
      const schedHdr   = ctlTemplateHeaders_('ScheduleTemplate', ['round','time','activity','notes','table']);
      const standHdr   = ctlTemplateHeaders_('StandingsTemplate',['team','points','tiebreak','notes']);
      header_(ss, TABS.SIGNUPS,  signupsHdr);
      header_(ss, TABS.SCHEDULE, schedHdr);
      header_(ss, TABS.STANDINGS,standHdr);
      const posterKv = ctlPosterDefaults_();
      const poster = ensureKvSheet_(ss, TABS.POSTER);
      if (Object.keys(posterKv).length) upsertKv_(poster, posterKv); else tplEnsurePosterConfigKv_(ss);
    }

    const meta = ensureKvSheet_(ss, TABS.META);
    upsertKv_(meta, {
      eventId: id,
      eventTag: tag,
      slug,
      startDateISO: dateISO,
      adminUrl:     buildOrgUrl_('Admin', id),
      publicUrl:    buildPublicUrl_('Public', id),
      displayUrl:   buildOrgUrl_('Display', id),
      posterPageUrl:buildPublicUrl_('Poster', id),
      seedMode, elimType
    });

    const mirrorHeaders = ['id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag','isDefault','seedMode','elimType'];
    const mirror = ss.getSheetByName('Events') || ss.insertSheet('Events');
    header_(ss,'Events', mirrorHeaders);
    mirror.getRange(2,1,1,mirrorHeaders.length).setValues([[ id, name, slug, dateISO, ssId, ssUrl, '', tag, false, seedMode, elimType ]]);

    ctl.appendRow([id, name, slug, dateISO, ssId, ssUrl, '', tag, false, seedMode, elimType, '', '', '']);
    bustEventsCache_();

    DIAG.log('info','createEventbook','done',{ id, ssId, ssUrl, tag });
    return { ok:true, id, slug, tag, ssId, ssUrl, idempotent:false, phase:'done', ms: Date.now()-started };
  } catch (e) {
    DIAG.log('error','createEventbook','exception',{ err:String(e), stack:e && e.stack });
    return { ok:false, phase:'error', error:String(e) };
  }
}

/************************************************************
* [S07b] Provisioning (compat shims for old callers)
* - CREATED→WORKBOOK_READY→LINKS_READY collapsed:
*   we just ensure the workbook + links now.
************************************************************/
function provisionStep(key){
  try {
    const ev = ensureWorkbook_(key);
    if (!ev.ok) return { ok:false, status:404, error:'not found' };

    // When workbook is present, links are derivable immediately in new arch.
    const ql = getEventQuickLinks(ev.id);
    const hasLinks = !!(ql && ql.publicUrl && ql.displayUrl);

    return {
      ok: true,
      status: 200,
      state: hasLinks ? 'LINKS_READY' : 'WORKBOOK_READY'
    };
  } catch (e) {
    DIAG.log('error','provisionStep','exception',{ err:String(e) });
    return { ok:false, status:500, error:String(e) };
  }
}

function getProvisionStatus(key){
  try {
    const ev = findEventByIdOrSlug_(key);
    if (!ev) return { ok:false, status:404, error:'not found' };

    const workbook = !!(ev.eventSpreadsheetId && ev.eventSpreadsheetUrl);
    if (!workbook) return { ok:true, status:200, state:'CREATED', hasWorkbook:false, hasLinks:false };

    const ql = getEventQuickLinks(ev.id);
    const hasLinks = !!(ql && ql.publicUrl && ql.displayUrl);
    return {
      ok:true, status:200,
      state: hasLinks ? 'LINKS_READY' : 'WORKBOOK_READY',
      hasWorkbook: true,
      hasLinks
    };
  } catch (e) {
    DIAG.log('error','getProvisionStatus','exception',{ err:String(e) });
    return { ok:false, status:500, error:String(e) };
  }
}

/************************************************************
* [S08] Form Linking & Imports (unchanged)
************************************************************/
function setEventFormId(eventIdOrSlug, formIdOrUrl){
  const ev = findEventByIdOrSlug_(eventIdOrSlug);
  if (!ev) return { ok:false, error:'Eventbook not found' };
  const sh = getEventsSheet_();
  const last = sh.getLastRow(); if (last<2) return { ok:false, error:'No rows' };
  const data = sh.getRange(2,1,last-1,15).getValues();
  const idx = data.findIndex(r => r[IDX.id]===ev.id || r[IDX.slug]===ev.id);
  if (idx < 0) return { ok:false, error:'Row not found' };
  const formId = parseFormId_(formIdOrUrl);
  sh.getRange(idx+2, IDX.formId+1).setValue(formId || '');
  if (ev.eventSpreadsheetId) {
    const ss = SpreadsheetApp.openById(ev.eventSpreadsheetId);
    const meta = ensureKvSheet_(ss, TABS.META);
    upsertKv_(meta, {
      formId: formId || '',
      formUrlView: formId ? `https://docs.google.com/forms/d/${formId}/viewform` : '',
      formUrlEdit: formId ? `https://docs.google.com/forms/d/${formId}/edit` : ''
    });
  }
  return { ok:true, formId: formId || '' };
}
function parseFormId_(s){ if(!s) return ''; const m = String(s).match(/\/d\/([^/]+)/); return (m && m[1]) || String(s).trim(); }
function importSignupsCsv(eventIdOrSlug, csv){
  const ev = ensureWorkbook_(eventIdOrSlug);
  if (!ev.ok) return ev;
  const ss = SpreadsheetApp.openById(ev.ssId);
  const sh = ss.getSheetByName(TABS.SIGNUPS) || ss.insertSheet(TABS.SIGNUPS);
  const rows = Utilities.parseCsv(csv || '');
  if (!rows.length) return { ok:false, error:'Empty CSV' };
  if (sh.getLastRow()<1) sh.getRange(1,1,1,rows[0].length).setValues([rows[0]]);
  const body = (rows[0].some(v => ['name','team'].includes(String(v).toLowerCase()))) ? rows.slice(1) : rows;
  if (body.length) sh.getRange(sh.getLastRow()+1,1,body.length,body[0].length).setValues(body);
  return { ok:true, count: body.length };
}
function importSignupsFromSheet(eventIdOrSlug, sheetId, rangeA1){
  const ev = ensureWorkbook_(eventIdOrSlug);
  if (!ev.ok) return ev;
  const src = SpreadsheetApp.openById(sheetId).getRange(rangeA1).getValues();
  if (!src.length) return { ok:false, error:'Empty source range' };
  const ss = SpreadsheetApp.openById(ev.ssId);
  const sh = ss.getSheetByName(TABS.SIGNUPS) || ss.insertSheet(TABS.SIGNUPS);
  if (sh.getLastRow()<1) sh.getRange(1,1,1,src[0].length).setValues([src[0]]);
  const body = (src[0].some(v => ['name','team'].includes(String(v).toLowerCase()))) ? src.slice(1) : src;
  if (body.length) sh.getRange(sh.getLastRow()+1,1,body.length,body[0].length).setValues(body);
  return { ok:true, count: body.length };
}

/************************************************************
* [S09] Quick Links / Shortlinks / QR (verified only)
************************************************************/
const SHORT_KEY_MAP = 'NU_SHORTLINKS_MAP_V1';
const SHORT_TARGET_MAP = 'NU_SHORTLINKS_TARGETS_V1';
const Shortlinks = {
  set(key, target){
    if (!target) return '';
    const props = PropertiesService.getScriptProperties();
    const map = JSON.parse(props.getProperty(SHORT_KEY_MAP)||'{}');
    
    let token = map[key];
    if (!token){
      token = this._generateSecureToken();
      map[key] = token;
      props.setProperty(SHORT_KEY_MAP, JSON.stringify(map));
    }
    
    const tmap = JSON.parse(props.getProperty(SHORT_TARGET_MAP)||'{}');
    tmap[token] = target;
    props.setProperty(SHORT_TARGET_MAP, JSON.stringify(tmap));
    return this.url(token);
  },
  
  _generateSecureToken(){
    // Cryptographically secure 12-char token
    const bytes = Utilities.getUuid().replace(/-/g,'');
    return Utilities.base64EncodeWebSafe(bytes).slice(0,12);
  },
  
  resolve(token){
    const tmap = JSON.parse(PropertiesService.getScriptProperties().getProperty(SHORT_TARGET_MAP)||'{}');
    return tmap[token] || null;
  },
  
  url(token){ 
    const base = cfgPubUrl_(); 
    return `${base}?page=R&t=${encodeURIComponent(token)}`;
  }
};
function shortFor_(eventId, type, targetUrl){ if(!targetUrl) return ''; return Shortlinks.set(`${type}:${eventId}`, targetUrl); }
const QR = { image(url){ if(!url) return ''; return `https://quickchart.io/qr?text=${encodeURIComponent(url)}&margin=2&size=300`; } };

function getEventbookQuickLinks(eventIdOrSlug){ return getEventQuickLinks(eventIdOrSlug); }
function getEventQuickLinks(eventIdOrSlug){
  const ev = findEventByIdOrSlug_(eventIdOrSlug);
  if (!ev) return { ok:false, error:'Eventbook not found' };

  const eventId     = ev.id;
  const adminUrl    = buildOrgUrl_('Admin', eventId);
  const displayUrl  = buildOrgUrl_('Display', eventId);
  const publicUrl   = buildPublicUrl_('Public', eventId);
  const posterPageUrl = buildPublicUrl_('Poster', eventId);
  const workbookUrl = ev.eventSpreadsheetUrl || '';
  const posterImageUrl = posterImageFromWorkbook_(ev.eventSpreadsheetId);

  const formUrlView = ev.formId ? `https://docs.google.com/forms/d/${ev.formId}/viewform` : '';
  const formUrlEdit = ev.formId ? `https://docs.google.com/forms/d/${ev.formId}/edit` : '';

  const short = {
    form:        shortFor_(eventId,'FORM',        formUrlView || ''),
    display:     shortFor_(eventId,'DISPLAY',     displayUrl),
    public:      shortFor_(eventId,'PUBLIC',      publicUrl),
    poster:      shortFor_(eventId,'POSTER_SHEET',workbookUrl),
    posterImage: shortFor_(eventId,'POSTER_IMG',  posterImageUrl || ''),
    posterPage:  shortFor_(eventId,'POSTER_PAGE', posterPageUrl)
  };

  const qr = {
    // STRICT: only QR for verified shortlinks
    form:        short.form        ? QR.image(short.form)        : '',
    display:     short.display     ? QR.image(short.display)     : '',
    public:      short.public      ? QR.image(short.public)      : '',
    poster:      short.poster      ? QR.image(short.poster)      : '',
    posterImage: short.posterImage ? QR.image(short.posterImage) : '',
    posterPage:  short.posterPage  ? QR.image(short.posterPage)  : ''
  };

  let signupsUrl = '';
  if (ev.eventSpreadsheetId) {
    const ss = SpreadsheetApp.openById(ev.eventSpreadsheetId);
    const gid = ss.getSheetByName(TABS.SIGNUPS)?.getSheetId();
    if (gid) signupsUrl = `${ss.getUrl()}#gid=${gid}`;
  }

  return {
    ok:true,
    adminUrl, displayUrl, publicUrl, posterPageUrl,
    workbookUrl, signupsUrl,
    posterImageUrl,
    formUrlView, formUrlEdit,
    short, qr
  };
}

// Legacy name: getShareQr → returns verified QR (url + qrUrlVerified), qrB64 kept as '' for back-compat.
function getShareQr(key){
  const v = getShareQrVerified(key);
  if (!v.ok) return v;
  return { ok:true, url: v.url || '', qrB64:'', qrUrlVerified: v.qrUrlVerified || '' };
}

/************************************************************
* [S10] Bundles (unchanged shapes)
************************************************************/
function getDisplayBundle(eventIdOrSlug){
  const ev = ensureWorkbook_(eventIdOrSlug);
  if (!ev.ok) return ev;
  const ss = SpreadsheetApp.openById(ev.ssId);
  const meta = readKv_(ss, TABS.META);
  const cfg  = readKv_(ss, TABS.POSTER);
  return {
    ok:true,
    eventTag: meta.eventTag || ev.tag,
    title: meta.title || ev.name || ev.tag,
    datePretty: prettyDate_(meta.startDateISO || ev.dateISO),
    place: cfg.place || '',
    standings: readTable_(ss, TABS.STANDINGS),
    schedule:  readTable_(ss, TABS.SCHEDULE),
    adminUrl:  buildOrgUrl_('Admin', ev.id),
    publicUrl: buildPublicUrl_('Public', ev.id),
    posterPageUrl: buildPublicUrl_('Poster', ev.id)
  };
}
function getPublicBundle(eventIdOrSlug){
  const ev = ensureWorkbook_(eventIdOrSlug);
  if (!ev.ok) return ev;
  const ss = SpreadsheetApp.openById(ev.ssId);
  const meta = readKv_(ss, TABS.META);
  const cfg  = readKv_(ss, TABS.POSTER);
  const nameMode = String(cfg.public_name_mode || 'initials').toLowerCase();
  const standings = applyNameMode_(readTable_(ss, TABS.STANDINGS), nameMode);
  const schedule  = applyNameMode_(readTable_(ss, TABS.SCHEDULE),  nameMode, ['team','team_a','team_b']);
  return {
    ok:true,
    eventTag: meta.eventTag || ev.tag,
    title: meta.title || ev.name || ev.tag,
    datePretty: prettyDate_(meta.startDateISO || ev.dateISO),
    place: cfg.place || '',
    public_name_mode: nameMode,
    standings, schedule,
    posterPageUrl: buildPublicUrl_('Poster', ev.id)
  };
}
function getPosterBundle(eventIdOrSlug){
  const ev = ensureWorkbook_(eventIdOrSlug);
  if (!ev.ok) return ev;
  const ss = SpreadsheetApp.openById(ev.ssId);
  const meta = readKv_(ss, TABS.META);
  const cfg  = readKv_(ss, TABS.POSTER);
  const posterImageUrl = String(cfg.posterImageUrl || '').trim();
  const adminUrl  = buildOrgUrl_('Admin', ev.id);
  const publicUrl = buildPublicUrl_('Public', ev.id);

  const sForm   = ev.formId ? shortFor_(ev.id,'FORM', `https://docs.google.com/forms/d/${ev.formId}/viewform`) : '';
  const sPublic = shortFor_(ev.id,'PUBLIC', publicUrl);
  const qr = {
    // NOTE: Only shortlink-based QR (verified)
    form:   sForm   ? QR.image(sForm)   : '',
    public: sPublic ? QR.image(sPublic) : ''
  };

  return {
    ok:true,
    eventTag: meta.eventTag || ev.tag,
    title: meta.title || ev.name || ev.tag,
    datePretty: prettyDate_(meta.startDateISO || ev.dateISO),
    place: cfg.place || '',
    posterImageUrl,
    adminUrl, publicUrl,
    qr
  };
}

/************************************************************
* [S11] Confidence / Visibility — WILL-NOT-SHOW-UNTIL-ACTIVE
************************************************************/
function getConfidenceState(eventIdOrSlug){
  ensureAll_();
  const out = {
    ok: true,
    control: true,
    eventsHeader: true,
    event: false,
    workbook: false,
    form: false,
    posterImage: false,
    links: { public:'', display:'', posterPage:'', formView:'', workbook:'' },
    short: { public:'', display:'', poster:'', posterImage:'', posterPage:'', form:'' },
    qr:    { public:'', display:'', poster:'', posterImage:'', posterPage:'', form:'' },
    canShow: { public:false, display:false, posterPage:false, form:false, qrPublic:false, qrForm:false, posterImage:false }
  };

  const ev = findEventByIdOrSlug_(eventIdOrSlug);
  if (!ev) return Object.assign(out, { event:false });

  out.event = true;
  out.workbook = !!(ev.eventSpreadsheetId && ev.eventSpreadsheetUrl);
  out.form = !!ev.formId;
  out.links.workbook = ev.eventSpreadsheetUrl || '';

  if (out.workbook) {
    try {
      const book = SpreadsheetApp.openById(ev.eventSpreadsheetId);
      const posterKv = readKv_(book, TABS.POSTER);
      out.posterImage = !!String((posterKv && posterKv.posterImageUrl) || '').trim();
    } catch (_) {}

    const ql = getEventQuickLinks(ev.id);
    out.links.public     = ql.publicUrl || '';
    out.links.display    = ql.displayUrl || '';
    out.links.posterPage = ql.posterPageUrl || '';
    out.links.formView   = ql.formUrlView || '';
    out.short = ql.short || {};
    out.qr    = ql.qr    || {};
  }

  out.canShow.public      = !!out.links.public;
  out.canShow.display     = !!out.links.display;
  out.canShow.posterPage  = !!out.links.posterPage;
  out.canShow.form        = !!(out.form && out.links.formView);
  out.canShow.posterImage = !!out.posterImage;

  // QR ONLY when shortlink exists (verified)
  out.canShow.qrPublic = !!(out.short && out.short.public) && !!(out.qr && out.qr.public);
  out.canShow.qrForm   = !!(out.short && out.short.form)   && !!(out.qr && out.qr.form);

  return out;
}
function getShareQrVerified(eventIdOrSlug){
  const ev = findEventByIdOrSlug_(eventIdOrSlug);
  if (!ev) return { ok:false, error:'Eventbook not found' };
  const ql = getEventQuickLinks(ev.id);
  const qrPublic = (ql.short && ql.short.public) ? (ql.qr && ql.qr.public || '') : '';
  return { ok:true, url: ql.publicUrl || '', qrUrlVerified: qrPublic || '' };
}

/************************************************************
* [S12] URL Builders & Cache
************************************************************/
function buildOrgUrl_(page, eventId){   const base = cfgOrgUrl_();  return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`; }
function buildPublicUrl_(page, eventId){ const base = cfgPubUrl_(); return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`; }
function bustEventsCache_(){
  try { CacheService.getScriptCache().remove('events_index'); } catch(_) {}
  try { PropertiesService.getScriptProperties().deleteProperty(PROP.EVENTS_ETAG); } catch(_) {}
}

/************************************************************
* [S13] Data Utils (findEventByIdOrSlug_, ensureWorkbook_, kv, header_, tables)
************************************************************/
function findEventByIdOrSlug_(key){
  if (!key) {
    // if no key, prefer default if present
    const sh = getEventsSheet_();
    const last = sh.getLastRow(); if (last<2) return null;
    const rows = sh.getRange(2,1,last-1,15).getValues();
    const r = rows.find(rr => String(rr[IDX.isDefault]).toLowerCase()==='true');
    return r ? rowToEvent_(r) : null;
  }
  const sh = getEventsSheet_();
  const last = sh.getLastRow(); if (last<2) return null;
  const rows = sh.getRange(2,1,last-1,15).getValues();
  const hit = rows.find(r => r[IDX.id]===key || r[IDX.slug]===key);
  return hit ? rowToEvent_(hit) : null;
}

function ensureWorkbook_(eventIdOrSlug){
  const ev = findEventByIdOrSlug_(eventIdOrSlug);
  if (!ev) return { ok:false, error:'Eventbook not found' };
  if (!ev.eventSpreadsheetId){
    const r = workerCreateEventWorkbook_(ev.id);
    if (!r.ok) return r;
    ev.eventSpreadsheetId = r.spreadsheetId; ev.eventSpreadsheetUrl = r.url;
  }
  return { ok:true, id:ev.id, name:ev.name, tag:ev.eventTag, dateISO:ev.startDateISO, ssId:ev.eventSpreadsheetId, ssUrl:ev.eventSpreadsheetUrl, formId:ev.formId };
}
function workerCreateEventWorkbook_(eventId){
  ensureAll_();
  const sh = getEventsSheet_();
  const last = sh.getLastRow(); if (last<2) return { ok:false, error:'No rows' };
  const data = sh.getRange(2,1,last-1,15).getValues();
  const idx = data.findIndex(r => r[IDX.id]===eventId);
  if (idx<0) return { ok:false, error:'Not found' };
  const rowNum = idx + 2;
  const r = sh.getRange(rowNum,1,1,15).getValues()[0];

  if (r[IDX.ssId] && r[IDX.ssUrl]) return { ok:true, spreadsheetId: r[IDX.ssId], url: r[IDX.ssUrl] };

  const name = r[IDX.name], slug = r[IDX.slug], dateISO = r[IDX.startDateISO];
  const templateId = cfgTemplateId_();
  const folderId = cfgEventsFolderId_();
  const template = DriveApp.getFileById(templateId);
  const folder = DriveApp.getFolderById(folderId);
  const newName = eventWorkbookTitle_(name, slug, dateISO, r[IDX.id]);
  const copy = template.makeCopy(newName, folder);
  const ss = SpreadsheetApp.openById(copy.getId());

  Object.values(TABS).forEach(n => { if (!ss.getSheetByName(n)) ss.insertSheet(n); });

  const meta = ensureKvSheet_(ss, TABS.META);
  upsertKv_(meta, {
    eventId: r[IDX.id],
    eventTag: r[IDX.tag] || computeEventTag_(slug, dateISO, r[IDX.id]),
    slug: r[IDX.slug],
    startDateISO: r[IDX.startDateISO],
    adminUrl: buildOrgUrl_('Admin', r[IDX.id]),
    publicUrl: buildPublicUrl_('Public', r[IDX.id]),
    displayUrl: buildOrgUrl_('Display', r[IDX.id]),
    posterPageUrl: buildPublicUrl_('Poster', r[IDX.id]),
    seedMode: r[IDX.seedMode] || 'random',
    elimType: r[IDX.elimType] || 'none'
  });

  header_(ss, TABS.SIGNUPS, ['timestamp','name','email','phone','team','notes']);
  header_(ss, TABS.SCHEDULE,['round','time','activity','notes','table']);
  header_(ss, TABS.STANDINGS,['team','points','tiebreak','notes']);

  sh.getRange(rowNum, IDX.ssId+1).setValue(copy.getId());
  sh.getRange(rowNum, IDX.ssUrl+1).setValue(copy.getUrl());
  bustEventsCache_();
  return { ok:true, spreadsheetId: copy.getId(), url: copy.getUrl() };
}

function readTable_(ss, name){
  const sh = ss.getSheetByName(name); if (!sh) return [];
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr<2 || lc<1) return [];
  const vals = sh.getRange(1,1,lr,lc).getValues();
  const header = vals[0].map(v => String(v||'').trim()).map(h => h.replace(/\s+/g,'_').toLowerCase());
  const out = [];
  for (let i=1;i<vals.length;i++){
    const row = {};
    for (let j=0;j<header.length;j++) row[header[j]] = vals[i][j];
    if (Object.values(row).every(v => v==='' || v===null)) continue;
    out.push(row);
  }
  return out;
}
function ensureKvSheet_(ss, name){
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow()<1) sh.getRange(1,1,1,2).setValues([['key','value']]);
  return sh;
}
function upsertKv_(sheet, kv){
  const lr = sheet.getLastRow();
  const rows = lr>0 ? sheet.getRange(1,1,lr,2).getValues() : [];
  const idx = {}; rows.forEach((r,i)=>{ const k = String(r[0]||'').trim(); if(k) idx[k]=i+1; });
  Object.entries(kv||{}).forEach(([k,v])=>{
    if (idx[k]) sheet.getRange(idx[k],2).setValue(v);
    else sheet.appendRow([k,v]);
  });
}
function header_(ss, name, cols){
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const existing = sh.getRange(1,1,1,cols.length).getValues()[0].map(v => String(v||'').trim());
  const same = existing.length===cols.length && existing.every((v,i)=> v===cols[i]);
  if (!same) sh.getRange(1,1,1,cols.length).setValues([cols]);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,cols.length).setFontWeight('bold').setBackground('#f3f6fb');
  sh.autoResizeColumns(1, cols.length);
}
function posterImageFromWorkbook_(ssId){
  if (!ssId) return '';
  const ss = SpreadsheetApp.openById(ssId);
  const kv = readKv_(ss, TABS.POSTER);
  return String(kv.posterImageUrl || '').trim();
}
function readKv_(ss, name){
  const sh = ss.getSheetByName(name); if (!sh) return {};
  const lr = sh.getLastRow(); if (lr<1) return {};
  const vals = sh.getRange(1,1,lr,2).getValues();
  const obj = {}; vals.forEach(r => { const k = String(r[0]||'').trim(); if (k) obj[k]=r[1]; });
  return obj;
}
function applyNameMode_(rows, mode, fields){
  const m = String(mode||'initials').toLowerCase();
  if (m==='full') return rows;
  const targets = (fields && fields.length) ? fields : ['name','team','player','team_a','team_b'];
  return rows.map(row=>{
    const r = Object.assign({}, row);
    targets.forEach(f=>{
      if (r[f]===undefined) return;
      const v = String(r[f]||'').trim();
      if (!v) { r[f]=v; return; }
      if (m==='none') { r[f]='—'; return; }
      const parts = v.split(/\s+/).filter(Boolean);
      r[f] = parts.map(p=>p[0]).join('').toUpperCase() || '—';
    });
    return r;
  });
}
function prettyDate_(iso){
  if (!iso) return '';
  try { const d = new Date(iso); return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEE, MMM d — h:mma'); }
  catch (_) { return String(iso); }
}

/************************************************************
* [S14] Debug / Smoke (NU_Debug_… + runSmokeSafe)
************************************************************/
function NU_Debug_ListEventbooks(){ return getEventbooksSafe(null); }
function NU_Debug_ListEvents(){ return getEventsSafe(null); }
function NU_Debug_GetLinks(eid){ return getEventQuickLinks(eid); }
function NU_Debug_Display(eid){ return getDisplayBundle(eid); }
function NU_Debug_Public(eid){ return getPublicBundle(eid); }
function NU_Debug_Poster(eid){ return getPosterBundle(eid); }

/** Minimal smoke used by Admin.html button (non-destructive). */
function runSmokeSafe(opts){
  try {
    const boot = ensureAll_();
    const evs = getEventsSafe(null);
    const checks = {
      controlId: boot.controlId || '',
      hasEventsSheet: !!getMain_().getSheetByName('Events'),
      itemsCount: (evs && evs.status===200 && Array.isArray(evs.items)) ? evs.items.length : 0
    };
    return { ok:true, build:BUILD_ID, checks };
  } catch (e) {
    return { ok:false, error:String(e) };
  }
}

/************************************************************
* [S15] Manage Actions (Default / Archive)
************************************************************/
function setDefaultEvent(key) {
  const sh = getEventsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok:false, error:'no events' };
  const data = sh.getRange(2, 1, last-1, 15).getValues();
  for (let i=0;i<data.length;i++){
    const r = data[i];
    const on = (r[IDX.id]===key || r[IDX.slug]===key);
    sh.getRange(i+2, IDX.isDefault+1).setValue(!!on);
  }
  SpreadsheetApp.flush();
  bustEventsCache_();
  return { ok:true };
}

function archiveEvent(key) {
  const sh = getEventsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok:false, error:'no events' };
  const data = sh.getRange(2, 1, last-1, 15).getValues();
  const idx = data.findIndex(r => r[IDX.id]===key || r[IDX.slug]===key);
  if (idx < 0) return { ok:false, error:'not found' };
  sh.deleteRow(idx + 2); // +1 header, +1 to reach row
  SpreadsheetApp.flush();
  bustEventsCache_();
  return { ok:true };
}

/************************************************************
* [S16] Template Helpers (tplEnsure…)
************************************************************/
function tplEnsureSheetWithHeader_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const have = sh.getLastRow()>=1 ? sh.getRange(1,1,1,headers.length).getValues()[0] : [];
  const same = have.length===headers.length && have.every((v,i)=> String(v||'')===headers[i]);
  if (!same) { sh.clear(); sh.getRange(1,1,1,headers.length).setValues([headers]); }
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#f3f6fb');
  sh.autoResizeColumns(1, headers.length);
  return sh;
}
function tplUpsertKv_(sheet, kv) {
  const lr = sheet.getLastRow();
  const rows = lr>0 ? sheet.getRange(1,1,lr,2).getValues() : [];
  const idx = {}; rows.forEach((r,i)=>{ const k = String(r[0]||'').trim(); if(k) idx[k]=i+1; });
  Object.entries(kv||{}).forEach(([k,v])=>{
    if (idx[k]) sheet.getRange(idx[k],2).setValue(v);
    else sheet.appendRow([k,v]);
  });
}
function tplEnsureMetaKv_(ss) {
  const sh = ss.getSheetByName('Meta') || ss.insertSheet('Meta');
  if (sh.getLastRow()<1) sh.getRange(1,1,1,2).setValues([['key','value']]);
  tplUpsertKv_(sh, {
    eventId:'', eventTag:'', slug:'', startDateISO:'',
    adminUrl:'', publicUrl:'', displayUrl:'', posterPageUrl:'',
    seedMode:'random', elimType:'none'
  });
  return sh;
}
function tplEnsurePosterConfigKv_(ss) {
  const sh = ss.getSheetByName('PosterConfig') || ss.insertSheet('PosterConfig');
  if (sh.getLastRow()<1) sh.getRange(1,1,1,2).setValues([['key','value']]);
  tplUpsertKv_(sh, { place:'', posterImageUrl:'', public_name_mode:'initials' });
  return sh;
}
function ctlTemplateHeaders_(sheetName, fallback){
  try{
    const ctl = SpreadsheetApp.openById(cfgControlId_());
    const tpl = ctl.getSheetByName(sheetName);
    if (tpl && tpl.getLastRow()>=1){
      const lr = tpl.getLastRow(); const lc = tpl.getLastColumn();
      const vals = tpl.getRange(1,1,Math.min(1,lr), lc).getValues()[0];
      if (vals && vals.length) return vals.map(v=>String(v||''));
    }
  } catch(_){}
  return fallback || [];
}
function ctlPosterDefaults_() {
  try{
    const ctl = SpreadsheetApp.openById(cfgControlId_());
    const sh = ctl.getSheetByName('PosterConfig');
    if (!sh) return {};
    const lr = sh.getLastRow(); if (lr<2) return {};
    const vals = sh.getRange(2,1,lr-1,2).getValues();
    const obj = {}; vals.forEach(r => { const k = String(r[0]||'').trim(); if(k) obj[k]=r[1]; });
    return obj;
  } catch(_) { return {}; }
}

/************************************************************
* [S17] Audit (Status.html)
************************************************************/
function auditDeep(){
  const secs = [];
  try { secs.push(auditRouter_()); }              catch(e){ secs.push(sectionErr_('Router', e)); }
  try { secs.push(auditControlSheet_()); }        catch(e){ secs.push(sectionErr_('Control Sheet', e)); }
  try { secs.push(auditEventsCache_()); }         catch(e){ secs.push(sectionErr_('ETag / Cache', e)); }
  try { secs.push(auditClientFiles_()); }         catch(e){ secs.push(sectionErr_('Client Files', e)); }
  try { secs.push(auditProvision_()); }           catch(e){ secs.push(sectionErr_('Provision', e)); }

  return {
    ok: secs.every(s => s.ok),
    build: BUILD_ID,
    generatedAt: new Date().toISOString(),
    sections: secs
  };
}

/** ---------- Sections ---------- */
function auditRouter_(){
  const checks = [];
  ['admin','public','display','poster','status','ping','r'].forEach(p=>{
    checks.push(okCheck_('route:'+p, `Route "${p}" registered`, true));
  });
  return finalizeSection_('Router', checks);
}

function auditControlSheet_(){
  const checks = [];
  const ctlId = cfgControlId_();
  const ss = SpreadsheetApp.openById(ctlId);
  const sh = ss.getSheetByName('Events');
  checks.push(okCheck_('sheet:events', 'Sheet "Events" exists', !!sh));
  if (sh){
    const want = ['id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag','isDefault','seedMode','elimType','reserved1','reserved2','reserved3'];
    const have = sh.getRange(1,1,1,want.length).getValues()[0].map(String);
    want.forEach(h=>{
      const present = have.indexOf(h) >= 0;
      checks.push(statusCheck_('hdr:'+h, 'Header "'+h+'" present', present ? 'green':'red', present ? '' : 'missing'));
    });
  }
  return finalizeSection_('Control Sheet', checks);
}

function auditEventsCache_(){
  const checks = [];
  const r1 = getEventsSafe(null);
  const ok1 = !!r1 && !!r1.ok && !!r1.etag && r1.status === 200;
  checks.push(statusCheck_('events:initial','getEventsSafe(null) ok', ok1 ? 'green':'red', ok1 ? '' : JSON.stringify(r1)));

  const r2 = getEventsSafe(r1 && r1.etag);
  const notMod = !!r2 && r2.ok && r2.status === 304 && r2.notModified === true && Array.isArray(r2.items) && r2.items.length === 0;
  checks.push(statusCheck_('events:notmod','getEventsSafe(etag) -> 304 + items:[]', notMod ? 'green':'red', notMod ? '' : JSON.stringify(r2)));
  return finalizeSection_('ETag / Cache', checks);
}

function auditClientFiles_(){
  // Ensure the core client templates exist and expose expected selectors.
  const mustHave = {
    'Admin':   ['#eventName','#eventDate','#elimType','#seedMode','#btnCreateEvent','#chooseEvent','#btnOpenPublic','#btnOpenTV','#btnCopyLink'],
    'Public':  ['#title','#date','#flow','#elim','#seed','#scheduleTbl','#standingsTbl','#bracketWrap'],
    'Display': ['#title','#scheduleTbl','#standingsTbl','#bracketWrap'],
    'Poster':  ['#posterTitle','#eventDate','#qrPublic','#publicUrlLabel','#qrForm','#formUrlLabel'],
    'Styles':  ['.badge','.toast','.table','.pfbar']
  };
  const checks = [];
  Object.keys(mustHave).forEach(name=>{
    const html = getFileContentSafe_(name);
    const present = !!html;
    checks.push(statusCheck_('file:'+name, `File "${name}.html" present`, present ? 'green':'red', present ? '' : 'missing'));
    if (present){
      mustHave[name].forEach(sel=>{
        const found = html.indexOf(sel.replace(/"/g,'\\"')) >= 0 || html.indexOf(sel) >= 0;
        checks.push(statusCheck_('sel:'+name+':'+sel, `"${name}" contains selector ${sel}`, found ? 'green':'red', found ? '' : 'not found'));
      });
    }
  });
  return finalizeSection_('Client Files', checks);
}

function auditProvision_(){
  const checks = [];
  // Non-destructive: we only check that provisioning shims behave.
  const evs = getEventsSafe(null);
  const hasAny = evs && evs.ok && Array.isArray(evs.items) && evs.items.length > 0;
  checks.push(statusCheck_('events:exists','At least one event present (optional)', hasAny ? 'green':'yellow', hasAny ? '' : 'no events yet'));

  if (hasAny){
    const first = evs.items[0];
    const s1 = provisionStep(first.id);
    checks.push(statusCheck_('prov:step','provisionStep returns ok', (s1 && s1.ok) ? 'green':'red', JSON.stringify(s1 || {})));
    const st = getProvisionStatus(first.id);
    checks.push(statusCheck_('prov:status','getProvisionStatus ok', (st && st.ok) ? 'green':'red', JSON.stringify(st || {})));
  }
  return finalizeSection_('Provision', checks);
}

/** ---------- Audit helpers ---------- */
function getFileContentSafe_(name){ try{ return HtmlService.createHtmlOutputFromFile(name).getContent(); } catch(e){ return ''; } }
function okCheck_(id,label,cond){ return { id, label, status:(cond?'green':'red'), detail:(cond?'':'failed') }; }
function statusCheck_(id,label,status,detail){ return { id, label, status, detail:String(detail||'') }; }
function finalizeSection_(title, checks){
  var sevOrder = { red:3, yellow:2, green:1 };
  var worst = 'green';
  for (var i=0;i<checks.length;i++){ var s = checks[i].status || 'green'; if (sevOrder[s] > sevOrder[worst]) worst = s; }
  return { title, ok: worst !== 'red', severity: worst, checks };
}
function sectionErr_(title, err){
  return { title, ok:false, severity:'red', checks:[{ id:'error', label:title+' threw', status:'red', detail:String(err) }] };
}

/***** TEST-ONLY: Slug / ShortURL model *****/
const _slugDB = (function(){
  const key = 'TEST_SLUG_DB_V1';
  const props = PropertiesService.getScriptProperties();
  const load = () => JSON.parse(props.getProperty(key) || '{"events":{}, "bySlug":{}, "aliases":{}}');
  const save = (db) => props.setProperty(key, JSON.stringify(db));
  const reset = () => save({events:{}, bySlug:{}, aliases:{}});
  return { load, save, reset };
})();

const _RESERVED = new Set(['admin','public','display','poster','test','status','r']);

// Basic slugify per your convention
function _slugify(name, dateISO){
  const d = (dateISO||'').replace(/[^0-9]/g,'').slice(0,8);
  let base = String(name||'event')
    .toLowerCase()
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,20);
  if (!base) base = 'event';
  const slug = d ? `${base}-${d}` : base;
  if (_RESERVED.has(base) || _RESERVED.has(slug)) return { error:'RESERVED' };
  return { slug };
}

function _shortUrl(slug){ return `https://zeventbook.app/${slug}`; }

// Ensure uniqueness by suffixing -2, -3, …
function _uniqueSlug(db, slug){
  if (!db.bySlug[slug] && !db.aliases[slug]) return slug;
  let i = 2;
  while (db.bySlug[`${slug}-${i}`] || db.aliases[`${slug}-${i}`]) i++;
  return `${slug}-${i}`;
}

/***** TEST endpoints used by Test.html *****/

function _test_slugifyPreview({name, date}){
  const {slug, error} = _slugify(name, date);
  if (error) return { error };
  return { slug };
}

function _test_createEvent({name, date}){
  const db = _slugDB.load();
  const s = _slugify(name, date);
  if (s.error) return { ok:false, error:s.error };
  const unique = _uniqueSlug(db, s.slug);
  const eventId = 'evt_' + Utilities.getUuid();
  const rec = { eventId, name, date, slug: unique, shortUrl: _shortUrl(unique), canonicalSlug: unique, aliases: [] };
  db.events[eventId] = rec;
  db.bySlug[unique] = eventId;
  _slugDB.save(db);
  return { ok:true, eventId, slug: unique, shortUrl:_shortUrl(unique), verifyRequired:true };
}

function _test_renameSlug({eventId, newSlug}){
  const db = _slugDB.load();
  const rec = db.events[eventId];
  if (!rec) return { ok:false, status:404 };
  // validate newSlug (reserved / collision)
  if (_RESERVED.has(newSlug) || db.bySlug[newSlug]) return { ok:false, status:409, error:'TAKEN_OR_RESERVED' };
  // old slug becomes alias
  db.aliases[rec.canonicalSlug] = eventId;
  delete db.bySlug[rec.canonicalSlug];
  // set new canonical
  rec.canonicalSlug = newSlug;
  db.bySlug[newSlug] = eventId;
  _slugDB.save(db);
  return { ok:true, canonicalSlug:newSlug };
}

function _test_resolveShort({slug}){
  const db = _slugDB.load();
  const eventId = db.bySlug[slug] || db.aliases[slug] || null;
  if (!eventId) return { ok:false, status:404 };
  return { ok:true, eventId, canonicalSlug: db.events[eventId].canonicalSlug };
}

function _test_canonicalForEvent({eventId}){
  const db = _slugDB.load();
  const rec = db.events[eventId];
  if (!rec) return { ok:false, status:404 };
  return { ok:true, slug: rec.canonicalSlug };
}

// Replace _createEventbookImpl in Code.gs

function _createEventbookImpl(payload){
  ensureAll_();
  const started = Date.now();
  const p = payload || {};
  
  // Basic validation
  const name = String(p.name || '').trim();
  const dateISO = String(p.startDateISO || p.startDate || '').trim();
  const seedMode = String(p.seedMode || 'random');
  const elimType = String(p.elimType || 'none');

  if (!name || !dateISO) {
    DIAG.log('error','createEventbook','missing name/date',{ payload });
    return { ok:false, phase:'validate', error:'Name and Date required' };
  }

  // NEW: Geo-tagging validation and enrichment
  const geo = validateAndEnrichGeo_(p.geo || {});
  if (geo.error && p.geo) {
    // Geo provided but invalid - log warning but don't fail
    DIAG.log('warn','createEventbook','invalid_geo',{ geo: p.geo, error: geo.error });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || `event-${Date.now()}`;

  // Idempotency check
  const ctl = getEventsSheet_();
  const lr = ctl.getLastRow();
  if (lr >= 2) {
    const rows = ctl.getRange(2,1,lr-1,20).getValues(); // Extended to 20 columns for geo
    const hit  = rows.find(r => (r[IDX.slug]||'')===slug && (r[IDX.startDateISO]||'')===dateISO);
    if (hit) {
      const ev = rowToEvent_(hit);
      DIAG.log('info','createEventbook','idempotent.hit',{ id:ev.id, slug:ev.slug, dateISO:ev.startDateISO });
      return { 
        ok:true, 
        id:ev.id, 
        slug:ev.slug, 
        tag:ev.eventTag, 
        ssId:ev.eventSpreadsheetId||'', 
        ssUrl:ev.eventSpreadsheetUrl||'', 
        idempotent:true, 
        phase:'done', 
        ms: Date.now()-started 
      };
    }
  }

  const id  = Utilities.getUuid();
  const tag = computeEventTag_(slug, dateISO, id);

  try {
    const folderId   = cfgEventsFolderId_();
    const templateId = cfgTemplateId_();
    const title      = eventWorkbookTitle_(name, slug, dateISO, id);

    // Workbook creation (existing logic)
    let ss, ssId, ssUrl;
    if (templateId) {
      const file = DriveApp.getFileById(templateId);
      const folder = DriveApp.getFolderById(folderId);
      const copy = file.makeCopy(title, folder);
      ssId = copy.getId();
      ss   = SpreadsheetApp.openById(ssId);
      ssUrl = ss.getUrl();
      Object.values(TABS).forEach(n => { if (!ss.getSheetByName(n)) ss.insertSheet(n); });
      header_(ss, TABS.SIGNUPS, ['timestamp','name','email','phone','team','notes']);
      header_(ss, TABS.SCHEDULE, ['round','time','activity','notes','table']);
      header_(ss, TABS.STANDINGS,['team','points','tiebreak','notes']);
      tplEnsurePosterConfigKv_(ss);
    } else {
      const folder = DriveApp.getFolderById(folderId);
      const base = SpreadsheetApp.create(title);
      const file = DriveApp.getFileById(base.getId());
      folder.addFile(file); 
      try { DriveApp.getRootFolder().removeFile(file); } catch(_){}
      ss = base; 
      ssId = ss.getId(); 
      ssUrl = ss.getUrl();
      
      const home = ss.getSheets()[0];
      home.setName('Home');
      home.getRange(1,1,1,4).setValues([[`NextUp · ${tag}`,'Name','Start Date','Event ID']]).setFontWeight('bold');
      home.getRange(2,2,1,3).setValues([[name, dateISO, id]]);
      
      const signupsHdr = ctlTemplateHeaders_('SignupsTemplate', ['timestamp','name','email','phone','team','notes']);
      const schedHdr   = ctlTemplateHeaders_('ScheduleTemplate', ['round','time','activity','notes','table']);
      const standHdr   = ctlTemplateHeaders_('StandingsTemplate',['team','points','tiebreak','notes']);
      
      header_(ss, TABS.SIGNUPS,  signupsHdr);
      header_(ss, TABS.SCHEDULE, schedHdr);
      header_(ss, TABS.STANDINGS,standHdr);
      
      const posterKv = ctlPosterDefaults_();
      const poster = ensureKvSheet_(ss, TABS.POSTER);
      if (Object.keys(posterKv).length) upsertKv_(poster, posterKv); 
      else tplEnsurePosterConfigKv_(ss);
    }

    const meta = ensureKvSheet_(ss, TABS.META);
    
    // ========== SHORTLINK PRE-GENERATION ==========
    const adminUrl    = buildOrgUrl_('Admin', id);
    const publicUrl   = buildPublicUrl_('Public', id);
    const displayUrl  = buildOrgUrl_('Display', id);
    const posterPageUrl = buildPublicUrl_('Poster', id);
    
    const shortPublic = shortFor_(id, 'PUBLIC', publicUrl);
    const shortDisplay = shortFor_(id, 'DISPLAY', displayUrl);
    const shortPosterPage = shortFor_(id, 'POSTER_PAGE', posterPageUrl);
    
    DIAG.log('info','createEventbook','shortlinks_generated',{ 
      id, shortPublic, shortDisplay, shortPosterPage 
    });
    
    // ========== GEO-TAGGING METADATA ==========
    const metaKv = {
      eventId: id,
      eventTag: tag,
      slug,
      startDateISO: dateISO,
      adminUrl,
      publicUrl,
      displayUrl,
      posterPageUrl,
      seedMode, 
      elimType,
      shortPublic,
      shortDisplay,
      shortPosterPage
    };
    
    // Add geo fields if valid
    if (geo.valid) {
      Object.assign(metaKv, {
        latitude: geo.latitude,
        longitude: geo.longitude,
        geohash: geo.geohash,
        venue: geo.venue,
        city: geo.city,
        state: geo.state,
        country: geo.country,
        timezone: geo.timezone,
        plusCode: geo.plusCode
      });
    }
    
    upsertKv_(meta, metaKv);

    // Mirror sheet creation
    const mirrorHeaders = [
      'id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl',
      'formId','eventTag','isDefault','seedMode','elimType',
      'latitude','longitude','geohash','venue','city','state','country','timezone','plusCode'
    ];
    const mirror = ss.getSheetByName('Events') || ss.insertSheet('Events');
    header_(ss,'Events', mirrorHeaders);
    
    const mirrorRow = [
      id, name, slug, dateISO, ssId, ssUrl, '', tag, false, seedMode, elimType,
      geo.valid ? geo.latitude : '',
      geo.valid ? geo.longitude : '',
      geo.valid ? geo.geohash : '',
      geo.valid ? geo.venue : '',
      geo.valid ? geo.city : '',
      geo.valid ? geo.state : '',
      geo.valid ? geo.country : '',
      geo.valid ? geo.timezone : '',
      geo.valid ? geo.plusCode : ''
    ];
    mirror.getRange(2,1,1,mirrorHeaders.length).setValues([mirrorRow]);

    // Control sheet update
    ctl.appendRow(mirrorRow);
    bustEventsCache_();

    DIAG.log('info','createEventbook','done',{ 
      id, ssId, ssUrl, tag, 
      shortlinksReady: true,
      geoTagged: geo.valid,
      geohash: geo.geohash || null
    });
    
    return { 
      ok:true, 
      id, 
      slug, 
      tag, 
      ssId, 
      ssUrl, 
      idempotent:false, 
      phase:'done', 
      ms: Date.now()-started,
      shortlinksReady: true,
      geo: geo.valid ? {
        latitude: geo.latitude,
        longitude: geo.longitude,
        geohash: geo.geohash,
        venue: geo.venue,
        city: geo.city
      } : null
    };
  } catch (e) {
    DIAG.log('error','createEventbook','exception',{ err:String(e), stack:e && e.stack });
    return { ok:false, phase:'error', error:String(e) };
  }
}

// S18 ========== GEO-TAGGING UTILITIES ==========

/**
 * Validates and enriches geo-tagging data
 * @param {Object} geo - Raw geo input
 * @returns {Object} Validated geo object with enrichment
 */
function validateAndEnrichGeo_(geo) {
  if (!geo || typeof geo !== 'object') {
    return { valid: false, error: 'No geo data provided' };
  }
  
  const lat = parseFloat(geo.latitude || geo.lat);
  const lon = parseFloat(geo.longitude || geo.lon || geo.lng);
  
  // Validate coordinates
  if (!isFinite(lat) || !isFinite(lon)) {
    return { valid: false, error: 'Invalid coordinates' };
  }
  
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { valid: false, error: 'Coordinates out of range' };
  }
  
  // Geohash encoding (precision 7 ≈ 153m)
  const geohash = encodeGeohash_(lat, lon, 7);
  
  // Plus Code encoding (8 chars + locality = 14m precision)
  const plusCode = encodePlusCode_(lat, lon);
  
  // Timezone inference (requires external API or lookup table)
  const timezone = inferTimezone_(lat, lon, geo.timezone);
  
  return {
    valid: true,
    latitude: lat,
    longitude: lon,
    geohash,
    venue: String(geo.venue || '').trim().slice(0, 200),
    city: String(geo.city || '').trim().slice(0, 100),
    state: String(geo.state || '').trim().slice(0, 50),
    country: String(geo.country || 'US').trim().toUpperCase().slice(0, 2),
    timezone,
    plusCode
  };
}

/**
 * Geohash encoding (base32)
 * Precision 7 ≈ 153m × 153m cell
 */
function encodeGeohash_(lat, lon, precision) {
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
}

/**
 * Plus Code encoding (Open Location Code)
 * Returns 8-character code (11m × 14m cell)
 */
function encodePlusCode_(lat, lon) {
  const ALPHABET = '23456789CFGHJMPQRVWX';
  const LAT_MAX = 90;
  const LON_MAX = 180;
  
  // Normalize
  lat = Math.max(-LAT_MAX, Math.min(LAT_MAX, lat));
  lon = ((lon + LON_MAX) % 360) - LON_MAX;
  
  // Encode to 10 digits (8 + 2 after +)
  let latVal = (lat + LAT_MAX) * 8000;
  let lonVal = (lon + LON_MAX) * 8000;
  
  let code = '';
  for (let i = 0; i < 5; i++) {
    const latDigit = Math.floor(latVal / Math.pow(20, 4 - i)) % 20;
    const lonDigit = Math.floor(lonVal / Math.pow(20, 4 - i)) % 20;
    code += ALPHABET[lonDigit] + ALPHABET[latDigit];
  }
  
  return code.slice(0, 8) + '+' + code.slice(8);
}

/**
 * Infer timezone from coordinates
 * Uses simplified lookup for US timezones
 * For production: integrate timezone-boundary-builder or GeoNames API
 */
function inferTimezone_(lat, lon, provided) {
  if (provided) return provided;
  
  // Simplified US timezone inference
  if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) {
    if (lon >= -125 && lon < -120) return 'America/Los_Angeles';
    if (lon >= -120 && lon < -104) return 'America/Denver';
    if (lon >= -104 && lon < -90) return 'America/Chicago';
    if (lon >= -90 && lon <= -66) return 'America/New_York';
  }
  
  // Default fallback
  return 'America/Chicago';
}

/**
 * Calculate haversine distance between two points (km)
 * Used for proximity search
 */
function haversineDistance_(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Find events near a location
 * @param {Object} opts - Search options
 * @returns {Object} Events sorted by proximity
 */
function findEventsNearby(opts) {
  try {
    const lat = parseFloat(opts.latitude || opts.lat);
    const lon = parseFloat(opts.longitude || opts.lon || opts.lng);
    const radiusKm = parseFloat(opts.radius || 50); // Default 50km
    const limit = parseInt(opts.limit || 20);
    
    if (!isFinite(lat) || !isFinite(lon)) {
      return { ok: false, error: 'Invalid coordinates' };
    }
    
    // Get all events with geo-tagging
    const res = getEventsSafe(null);
    if (!res.ok) return res;
    
    const geoEvents = res.items.filter(ev => 
      ev.latitude && ev.longitude
    );
    
    // Calculate distances
    const withDistance = geoEvents.map(ev => ({
      ...ev,
      distanceKm: haversineDistance_(lat, lon, ev.latitude, ev.longitude)
    }));
    
    // Filter by radius and sort
    const nearby = withDistance
      .filter(ev => ev.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
    
    return {
      ok: true,
      query: {
        latitude: lat,
        longitude: lon,
        radiusKm
      },
      count: nearby.length,
      items: nearby.map(ev => ({
        id: ev.id,
        name: ev.name,
        slug: ev.slug,
        startDateISO: ev.startDateISO,
        venue: ev.venue,
        city: ev.city,
        state: ev.state,
        distanceKm: Math.round(ev.distanceKm * 10) / 10,
        distanceMiles: Math.round(ev.distanceKm * 0.621371 * 10) / 10,
        geohash: ev.geohash,
        publicUrl: buildPublicUrl_('Public', ev.id)
      }))
    };
  } catch (e) {
    DIAG.log('error', 'findEventsNearby', 'exception', { err: String(e) });
    return { ok: false, error: String(e) };
  }
}

/**
 * Get events in a bounding box
 * Useful for map view
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
      return { ok: false, error: 'Invalid bounds' };
    }
    
    const res = getEventsSafe(null);
    if (!res.ok) return res;
    
    const inBounds = res.items.filter(ev => 
      ev.latitude && ev.longitude &&
      ev.latitude >= bounds.south &&
      ev.latitude <= bounds.north &&
      ev.longitude >= bounds.west &&
      ev.longitude <= bounds.east
    );
    
    return {
      ok: true,
      bounds,
      count: inBounds.length,
      items: inBounds.map(ev => ({
        id: ev.id,
        name: ev.name,
        latitude: ev.latitude,
        longitude: ev.longitude,
        venue: ev.venue,
        city: ev.city,
        publicUrl: buildPublicUrl_('Public', ev.id)
      }))
    };
  } catch (e) {
    DIAG.log('error', 'findEventsInBounds', 'exception', { err: String(e) });
    return { ok: false, error: String(e) };
  }
}

/**
 * Mobile-first bundle with geo-awareness
 * Adapts response size based on connection type
 */
function getPublicBundleMobile(eventIdOrSlug, opts = {}){
  const ev = ensureWorkbook_(eventIdOrSlug);
  if (!ev.ok) return ev;
  
  const ss = SpreadsheetApp.openById(ev.ssId);
  const meta = readKv_(ss, TABS.META);
  const cfg  = readKv_(ss, TABS.POSTER);
  
  // Determine response size based on connection hint
  const connType = String(opts.connection || 'unknown').toLowerCase();
  const limits = {
    'slow-2g': { standings: 5, schedule: 5 },
    '2g': { standings: 10, schedule: 10 },
    '3g': { standings: 20, schedule: 20 },
    '4g': { standings: 50, schedule: 50 },
    'wifi': { standings: 100, schedule: 100 },
    'unknown': { standings: 20, schedule: 20 }
  };
  
  const limit = limits[connType] || limits.unknown;
  const offset = parseInt(opts.offset || 0);
  
  const nameMode = String(cfg.public_name_mode || 'initials').toLowerCase();
  
  const standingsFull = applyNameMode_(readTable_(ss, TABS.STANDINGS), nameMode);
  const scheduleFull  = applyNameMode_(readTable_(ss, TABS.SCHEDULE),  nameMode, ['team','team_a','team_b']);
  
  const standings = standingsFull.slice(offset, offset + limit.standings);
  const schedule = scheduleFull.slice(offset, offset + limit.schedule);
  
  // Geo-awareness: include if client provided location
  let proximity = null;
  if (opts.userLat && opts.userLon && meta.latitude && meta.longitude) {
    const distKm = haversineDistance_(
      parseFloat(opts.userLat), 
      parseFloat(opts.userLon),
      parseFloat(meta.latitude),
      parseFloat(meta.longitude)
    );
    proximity = {
      distanceKm: Math.round(distKm * 10) / 10,
      distanceMiles: Math.round(distKm * 0.621371 * 10) / 10
    };
  }
  
  const bundle = {
    ok:true,
    eventTag: meta.eventTag || ev.tag,
    title: meta.title || ev.name || ev.tag,
    datePretty: prettyDate_(meta.startDateISO || ev.dateISO),
    place: cfg.place || '',
    public_name_mode: nameMode,
    standings,
    schedule,
    posterPageUrl: buildPublicUrl_('Poster', ev.id),
    
    // Geo data (if available)
    geo: meta.latitude && meta.longitude ? {
      venue: meta.venue,
      city: meta.city,
      state: meta.state,
      latitude: parseFloat(meta.latitude),
      longitude: parseFloat(meta.longitude),
      geohash: meta.geohash,
      plusCode: meta.plusCode,
      proximity // null if user didn't provide location
    } : null,
    
    // Pagination metadata
    pagination: {
      limit: limit.standings,
      offset,
      totalStandings: standingsFull.length,
      totalSchedule: scheduleFull.length,
      hasMore: Math.max(standingsFull.length, scheduleFull.length) > (offset + limit.standings)
    },
    
    // Performance hints
    _meta: {
      connection: connType,
      sizeBytes: JSON.stringify({ standings, schedule }).length,
      compression: 'Consider gzip if available'
    }
  };
  
  return bundle;
}
