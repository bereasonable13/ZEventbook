/** =====================================================================
 * NextUp · Apps Script backend · v4.1.1b (merged)
 * - v4.0 Control bootstrap (ensure on cold open) + Diagnostics
 * - v4.1.1 features: sheet-backed events, Drive QR cache, strict QR invariant
 * - Self-healing template/control; idempotent event creation
 * - Public/Share/Signup APIs; Test harness + self-tests
 * - Routes: Admin / Poster / Public / Display / Test
 * ===================================================================== */

/** ---------- Build metadata ---------- */
function _getBuildId_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('nu_build_id');
  if (!id) { id = 'dev-' + new Date().toISOString(); p.setProperty('nu_build_id', id); }
  return id;
}

/** ---------- Legacy-compatible constants (v4.0) ---------- */
var CONTROL_TITLE = 'NextUp - Control';
var CFG_KEYS = {
  CONTROL_ID: 'NU_CONTROL_SSID',       // also mirrored to _K.CTRL_BOOK_ID
  TEMPLATE_ID: 'NU_TEMPLATE_SSID',     // also mirrored to _K.CTRL_TEMPLATE_ID
  EVENTS_DIR: 'NU_EVENTS_FOLDERID',
  ORG_URL: 'NU_ORG_BASE_URL',
  PUB_URL: 'NU_PUBLIC_BASE_URL'
};

/** ---------- Properties / config helpers (v4.0 style) ---------- */
function cfgGet_(k, fallbackConst) {
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty(k);
  if (v) return v;
  if (fallbackConst &&
      String(fallbackConst).indexOf('PUT_') === -1 &&
      String(fallbackConst).indexOf('_DEPLOYMENT_ID') === -1) {
    props.setProperty(k, fallbackConst);
    return fallbackConst;
  }
  return '';
}
function cfgSet_(k, val) { if (val) PropertiesService.getScriptProperties().setProperty(k, val); }

/** ---------- Key map (v4.1.1) ---------- */
var _K = {
  EVENTS_ETAG:    'nu_events_etag_salt',
  EVENTS_CACHE:   'events_payload_v1',

  TEST_MODE:      'nu_test_mode',
  SCN_PREFIX:     'nu_test_scn_',
  SU_PREFIX:      'nu_test_su_',
  SUQ_PREFIX:     'nu_test_suq_',
  PU_PREFIX:      'nu_test_pu_',
  PUQ_PREFIX:     'nu_test_puq_',

  ADM_SIGNUP:     'nu_admin_signup_',
  ADM_MODE:       'nu_admin_mode_',
  ADM_COACH:      'nu_admin_coach_',

  SHEET_ID:       'nu_events_sheet_id',
  SHEET_RANGE:    'nu_events_sheet_range',

  QR_FOLDER_ID:   'nu_qr_cache_folder_id',
  QR_B64_CACHE_PREFIX: 'nu_qr_b64_',
  QR_FILEID_CACHE_PREFIX: 'nu_qr_id_',

  CTRL_TEMPLATE_ID: 'nu_control_template_id',
  CTRL_BOOK_ID:     'nu_control_book_id',
  CTRL_REQ_TABS:    'nu_control_required_tabs',
  EVENT_BOOK_PREFIX:'nu_event_book_'
};

/** ---------- Small helpers ---------- */
function include(name){ return HtmlService.createHtmlOutputFromFile(name).getContent(); }
function _json_(x){ return JSON.stringify(x); }
function _todayISO_(){ return new Date().toISOString().slice(0,10); }
function _isUri_(s){ try{ var u=new URL(s); return !!u.protocol && !!u.host; }catch(_e){ return false; } }
function _sha1hex_(str){
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, str, Utilities.Charset.UTF_8);
  return bytes.map(function(b){ var v=(b+256)%256; return ('0'+v.toString(16)).slice(-2); }).join('');
}

/** =====================================================================
 * Diagnostics (v4.0) + clientLog()
 * ===================================================================== */
var DIAG = {
  LOG_SHEET: 'Diagnostics',
  log: function(level, where, msg, data){
    try {
      var ssId = cfgControlId_(); if (!ssId) return { ok:false, err:'no control' };
      var ss = SpreadsheetApp.openById(ssId);
      var sh = ss.getSheetByName(this.LOG_SHEET) || ss.insertSheet(this.LOG_SHEET);
      if (sh.getLastRow() === 0) {
        sh.getRange(1,1,1,5).setValues([['ts','level','where','msg','data']]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
      var row = [[new Date(), String(level||'info'), String(where||''), String(msg||''), data ? JSON.stringify(data) : '']];
      sh.getRange(sh.getLastRow()+1,1,1,5).setValues(row);
      return { ok:true };
    } catch (e) { return { ok:false, err:String(e) }; }
  }
};

/** Client → server logging (strict schema). */
function clientLog(entry) {
  try {
    var e = entry || {};
    var level = String(e.level || 'info');
    var where = 'client:' + String(e.where || '');
    var msg = String(e.msg || '');
    var ts = Number(e.ts);
    if (!isFinite(ts)) { ts = Date.now(); DIAG.log('warn','clientLog','missing ts; synthesized',{ where, msg }); }
    var data = (e.data && typeof e.data === 'object') ? Object.assign({}, e.data, { ts: ts }) : { ts: ts };
    DIAG.log(level, where, msg, data);
    return { ok:true };
  } catch (err) {
    try { DIAG.log('error','clientLog','exception',{ err:String(err) }); } catch (_){}
    return { ok:false, error:String(err) };
  }
}

/** =====================================================================
 * HTML router — cold-open bootstrap maintained
 * ===================================================================== */
function doGet(e) {
  // v4.0 behavior: ensure control/template/base on cold open
  ensureControlStrictOnBoot();

  var p = (e && e.parameter) || {};
  var key = String(p.page || p.p || 'admin').toLowerCase();
  var map = { admin:'Admin', poster:'Poster', public:'Public', display:'Display', test:'Test' };
  var page = map[key] || 'Admin';

  var tpl = HtmlService.createTemplateFromFile(page);
  tpl.appTitle = 'NextUp';
  tpl.BUILD_ID = _getBuildId_();
  return tpl.evaluate()
    .setTitle('NextUp · ' + page)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width,initial-scale=1,viewport-fit=cover');
}

/** =====================================================================
 * Drive-backed QR cache
 * ===================================================================== */
function setQrCacheFolderById(folderId){
  if(!folderId) throw new Error('folderId required');
  DriveApp.getFolderById(folderId);
  PropertiesService.getScriptProperties().setProperty(_K.QR_FOLDER_ID, folderId);
  return { ok:true, folderId: folderId };
}
function _ensureQrCacheFolder_(){
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(_K.QR_FOLDER_ID);
  try { if (id) return DriveApp.getFolderById(id); } catch(_e){ p.deleteProperty(_K.QR_FOLDER_ID); }
  var f = DriveApp.getRootFolder().createFolder('NextUp_QR_Cache');
  p.setProperty(_K.QR_FOLDER_ID, f.getId());
  return f;
}
function _qrFetchBytes_(url){
  var api='https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl='+encodeURIComponent(url);
  var resp = UrlFetchApp.fetch(api, { muteHttpExceptions:true });
  if (resp.getResponseCode()>=200 && resp.getResponseCode()<300) return resp.getContent();
  throw new Error('qr_fetch_failed:'+resp.getResponseCode());
}
function qrCacheGetOrMake_(url){
  if(!url || !_isUri_(url)) throw new Error('invalid_url');
  var cache = CacheService.getScriptCache();
  var key = _sha1hex_(url);
  var c = cache.get(_K.QR_B64_CACHE_PREFIX + key);
  if (c) return c;
  var folder = _ensureQrCacheFolder_();
  var fname = 'qr_' + key + '.png';
  var file, fidMemo = cache.get(_K.QR_FILEID_CACHE_PREFIX + key);
  if (fidMemo) { try { file = DriveApp.getFileById(fidMemo); } catch(_e){} }
  if (!file) {
    var files = folder.getFilesByName(fname);
    if (files.hasNext()) file = files.next();
  }
  if (!file) {
    var bytes = _qrFetchBytes_(url);
    file = folder.createFile(fname, Utilities.newBlob(bytes, 'image/png', fname));
  }
  var b64 = Utilities.base64Encode(file.getBlob().getBytes());
  cache.put(_K.QR_B64_CACHE_PREFIX + key, b64, 60*60*6);
  cache.put(_K.QR_FILEID_CACHE_PREFIX + key, file.getId(), 60*60*24);
  return b64;
}

/** =====================================================================
 * Sheet-backed event source
 * ===================================================================== */
function setEventsSheetConfig(sheetId, rangeA1){
  if(!sheetId) throw new Error('sheetId required');
  PropertiesService.getScriptProperties().setProperty(_K.SHEET_ID, sheetId);
  PropertiesService.getScriptProperties().setProperty(_K.SHEET_RANGE, rangeA1 || 'Events!A1:Z');
  bustEventsCache();
  return { ok:true, sheetId: sheetId, range: rangeA1 || 'Events!A1:Z' };
}
function _parseEventsSheet_(values){
  if(!values || values.length<2) return [];
  var header = values[0].map(function(h){ return String(h||'').trim().toLowerCase(); });
  function idx(col){ var i=header.indexOf(col); return i>=0?i:-1; }
  var iId=idx('id'), iSlug=idx('slug'), iName=idx('name'), iDate=idx('startdateiso');
  var out=[];
  for(var r=1;r<values.length;r++){
    var row=values[r]; if(!row) continue;
    var id = iId>=0? String(row[iId]||'').trim() : '';
    var name = iName>=0? String(row[iName]||'').trim() : '';
    if(!id && !name) continue;
    var slug = iSlug>=0? String(row[iSlug]||'').trim() : '';
    var dateCell = iDate>=0? row[iDate] : '';
    var dateISO='';
    if (dateCell instanceof Date){
      dateISO = Utilities.formatDate(dateCell, Session.getScriptTimeZone()||'Etc/UTC','yyyy-MM-dd');
    } else {
      var s=String(dateCell||'').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) dateISO=s;
      else if (!s) dateISO=_todayISO_();
      else { var d=new Date(s); dateISO=isNaN(d.getTime())? _todayISO_() :
        Utilities.formatDate(d, Session.getScriptTimeZone()||'Etc/UTC','yyyy-MM-dd'); }
    }
    out.push({ id: id || ('ev_' + _sha1hex_(name).slice(0,8)),
               slug: slug || id || '',
               name: name || slug || id,
               startDateISO: dateISO });
  }
  return out;
}
function _loadEventsFromSource_(){
  var p = PropertiesService.getScriptProperties();
  var sheetId = p.getProperty(_K.SHEET_ID);
  var rangeA1 = p.getProperty(_K.SHEET_RANGE) || 'Events!A1:Z';
  if (sheetId){
    try {
      var rng = SpreadsheetApp.openById(sheetId).getRange(rangeA1);
      var values = rng.getValues();
      var evs = _parseEventsSheet_(values);
      if (evs && evs.length) return evs;
    } catch(e){ console.warn('Events sheet load error: '+(e && e.message || e)); }
  }
  return [
    { id:'ev_demo_1', slug:'fall-league-1',  name:'Fall League — Court 1',  startDateISO:'2025-10-01' },
    { id:'ev_demo_2', slug:'fall-league-2',  name:'Fall League — Court 2',  startDateISO:'2025-10-01' },
    { id:'ev_demo_3', slug:'open-qualifier', name:'Open Qualifier',        startDateISO:'2025-11-12' }
  ];
}
function bustEventsCache_(){ PropertiesService.getScriptProperties().setProperty(_K.EVENTS_ETAG, String(Math.random())+':'+Date.now()); }
function bustEventsCache(){ CacheService.getScriptCache().remove(_K.EVENTS_CACHE); }
function listEvents(){
  var cache=CacheService.getScriptCache();
  var cached = cache.get(_K.EVENTS_CACHE);
  if (cached){ try{ return { ok:true, events: JSON.parse(cached) }; }catch(_e){} }
  var evs = _loadEventsFromSource_();
  cache.put(_K.EVENTS_CACHE, _json_(evs), 60);
  return { ok:true, events: evs };
}
function _findEvent_(key){
  var list=_loadEventsFromSource_();
  for (var i=0;i<list.length;i++){ var e=list[i]; if (e.id===key || e.slug===key) return e; }
  return null;
}

/** =====================================================================
 * Admin settings
 * ===================================================================== */
function saveAdminSettings(payload){
  try{
    if(!payload || !payload.eventId) return { ok:false, error:'missing_eventId' };
    var p = PropertiesService.getScriptProperties();
    p.setProperty(_K.ADM_SIGNUP + payload.eventId, payload.includeSignup ? '1':'0');
    p.setProperty(_K.ADM_MODE   + payload.eventId, payload.posterMode || 'image');
    p.setProperty(_K.ADM_COACH  + payload.eventId, payload.showCoach ? '1':'0');
    return { ok:true };
  } catch(e){ return { ok:false, error:String(e && e.message || e) }; }
}
function _readAdminSettings_(eventId){
  var p = PropertiesService.getScriptProperties();
  return {
    includeSignup: p.getProperty(_K.ADM_SIGNUP + eventId) === '1',
    posterMode:    p.getProperty(_K.ADM_MODE   + eventId) || 'image',
    showCoach:     p.getProperty(_K.ADM_COACH  + eventId) === '1'
  };
}

/** =====================================================================
 * Public bundle + Link endpoints (STRICT QR invariant)
 * ===================================================================== */
function getPublicBundle(eventKey){
  try{
    var meta = _resolveEventMeta_(eventKey);
    if (!meta) return { ok:false, error:'event_not_found' };
    return {
      ok:true, bundleVersion:1,
      eventMeta:{
        id:meta.id, name:meta.name, slug:meta.slug||meta.id, dateISO:meta.startDateISO,
        status: meta.status || 'LINKS_READY',
        formUrl: meta.formUrl || ''
      }
    };
  } catch(e){ return { ok:false, error:String(e && e.message || e) }; }
}
function getShareQr(eventKey){
  try{
    var st=_resolvePublicLinkState_(eventKey);
    if (!st.url) return { ok:false, error:'public_link_not_ready' };
    if (st.verified) return { ok:true, url: st.url, qrB64: qrCacheGetOrMake_(st.url) };
    return { ok:true, url: st.url };
  } catch(e){ return { ok:false, error:String(e && e.message || e) }; }
}
function getSignupQr(eventKey){
  try{
    var st=_resolveSignupLinkState_(eventKey);
    if (!st.url) return { ok:false, error:'signup_link_not_ready' };
    if (st.verified) return { ok:true, url: st.url, qrB64: qrCacheGetOrMake_(st.url) };
    return { ok:true, url: st.url };
  } catch(e){ return { ok:false, error:String(e && e.message || e) }; }
}

/** ---------- Link state resolution (incl. mocks) ---------- */
function _resolveEventMeta_(eventKey){
  if (!eventKey) return null;
  if (String(eventKey).indexOf('mock:')===0){
    var scn=String(eventKey).slice(5);
    var base={ id:'mock_'+scn, slug:'mock-'+scn, name:'Mock · '+scn.replace(/_/g,' ').toUpperCase(),
               startDateISO:'2025-10-01', status:'LINKS_READY' };
    if (scn==='signup_url_only' || scn==='signup_qr_ready') base.formUrl='https://example.com/mock-signup-'+scn;
    return base;
  }
  var ev=_findEvent_(eventKey); if(!ev) return null;
  var meta={ id:ev.id, slug:ev.slug||ev.id, name:ev.name||ev.slug||ev.id, startDateISO:ev.startDateISO||_todayISO_(), status:'LINKS_READY' };
  var p=PropertiesService.getScriptProperties();
  var includeSignup = p.getProperty(_K.ADM_SIGNUP + ev.id) === '1';
  if (includeSignup){
    var manual = p.getProperty(_K.SU_PREFIX + ev.id);
    if (manual && _isUri_(manual)) meta.formUrl = manual;
  }
  return meta;
}
function _resolvePublicLinkState_(eventKey){
  var p=PropertiesService.getScriptProperties();
  var su=p.getProperty(_K.PU_PREFIX + eventKey);
  var sq=p.getProperty(_K.PUQ_PREFIX + eventKey)==='1';
  if (String(eventKey).indexOf('mock:')===0){
    var scn=String(eventKey).slice(5);
    if (scn==='public_qr_ready') return { url:'https://example.com/mock-public', verified:true };
    return { url:'', verified:false };
  }
  if (su && _isUri_(su)) return { url:su, verified:!!sq };
  return { url:'', verified:false };
}
function _resolveSignupLinkState_(eventKey){
  var p=PropertiesService.getScriptProperties();
  var su=p.getProperty(_K.SU_PREFIX + eventKey);
  var sq=p.getProperty(_K.SUQ_PREFIX + eventKey)==='1';
  if (String(eventKey).indexOf('mock:')===0){
    var scn=String(eventKey).slice(5);
    if (scn==='signup_qr_ready') return { url:'https://example.com/mock-signup', verified:true };
    if (scn==='signup_url_only') return { url:'https://example.com/mock-signup', verified:false };
    return { url:'', verified:false };
  }
  var ev=_findEvent_(eventKey);
  if (ev){
    var includeSignup = p.getProperty(_K.ADM_SIGNUP + ev.id) === '1';
    if (includeSignup && su && _isUri_(su)) return { url:su, verified:!!sq };
  }
  return { url:'', verified:false };
}

/** =====================================================================
 * Template schema + Control/Event flow (self-healing)
 * ===================================================================== */
function _getTemplateSchema_(){
  return {
    name: 'NextUp – control (template)',
    tabs: [
      { name:'Config', rows:[
        ['Field','Value'],
        ['Event Name',''],
        ['Slug',''],
        ['Date (ISO)',''],
        ['Event ID','']
      ], widths:[140,420] },
      { name:'Roster',   rows:[['Name','Role','Notes']],            widths:[200,140,320] },
      { name:'Schedule', rows:[['When','Item','Location','Notes']], widths:[120,220,180,260] }
    ]
  };
}
function _createWorkbookFromSchema_(schema, kind){
  var ss=SpreadsheetApp.create(schema.name);
  var sh0=ss.getSheets()[0]; if (sh0) ss.deleteSheet(sh0);
  schema.tabs.forEach(function(t){
    var sh=ss.insertSheet(t.name);
    if (t.rows && t.rows.length){
      var r=sh.getRange(1,1,t.rows.length,t.rows[0].length);
      r.setValues(t.rows); r.setFontWeight('bold');
      if (t.rows.length>1) sh.getRange(2,1,t.rows.length-1,t.rows[0].length).setFontWeight('normal');
    }
    if (t.widths) t.widths.forEach(function(w,i){ try{ sh.setColumnWidth(i+1,w); }catch(_e){} });
  });
  _markWorkbookProvenance_(ss, kind || 'template');
  return ss;
}
function _validateWorkbookTabs_(ss, requiredTabs){
  if (!requiredTabs || !requiredTabs.length) return { ok:true, missing:[] };
  var have=ss.getSheets().map(function(s){return s.getName();});
  var missing=requiredTabs.filter(function(t){ return have.indexOf(t)<0; });
  return { ok:missing.length===0, missing:missing };
}
function _validateWorkbookTabsStrict_(ss, requiredTabs){
  var v=_validateWorkbookTabs_(ss, requiredTabs);
  if (v.ok) return v;
  if (!requiredTabs || !requiredTabs.length){
    var have=ss.getSheets().map(function(s){return s.getName();});
    var defaults=_getTemplateSchema_().tabs.map(function(t){return t.name;});
    var missing=defaults.filter(function(t){ return have.indexOf(t)<0; });
    return { ok: missing.length===0, missing: missing };
  }
  return v;
}
function _markWorkbookProvenance_(ss, kind){
  var sh=ss.getSheetByName('__nextup_meta');
  if (!sh){ sh=ss.insertSheet('__nextup_meta'); sh.hideSheet(); }
  var uuid=Utilities.getUuid();
  sh.getRange(1,1,1,3).setValues([[String(kind||'control'), uuid, new Date()]]);
  return { kind:kind||'control', uuid:uuid };
}
function _readProvenance_(ss){
  var sh=ss.getSheetByName('__nextup_meta'); if(!sh) return { ok:false };
  var v=sh.getRange(1,1,1,3).getValues()[0] || [];
  return { ok:true, kind:String(v[0]||''), uuid:String(v[1]||'') };
}
function _maybeTrashIfOurs_(spreadsheetId){
  try{
    var ss=SpreadsheetApp.openById(spreadsheetId);
    var prov=_readProvenance_(ss);
    if (prov.ok && prov.kind==='control') DriveApp.getFileById(spreadsheetId).setTrashed(true);
  } catch(_e){}
}

/** Ensure TEMPLATE exists (auto-create) */
function ensureTemplateWorkbook(){
  var p=PropertiesService.getScriptProperties();
  var tplId=p.getProperty(_K.CTRL_TEMPLATE_ID);
  var required=_getRequiredTabs_();
  var lock=LockService.getScriptLock(); lock.tryLock(5000);
  try{
    if (tplId){
      try{
        var tpl=SpreadsheetApp.openById(tplId);
        var v=_validateWorkbookTabsStrict_(tpl, required);
        if (v.ok) return { ok:true, created:false, templateId:tplId };
        var prov=_readProvenance_(tpl);
        if (prov.ok && prov.kind==='template'){
          DriveApp.getFileById(tplId).setTrashed(true);
          p.deleteProperty(_K.CTRL_TEMPLATE_ID); tplId=null;
        }
      }catch(_e){ p.deleteProperty(_K.CTRL_TEMPLATE_ID); tplId=null; }
    }
    if (!tplId){
      var ss=_createWorkbookFromSchema_(_getTemplateSchema_(), 'template');
      tplId=ss.getId(); p.setProperty(_K.CTRL_TEMPLATE_ID, tplId);
      return { ok:true, created:true, templateId:tplId };
    }
    return { ok:true, created:false, templateId:tplId };
  } finally { try{ lock.releaseLock(); }catch(_e){} }
}

/** Ensure CONTROL exists/healthy by copying TEMPLATE (self-healing) */
function ensureControlWorkbook(){
  var p=PropertiesService.getScriptProperties();
  var et=ensureTemplateWorkbook(); if (!et.ok) return { ok:false, error:'template_bootstrap_failed' };
  var tplId=et.templateId;

  var required=_getRequiredTabs_();
  var lock=LockService.getScriptLock(); lock.tryLock(5000);
  try{
    var cid=p.getProperty(_K.CTRL_BOOK_ID);
    if (cid){
      try{
        var existing=SpreadsheetApp.openById(cid);
        var v=_validateWorkbookTabsStrict_(existing, required);
        if (v.ok) { cfgSet_(CFG_KEYS.CONTROL_ID, cid); return { ok:true, created:false, controlId:cid, templateId:tplId }; }
        _maybeTrashIfOurs_(cid);
      }catch(_e){ /* stale */ }
    }
    for (var i=0;i<3;i++){
      var ctrl=SpreadsheetApp.openById(tplId).copy('NextUp – control ('+_todayISO_()+')');
      var ctrlId=ctrl.getId();
      p.setProperty(_K.CTRL_BOOK_ID, ctrlId);
      cfgSet_(CFG_KEYS.CONTROL_ID, ctrlId);
      _markWorkbookProvenance_(ctrl, 'control');
      var v2=_validateWorkbookTabsStrict_(ctrl, required);
      if (v2.ok) return { ok:true, created:true, controlId:ctrlId, templateId:tplId };
      _maybeTrashIfOurs_(ctrlId);
      Utilities.sleep(200 + Math.floor(Math.random()*200));
    }
    return { ok:false, error:'control_setup_failed_after_retries' };
  } finally { try{ lock.releaseLock(); }catch(_e){} }
}

/** v4.0-style "cold-open" ensure (wrapper) */
function ensureAll_() {
  var c = ensureControlWorkbook();
  var t = ensureTemplateWorkbook();
  ensureBaseUrls_();
  return { ok:c && c.ok && t && t.ok, controlId: (c && c.controlId)||'', templateId: (t && t.templateId)||'' };
}
function ensureControlStrictOnBoot() {
  var r = ensureAll_();
  return r.ok ? { ok:true, created:false, validated:true, id:r.controlId } : { ok:false, error:'bootstrap_failed' };
}

/** Control status */
function getControlStatus(){
  var out={ ok:true, templateId:'', controlId:'', present:false, missingTabs:[], err:'' };
  try{
    var et=ensureTemplateWorkbook();
    if (!et.ok){ out.err='template_bootstrap_failed'; return out; }
    out.templateId=et.templateId||'';

    var p=PropertiesService.getScriptProperties();
    var cid=p.getProperty(_K.CTRL_BOOK_ID)||'';
    if (cid){
      try{
        var ss=SpreadsheetApp.openById(cid);
        var v=_validateWorkbookTabsStrict_(ss, _getRequiredTabs_());
        out.controlId=cid; out.present=!!v.ok; out.missingTabs=v.ok?[]:v.missing;
        if (!v.ok) out.err='control_incomplete';
        if (out.present) return out;
      }catch(e){ /* repair next */ }
    }
    var ec=ensureControlWorkbook();
    if (ec && ec.ok){ out.controlId=ec.controlId||''; out.present=true; out.missingTabs=[]; return out; }
    out.err=(ec && ec.error) || 'control_setup_failed';
    return out;
  } catch(e){ out.err=String(e && e.message || e); return out; }
}

/** Required tabs config */
function setControlTemplateId(templateSpreadsheetId){
  if(!templateSpreadsheetId) throw new Error('templateSpreadsheetId required');
  SpreadsheetApp.openById(templateSpreadsheetId);
  PropertiesService.getScriptProperties().setProperty(_K.CTRL_TEMPLATE_ID, templateSpreadsheetId);
  cfgSet_(CFG_KEYS.TEMPLATE_ID, templateSpreadsheetId);
  return { ok:true, templateId: templateSpreadsheetId };
}
function setControlRequiredTabs(csv){
  PropertiesService.getScriptProperties().setProperty(_K.CTRL_REQ_TABS, String(csv||'').trim());
  return { ok:true };
}
function _getRequiredTabs_(){
  var csv=PropertiesService.getScriptProperties().getProperty(_K.CTRL_REQ_TABS) || '';
  return csv.split(',').map(function(s){return s.trim();}).filter(Boolean);
}

/** Base URLs (v4.0 compat) */
function ensureBaseUrls_() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty(CFG_KEYS.ORG_URL)) props.setProperty(CFG_KEYS.ORG_URL, ScriptApp.getService().getUrl());
  if (!props.getProperty(CFG_KEYS.PUB_URL)) props.setProperty(CFG_KEYS.PUB_URL, ScriptApp.getService().getUrl());
}
function cfgOrgUrl_(){ return PropertiesService.getScriptProperties().getProperty(CFG_KEYS.ORG_URL) || ScriptApp.getService().getUrl(); }
function cfgPubUrl_(){ return PropertiesService.getScriptProperties().getProperty(CFG_KEYS.PUB_URL) || ScriptApp.getService().getUrl(); }
function cfgControlId_(){
  var p = PropertiesService.getScriptProperties().getProperty(_K.CTRL_BOOK_ID);
  if (p) return p;
  var q = PropertiesService.getScriptProperties().getProperty(CFG_KEYS.CONTROL_ID);
  return q || '';
}

/** =====================================================================
 * Minimal event creation (kept from 4.1.1)
 * ===================================================================== */
function createEventFromControl(payload){
  if(!payload || !payload.id) return { ok:false, error:'missing_event_id' };
  var eventId=String(payload.id);
  var slug   =String(payload.slug || payload.id);
  var name   =String(payload.name || slug);
  var dateISO=String(payload.dateISO || _todayISO_());
  var includeSignup=!!payload.includeSignup;

  var lock=LockService.getScriptLock(); lock.tryLock(5000);
  try{
    var p=PropertiesService.getScriptProperties();
    var boot=ensureControlWorkbook();
    if (!boot.ok) return { ok:false, error: boot.error || 'control_bootstrap_failed', detail: boot };

    var existingId=p.getProperty(_K.EVENT_BOOK_PREFIX + eventId);
    if (existingId){
      try{
        SpreadsheetApp.openById(existingId);
        var links0=_provisionEventLinks_(slug, includeSignup);
        _persistEventLinks_(eventId, links0, { forceIfUnset:true });
        return { ok:true, created:false, eventId:eventId, eventBookId:existingId, controlId:boot.controlId,
                 links:links0, verified:{ public:_isVerified(_K.PUQ_PREFIX+eventId), signup:_isVerified(_K.SUQ_PREFIX+eventId) } };
      }catch(_e){ /* recreate */ }
    }

    var ctrl=SpreadsheetApp.openById(boot.controlId);
    var ev=ctrl.copy('NextUp – ' + slug);
    var evId=ev.getId();
    p.setProperty(_K.EVENT_BOOK_PREFIX + eventId, evId);
    _markWorkbookProvenance_(ev, 'event');
    _initializeEventWorkbook_(ev, { id:eventId, slug:slug, name:name, dateISO:dateISO });

    var links=_provisionEventLinks_(slug, includeSignup);
    _persistEventLinks_(eventId, links, { forceIfUnset:true });
    return { ok:true, created:true, eventId:eventId, eventBookId:evId, controlId:boot.controlId,
             links:links, verified:{ public:false, signup:false } };
  } finally { try{ lock.releaseLock(); }catch(_e){} }
}
function verifyEventLinks(eventId, opts){
  if(!eventId) return { ok:false, error:'missing_event_id' };
  var p=PropertiesService.getScriptProperties();
  if (opts && opts.public===true) p.setProperty(_K.PUQ_PREFIX + eventId, '1');
  if (opts && opts.signup===true) p.setProperty(_K.SUQ_PREFIX + eventId, '1');
  return { ok:true };
}
function _initializeEventWorkbook_(ss, info){
  var sh=ss.getSheetByName('Config'); if(!sh) return;
  var map={ 'B2':info.name, 'B3':info.slug, 'B4':info.dateISO, 'B5':info.id };
  Object.keys(map).forEach(function(a1){ try{ sh.getRange(a1).setValue(map[a1]); }catch(_e){} });
}
function _provisionEventLinks_(slug, includeSignup){
  var base='https://example.com';
  return { publicUrl: base + '/e/' + encodeURIComponent(slug),
           signupUrl: includeSignup ? (base + '/f/' + encodeURIComponent(slug)) : '' };
}
function _persistEventLinks_(eventId, links, opts){
  var p=PropertiesService.getScriptProperties();
  var force=!!(opts && opts.forceIfUnset);
  function setIfUnset(k,v){ var cur=p.getProperty(k); if(cur==null || force) p.setProperty(k,v); }
  if (links.publicUrl){ p.setProperty(_K.PU_PREFIX + eventId, String(links.publicUrl)); setIfUnset(_K.PUQ_PREFIX + eventId, '0'); }
  if (links.signupUrl){ p.setProperty(_K.SU_PREFIX + eventId, String(links.signupUrl)); setIfUnset(_K.SUQ_PREFIX + eventId, '0'); }
}
function _isVerified(propKey){ return PropertiesService.getScriptProperties().getProperty(propKey)==='1'; }

/** =====================================================================
 * Test harness utilities + self-tests
 * ===================================================================== */
function setTestMode(on){
  PropertiesService.getScriptProperties().setProperty(_K.TEST_MODE, on ? '1':'0');
  return { ok:true, on: !!on };
}
function testScenario(payload){
  var k=payload && payload.eventKey, s=payload && payload.scenario;
  if(!k || !s) return { ok:false, error:'missing_eventKey_or_scenario' };
  PropertiesService.getScriptProperties().setProperty(_K.SCN_PREFIX + k, String(s));
  return { ok:true };
}
function testSet(payload){
  var k=payload && payload.eventKey; if(!k) return { ok:false, error:'missing_eventKey' };
  var p=PropertiesService.getScriptProperties();
  if ('signupUrl' in payload) p.setProperty(_K.SU_PREFIX + k, String(payload.signupUrl || ''));
  if ('signupQr'  in payload) p.setProperty(_K.SUQ_PREFIX + k, payload.signupQr ? '1':'0');
  if ('publicUrl' in payload) p.setProperty(_K.PU_PREFIX + k, String(payload.publicUrl || ''));
  if ('publicQr'  in payload) p.setProperty(_K.PUQ_PREFIX + k, payload.publicQr ? '1':'0');
  return { ok:true };
}
function testReset(eventKey){
  var k=eventKey || ''; if(!k) return { ok:false, error:'missing_eventKey' };
  var p=PropertiesService.getScriptProperties();
  [_K.SCN_PREFIX,_K.SU_PREFIX,_K.SUQ_PREFIX,_K.PU_PREFIX,_K.PUQ_PREFIX].forEach(function(pref){ p.deleteProperty(pref + k); });
  return { ok:true };
}
function runSelfTests(){
  try{
    function isUri(s){ try{ new URL(s); return true; }catch(_e){ return false; } }
    function valBundleV1(b){
      var errs=[]; if(!(b&&typeof b==='object')) return ['bundle: not an object'];
      if (b.ok!==true) errs.push('bundle.ok must be true');
      if (b.bundleVersion!==1) errs.push('bundle.bundleVersion must be 1');
      var m=b.eventMeta;
      if(!m||typeof m!=='object') errs.push('bundle.eventMeta missing'); else{
        if(!m.id) errs.push('bundle.eventMeta.id missing');
        if(!m.name) errs.push('bundle.eventMeta.name missing');
        if(!m.dateISO||!/^\d{4}-\d{2}-\d{2}/.test(String(m.dateISO))) errs.push('bundle.eventMeta.dateISO invalid');
        if(m.formUrl && !isUri(m.formUrl)) errs.push('bundle.eventMeta.formUrl invalid');
        if(m.status && ['CREATED','LINKS_READY','LINKS_VERIFYING'].indexOf(String(m.status))<0) errs.push('bundle.eventMeta.status invalid');
      }
      return errs;
    }
    function valLinkQrV1(o,label){
      var errs=[]; if(!(o&&typeof o==='object')) return [label+': not an object'];
      if (o.ok===true){
        if(!o.url||!isUri(o.url)) errs.push(label+': url must be a valid URI when ok=true');
        if('qrB64' in o && typeof o.qrB64!=='string') errs.push(label+': qrB64 must be base64 string when present');
      } else if (o.ok===false){
        var ALLOWED=['public_link_not_ready','signup_link_not_ready','event_not_found','error_internal'];
        if (ALLOWED.indexOf(String(o.error))<0) errs.push(label+': error not in allowed set');
      } else {
        errs.push(label+': ok must be boolean');
      }
      return errs;
    }
    var scenarios=['mock:empty','mock:signup_url_only','mock:signup_qr_ready','mock:public_qr_ready'];
    var results=[];
    for (var i=0;i<scenarios.length;i++){
      var key=scenarios[i], item={ key:key, pass:true, errors:[] };
      try{ var b=getPublicBundle(key); if(b&&b.ok===true) item.errors=item.errors.concat(valBundleV1(b)); else item.errors.push('bundle: not ok'); }
      catch(e1){ item.errors.push('bundle: exception '+String(e1&&e1.message||e1)); }
      try{ var s=getSignupQr(key); if('ok' in (s||{})) item.errors=item.errors.concat(valLinkQrV1(s,'signup')); else item.errors.push('signup: missing ok'); }
      catch(e2){ item.errors.push('signup: exception '+String(e2&&e2.message||e2)); }
      try{ var p=getShareQr(key); if('ok' in (p||{})) item.errors=item.errors.concat(valLinkQrV1(p,'public')); else item.errors.push('public: missing ok'); }
      catch(e3){ item.errors.push('public: exception '+String(e3&&e3.message||e3)); }
      item.pass = item.errors.length===0; results.push(item);
    }
    return { ok:true, results: results };
  } catch(e){
    return { ok:false, error:String(e && e.message || e) };
  }
}