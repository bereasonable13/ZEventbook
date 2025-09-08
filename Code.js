/**** NextUp · Code.gs (Path C, Rev with Flow + Import + DocLock)
* Server-side for:
* - Event CRUD (+ slugify + uniqueness + backfill + idempotent create)
* - Sheet header hardening & auto-migration (flow-aware)
* - Signup Form creation & Seed helper
* - Import pipeline (CSV + Google Sheet URL) with idempotency + dedupe
* - Schedule scaffold + result recording + standings
* - Bracket generation (Single; Double placeholder) — flow-gated
* - Public bundle (cache) + share links (Public/Display/Poster) + QR
* - Rate limiting, explicit error codes, diagnostics log
* - Health/status endpoint + cache warming
* - Onboarding state (Admin banner)
* - Routing: Public / Display / Admin / Poster / Status (JSON)
****/

// ---------- Constants ----------
const SH = Object.freeze({
    EVENTS: 'Events',
    SIGNUPS_PREFIX: 'signups_',
    SCHED_PREFIX: 'schedule_',
    BRACKET_PREFIX: 'bracket_',
    LOGS: 'Logs',
    DIAG: 'Diagnostics',
});

const FLOW = Object.freeze({
    SEASON_ONLY: 'SEASON_ONLY', // schedule + standings, no bracket
    SEASON_TOURNEY: 'SEASON_TOURNEY', // schedule + standings + bracket
    TOURNEY_ONLY: 'TOURNEY_ONLY', // bracket only (entrants via signups)
    REGISTRATION: 'REGISTRATION', // signups only (waiting list / interest)
});

const ELIM = Object.freeze({ SINGLE: 'SINGLE', DOUBLE: 'DOUBLE' });
const SEEDMODE = Object.freeze({ RANDOM: 'RANDOM', SEEDED: 'SEEDED' });

const CACHE_TTL_SEC = 45;
const WARM_TTL_SEC = 10 * 60;
const APP_TITLE = 'NextUp';
const BUILD_ID = 'nextup-v2.3-import';

// ---------- Error codes ----------
const ERR = Object.freeze({
    DUP_SLUG: 'EVENTS/DUPLICATE_SLUG',
    EVENT_NOT_FOUND: 'EVENTS/NOT_FOUND',
    BAD_INPUT: 'COMMON/BAD_INPUT',
    RL: 'COMMON/RATE_LIMITED',
    SHEET_MISSING: 'SHEET/MISSING',
    SHEET_SHAPE: 'SHEET/HEADER_MISMATCH',
    BRACKET_NO_ENTRANTS: 'BRACKET/NO_ENTRANTS',
    BRACKET_SEEDS: 'BRACKET/SEEDS_INVALID',
    BRACKET_UNSUPPORTED_FLOW: 'BRACKET/UNSUPPORTED_FLOW',
    SCHEDULE_UNSUPPORTED_FLOW: 'SCHEDULE/UNSUPPORTED_FLOW',
    IMPORT_EMPTY: 'IMPORT/EMPTY',
    IMPORT_SHEET_OPEN: 'IMPORT/SHEET_OPEN_FAILED',
});

// ---------- Utilities ----------
function nowISO() { return new Date().toISOString(); }
function shortId(uuid) { return String(uuid).split('-')[0]; }
function safeGetUrl_() { try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; } }
function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function slugify_(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // accents
        .replace(/[^a-z0-9]+/g, '-') // non word
        .replace(/^-+|-+$/g, '') // trim dashes
        .replace(/-{2,}/g, '-'); // collapse
}

function eventSlug_(name, date) { return slugify_(`${name || ''}-${date || ''}`); }

function makeError_(code, msg, meta) {
    const payload = { code, message: msg || code, meta: meta || null };
    throw new Error(JSON.stringify(payload));
}

function parseMaybeErr_(e) {
    try { const o = JSON.parse(String(e && e.message || e)); if (o && o.code) return o; } catch (_) { }
    return { code: 'COMMON/ERROR', message: String(e && e.message || e) };
}

// Script-wide lock (coarse)
function _withLock(fn) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20 * 1000);
    try { return fn(); } finally { try { lock.releaseLock(); } catch (_) { } }
}

// Document lock (serialize spreadsheet writers)
function _withDocLock(waitMs, fn) {
    const lock = LockService.getDocumentLock();
    lock.waitLock(Math.max(1000, waitMs || 20000));
    try { return fn(); } finally { try { lock.releaseLock(); } catch (_) { } }
}

// Basic global rate limit bucket
function _rateLimit_(bucket, windowSec) {
    const cache = CacheService.getScriptCache();
    const key = `RL_${bucket}`;
    if (cache.get(key)) makeError_(ERR.RL, `Too many requests: ${bucket}`);
    cache.put(key, '1', Math.max(1, Math.min(30, windowSec || 3)));
}

// Idempotency guard: if seen key recently, optionally return resolver()
function _idempotent_(key, ttlSec, resolverFn) {
    const cache = CacheService.getScriptCache();
    const ckey = `IDEMP_${key}`;
    const seen = cache.get(ckey);
    if (seen) return resolverFn && resolverFn();
    cache.put(ckey, '1', Math.max(5, Math.min(3600, ttlSec || 60)));
    return null;
}

// ---------- Spreadsheet binding ----------
function ss() {
    const sp = PropertiesService.getScriptProperties();
    const stored = sp.getProperty('SPREADSHEET_ID');
    if (stored) { try { return SpreadsheetApp.openById(stored); } catch (e) { } }
    const active = SpreadsheetApp.getActive();
    sp.setProperty('SPREADSHEET_ID', active.getId());
    return active;
}

// ---------- Optional logging ----------
function logsEnabled_() { return String(PropertiesService.getScriptProperties().getProperty('LOGS_ENABLED') || '') === '1'; }

function logEvent_(level, msg, meta) {
    if (!logsEnabled_()) return;
    const sh = ss().getSheetByName(SH.LOGS) || ss().insertSheet(SH.LOGS);
    if (sh.getLastRow() === 0) sh.appendRow(['ts', 'level', 'msg', 'json']);
    sh.appendRow([nowISO(), level, String(msg || ''), meta ? JSON.stringify(meta) : '']);
}

function logDiag_(name, ok, meta) {
    const sh = ss().getSheetByName(SH.DIAG) || ss().insertSheet(SH.DIAG);
    if (sh.getLastRow() === 0) sh.appendRow(['ts', 'name', 'ok', 'json']);
    sh.appendRow([nowISO(), name, !!ok, meta ? JSON.stringify(meta) : '']);
}

// ---------- Routing ----------
function doGet(e) {
    const p = (e && e.parameter) || {};
    const viewKey = String(p.view || p.mode || '').toLowerCase();

    // JSON status endpoint
    if (viewKey === 'status') {
        const res = ContentService.createTextOutput(JSON.stringify(getStatus()))
            .setMimeType(ContentService.MimeType.JSON);
        return res;
    }

    const templateFile =
        viewKey === 'admin' || p.admin === '1' ? 'Admin' :
            viewKey === 'display' || p.display === '1' ? 'Display' :
                viewKey === 'poster' || p.poster === '1' ? 'Poster' :
/* default */ 'Public';

    // Warm caches defensively (ignore failure)
    try { warmCaches(false); } catch (_) { }

    const t = HtmlService.createTemplateFromFile(templateFile);
    t.appTitle = APP_TITLE;
    // Support either eventId or slug
    const slug = p.slug || '';
    let eventId = p.eventId || p.event || '';
    if (!eventId && slug) {
        const found = getEventBySlug_(slug);
        eventId = found ? found.eventId : '';
    }
    t.eventId = eventId;
    t.tv = String(p.tv || '') === '1';
    return t.evaluate()
        .setTitle(APP_TITLE)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Touch Events sheet at load
try { getEventsSheet_(); verifyAll_(); } catch (_) { }

// ---------- Events schema (V2.2) + migration/backfill ----------
const EVENTS_SCHEMA_V2 = [
    'eventId', 'sid', 'slug', 'name', 'type', 'status',
    'startDate', 'endDate',
    'flow', 'weeks', 'elimType', 'seedMode',
    'isDefault',
    'publicUrl', 'displayUrl', 'adminUrl', 'formUrl',
    'signupSheet', 'scheduleSheet', 'bracketSheet',
    'createdAt', 'updatedAt'
];

const EVENTS_SCHEMA_V1 = [
    'eventId', 'name', 'date', 'flow', 'weeks', 'elimType', 'seedMode', 'isDefault',
    'publicUrl', 'formUrl', 'signupSheet', 'scheduleSheet', 'bracketSheet',
    'createdAt', 'updatedAt'
];

function getEventsSheet_() {
    const sheet = ss().getSheetByName(SH.EVENTS) || ss().insertSheet(SH.EVENTS);
    if (sheet.getLastRow() === 0) { sheet.appendRow(EVENTS_SCHEMA_V2); return sheet; }

    const hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (hdr.join() === EVENTS_SCHEMA_V2.join()) {
        backfillSlugs_(); // ensure slugs populated for legacy rows
        return sheet;
    }

    // v1 -> v2 migration
    if (hdr.join() === EVENTS_SCHEMA_V1.join()) {
        const rows = sheet.getLastRow() > 1
            ? sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues() : [];
        sheet.clear(); sheet.appendRow(EVENTS_SCHEMA_V2);
        const mapped = rows.map(r => {
            const v1 = Object.fromEntries(EVENTS_SCHEMA_V1.map((k, i) => [k, r[i]]));
            const sid = shortId(v1.eventId);
            const name = v1.name || '';
            const date = v1.date || '';
            const slug = eventSlug_(name, date);
            const publicUrl = v1.publicUrl || '';
            const displayUrl = publicUrl ? String(publicUrl).replace('view=public', 'view=display') : '';
            const adminUrl = publicUrl ? String(publicUrl).replace('view=public', 'view=admin') : '';
            return [
                v1.eventId, sid, slug, name, 'event', 'active',
                v1.date || '', '',
                v1.flow || FLOW.TOURNEY_ONLY, v1.weeks || 0, v1.elimType || ELIM.SINGLE, v1.seedMode || SEEDMODE.RANDOM,
                String(v1.isDefault) === 'true',
                publicUrl, displayUrl, adminUrl, v1.formUrl || '',
                v1.signupSheet || '', v1.scheduleSheet || '', v1.bracketSheet || '',
                v1.createdAt || nowISO(), v1.updatedAt || nowISO()
            ];
        });
        if (mapped.length) sheet.getRange(2, 1, mapped.length, EVENTS_SCHEMA_V2.length).setValues(mapped);
        return sheet;
    }

    // Unknown header -> reset to V2 and attempt salvage (best-effort)
    const all = sheet.getDataRange().getValues();
    sheet.clear(); sheet.appendRow(EVENTS_SCHEMA_V2);
    if (all.length > 1) {
        for (let i = 1; i < all.length; i++) {
            const name = all[i][1] || '';
            const date = all[i][2] || '';
            const eventId = Utilities.getUuid();
            const sid = shortId(eventId);
            const slug = eventSlug_(name, date);
            sheet.appendRow([eventId, sid, slug, name, 'event', 'active', date, '', FLOW.TOURNEY_ONLY, 0, ELIM.SINGLE, SEEDMODE.RANDOM, false, '', '', '', '', `${SH.SIGNUPS_PREFIX}${sid}`, '', `${SH.BRACKET_PREFIX}${sid}`, nowISO(), nowISO()]);
        }
    }
    return sheet;
}

function backfillSlugs_() {
    const s = ss().getSheetByName(SH.EVENTS);
    if (!s || s.getLastRow() < 2) return;
    const hdr = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    const slugIdx = hdr.indexOf('slug') + 1;
    const nameIdx = hdr.indexOf('name') + 1;
    const dateIdx = (hdr.indexOf('startDate') + 1) || (hdr.indexOf('date') + 1);
    for (let r = 2; r <= s.getLastRow(); r++) {
        const curSlug = slugIdx ? String(s.getRange(r, slugIdx).getValue() || '') : '';
        const name = nameIdx ? String(s.getRange(r, nameIdx).getValue() || '') : '';
        const date = dateIdx ? String(s.getRange(r, dateIdx).getValue() || '') : '';
        if (!curSlug && (name || date)) {
            const slug = eventSlug_(name, date);
            s.getRange(r, slugIdx).setValue(slug);
        }
    }
}

// ---------- Table helpers ----------
function readTable_(sheet) {
    const lr = sheet.getLastRow(), lc = sheet.getLastColumn();
    if (lr < 2) return [];
    const vals = sheet.getRange(2, 1, lr - 1, lc).getValues();
    const headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
    return vals.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
}

function writeRowByKey_(sheet, keyColName, keyVal, obj) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const keyIdx = headers.indexOf(keyColName) + 1;
    if (keyIdx <= 0) makeError_(ERR.SHEET_SHAPE, 'Key column not found: ' + keyColName);

    const lr = sheet.getLastRow();
    for (let r = 2; r <= lr; r++) {
        if (sheet.getRange(r, keyIdx).getValue() === keyVal) {
            headers.forEach((h, c) => sheet.getRange(r, c + 1).setValue(h in obj ? obj[h] : ''));
            return r;
        }
    }
    const line = headers.map(h => (h in obj ? obj[h] : ''));
    sheet.appendRow(line);
    return sheet.getLastRow();
}

function getEventById_(eventId) {
    const s = getEventsSheet_();
    return readTable_(s).find(r => r.eventId === eventId) || null;
}
function getEventBySlug_(slug) {
    if (!slug) return null;
    const s = getEventsSheet_();
    return readTable_(s).find(r => (r.slug || '') === String(slug)) || null;
}

function ensureTab_(name, headers) {
    const sheet = ss().getSheetByName(name) || ss().insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
    const first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (first.join() !== headers.join()) { sheet.clear(); sheet.appendRow(headers); }
    return sheet;
}

function killCache_(eventId) {
    const cache = CacheService.getScriptCache();
    cache.remove(`PUB_${eventId}`);
    cache.remove('events:list');
}

// ---------- Header Hardening: verify all tabs (flow-aware) ----------
function verifyAll_() {
    const rows = readTable_(getEventsSheet_());
    rows.forEach(r => {
        const sid = r.sid || shortId(r.eventId);
        const flow = r.flow || FLOW.TOURNEY_ONLY;

        // Signups always exists
        const signupsName = r.signupSheet || `${SH.SIGNUPS_PREFIX}${sid}`;
        ensureTab_(signupsName, ['Timestamp', 'TeamOrPlayer', 'Email', 'Phone', 'Notes', 'Seed']);
        if (!r.signupSheet) writeRowByKey_(getEventsSheet_(), 'eventId', r.eventId, { signupSheet: signupsName, updatedAt: nowISO() });

        // Schedule only for SEASON_ONLY or SEASON_TOURNEY
        if (flow === FLOW.SEASON_ONLY || flow === FLOW.SEASON_TOURNEY) {
            const schedName = r.scheduleSheet || `${SH.SCHED_PREFIX}${sid}`;
            ensureTab_(schedName, ['Week', 'Court', 'Time', 'Team A', 'Team B', 'Score A', 'Score B', 'Status']);
            if (!r.scheduleSheet) writeRowByKey_(getEventsSheet_(), 'eventId', r.eventId, { scheduleSheet: schedName, updatedAt: nowISO() });
        }

        // Bracket only for SEASON_TOURNEY or TOURNEY_ONLY
        if (flow === FLOW.SEASON_TOURNEY || flow === FLOW.TOURNEY_ONLY) {
            const brName = r.bracketSheet || `${SH.BRACKET_PREFIX}${sid}`;
            ensureTab_(brName, ['Round', 'Match', 'Slot', 'Seed', 'Team', 'Score', 'Status', 'NextMatchId']);
            if (!r.bracketSheet) writeRowByKey_(getEventsSheet_(), 'eventId', r.eventId, { bracketSheet: brName, updatedAt: nowISO() });
        }
    });
}

// ---------- Public bundle (cached) ----------
function getPublicBundle(eventIdOrSlug) {
    const id = (String(eventIdOrSlug || '').includes('-') && String(eventIdOrSlug).length > 12)
        ? eventIdOrSlug
        : (getEventBySlug_(eventIdOrSlug) || {}).eventId || eventIdOrSlug;

    if (!id) makeError_(ERR.BAD_INPUT, 'Missing event identifier');

    const cache = CacheService.getScriptCache();
    const key = `PUB_${id}`;
    const hit = cache.get(key);
    if (hit) return JSON.parse(hit);

    const event = getEventById_(id);
    if (!event || String(event.status || '') === 'archived') makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');

    const out = {
        eventMeta: {
            eventId: event.eventId,
            slug: event.slug || '',
            name: event.name,
            date: event.startDate || event.date || '',
            flow: event.flow,
            weeks: event.weeks || null,
            elimType: event.elimType,
            seedMode: event.seedMode,
            links: {
                public: event.publicUrl || '',
                tv: event.displayUrl || (event.publicUrl ? String(event.publicUrl).replace('view=public', 'view=display') : ''),
                form: event.formUrl || ''
            }
        },
        schedule: [],
        standings: [],
        bracket: { rounds: [] },
        counts: { signups: 0 },
        lastUpdated: nowISO(),
    };

    // counts (always)
    const signupsSheet = event.signupSheet && ss().getSheetByName(event.signupSheet);
    if (signupsSheet) out.counts.signups = Math.max(0, signupsSheet.getLastRow() - 1);

    // schedule + standings (only if scheduleSheet exists)
    if (event.scheduleSheet) {
        const sch = ss().getSheetByName(event.scheduleSheet);
        if (sch && sch.getLastRow() > 1) out.schedule = readTable_(sch);
        out.standings = computeStandings(event.eventId);
    }

    // bracket (only if bracketSheet exists)
    if (event.bracketSheet) out.bracket = readBracket_(event.bracketSheet);

    cache.put(key, JSON.stringify(out), CACHE_TTL_SEC);
    return out;
}

// ---------- Events (list/create/update/default/archive) ----------
function _eventToLite_(r) {
    return {
        eventId: r.eventId,
        sid: r.sid || shortId(r.eventId),
        slug: r.slug || '',
        name: r.name || '(unnamed)',
        type: r.type || 'event',
        status: r.status || 'active',
        date: r.startDate || r.date || '',
        flow: r.flow || '',
        weeks: r.weeks || null,
        elimType: r.elimType || '',
        seedMode: r.seedMode || '',
        isDefault: String(r.isDefault) === 'true',
        publicUrl: r.publicUrl || '',
        displayUrl: r.displayUrl || '',
        adminUrl: r.adminUrl || '',
        formUrl: r.formUrl || '',
        counts: {
            signups: (function () {
                const s = r.signupSheet && ss().getSheetByName(r.signupSheet);
                return s ? Math.max(0, s.getLastRow() - 1) : 0;
            })()
        },
        updatedAt: r.updatedAt
    };
}

function getEvents() {
    const cache = CacheService.getScriptCache();
    const k = 'events:list';
    const hit = cache.get(k);
    if (hit) return JSON.parse(hit);

    const s = getEventsSheet_();
    const rows = readTable_(s).filter(r => String(r.status || 'active') !== 'archived');

    // Backfill slugs lazily if needed
    rows.forEach(r => {
        if (!r.slug) {
            const slug = eventSlug_(r.name, r.startDate || r.date || '');
            writeRowByKey_(s, 'eventId', r.eventId, Object.assign({}, r, { slug, updatedAt: nowISO() }));
        }
    });

    const out = rows.map(_eventToLite_);
    cache.put(k, JSON.stringify(out), 60);
    return out;
}

function getEventsBasic() {
    try { return (getEvents() || []).map(r => ({ id: r.eventId, name: r.name, date: r.date, flow: r.flow, elimType: r.elimType, seedMode: r.seedMode, isDefault: r.isDefault })); }
    catch (e) {
        const s = getEventsSheet_(); return readTable_(s).map(r => ({ id: r.eventId, name: r.name, date: r.startDate || r.date || '', flow: r.flow, elimType: r.elimType, seedMode: r.seedMode, isDefault: String(r.isDefault) === 'true' }));
    }
}

function createEvent(payload) {
    return _withLock(() => {
        _rateLimit_('createEvent', 3);
        const p = payload || {};
        const name = String(p.name || '').trim();
        const startDate = String(p.startDate || p.date || '').trim();
        const endDate = p.endDate ? String(p.endDate).trim() : '';
        if (!name) makeError_(ERR.BAD_INPUT, 'Event name is required.');
        if (!startDate) makeError_(ERR.BAD_INPUT, 'Event date/startDate is required.');

        const flow = p.flow || FLOW.TOURNEY_ONLY;
        const weeks = Number(p.weeks || 0);
        const elimType = p.elimType || ELIM.SINGLE;
        const seedMode = p.seedMode || SEEDMODE.RANDOM;
        const type = p.type || 'event';
        const status = 'active';

        const slug = eventSlug_(name, startDate);

        // Idempotency: same slug within 60s resolves to existing
        const idemKey = `create:${slug}`;
        const idemHit = _idempotent_(idemKey, 60, () => {
            const existing = getEventBySlug_(slug);
            if (existing) return existing;
            return null;
        });
        if (idemHit) return idemHit;

        // Uniqueness: slug must be unique
        if (getEventBySlug_(slug)) makeError_(ERR.DUP_SLUG, `Duplicate slug "${slug}"`);

        const eventId = Utilities.getUuid();
        const sid = shortId(eventId);
        const base = safeGetUrl_();
        const publicUrl = base ? `${base}?view=public&eventId=${encodeURIComponent(eventId)}&slug=${encodeURIComponent(slug)}` : '';
        const displayUrl = base ? `${base}?view=display&eventId=${encodeURIComponent(eventId)}&tv=1&slug=${encodeURIComponent(slug)}` : '';
        const adminUrl = base ? `${base}?view=admin&eventId=${encodeURIComponent(eventId)}` : '';

        // Create only the tabs required by the chosen flow
        const createdTabs = [];
        try {
            // Signups always
            const signupsSheet = `${SH.SIGNUPS_PREFIX}${sid}`;
            ensureTab_(signupsSheet, ['Timestamp', 'TeamOrPlayer', 'Email', 'Phone', 'Notes', 'Seed']); createdTabs.push(signupsSheet);

            // Schedule iff flow includes a season
            let scheduleSheet = '';
            if (flow === FLOW.SEASON_ONLY || flow === FLOW.SEASON_TOURNEY) {
                scheduleSheet = `${SH.SCHED_PREFIX}${sid}`;
                ensureTab_(scheduleSheet, ['Week', 'Court', 'Time', 'Team A', 'Team B', 'Score A', 'Score B', 'Status']);
                createdTabs.push(scheduleSheet);
            }

            // Bracket iff flow includes a tournament
            let bracketSheet = '';
            if (flow === FLOW.SEASON_TOURNEY || flow === FLOW.TOURNEY_ONLY) {
                bracketSheet = `${SH.BRACKET_PREFIX}${sid}`;
                ensureTab_(bracketSheet, ['Round', 'Match', 'Slot', 'Seed', 'Team', 'Score', 'Status', 'NextMatchId']);
                createdTabs.push(bracketSheet);
            }

            const now = nowISO();
            const row = {
                eventId, sid, slug, name, type, status,
                startDate, endDate,
                flow, weeks, elimType, seedMode,
                isDefault: false,
                publicUrl, displayUrl, adminUrl, formUrl: '',
                signupSheet: signupsSheet, scheduleSheet, bracketSheet,
                createdAt: now, updatedAt: now
            };
            writeRowByKey_(getEventsSheet_(), 'eventId', eventId, row);

            // set default if none exists yet
            if (!getEvents().some(e => e.isDefault)) setDefaultEvent(eventId, true);

            // ===== [IMPORT+] CSV and/or Google Sheet URL into signups =====
            try {
                if (p && p.source === 'import' && (p.importCsv || p.sheetUrl)) {
                    let imported = [];

                    if (p.importCsv) imported = imported.concat(parseCsvToList_(p.importCsv));

                    if (p.sheetUrl) {
                        const sheetRes = ingestSheet(p.sheetUrl);
                        if (sheetRes.ok) imported = imported.concat(sheetRes.teams || []);
                        else logEvent_('warn', 'ingestSheet warn', { eventId, error: sheetRes.error });
                    }

                    // Normalize + de-duplicate (within batch)
                    const seen = new Set();
                    imported = imported
                        .map(s => String(s || '').trim())
                        .filter(s => s && !seen.has(s) && seen.add(s));

                    if (imported.length) {
                        // Idempotency: skip if this exact roster was recently imported for this event (5 min)
                        const sig = _hashNames_(imported);
                        const dedupHit = _idempotent_(`import:${eventId}:${sig}`, 300, () => ({ ok: true, idempotent: true }));
                        if (!dedupHit) {
                            const addRes = addSignupsForEvent_(eventId, imported);
                            logEvent_('info', 'imported signups', { eventId, count: addRes.count, skipped: addRes.skipped });
                            try { ensureSeedColumn(eventId); } catch (_) { }
                            writeRowByKey_(getEventsSheet_(), 'eventId', eventId, { updatedAt: nowISO() });
                        } else {
                            logEvent_('info', 'import dedup hit', { eventId, sig });
                        }
                    }
                }
            } catch (impErr) {
                logEvent_('warn', 'import flow non-fatal', { eventId, err: parseMaybeErr_(impErr) });
            }
            // ===== [/IMPORT+] =====

            killCache_(eventId);
            logEvent_('info', 'createEvent', { eventId, slug, name, flow });
            return row;
        } catch (err) {
            createdTabs.forEach(n => { const sh = ss().getSheetByName(n); if (sh) ss().deleteSheet(sh); });
            throw err;
        }
    });
}

function updateEvent(eventId, patch) {
    return _withLock(() => {
        _rateLimit_('updateEvent', 2);
        const e = getEventById_(eventId);
        if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');
        const allowed = ['name', 'type', 'status', 'startDate', 'endDate', 'flow', 'weeks', 'elimType', 'seedMode', 'formUrl', 'isDefault'];
        const now = nowISO();
        const toWrite = { updatedAt: now };
        allowed.forEach(k => { if (patch && k in patch) toWrite[k] = patch[k]; });

        // If name or date changes, recompute slug and enforce uniqueness
        if (('name' in toWrite) || ('startDate' in toWrite)) {
            const nextName = 'name' in toWrite ? toWrite.name : e.name;
            const nextDate = 'startDate' in toWrite ? toWrite.startDate : (e.startDate || e.date || '');
            const nextSlug = eventSlug_(nextName, nextDate);
            const clash = getEventBySlug_(nextSlug);
            if (clash && clash.eventId !== e.eventId) makeError_(ERR.DUP_SLUG, `Duplicate slug "${nextSlug}"`);
            toWrite.slug = nextSlug;
        }

        // Flow changes do NOT auto-create/delete tabs here; verifyAll_ on boot creates needed ones.
        // Single-default invariant
        if ('isDefault' in toWrite) {
            setDefaultEvent(eventId, !!toWrite.isDefault);
            delete toWrite.isDefault;
        }

        writeRowByKey_(getEventsSheet_(), 'eventId', eventId, Object.assign({}, e, toWrite));
        killCache_(eventId);
        logEvent_('info', 'updateEvent', { eventId, patch: toWrite });
        return getEventById_(eventId);
    });
}

function setDefaultEvent(eventId, isDefault) {
    return _withLock(() => {
        const s = getEventsSheet_();
        const rows = readTable_(s);
        if (!rows.some(r => r.eventId === eventId)) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');
        rows.forEach(r => {
            writeRowByKey_(s, 'eventId', r.eventId, {
                isDefault: r.eventId === eventId ? (isDefault === undefined ? true : !!isDefault) : false,
                updatedAt: nowISO()
            });
        });
        killCache_(eventId);
        logEvent_('info', 'setDefaultEvent', { eventId });
        return { ok: true };
    });
}

function archiveEvent(eventId) { return updateEvent(eventId, { status: 'archived' }); }
function openSheetUrl(eventId) {
    if (eventId && !getEventById_(eventId)) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');
    return ss().getUrl();
}

// ---------- Import helpers ----------
function parseCsvToList_(text) {
    if (!text) return [];
    const raw = String(text).replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
    // If it looks like comma-separated on a single line, split commas too
    if (raw.length === 1 && raw[0].indexOf(',') >= 0) {
        return raw[0].split(',').map(s => s.trim()).filter(Boolean);
    }
    return raw;
}

function _getExistingSignupNames_(signupSheetName) {
    const sh = ss().getSheetByName(signupSheetName);
    if (!sh || sh.getLastRow() < 2) return new Set();
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const idx = headers.indexOf('TeamOrPlayer') + 1;
    if (idx <= 0) return new Set();
    const vals = sh.getRange(2, idx, sh.getLastRow() - 1, 1).getValues();
    const set = new Set();
    vals.forEach(r => { const v = String(r[0] || '').trim(); if (v) set.add(v); });
    return set;
}

function _hashNames_(names) {
    const norm = (names || []).map(s => String(s || '').trim()).filter(Boolean).join('\n');
    const md5 = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, norm);
    return Utilities.base64Encode(md5);
}

// Adds signups with Document lock + dedupe vs existing rows
function addSignupsForEvent_(eventId, names) {
    if (!eventId || !names || !names.length) return { ok: true, count: 0, skipped: 0 };
    const e = getEventById_(eventId);
    if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');

    return _withDocLock(20000, () => {
        const sh = ss().getSheetByName(e.signupSheet);
        if (!sh) makeError_(ERR.SHEET_MISSING, 'Signups sheet missing');

        const lc = sh.getLastColumn();
        const headers = sh.getRange(1, 1, 1, lc).getValues()[0];
        const nameIdx = headers.indexOf('TeamOrPlayer') + 1;
        const tsIdx = headers.indexOf('Timestamp') + 1;
        if (nameIdx <= 0) makeError_(ERR.SHEET_SHAPE, 'Missing TeamOrPlayer column');

        const existing = _getExistingSignupNames_(e.signupSheet);
        const now = new Date();

        const toAdd = [];
        let skipped = 0;
        names.forEach(n => {
            const v = String(n || '').trim();
            if (!v) return;
            if (existing.has(v)) { skipped++; return; }
            const row = new Array(lc).fill('');
            if (tsIdx > 0) row[tsIdx - 1] = now;
            row[nameIdx - 1] = v;
            toAdd.push(row);
            existing.add(v);
        });

        if (toAdd.length) sh.getRange(sh.getLastRow() + 1, 1, toAdd.length, lc).setValues(toAdd);
        return { ok: true, count: toAdd.length, skipped };
    });
}

// Ingest a Google Sheet URL: read first non-empty sheet, first non-empty column
function ingestSheet(url) {
    try {
        if (!url) return { ok: false, error: 'No URL provided' };
        let doc;
        try {
            doc = SpreadsheetApp.openByUrl(url);
        } catch (e1) {
            // Try direct ID extraction
            const id = (function (u) {
                const m = String(u).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                return m ? m[1] : String(u);
            })(url);
            try { doc = SpreadsheetApp.openById(id); } catch (e2) {
                return { ok: false, error: 'Cannot open Sheet (check sharing / URL)' };
            }
        }
        const sheets = doc.getSheets();
        for (let i = 0; i < sheets.length; i++) {
            const sh = sheets[i];
            const lr = sh.getLastRow(), lc = sh.getLastColumn();
            if (lr < 1 || lc < 1) continue;
            const range = sh.getRange(1, 1, Math.min(lr, 2000), Math.min(lc, 10)).getValues(); // guardrails
            // Find first non-empty column
            let col = -1;
            for (let c = 0; c < range[0].length; c++) {
                for (let r = 0; r < range.length; r++) {
                    if (String(range[r][c] || '').trim()) { col = c; break; }
                }
                if (col >= 0) break;
            }
            if (col < 0) continue;
            const names = [];
            for (let r = 0; r < range.length; r++) {
                const v = String(range[r][col] || '').trim();
                if (v) names.push(v);
            }
            // De-duplicate and return
            const seen = new Set(); const out = [];
            names.forEach(n => { if (!seen.has(n)) { seen.add(n); out.push(n); } });
            if (out.length) return { ok: true, teams: out };
        }
        return { ok: false, error: 'No data found in the Sheet' };
    } catch (e) {
        return { ok: false, error: parseMaybeErr_(e).message || 'Unknown error' };
    }
}

// ---------- Signup Form & Seeding ----------
function buildSignupForm(eventId, options) {
    return _withDocLock(20000, () => {
        const e = getEventById_(eventId);
        if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');

        const formTitle = `Signups – ${e.name}`;
        const f = FormApp.create(formTitle);
        f.addTextItem().setTitle('Team or Player Name').setRequired(true);
        if (options && options.email) f.addTextItem().setTitle('Email');
        if (options && options.phone) f.addTextItem().setTitle('Phone');
        if (options && options.notes) f.addParagraphTextItem().setTitle('Notes');
        f.setDestination(FormApp.DestinationType.SPREADSHEET, ss().getId());

        const dest = ss();
        const fr = dest.getSheets().find(sh => /^Form Responses/i.test(sh.getName()));
        if (fr) {
            const existing = dest.getSheetByName(e.signupSheet);
            if (!existing) {
                fr.setName(e.signupSheet);
                ensureSeedColumn(eventId);
            } else {
                fr.setName(`_tmp_delete_${Date.now()}`);
                dest.deleteSheet(fr);
            }
        }

        writeRowByKey_(getEventsSheet_(), 'eventId', eventId, { formUrl: f.getPublishedUrl(), updatedAt: nowISO() });
        logEvent_('info', 'buildSignupForm', { eventId });
        return { ok: true, formUrl: f.getPublishedUrl(), editUrl: f.getEditUrl() };
    });
}

function ensureSeedColumn(eventId) {
    const e = getEventById_(eventId);
    if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');
    const sh = ss().getSheetByName(e.signupSheet);
    if (!sh) makeError_(ERR.SHEET_MISSING, 'Signups sheet missing');
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (!headers.includes('Seed')) sh.getRange(1, headers.length + 1).setValue('Seed');
    return { ok: true };
}

function getSignupCount(eventId) {
    const e = getEventById_(eventId);
    const sh = e && e.signupSheet && ss().getSheetByName(e.signupSheet);
    return sh ? Math.max(0, sh.getLastRow() - 1) : 0;
}

// ---------- Schedule & Standings ----------
function generateSchedule(eventId, weeks) {
    _rateLimit_('generateSchedule', 2);
    return _withDocLock(20000, () => {
        const e = getEventById_(eventId);
        if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');

        if (!(e.flow === FLOW.SEASON_ONLY || e.flow === FLOW.SEASON_TOURNEY)) {
            makeError_(ERR.SCHEDULE_UNSUPPORTED_FLOW, 'This event type does not include a schedule.');
        }

        const schedName = e.scheduleSheet || `${SH.SCHED_PREFIX}${shortId(e.eventId)}`;
        const sched = ensureTab_(schedName, ['Week', 'Court', 'Time', 'Team A', 'Team B', 'Score A', 'Score B', 'Status']);

        const w = Number(weeks || e.weeks || 0);
        if (w > 0 && sched.getLastRow() < 2) {
            const rows = [];
            for (let i = 1; i <= w; i++) rows.push([i, '', '', '', '', '', '', 'scheduled']);
            sched.getRange(2, 1, rows.length, 8).setValues(rows);
        }

        if (weeks && String(weeks) !== String(e.weeks)) {
            writeRowByKey_(getEventsSheet_(), 'eventId', e.eventId, { weeks: Number(weeks), scheduleSheet: schedName, updatedAt: nowISO() });
        } else if (!e.scheduleSheet) {
            writeRowByKey_(getEventsSheet_(), 'eventId', e.eventId, { scheduleSheet: schedName, updatedAt: nowISO() });
        }

        killCache_(eventId);
        logEvent_('info', 'generateSchedule', { eventId, weeks: w });
        return { ok: true };
    });
}

function recordResult(eventId, rowNumber, scoreA, scoreB) {
    return _withDocLock(20000, () => {
        const e = getEventById_(eventId);
        if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');
        const sched = ss().getSheetByName(e.scheduleSheet);
        if (!sched) makeError_(ERR.SHEET_MISSING, 'Schedule sheet missing');

        const r = Number(rowNumber);
        sched.getRange(r, 6).setValue(Number(scoreA));
        sched.getRange(r, 7).setValue(Number(scoreB));
        sched.getRange(r, 8).setValue('final');

        killCache_(eventId);
        logEvent_('info', 'recordResult', { eventId, row: r, scoreA, scoreB });
        return { ok: true };
    });
}

function computeStandings(eventId) {
    const e = getEventById_(eventId);
    if (!e) return [];
    const sched = e.scheduleSheet && ss().getSheetByName(e.scheduleSheet);
    if (!sched || sched.getLastRow() < 2) return [];

    const rows = readTable_(sched).filter(r => String(r.Status || '').toLowerCase() === 'final');
    const table = {}; // team -> stats

    function ensureTeam(t) {
        if (!t) return;
        if (!table[t]) table[t] = { Team: t, W: 0, L: 0, PointsFor: 0, PointsAgainst: 0 };
    }

    rows.forEach(r => {
        const A = r['Team A'], B = r['Team B'];
        const SA = Number(r['Score A'] || 0), SB = Number(r['Score B'] || 0);
        ensureTeam(A); ensureTeam(B);
        table[A].PointsFor += SA; table[A].PointsAgainst += SB;
        table[B].PointsFor += SB; table[B].PointsAgainst += SA;
        if (SA > SB) { table[A].W++; table[B].L++; }
        else if (SB > SA) { table[B].W++; table[A].L++; }
    });

    const list = Object.values(table).map(t => {
        const total = t.W + t.L;
        const pct = total ? (t.W / total) : 0;
        return { Team: t.Team, W: t.W, L: t.L, Pct: pct, PointsFor: t.PointsFor, PointsAgainst: t.PointsAgainst };
    });

    list.sort((a, b) => (b.Pct - a.Pct) || (b.PointsFor - a.PointsFor) - (a.PointsAgainst - b.PointsAgainst));
    return list.map((t, i) => Object.assign({ Rank: i + 1 }, t));
}

// ---------- Brackets ----------
function generateBrackets(eventId, opts) {
    _rateLimit_('generateBrackets', 2);
    return _withDocLock(20000, () => {
        const e = getEventById_(eventId);
        if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');

        if (!(e.flow === FLOW.SEASON_TOURNEY || e.flow === FLOW.TOURNEY_ONLY)) {
            makeError_(ERR.BRACKET_UNSUPPORTED_FLOW, 'This event type does not include a tournament bracket.');
        }

        const elimType = (opts && opts.elimType) || e.elimType || ELIM.SINGLE;
        const seedMode = (opts && opts.seedMode) || e.seedMode || SEEDMODE.RANDOM;

        let entrants = [];
        if (e.flow === FLOW.SEASON_TOURNEY) {
            // From standings
            entrants = computeStandings(eventId).map(s => ({ name: s.Team, seed: s.Rank }));
        } else if (e.flow === FLOW.TOURNEY_ONLY) {
            // From signups
            const sign = ss().getSheetByName(e.signupSheet);
            if (!sign) makeError_(ERR.SHEET_MISSING, 'Signups missing');
            const vals = sign.getRange(2, 1, Math.max(0, sign.getLastRow() - 1), sign.getLastColumn()).getValues();
            const head = sign.getRange(1, 1, 1, sign.getLastColumn()).getValues()[0];
            const idxName = head.indexOf('TeamOrPlayer');
            const idxSeed = head.indexOf('Seed');
            entrants = vals.map(r => ({
                name: (r[idxName] || '').toString().trim(),
                seed: idxSeed >= 0 ? Number(r[idxSeed] || '') : ''
            })).filter(x => x.name);
            if (seedMode === SEEDMODE.SEEDED && entrants.some(x => !x.seed)) return { ok: false, reason: 'missing_seeds' };
        }

        if (!entrants.length) makeError_(ERR.BRACKET_NO_ENTRANTS, 'No entrants');

        let seeded;
        if (seedMode === SEEDMODE.SEEDED) {
            const N = entrants.length, sset = new Set(entrants.map(x => Number(x.seed)));
            for (let i = 1; i <= N; i++) if (!sset.has(i)) makeError_(ERR.BRACKET_SEEDS, 'Seeds must be 1..N without gaps');
            seeded = entrants.sort((a, b) => a.seed - b.seed);
        } else {
            seeded = shuffle_(entrants).map((x, i) => ({ name: x.name, seed: i + 1 }));
        }

        const bracketSheet = ss().getSheetByName(e.bracketSheet);
        if (!bracketSheet) makeError_(ERR.SHEET_MISSING, 'Bracket sheet missing');
        const lastRow = bracketSheet.getLastRow();
        if (lastRow > 1) bracketSheet.getRange(2, 1, lastRow - 1, bracketSheet.getLastColumn()).clearContent();

        if (elimType === ELIM.SINGLE) {
            const rows = buildSingleElim_(seeded);
            if (rows.length) bracketSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        } else if (elimType === ELIM.DOUBLE) {
            const rows = buildSingleElim_(seeded).map(r => { r[0] = `WB ${r[0]}`; return r; });
            if (rows.length) bracketSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
            // TODO: add LB mapping
        } else {
            makeError_(ERR.BAD_INPUT, 'Unknown elimination type');
        }

        writeRowByKey_(getEventsSheet_(), 'eventId', e.eventId, { updatedAt: nowISO() });
        killCache_(eventId);
        logEvent_('info', 'generateBrackets', { eventId, elimType, seedMode });
        return { ok: true };
    });
}

function readBracket_(bracketSheetName) {
    const sh = ss().getSheetByName(bracketSheetName);
    if (!sh || sh.getLastRow() < 2) return { rounds: [] };
    const items = readTable_(sh); // {Round,Match,Slot,Seed,Team,Score,Status,NextMatchId}

    const roundsMap = {};
    items.forEach(it => {
        const r = it.Round, m = it.Match;
        roundsMap[r] = roundsMap[r] || {};
        roundsMap[r][m] = roundsMap[r][m] || [];
        roundsMap[r][m].push(it);
    });

    const rounds = Object.keys(roundsMap).sort().map(rname => {
        const matches = Object.keys(roundsMap[rname]).sort((a, b) => Number(a) - Number(b)).map(mid => {
            const slots = roundsMap[rname][mid].sort((a, b) => Number(a.Slot) - Number(b.Slot));
            return {
                match: Number(mid),
                slots: slots.map(s => ({
                    slot: Number(s.Slot), seed: Number(s.Seed || ''), team: s.Team || '',
                    score: s.Score || '', status: s.Status || '', next: s.NextMatchId || ''
                }))
            };
        });
        return { name: rname, matches };
    });

    return { rounds };
}

// ---------- Misc utils for brackets ----------
function shuffle_(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function nextPow2_(n) { let p = 1; while (p < n) p <<= 1; return p; }

function buildSingleElim_(seededEntrants) {
    // rows: ['Round','Match','Slot','Seed','Team','Score','Status','NextMatchId']
    const N = seededEntrants.length;
    const size = nextPow2_(N);
    const positions = seedPositions_(size);
    const seedMap = new Map(seededEntrants.map(x => [x.seed, x.name]));
    const placed = positions.map(seed => ({ seed, name: seedMap.get(seed) || '' }));

    const rows = [];
    const roundsCount = Math.log2(size);
    let matchId = 1;

    // map forward winners
    const nextMap = {};
    for (let r = 1; r <= roundsCount; r++) {
        const matchesThis = size / Math.pow(2, r);
        const startId = matchId;
        const nextStart = matchId + matchesThis;
        for (let m = 0; m < matchesThis; m++) {
            const thisId = startId + m;
            const nextId = nextStart + Math.floor(m / 2);
            nextMap[thisId] = (r === roundsCount) ? '' : nextId;
        }
        matchId += matchesThis;
    }

    matchId = 1;
    let roundTeams = placed;
    for (let r = 1; r <= roundsCount; r++) {
        const roundName = `R${r}`;
        const matchesThis = roundTeams.length / 2;
        for (let i = 0; i < matchesThis; i++) {
            const a = roundTeams[i * 2], b = roundTeams[i * 2 + 1];
            const thisMatch = matchId++;
            rows.push([roundName, thisMatch, 1, a.seed || '', a.name || '', '', '', nextMap[thisMatch] || '']);
            rows.push([roundName, thisMatch, 2, b.seed || '', b.name || '', '', '', nextMap[thisMatch] || '']);
        }
        // placeholders for next round
        roundTeams = new Array(matchesThis).fill({ seed: '', name: '' }).flatMap(x => [x, x]);
    }
    return rows;
}

// Standard single-elim seed positions
function seedPositions_(size) {
    if (size === 1) return [1];
    function pair(arr) {
        const n = arr.length * 2 + 1;
        const res = [];
        for (let i = 0; i < arr.length; i++) { res.push(arr[i]); res.push(n - arr[i]); }
        return res;
    }
    let arr = [1, 2];
    while (arr.length < size) arr = pair(arr);
    return arr.slice(0, size);
}

// ---------- Share + QR ----------
function getShareLinks(eventId, opts) {
    const e = getEventById_(eventId);
    if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');

    const base = safeGetUrl_();
    const utm = (opts && opts.utm) ? opts.utm : null;
    function withUtm(url) {
        if (!utm) return url;
        const u = new URL(url);
        if (utm.campaign) u.searchParams.set('utm_campaign', utm.campaign);
        if (utm.source) u.searchParams.set('utm_source', utm.source);
        if (utm.medium) u.searchParams.set('utm_medium', utm.medium);
        return u.toString();
    }

    const publicUrl = e.publicUrl || (base ? `${base}?view=public&eventId=${encodeURIComponent(e.eventId)}&slug=${encodeURIComponent(e.slug || '')}` : '');
    const displayUrl = e.displayUrl || (base ? `${base}?view=display&eventId=${encodeURIComponent(e.eventId)}&tv=1&slug=${encodeURIComponent(e.slug || '')}` : '');
    const posterUrl = base ? `${base}?view=poster&eventId=${encodeURIComponent(e.eventId)}` : '';
    const formUrl = e.formUrl || '';

    const qrPublicB64 = publicUrl ? _qrToB64_(publicUrl) : '';
    const qrFormB64 = formUrl ? _qrToB64_(formUrl) : '';

    return {
        publicUrl: withUtm(publicUrl),
        displayUrl: withUtm(displayUrl),
        posterUrl: withUtm(posterUrl),
        formUrl: withUtm(formUrl),
        qrPublicB64, qrFormB64
    };
}

// Simple shim used by some clients
function getShareQr(eventId) {
    const links = getShareLinks(eventId);
    return { url: links.publicUrl, qrB64: links.qrPublicB64 };
}

// Faster QR via Charts service (no UrlFetch)
function _qrToB64_(url) {
    try {
        const blob = Charts.newQrCode(url).setSize(256).build().getAs('image/png');
        return Utilities.base64Encode(blob.getBytes());
    } catch (e) {
        // Fallback to UrlFetch if Charts fails (rare)
        try {
            const endpoint = 'https://chart.googleapis.com/chart?cht=qr&chs=512x512&chld=M|0&chl=' + encodeURIComponent(url);
            const res = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true });
            if (res.getResponseCode() !== 200) return '';
            return Utilities.base64Encode(res.getBlob().getBytes());
        } catch (_) { return ''; }
    }
}

// ---------- Admin PIN (kept) ----------
function getPinStatus() {
    const pin = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
    return { isSet: Boolean(pin) };
}
function verifyPin(pin) {
    const sp = PropertiesService.getScriptProperties();
    const input = String(pin || '').trim();
    const stored = String(sp.getProperty('ADMIN_PIN') || '');
    // simple global rate limit
    const cache = CacheService.getScriptCache();
    const key = 'PIN_FAILS';
    const fails = Number(cache.get(key) || '0');
    if (fails >= 5 && stored) return { ok: false, firstSet: false, msg: 'Too many attempts. Try again in a few minutes.' };
    if (!stored) {
        if (input.length < 4) return { ok: false, firstSet: false, msg: 'PIN must be 4+ digits.' };
        sp.setProperty('ADMIN_PIN', input);
        return { ok: true, firstSet: true };
    }
    const ok = (input === stored);
    if (!ok) cache.put(key, String(fails + 1), 5 * 60);
    return { ok, firstSet: false, msg: ok ? '' : 'Incorrect PIN' };
}
function updatePin(newPin) {
    const next = String(newPin || '').trim();
    if (next.length < 4) return { ok: false, msg: 'PIN must be 4+ digits.' };
    PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', next);
    return { ok: true };
}

// ---------- Health / Warming ----------
function getStatus() {
    try {
        const s = getEventsSheet_();
        const events = readTable_(s);
        const active = events.filter(e => String(e.status || 'active') !== 'archived');
        const diag = ss().getSheetByName(SH.LOGS);
        const lastErr = (function () {
            if (!diag || diag.getLastRow() < 2) return null;
            const data = diag.getRange(Math.max(2, diag.getLastRow() - 20), 1, Math.min(20, diag.getLastRow() - 1), 4).getValues();
            const errs = data.filter(r => String(r[1]).toLowerCase() === 'error');
            return errs.length ? errs[errs.length - 1] : null;
        })();
        return {
            ok: true,
            ts: nowISO(),
            app: APP_TITLE,
            build: BUILD_ID,
            events: active.length,
            defaultSet: active.some(e => String(e.isDefault) === 'true'),
            lastError: lastErr ? { ts: lastErr[0], msg: lastErr[2] } : null
        };
    } catch (e) {
        return { ok: false, error: parseMaybeErr_(e), build: BUILD_ID, ts: nowISO() };
    }
}

function warmCaches(force) {
    const cache = CacheService.getScriptCache();
    if (!force && cache.get('WARMED')) return { ok: true, warmed: false };
    const evs = getEvents();
    evs.slice(0, 5).forEach(e => { try { getPublicBundle(e.eventId); } catch (_) { } });
    cache.put('WARMED', '1', WARM_TTL_SEC);
    logDiag_('warmCaches', true, { eventsTried: Math.min(5, evs.length) });
    return { ok: true, warmed: true };
}

// Set up a time-based warm trigger manually by running this once.
function setupWarmTrigger() {
    ScriptApp.newTrigger('warmCaches')
        .timeBased()
        .everyMinutes(15)
        .create();
    return { ok: true };
}

// ---------- Onboarding state ----------
function getOnboardingState() {
    const up = PropertiesService.getUserProperties();
    const seen = String(up.getProperty('ONBOARDING_SEEN') || '') === '1';
    const hasEvent = (getEvents() || []).length > 0;
    return { show: !seen && !hasEvent };
}
function dismissOnboarding() {
    PropertiesService.getUserProperties().setProperty('ONBOARDING_SEEN', '1');
    return { ok: true };
}

// ---------- QA hooks ----------
function qaSmoke() {
    const start = Date.now(), steps = []; function tick(name) { steps.push({ name, t: Date.now() - start }); }
    try {
        const ev = createEvent({ name: `QA ${Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss')}`, startDate: Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'), flow: FLOW.TOURNEY_ONLY, elimType: ELIM.SINGLE, seedMode: SEEDMODE.RANDOM });
        tick('createEvent');
        _seedDemoSignups_(ev.eventId, 4); tick('seedSignups');
        generateBrackets(ev.eventId, { elimType: ELIM.SINGLE, seedMode: SEEDMODE.RANDOM }); tick('generateBrackets');
        const bundle = getPublicBundle(ev.eventId); tick('getPublicBundle');
        archiveEvent(ev.eventId); tick('archive');
        logEvent_('info', 'qaSmoke ok', { eventId: ev.eventId, steps });
        return { ok: true, eventId: ev.eventId, steps, bundle: { hasBracket: (bundle.bracket?.rounds || []).length > 0, counts: bundle.counts } };
    } catch (e) {
        const pe = parseMaybeErr_(e);
        logEvent_('error', 'qaSmoke fail', { error: pe });
        return { ok: false, error: pe, steps: [] };
    }
}

function _seedDemoSignups_(eventId, n) {
    const e = getEventById_(eventId);
    if (!e) makeError_(ERR.EVENT_NOT_FOUND, 'Event not found');
    const sh = ss().getSheetByName(e.signupSheet);
    if (!sh) makeError_(ERR.SHEET_MISSING, 'Signups sheet missing');

    const lc = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lc).getValues()[0];
    const nameIdx = headers.indexOf('TeamOrPlayer') + 1;
    const emailIdx = headers.indexOf('Email') + 1;
    const tsIdx = headers.indexOf('Timestamp') + 1;
    const seedIdx = headers.indexOf('Seed') + 1;

    const rows = [];
    for (let i = 1; i <= n; i++) {
        const row = new Array(lc).fill('');
        if (tsIdx > 0) row[tsIdx - 1] = new Date();
        if (nameIdx > 0) row[nameIdx - 1] = `Team ${i}`;
        if (emailIdx > 0) row[emailIdx - 1] = `team${i}@example.test`;
        if (seedIdx > 0) row[seedIdx - 1] = '';
        rows.push(row);
    }
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, lc).setValues(rows);
}

// ---------- Admin convenience ----------
function refreshPublicCache(eventId) { killCache_(eventId); return { ok: true }; }

// ---------- Simple stubs for early client wiring (kept) ----------
function getSchedule(eventId) { return [{ round: 1, match: 1, teamA: 'A', teamB: 'B', time: 'TBD', court: '1', status: 'scheduled' }]; }
function fetchBracket(eventId) { return { type: 'single', rounds: 1, matches: [{ id: 'm1', a: 'A', b: 'B', score: null }] }; }

// ---------- Diagnostics v3 (structured logs, trends, flakiness, perf, exports) ----------

// Config & sheets
function _diagConfig_() {
  return {
    RESULTS_SHEET: 'DiagResults',
    SUITES_SHEET:  'DiagSuites',
    MAX_TEST_ROWS: 5000,
    MAX_SUITE_ROWS: 2000
  };
}
function _diagSheets_() {
  const cfg = _diagConfig_();
  const tests  = ensureTab_(cfg.RESULTS_SHEET, ['ts','suite','test','ok','ms','type','env','error','meta']);
  const suites = ensureTab_(cfg.SUITES_SHEET,  ['ts','suite','ok','ms','total','passed','failed','env','meta']);
  return { tests, suites, cfg };
}
function _nowMs_(){ return new Date().getTime(); }
function _percentile_(arr, p) {
  const v=(arr||[]).filter(x=>typeof x==='number'&&isFinite(x)).sort((a,b)=>a-b);
  if (!v.length) return 0;
  const i = Math.min(v.length-1, Math.max(0, Math.floor((p/100)*(v.length-1))));
  return v[i];
}
function _bucketErr_(meta){
  try{
    if (!meta) return '';
    const m = typeof meta==='string'? meta : (meta.message || meta.code || '');
    if (!m) return '';
    const s = String(m).toLowerCase();
    if (s.includes('rate')) return 'rate_limit';
    if (s.includes('timeout')) return 'timeout';
    if (s.includes('sheet')&&s.includes('missing')) return 'sheet_missing';
    if (s.includes('dup') && s.includes('slug')) return 'duplicate_slug';
    if (s.includes('not found')) return 'not_found';
    return 'other';
  }catch(_){ return ''; }
}
function _diagLogTest_(suite, test, ok, ms, type, env, meta) {
  const {tests}=_diagSheets_();
  const err = ok ? '' : _bucketErr_(meta);
  tests.appendRow([nowISO(), String(suite||''), String(test||''), !!ok, Number(ms||0), String(type||'unit'), String(env||''), err, meta?JSON.stringify(meta):'']);
}
function _diagLogSuite_(suite, ok, ms, totals, env, meta) {
  const {suites}=_diagSheets_();
  const passed=(totals&&totals.passed)||0, failed=(totals&&totals.failed)||0;
  const total = (totals&&totals.total) || (passed+failed);
  suites.appendRow([nowISO(), String(suite||''), !!ok, Number(ms||0), total, passed, failed, String(env||''), meta?JSON.stringify(meta):'']);
}
function _diagPrune_() {
  const {tests,suites,cfg}=_diagSheets_();
  const lrT = tests.getLastRow(), lrS = suites.getLastRow();
  if (lrT > cfg.MAX_TEST_ROWS) {
    const cut = Math.max(2, lrT - cfg.MAX_TEST_ROWS + 1);
    tests.deleteRows(2, cut-2);
  }
  if (lrS > cfg.MAX_SUITE_ROWS) {
    const cut = Math.max(2, lrS - cfg.MAX_SUITE_ROWS + 1);
    suites.deleteRows(2, cut-2);
  }
}

// Timed test wrapper (drop-in for old _qaAdd_)
function _qaAdd_(arr, name, fn, opts) {
  const t0=_nowMs_();
  let ok=false, meta=null;
  const type=(opts&&opts.type)||'unit';
  const env =(opts&&opts.env)||'default';
  const suite=(opts&&opts.suite)||(arr && arr.__suite)||'(unspecified)';
  try {
    const res = fn();
    ok   = (res && typeof res.ok==='boolean') ? res.ok : !!res;
    meta = (res && res.meta) ? res.meta : res;
  } catch (e) {
    ok=false; meta=parseMaybeErr_(e);
  }
  const ms=_nowMs_()-t0;
  arr.push({name, ok, ms, type, env, meta: meta||null});
  logDiag_(name, ok, meta); // legacy one-liner kept
  _diagLogTest_(suite, name, ok, ms, type, env, meta);
}

// Suite runner (consistent roll-up row)
function _runSuite_(suiteName, runnerFn, env) {
  const out=[]; out.__suite=suiteName;
  const t0=_nowMs_();
  const res=runnerFn(out);
  const ms=_nowMs_()-t0;
  const passed=out.filter(t=>t.ok).length;
  const failed=out.length - passed;
  const ok=(failed===0) && (!!res ? !!res.ok : true);
  _diagLogSuite_(suiteName, ok, ms, {total:out.length,passed,failed}, env||'default', {steps:out});
  _diagPrune_();
  return { ok, results: out, ts: nowISO(), ms, totals: { total: out.length, passed, failed } };
}

// ---------------- Suites (existing bodies; just wrapped) ----------------
function runQuickChecks() {
  return _runSuite_('quick', function(out){
    _qaAdd_(out,'schema_events_v2',()=>{ const sh=getEventsSheet_(); const hdr=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
      return { ok: hdr.join()===EVENTS_SCHEMA_V2.join(), meta:{header:hdr} }; }, {suite:'quick'});
    _qaAdd_(out,'verify_all_tabs',()=>{ verifyAll_(); return {ok:true}; }, {suite:'quick'});
    _qaAdd_(out,'get_events_contract',()=>{ const rows=getEvents()||[]; const keys=rows.length?Object.keys(rows[0]).sort():[];
      const has=['eventId','name','slug','date','flow','elimType','seedMode','isDefault','publicUrl','displayUrl','formUrl','counts','updatedAt'].every(k=>keys.includes(k));
      return {ok:has, meta:{count:rows.length, keys}}; }, {suite:'quick'});
    _qaAdd_(out,'status_ok',()=>{ const s=getStatus(); return {ok:!!s.ok, meta:s}; }, {suite:'quick'});
    return { ok: out.every(t=>t.ok) };
  });
}
function runQaSuite() {
  return _runSuite_('full', function(out){
    const today=Utilities.formatDate(new Date(),'UTC','yyyy-MM-dd'); let ev=null;
    _qaAdd_(out,'schema_events_v2',()=>{ const sh=getEventsSheet_(); const hdr=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
      return { ok: hdr.join()===EVENTS_SCHEMA_V2.join(), meta:{header:hdr} }; }, {suite:'full'});
    _qaAdd_(out,'create_event_tourney_only',()=>{ ev=createEvent({ name:`QA ${shortId(Utilities.getUuid())}`, startDate:today, flow:FLOW.TOURNEY_ONLY, elimType:ELIM.SINGLE, seedMode:SEEDMODE.RANDOM});
      return { ok: !!(ev&&ev.eventId), meta:{ev} }; }, {suite:'full'});
    _qaAdd_(out,'default_invariant_row_intact',()=>{ setDefaultEvent(ev.eventId,true);
      const rows=readTable_(getEventsSheet_()); const defaults=rows.filter(r=>String(r.isDefault)==='true').map(r=>r.eventId);
      const me=rows.find(r=>r.eventId===ev.eventId)||{}; const intact=['eventId','name','slug','flow','signupSheet'].every(k=>(me[k]||'')!=='');
      const ok=defaults.length===1 && defaults[0]===ev.eventId && intact; return { ok, meta:{defaults,intact,row:me} }; }, {suite:'full'});
    _qaAdd_(out,'verify_tabs_exist',()=>{ verifyAll_(); return {ok:true}; }, {suite:'full'});
    _qaAdd_(out,'public_bundle_ok',()=>{ const b=getPublicBundle(ev.eventId);
      return { ok: !!(b&&b.eventMeta&&b.eventMeta.eventId===ev.eventId), meta:{counts:b.counts,links:b.eventMeta.links} }; }, {suite:'full'});
    _qaAdd_(out,'bracket_generate_single',()=>{ _seedDemoSignups_(ev.eventId,4);
      const r=generateBrackets(ev.eventId,{elimType:ELIM.SINGLE, seedMode:SEEDMODE.RANDOM}); return { ok: !!(r&&r.ok), meta:r }; }, {suite:'full'});
    _qaAdd_(out,'share_links_resolve',()=>{ const l=getShareLinks(ev.eventId); const ok=!!(l.publicUrl&&l.displayUrl);
      return { ok, meta:{hasPublic:!!l.publicUrl, hasDisplay:!!l.displayUrl, sample:l.publicUrl} }; }, {suite:'full'});
    _qaAdd_(out,'warm_caches',()=> warmCaches(true), {suite:'full'});
    _qaAdd_(out,'schedule_generate_season',()=>{ const ev2=createEvent({ name:`QASzn ${shortId(Utilities.getUuid())}`, startDate:today, flow:FLOW.SEASON_ONLY, weeks:3, elimType:ELIM.SINGLE, seedMode:SEEDMODE.RANDOM });
      generateSchedule(ev2.eventId,3); const me2=getEventById_(ev2.eventId); const sch=ss().getSheetByName(me2.scheduleSheet);
      const ok=sch && sch.getLastRow()>=(1+3); archiveEvent(ev2.eventId); return { ok, meta:{sheet:me2.scheduleSheet, rows: sch?sch.getLastRow():0} }; }, {suite:'full'});
    _qaAdd_(out,'cleanup_archive',()=>{ archiveEvent(ev.eventId); return {ok:true, meta:{eventId:ev.eventId}}; }, {suite:'full'});
    return { ok: out.every(t=>t.ok) };
  });
}
function runTestsCreateCard(){ return _runSuite_('create',function(out){
  let ev=null;
  _qaAdd_(out,'create_event_basic',()=>{ ev=_qaNewEvent_({ flow:FLOW.SEASON_TOURNEY, weeks:3, seedMode:SEEDMODE.RANDOM }); return { ok:!!ev.eventId, meta:ev }; }, {suite:'create'});
  _qaAdd_(out,'row_intact_post_default',()=>{ setDefaultEvent(ev.eventId,true); const me=getEventById_(ev.eventId);
    const intact=['eventId','name','slug','flow','signupSheet'].every(k=>!!(me&&me[k])); return { ok:intact, meta:me }; }, {suite:'create'});
  _qaAdd_(out,'slug_uniqueness',()=>{ let pe=null; try{ createEvent({ name:ev.name, startDate:ev.startDate, flow:ev.flow }); }catch(e){ pe=parseMaybeErr_(e); }
    return { ok: !!(pe&&pe.code===ERR.DUP_SLUG), meta:pe }; }, {suite:'create'});
  _qaAdd_(out,'verify_tabs_created',()=>{ verifyAll_(); const me=getEventById_(ev.eventId); return { ok: !!(me.signupSheet && ss().getSheetByName(me.signupSheet)), meta:me }; }, {suite:'create'});
  _qaAdd_(out,'cleanup_archive',()=>{ archiveEvent(ev.eventId); return {ok:true, meta:{eventId:ev.eventId}}; }, {suite:'create'});
  return { ok: out.every(t=>t.ok) };
});}
function runTestsManageCard(){ return _runSuite_('manage',function(out){
  const evA=_qaNewEvent_({ flow:FLOW.TOURNEY_ONLY }); const evB=_qaNewEvent_({ flow:FLOW.SEASON_ONLY, weeks:3 });
  _qaAdd_(out,'get_events_list',()=>{ const rows=getEvents(); return { ok: rows.length>=2, meta:{count:rows.length} }; }, {suite:'manage'});
  _qaAdd_(out,'single_default_invariant',()=>{ setDefaultEvent(evA.eventId,true); setDefaultEvent(evB.eventId,true);
    const rows=readTable_(getEventsSheet_()); const defaults=rows.filter(r=>String(r.isDefault)==='true').map(r=>r.eventId);
    return { ok: defaults.length===1 && defaults[0]===evB.eventId, meta:{defaults} }; }, {suite:'manage'});
  _qaAdd_(out,'open_sheet_url',()=>{ const url=openSheetUrl(evA.eventId); return { ok:!!url, meta:{url} }; }, {suite:'manage'});
  _qaAdd_(out,'cleanup_archive',()=>{ archiveEvent(evA.eventId); archiveEvent(evB.eventId); return {ok:true}; }, {suite:'manage'});
  return { ok: out.every(t=>t.ok) };
});}
function runTestsSignupsCard(){ return _runSuite_('signups',function(out){
  const ev=_qaNewEvent_({ flow:FLOW.TOURNEY_ONLY });
  _qaAdd_(out,'form_build',()=>{ const r=buildSignupForm(ev.eventId,{email:true,phone:true,notes:true}); const me=getEventById_(ev.eventId);
    return { ok: !!(r&&me.formUrl), meta:{formUrl:me.formUrl,res:r} }; }, {suite:'signups'});
  _qaAdd_(out,'seed_column_idempotent',()=>{ ensureSeedColumn(ev.eventId); const me=getEventById_(ev.eventId);
    const sh=ss().getSheetByName(me.signupSheet); const hdr=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; return { ok: hdr.includes('Seed'), meta:{headers:hdr} }; }, {suite:'signups'});
  _qaAdd_(out,'signup_count_increments',()=>{ _seedDemoSignups_(ev.eventId,3); const n=getSignupCount(ev.eventId); return { ok:n>=3, meta:{count:n} }; }, {suite:'signups'});
  _qaAdd_(out,'cleanup_archive',()=>{ archiveEvent(ev.eventId); return {ok:true}; }, {suite:'signups'});
  return { ok: out.every(t=>t.ok) };
});}
function runTestsShareCard(){ return _runSuite_('share',function(out){
  const ev=_qaNewEvent_({ flow:FLOW.TOURNEY_ONLY });
  _qaAdd_(out,'share_links_present',()=>{ const links=getShareLinks(ev.eventId); const ok=!!(links.publicUrl&&links.displayUrl);
    return { ok, meta:Object.assign({note: ok ? 'ok' : 'deploy web app for full links'}, links) }; }, {suite:'share'});
  _qaAdd_(out,'qr_generates',()=>{ const links=getShareLinks(ev.eventId); const ok=(links.qrPublicB64 && links.qrPublicB64.length>64);
    return { ok, meta:{qrLen:links.qrPublicB64?links.qrPublicB64.length:0} }; }, {suite:'share'});
  _qaAdd_(out,'cleanup_archive',()=>{ archiveEvent(ev.eventId); return {ok:true}; }, {suite:'share'});
  return { ok: out.every(t=>t.ok) };
});}
function runTestsScheduleCard(){ return _runSuite_('schedule',function(out){
  const ev=_qaNewEvent_({ flow:FLOW.SEASON_ONLY, weeks:3 });
  _qaAdd_(out,'generate_schedule_rows',()=>{ generateSchedule(ev.eventId,3); const me=getEventById_(ev.eventId);
    const sh=ss().getSheetByName(me.scheduleSheet); return { ok: sh && sh.getLastRow()>=4, meta:{sheet:me.scheduleSheet, rows: sh?sh.getLastRow():0} }; }, {suite:'schedule'});
  _qaAdd_(out,'record_result_and_standings',()=>{ const me=getEventById_(ev.eventId); const sch=ss().getSheetByName(me.scheduleSheet);
    if (sch.getLastRow()>=2){ sch.getRange(2,4).setValue('Team A'); sch.getRange(2,5).setValue('Team B'); recordResult(ev.eventId,2,5,3);
      const s=computeStandings(ev.eventId); const ok=Array.isArray(s)&&s.length>=2&&s[0].Team&&(s[0].W+s[0].L)>=1; return { ok, meta:{standings:s.slice(0,2)} }; }
    return { ok:false, meta:{reason:'no schedule rows'} }; }, {suite:'schedule'});
  _qaAdd_(out,'cleanup_archive',()=>{ archiveEvent(ev.eventId); return {ok:true}; }, {suite:'schedule'});
  return { ok: out.every(t=>t.ok) };
});}
function runTestsBracketsCard(){ return _runSuite_('brackets',function(out){
  const ev=_qaNewEvent_({ flow:FLOW.TOURNEY_ONLY, seedMode:SEEDMODE.SEEDED });
  _qaAdd_(out,'seed_signups',()=>{ _seedDemoSignups_(ev.eventId,4); const me=getEventById_(ev.eventId);
    const sh=ss().getSheetByName(me.signupSheet); const head=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; const seedIdx=head.indexOf('Seed');
    if (seedIdx>=0){ const count=Math.max(0, sh.getLastRow()-1); if (count) sh.getRange(2,seedIdx+1,count,1).setValues(Array.from({length:count},(_,i)=>[i+1])); }
    const n=getSignupCount(ev.eventId); return { ok:n>=4, meta:{count:n} }; }, {suite:'brackets'});
  _qaAdd_(out,'generate_seeded_bracket',()=>{ const r=generateBrackets(ev.eventId,{elimType:ELIM.SINGLE, seedMode:SEEDMODE.SEEDED}); return { ok: !!(r&&r.ok), meta:r }; }, {suite:'brackets'});
  _qaAdd_(out,'read_bracket_structure',()=>{ const me=getEventById_(ev.eventId); const b=readBracket_(me.bracketSheet);
    const ok=b && Array.isArray(b.rounds) && b.rounds.length>=1; return { ok, meta:{rounds:b.rounds.length} }; }, {suite:'brackets'});
  _qaAdd_(out,'random_mode_fallback',()=>{ const r=generateBrackets(ev.eventId,{elimType:ELIM.SINGLE, seedMode:SEEDMODE.RANDOM}); return { ok: !!(r&&r.ok), meta:r }; }, {suite:'brackets'});
  _qaAdd_(out,'cleanup_archive',()=>{ archiveEvent(ev.eventId); return {ok:true}; }, {suite:'brackets'});
  return { ok: out.every(t=>t.ok) };
});}
function runAllCardTests(){
  const packs=[['create',runTestsCreateCard],['manage',runTestsManageCard],['signups',runTestsSignupsCard],['share',runTestsShareCard],['schedule',runTestsScheduleCard],['brackets',runTestsBracketsCard]];
  const t0=_nowMs_(); const results=packs.map(([name,fn])=>{ try{ return Object.assign({name}, fn()); } catch(e){ return {name, ok:false, error:parseMaybeErr_(e), results:[]}; } });
  const ms=_nowMs_()-t0; const ok=results.every(r=>r.ok);
  const total=results.reduce((a,r)=>a+(r.results?r.results.length:0),0);
  const passed=results.reduce((a,r)=>a+(r.results?r.results.filter(x=>x.ok).length:0),0);
  const failed=total-passed;
  _diagLogSuite_('allcards', ok, ms, {total,passed,failed}, 'default', {bundles:results.map(r=>({name:r.name, ok:r.ok, totals:r.totals||null}))});
  _diagPrune_();
  return { ok, results, ts: nowISO(), ms, totals: { total, passed, failed } };
}

// --------- History / Trends / Perf / Flaky / Export ----------
function diagGetHistory(limit, suite) {
  const {tests}= _diagSheets_(); const lim=Math.max(1,Math.min(Number(limit||200),1000));
  const lr=tests.getLastRow(); if (lr<2) return {tests:[], totals:{total:0,passed:0,failed:0}, ts: nowISO()};
  const vals=tests.getRange(Math.max(2, lr-lim+1),1,Math.min(lim, lr-1),9).getValues();
  const rows=vals.map(r=>({ ts:r[0], suite:r[1], test:r[2], ok:String(r[3])==='true', ms:Number(r[4]||0), type:r[5]||'unit', env:r[6]||'', error:r[7]||'',
                             meta:(function(){try{return JSON.parse(r[8]||'');}catch(_){return r[8];}})() }))
                 .filter(x=>!suite || String(x.suite)===String(suite));
  const total=rows.length, passed=rows.filter(x=>x.ok).length, failed=total-passed;
  const byErr={}; rows.filter(x=>!x.ok).forEach(x=>{ byErr[x.error]= (byErr[x.error]||0)+1; });
  return { tests:rows, totals:{total,passed,failed}, errors:byErr, ts: nowISO() };
}
function diagGetSuiteHistory(limit, suite) {
  const {suites}= _diagSheets_(); const lim=Math.max(1,Math.min(Number(limit||200),1000));
  const lr=suites.getLastRow(); if (lr<2) return {suites:[], ts:nowISO()};
  const vals=suites.getRange(Math.max(2, lr-lim+1),1,Math.min(lim, lr-1),9).getValues();
  const rows=vals.map(r=>({ ts:r[0], suite:r[1], ok:String(r[2])==='true', ms:Number(r[3]||0), total:Number(r[4]||0), passed:Number(r[5]||0), failed:Number(r[6]||0), env:r[7]||'',
                             meta:(function(){try{return JSON.parse(r[8]||'');}catch(_){return r[8];}})()}))
                 .filter(x=>!suite || String(x.suite)===String(suite));
  return { suites: rows, ts: nowISO() };
}
function diagTrendSummary(days) {
  const {suites}= _diagSheets_(); const lr=suites.getLastRow(); if (lr<2) return {points:[], ts:nowISO()};
  const since = days ? new Date(Date.now()-Number(days)*24*3600*1000) : null;
  const vals=suites.getRange(2,1,lr-1,9).getValues();
  const rows=vals.map(r=>({ ts:new Date(r[0]), suite:r[1], total:Number(r[4]||0), passed:Number(r[5]||0) })).filter(x=>x.total>0);
  const filtered = since ? rows.filter(x=>x.ts>=since) : rows;
  const byDay={};
  filtered.forEach(x=>{
    const d = Utilities.formatDate(x.ts,'UTC','yyyy-MM-dd') + '|' + x.suite;
    const cur = byDay[d] || { date: d.split('|')[0], suite: x.suite, total:0, passed:0 };
    cur.total += x.total; cur.passed += x.passed; byDay[d]=cur;
  });
  const points = Object.values(byDay).map(x=>({ date:x.date, suite:x.suite, rate: x.total? (x.passed/x.total) : 0, total:x.total }));
  points.sort((a,b)=> a.date.localeCompare(b.date));
  return { points, ts: nowISO() };
}
function diagPerfSummary(days) {
  const {tests}= _diagSheets_(); const lr=tests.getLastRow(); if (lr<2) return { stats:[], ts:nowISO() };
  const vals=tests.getRange(2,1,lr-1,9).getValues().map(r=>({ ts:new Date(r[0]), suite:r[1], test:r[2], ok:String(r[3])==='true', ms:Number(r[4]||0) }));
  const since= days ? new Date(Date.now()-Number(days)*24*3600*1000) : null;
  const filtered = since ? vals.filter(v=>v.ts>=since) : vals;
  const byKey={};
  filtered.forEach(r=>{ const k=r.suite+'::'+r.test; (byKey[k]=byKey[k]||[]).push(r.ms); });
  const stats=Object.entries(byKey).map(([k,arr])=>{ const [suite,test]=k.split('::'); return { suite, test, count:arr.length, p50:_percentile_(arr,50), p95:_percentile_(arr,95), max:_percentile_(arr,100) }; });
  return { stats, ts: nowISO() };
}
function diagFlaky(limit, minRuns) {
  const {tests}= _diagSheets_(); const lr=tests.getLastRow(); if (lr<2) return { flaky:[], ts:nowISO() };
  const lim=Math.max(1,Math.min(Number(limit||2000),5000)); const need=Math.max(5, Number(minRuns||5));
  const vals=tests.getRange(Math.max(2, lr-lim+1),1,Math.min(lim, lr-1),9).getValues()
    .map(r=>({ suite:r[1], test:r[2], ok:String(r[3])==='true', ts:r[0] }));
  const byKey={};
  vals.forEach(v=>{ const k=v.suite+'::'+v.test; (byKey[k]=byKey[k]||[]).push(v.ok); });
  const flaky = Object.entries(byKey).map(([k,arr])=>{
    const [suite,test]=k.split('::'); const n=arr.length; const pass=arr.filter(Boolean).length; const fail=n-pass;
    const rate = n? pass/n : 0; const flip = (function(a){let f=0; for(let i=1;i<a.length;i++) if(!!a[i]!==!!a[i-1]) f++; return f;})(arr);
    return { suite, test, runs:n, pass, fail, passRate:rate, flips:flip };
  }).filter(x=>x.runs>=need && x.pass>0 && x.fail>0)
    .sort((a,b)=> (b.flips-a.flips) || (a.passRate-b.passRate));
  return { flaky, ts: nowISO() };
}
function diagExportCsv(kind, suite, limit) {
  // kind: 'tests'|'suites'
  const {tests,suites}= _diagSheets_();
  const sh = (kind==='suites') ? suites : tests;
  const lr = sh.getLastRow(); if (lr<2) return '';
  const lim = Math.max(1, Math.min(Number(limit||1000), 5000));
  const vals=sh.getRange(1,1,Math.min(lr, lim+1), sh.getLastColumn()).getValues();
  const hdr=vals.shift(); const rows = vals.filter(r => !suite || String(r[1])===String(suite));
  const csv = [hdr.join(',')].concat(rows.map(r=>r.map(c=>{
    const s=(c==null)?'':String(c); return s.includes(',')||s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(','))).join('\n');
  return csv;
}

// ---------- Exports ----------
function getAppMeta() { return { title: APP_TITLE, build: BUILD_ID, ts: nowISO() }; }


