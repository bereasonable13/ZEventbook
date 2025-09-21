/************************************************************
* NextUp v4.1.1 — Code.gs (Eventbooks-first + Confidence Gate)
* - WILL-NOT-SHOW-UNTIL-ACTIVE gating (never show QR unless verified)
* - Strict Control bootstrap (self-heal, exact Events A–N header)
* - Eventbook create (idempotent), mirror links into Events!E:F
* - Stable ETag + SWR-safe getEventsSafe()
* - Shortlinks + poster/meta wiring intact
************************************************************/

const BUILD_ID = 'nextup-v4.1.1-eventbooks-confidence';
const CONTROL_TITLE = 'NextUp - Control';

/** ---------- 1) OPTIONAL CONFIG (used if provided; otherwise self-healing fills in) ---------- */
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

/** ---------- 2) CLIENT LOGGING ---------- */
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

/** ---------- 3) CONFIG HELPERS ---------- */
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

/** ---------- 4) SELF-HEALING BOOTSTRAP (strict & idempotent) ---------- */
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
    { name:'Meta', headers:['key','value'], rows:[['version','4.1.1'], ['owner', owner]] }
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

/** ---------- 5) MODEL / ROUTER ---------- */
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

  const PAGE = { admin:'Admin', public:'Public', display:'Display', poster:'Poster', test:'Test' };
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

/** ---------- 6) Events Index (ETag + SWR) ---------- */
function getMain_(){ ensureAll_(); return SpreadsheetApp.openById(cfgControlId_()); }
function getEventsSheet_(){ const ss = getMain_(); return ss.getSheetByName(EVENTS_SHEET) || ss.insertSheet(EVENTS_SHEET); }

function computeEventTag_(slug, dateISO, id){
  const s = (String(slug||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'event').slice(0,48);
  const ymd = String(dateISO||'').replace(/-/g,'') || Utilities.formatDate(new Date(), Session.getScriptTimeZone(),'yyyyMMdd');
  const id6 = String(id||'').replace(/-/g,'').slice(0,6) || 'xxxxxx';
  return `${s}-${ymd}-${id6}`;
}
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
function _eventsEtag_(items){
  const lite = items.map(x => [x.id,x.slug,x.startDateISO,x.eventSpreadsheetId,x.formId,x.eventTag,x.seedMode,x.elimType]);
  const b = Utilities.newBlob(JSON.stringify(lite)).getBytes();
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, b)).slice(0,16);
}
function getEventbooksSafe(etagOpt){ return getEventsSafe(etagOpt); }
function getEventsSafe(etagOpt){
  ensureAll_();
  const sh = getEventsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok:true, status:200, etag:'empty', items:[] };
  const data = sh.getRange(2,1,last-1,15).getValues();
  const items = data.filter(r => String(r[IDX.id]||'').trim()).map(rowToEvent_);
  const etag = _eventsEtag_(items);
  PropertiesService.getScriptProperties().setProperty('NU_EVENTS_ETAG', etag);
  if (etagOpt && etagOpt === etag) return { ok:true, status:304, etag, items:[] };
  return { ok:true, status:200, etag, items };
}

/** ---------- 7) Eventbook Creation (workbook-first, idempotent) ---------- */
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
  const p = payload || {};
  const name = String(p.name || '').trim();
  const dateISO = String(p.startDateISO || p.startDate || '').trim();
  const seedMode = String(p.seedMode || 'random');
  const elimType = String(p.elimType || 'none');

  if (!name || !dateISO) {
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

/** ---------- 8) Form Linking & Imports (unchanged) ---------- */
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

/** ---------- 9) Quick Links / Shortlinks / QR ---------- */
const SHORT_KEY_MAP = 'NU_SHORTLINKS_MAP_V1';
const SHORT_TARGET_MAP = 'NU_SHORTLINKS_TARGETS_V1';
const Shortlinks = {
  set(key, target){
    if (!target) return '';
    const props = PropertiesService.getScriptProperties();
    const map = JSON.parse(props.getProperty(SHORT_KEY_MAP)||'{}');
    let token = map[key];
    if (!token){
      token = this._token(`${key}|${target}`);
      map[key] = token;
      props.setProperty(SHORT_KEY_MAP, JSON.stringify(map));
    }
    const tmap = JSON.parse(props.getProperty(SHORT_TARGET_MAP)||'{}');
    tmap[token] = target;
    props.setProperty(SHORT_TARGET_MAP, JSON.stringify(tmap));
    return this.url(token);
  },
  resolve(token){
    const tmap = JSON.parse(PropertiesService.getScriptProperties().getProperty(SHORT_TARGET_MAP)||'{}');
    return tmap[token] || null;
  },
  url(token){ const base = cfgPubUrl_(); return `${base}?page=R&t=${encodeURIComponent(token)}`; },
  _token(raw){ return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)).slice(0,10); }
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
    // IMPORTANT: Consumers must only use QR that correspond to a shortlink (verified)
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

/** ---------- 10) Bundles (unchanged shapes) ---------- */
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

/** ---------- 11) Confidence / Visibility — WILL-NOT-SHOW-UNTIL-ACTIVE ---------- */
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

/** ---------- 12) URL Builders & Cache ---------- */
function buildOrgUrl_(page, eventId){   const base = cfgOrgUrl_();  return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`; }
function buildPublicUrl_(page, eventId){ const base = cfgPubUrl_(); return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`; }
function bustEventsCache_(){
  try { CacheService.getScriptCache().remove('events_index'); } catch(_) {}
  try { PropertiesService.getScriptProperties().deleteProperty('NU_EVENTS_ETAG'); } catch(_) {}
}

/** ---------- 13) Data Utils ---------- */
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

/** ---------- 14) Debug helpers ---------- */
function NU_Debug_ListEventbooks(){ return getEventbooksSafe(null); }
function NU_Debug_ListEvents(){ return getEventsSafe(null); }
function NU_Debug_GetLinks(eid){ return getEventQuickLinks(eid); }
function NU_Debug_Display(eid){ return getDisplayBundle(eid); }
function NU_Debug_Public(eid){ return getPublicBundle(eid); }
function NU_Debug_Poster(eid){ return getPosterBundle(eid); }

/** ---------- 15) Template helpers ---------- */
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