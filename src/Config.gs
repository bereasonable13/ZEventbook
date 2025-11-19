/**
 * Config.gs - Centralized Configuration and Template Processing
 */

function getTemplateConfig() {
  const tenantId = getTenantId();
  const tenant = findTenant_(tenantId);
  
  return {
    appTitle: "Zeventbook · events",
    tenantId: tenantId,
    ZEB: {
      BUILD_ID: getBuildId(),
      DEMO_MODE: {
        showBadge: false,
        showDebugPanel: false,
        showApiTiming: false,
        showErrorDetails: true,
        enableConsoleLogging: true,
        enablePrefill: false,
        badgeText: "DEMO",
        badgeColor: "#667eea",
        showWatermark: false,
        highlightNewFeatures: false,
        showHelpTooltips: false,
        showPrefillButton: false,
        sampleEvent: null,
        sampleSponsor: null
      }
    },
    findTenant_: findTenant_,
    tenant: tenant
  };
}

function evaluateTemplate(filename) {
  try {
    Logger.log('Evaluating template: ' + filename);
    const template = HtmlService.createTemplateFromFile(filename);
    const config = getTemplateConfig();
    Object.keys(config).forEach(key => {
      template[key] = config[key];
    });
    Logger.log('Template config injected successfully');
    return template.evaluate()
      .setTitle(config.appTitle)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    Logger.log('ERROR - Template evaluation failed: ' + error.toString());
    return HtmlService.createHtmlOutput(
      '<h1>Template Error</h1><p>Failed to load template: ' + filename + '</p><pre>' + error.toString() + '</pre>'
    ).setTitle('Error');
  }
}

function getBuildId() {
  return "v4.1.0-dev";
}

function getTenantId() {
  const stored = PropertiesService.getScriptProperties().getProperty('TENANT_ID');
  return stored || 'root';
}

function setTenantId(tenantId) {
  PropertiesService.getScriptProperties().setProperty('TENANT_ID', tenantId);
  Logger.log('Tenant ID set to: ' + tenantId);
}

function setBuildId(buildId) {
  PropertiesService.getScriptProperties().setProperty('BUILD_ID', buildId);
  Logger.log('Build ID set to: ' + buildId);
}

function findTenant_(tenantId) {
  const tenants = {
    'root': {
      name: 'Root Tenant',
      logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
      primaryColor: '#2563eb'
    },
    'abc': {
      name: 'American Bocce Co',
      logoUrl: '/My files/Linux files/zeventbook/assets/logos/ABCMainTransparent.webp',
      primaryColor: '#2563eb'
    }
  };
  return tenants[tenantId] || tenants['root'];
}
