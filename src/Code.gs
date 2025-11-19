/**
 * Code.gs - Main Entry Point
 */

function doGet(e) {
  Logger.log('doGet called with parameters: ' + JSON.stringify(e.parameter));
  const page = e.parameter.page || 'admin';
  const mode = e.parameter.mode || 'wizard';
  let templateName;
  
  if (page === 'admin') {
    templateName = (mode === 'wizard') ? 'admin-wizard' : 'admin';
    Logger.log('Serving admin page in ' + mode + ' mode');
  } else {
    templateName = page;
    Logger.log('Serving page: ' + page);
  }
  
  return evaluateTemplate(templateName);
}

function doPost(e) {
  Logger.log('doPost called');
  try {
    const data = JSON.parse(e.postData.contents);
    Logger.log('POST data: ' + JSON.stringify(data));
    const response = { ok: true, message: 'POST received', data: data };
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('ERROR in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function testTemplateProcessing() {
  Logger.log('=== Testing Template Processing ===');
  const config = getTemplateConfig();
  Logger.log('Config retrieved: ' + JSON.stringify(config, null, 2));
  Logger.log('App Title: ' + config.appTitle);
  Logger.log('Tenant ID: ' + config.tenantId);
  Logger.log('Build ID: ' + config.ZEB.BUILD_ID);
  Logger.log('=== Test Complete ===');
}

function initializeProperties() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TENANT_ID')) {
    props.setProperty('TENANT_ID', 'root');
    Logger.log('Set default TENANT_ID: root');
  }
  if (!props.getProperty('BUILD_ID')) {
    props.setProperty('BUILD_ID', 'v4.1.0-dev');
    Logger.log('Set default BUILD_ID: v4.1.0-dev');
  }
  Logger.log('Properties initialized');
}
