/************************************************************
* NextUp v3.5 — Code.gs (patched, unified router + shortlinks)
* - FIX: single ScriptProperty key for Control SSID (no dup creates)
* - FIX: no “remove all sheets” error when creating Control
* - FIX: unified router: reads page OR p; adds R shortlink redirect
* - Guard Session.getActiveUser() (no extra scope required)
* - [PATCH] setEventFormId row-lookup uses slug vs. id correctly
* - [PATCH] createEvent honors seed/elim payload; propagate to Meta
* - [PATCH] strong ETag hashes actual Events data
* - [PATCH] sanitize shortlink tokens
* - [PATCH] X-Frame: only ALLOWALL for public/display/poster; Admin=DEFAULT
* - [PATCH] test logger/spec aligned: DiagResults ts,suite,test,ok,ms
* - [PATCH] Drive search works with title|name
************************************************************/

const CONTROL_TITLE = 'NextUp - Control';

/** ---------- 1) OPTIONAL CONFIG (used if provided; otherwise self-healing fills in) ---------- */
const ORG_BASE_URL = 'https://script.google.com/macros/s/ORG_DEPLOYMENT_ID/exec';
const PUBLIC_BASE_URL = 'https://script.google.com/macros/s/PUBLIC_DEPLOYMENT_ID/exec';

const EVENTS_SPREADSHEET_ID = 'PUT_MAIN_SPREADSHEET_ID_HERE';
const EVENTS_ROOT_FOLDER_ID = 'PUT_EVENTS_FOLDER_ID_HERE';
const EVENT_TEMPLATE_ID = 'PUT_TEMPLATE_SPREADSHEET_ID_HERE';

/** ---------- 2) SELF-HEALING BOOTSTRAP ---------- */
const CFG_KEYS = {
  CONTROL_ID: 'NU_CONTROL_SSID',
  TEMPLATE_ID: 'NU_TEMPLATE_SSID',
  EVENTS_DIR: 'NU_EVENTS_FOLDERID',
  ORG_URL: 'NU_ORG_BASE_URL',
  PUB_URL: 'NU_PUBLIC_BASE_URL'
};

function cfgGet_(k, fallbackConst) {
  const props = PropertiesService.getScriptProperties();
  const v = props.getProperty(k);
  if (v) return v;
  if (fallbackConst && !String(fallbackConst).includes('PUT_') && !String(fallbackConst).includes('_DEPLOYMENT_ID')) {
    props.setProperty(k, fallbackConst);
    return fallbackConst;
  }
  return '';
}
function cfgSet_(k, val) { if (val) PropertiesService.getScriptProperties().setProperty(k, val); }

function ensureAll_() {
  const controlId = ensureControlWorkbook_();
  ensureEventsHeaders_(controlId);
  const tmplId = ensureEventTemplate_();
  ensurePosterDefaults_(tmplId);
  ensureEventsFolder_();
  ensureBaseUrls_();
  return { ok: true, controlId, tmplId };
}

function ensureControlStrictOnBoot() {
  const props = PropertiesService.getScriptProperties();
  const spec = getControlTemplateSpec_();

  let ss = null;
  let id = props.getProperty(CFG_KEYS.CONTROL_ID);
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }

  if (!ss) {
    const found = findControlByName_();
    if (found.primary) {
      ss = SpreadsheetApp.open(found.primary);
      props.setProperty(CFG_KEYS.CONTROL_ID, ss.getId());
      found.duplicates.forEach(f => { try { f.setName(f.getName() + ' (DUPLICATE)'); } catch (_) {} });
    }
  }

  if (!ss) {
    ss = createFreshControl_(spec);
    props.setProperty(CFG_KEYS.CONTROL_ID, ss.getId());
    return { ok: true, created: true, rebuilt: false, validated: true, id: ss.getId(), url: ss.getUrl(), note: 'Control created fresh' };
  }

  const v = validateControl_(ss, spec);
  if (!v.ok) {
    const oldId = ss.getId();
    const rebuilt = createFreshControl_(spec);
    props.setProperty(CFG_KEYS.CONTROL_ID, rebuilt.getId());
    try { DriveApp.getFileById(oldId).setTrashed(true); } catch (_) {}
    return { ok: true, created: false, rebuilt: true, validated: true, id: rebuilt.getId(), url: rebuilt.getUrl(), validation: v, note: 'Control was invalid; rebuilt from spec' };
  }
  return { ok: true, created: false, rebuilt: false, validated: true, id: ss.getId(), url: ss.getUrl(), note: 'Control present and valid' };
}

function getControlTemplateSpec_() {
  let owner = '';
  try { owner = Session.getActiveUser().getEmail() || ''; } catch (e) { owner = ''; }

  return [
    { name: 'Events', headers: ['id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag','isDefault','seedMode','elimType','reserved1','reserved2','reserved3'] },
    { name: 'Diagnostics', headers: ['ts','level','where','msg','data'] },
    { name: 'DiagSuites', headers: ['suiteId','name','enabled','notes'] },
    // [PATCH] align with logger below
    { name: 'DiagResults', headers: ['ts','suite','test','ok','ms'] },

    { name: 'PosterConfig', headers: ['key','value'], rows: [
      ['title','Your Event Title'],['subtitle',''],['date','YYYY-MM-DD'],['time','7:00 PM'],['place','Venue name'],['imageId',''],['public_page','on']
    ]},

    { name: 'SignupsTemplate', headers: ['name','email','team'] },
    { name: 'ScheduleTemplate', headers: ['round','match','teamA','teamB','time'] },
    { name: 'StandingsTemplate', headers: ['team','wins','losses','points'] },

    { name: 'Meta', headers: ['key','value'], rows: [['version','3.5'],['owner',owner]] }
  ];
}

function createFreshControl_(spec) {
  const ss = SpreadsheetApp.create(CONTROL_TITLE);
  const s1 = ss.getSheets()[0];
  const first = spec[0];
  s1.setName(first.name);
  s1.getRange(1,1,1,first.headers.length).setValues([first.headers]).setFontWeight('bold');
  s1.setFrozenRows(1);
  if (first.rows?.length) s1.getRange(2,1,first.rows.length,first.rows[0].length).setValues(first.rows);

  for (let i=1;i<spec.length;i++){
    const t=spec[i]; const sh=ss.insertSheet(t.name);
    sh.getRange(1,1,1,t.headers.length).setValues([t.headers]).setFontWeight('bold'); sh.setFrozenRows(1);
    if (t.rows?.length) sh.getRange(2,1,t.rows.length,t.rows[0].length).setValues(t.rows);
  }
  ss.getSheets().forEach(sh=>{ try{
    if (sh.getMaxColumns()<10) sh.insertColumnsAfter(sh.getMaxColumns(),10-sh.getMaxColumns());
    if (sh.getMaxRows()<50) sh.insertRowsAfter(sh.getMaxRows(),50-sh.getMaxRows());
  }catch(_){}});

  try { if (ss.getName() !== CONTROL_TITLE) ss.rename(CONTROL_TITLE); } catch (_){}
  return ss;
}

function validateControl_(ss, spec) {
  const map={}; ss.getSheets().forEach(sh=>map[sh.getName()]=sh);
  const missingSheets=[]; const headerMismatches=[]; const missingDefaults=[];
  for (const t of spec){
    const sh=map[t.name]; if(!sh){ missingSheets.push(t.name); continue; }
    const have=sh.getRange(1,1,1,t.headers.length).getValues()[0];
    if (!arraysEqual_(have,t.headers)) headerMismatches.push({sheet:t.name,expected:t.headers,found:have});
    if (t.rows?.length){
      const r=sh.getRange(2,1,t.rows.length,t.rows[0].length).getValues();
      if(!twoDArrayEqual_(r,t.rows)) missingDefaults.push({sheet:t.name,expectedRows:t.rows.length});
    }
  }
  const ok=!missingSheets.length && !headerMismatches.length && !missingDefaults.length;
  return { ok, missingSheets, headerMismatches, missingDefaults };
}

function ctlTemplateHeaders_(sheetName, fallback) {
  const ctlId = cfgControlId_();
  const ss = SpreadsheetApp.openById(ctlId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return fallback.slice();
  const lr = sh.getLastRow(); if (lr<1) return fallback.slice();
  const header = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0];
  const cols = header.map(v=>String(v||'').trim()); while(cols.length && !cols[cols.length-1]) cols.pop();
  return cols.length ? cols : fallback.slice();
}
function ctlPosterDefaults_(){
  const ctlId=cfgControlId_(); const ss=SpreadsheetApp.openById(ctlId); const sh=ss.getSheetByName('PosterConfig');
  const out={}; if(!sh) return out; const lr=sh.getLastRow(); if (lr<2) return out;
  const rows=sh.getRange(2,1,lr-1,2).getValues();
  rows.forEach(r=>{ const k=String(r[0]||'').trim(); if(k) out[k]=r[1]; });
  return out;
}

// [PATCH] title (legacy) or name (current)
function findControlByName_() {
  const q = CONTROL_TITLE.replace(/"/g,'\\"');
  const all=[];
  let it=DriveApp.searchFiles('title = "'+q+'" and mimeType = "application/vnd.google-apps.spreadsheet"');
  while(it.hasNext()) all.push(it.next());
  if (!all.length){
    it=DriveApp.searchFiles('name = "'+q+'" and mimeType = "application/vnd.google-apps.spreadsheet"');
    while(it.hasNext()) all.push(it.next());
  }
  if (!all.length) return { primary:null, duplicates:[] };
  all.sort((a,b)=>b.getLastUpdated()-a.getLastUpdated());
  return { primary:all[0], duplicates:all.slice(1) };
}

function arraysEqual_(a,b){ if(!a||!b||a.length!==b.length) return false; for(let i=0;i<a.length;i++){ if(String(a[i])!==String(b[i])) return false; } return true; }
function twoDArrayEqual_(a,b){ if(!a||!b||a.length!==b.length) return false; for(let i=0;i<a.length;i++){ if(!arraysEqual_(a[i],b[i])) return false; } return true; }

function ensureControlWorkbook_(){
  let id = cfgGet_(CFG_KEYS.CONTROL_ID, (typeof EVENTS_SPREADSHEET_ID!=='undefined'?EVENTS_SPREADSHEET_ID:''));
  if (id){ try { SpreadsheetApp.openById(id); return id; } catch(e){} }
  const ss=SpreadsheetApp.create(CONTROL_TITLE);
  ss.getSheets()[0].setName('Events');
  cfgSet_(CFG_KEYS.CONTROL_ID, ss.getId());
  return ss.getId();
}
function ensureEventsHeaders_(controlId){
  const ss=SpreadsheetApp.openById(controlId);
  const sh=ss.getSheetByName('Events')||ss.insertSheet('Events');
  const headers=['id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag','isDefault','seedMode','elimType','reserved1','reserved2','reserved3'];
  sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#f3f6fb'); sh.autoResizeColumns(1,headers.length);
}
function ensureEventTemplate_(){
  let id = cfgGet_(CFG_KEYS.TEMPLATE_ID, (typeof EVENT_TEMPLATE_ID!=='undefined'?EVENT_TEMPLATE_ID:''));
  if (id){ try{ SpreadsheetApp.openById(id); return id; }catch(e){} }
  const ss=SpreadsheetApp.create('NextUp · Event Template');
  const s1=ss.getSheets()[0]; s1.setName('Home'); s1.getRange(1,1,1,2).setValues([['welcome','notes']]);
  tplEnsureMetaKv_(ss);
  tplEnsureSheetWithHeader_(ss,'SignupsView',['timestamp','name','email','phone','team','notes']);
  tplEnsureSheetWithHeader_(ss,'Schedule',['round','time','activity','notes','table']);
  tplEnsureSheetWithHeader_(ss,'Standings',['team','points','tiebreak','notes']);
  tplEnsurePosterConfigKv_(ss);
  cfgSet_(CFG_KEYS.TEMPLATE_ID, ss.getId()); return ss.getId();
}
function ensurePosterDefaults_(tmplId){ const ss=SpreadsheetApp.openById(tmplId); tplEnsurePosterConfigKv_(ss); }
function ensureEventsFolder_(){
  let id=cfgGet_(CFG_KEYS.EVENTS_DIR, (typeof EVENTS_ROOT_FOLDER_ID!=='undefined'?EVENTS_ROOT_FOLDER_ID:''));
  if (id){ try{ DriveApp.getFolderById(id); return id; }catch(e){} }
  const folder=DriveApp.createFolder('NextUp · Events'); cfgSet_(CFG_KEYS.EVENTS_DIR,folder.getId()); return folder.getId();
}
function ensureBaseUrls_(){
  const org=cfgGet_(CFG_KEYS.ORG_URL,(typeof ORG_BASE_URL!=='undefined'?ORG_BASE_URL:'')); const pub=cfgGet_(CFG_KEYS.PUB_URL,(typeof PUBLIC_BASE_URL!=='undefined'?PUBLIC_BASE_URL:''));
  if (!org) cfgSet_(CFG_KEYS.ORG_URL, ScriptApp.getService().getUrl());
  if (!pub) cfgSet_(CFG_KEYS.PUB_URL, ScriptApp.getService().getUrl());
}
function cfgOrgUrl_(){ return cfgGet_(CFG_KEYS.ORG_URL,(typeof ORG_BASE_URL!=='undefined'?ORG_BASE_URL:'')) || ScriptApp.getService().getUrl(); }
function cfgPubUrl_(){ return cfgGet_(CFG_KEYS.PUB_URL,(typeof PUBLIC_BASE_URL!=='undefined'?PUBLIC_BASE_URL:'')) || ScriptApp.getService().getUrl(); }
function cfgControlId_(){ return ensureControlWorkbook_(); }
function cfgTemplateId_(){ return ensureEventTemplate_(); }
function cfgEventsFolderId_(){ return ensureEventsFolder_(); }

function tplEnsureSheetWithHeader_(ss,name,headers){
  const sh=ss.getSheetByName(name)||ss.insertSheet(name);
  const have=sh.getLastRow()>=1?sh.getRange(1,1,1,headers.length).getValues()[0]:[];
  const same=have.length===headers.length && have.every((v,i)=>String(v||'')===headers[i]);
  if (!same){ sh.clear(); sh.getRange(1,1,1,headers.length).setValues([headers]); }
  sh.setFrozenRows(1); sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#f3f6fb'); sh.autoResizeColumns(1,headers.length);
  return sh;
}
function tplUpsertKv_(sheet,kv){
  const lr=sheet.getLastRow(); const rows=lr>0?sheet.getRange(1,1,lr,2).getValues():[];
  const idx={}; rows.forEach((r,i)=>{ const k=String(r[0]||'').trim(); if(k) idx[k]=i+1; });
  Object.entries(kv||{}).forEach(([k,v])=>{ if(idx[k]) sheet.getRange(idx[k],2).setValue(v); else sheet.appendRow([k,v]); });
}
function tplEnsureMetaKv_(ss){
  const sh=ss.getSheetByName('Meta')||ss.insertSheet('Meta');
  if (sh.getLastRow()<1) sh.getRange(1,1,1,2).setValues([['key','value']]);
  tplUpsertKv_(sh,{ eventId:'',eventTag:'',slug:'',startDateISO:'', adminUrl:'',publicUrl:'',displayUrl:'',posterPageUrl:'', seedMode:'random',elimType:'none' });
  return sh;
}
function tplEnsurePosterConfigKv_(ss){
  const sh=ss.getSheetByName('PosterConfig')||ss.insertSheet('PosterConfig');
  if (sh.getLastRow()<1) sh.getRange(1,1,1,2).setValues([['key','value']]);
  tplUpsertKv_(sh,{ place:'', posterImageUrl:'', public_name_mode:'initials' });
  return sh;
}

/** ---------- 3) EVENTS MODEL ---------- */
const EVENTS_SHEET='Events';
// [PATCH] include seedMode, elimType indices (A:O zero-based)
const IDX={ id:0, name:1, slug:2, startDateISO:3, ssId:4, ssUrl:5, formId:6, tag:7, isDefault:8, seedMode:9, elimType:10 };

const EVENT_TABS={ HOME:'Home', META:'Meta', SIGNUPS:'SignupsView', SCHEDULE:'Schedule', STANDINGS:'Standings', POSTER:'PosterConfig' };

/** ---------- 4) HTML ROUTER ---------- */
function include(name){ return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function doGet(e){
  ensureControlStrictOnBoot();

  const p=(e&&e.parameter)||{}; const raw=(p.page||p.p||'Admin'); const key=String(raw).trim().toLowerCase();

  if (key==='r'){ // shortlink redirect
    // [PATCH] token sanitation
    const token=(p.t||p.token||'').toString();
    if (!/^[A-Za-z0-9_-]{4,}$/.test(token)) return redirectTo_(cfgPubUrl_());
    const target=Shortlinks.resolve(token) || cfgPubUrl_();
    return redirectTo_(target);
  }

  const PAGE={ admin:'Admin', public:'Public', display:'Display', poster:'Poster', test:'Test' };
  const page=PAGE[key]||'Admin';
  const tpl = HtmlService.createTemplateFromFile(page);
  tpl.appTitle='NextUp';

  const out = tpl.evaluate()
    .setTitle('NextUp · '+page)
    .addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1');

  // [PATCH] Only allow framing for public-facing pages
  if (page==='Public' || page==='Display' || page==='Poster') {
    out.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } else {
    out.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
  return out;
}

function redirectTo_(url){
  const safe=String(url||'').trim()||cfgPubUrl_();
  const html = `<!doctype html><html><head><base target="_top"><meta http-equiv="refresh" content="0; url=${safe}"></head><body>
<script>try{ window.top.location.replace(${JSON.stringify(safe)});}catch(e){ location.href=${JSON.stringify(safe)};}</script>
Redirecting… <a href="${safe}">Continue</a></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('Redirecting…').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** ---------- 5) Events Index (ETag + helpers) ---------- */
function getMain_(){ ensureAll_(); return SpreadsheetApp.openById(cfgControlId_()); }
function getEventsSheet_(){ const ss=getMain_(); return ss.getSheetByName(EVENTS_SHEET)||ss.insertSheet(EVENTS_SHEET); }

function computeEventTag_(slug,dateISO,id){
  const s=(String(slug||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'event').slice(0,48);
  const ymd=String(dateISO||'').replace(/-/g,'')||Utilities.formatDate(new Date(), Session.getScriptTimeZone(),'yyyyMMdd');
  const id6=String(id||'').replace(/-/g,'').slice(0,6)||'xxxxxx';
  return `${s}-${ymd}-${id6}`;
}
function rowToEvent_(r){
  const safe=i=>(i<r.length?r[i]:'');
  const id=safe(IDX.id); const slug=safe(IDX.slug)||safe(IDX.name)||id;
  return {
    id, name:safe(IDX.name), slug, startDateISO:safe(IDX.startDateISO),
    eventSpreadsheetId:safe(IDX.ssId), eventSpreadsheetUrl:safe(IDX.ssUrl),
    formId:safe(IDX.formId), eventTag:safe(IDX.tag)||computeEventTag_(slug,safe(IDX.startDateISO),id),
    isDefault:String(safe(IDX.isDefault)).toLowerCase()==='true'
  };
}
function getEventsSafe(etagOpt){
  ensureAll_();
  const sh=getEventsSheet_(); const last=sh.getLastRow();
  if (last<2) return { ok:true, status:200, etag:'empty', items:[] };

  const data=sh.getRange(2,1,last-1,15).getValues();
  const items=data.map(rowToEvent_);
  // [PATCH] strong ETag over actual data content
  const etag = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data))
  ).slice(0,12);

  if (etagOpt && etagOpt===etag) return { ok:true, status:304, etag, items:[] };
  return { ok:true, status:200, etag, items };
}

/** ---------- 6) Admin: Create Event & Workbook ---------- */
function createEvent(payload){
  ensureAll_();
  try{
    const name=(payload?.name||'').trim();
    const dateISO=(payload?.startDateISO||'').trim();
    if(!name||!dateISO) return { ok:false, error:'Name and Date required' };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || `event-${Date.now()}`;
    const id = Utilities.getUuid();
    const tag = computeEventTag_(slug,dateISO,id);

    // [PATCH] honor seed/elim from payload
    const seedMode = (payload?.seedMode || 'random').toString();
    const elimType = (payload?.elimType || 'none').toString();

    const sh=getEventsSheet_();
    const row=[id,name,slug,dateISO,'','','',tag,false,seedMode,elimType,'','',''];
    sh.appendRow(row);

    workerCreateEventWorkbook_(id);
    bustEventsCache_();
    return { ok:true, id, slug, tag };
  }catch(e){ return { ok:false, error:String(e) }; }
}

function workerCreateEventWorkbook_(eventId){
  ensureAll_();
  const sh=getEventsSheet_(); const last=sh.getLastRow(); if (last<2) return { ok:false, error:'No events' };

  const data=sh.getRange(2,1,last-1,15).getValues();
  const rowIdx=data.findIndex(r=>r[IDX.id]===eventId);
  if (rowIdx<0) return { ok:false, error:'Event not found' };
  const rowNum=rowIdx+2;

  const r=sh.getRange(rowNum,1,1,15).getValues()[0];
  const name=r[IDX.name]; const slug=r[IDX.slug]; const dateISO=r[IDX.startDateISO];
  const tag=r[IDX.tag] || computeEventTag_(slug,dateISO,r[IDX.id]);
  const seedMode=r[IDX.seedMode] || 'random';
  const elimType=r[IDX.elimType] || 'none';

  let workbookId=''; let workbookUrl='';

  const templateId=cfgTemplateId_();
  if (templateId){
    const folderId=cfgEventsFolderId_();
    const template=DriveApp.getFileById(templateId);
    const folder=DriveApp.getFolderById(folderId);
    const newName=`${slug}-${dateISO}`;
    const copy=template.makeCopy(newName,folder);
    const ss=SpreadsheetApp.openById(copy.getId());

    Object.values(EVENT_TABS).forEach(n=>{ if(!ss.getSheetByName(n)) ss.insertSheet(n); });

    const meta=ensureKvSheet_(ss,EVENT_TABS.META);
    upsertKv_(meta,{
      eventId:r[IDX.id], eventTag:tag, slug, startDateISO:dateISO,
      adminUrl:buildOrgUrl_('Admin',r[IDX.id]), publicUrl:buildPublicUrl_('Public',r[IDX.id]),
      displayUrl:buildOrgUrl_('Display',r[IDX.id]), posterPageUrl:buildPublicUrl_('Poster',r[IDX.id]),
      // [PATCH] persist chosen modes
      seedMode, elimType
    });

    header_(ss,EVENT_TABS.SIGNUPS,['timestamp','name','email','phone','team','notes']);
    header_(ss,EVENT_TABS.SCHEDULE,['round','time','activity','notes','table']);
    header_(ss,EVENT_TABS.STANDINGS,['team','points','tiebreak','notes']);
    tplEnsurePosterConfigKv_(ss);

    workbookId=copy.getId(); workbookUrl=copy.getUrl();
  } else {
    const title=`EVT__${slug}-${String(dateISO).replace(/-/g,'')}-${String(r[IDX.id]).replace(/-/g,'').slice(0,6)}`;
    const ss=createEventsFolderSpreadsheet_(title);

    const home=ss.getSheets()[0]; home.setName('Home');
    home.getRange(1,1,1,4).setValues([['NextUp · '+tag,'Name','Start Date','Event ID']]).setFontWeight('bold');
    home.getRange(2,2,1,3).setValues([[name||'',dateISO||'',r[IDX.id]]]);

    const signupsHdr=ctlTemplateHeaders_('SignupsTemplate',['timestamp','name','email','phone','team','notes']);
    const schedHdr=ctlTemplateHeaders_('ScheduleTemplate',['round','time','activity','notes','table']);
    const standHdr=ctlTemplateHeaders_('StandingsTemplate',['team','points','tiebreak','notes']);

    header_(ss,EVENT_TABS.SIGNUPS,signupsHdr);
    header_(ss,EVENT_TABS.SCHEDULE,schedHdr);
    header_(ss,EVENT_TABS.STANDINGS,standHdr);

    const posterKv=ctlPosterDefaults_();
    const posterSheet=ensureKvSheet_(ss,EVENT_TABS.POSTER);
    if (Object.keys(posterKv).length) upsertKv_(posterSheet,posterKv); else tplEnsurePosterConfigKv_(ss);

    const meta=ensureKvSheet_(ss,EVENT_TABS.META);
    upsertKv_(meta,{
      eventId:r[IDX.id], eventTag:tag, slug, startDateISO:dateISO,
      adminUrl:buildOrgUrl_('Admin',r[IDX.id]), publicUrl:buildPublicUrl_('Public',r[IDX.id]),
      displayUrl:buildOrgUrl_('Display',r[IDX.id]), posterPageUrl:buildPublicUrl_('Poster',r[IDX.id]),
      // [PATCH] persist chosen modes
      seedMode, elimType
    });

    workbookId=ss.getId(); workbookUrl=ss.getUrl();
  }

  sh.getRange(rowNum,IDX.ssId+1).setValue(workbookId);
  sh.getRange(rowNum,IDX.ssUrl+1).setValue(workbookUrl);
  bustEventsCache_();
  return { ok:true, spreadsheetId:workbookId, url:workbookUrl };
}

function createEventsFolderSpreadsheet_(name){
  const folderId=cfgEventsFolderId_();
  const file=SpreadsheetApp.create(name);
  try{
    const f=DriveApp.getFileById(file.getId());
    const target=DriveApp.getFolderById(folderId);
    target.addFile(f);
    const parents=f.getParents();
    while(parents.hasNext()){
      const p=parents.next();
      if (p.getId()!==folderId) p.removeFile(f);
    }
  }catch(_){}
  return SpreadsheetApp.openById(file.getId());
}

/** ---------- 7) Admin: Form Linking & Imports ---------- */
function setEventFormId(eventIdOrSlug, formIdOrUrl){
  const ev = findEventByIdOrSlug_(eventIdOrSlug);
  if (!ev) return { ok:false, error:'Event not found' };

  const sh=getEventsSheet_(); const last=sh.getLastRow(); if (last<2) return { ok:false, error:'No events' };
  const data=sh.getRange(2,1,last-1,15).getValues();
  // [PATCH] compare id OR slug correctly
  const idx=data.findIndex(r=>r[IDX.id]===ev.id || r[IDX.slug]===ev.slug);
  if (idx<0) return { ok:false, error:'Row not found' };

  const formId=parseFormId_(formIdOrUrl);
  sh.getRange(idx+2, IDX.formId+1).setValue(formId||'');

  if (ev.eventSpreadsheetId){
    const ss=SpreadsheetApp.openById(ev.eventSpreadsheetId);
    const meta=ensureKvSheet_(ss,EVENT_TABS.META);
    upsertKv_(meta,{
      formId: formId||'',
      formUrlView: formId ? `https://docs.google.com/forms/d/${formId}/viewform` : '',
      formUrlEdit: formId ? `https://docs.google.com/forms/d/${formId}/edit` : ''
    });
  }
  return { ok:true, formId: formId||'' };
}
function parseFormId_(s){ if(!s) return ''; const m=String(s).match(/\/d\/([^/]+)/); return (m&&m[1]) || String(s).trim(); }

function importSignupsCsv(eventIdOrSlug,csv){
  const ev=ensureWorkbook_(eventIdOrSlug); if(!ev.ok) return ev;
  const ss=SpreadsheetApp.openById(ev.ssId);
  const sh=ss.getSheetByName(EVENT_TABS.SIGNUPS)||ss.insertSheet(EVENT_TABS.SIGNUPS);
  const rows=Utilities.parseCsv(csv||''); if(!rows.length) return { ok:false, error:'Empty CSV' };
  if (sh.getLastRow()<1) sh.getRange(1,1,1,rows[0].length).setValues([rows[0]]);
  const body=(rows[0].some(v=>['name','team'].includes(String(v).toLowerCase())))?rows.slice(1):rows;
  if (body.length) sh.getRange(sh.getLastRow()+1,1,body.length,body[0].length).setValues(body);
  return { ok:true, count:body.length };
}
function importSignupsFromSheet(eventIdOrSlug,sheetId,rangeA1){
  const ev=ensureWorkbook_(eventIdOrSlug); if(!ev.ok) return ev;
  const src=SpreadsheetApp.openById(sheetId).getRange(rangeA1).getValues(); if(!src.length) return { ok:false, error:'Empty source range' };
  const ss=SpreadsheetApp.openById(ev.ssId);
  const sh=ss.getSheetByName(EVENT_TABS.SIGNUPS)||ss.insertSheet(EVENT_TABS.SIGNUPS);
  if (sh.getLastRow()<1) sh.getRange(1,1,1,src[0].length).setValues([src[0]]);
  const body=(src[0].some(v=>['name','team'].includes(String(v).toLowerCase())))?src.slice(1):src;
  if (body.length) sh.getRange(sh.getLastRow()+1,1,body.length,body[0].length).setValues(body);
  return { ok:true, count:body.length };
}

/** ---------- 8) Quick Links for Admin (shortlinks + QR) ---------- */
function getEventQuickLinks(eventIdOrSlug){
  const ev=findEventByIdOrSlug_(eventIdOrSlug); if(!ev) return { ok:false, error:'Event not found' };
  const eventId=ev.id;

  const adminUrl=buildOrgUrl_('Admin',eventId);
  const displayUrl=buildOrgUrl_('Display',eventId);
  const publicUrl=buildPublicUrl_('Public',eventId);
  const posterPageUrl=buildPublicUrl_('Poster',eventId);
  const workbookUrl=ev.eventSpreadsheetUrl||'';
  const posterUrl=workbookUrl;
  const posterImageUrl=posterImageFromWorkbook_(ev.eventSpreadsheetId);

  const formUrlView=ev.formId?`https://docs.google.com/forms/d/${ev.formId}/viewform`:'';
  const formUrlEdit=ev.formId?`https://docs.google.com/forms/d/${ev.formId}/edit`:'';

  const short={
    form: shortFor_(eventId,'FORM',formUrlView||''),
    display: shortFor_(eventId,'DISPLAY',displayUrl),
    public: shortFor_(eventId,'PUBLIC',publicUrl),
    poster: shortFor_(eventId,'POSTER_SHEET',posterUrl),
    posterImage: shortFor_(eventId,'POSTER_IMG',posterImageUrl||''),
    posterPage: shortFor_(eventId,'POSTER_PAGE',posterPageUrl)
  };

  const qr={
    form: short.form ? QR.image(short.form) : (formUrlView ? QR.image(formUrlView) : ''),
    display: short.display ? QR.image(short.display) : QR.image(displayUrl),
    public: short.public ? QR.image(short.public) : QR.image(publicUrl),
    poster: short.poster ? QR.image(short.poster) : (posterUrl ? QR.image(posterUrl) : ''),
    posterImage: short.posterImage ? QR.image(short.posterImage) : '',
    posterPage: short.posterPage ? QR.image(short.posterPage) : QR.image(posterPageUrl)
  };

  let signupsUrl='';
  if (ev.eventSpreadsheetId){
    const ss=SpreadsheetApp.openById(ev.eventSpreadsheetId);
    const gid=ss.getSheetByName(EVENT_TABS.SIGNUPS)?.getSheetId();
    if (gid) signupsUrl=`${ss.getUrl()}#gid=${gid}`;
  }

  return { ok:true, adminUrl, displayUrl, publicUrl, posterUrl, posterImageUrl, posterPageUrl,
    formUrlView, formUrlEdit, workbookUrl, signupsUrl, short, qr };
}

/** ---------- 9) Display/Public/Poster Bundles ---------- */
function getDisplayBundle(eventIdOrSlug){
  const ev=ensureWorkbook_(eventIdOrSlug); if(!ev.ok) return ev;
  const ss=SpreadsheetApp.openById(ev.ssId);
  const meta=readKv_(ss,EVENT_TABS.META);
  const cfg=readKv_(ss,EVENT_TABS.POSTER);

  return { ok:true, eventTag:meta.eventTag||ev.tag, title:meta.title||ev.name||ev.tag,
    datePretty:prettyDate_(meta.startDateISO||ev.dateISO), place:cfg.place||'',
    standings:readTable_(ss,EVENT_TABS.STANDINGS), schedule:readTable_(ss,EVENT_TABS.SCHEDULE),
    adminUrl:buildOrgUrl_('Admin',ev.id), publicUrl:buildPublicUrl_('Public',ev.id),
    posterPageUrl:buildPublicUrl_('Poster',ev.id) };
}
function getPublicBundle(eventIdOrSlug){
  const ev=ensureWorkbook_(eventIdOrSlug); if(!ev.ok) return ev;
  const ss=SpreadsheetApp.openById(ev.ssId);
  const meta=readKv_(ss,EVENT_TABS.META);
  const cfg=readKv_(ss,EVENT_TABS.POSTER);
  const nameMode=String(cfg.public_name_mode||'initials').toLowerCase();

  const standings=applyNameMode_(readTable_(ss,EVENT_TABS.STANDINGS),nameMode);
  const schedule=applyNameMode_(readTable_(ss,EVENT_TABS.SCHEDULE),nameMode,['team','team_a','team_b']);

  return { ok:true, eventTag:meta.eventTag||ev.tag, title:meta.title||ev.name||ev.tag,
    datePretty:prettyDate_(meta.startDateISO||ev.dateISO), place:cfg.place||'',
    public_name_mode:nameMode, standings, schedule, posterPageUrl:buildPublicUrl_('Poster',ev.id) };
}
function getPosterBundle(eventIdOrSlug){
  const ev=ensureWorkbook_(eventIdOrSlug); if(!ev.ok) return ev;
  const ss=SpreadsheetApp.openById(ev.ssId);
  const meta=readKv_(ss,EVENT_TABS.META);
  const cfg=readKv_(ss,EVENT_TABS.POSTER);

  const posterImageUrl=String(cfg.posterImageUrl||'').trim();
  const adminUrl=buildOrgUrl_('Admin',ev.id);
  const publicUrl=buildPublicUrl_('Public',ev.id);

  const sForm=ev.formId?shortFor_(ev.id,'FORM',`https://docs.google.com/forms/d/${ev.formId}/viewform`):'';
  const sPublic=shortFor_(ev.id,'PUBLIC',publicUrl);

  const qr={
    form: sForm ? QR.image(sForm) : (ev.formId ? QR.image(`https://docs.google.com/forms/d/${ev.formId}/viewform`) : ''),
    public: sPublic ? QR.image(sPublic) : QR.image(publicUrl)
  };

  return { ok:true, eventTag:meta.eventTag||ev.tag, title:meta.title||ev.name||ev.tag,
    datePretty:prettyDate_(meta.startDateISO||ev.dateISO), place:cfg.place||'',
    posterImageUrl, adminUrl, publicUrl, qr };
}

/** ---------- 10) Shortlinks + QR ---------- */
const SHORT_KEY_MAP='NU_SHORTLINKS_MAP_V1';      // key -> token
const SHORT_TARGET_MAP='NU_SHORTLINKS_TARGETS_V1'; // token -> target
const Shortlinks={
  set(key,target){
    if (!target) return '';
    const props=PropertiesService.getScriptProperties();
    const map=JSON.parse(props.getProperty(SHORT_KEY_MAP)||'{}');
    let token=map[key];
    if (!token){ token=this._token(`${key}|${target}`); map[key]=token; props.setProperty(SHORT_KEY_MAP,JSON.stringify(map)); }
    const tmap=JSON.parse(props.getProperty(SHORT_TARGET_MAP)||'{}'); tmap[token]=target; props.setProperty(SHORT_TARGET_MAP,JSON.stringify(tmap));
    return this.url(token);
  },
  resolve(token){
    const tmap=JSON.parse(PropertiesService.getScriptProperties().getProperty(SHORT_TARGET_MAP)||'{}');
    return tmap[token] || null;
  },
  url(token){ const base=cfgPubUrl_(); return `${base}?page=R&t=${encodeURIComponent(token)}`; },
  _token(raw){ return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw)).slice(0,10); }
};
function shortFor_(eventId,type,targetUrl){ if(!targetUrl) return ''; return Shortlinks.set(`${type}:${eventId}`, targetUrl); }
const QR={ image(url){ if(!url) return ''; return `https://quickchart.io/qr?text=${encodeURIComponent(url)}&margin=2&size=300`; } };

/** ---------- 11) Data Utils ---------- */
function ensureWorkbook_(eventIdOrSlug){
  const ev=findEventByIdOrSlug_(eventIdOrSlug); if(!ev) return { ok:false, error:'Event not found' };
  if (!ev.eventSpreadsheetId){
    const r=workerCreateEventWorkbook_(ev.id); if(!r.ok) return r;
    ev.eventSpreadsheetId=r.spreadsheetId; ev.eventSpreadsheetUrl=r.url;
  }
  return { ok:true, id:ev.id, name:ev.name, tag:ev.eventTag, dateISO:ev.startDateISO, ssId:ev.eventSpreadsheetId, ssUrl:ev.eventSpreadsheetUrl, formId:ev.formId };
}
function findEventByIdOrSlug_(idOrSlug){
  const sh=getEventsSheet_(); const last=sh.getLastRow(); if(last<2) return null;
  const data=sh.getRange(2,1,last-1,15).getValues();
  const r=data.find(r=>r[IDX.id]===idOrSlug || r[IDX.slug]===idOrSlug || r[IDX.id]===String(idOrSlug));
  return r ? rowToEvent_(r) : null;
}

function readTable_(ss,name){
  const sh=ss.getSheetByName(name); if(!sh) return [];
  const lr=sh.getLastRow(), lc=sh.getLastColumn(); if(lr<2||lc<1) return [];
  const vals=sh.getRange(1,1,lr,lc).getValues();
  const header=vals[0].map(v=>String(v||'').trim()).map(h=>h.replace(/\s+/g,'_').toLowerCase());
  const out=[];
  for(let i=1;i<vals.length;i++){
    const row={}; for(let j=0;j<header.length;j++) row[header[j]]=vals[i][j];
    if (Object.values(row).every(v=>v===''||v===null)) continue; out.push(row);
  }
  return out;
}
function ensureKvSheet_(ss,name){ const sh=ss.getSheetByName(name)||ss.insertSheet(name); if(sh.getLastRow()<1) sh.getRange(1,1,1,2).setValues([['key','value']]); return sh; }
function upsertKv_(sheet,kv){
  const lr=sheet.getLastRow(); const rows=lr>0?sheet.getRange(1,1,lr,2).getValues():[];
  const idx={}; rows.forEach((r,i)=>{ const k=String(r[0]||'').trim(); if(k) idx[k]=i+1; });
  Object.entries(kv||{}).forEach(([k,v])=>{ if(idx[k]) sheet.getRange(idx[k],2).setValue(v); else sheet.appendRow([k,v]); });
}
function header_(ss,name,cols){
  const sh=ss.getSheetByName(name)||ss.insertSheet(name);
  const lc=Math.max(1,sh.getLastColumn());
  const existing=sh.getRange(1,1,1,Math.max(lc,cols.length)).getValues()[0].slice(0,cols.length).map(v=>String(v||'').trim());
  const same=existing.length===cols.length && existing.every((v,i)=>v===cols[i]);
  if(!same) sh.getRange(1,1,1,cols.length).setValues([cols]);
  sh.setFrozenRows(1); sh.getRange(1,1,1,cols.length).setFontWeight('bold').setBackground('#f3f6fb'); sh.autoResizeColumns(1,cols.length);
}
function posterImageFromWorkbook_(ssId){
  if(!ssId) return ''; const ss=SpreadsheetApp.openById(ssId); const kv=readKv_(ss,EVENT_TABS.POSTER); return String(kv.posterImageUrl||'').trim();
}
function readKv_(ss,name){
  const sh=ss.getSheetByName(name); if(!sh) return {};
  const lr=sh.getLastRow(); if(lr<1) return {};
  const vals=sh.getRange(1,1,lr,2).getValues(); const obj={};
  vals.forEach(r=>{ const k=String(r[0]||'').trim(); if(k) obj[k]=r[1]; });
  return obj;
}
function applyNameMode_(rows,mode,fields){
  const m=String(mode||'initials').toLowerCase(); if(m==='full') return rows;
  const targets=(fields&&fields.length)?fields:['name','team','player','team_a','team_b'];
  return rows.map(row=>{
    const r=Object.assign({},row);
    targets.forEach(f=>{
      if (r[f]===undefined) return;
      const v=String(r[f]||'').trim(); if(!v){ r[f]=v; return; }
      if (m==='none'){ r[f]='—'; return; }
      const parts=v.split(/\s+/).filter(Boolean);
      r[f]=parts.map(p=>p[0]).join('').toUpperCase() || '—';
    }); return r;
  });
}
function prettyDate_(iso){ if(!iso) return ''; try{ const d=new Date(iso); return Utilities.formatDate(d,Session.getScriptTimeZone(),'EEE, MMM d — h:mma'); }catch(e){ return String(iso); }}

/** ---------- 12) URL Builders & Cache ---------- */
function buildOrgUrl_(page,eventId){ const base=cfgOrgUrl_(); return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`; }
function buildPublicUrl_(page,eventId){ const base=cfgPubUrl_(); return `${base}?page=${encodeURIComponent(page)}&event=${encodeURIComponent(eventId)}`; }
function bustEventsCache_(){ CacheService.getScriptCache().remove('events_index'); }

/** ---------- 13) Debug helpers ---------- */
function NU_Debug_ListEvents(){ return getEventsSafe(null); }
function NU_Debug_GetLinks(eid){ return getEventQuickLinks(eid); }
function NU_Debug_Display(eid){ return getDisplayBundle(eid); }
function NU_Debug_Public(eid){ return getPublicBundle(eid); }
function NU_Debug_Poster(eid){ return getPosterBundle(eid); }

/************************************************************
* NextUp v3.5 — Test Harness & Suites
* Visual indicators are rendered in HTML (cache badge, PASS/FAIL ribbons, toasts)
************************************************************/
function __T_now(){ return Date.now(); }
function __T_ok(cond,msg,ctx){ if(!cond) throw { __assert:true, msg:msg||'assert failed', ctx:ctx||{} }; }
function __T_eq(a,b,msg,ctx){ if(a!==b) throw { __assert:true, msg:msg||'expected equal', ctx:{a,b,...(ctx||{})} }; }
function __T_ge(a,b,msg,ctx){ if(!(a>=b)) throw { __assert:true, msg:msg||'expected >=', ctx:{a,b,...(ctx||{})} }; }

function __run(name,tests){
  const out={ suite:name, start:__T_now(), cases:[], ok:true };
  for (const tc of tests){
    const r={ name:tc.name, ok:true, ms:0, err:null }; const t0=__T_now();
    try{ tc.fn(); }catch(e){ r.ok=false; r.err=(e&&e.__assert)?e:{ msg:String(e) }; out.ok=false; }
    r.ms=__T_now()-t0; out.cases.push(r);
  }
  out.ms=__T_now()-out.start; return out;
}

function dx_ping(){ return { ok:true, t:Date.now(), build:'v3.5' }; }
function dx_identity(){ let user=null; try{ user=Session.getActiveUser().getEmail()||null; }catch(e){} let base=''; try{ base=ScriptApp.getService().getUrl()||''; }catch(e){} return { ok:true, user, base }; }
function dx_props(){ const p=PropertiesService.getScriptProperties(); const all=p.getProperties(); return { ok:true, count:Object.keys(all).length, props:all }; }
function dx_control(){ try{ const id=cfgControlId_(); const ss=SpreadsheetApp.openById(id); const sh=ss.getSheetByName('Events'); const hdr=sh?sh.getRange(1,1,1,15).getValues()[0]:[]; return { ok:true, id, url:ss.getUrl(), headers:hdr }; }catch(e){ return { ok:false, err:String(e) }; } }
function dx_events_index(){ try{ return { ok:true, res:getEventsSafe(null) }; }catch(e){ return { ok:false, err:String(e), stack:e.stack }; } }
function dx_echo(payload){ return { ok:true, payload, t:Date.now() }; }
function dx_create_archive_cycle(){
  const tag='DX_'+new Date().toISOString().slice(0,10)+'_'+Math.random().toString(36).slice(2,6);
  const dateISO=new Date().toISOString().slice(0,10);
  return __withTempEvent(tag,dateISO,(ctx)=>({ ok:true, eventId:ctx.id, ssId:ctx.ssId }));
}

function __withTempEvent(name,dateISO,fn){
  ensureAll_();
  const before=Date.now();
  const c=createEvent({ name, startDateISO:dateISO, seedMode:'random', elimType:'none' });
  if (!c||!c.ok) return { ok:false, err:'createEvent failed', res:c };

  const sh=getEventsSheet_(); const last=sh.getLastRow(); if(last<2) return { ok:false, err:'no events after create' };
  const data=sh.getRange(2,1,last-1,15).getValues(); const idx=data.findIndex(r=>r[IDX.id]===c.id);
  if (idx<0) return { ok:false, err:'row not found', id:c.id };

  const row=data[idx]; const ssId=row[IDX.ssId]||'';
  let result=null, ok=true, err=null;
  try{ result=fn({ id:c.id, rowIndex:idx+2, ssId:ssId }); }catch(e){ ok=false; err=String(e); }

  try{ sh.deleteRow(idx+2); }catch(_){}
  try{ if (ssId) DriveApp.getFileById(ssId).setTrashed(true); }catch(_){}
  bustEventsCache_();

  return { ok, err, id:c.id, ms:Date.now()-before, result };
}

/** ===== Unit / Integration / Functional / System / E2E ===== */
function __suite_unit(){
  return __run('unit',[
    { name:'computeEventTag_ format', fn:()=>{ const tag=computeEventTag_('abc Event','2025-09-15','ID-123456'); __T_ok(/^[a-z0-9-]+-\d{8}-[A-Za-z0-9]{6}$/i.test(tag),'bad tag',{ tag }); } },
    { name:'ensureEventsHeaders_ matches canonical order', fn:()=>{ const id=cfgControlId_(); ensureEventsHeaders_(id); const ss=SpreadsheetApp.openById(id); const sh=ss.getSheetByName('Events'); const hdr=sh.getRange(1,1,1,15).getValues()[0]; const want=['id','name','slug','startDateISO','eventSpreadsheetId','eventSpreadsheetUrl','formId','eventTag','isDefault','seedMode','elimType','reserved1','reserved2','reserved3']; __T_ok(want.every((h,i)=>String(hdr[i]||'')===h),'Events header mismatch',{ hdr }); } },
    { name:'Shortlinks token stable per key', fn:()=>{ const u1=Shortlinks.set('TEST:ABC','https://example.com/x'); const u2=Shortlinks.set('TEST:ABC','https://example.com/x'); __T_eq(u1,u2,'token changed',{u1,u2}); } },
  ]);
}
function __suite_integration(){
  return __run('integration',[
    { name:'ensureControlStrictOnBoot ok', fn:()=>{ const r=ensureControlStrictOnBoot(); __T_ok(!!r && r.ok===true,'boot failed',r); } },
    { name:'getEventsSafe fresh & then 304', fn:()=>{ const a=getEventsSafe(null); __T_ok(a.ok && a.status===200,'first fetch not 200',a); const b=getEventsSafe(a.etag); __T_ok(b.ok && b.status===304,'not 304 with same etag',b); } },
    { name:'createEvent auto-creates workbook & links Control', fn:()=>{ const now=new Date().toISOString().slice(0,10); const r=__withTempEvent('INT_'+now,now,(ctx)=>ctx); __T_ok(r.ok===true,'temp event failed',r); __T_ok(!!r.result.ssId,'no workbook id',r); } },
  ]);
}
function __suite_functional(){
  return __run('functional',[
    { name:'getEventQuickLinks returns URLs & short/qr', fn:()=>{ const now=new Date().toISOString().slice(0,10); const r=__withTempEvent('FN_'+now,now,(ctx)=>{ const links=getEventQuickLinks(ctx.id); __T_ok(links.ok===true,'links not ok',links); __T_ok(!!links.publicUrl && !!links.adminUrl,'missing urls',links); __T_ok(!!links.short.public,'no shortlink',links.short); __T_ok(!!links.qr.public,'no qr',links.qr); return true; }); __T_ok(r.ok===true,'functional links failed',r); } },
    { name:'setEventFormId writes to control + Meta', fn:()=>{ const now=new Date().toISOString().slice(0,10); const r=__withTempEvent('FORM_'+now,now,(ctx)=>{ const fake='1FAIpQL'+Math.random().toString(36).slice(2,10); const s=setEventFormId(ctx.id,`https://docs.google.com/forms/d/${fake}/viewform`); __T_ok(s.ok===true,'setEventFormId failed',s); const ss=SpreadsheetApp.openById(ctx.ssId); const meta=readKv_(ss,'Meta'); __T_eq(meta.formId,fake,'formId not in Meta',{ meta }); return true; }); __T_ok(r.ok===true,'form linking failed',r); } },
  ]);
}
function __suite_system(){
  return __run('system',[
    { name:'Public/Display/Poster bundles read', fn:()=>{ const now=new Date().toISOString().slice(0,10); const r=__withTempEvent('SYS_'+now,now,(ctx)=>{ const a=getPublicBundle(ctx.id); __T_ok(a.ok===true,'public bad',a); const b=getDisplayBundle(ctx.id); __T_ok(b.ok===true,'display bad',b); const c=getPosterBundle(ctx.id); __T_ok(c.ok===true,'poster bad',c); return true; }); __T_ok(r.ok===true,'bundle read failed',r); } },
    { name:'Shortlinks resolve & redirect URL shape', fn:()=>{ const tokUrl=Shortlinks.set('DISPLAY:XYZ','https://example.com/display'); __T_ok(/\?page=R&t=/.test(tokUrl),'bad short url',{ tokUrl }); const token=(tokUrl.split('t=')[1]||'').split('&')[0]; const tgt=Shortlinks.resolve(token); __T_eq(tgt,'https://example.com/display','resolve mismatch',{ tgt }); } },
  ]);
}
function __suite_e2e(){
  return __run('e2e',[
    { name:'URL builders include page & event', fn:()=>{ const url1=buildOrgUrl_('Admin','EID123'); const url2=buildPublicUrl_('Public','EID123'); __T_ok(/page=Admin/.test(url1)&&/event=EID123/.test(url1),'bad org url',{url1}); __T_ok(/page=Public/.test(url2)&&/event=EID123/.test(url2),'bad pub url',{url2}); } },
    { name:'ensureWorkbook_ creates workbook on-demand for slug', fn:()=>{ const now=new Date().toISOString().slice(0,10); const c=createEvent({ name:'E2E_'+now, startDateISO:now }); __T_ok(c&&c.ok,'create failed',c); const sh=getEventsSheet_(); const last=sh.getLastRow(); const data=sh.getRange(2,1,last-1,15).getValues(); const idx=data.findIndex(r=>r[IDX.id]===c.id); __T_ok(idx>=0,'row missing',{ id:c.id }); const row=data[idx]; const slug=row[IDX.slug]; const ssId=row[IDX.ssId]; try{ if(ssId) DriveApp.getFileById(ssId).setTrashed(true);}catch(_){} sh.deleteRow(idx+2); bustEventsCache_(); const ev=ensureWorkbook_(slug); __T_ok(ev.ok===true && !!ev.ssId,'ensureWorkbook_ did not create',{ev}); try{ DriveApp.getFileById(ev.ssId).setTrashed(true);}catch(_){} } },
  ]);
}
function run_test_suite(mode){
  const start=__T_now(); const suites=[]; suites.push(__suite_unit()); suites.push(__suite_integration());
  if (mode!=='smoke') suites.push(__suite_functional());
  if (mode!=='smoke') suites.push(__suite_system());
  if (mode==='full') suites.push(__suite_e2e());
  const flat=suites.flatMap(s=>s.cases.map(c=>({ suite:s.suite, name:c.name, ok:c.ok, ms:c.ms, err:c.err||null })));
  const ok=flat.every(x=>x.ok);
  return { ok, mode:mode||'smoke', ms:__T_now()-start, results:suites, flat };
}
function log_test_report(rep){
  try{
    const id=cfgControlId_(); const ss=SpreadsheetApp.openById(id);
    const name='DiagResults'; const sh=ss.getSheetByName(name)||ss.insertSheet(name);
    if (sh.getLastRow()===0){ sh.getRange(1,1,1,5).setValues([['ts','suite','test','ok','ms']]).setFontWeight('bold'); sh.setFrozenRows(1); }
    const rows=(rep.flat||[]).map(r=>[new Date(), r.suite, r.name, r.ok, r.ms]);
    if (rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
    return { ok:true, wrote:rows.length, sheet:name };
  }catch(e){ return { ok:false, err:String(e) }; }
}