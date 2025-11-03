/**
 * EVENT ONLY MVP - Backend
 * Version: 1.0.0 MVP
 * Built: November 2, 2025
 * 
 * STRATEGIC NOTES:
 * - Event Only visible (ABC launch)
 * - Tournament/Season hidden (Week 4 reveal)
 * - Analytics dashboard not included (Week 3 reveal)
 * - Multi-brand architecture ready (Art Institute next)
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  APP_NAME: 'NextUp Event Manager',
  VERSION: '1.0.0-MVP',
  BUILD_DATE: '2025-11-02',
  
  // Multi-brand configuration
  BRANDS: {
    'ABC': {
      name: 'American Bocce Co.',
      shortName: 'ABC',
      colors: {
        primary: '#c8102e',    // ABC red
        secondary: '#f5f1e8',  // ABC cream
        accent: '#00a651'      // Bocce green
      },
      features: {
        eventOnly: true,       // ✅ VISIBLE
        tournament: false,     // 🔒 HIDDEN (Week 4 reveal)
        season: false,         // 🔒 HIDDEN (Week 4 reveal)
        seasonTournament: false // 🔒 HIDDEN (Week 4 reveal)
      },
      formBranding: {
        headerImage: 'https://www.americanbocceco.com/logo.png', // Update with real URL
        backgroundColor: '#c8102e',
        textColor: '#ffffff'
      }
    },
    'AIC': {
      name: 'Art Institute of Chicago',
      shortName: 'AIC',
      colors: {
        primary: '#000000',
        secondary: '#ffffff',
        accent: '#c41e3a'
      },
      features: {
        eventOnly: true,       // Ready but not exposed yet
        tournament: false,
        season: false,
        seasonTournament: false
      },
      formBranding: {
        headerImage: 'https://www.artic.edu/logo.png',
        backgroundColor: '#000000',
        textColor: '#ffffff'
      }
    }
  },
  
  DEFAULT_BRAND: 'ABC',
  
  // Spreadsheet configuration
  EVENTS_SHEET_NAME: 'Events',
  ERROR_LOG_SHEET_NAME: 'ErrorLog',
  
  // QR Code settings
  QR_CODE_SIZE: 300,
  QR_CODE_API: 'https://api.qrserver.com/v1/create-qr-code/',
  
  // Form settings
  FORM_FIELDS: {
    registration: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Email Address', type: 'TEXT', required: true },
      { title: 'Phone Number', type: 'TEXT', required: true }
    ],
    checkin: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Phone Number', type: 'TEXT', required: true }
      // Time is automatically captured by Google Forms timestamp
    ],
    walkin: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Email Address', type: 'TEXT', required: true },
      { title: 'Phone Number', type: 'TEXT', required: true }
    ],
    survey: [
      { title: 'How would you rate this event?', type: 'SCALE', required: true },
      { title: 'What did you like?', type: 'PARAGRAPH_TEXT', required: false },
      { title: 'What could we improve?', type: 'PARAGRAPH_TEXT', required: false }
    ]
  }
};

// ============================================
// WEB APP ENTRY POINTS
// ============================================

function doGet(e) {
  try {
    // Get brand from URL parameter
    const brandSlug = e.parameter.brand || e.parameter.b || 'abc';
    const brand = getBrand(brandSlug);
    
    const page = e.parameter.p || 'Admin';
    const template = HtmlService.createTemplateFromFile(page);
    
    // Pass brand to template
    template.brand = brand;
    template.appTitle = brand.name;
    template.BUILD_ID = CONFIG.VERSION;
    
    return template.evaluate()
      .setTitle(brand.name + ' Event Manager')
      .addMetaTag('viewport', 'width=device-width,initial-scale=1,viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    return createErrorPage('Failed to load page: ' + error);
  }
}

function include(filename, brand) {
  try {
    const template = HtmlService.createTemplateFromFile(filename);
    if (brand) {
      template.brand = brand;
    }
    return template.evaluate().getContent();
  } catch (error) {
    logError('include', error, { filename });
    return `<!-- Error loading ${filename}: ${error} -->`;
  }
}

function createErrorPage(message) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Error</title>
      <style>
        body { font-family: sans-serif; padding: 40px; text-align: center; }
        .error { color: #c8102e; font-size: 18px; }
      </style>
    </head>
    <body>
      <h1>Oops!</h1>
      <p class="error">${message}</p>
    </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

// ============================================
// SPREADSHEET HELPERS
// ============================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Initialize Events sheet with headers
    if (sheetName === CONFIG.EVENTS_SHEET_NAME) {
      sheet.getRange(1, 1, 1, 26).setValues([[
        'Event ID', 'Brand', 'Event Name', 'Event Date', 'Created At',
        'Registration Form ID', 'Check-In Form ID', 'Walk-In Form ID', 'Survey Form ID',
        'Data Sheet ID', 'Status',
        'Summary Text', 'Summary Link', 'Summary Image',
        'Event Location', 'Video URLs',
        'Bio Image', 'Bio Text', 'Bio Link', 'Event Time',
        'Show Summary Image', 'Show Videos', 'Show Bio', 'Show Metrics',
        'Display Mode', 'Carousel URLs'
      ]]);
      sheet.setFrozenRows(1);
    }
  }
  
  return sheet;
}

// ============================================
// EVENT MANAGEMENT
// ============================================

/**
 * Create a new Event Only event
 * @param {Object} data - { brand, eventName, eventDate, eventTime, location, summaryText, summaryLink, summaryImage, videoURLs, bioImage, bioText, bioLink, showSummaryImage, showVideos, showBio, showMetrics }
 * @returns {Object} { ok, eventId, event }
 */
function createEvent(data) {
  try {
    // Validate input
    const validation = validateEventInput(data);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }
    
    const validated = validation.data;
    
    // Check brand exists and has Event Only enabled
    const brandConfig = CONFIG.BRANDS[validated.brand];
    if (!brandConfig) {
      return { ok: false, error: 'Invalid brand' };
    }
    if (!brandConfig.features.eventOnly) {
      return { ok: false, error: 'Event Only not available for this brand' };
    }
    
    // Generate event ID
    const eventId = generateEventId();
    const createdAt = new Date().toISOString();
    
    // Save to Events sheet with rich content and page config
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME);
    sheet.appendRow([
      eventId,
      validated.brand,
      validated.eventName,
      validated.eventDate,
      createdAt,
      '', '', '', '', // Form IDs (filled in by setupEventTracking)
      '', // Data Sheet ID
      'CREATED', // Status
      validated.summaryText || '',
      validated.summaryLink || '',
      validated.summaryImage || '',
      validated.location || '',
      validated.videoURLs || '',
      validated.bioImage || '',
      validated.bioText || '',
      validated.bioLink || '',
      validated.eventTime || '',
      validated.showSummaryImage !== false, // Default true
      validated.showVideos !== false, // Default true
      validated.showBio !== false, // Default true
      validated.showMetrics !== false // Default true
    ]);
    
    logActivity('createEvent', { eventId, brand: validated.brand, eventName: validated.eventName });
    
    return {
      ok: true,
      eventId: eventId,
      event: {
        eventId,
        brand: validated.brand,
        eventName: validated.eventName,
        eventDate: validated.eventDate,
        eventTime: validated.eventTime,
        location: validated.location,
        createdAt,
        status: 'CREATED'
      }
    };
    
  } catch (error) {
    logError('createEvent', error, data);
    return { ok: false, error: String(error) };
  }
}

/**
 * Set up event tracking (creates 4 forms + data sheet + QR codes)
 * @param {string} eventId
 * @returns {Object} { ok, forms, qrCodes }
 */
function setupEventTracking(eventId) {
  try {
    // Get event
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const brandConfig = CONFIG.BRANDS[event.brand];
    
    // Step 1: Create data collection spreadsheet
    const dataSheet = createEventDataSheet(event.eventName);
    
    // Step 2: Create 4 Google Forms
    const forms = {
      registration: createForm('Registration', event, brandConfig, dataSheet.registrationSheetId),
      checkin: createForm('Check-In', event, brandConfig, dataSheet.checkinSheetId),
      walkin: createForm('Walk-In', event, brandConfig, dataSheet.walkinSheetId),
      survey: createForm('Survey', event, brandConfig, dataSheet.surveySheetId)
    };
    
    // Step 3: Generate QR codes for each form
    const qrCodes = {
      registration: generateQRCode(forms.registration.url),
      checkin: generateQRCode(forms.checkin.url),
      walkin: generateQRCode(forms.walkin.url),
      survey: generateQRCode(forms.survey.url)
    };
    
    // Step 4: Update Events sheet with form IDs
    updateEventFormIds(eventId, {
      registrationFormId: forms.registration.id,
      checkinFormId: forms.checkin.id,
      walkinFormId: forms.walkin.id,
      surveyFormId: forms.survey.id,
      dataSheetId: dataSheet.spreadsheetId
    });
    
    logActivity('setupEventTracking', { eventId, dataSheetId: dataSheet.spreadsheetId });
    
    return {
      ok: true,
      forms: {
        registration: { ...forms.registration, qrCode: qrCodes.registration },
        checkin: { ...forms.checkin, qrCode: qrCodes.checkin },
        walkin: { ...forms.walkin, qrCode: qrCodes.walkin },
        survey: { ...forms.survey, qrCode: qrCodes.survey }
      },
      dataSheetUrl: dataSheet.url
    };
    
  } catch (error) {
    logError('setupEventTracking', error, { eventId });
    return { ok: false, error: String(error) };
  }
}

/**
 * Get all events for a brand
 * @param {string} brand
 * @returns {Object} { ok, events }
 */
function getEvents(brand) {
  try {
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { ok: true, events: [] };
    }
    
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === brand) { // Brand column
        events.push({
          eventId: row[0],
          brand: row[1],
          eventName: row[2],
          eventDate: row[3],
          createdAt: row[4],
          registrationFormId: row[5],
          checkinFormId: row[6],
          walkinFormId: row[7],
          surveyFormId: row[8],
          dataSheetId: row[9],
          status: row[10],
          summaryText: row[11] || '',
          summaryLink: row[12] || '',
          summaryImage: row[13] || '',
          location: row[14] || '',
          videoURLs: row[15] || '',
          bioImage: row[16] || '',
          bioText: row[17] || '',
          bioLink: row[18] || '',
          eventTime: row[19] || '',
          showSummaryImage: row[20] !== false,
          showVideos: row[21] !== false,
          showBio: row[22] !== false,
          showMetrics: row[23] !== false
        });
      }
    }
    
    return { ok: true, events };
    
  } catch (error) {
    logError('getEvents', error, { brand });
    return { ok: false, error: String(error) };
  }
}

/**
 * Get event by ID
 * @param {string} eventId
 * @returns {Object|null}
 */
function getEventById(eventId) {
  try {
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        return {
          eventId: data[i][0],
          brand: data[i][1],
          eventName: data[i][2],
          eventDate: data[i][3],
          createdAt: data[i][4],
          registrationFormId: data[i][5],
          checkinFormId: data[i][6],
          walkinFormId: data[i][7],
          surveyFormId: data[i][8],
          dataSheetId: data[i][9],
          status: data[i][10],
          summaryText: data[i][11] || '',
          summaryLink: data[i][12] || '',
          summaryImage: data[i][13] || '',
          location: data[i][14] || '',
          videoURLs: data[i][15] || '',
          bioImage: data[i][16] || '',
          bioText: data[i][17] || '',
          bioLink: data[i][18] || '',
          eventTime: data[i][19] || '',
          showSummaryImage: data[i][20] !== false,
          showVideos: data[i][21] !== false,
          showBio: data[i][22] !== false,
          showMetrics: data[i][23] !== false
        };
      }
    }
    
    return null;
  } catch (error) {
    logError('getEventById', error, { eventId });
    return null;
  }
}

/**
 * Get form response counts
 * @param {string} eventId
 * @returns {Object} { ok, counts }
 */
function getEventCounts(eventId) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const counts = {
      registration: getFormResponseCount(event.registrationFormId),
      checkin: getFormResponseCount(event.checkinFormId),
      walkin: getFormResponseCount(event.walkinFormId),
      survey: getFormResponseCount(event.surveyFormId)
    };
    
    return { ok: true, counts };
    
  } catch (error) {
    logError('getEventCounts', error, { eventId });
    return { ok: false, error: String(error) };
  }
}

// ============================================
// FORM CREATION
// ============================================

/**
 * Create a Google Form with branding
 * @param {string} formType - 'Registration', 'Check-In', 'Walk-In', or 'Survey'
 * @param {Object} event
 * @param {Object} brandConfig
 * @param {string} responseSheetId
 * @returns {Object} { id, url, responseUrl }
 */
function createForm(formType, event, brandConfig, responseSheetId) {
  const formTitle = `${event.eventName} - ${formType}`;
  const form = FormApp.create(formTitle);
  
  // Set branding (description with brand colors)
  form.setDescription(
    `${brandConfig.name}\n${event.eventName}\n${new Date(event.eventDate).toLocaleDateString()}`
  );
  
  // Add timestamp
  form.setCollectEmail(false); // We collect email in form fields
  
  // Add fields based on form type
  const fieldKey = formType.toLowerCase().replace('-', '');
  const fields = CONFIG.FORM_FIELDS[fieldKey];
  
  fields.forEach(field => {
    if (field.type === 'TEXT') {
      const item = form.addTextItem();
      item.setTitle(field.title);
      item.setRequired(field.required);
    } else if (field.type === 'PARAGRAPH_TEXT') {
      const item = form.addParagraphTextItem();
      item.setTitle(field.title);
      item.setRequired(field.required);
    } else if (field.type === 'SCALE') {
      const item = form.addScaleItem();
      item.setTitle(field.title);
      item.setBounds(1, 5);
      item.setRequired(field.required);
    }
  });
  
  // Link form to response sheet
  const formId = form.getId();
  const responseSheet = SpreadsheetApp.openById(responseSheetId);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, responseSheet.getId());
  
  return {
    id: formId,
    url: form.getPublishedUrl(),
    editUrl: form.getEditUrl(),
    responseUrl: `https://docs.google.com/forms/d/${formId}/edit#responses`
  };
}

/**
 * Create event data collection spreadsheet
 * @param {string} eventName
 * @returns {Object} { spreadsheetId, url, registrationSheetId, checkinSheetId, walkinSheetId, surveySheetId }
 */
function createEventDataSheet(eventName) {
  const ss = SpreadsheetApp.create(`${eventName} - Event Data`);
  const spreadsheetId = ss.getId();
  
  // Create 4 sheets
  const registrationSheet = ss.getActiveSheet();
  registrationSheet.setName('Registration');
  
  const checkinSheet = ss.insertSheet('Check-In');
  const walkinSheet = ss.insertSheet('Walk-In');
  const surveySheet = ss.insertSheet('Survey');
  
  return {
    spreadsheetId: spreadsheetId,
    url: ss.getUrl(),
    registrationSheetId: spreadsheetId,
    checkinSheetId: spreadsheetId,
    walkinSheetId: spreadsheetId,
    surveySheetId: spreadsheetId
  };
}

/**
 * Get form response count
 * @param {string} formId
 * @returns {number}
 */
function getFormResponseCount(formId) {
  try {
    if (!formId) return 0;
    const form = FormApp.openById(formId);
    return form.getResponses().length;
  } catch (error) {
    logError('getFormResponseCount', error, { formId });
    return 0;
  }
}

// ============================================
// QR CODE GENERATION
// ============================================

/**
 * Generate QR code for URL
 * @param {string} url
 * @returns {string} Base64 encoded PNG
 */
function generateQRCode(url) {
  try {
    const qrUrl = `${CONFIG.QR_CODE_API}?size=${CONFIG.QR_CODE_SIZE}x${CONFIG.QR_CODE_SIZE}&data=${encodeURIComponent(url)}`;
    const response = UrlFetchApp.fetch(qrUrl);
    const blob = response.getBlob();
    return Utilities.base64Encode(blob.getBytes());
  } catch (error) {
    logError('generateQRCode', error, { url });
    return '';
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateEventId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `EVT-${timestamp}-${random}`;
}

function validateEventInput(data) {
  // Required fields
  if (!data.brand) {
    return { valid: false, error: 'Brand is required' };
  }
  if (!data.eventName || data.eventName.trim().length < 3) {
    return { valid: false, error: 'Event name must be at least 3 characters' };
  }
  if (!data.eventDate) {
    return { valid: false, error: 'Event date is required' };
  }
  if (!data.summaryText || data.summaryText.trim().length < 10) {
    return { valid: false, error: 'Summary text is required (minimum 10 characters)' };
  }
  if (!data.summaryLink || !isValidURL(data.summaryLink)) {
    return { valid: false, error: 'Valid summary link is required' };
  }
  
  return {
    valid: true,
    data: {
      brand: data.brand,
      eventName: data.eventName.trim(),
      eventDate: data.eventDate,
      eventTime: data.eventTime ? data.eventTime.trim() : '',
      location: data.location ? data.location.trim() : '',
      summaryText: data.summaryText.trim(),
      summaryLink: data.summaryLink.trim(),
      summaryImage: data.summaryImage ? data.summaryImage.trim() : '',
      videoURLs: data.videoURLs ? data.videoURLs.trim() : '',
      bioImage: data.bioImage ? data.bioImage.trim() : '',
      bioText: data.bioText ? data.bioText.trim() : '',
      bioLink: data.bioLink ? data.bioLink.trim() : '',
      showSummaryImage: data.showSummaryImage !== false,
      showVideos: data.showVideos !== false,
      showBio: data.showBio !== false,
      showMetrics: data.showMetrics !== false
    }
  };
}

function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function updateEventFormIds(eventId, formIds) {
  const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === eventId) {
      sheet.getRange(i + 1, 6).setValue(formIds.registrationFormId);
      sheet.getRange(i + 1, 7).setValue(formIds.checkinFormId);
      sheet.getRange(i + 1, 8).setValue(formIds.walkinFormId);
      sheet.getRange(i + 1, 9).setValue(formIds.surveyFormId);
      sheet.getRange(i + 1, 10).setValue(formIds.dataSheetId);
      sheet.getRange(i + 1, 11).setValue('TRACKING_ACTIVE');
      break;
    }
  }
}

function getBrandConfig(brand) {
  return CONFIG.BRANDS[brand] || CONFIG.BRANDS[CONFIG.DEFAULT_BRAND];
}

function getAvailableBrands() {
  // Only return brands that have Event Only enabled
  return Object.keys(CONFIG.BRANDS).filter(
    key => CONFIG.BRANDS[key].features.eventOnly
  ).map(key => ({
    id: key,
    name: CONFIG.BRANDS[key].name,
    shortName: CONFIG.BRANDS[key].shortName
  }));
}

// ============================================
// LOGGING
// ============================================

function logActivity(action, data) {
  try {
    Logger.log(`[${action}] ${JSON.stringify(data)}`);
  } catch (error) {
    // Fail silently
  }
}

function logError(where, error, context) {
  try {
    const sheet = getOrCreateSheet(CONFIG.ERROR_LOG_SHEET_NAME);
    sheet.appendRow([
      new Date().toISOString(),
      where,
      String(error),
      JSON.stringify(context)
    ]);
    Logger.log(`ERROR in ${where}: ${error}`);
  } catch (e) {
    Logger.log(`Failed to log error: ${e}`);
  }
}

// ============================================
// STATIC JSON EXPORT FOR INFINITE VIEWER SCALE
// ============================================

/**
 * Configuration for JSON export system
 * This enables infinite viewer scale at $0/month
 */
const EXPORT_CONFIG = {
  // IMPORTANT: Set this to your public Drive folder ID
  // Instructions: Create folder in Drive, share as "Anyone with link can view"
  EXPORT_FOLDER_ID: '', // TODO: REPLACE WITH YOUR FOLDER ID
  
  // Export frequency (controlled by time trigger)
  EXPORT_INTERVAL_SECONDS: 60, // Time trigger runs every 1 minute
  
  // Only export events happening today
  EXPORT_ACTIVE_ONLY: true
};

/**
 * MAIN EXPORT FUNCTION - Called by time trigger
 * This runs automatically every 1 minute and exports all active events to JSON
 * 
 * Viewers fetch these JSON files from Drive CDN (infinite scale, no Apps Script load)
 */
function exportActiveEventsToJSON() {
  try {
    const startTime = Date.now();
    Logger.log('=== Starting JSON export ===');
    
    // Check if folder ID is configured
    if (!EXPORT_CONFIG.EXPORT_FOLDER_ID) {
      Logger.log('⚠️ EXPORT_FOLDER_ID not configured - skipping export');
      return { ok: false, error: 'Export folder not configured' };
    }
    
    // Get events that are active (happening today)
    const activeEvents = getActiveEvents();
    
    if (!activeEvents || activeEvents.length === 0) {
      Logger.log('No active events to export');
      return { ok: true, exported: 0, message: 'No active events' };
    }
    
    Logger.log(`Found ${activeEvents.length} active events`);
    
    // Export each event
    const results = {
      total: activeEvents.length,
      succeeded: 0,
      failed: 0,
      errors: []
    };
    
    activeEvents.forEach(event => {
      try {
        exportEventToJSON(event);
        results.succeeded++;
        Logger.log(`✅ Exported: ${event.eventName}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          eventId: event.eventId,
          eventName: event.eventName,
          error: String(error)
        });
        Logger.log(`❌ Failed: ${event.eventName} - ${error}`);
      }
    });
    
    const duration = Date.now() - startTime;
    Logger.log(`=== Export complete in ${duration}ms: ${results.succeeded} succeeded, ${results.failed} failed ===`);
    
    return { ok: true, results, duration };
    
  } catch (error) {
    logError('exportActiveEventsToJSON', error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Get events that are active (happening today)
 * Only exports events with TRACKING_ACTIVE status on today's date
 */
function getActiveEvents() {
  try {
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return [];
    
    // Get today's date range (midnight to midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const activeEvents = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const eventDate = new Date(row[3]); // Event date column
      const status = row[10]; // Status column
      
      // Include if:
      // 1. Event date is today
      // 2. Tracking is active (forms have been set up)
      if (eventDate >= today && eventDate < tomorrow && status === 'TRACKING_ACTIVE') {
        activeEvents.push({
          eventId: row[0],
          brand: row[1],
          eventName: row[2],
          eventDate: row[3],
          createdAt: row[4],
          registrationFormId: row[5],
          checkinFormId: row[6],
          walkinFormId: row[7],
          surveyFormId: row[8],
          dataSheetId: row[9],
          status: row[10],
          summaryText: row[11] || '',
          summaryLink: row[12] || '',
          summaryImage: row[13] || '',
          location: row[14] || '',
          videoURLs: row[15] || '',
          bioImage: row[16] || '',
          bioText: row[17] || '',
          bioLink: row[18] || '',
          eventTime: row[19] || '',
          showSummaryImage: row[20] !== false,
          showVideos: row[21] !== false,
          showBio: row[22] !== false,
          showMetrics: row[23] !== false
        });
      }
    }
    
    return activeEvents;
    
  } catch (error) {
    logError('getActiveEvents', error);
    return [];
  }
}

/**
 * Export a single event to JSON file in Drive
 */
function exportEventToJSON(event) {
  try {
    // Generate the public bundle (standings, schedule, bracket, metrics)
    const bundle = generatePublicBundle(event);
    
    // Convert to JSON (pretty print for debugging)
    const json = JSON.stringify(bundle, null, 2);
    
    // Write to Drive
    const fileName = `event_${event.eventId}.json`;
    const file = createOrUpdateDriveFile(EXPORT_CONFIG.EXPORT_FOLDER_ID, fileName, json);
    
    // Ensure it's publicly accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      ok: true,
      fileId: file.getId(),
      fileName: fileName,
      url: `https://drive.google.com/uc?id=${file.getId()}`
    };
    
  } catch (error) {
    logError('exportEventToJSON', error, { eventId: event.eventId });
    throw error;
  }
}

/**
 * Generate public bundle with all viewer data
 * This is what viewers see in Public.html
 */
function generatePublicBundle(event) {
  try {
    // Get form response counts
    const counts = {
      registration: getFormResponseCount(event.registrationFormId),
      checkin: getFormResponseCount(event.checkinFormId),
      walkin: getFormResponseCount(event.walkinFormId),
      survey: getFormResponseCount(event.surveyFormId)
    };
    
    // Calculate key metrics
    const totalAttendees = counts.checkin + counts.walkin;
    const showUpRate = counts.registration > 0 
      ? Math.round((counts.checkin / counts.registration) * 100) 
      : 0;
    const walkinRate = totalAttendees > 0
      ? Math.round((counts.walkin / totalAttendees) * 100)
      : 0;
    const surveyRate = totalAttendees > 0
      ? Math.round((counts.survey / totalAttendees) * 100)
      : 0;
    
    // Parse video URLs (comma-separated)
    const videoURLs = event.videoURLs 
      ? event.videoURLs.split(',').map(url => url.trim()).filter(url => url.length > 0)
      : [];
    
    return {
      ok: true,
      
      // Event metadata
      eventMeta: {
        eventId: event.eventId,
        name: event.eventName,
        dateISO: event.eventDate,
        time: event.eventTime || '',
        location: event.location || '',
        brand: event.brand,
        status: event.status
      },
      
      // Rich content for event page
      content: {
        summary: {
          text: event.summaryText || '',
          link: event.summaryLink || '',
          image: event.summaryImage || ''
        },
        videos: videoURLs,
        bio: {
          image: event.bioImage || '',
          text: event.bioText || '',
          link: event.bioLink || ''
        }
      },
      
      // Page configuration (what to show/hide)
      pageConfig: {
        showSummaryImage: event.showSummaryImage !== false,
        showVideos: event.showVideos !== false,
        showBio: event.showBio !== false,
        showMetrics: event.showMetrics !== false
      },
      
      // Live metrics
      metrics: {
        registered: counts.registration,
        checkedIn: counts.checkin,
        walkIns: counts.walkin,
        totalAttendees: totalAttendees,
        surveys: counts.survey,
        showUpRate: showUpRate,
        walkinRate: walkinRate,
        surveyRate: surveyRate
      },
      
      // TODO: Add when Tournament/Season implemented (Week 4)
      standings: [],
      schedule: [],
      bracket: {},
      
      // Timestamp for "Last updated" display
      timestamp: Date.now(),
      lastUpdate: new Date().toISOString(),
      exportedBy: 'NextUp Event Manager v' + CONFIG.VERSION
    };
    
  } catch (error) {
    logError('generatePublicBundle', error, { eventId: event.eventId });
    throw error;
  }
}

/**
 * Create or update a file in Drive
 * Reuses existing file if it exists, creates new if not
 */
function createOrUpdateDriveFile(folderId, fileName, content) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    // Update existing file
    const file = files.next();
    file.setContent(content);
    Logger.log(`Updated existing file: ${fileName}`);
    return file;
  } else {
    // Create new file
    const file = folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
    Logger.log(`Created new file: ${fileName}`);
    return file;
  }
}

/**
 * Get the public URL for an event's JSON file
 * Called by Admin UI to get shareable link
 */
function getEventJSONUrl(eventId) {
  try {
    if (!EXPORT_CONFIG.EXPORT_FOLDER_ID) {
      return { 
        ok: false, 
        error: 'Export folder not configured. Set EXPORT_FOLDER_ID in Code.gs.' 
      };
    }
    
    const fileName = `event_${eventId}.json`;
    const folder = DriveApp.getFolderById(EXPORT_CONFIG.EXPORT_FOLDER_ID);
    const files = folder.getFilesByName(fileName);
    
    if (files.hasNext()) {
      const file = files.next();
      const fileId = file.getId();
      
      return {
        ok: true,
        fileId: fileId,
        fileName: fileName,
        url: `https://drive.google.com/uc?id=${fileId}`,
        directUrl: `https://drive.google.com/uc?id=${fileId}&export=download`,
        publicPageUrl: `${getWebAppUrl()}?p=Public&event=${eventId}`
      };
    } else {
      return { 
        ok: false, 
        error: 'JSON file not found. Export may not have run yet. Wait 1 minute and try again.' 
      };
    }
    
  } catch (error) {
    logError('getEventJSONUrl', error, { eventId });
    return { ok: false, error: String(error) };
  }
}

/**
 * Get the web app URL (for generating public page links)
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Manual export trigger - export all active events NOW
 * Use this for:
 * - Testing the export system
 * - Force-refresh if something looks wrong
 * - Initial setup verification
 */
function manualExportNow() {
  Logger.log('=== Manual export triggered ===');
  const result = exportActiveEventsToJSON();
  Logger.log('Result: ' + JSON.stringify(result));
  return result;
}

/**
 * Test function - export a specific event
 * Good for debugging individual events
 */
function testExportSingleEvent(eventId) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const result = exportEventToJSON(event);
    Logger.log('Export result: ' + JSON.stringify(result));
    return result;
    
  } catch (error) {
    Logger.log('Export failed: ' + error);
    return { ok: false, error: String(error) };
  }
}

// ============================================
// CLIENT-CALLABLE FUNCTIONS
// ============================================

// These functions are called from Admin.html via google.script.run

function clientCreateEvent(brand, eventName, eventDate, eventTime, location, summaryText, summaryLink, summaryImage, videoURLs, bioImage, bioText, bioLink, showSummaryImage, showVideos, showBio, showMetrics) {
  return createEvent({ 
    brand, 
    eventName, 
    eventDate, 
    eventTime, 
    location, 
    summaryText, 
    summaryLink, 
    summaryImage, 
    videoURLs, 
    bioImage, 
    bioText, 
    bioLink,
    showSummaryImage,
    showVideos,
    showBio,
    showMetrics
  });
}

function clientSetupEventTracking(eventId) {
  return setupEventTracking(eventId);
}

function clientGetEvents(brand) {
  return getEvents(brand);
}

function clientGetEventCounts(eventId) {
  return getEventCounts(eventId);
}

function clientGetBrands() {
  return { ok: true, brands: getAvailableBrands() };
}

function clientGetBrandConfig(brand) {
  const config = getBrandConfig(brand);
  return { 
    ok: true, 
    brand: {
      name: config.name,
      shortName: config.shortName,
      colors: config.colors,
      features: config.features
    }
  };
}

function clientGetEventJSONUrl(eventId) {
  return getEventJSONUrl(eventId);
}

function clientManualExportNow() {
  return manualExportNow();
}
