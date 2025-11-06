/**
 * NextUp Event Manager - Backend
 * Version: 4.1.2 (Named Spreadsheet Pattern)
 * Built: November 3, 2025
 * 
 * UPDATES IN 4.1.2:
 * + Named spreadsheet pattern: zeventbook-{BRAND}-events-{YEAR}
 * + Auto-creates master spreadsheet on first run
 * + Script Properties caching for performance
 * + All functions pass brand parameter correctly
 * 
 * SPREADSHEET PATTERN:
 * - zeventbook-ABC-events-2025 (American Bocce Co.)
 * - zeventbook-CBC-events-2025 (Chicago Bocce Club)
 * - One master registry per brand per year
 */

// ============================================
// CONFIGURATIONS
// ============================================

const CONFIG = {
  APP_NAME: 'NextUp Event Manager',
  VERSION: '4.2.0-EntityArchitecture',
  BUILD_DATE: '2025-11-06',

  // Multi-brand configuration
  BRANDS: {
    'ABC': {
      name: 'American Bocce Co.',
      shortName: 'ABC',
      entities: [        { id: 'ABC-Leagues', name: 'ABC Leagues' },        { id: 'ABC-Tournaments', name: 'ABC Tournaments' },        { id: 'ABC-ChicagoBocceClub', name: 'Chicago Bocce Club' },        { id: 'ABC-ChicagoBocceLeague', name: 'Chicago Bocce League' },        { id: 'ABC-Other', name: 'Other' }      ],
      entities: [
        { id: 'ABC-Leagues', name: 'ABC Leagues' },
        { id: 'ABC-Tournaments', name: 'ABC Tournaments' },
        { id: 'ABC-ChicagoBocceClub', name: 'Chicago Bocce Club' },
        { id: 'ABC-ChicagoBocceLeague', name: 'Chicago Bocce League' },
        { id: 'ABC-Other', name: 'Other' }
      ],
      colors: {
        primary: '#c8102e',
        secondary: '#f5f1e8',
        accent: '#00a651'
      },
      features: {
        eventOnly: true,
        tournament: false,
        season: false,
        seasonTournament: false
      },
      formBranding: {
        headerImage: 'https://www.americanbocceco.com/logo.png',
        backgroundColor: '#c8102e',
        textColor: '#ffffff'
      }
    }
  },
  
  DEFAULT_BRAND: 'ABC',
  CONTROL_SPREADSHEET_NAME: 'zeventbook-control',
  CONTROL_SPREADSHEET_NAME: 'zeventbook-control',
  EVENTS_SHEET_NAME: 'Events',
  ERROR_LOG_SHEET_NAME: 'ErrorLog',
  QR_CODE_SIZE: 300,
  QR_CODE_API: 'https://api.qrserver.com/v1/create-qr-code/',
  
  FORM_FIELDS: {
    registration: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Email Address', type: 'TEXT', required: true },
      { title: 'Phone Number', type: 'TEXT', required: true }
    ],
    checkin: [
      { title: 'Full Name', type: 'TEXT', required: true },
      { title: 'Phone Number', type: 'TEXT', required: true }
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
    const brandSlug = e.parameter.brand || e.parameter.b || 'abc';
    const brand = getBrand(brandSlug);
    const page = e.parameter.p || 'Admin';
    const template = HtmlService.createTemplateFromFile(page);
    
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
    if (brand) template.brand = brand;
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
// SPREADSHEET HELPERS (Updated for Named Pattern)
// ============================================

/**
 * Get or create master events registry spreadsheet
 * Pattern: zeventbook-{BRAND}-events-{YEAR}
 * Example: zeventbook-ABC-events-2025
 */
function getSpreadsheet(brand) {
  const year = new Date().getFullYear();
  const brandSlug = (brand || CONFIG.DEFAULT_BRAND).toUpperCase();
  const spreadsheetName = `zeventbook-${brandSlug}-events-${year}`;
  
  // Try to get cached ID from Script Properties
  const props = PropertiesService.getScriptProperties();
  const cacheKey = `spreadsheet_${brandSlug}_${year}`;
  const cachedId = props.getProperty(cacheKey);
  
  if (cachedId) {
    try {
      const ss = SpreadsheetApp.openById(cachedId);
      // Verify it still exists and has correct name
      if (ss.getName() === spreadsheetName) {
        return ss;
      }
    } catch (e) {
      // Cached ID is invalid, clear it
      props.deleteProperty(cacheKey);
    }
  }
  
  // Search for spreadsheet by name
  const files = DriveApp.getFilesByName(spreadsheetName);
  if (files.hasNext()) {
    const file = files.next();
    const ss = SpreadsheetApp.openById(file.getId());
    
    // Cache the ID for performance
    props.setProperty(cacheKey, file.getId());
    
    Logger.log(`Found existing spreadsheet: ${spreadsheetName}`);
    return ss;
  }
  
  // Create new spreadsheet
  const ss = SpreadsheetApp.create(spreadsheetName);
  
  // Cache the ID
  props.setProperty(cacheKey, ss.getId());
  
  Logger.log(`Created new master spreadsheet: ${spreadsheetName} (${ss.getId()})`);
  
  return ss;
}

function getOrCreateSheet(sheetName, brand) {
  const ss = getSpreadsheet(brand);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    if (sheetName === CONFIG.EVENTS_SHEET_NAME) {
      // Initialize Events sheet with headers
      sheet.getRange(1, 1, 1, 26).setValues([[
        'Event ID', 'Brand', 'Entity', 'Event Name', 'Event Date', 'Created At',
        'Registration Form ID', 'Check-In Form ID', 'Walk-In Form ID', 'Survey Form ID',
        'Data Sheet ID', 'Status',
        'Summary Text', 'Summary Link', 'Summary Image',
        'Event Location', 'Video URLs',
        'Bio Image', 'Bio Text', 'Bio Link', 'Event Time',
        'Show Summary Image', 'Show Videos', 'Show Bio', 'Show Metrics',
        'Display Mode', 'Carousel URLs'
      ]]);
      sheet.setFrozenRows(1);
      
      Logger.log(`Initialized ${sheetName} sheet with headers`);
    }
  }
  
  return sheet;
}

// ============================================
// EVENT MANAGEMENT
// ============================================

function createEvent(data) {
  try {
    const validation = validateEventInput(data);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }
    
    const validated = validation.data;
    const brandConfig = CONFIG.BRANDS[validated.brand];
    
    if (!brandConfig || !brandConfig.features.eventOnly) {
      return { ok: false, error: 'Invalid brand or Event Only not available' };
    }
    
    const eventId = generateEventId();
    const createdAt = new Date().toISOString();
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, validated.brand);
    
    sheet.appendRow([
      eventId,
      validated.brand,
      validated.entity || '',
      validated.eventName,
      validated.eventDate,
      createdAt,
      '', '', '', '',
      '',
      'CREATED',
      validated.summaryText || '',
      validated.summaryLink || '',
      validated.summaryImage || '',
      validated.location || '',
      validated.videoURLs || '',
      validated.bioImage || '',
      validated.bioText || '',
      validated.bioLink || '',
      validated.eventTime || '',
      validated.showSummaryImage !== false,
      validated.showVideos !== false,
      validated.showBio !== false,
      validated.showMetrics !== false,
      'same_as_public',
      ''
    ]);
    
    logActivity('createEvent', { eventId, brand: validated.brand });
    
    return {
      ok: true,
      eventId: eventId,
      event: {
        eventId,
        brand: validated.brand,
        eventName: validated.eventName,
        eventDate: validated.eventDate,
        createdAt,
        status: 'CREATED'
      }
    };
    
  } catch (error) {
    logError('createEvent', error, data);
    return { ok: false, error: String(error) };
  }
}

function setupEventTracking(eventId) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const brandConfig = CONFIG.BRANDS[event.brand];
    const dataSheet = createEventDataSheet(event.eventName);
    
    const forms = {
      registration: createForm('Registration', event, brandConfig, dataSheet.registrationSheetId),
      checkin: createForm('Check-In', event, brandConfig, dataSheet.checkinSheetId),
      walkin: createForm('Walk-In', event, brandConfig, dataSheet.walkinSheetId),
      survey: createForm('Survey', event, brandConfig, dataSheet.surveySheetId)
    };
    
    const qrCodes = {
      registration: generateQRCode(forms.registration.url),
      checkin: generateQRCode(forms.checkin.url),
      walkin: generateQRCode(forms.walkin.url),
      survey: generateQRCode(forms.survey.url)
    };
    
    updateEventFormIds(eventId, event.brand, {
      registrationFormId: forms.registration.id,
      checkinFormId: forms.checkin.id,
      walkinFormId: forms.walkin.id,
      surveyFormId: forms.survey.id,
      dataSheetId: dataSheet.spreadsheetId
    });
    
    logActivity('setupEventTracking', { eventId });
    
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

function getEvents(brand) {
  try {
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, brand);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { ok: true, events: [] };
    }
    
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === brand) {
        events.push(rowToEvent(row));
      }
    }
    
    return { ok: true, events };
    
  } catch (error) {
    logError('getEvents', error, { brand });
    return { ok: false, error: String(error) };
  }
}

function getEventById(eventId) {
  try {
    // Try all brands since we don't know which brand this event belongs to
    const brands = Object.keys(CONFIG.BRANDS);
    
    for (const brand of brands) {
      const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, brand);
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === eventId) {
          return rowToEvent(data[i]);
        }
      }
    }
    
    return null;
  } catch (error) {
    logError('getEventById', error, { eventId });
    return null;
  }
}

function rowToEvent(row) {
  return {
    eventId: row[0],
    brand: row[1],
    entity: row[2] || '',
    eventName: row[3],
    eventDate: row[4],
    createdAt: row[5],
    registrationFormId: row[6],
    checkinFormId: row[7],
    walkinFormId: row[8],
    surveyFormId: row[9],
    dataSheetId: row[10],
    status: row[11],
    summaryText: row[12] || '',
    summaryLink: row[13] || '',
    summaryImage: row[14] || '',
    location: row[15] || '',
    videoURLs: row[16] || '',
    bioImage: row[17] || '',
    bioText: row[18] || '',
    bioLink: row[19] || '',
    eventTime: row[20] || '',
    showSummaryImage: row[21] !== false,
    showVideos: row[22] !== false,
    showBio: row[23] !== false,
    showMetrics: row[24] !== false,
    displayMode: row[25] || 'same_as_public',
    carouselURLs: row[26] || ''
  };
}

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
// EVENT UPDATE FUNCTIONS
// ============================================

function updateEventDetails(eventId, updates) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, event.brand);
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { ok: false, error: 'Event not found in sheet' };
    }
    
    if (updates.eventName !== undefined) {
      if (updates.eventName.trim().length < 3) {
        return { ok: false, error: 'Event name must be at least 3 characters' };
      }
      sheet.getRange(rowIndex, 3).setValue(updates.eventName.trim());
    }
    
    if (updates.eventDate !== undefined) {
      sheet.getRange(rowIndex, 4).setValue(updates.eventDate);
    }
    
    if (updates.eventTime !== undefined) {
      sheet.getRange(rowIndex, 20).setValue(updates.eventTime.trim());
    }
    
    if (updates.location !== undefined) {
      sheet.getRange(rowIndex, 15).setValue(updates.location.trim());
    }
    
    logActivity('updateEventDetails', { eventId, updates });
    return { ok: true, event: getEventById(eventId) };
    
  } catch (error) {
    logError('updateEventDetails', error, { eventId, updates });
    return { ok: false, error: String(error) };
  }
}

function updateEventContent(eventId, content) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, event.brand);
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { ok: false, error: 'Event not found in sheet' };
    }
    
    if (content.summaryText !== undefined) {
      if (content.summaryText.trim().length < 10) {
        return { ok: false, error: 'Summary text must be at least 10 characters' };
      }
      sheet.getRange(rowIndex, 12).setValue(content.summaryText.trim());
    }
    
    if (content.summaryLink !== undefined) {
      if (!isValidURL(content.summaryLink)) {
        return { ok: false, error: 'Invalid summary link URL' };
      }
      sheet.getRange(rowIndex, 13).setValue(content.summaryLink.trim());
    }
    
    if (content.summaryImage !== undefined) {
      sheet.getRange(rowIndex, 14).setValue(content.summaryImage.trim());
    }
    
    if (content.videoURLs !== undefined) {
      sheet.getRange(rowIndex, 16).setValue(content.videoURLs.trim());
    }
    
    if (content.bioImage !== undefined) {
      sheet.getRange(rowIndex, 17).setValue(content.bioImage.trim());
    }
    
    if (content.bioText !== undefined) {
      sheet.getRange(rowIndex, 18).setValue(content.bioText.trim());
    }
    
    if (content.bioLink !== undefined) {
      sheet.getRange(rowIndex, 19).setValue(content.bioLink.trim());
    }
    
    logActivity('updateEventContent', { eventId, content });
    return { ok: true, event: getEventById(eventId) };
    
  } catch (error) {
    logError('updateEventContent', error, { eventId, content });
    return { ok: false, error: String(error) };
  }
}

function updatePublicConfig(eventId, config) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, event.brand);
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { ok: false, error: 'Event not found in sheet' };
    }
    
    if (config.showSummaryImage !== undefined) {
      sheet.getRange(rowIndex, 21).setValue(config.showSummaryImage);
    }
    
    if (config.showVideos !== undefined) {
      sheet.getRange(rowIndex, 22).setValue(config.showVideos);
    }
    
    if (config.showBio !== undefined) {
      sheet.getRange(rowIndex, 23).setValue(config.showBio);
    }
    
    if (config.showMetrics !== undefined) {
      sheet.getRange(rowIndex, 24).setValue(config.showMetrics);
    }
    
    logActivity('updatePublicConfig', { eventId, config });
    return { ok: true, event: getEventById(eventId) };
    
  } catch (error) {
    logError('updatePublicConfig', error, { eventId, config });
    return { ok: false, error: String(error) };
  }
}

function updateDisplayConfig(eventId, displayConfig) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, event.brand);
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventId) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { ok: false, error: 'Event not found in sheet' };
    }
    
    if (displayConfig.displayMode !== undefined) {
      const validModes = ['same_as_public', 'carousel'];
      if (!validModes.includes(displayConfig.displayMode)) {
        return { ok: false, error: 'Invalid display mode' };
      }
      sheet.getRange(rowIndex, 25).setValue(displayConfig.displayMode);
    }
    
    if (displayConfig.carouselURLs !== undefined) {
      sheet.getRange(rowIndex, 26).setValue(JSON.stringify(displayConfig.carouselURLs));
    }
    
    logActivity('updateDisplayConfig', { eventId, displayConfig });
    return { ok: true, event: getEventById(eventId) };
    
  } catch (error) {
    logError('updateDisplayConfig', error, { eventId, displayConfig });
    return { ok: false, error: String(error) };
  }
}

function updatePosterData(eventId, posterData) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    const qrCodes = {};
    
    if (posterData.url1) {
      qrCodes.url1 = generateQRCode(posterData.url1);
    }
    
    if (posterData.url2) {
      qrCodes.url2 = generateQRCode(posterData.url2);
    }
    
    if (posterData.url3) {
      qrCodes.url3 = generateQRCode(posterData.url3);
    }
    
    logActivity('updatePosterData', { eventId, posterData });
    return { ok: true, qrCodes };
    
  } catch (error) {
    logError('updatePosterData', error, { eventId, posterData });
    return { ok: false, error: String(error) };
  }
}

function getPosterData(eventId) {
  try {
    const event = getEventById(eventId);
    if (!event) {
      return { ok: false, error: 'Event not found' };
    }
    
    return {
      ok: true,
      poster: {
        title: event.eventName,
        summary: event.summaryText,
        imageUrl: event.summaryImage,
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        location: event.location
      }
    };
    
  } catch (error) {
    logError('getPosterData', error, { eventId });
    return { ok: false, error: String(error) };
  }
}

// ============================================
// FORM CREATION
// ============================================

function createForm(formType, event, brandConfig, responseSheetId) {
  const formTitle = `${event.eventName} - ${formType}`;
  const form = FormApp.create(formTitle);
  
  form.setDescription(
    `${brandConfig.name}\n${event.eventName}\n${new Date(event.eventDate).toLocaleDateString()}`
  );
  
  form.setCollectEmail(false);
  
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

function createEventDataSheet(eventName) {
  const ss = SpreadsheetApp.create(`${eventName} - Event Data`);
  const spreadsheetId = ss.getId();
  
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
  if (!data.brand) {
    return { valid: false, error: 'Brand is required' };
  }
  
  if (!data.entity || data.entity.trim().length === 0) {
    return { valid: false, error: 'Entity is required' };
  }
  
  // Validate entity belongs to brand
  const brandConfig = CONFIG.BRANDS[data.brand];
  if (brandConfig && brandConfig.entities) {
    const validEntities = brandConfig.entities.map(e => e.id);
    if (!validEntities.includes(data.entity.trim())) {
      return { valid: false, error: 'Invalid entity "' + data.entity + '" for brand ' + data.brand };
    }
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
      entity: data.entity ? data.entity.trim() : '',
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

function updateEventFormIds(eventId, brand, formIds) {
  const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, brand);
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

function getBrand(brandSlug) {
  const key = brandSlug.toUpperCase();
  return CONFIG.BRANDS[key] || CONFIG.BRANDS[CONFIG.DEFAULT_BRAND];
}

function getBrandConfig(brand) {
  return CONFIG.BRANDS[brand] || CONFIG.BRANDS[CONFIG.DEFAULT_BRAND];
}

function getAvailableBrands() {
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
    // Get brand from context or use default
    const brand = (context && context.brand) || CONFIG.DEFAULT_BRAND;
    const sheet = getOrCreateSheet(CONFIG.ERROR_LOG_SHEET_NAME, brand);
    
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
// EXPORT SYSTEM
// ============================================

const EXPORT_CONFIG = {
  EXPORT_FOLDER_ID: '',
  EXPORT_INTERVAL_SECONDS: 60,
  EXPORT_ACTIVE_ONLY: true
};

function exportActiveEventsToJSON() {
  try {
    const startTime = Date.now();
    Logger.log('=== Starting JSON export ===');
    
    if (!EXPORT_CONFIG.EXPORT_FOLDER_ID) {
      Logger.log('⚠️ EXPORT_FOLDER_ID not configured');
      return { ok: false, error: 'Export folder not configured' };
    }
    
    const activeEvents = getActiveEvents();
    if (!activeEvents || activeEvents.length === 0) {
      Logger.log('No active events to export');
      return { ok: true, exported: 0, message: 'No active events' };
    }
    
    const results = { total: activeEvents.length, succeeded: 0, failed: 0, errors: [] };
    
    activeEvents.forEach(event => {
      try {
        exportEventToJSON(event);
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push({ eventId: event.eventId, error: String(error) });
      }
    });
    
    const duration = Date.now() - startTime;
    Logger.log(`=== Export complete in ${duration}ms ===`);
    return { ok: true, results, duration };
    
  } catch (error) {
    logError('exportActiveEventsToJSON', error);
    return { ok: false, error: String(error) };
  }
}

function getActiveEvents() {
  try {
    const brands = Object.keys(CONFIG.BRANDS);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const activeEvents = [];
    
    // Check each brand's spreadsheet
    for (const brand of brands) {
      const sheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, brand);
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) continue;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const eventDate = new Date(row[3]);
        const status = row[10];
        
        if (eventDate >= today && eventDate < tomorrow && status === 'TRACKING_ACTIVE') {
          activeEvents.push(rowToEvent(row));
        }
      }
    }
    
    return activeEvents;
  } catch (error) {
    logError('getActiveEvents', error);
    return [];
  }
}

function exportEventToJSON(event) {
  const bundle = generatePublicBundle(event);
  const json = JSON.stringify(bundle, null, 2);
  const fileName = `event_${event.eventId}.json`;
  const file = createOrUpdateDriveFile(EXPORT_CONFIG.EXPORT_FOLDER_ID, fileName, json);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return {
    ok: true,
    fileId: file.getId(),
    fileName: fileName,
    url: `https://drive.google.com/uc?id=${file.getId()}`
  };
}

function generatePublicBundle(event) {
  const counts = {
    registration: getFormResponseCount(event.registrationFormId),
    checkin: getFormResponseCount(event.checkinFormId),
    walkin: getFormResponseCount(event.walkinFormId),
    survey: getFormResponseCount(event.surveyFormId)
  };
  
  const totalAttendees = counts.checkin + counts.walkin;
  const videoURLs = event.videoURLs 
    ? event.videoURLs.split(',').map(url => url.trim()).filter(url => url.length > 0)
    : [];
  
  return {
    ok: true,
    eventMeta: {
      eventId: event.eventId,
      name: event.eventName,
      dateISO: event.eventDate,
      time: event.eventTime || '',
      location: event.location || '',
      brand: event.brand,
      status: event.status
    },
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
    pageConfig: {
      showSummaryImage: event.showSummaryImage !== false,
      showVideos: event.showVideos !== false,
      showBio: event.showBio !== false,
      showMetrics: event.showMetrics !== false
    },
    metrics: {
      registered: counts.registration,
      checkedIn: counts.checkin,
      walkIns: counts.walkin,
      totalAttendees: totalAttendees,
      surveys: counts.survey,
      showUpRate: counts.registration > 0 ? Math.round((counts.checkin / counts.registration) * 100) : 0,
      walkinRate: totalAttendees > 0 ? Math.round((counts.walkin / totalAttendees) * 100) : 0,
      surveyRate: totalAttendees > 0 ? Math.round((counts.survey / totalAttendees) * 100) : 0
    },
    standings: [],
    schedule: [],
    bracket: {},
    timestamp: Date.now(),
    lastUpdate: new Date().toISOString(),
    exportedBy: 'NextUp v' + CONFIG.VERSION
  };
}

function createOrUpdateDriveFile(folderId, fileName, content) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    const file = files.next();
    file.setContent(content);
    return file;
  } else {
    return folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
  }
}

function getEventJSONUrl(eventId) {
  try {
    if (!EXPORT_CONFIG.EXPORT_FOLDER_ID) {
      return { ok: false, error: 'Export folder not configured' };
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
        publicPageUrl: `${ScriptApp.getService().getUrl()}?p=Public&event=${eventId}`
      };
    } else {
      return { ok: false, error: 'JSON not found. Wait 1 minute and try again.' };
    }
  } catch (error) {
    logError('getEventJSONUrl', error, { eventId });
    return { ok: false, error: String(error) };
  }
}

function manualExportNow() {
  Logger.log('=== Manual export triggered ===');
  const result = exportActiveEventsToJSON();
  Logger.log('Result: ' + JSON.stringify(result));
  return result;
}

// ============================================
// CLIENT-CALLABLE FUNCTIONS
// ============================================

// ==========================================
// CONFIG ACCESS
// ==========================================

/**
 * Get complete configuration object
 * Used by NUSDK and frontend pages
 */
function getConfig() {
  return {
    VERSION: CONFIG.VERSION,
    BRANDS: CONFIG.BRANDS,
    DOMAIN_TO_BRAND: CONFIG.DOMAIN_TO_BRAND,
    DEFAULT_BRAND: 'ABC'
  };
}


function clientCreateEvent(brand, entity, eventName, eventDate, eventTime, location, summaryText, summaryLink, summaryImage, videoURLs, bioImage, bioText, bioLink, showSummaryImage, showVideos, showBio, showMetrics) {
  return createEvent({ 
    brand, entity, eventName, eventDate, eventTime, location, 
    summaryText, summaryLink, summaryImage, videoURLs, 
    bioImage, bioText, bioLink,
    showSummaryImage, showVideos, showBio, showMetrics
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

function clientUpdateEventDetails(eventId, updates) {
  return updateEventDetails(eventId, updates);
}

function clientUpdateEventContent(eventId, content) {
  return updateEventContent(eventId, content);
}

function clientUpdatePublicConfig(eventId, config) {
  return updatePublicConfig(eventId, config);
}

function clientUpdateDisplayConfig(eventId, displayConfig) {
  return updateDisplayConfig(eventId, displayConfig);
}

function clientUpdatePosterData(eventId, posterData) {
  return updatePosterData(eventId, posterData);
}

function clientGetPosterData(eventId) {
  return getPosterData(eventId);
}
/**
 * Create mock sponsor analytics dashboard
 * Run this once to set up demo data
 */
function createMockSponsorDashboard() {
  // Create new spreadsheet
  const ss = SpreadsheetApp.create('NextUp - Sponsor ROI Dashboard (DEMO)');
  const sheet = ss.getActiveSheet();
  sheet.setName('Event Analytics');
  
  // Headers with styling
  const headers = [
    'Event Name', 'Entity', 'Date', 
    'Poster Scans', 'Display Impressions', 'Web Views',
    'Total Touchpoints', 'Registrations', 'Conversion %',
    'Sponsor Cost', 'Cost Per Touch', 'ROI Status'
  ];
  
  sheet.getRange(1, 1, 1, 12).setValues([headers]);
  sheet.getRange(1, 1, 1, 12).setFontWeight('bold');
  sheet.getRange(1, 1, 1, 12).setBackground('#c8102e');
  sheet.getRange(1, 1, 1, 12).setFontColor('#ffffff');
  
  // Mock data for 10 events
  const mockData = [
    ['ABC Open 2024', 'ABC-Tournaments', '2024-12-14', 347, 2450, 892, 3689, 234, '26.2%', '$5,000', '$1.35', 'Excellent'],
    ['Summer League Night', 'ABC-Leagues', '2024-07-15', 156, 1230, 445, 1831, 112, '25.2%', '$2,000', '$1.09', 'Excellent'],
    ['CBC Fall Social', 'ABC-ChicagoBocceClub', '2024-09-20', 289, 1890, 672, 2851, 178, '26.5%', '$3,500', '$1.23', 'Excellent'],
    ['CBL Championship', 'ABC-ChicagoBocceLeague', '2024-10-05', 412, 3120, 1045, 4577, 298, '28.5%', '$7,500', '$1.64', 'Good'],
    ['Spring Tournament', 'ABC-Tournaments', '2024-04-12', 234, 1670, 523, 2427, 156, '29.8%', '$3,000', '$1.24', 'Excellent'],
    ['Monday Night League', 'ABC-Leagues', '2024-06-03', 89, 890, 267, 1246, 67, '25.1%', '$1,500', '$1.20', 'Excellent'],
    ['CBC Beer Garden Event', 'ABC-ChicagoBocceClub', '2024-08-15', 456, 2340, 892, 3688, 245, '27.5%', '$4,000', '$1.08', 'Excellent'],
    ['CBL Playoff Series', 'ABC-ChicagoBocceLeague', '2024-11-02', 378, 2890, 723, 3991, 267, '26.9%', '$6,000', '$1.50', 'Good'],
    ['Winter League Kickoff', 'ABC-Leagues', '2024-01-08', 198, 1450, 534, 2182, 145, '27.2%', '$2,500', '$1.15', 'Excellent'],
    ['ABC Regional Finals', 'ABC-Tournaments', '2024-11-20', 523, 3560, 1234, 5317, 389, '29.6%', '$8,000', '$1.50', 'Excellent']
  ];
  
  sheet.getRange(2, 1, 10, 12).setValues(mockData);
  
  // Format numbers
  sheet.getRange(2, 4, 10, 3).setNumberFormat('#,##0');
  sheet.getRange(2, 7, 10, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 8, 10, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 10, 10, 1).setNumberFormat('$#,##0');
  sheet.getRange(2, 11, 10, 1).setNumberFormat('$0.00');
  
  // Add summary row
  sheet.getRange(12, 1).setValue('TOTAL/AVERAGE:');
  sheet.getRange(12, 1).setFontWeight('bold');
  sheet.getRange(12, 4).setFormula('=SUM(D2:D11)');
  sheet.getRange(12, 5).setFormula('=SUM(E2:E11)');
  sheet.getRange(12, 6).setFormula('=SUM(F2:F11)');
  sheet.getRange(12, 7).setFormula('=SUM(G2:G11)');
  sheet.getRange(12, 8).setFormula('=SUM(H2:H11)');
  sheet.getRange(12, 10).setFormula('=SUM(J2:J11)');
  sheet.getRange(12, 11).setFormula('=AVERAGE(K2:K11)');
  
  // Auto-resize
  sheet.autoResizeColumns(1, 12);
  
  // Create Summary Dashboard sheet
  const dashboardSheet = ss.insertSheet('Sponsor Dashboard');
  
  // Dashboard header
  dashboardSheet.getRange('A1:F1').merge();
  dashboardSheet.getRange('A1').setValue('NextUp Sponsor ROI Dashboard');
  dashboardSheet.getRange('A1').setFontSize(18);
  dashboardSheet.getRange('A1').setFontWeight('bold');
  dashboardSheet.getRange('A1').setBackground('#c8102e');
  dashboardSheet.getRange('A1').setFontColor('#ffffff');
  dashboardSheet.getRange('A1').setHorizontalAlignment('center');
  
  // Key metrics
  dashboardSheet.getRange('A3').setValue('TOTAL CAMPAIGN REACH');
  dashboardSheet.getRange('B3').setFormula('=\'Event Analytics\'!G12');
  dashboardSheet.getRange('B3').setNumberFormat('#,##0');
  dashboardSheet.getRange('B3').setFontSize(24);
  dashboardSheet.getRange('B3').setFontWeight('bold');
  
  dashboardSheet.getRange('A5').setValue('Total Investment:');
  dashboardSheet.getRange('B5').setFormula('=\'Event Analytics\'!J12');
  dashboardSheet.getRange('B5').setNumberFormat('$#,##0');
  
  dashboardSheet.getRange('A6').setValue('Average Cost Per Touch:');
  dashboardSheet.getRange('B6').setFormula('=\'Event Analytics\'!K12');
  dashboardSheet.getRange('B6').setNumberFormat('$0.00');
  
  dashboardSheet.getRange('A7').setValue('Total Registrations:');
  dashboardSheet.getRange('B7').setFormula('=\'Event Analytics\'!H12');
  dashboardSheet.getRange('B7').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A8').setValue('Average Conversion:');
  dashboardSheet.getRange('B8').setValue('27.2%');
  
  dashboardSheet.getRange('A10').setValue('BREAKDOWN BY CHANNEL:');
  dashboardSheet.getRange('A10').setFontWeight('bold');
  
  dashboardSheet.getRange('A11').setValue('Poster QR Scans:');
  dashboardSheet.getRange('B11').setFormula('=\'Event Analytics\'!D12');
  dashboardSheet.getRange('B11').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A12').setValue('Display Impressions:');
  dashboardSheet.getRange('B12').setFormula('=\'Event Analytics\'!E12');
  dashboardSheet.getRange('B12').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A13').setValue('Web Page Views:');
  dashboardSheet.getRange('B13').setFormula('=\'Event Analytics\'!F12');
  dashboardSheet.getRange('B13').setNumberFormat('#,##0');
  
  dashboardSheet.getRange('A15').setValue('ROI ASSESSMENT:');
  dashboardSheet.getRange('A15').setFontWeight('bold');
  dashboardSheet.getRange('A16').setValue('✓ Cost per touchpoint under $1.50 target');
  dashboardSheet.getRange('A17').setValue('✓ Conversion rate above 25% benchmark');
  dashboardSheet.getRange('A18').setValue('✓ All events showing positive ROI');
  dashboardSheet.getRange('A19').setValue('✓ Multi-channel reach verified');
  
  // Auto-resize dashboard
  dashboardSheet.autoResizeColumns(1, 6);
  
  Logger.log('Mock Sponsor Dashboard created!');
  Logger.log('URL: ' + ss.getUrl());
  
  return ss.getUrl();
}
/**
 * Phase 1A Test Suite
 * Run this to verify entity architecture works
 */
function runPhase1ATests() {
  Logger.clear();
  Logger.log('==========================================');
  Logger.log('PHASE 1A TEST SUITE');
  Logger.log('==========================================\n');
  
  const results = [];
  
  // TEST 1: Entity configuration exists
  try {
    const entities = CONFIG.BRANDS.ABC.entities;
    if (entities && entities.length === 5) {
      results.push({test: '1. Entity configuration', status: 'PASS', detail: '5 entities configured'});
    } else {
      results.push({test: '1. Entity configuration', status: 'FAIL', detail: `Found ${entities?.length || 0} entities`});
    }
  } catch (e) {
    results.push({test: '1. Entity configuration', status: 'ERROR', detail: String(e)});
  }
  
  // TEST 2: Spreadsheet has entity column
  try {
    const ss = getSpreadsheet('ABC');
    const sheet = ss.getSheetByName('Events');
    
    if (!sheet) {
      // Sheet doesn't exist yet, create it
      const newSheet = getOrCreateSheet(CONFIG.EVENTS_SHEET_NAME, 'ABC');
      const headers = newSheet.getRange(1, 1, 1, 28).getValues()[0];
      
      if (headers[2] === 'Entity') {
        results.push({test: '2. Spreadsheet entity column', status: 'PASS', detail: 'Column C = Entity'});
      } else {
        results.push({test: '2. Spreadsheet entity column', status: 'FAIL', detail: `Column C = ${headers[2]}`});
      }
    } else {
      const headers = sheet.getRange(1, 1, 1, 28).getValues()[0];
      
      if (headers[2] === 'Entity') {
        results.push({test: '2. Spreadsheet entity column', status: 'PASS', detail: 'Column C = Entity'});
      } else {
        results.push({test: '2. Spreadsheet entity column', status: 'FAIL', detail: `Column C = ${headers[2]}`});
      }
    }
  } catch (e) {
    results.push({test: '2. Spreadsheet entity column', status: 'ERROR', detail: String(e)});
  }
  
  // TEST 3: Entity validation (invalid entity)
  try {
    const result = createEvent({
      brand: 'ABC',
      entity: 'INVALID-ENTITY',
      eventName: 'Test Invalid Entity',
      eventDate: '2025-12-01'
    });
    
    if (!result.ok && result.error.includes('Invalid entity')) {
      results.push({test: '3. Entity validation (reject invalid)', status: 'PASS', detail: 'Invalid entity rejected'});
    } else if (!result.ok && result.error.includes('Entity is required')) {
      results.push({test: '3. Entity validation (reject invalid)', status: 'PASS', detail: 'Empty entity rejected'});
    } else {
      results.push({test: '3. Entity validation (reject invalid)', status: 'FAIL', detail: 'Invalid entity accepted'});
    }
  } catch (e) {
    results.push({test: '3. Entity validation (reject invalid)', status: 'ERROR', detail: String(e)});
  }
  
  // TEST 4: Create event with valid entity
  try {
    const testName = 'Phase1A Test Event ' + Date.now();
    const result = createEvent({
      brand: 'ABC',
      entity: 'ABC-Leagues',
      eventName: testName,
      eventDate: '2025-12-01',
      eventTime: '18:00',
      location: 'Test Venue'
    });
    
    if (result.ok && result.event && result.event.entity === 'ABC-Leagues') {
      results.push({test: '4. Create event with entity', status: 'PASS', detail: `Event ID: ${result.eventId}`});
      
      // Store for next test
      PropertiesService.getScriptProperties().setProperty('test_event_id', result.eventId);
    } else {
      results.push({test: '4. Create event with entity', status: 'FAIL', detail: JSON.stringify(result)});
    }
  } catch (e) {
    results.push({test: '4. Create event with entity', status: 'ERROR', detail: String(e)});
  }
  
  // TEST 5: Verify entity in spreadsheet
  try {
    const testEventId = PropertiesService.getScriptProperties().getProperty('test_event_id');
    
    if (testEventId) {
      const ss = getSpreadsheet('ABC');
      const sheet = ss.getSheetByName('Events');
      const data = sheet.getDataRange().getValues();
      
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === testEventId) {
          if (data[i][2] === 'ABC-Leagues') {
            results.push({test: '5. Entity stored in spreadsheet', status: 'PASS', detail: 'Column C = ABC-Leagues'});
          } else {
            results.push({test: '5. Entity stored in spreadsheet', status: 'FAIL', detail: `Column C = ${data[i][2]}`});
          }
          found = true;
          break;
        }
      }
      
      if (!found) {
        results.push({test: '5. Entity stored in spreadsheet', status: 'FAIL', detail: 'Event not found in sheet'});
      }
    } else {
      results.push({test: '5. Entity stored in spreadsheet', status: 'SKIP', detail: 'No test event created'});
    }
  } catch (e) {
    results.push({test: '5. Entity stored in spreadsheet', status: 'ERROR', detail: String(e)});
  }
  
  // TEST 6: rowToEvent includes entity
  try {
    const testEventId = PropertiesService.getScriptProperties().getProperty('test_event_id');
    
    if (testEventId) {
      const event = getEventById(testEventId);
      
      if (event && event.entity === 'ABC-Leagues' && event.eventName && event.eventDate) {
        results.push({test: '6. rowToEvent maps entity', status: 'PASS', detail: 'All fields mapped correctly'});
      } else {
        results.push({test: '6. rowToEvent maps entity', status: 'FAIL', detail: JSON.stringify(event)});
      }
    } else {
      results.push({test: '6. rowToEvent maps entity', status: 'SKIP', detail: 'No test event created'});
    }
  } catch (e) {
    results.push({test: '6. rowToEvent maps entity', status: 'ERROR', detail: String(e)});
  }
  
  // TEST 7: Control spreadsheet exists
  try {
    if (typeof getControlSpreadsheet === 'function') {
      const controlSS = getControlSpreadsheet();
      const sheet = controlSS.getSheetByName('AllEvents');
      
      if (sheet) {
        const headers = sheet.getRange(1, 1, 1, 13).getValues()[0];
        if (headers[2] === 'Entity') {
          results.push({test: '7. Control spreadsheet', status: 'PASS', detail: 'Control sheet exists with Entity column'});
          
          // Log URL for manual verification
          Logger.log('\n>>> Control Spreadsheet URL: ' + controlSS.getUrl() + '\n');
        } else {
          results.push({test: '7. Control spreadsheet', status: 'FAIL', detail: `Column C = ${headers[2]}`});
        }
      } else {
        results.push({test: '7. Control spreadsheet', status: 'FAIL', detail: 'AllEvents sheet not found'});
      }
    } else {
      results.push({test: '7. Control spreadsheet', status: 'SKIP', detail: 'getControlSpreadsheet not implemented'});
    }
  } catch (e) {
    results.push({test: '7. Control spreadsheet', status: 'ERROR', detail: String(e)});
  }
  
  // TEST 8: Control spreadsheet sync
  try {
    const testEventId = PropertiesService.getScriptProperties().getProperty('test_event_id');
    
    if (testEventId && typeof syncToControlSpreadsheet === 'function') {
      const event = getEventById(testEventId);
      const syncResult = syncToControlSpreadsheet(event);
      
      if (syncResult && syncResult.ok) {
        results.push({test: '8. Control spreadsheet sync', status: 'PASS', detail: 'Event synced successfully'});
      } else {
        results.push({test: '8. Control spreadsheet sync', status: 'FAIL', detail: JSON.stringify(syncResult)});
      }
    } else {
      results.push({test: '8. Control spreadsheet sync', status: 'SKIP', detail: 'No test event or sync not implemented'});
    }
  } catch (e) {
    results.push({test: '8. Control spreadsheet sync', status: 'ERROR', detail: String(e)});
  }
  
  // SUMMARY
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  Logger.log('\n==========================================');
  Logger.log('TEST RESULTS SUMMARY');
  Logger.log('==========================================');
  Logger.log(`✓ PASS:   ${passed}`);
  Logger.log(`✗ FAIL:   ${failed}`);
  Logger.log(`⚠ ERROR:  ${errors}`);
  Logger.log(`○ SKIP:   ${skipped}`);
  Logger.log(`  TOTAL:  ${results.length}`);
  Logger.log('==========================================\n');
  
  results.forEach(r => {
    let symbol;
    switch(r.status) {
      case 'PASS': symbol = '✓'; break;
      case 'FAIL': symbol = '✗'; break;
      case 'ERROR': symbol = '⚠'; break;
      case 'SKIP': symbol = '○'; break;
    }
    Logger.log(`${symbol} ${r.test}: ${r.status}`);
    Logger.log(`  ${r.detail}`);
  });
  
  // Clean up test data
  const testEventId = PropertiesService.getScriptProperties().getProperty('test_event_id');
  if (testEventId) {
    PropertiesService.getScriptProperties().deleteProperty('test_event_id');
  }
  
  Logger.log('\n==========================================');
  if (failed === 0 && errors === 0) {
    Logger.log('✅ ALL TESTS PASSED - Ready for ABC Open!');
  } else {
    Logger.log('⚠️  FAILURES DETECTED - Fix before ABC Open!');
  }
  Logger.log('==========================================');
  
  return results;
}

/**
 * Quick smoke test - run this after any changes
 */
function quickSmokeTest() {
  Logger.clear();
  Logger.log('=== QUICK SMOKE TEST ===\n');
  
  // Test 1: Can create event with entity
  try {
    const result = createEvent({
      brand: 'ABC',
      entity: 'ABC-Tournaments',
      eventName: 'Smoke Test ' + Date.now(),
      eventDate: '2025-12-01'
    });
    
    if (result.ok) {
      Logger.log('✓ Event creation works');
      Logger.log(`  Event ID: ${result.eventId}`);
      return true;
    } else {
      Logger.log('✗ Event creation failed');
      Logger.log(`  Error: ${result.error}`);
      return false;
    }
  } catch (e) {
    Logger.log('✗ Event creation error');
    Logger.log(`  ${String(e)}`);
    return false;
  }
}
