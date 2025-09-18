/************************************************************
* NextUp v4.1 — Server (Google Apps Script)
* - Router + API for Eventbook v4.0 flow
* - ETag discipline, idempotent provisioning, input validation
* - Deep audit endpoints for ?p=status
************************************************************/

/** ===== Build / Constants ===== */
const BUILD_ID = 'nextup-v4.1-eventbooks';
const STATUS = Object.freeze({
    CREATED: 'CREATED',
    WORKBOOK_READY: 'WORKBOOK_READY',
    LINKS_READY: 'LINKS_READY',
    ERROR: 'ERROR'
});

/** Base columns controlled by the app (do not reorder lightly). */
const CONTROL_HEADERS = Object.freeze([
    'id', 'name', 'slug', 'startDateISO',
    'eventSpreadsheetId', 'eventSpreadsheetUrl',
    'eventTag', 'isDefault',
    'seedMode', 'elimType',
    // v4+ operational columns:
    'status', 'statusMsg', 'updatedAtISO',
    'publicUrl', 'displayUrl'
]);

/** Where the control Spreadsheet lives. */
const PROP_CONTROL_ID = 'nu_control_ss_id';

/** ===== Router ===== */
function doGet(e) {
    try {
        const page = (e && e.parameter && e.parameter.p || '').trim().toLowerCase();
        if (!page) return htmlError_(400, 'Missing ?p route');

        // HTML pages
        if (page === 'admin' || page === 'public' || page === 'display' || page === 'poster' || page === 'status') {
            const t = HtmlService.createTemplateFromFile(cap_(page));
            t.appTitle = 'NextUp';
            t.BUILD_ID = BUILD_ID;
            t.include = include;
            return t.evaluate()
                .setTitle('NextUp · ' + cap_(page))
                .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
                .addMetaTag('viewport', 'width=device-width,initial-scale=1,viewport-fit=cover');
        }

        // Simple text health check
        if (page === 'ping') {
            return ContentService.createTextOutput(ping());
        }

        return htmlError_(404, 'Unknown page: ' + page);
    } catch (err) {
        return htmlError_(500, String(err));
    }
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function cap_(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function htmlError_(code, msg) {
    const html = HtmlService.createHtmlOutput(
        '<!doctype html><meta charset="utf-8"><title>Error</title><pre>' +
        escHtml_(String(msg)) + '</pre>'
    );
    // Note: Apps Script HtmlOutput does not carry HTTP code; title/body conveys error.
    return html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** ===== Simple health endpoint ===== */
function ping() {
    return 'ok ' + BUILD_ID;
}

/** ===== Control sheet boot / access ===== */
function getOrCreateControl_() {
    const props = PropertiesService.getScriptProperties();
    let ssId = props.getProperty(PROP_CONTROL_ID);
    let ss;
    if (ssId) {
        try { ss = SpreadsheetApp.openById(ssId); }
        catch (e) { /* fallthrough to create */ }
    }
    if (!ss) {
        ss = SpreadsheetApp.create('NextUp Control');
        props.setProperty(PROP_CONTROL_ID, ss.getId());
    }
    let sh = ss.getSheetByName('Events');
    if (!sh) sh = ss.insertSheet('Events', 0);
    ensureHeaders_(sh, CONTROL_HEADERS);
    return ss;
}

function ensureHeaders_(sh, headers) {
    const firstRow = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getMaxColumns()));
    const values = firstRow.getValues()[0];
    for (let col = 1; col <= headers.length; col++) {
        if ((values[col - 1] || '') !== headers[col - 1]) {
            sh.getRange(1, col).setValue(headers[col - 1]);
        }
    }
    SpreadsheetApp.flush();
}

/** ===== Events index with ETag discipline ===== */
function getEventsSafe(etagMaybe) {
    const out = readEventsIndex_();
    if (etagMaybe && etagMaybe === out.etag) {
        return { ok: true, notModified: true, etag: out.etag, items: [] };
    }
    return { ok: true, etag: out.etag, items: out.items };
}

function readEventsIndex_() {
    const ss = getOrCreateControl_();
    const sh = ss.getSheetByName('Events');
    const range = sh.getDataRange().getValues();
    const headers = range[0];
    const items = [];
    for (let r = 1; r < range.length; r++) {
        const row = toObj_(headers, range[r]);
        if (!row.id && !row.slug) continue;
        items.push(row);
    }
    const etag = computeEtag_(items);
    return { items, etag };
}

function toObj_(headers, arr) {
    const o = {};
    const n = Math.min(headers.length, arr.length);
    for (let i = 0; i < n; i++) {
        const k = (headers[i] || '').toString().trim();
        if (!k) continue;
        o[k] = arr[i];
    }
    return o;
}

/** ===== Create eventbook (validate + normalize) ===== */
function createEvent(payload) {
    try {
        const name = String((payload && payload.name) || '').trim();
        if (!name) return { ok: false, error: 'Missing name' };
        const startDateISO = normalizeDateISO_((payload && payload.startDateISO) || null);
        const elimType = normEnum_((payload && payload.elimType) || 'single', ['single', 'double', 'round-robin']);
        const seedMode = normEnum_((payload && payload.seedMode) || 'seeded', ['seeded', 'random', 'none']);
        const slugInput = (payload && payload.slug) || '';
        const slug = uniqueSlug_(slugify_(slugInput || name));

        const nowISO = todayTimeISO_();
        const id = genId_();
        const item = {
            id, name, slug, startDateISO,
            eventSpreadsheetId: '', eventSpreadsheetUrl: '',
            eventTag: makeTag_(name, startDateISO, id),
            isDefault: false,
            seedMode, elimType,
            status: STATUS.CREATED, statusMsg: '',
            updatedAtISO: nowISO,
            publicUrl: '', displayUrl: ''
        };
        upsertRow_(item);
        bustEventsCache_();

        return { ok: true, item };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

/** ===== Provision step (idempotent) =====
* Steps:
* CREATED -> create workbook -> WORKBOOK_READY
* WORKBOOK_READY -> ensure links -> LINKS_READY
* LINKS_READY -> no-op
*/
function provisionStep(key) {
    const row = findEventRowByKey_(key);
    if (!row) return { ok: false, error: 'not found' };
    try {
        if (row.status === STATUS.ERROR) {
            return { ok: false, error: row.statusMsg || 'error' };
        }
        if (row.status === STATUS.CREATED) {
            // Create workbook once
            if (!row.eventSpreadsheetId) {
                const ss = SpreadsheetApp.create('NextUp Event · ' + (row.name || row.slug || row.id));
                row.eventSpreadsheetId = ss.getId();
                row.eventSpreadsheetUrl = ss.getUrl();
                // TODO: seed standard tabs if needed
            }
            row.status = STATUS.WORKBOOK_READY;
            row.statusMsg = '';
            row.updatedAtISO = todayTimeISO_();
            upsertRow_(row);
            bustEventsCache_();
            return { ok: true, status: row.status };
        }
        if (row.status === STATUS.WORKBOOK_READY) {
            // Ensure links; advance only when both present
            ensureLinks_(row);
            if (row.publicUrl && row.displayUrl) {
                row.status = STATUS.LINKS_READY;
                row.statusMsg = '';
                row.updatedAtISO = todayTimeISO_();
                upsertRow_(row);
                bustEventsCache_();
            }
            return { ok: true, status: row.status };
        }
        if (row.status === STATUS.LINKS_READY) {
            // No-op; idempotent
            return { ok: true, status: row.status };
        }
        // Unknown status -> mark error
        row.status = STATUS.ERROR;
        row.statusMsg = 'Unknown status';
        row.updatedAtISO = todayTimeISO_();
        upsertRow_(row);
        bustEventsCache_();
        return { ok: false, error: 'unknown status' };
    } catch (e) {
        row.status = STATUS.ERROR;
        row.statusMsg = String(e);
        row.updatedAtISO = todayTimeISO_();
        upsertRow_(row);
        bustEventsCache_();
        return { ok: false, error: String(e) };
    }
}

function getProvisionStatus(key) {
    const row = findEventRowByKey_(key);
    if (!row) return { ok: false, error: 'not found' };
    if (row.status === STATUS.ERROR) {
        return { ok: false, status: row.status, statusMsg: row.statusMsg || 'failed' };
    }
    return {
        ok: true,
        status: row.status,
        statusMsg: row.statusMsg || '',
        hasWorkbook: !!row.eventSpreadsheetId,
        hasLinks: !!row.publicUrl && !!row.displayUrl
    };
}

/** Fill public/display URLs if missing (safe/idempotent). */
function ensureLinks_(row) {
    const base = ScriptApp.getService().getUrl();
    const key = encodeURIComponent(row.id || row.slug);
    if (!row.publicUrl) {
        row.publicUrl = base + '?p=public&event=' + key;
    }
    if (!row.displayUrl) {
        row.displayUrl = base + '?p=display&event=' + key + '&tv=1';
    }
}

/** ===== Public bundle / QR ===== */
function getPublicBundle(key) {
    const row = findEventRowByKey_(key);
    if (!row) return { ok: false, error: 'not found' };
    return {
        ok: true,
        eventMeta: {
            id: row.id, slug: row.slug, name: row.name || '',
            dateISO: row.startDateISO || '',
            flow: 'Eventbook',
            elimType: row.elimType || '',
            seedMode: row.seedMode || '',
            status: row.status,
            formUrl: '' // optional extension in future
        },
        schedule: [], // populate if you have real data
        standings: [], // populate if you have real data
        bracket: { type: row.elimType || 'single', rounds: [] }
    };
}

function getShareQr(key) {
    const row = findEventRowByKey_(key);
    if (!row) return { ok: false, error: 'not found' };
    if (!row.publicUrl) return { ok: false, error: 'not ready' };
    // QR generation omitted; return URL (and qrB64 if you add a generator)
    return { ok: true, url: row.publicUrl, qrB64: '' };
}

/** ===== Default / Archive ===== */
function setDefaultEvent(key) {
    const ss = getOrCreateControl_();
    const sh = ss.getSheetByName('Events');
    const range = sh.getDataRange().getValues();
    const headers = range[0];
    const colDefault = headers.indexOf('isDefault') + 1;
    const colId = headers.indexOf('id') + 1;
    const colSlug = headers.indexOf('slug') + 1;
    if (colDefault <= 0) return { ok: false, error: 'missing column isDefault' };

    for (let r = 2; r <= sh.getLastRow(); r++) {
        const rowId = sh.getRange(r, colId).getValue();
        const rowSlug = sh.getRange(r, colSlug).getValue();
        const on = (rowId === key || rowSlug === key);
        sh.getRange(r, colDefault).setValue(!!on);
    }
    SpreadsheetApp.flush();
    bustEventsCache_();
    return { ok: true };
}

function archiveEvent(key) {
    const ss = getOrCreateControl_();
    const sh = ss.getSheetByName('Events');
    const range = sh.getDataRange().getValues();
    const headers = range[0];
    const idx = findRowIndexByKey_(headers, range, key);
    if (idx <= 0) return { ok: false, error: 'not found' };
    sh.deleteRow(idx + 1); // +1 for header row
    SpreadsheetApp.flush();
    bustEventsCache_();
    return { ok: true };
}

/** ===== Helpers: control row CRUD ===== */
function findEventRowByKey_(key) {
    const ss = getOrCreateControl_();
    const sh = ss.getSheetByName('Events');
    const range = sh.getDataRange().getValues();
    const headers = range[0];
    for (let r = 1; r < range.length; r++) {
        const obj = toObj_(headers, range[r]);
        if (obj.id === key || obj.slug === key) return obj;
    }
    return null;
}

function findRowIndexByKey_(headers, data, key) {
    const colId = headers.indexOf('id');
    const colSlug = headers.indexOf('slug');
    for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if ((colId >= 0 && row[colId] === key) || (colSlug >= 0 && row[colSlug] === key)) return r;
    }
    return -1;
}

function upsertRow_(obj) {
    const ss = getOrCreateControl_();
    const sh = ss.getSheetByName('Events');
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

    const data = sh.getDataRange().getValues();
    const idx = findRowIndexByKey_(headers, data, obj.id || obj.slug);
    const targetRow = (idx >= 1) ? idx + 1 : sh.getLastRow() + 1;

    const rowArr = [];
    for (let i = 0; i < headers.length; i++) {
        const k = headers[i];
        rowArr.push(Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : '');
    }
    sh.getRange(targetRow, 1, 1, headers.length).setValues([rowArr]);
}

/** ===== Utilities ===== */
function bustEventsCache_() {
    PropertiesService.getScriptProperties().setProperty(
        'nu_events_etag_salt',
        String(Math.random()) + ':' + Date.now()
    );
}

function computeEtag_(items) {
    const salt = PropertiesService.getScriptProperties().getProperty('nu_events_etag_salt') || '';
    const json = JSON.stringify(items || []);
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, json + '|' + salt);
    return Utilities.base64Encode(raw);
}

function todayISO_() {
    const d = new Date();
    const y = d.getFullYear();
    const m = ('' + (d.getMonth() + 1)).padStart(2, '0');
    const dd = ('' + d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
}
function todayTimeISO_() {
    return new Date().toISOString().replace('Z', '');
}

function normalizeDateISO_(v) {
    if (!v) return todayISO_();
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return todayISO_();
    return d.toISOString().slice(0, 10);
}

function normEnum_(v, allowed) {
    const s = String(v || '').trim().toLowerCase();
    return allowed.indexOf(s) >= 0 ? s : allowed[0];
}

function slugify_(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 48);
}

function uniqueSlug_(base) {
    const out = readEventsIndex_();
    const taken = new Set(out.items.map(function (it) { return (it.slug || '').toLowerCase(); }));
    if (!taken.has(base)) return base;
    for (var i = 2; i < 9999; i++) {
        var candidate = (base + '-' + i).slice(0, 48);
        if (!taken.has(candidate)) return candidate;
    }
    return base + '-' + Utilities.getUuid().slice(0, 4);
}

function genId_() {
    return 'ev_' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function makeTag_(name, dateISO, id) {
    const n = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 12);
    const d = (dateISO || todayISO_()).replace(/-/g, '');
    return n + '-' + d + '-' + String(id || '').slice(-4);
}

function escHtml_(s) {
    return String(s).replace(/[&<>\"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
}

/************************************************************
* v4.1 Audit Endpoints (visualized by Status.html)
************************************************************/

/** Public entry: runs all audits and returns a structured report */
function auditDeep() {
    const secs = [];
    try { secs.push(auditRouter_()); } catch (e) { secs.push(sectionErr_('Router', e)); }
    try { secs.push(auditControlSheet_()); } catch (e) { secs.push(sectionErr_('Control Sheet', e)); }
    try { secs.push(auditProvisionInvariants_()); } catch (e) { secs.push(sectionErr_('Provision Invariants', e)); }
    try { secs.push(auditEventsCache_()); } catch (e) { secs.push(sectionErr_('ETag / Cache', e)); }
    try { secs.push(auditClientFiles_()); } catch (e) { secs.push(sectionErr_('Client Files', e)); }

    return {
        ok: secs.every(function (s) { return s.ok; }),
        build: BUILD_ID,
        generatedAt: todayTimeISO_(),
        sections: secs
    };
}

/** ---------- Sections ---------- */

function auditRouter_() {
    const title = 'Router';
    const checks = [];
    ['admin', 'public', 'display', 'poster', 'status'].forEach(function (p) {
        checks.push(okCheck_('route:' + p, 'Route "' + p + '" registered', true));
    });
    checks.push(okCheck_('tmpl:appTitle', 'Template var appTitle provided', true));
    checks.push(okCheck_('tmpl:BUILD_ID', 'Template var BUILD_ID provided', true));
    return finalizeSection_(title, checks);
}

function auditControlSheet_() {
    const title = 'Control Sheet';
    const checks = [];
    const ss = getOrCreateControl_();
    const sh = ss.getSheetByName('Events');
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    CONTROL_HEADERS.forEach(function (h) {
        const present = headers.indexOf(h) >= 0;
        checks.push(statusCheck_('hdr:' + h, 'Header "' + h + '" present', present ? 'green' : 'red', present ? '' : 'Missing column'));
    });
    checks.push(okCheck_('sheet:name', 'Sheet "Events" exists', !!sh));
    return finalizeSection_(title, checks);
}

function auditProvisionInvariants_() {
    const title = 'Provision Invariants';
    const checks = [];
    // Create a temp event, drive it forward, then archive it
    const name = 'AUDIT-' + Utilities.getUuid().slice(0, 8);
    const res = createEvent({ name: name, startDateISO: todayISO_(), elimType: 'single', seedMode: 'seeded' });
    if (!res || !res.ok) {
        checks.push(statusCheck_('create', 'Create event succeeds', 'red', (res && res.error) || 'create failed'));
        return finalizeSection_(title, checks);
    }

    var id = res.item.id;

    // Step 1: workbook
    var s1 = provisionStep(id);
    checks.push(okCheck_('prov:step1', 'Provision step 1 ok', !!s1 && !!s1.ok));
    var st1 = getProvisionStatus(id);
    var wready = st1 && st1.ok && (st1.status === STATUS.WORKBOOK_READY || st1.status === STATUS.LINKS_READY);
    checks.push(statusCheck_('prov:wready', 'Status >= WORKBOOK_READY after step1', wready ? 'green' : 'red', wready ? '' : 'not advanced'));

    // Step 2: links (idempotent calls)
    provisionStep(id);
    provisionStep(id);
    var st2 = getProvisionStatus(id);
    var row = findEventRowByKey_(id);
    var urlsPresent = !!(row && row.publicUrl && row.displayUrl);
    var linksReady = st2 && st2.ok && st2.status === STATUS.LINKS_READY;
    checks.push(statusCheck_('prov:links', 'LINKS_READY implies publicUrl/displayUrl assigned',
        (linksReady && urlsPresent) ? 'green' : (linksReady ? 'yellow' : 'yellow'),
        urlsPresent ? '' : 'urls missing'));

    // Cleanup
    archiveEvent(id);

    return finalizeSection_(title, checks);
}

function auditEventsCache_() {
    const title = 'ETag / Cache';
    const checks = [];
    var r1 = getEventsSafe(null);
    var ok1 = !!r1 && !!r1.ok && !!r1.etag;
    checks.push(statusCheck_('etag:first', 'getEventsSafe(null) ok', ok1 ? 'green' : 'red', ok1 ? '' : 'missing etag/ok'));
    var r2 = getEventsSafe(ok1 ? r1.etag : null);
    var notMod = !!r2 && !!r2.notModified;
    checks.push(statusCheck_('etag:notmod', 'getEventsSafe(etag) returns notModified', notMod ? 'green' : 'red', notMod ? '' : 'no notModified'));
    return finalizeSection_(title, checks);
}

function auditClientFiles_() {
    const title = 'Client Files';
    const checks = [];
    var mustHave = {
        'Admin': [
            '#eventName', '#eventDate', '#elimType', '#seedMode',
            '#btnCreateEvent', '#chooseEvent', '#btnOpenPublic', '#btnOpenTV', '#btnCopyLink'
        ],
        'Public': ['#title', '#date', '#flow', '#elim', '#seed', '#scheduleTbl', '#standingsTbl', '#bracketWrap'],
        'Display': ['#title', '#scheduleTbl', '#standingsTbl', '#bracketWrap'],
        'Poster': ['#posterTitle', '#eventDate', '#qrPublic', '#publicUrlLabel', '#qrForm', '#formUrlLabel'],
        'Styles': ['.badge', '.toast', '.table', '.pfbar']
    };

    Object.keys(mustHave).forEach(function (name) {
        var html = getFileContentSafe_(name);
        var present = !!html;
        checks.push(statusCheck_('file:' + name, 'File "' + name + '.html" present', present ? 'green' : 'red', present ? '' : 'missing'));
        if (present) {
            mustHave[name].forEach(function (sel) {
                var found = (html.indexOf(sel.replace(/"/g, '\\"')) >= 0) || (html.indexOf(sel) >= 0);
                checks.push(statusCheck_('sel:' + name + ':' + sel, '"' + name + '" contains selector ' + sel, found ? 'green' : 'red', found ? '' : 'not found'));
            });
        }
    });
    return finalizeSection_(title, checks);
}

/** ---------- Audit helpers ---------- */
function getFileContentSafe_(name) {
    try { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
    catch (e) { return ''; }
}
function okCheck_(id, label, cond) { return { id: id, label: label, status: (cond ? 'green' : 'red'), detail: (cond ? '' : 'failed') }; }
function statusCheck_(id, label, status, detail) { return { id: id, label: label, status: status, detail: String(detail || '') }; }

function finalizeSection_(title, checks) {
    var sevOrder = { red: 3, yellow: 2, green: 1 };
    var worst = 'green';
    for (var i = 0; i < checks.length; i++) {
        var s = checks[i].status || 'green';
        if (sevOrder[s] > sevOrder[worst]) worst = s;
    }
    return { title: title, ok: worst !== 'red', severity: worst, checks: checks };
}
function sectionErr_(title, err) {
    return { title: title, ok: false, severity: 'red', checks: [{ id: 'error', label: title + ' threw', status: 'red', detail: String(err) }] };
}
