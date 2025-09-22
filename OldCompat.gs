/** ================= OldCompat.gs — keep old names, new guts ================ **/

// Old "createEvent" → new eventbook create (keeps old signature usable)
function createEvent(payload){
  const res = _createEventbookImpl(payload || {});
  if (!res.ok) return { ok:false, status:400, error: res.error || 'create failed' };

  // Build an "item" compatible with older Admin/Status UIs
  const item = {
    id: res.id,
    name: String(payload?.name || ''),
    slug: res.slug,
    startDateISO: String(payload?.startDateISO || payload?.startDate || ''),
    eventSpreadsheetId: res.ssId || '',
    eventSpreadsheetUrl: res.ssUrl || '',
    eventTag: res.tag || '',
    isDefault: false,
    seedMode: String(payload?.seedMode || 'random'),
    elimType: String(payload?.elimType || 'none'),
    status: '', statusMsg: '',
    updatedAtISO: new Date().toISOString().replace('Z',''),
    publicUrl:  buildPublicUrl_('Public',  res.id),
    displayUrl: buildOrgUrl_('Display',   res.id)
  };
  return { ok:true, status:200, item };
}

// Old "getShareQr" → verified/shortlink QR only
function getShareQr(key){
  const ev = findEventByIdOrSlug_(key);
  if (!ev) return { ok:false, status:404, error:'not found' };
  const ql = getEventQuickLinks(ev.id);
  const qrPublic = (ql.short && ql.short.public) ? (ql.qr && ql.qr.public || '') : '';
  if (!ql.publicUrl) return { ok:false, status:409, error:'not ready' };
  return { ok:true, status:200, url: ql.publicUrl, qrB64: qrPublic };
}

// Old provisioning FSM → mapped to new reality (workbook + links)
function provisionStep(key){
  const ev = findEventByIdOrSlug_(key);
  if (!ev) return { ok:false, status:404, error:'not found' };

  // ensure workbook exists
  if (!ev.eventSpreadsheetId){
    const r = workerCreateEventWorkbook_(ev.id);
    if (!r.ok) return { ok:false, status:500, error:r.error || 'workbook create failed' };
  }

  // calling quick-links guarantees links/shortlinks are constructed
  const ql = getEventQuickLinks(ev.id);
  const linksReady = !!(ql.publicUrl && ql.displayUrl);
  const st = linksReady ? 'LINKS_READY' : 'WORKBOOK_READY';
  return { ok:true, status:200, statusText: st };
}

function getProvisionStatus(key){
  const ev = findEventByIdOrSlug_(key);
  if (!ev) return { ok:false, status:404, error:'not found' };
  const hasWorkbook = !!(ev.eventSpreadsheetId);
  const ql = hasWorkbook ? getEventQuickLinks(ev.id) : null;
  const hasLinks = !!(ql && ql.publicUrl && ql.displayUrl);
  const st = hasLinks ? 'LINKS_READY' : (hasWorkbook ? 'WORKBOOK_READY' : 'CREATED');
  return { ok:true, status:200, statusText: st, hasWorkbook, hasLinks };
}

// Old "getEventbooksSafe" already aliases to getEventsSafe in Code.gs.
// Old default/archive names are already ported in S15.

// Keep an ultra-light audit for Status.html until you port your rich one.
function auditDeep(){
  const s = runSmokeSafe();
  return {
    ok: s.ok,
    build: BUILD_ID,
    generatedAt: new Date().toISOString().replace('Z',''),
    sections: [{
      title:'Smoke',
      ok:s.ok, severity: s.ok ? 'green':'red',
      checks:[{ id:'boot', label:'Control boot', status: s.ok ? 'green':'red', detail: s.ok ? '' : (s.error||'') }]
    }]
  };
}