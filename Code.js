/************************************************************
 * NextUp v4.1.1.1 — Eventbooks + Diagnostics (FULL REWRITE)
 * - Router (?p=admin|public|display|poster|status)
 * - Cold/Warm open: guaranteed "NextUp - Control"
 * - Events API (SWR-safe), idempotent createEventbook
 * - setDefaultEvent, archiveEvent
 * - configureSignupForm (idempotent)
 * - Share links, QR (with verification gate)
 * - Structured logging + ring buffer; log fetch/clear
 * - Smoke test runner (server) for Diagnostics card
 ************************************************************/

const BUILD_ID = 'nextup-v4.1.1.1-full';
const CONTROL_TITLE = 'NextUp - Control';
const PROP_CONTROL_ID = 'NEXTUP_CONTROL_SSID';

const EVENTS_HEADER = [
  'id','name','slug','startDateISO',
  'eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag',
  'isDefault','seedMode','elimType','reserved1','reserved2','reserved3'
];

const CONFIG_DEFAULTS = [
  ['key','value'],
  ['APP_TITLE','NextUp'],
  ['BUILD_ID', BUILD_ID],
  ['NORTH_STAR','Never display a QR unless verified'],
];

const SHORTLINKS_HEADER = [['token','kind','targetUrl','createdISO']];
const LOGS_HEADER       = [['tsISO','level','where','message','meta']];

const LOGS_SHEET = 'Logs';
const LOG_LIMIT = 1500;  // keep last N rows

/* ------------------------------ Router ------------------------------ */
function doGet(e) {
  try { ensureControlStrictOnBoot(); } 
  catch (err) { return HtmlService.createHtmlOutput(`<pre>Bootstrap failed:\n${String(err)}</pre>`); }

  const p = (e && (e.parameter.p || e.parameter.page)) || 'admin';
  const t = HtmlService.createTemplateFromFile(_route_(p));
  t.appTitle = 'NextUp';
  t.BUILD_ID = BUILD_ID;
  t.ROOT_URL = ScriptApp.getService().getUrl();
  t.query    = e ? e.parameter : {};
  return t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _route_(p){
  if (p === 'public')  return 'Public';
  if (p === 'display') return 'Display';
  if (p === 'poster')  return 'Poster';
  if (p === 'status')  return 'Test';    // lightweight page; optional
  return 'Admin';
}

function include(name){ return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/* -------------------- Control Cold-Open Guarantee ------------------- */
function ensureControlStrictOnBoot() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_CONTROL_ID), ss = null;

  if (id) { try { ss = SpreadsheetApp.openById(id); } catch(_) { ss = null; } }
  if (!ss) {
    const it = DriveApp.getFilesByName(CONTROL_TITLE);
    ss = it.hasNext() ? SpreadsheetApp.open(it.next()) : SpreadsheetApp.create(CONTROL_TITLE);
    props.setProperty(PROP_CONTROL_ID, ss.getId());
  }
  if (ss.getName() !== CONTROL_TITLE) ss.rename(CONTROL_TITLE);

  // Events first with header
  let ev = ss.getSheetByName('Events');
  if (!ev) { ev = ss.getSheets()[0]; if (ev.getName() !== 'Events') ev.setName('Events'); }
  if (ss.getSheets()[0].getName() !== 'Events') ss.setActiveSheet(ev).moveActiveSheet(1);
  _ensureHeader_(ev, EVENTS_HEADER);

  // Baseline tabs
  _ensureTab_(ss, 'Config',     CONFIG_DEFAULTS);
  _ensureTab_(ss, 'Shortlinks', SHORTLINKS_HEADER);
  _ensureTab_(ss, LOGS_SHEET,   LOGS_HEADER);

  return { id: ss.getId(), url: ss.getUrl(), title: ss.getName() };
}

function _ensureTab_(ss, name, headerRows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (headerRows && headerRows.length) {
    const r = sh.getRange(1,1,headerRows.length, headerRows[0].length);
    r.setValues(headerRows);
  }
  return sh;
}

function _ensureHeader_(sh, header){
  const r = sh.getRange(1,1,1,header.length);
  const existing = r.getValues()[0] || [];
  if (existing.join('|') !== header.join('|')) r.setValues([header]);
}

/* ------------------------------ Helpers ----------------------------- */
function _control_(){
  const id = PropertiesService.getScriptProperties().getProperty(PROP_CONTROL_ID);
  if (!id) throw new Error('Control not initialized');
  return SpreadsheetApp.openById(id);
}
function _slugify_(s){
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    .slice(0,64) || 'event';
}
function _ymd_(d){ const dt = (d ? new Date(d) : new Date()); return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyyMMdd'); }
function _iso_(d){ return Utilities.formatDate(d || new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function _id6_(){ return Math.random().toString(36).slice(2,8); }
function _rowToObj_(hdr, row){ const o={}; for (let i=0;i<hdr.length;i++) o[hdr[i]] = row[i] ?? ''; return o; }
function _objToRow_(hdr, obj){ return hdr.map(k => obj[k] ?? ''); }
function _eventTag_(slug, startISO, id6){ const ymd = (startISO||'').replace(/-/g,'').slice(0,8) || _ymd_(); return `${slug}-${ymd}-${id6}`; }

/* ------------------------- Structured Logging ----------------------- */
function _log_(level, where, message, meta){
  try {
    const ss = _control_();
    const sh = ss.getSheetByName(LOGS_SHEET) || ss.insertSheet(LOGS_SHEET);
    sh.appendRow([_iso_(), level, where, message, meta ? JSON.stringify(meta) : '']);
    // keep to LOG_LIMIT rows (cheap trim occasionally)
    const lastRow = sh.getLastRow();
    if (lastRow > LOG_LIMIT + 100) {
      const toDelete = lastRow - LOG_LIMIT;
      sh.deleteRows(2, Math.max(0, Math.min(toDelete, lastRow-1)));
    }
  } catch(_) {}
}
function getLogs(limit){
  try {
    const ss = _control_();
    const sh = ss.getSheetByName(LOGS_SHEET);
    if (!sh) return { ok:true, items:[] };
    const last = sh.getLastRow();
    const width = LOGS_HEADER[0].length;
    if (last < 2) return { ok:true, items:[] };
    const take = Math.max(1, Math.min(Number(limit||200), 1000));
    const start = Math.max(2, last - take + 1);
    const vals = sh.getRange(start,1,last-start+1,width).getValues();
    const items = vals.map(r => ({tsISO:r[0], level:r[1], where:r[2], message:r[3], meta:r[4]}));
    return { ok:true, items };
  } catch(e){
    return { ok:false, error:String(e) };
  }
}
function clearLogs(){
  try {
    const ss = _control_();
    const sh = ss.getSheetByName(LOGS_SHEET) || ss.insertSheet(LOGS_SHEET);
    sh.clear(); sh.appendRow(LOGS_HEADER[0]);
    return { ok:true };
  } catch(e){
    return { ok:false, error:String(e) };
  }
}

/* -------------------------------- API ------------------------------- */
// SWR-safe Events list
function getEventsSafe(etagIn){
  try {
    const ss = _control_(); const sh = ss.getSheetByName('Events');
    if (!sh) return { ok:true, items:[], etag:'0', notModified: etagIn==='0' };
    const last = sh.getLastRow();
    if (last < 2) return { ok:true, items:[], etag:'0', notModified: etagIn==='0' };
    const vals = sh.getRange(2,1,last-1+1, EVENTS_HEADER.length).getValues();
    const items = vals.filter(r => r.some(v => v !== '')).map(r => _rowToObj_(EVENTS_HEADER, r));
    const etag = String(items.length);
    if (etagIn && etagIn === etag) return { ok:true, items:[], etag, notModified:true };
    return { ok:true, items, etag, notModified:false };
  } catch (e) {
    _log_('error','getEventsSafe',String(e));
    return { ok:false, items:[], error:String(e) };
  }
}

// Create Eventbook (idempotent on slug+startDateISO)
function createEventbook(payload){
  const where = 'createEventbook';
  try {
    const p = payload || {};
    const name = String(p.name || '').trim();
    const startDateISO = p.startDateISO || '';
    const seedMode = p.seedMode || 'random';
    const elimType = p.elimType || 'single';
    if (!name) throw new Error('Name required');

    const slug = _slugify_(name || (p.slug || 'event'));
    const ss = _control_();
    const sh = ss.getSheetByName('Events');

    // Find existing by slug+date
    const last = sh.getLastRow();
    if (last >= 2) {
      const vals = sh.getRange(2,1,last-1+1, EVENTS_HEADER.length).getValues();
      for (let i=0;i<vals.length;i++){
        const o = _rowToObj_(EVENTS_HEADER, vals[i]);
        if ((o.slug||'')===slug && (o.startDateISO||'')===startDateISO) {
          _log_('info', where, 'idempotent-return', o);
          return { ok:true, id:o.id, idempotent:true, item:o };
        }
      }
    }

    // Create Eventbook workbook
    const id6 = _id6_();
    const eventTag = _eventTag_(slug, startDateISO, id6);
    const wbTitle = `EVT__${eventTag}`;
    const wb = SpreadsheetApp.create(wbTitle);

    // Ensure Events header in the workbook
    let ev = wb.getSheets()[0];
    if (ev.getName()!=='Events') ev.setName('Events');
    _ensureHeader_(ev, EVENTS_HEADER);

    const rowObj = {
      id: id6, name, slug, startDateISO,
      eventSpreadsheetId: wb.getId(),
      eventSpreadsheetUrl: wb.getUrl(),
      formId: '',
      eventTag,
      isDefault: '',
      seedMode, elimType,
      reserved1:'', reserved2:'', reserved3:''
    };
    sh.appendRow(_objToRow_(EVENTS_HEADER, rowObj));
    _log_('info', where, 'created', rowObj);

    return { ok:true, id:id6, item: rowObj, createdWorkbook:true };
  } catch (e) {
    _log_('error', where, String(e), payload);
    return { ok:false, error:String(e) };
  }
}

function setDefaultEvent(eventId){
  const where='setDefaultEvent';
  try {
    const ss = _control_(); const sh = ss.getSheetByName('Events');
    const last = sh.getLastRow(); if (last < 2) return { ok:false, error:'No events' };

    const vals = sh.getRange(2,1,last-1+1, EVENTS_HEADER.length).getValues();
    for (let i=0;i<vals.length;i++){
      const o = _rowToObj_(EVENTS_HEADER, vals[i]);
      o.isDefault = (o.id === eventId) ? '★' : '';
      vals[i] = _objToRow_(EVENTS_HEADER, o);
    }
    sh.getRange(2,1,vals.length, EVENTS_HEADER.length).setValues(vals);
    _log_('info', where, 'updated', {eventId});
    return { ok:true };
  } catch(e){
    _log_('error', where, String(e), {eventId});
    return { ok:false, error:String(e) };
  }
}

function archiveEvent(eventId){
  const where='archiveEvent';
  try {
    const ss = _control_(); const sh = ss.getSheetByName('Events');
    const last = sh.getLastRow(); if (last < 2) return { ok:false, error:'No events' };

    const vals = sh.getRange(2,1,last-1+1, EVENTS_HEADER.length).getValues();
    let changed=false;
    for (let i=0;i<vals.length;i++){
      const o = _rowToObj_(EVENTS_HEADER, vals[i]);
      if (o.id === eventId) { o.reserved1 = 'archived'; vals[i]=_objToRow_(EVENTS_HEADER,o); changed=true; }
    }
    if (changed) sh.getRange(2,1,vals.length, EVENTS_HEADER.length).setValues(vals);
    _log_('info', where, 'archived', {eventId});
    return { ok:true, changed };
  } catch(e){
    _log_('error', where, String(e), {eventId});
    return { ok:false, error:String(e) };
  }
}

// Form creation/linking (idempotent)
function configureSignupForm(eventId){
  const where='configureSignupForm';
  try {
    const ss=_control_(), sh=ss.getSheetByName('Events');
    const last=sh.getLastRow(); if (last<2) throw new Error('No events');

    const width=EVENTS_HEADER.length;
    const vals=sh.getRange(2,1,last-1+1,width).getValues();
    let idx=-1, rowObj=null;
    for (let i=0;i<vals.length;i++){
      const o=_rowToObj_(EVENTS_HEADER,vals[i]);
      if (o.id===eventId){ idx=i; rowObj=o; break; }
    }
    if (idx<0) throw new Error('Event not found');

    if (rowObj.formId){
      const form=FormApp.openById(rowObj.formId);
      _log_('info', where, 'idempotent-return', {eventId});
      return { ok:true, idempotent:true, formId: rowObj.formId, formUrl: form.getEditUrl() };
    }

    const form=FormApp.create(`Signup · ${rowObj.name || rowObj.eventTag}`);
    form.setDescription(`Event: ${rowObj.name || rowObj.slug} (${rowObj.startDateISO || ''})`);
    form.addTextItem().setTitle('Team / Player Name').setRequired(true);
    form.addTextItem().setTitle('Email').setRequired(true);
    form.addTextItem().setTitle('Phone');
    form.addParagraphTextItem().setTitle('Notes');

    rowObj.formId = form.getId();
    vals[idx]=_objToRow_(EVENTS_HEADER,rowObj);
    sh.getRange(2,1,vals.length,width).setValues(vals);
    _log_('info', where, 'created', {eventId, formId: rowObj.formId});

    return { ok:true, formId: rowObj.formId, formUrl: form.getEditUrl() };
  } catch(e){
    _log_('error', where, String(e), {eventId});
    return { ok:false, error:String(e) };
  }
}

/* --------------- Share links + QR (+ verification gate) ------------- */
function getShareLinks(eventId){
  try{
    const base = ScriptApp.getService().getUrl();
    const publicUrl  = `${base}?p=public&event=${encodeURIComponent(eventId)}`;
    const displayUrl = `${base}?p=display&event=${encodeURIComponent(eventId)}`;
    const posterUrl  = `${base}?p=poster&event=${encodeURIComponent(eventId)}`;
    return { ok:true, publicUrl, displayUrl, posterUrl };
  } catch(e){ return { ok:false, error:String(e) }; }
}

function verifyEventSafe(eventId){
  // Hook for your real checks later: workbook exists, links present, not archived, etc.
  // For now: valid event id present in Events and NOT archived.
  try{
    const ss=_control_(), sh=ss.getSheetByName('Events');
    const last=sh.getLastRow(); if (last<2) return { ok:true, verified:false, reason:'no-events' };
    const vals=sh.getRange(2,1,last-1+1,EVENTS_HEADER.length).getValues();
    for (let i=0;i<vals.length;i++){
      const o=_rowToObj_(EVENTS_HEADER,vals[i]);
      if (o.id===eventId){
        const notArchived = (o.reserved1||'')!=='archived';
        return { ok:true, verified: !!(o.eventSpreadsheetId && notArchived) };
      }
    }
    return { ok:true, verified:false, reason:'not-found' };
  } catch(e){ return { ok:false, error:String(e) }; }
}

function getShareQr(eventId){
  const check = verifyEventSafe(eventId);
  if (!check.ok) return check;
  if (!check.verified) return { ok:true, verified:false, qrUrl:null, url:null }; // honor north-star
  const links = getShareLinks(eventId);
  if (!links.ok) return links;
  const url = links.publicUrl;
  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(url)}`;
  return { ok:true, verified:true, url, qrUrl };
}

/* ---------------------------- Public bundle ------------------------- */
function getPublicBundle(eventId){
  return { ok:true, eventId, build:BUILD_ID, message:'Public bundle placeholder' };
}

/* ----------------------------- Smoke Tests -------------------------- */
function runSmokeSafe(opts){
  const started = new Date();
  const report = { ok:true, build:BUILD_ID, startedISO:_iso_(started), steps:[], durationMs:0 };

  function step(name, fn){
    const t0 = new Date();
    try {
      const out = fn();
      const dt = new Date() - t0;
      report.steps.push({ name, ok:true, ms:dt, out });
    } catch (e) {
      const dt = new Date() - t0;
      report.steps.push({ name, ok:false, ms:dt, error:String(e) });
      report.ok = false;
    }
  }

  // 1) Control present
  step('ensureControlStrictOnBoot', () => ensureControlStrictOnBoot());

  // 2) Events read
  step('getEventsSafe(empty-ok)', () => getEventsSafe(null));

  // 3) Create eventbook
  const name = `Smoke ${_ymd_()} ${_id6_()}`;
  let created = null;
  step('createEventbook', () => {
    const res = createEventbook({ name, startDateISO: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), seedMode:'random', elimType:'single' });
    if (!res || res.ok===false) throw new Error('create failed');
    created = res.item || res;
    return { id: res.id, tag: created.eventTag };
  });

  // 4) ETag delta
  step('getEventsSafe(etag)', () => {
    const first = getEventsSafe(null);
    const second = getEventsSafe(first.etag);
    return { firstCount:first?.etag, secondNotModified: second?.notModified===true };
  });

  // 5) Links + verify + QR (may be gated)
  step('getShareLinks', () => getShareLinks(created.id));
  step('verifyEventSafe', () => verifyEventSafe(created.id));
  step('getShareQr', () => getShareQr(created.id));

  // optional: Form dry-run (no-op if you don’t want to create real forms during smoke)
  if (opts && opts.form === true) {
    step('configureSignupForm', () => configureSignupForm(created.id));
  }

  report.durationMs = new Date() - started;
  _log_(report.ok ? 'info' : 'error', 'runSmokeSafe', report.ok ? 'ok' : 'failed', { durationMs: report.durationMs });
  return report;
}

/* ----------------------------- Diagnostics -------------------------- */
function ping(){ return { ok:true, build:BUILD_ID, control: ensureControlStrictOnBoot() }; }