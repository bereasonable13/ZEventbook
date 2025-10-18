/**
 * HTML Integration Contract Tests
 * Validates that HTML pages correctly integrate with Code.gs backend
 * 
 * CRITICAL: These tests ensure UI and backend stay in sync
 * 
 * @integration HTML → NUSDK → Code.gs
 */

const fs = require('fs');
const path = require('path');

// Read the actual HTML and Code.gs files
const srcDir = path.join(__dirname, '../../src');
const adminHtml = fs.readFileSync(path.join(srcDir, 'Admin.html'), 'utf8');
const displayHtml = fs.readFileSync(path.join(srcDir, 'Display.html'), 'utf8');
const publicHtml = fs.readFileSync(path.join(srcDir, 'Public.html'), 'utf8');
const posterHtml = fs.readFileSync(path.join(srcDir, 'Poster.html'), 'utf8');
const nusdkHtml = fs.readFileSync(path.join(srcDir, 'NUSDK.html'), 'utf8');
const codeGs = fs.readFileSync(path.join(srcDir, 'Code.gs'), 'utf8');

describe('HTML Integration Contracts', () => {
  
  describe('RPC Function Contracts', () => {
    
    /**
     * Extract all NU.rpc('functionName') calls from HTML
     */
    function extractRpcCalls(html, filename) {
      const rpcPattern = /NU\.rpc\(['"]([^'"]+)['"]/g;
      const calls = [];
      let match;
      
      while ((match = rpcPattern.exec(html)) !== null) {
        calls.push({
          function: match[1],
          file: filename
        });
      }
      
      return calls;
    }
    
    /**
     * Extract all exported functions from Code.gs
     */
    function extractExportedFunctions(code) {
      const functionPattern = /^function\s+(\w+)\s*\(/gm;
      const functions = [];
      let match;
      
      while ((match = functionPattern.exec(code)) !== null) {
        functions.push(match[1]);
      }
      
      return functions;
    }
    
    test('all NU.rpc calls in Admin.html target exported Code.gs functions', () => {
      const rpcCalls = extractRpcCalls(adminHtml, 'Admin.html');
      const exportedFunctions = extractExportedFunctions(codeGs);
      
      expect(rpcCalls.length).toBeGreaterThan(0);
      
      rpcCalls.forEach(call => {
        expect(exportedFunctions).toContain(call.function);
      });
    });
    
    test('all NU.rpc calls in Display.html target exported Code.gs functions', () => {
      const rpcCalls = extractRpcCalls(displayHtml, 'Display.html');
      const exportedFunctions = extractExportedFunctions(codeGs);
      
      expect(rpcCalls.length).toBeGreaterThan(0);
      
      rpcCalls.forEach(call => {
        expect(exportedFunctions).toContain(call.function);
      });
    });
    
    test('validates all critical Admin.html RPC calls', () => {
      const exportedFunctions = extractExportedFunctions(codeGs);
      
      const criticalCalls = [
        'createEventbook',
        'getEventsSafe',
        'setDefaultEvent',
        'archiveEvent',
        'healthCheck',
        'runContractTests'
      ];
      
      criticalCalls.forEach(funcName => {
        expect(exportedFunctions).toContain(funcName);
      });
    });
    
    test('validates all critical Display.html RPC calls', () => {
      const exportedFunctions = extractExportedFunctions(codeGs);
      
      const criticalCalls = [
        'getPublicBundle',
        'getShareQrVerified'
      ];
      
      criticalCalls.forEach(funcName => {
        expect(exportedFunctions).toContain(funcName);
      });
    });
    
    test('NUSDK correctly wraps google.script.run', () => {
      expect(nusdkHtml).toContain('google.script.run');
      expect(nusdkHtml).toContain('function rpc(method, ...args)');
      expect(nusdkHtml).toMatch(/google\.script\.run[\s\S]*?\.withSuccessHandler/);
    });
    
  });
  
  describe('Element ID Contracts', () => {
    
    /**
     * Extract all getElementById calls from HTML
     */
    function extractElementIds(html) {
      const idPattern = /getElementById\(['"]([^'"]+)['"]\)/g;
      const ids = [];
      let match;
      
      while ((match = idPattern.exec(html)) !== null) {
        ids.push(match[1]);
      }
      
      return [...new Set(ids)];
    }
    
    /**
     * Extract all id="..." attributes from HTML
     */
    function extractDeclaredIds(html) {
      const idPattern = /id=['"]([^'"]+)['"]/g;
      const ids = [];
      let match;
      
      while ((match = idPattern.exec(html)) !== null) {
        ids.push(match[1]);
      }
      
      return [...new Set(ids)];
    }
    
    test('all getElementById calls in Admin.html reference existing elements', () => {
      const usedIds = extractElementIds(adminHtml);
      const declaredIds = extractDeclaredIds(adminHtml);
      
      expect(usedIds.length).toBeGreaterThan(0);
      expect(declaredIds.length).toBeGreaterThan(0);
      
      usedIds.forEach(id => {
        expect(declaredIds).toContain(id);
      });
    });
    
    test('validates critical Admin.html element IDs exist', () => {
      const declaredIds = extractDeclaredIds(adminHtml);
      
      const criticalIds = [
        'form-create',
        'event-name',
        'event-date',
        'create-status',
        'btn-create',
        'events-list',
        'event-details',
        'btn-refresh',
        'btn-set-default',
        'btn-archive'
      ];
      
      criticalIds.forEach(id => {
        expect(declaredIds).toContain(id);
      });
    });
    
    test('all getElementById calls in Display.html reference existing elements', () => {
      const usedIds = extractElementIds(displayHtml);
      const declaredIds = extractDeclaredIds(displayHtml);
      
      expect(usedIds.length).toBeGreaterThan(0);
      
      usedIds.forEach(id => {
        expect(declaredIds).toContain(id);
      });
    });
    
    test('validates critical Display.html element IDs exist', () => {
      const declaredIds = extractDeclaredIds(displayHtml);
      
      const criticalIds = [
        'event-name',
        'event-date',
        'qr-status',
        'qr-container',
        'qr-image',
        'error-container'
      ];
      
      criticalIds.forEach(id => {
        expect(declaredIds).toContain(id);
      });
    });
    
    test('all getElementById calls in Public.html reference existing elements', () => {
      const usedIds = extractElementIds(publicHtml);
      const declaredIds = extractDeclaredIds(publicHtml);
      
      usedIds.forEach(id => {
        expect(declaredIds).toContain(id);
      });
    });
    
    test('all getElementById calls in Poster.html reference existing elements', () => {
      const usedIds = extractElementIds(posterHtml);
      const declaredIds = extractDeclaredIds(posterHtml);
      
      usedIds.forEach(id => {
        expect(declaredIds).toContain(id);
      });
    });
    
  });
  
  describe('Event Handler Contracts', () => {
    
    test('Admin.html form submission handler exists', () => {
      expect(adminHtml).toContain("getElementById('form-create').onsubmit");
      // Old inline pattern no longer used - function is now extracted
    });
    
    test('Admin.html button handlers exist', () => {
      expect(adminHtml).toContain("getElementById('btn-refresh').onclick");
      expect(adminHtml).toContain('loadEvents');
    });
    
    test('Admin.html has required async functions', () => {
      // Check for extracted named async function (better architecture)
      expect(adminHtml).toContain('async function createEvent');
      
      // Verify it's properly wired to the form
      expect(adminHtml).toContain("document.getElementById('form-create').onsubmit = createEvent");
      
      // Also check for other required async functions
      expect(adminHtml).toContain('async function loadEvents');
      expect(adminHtml).toContain('async function setAsDefault');
      expect(adminHtml).toContain('async function archiveEvent');
      expect(adminHtml).toContain('async function runHealthCheck');
      expect(adminHtml).toContain('async function runContractTestsInline');
    });
    
    test('Display.html has required async functions', () => {
      expect(displayHtml).toContain('async function loadDisplay');
      expect(displayHtml).toContain('async function loadQRCode');
    });
    
  });
  
  describe('SDK Integration', () => {
    
    test('NU object is properly exported from NUSDK', () => {
      // Accept IIFE (module pattern) - provides better encapsulation
      expect(nusdkHtml).toContain('window.NU = (function()');
      
      // Verify it uses strict mode
      expect(nusdkHtml).toContain("'use strict'");
      
      // Verify it returns the public API
      expect(nusdkHtml).toContain('return {');
      expect(nusdkHtml).toContain('rpc,');
      expect(nusdkHtml).toContain('log,');
      expect(nusdkHtml).toContain('getBuildInfo,');
      
      // Verify convenience methods are exposed
      expect(nusdkHtml).toContain('info:');
      expect(nusdkHtml).toContain('warn:');
      expect(nusdkHtml).toContain('error:');
      
      // Verify IIFE is immediately invoked
      expect(nusdkHtml).toContain('})();');
      
      // Verify core functions exist (even if private)
      expect(nusdkHtml).toContain('function rpc(method');
      expect(nusdkHtml).toContain('function log(level, where, msg, data)');
    });
    
    test('NU.rpc uses promises correctly', () => {
      expect(nusdkHtml).toMatch(/return new Promise/);
      expect(nusdkHtml).toMatch(/resolve/);
      expect(nusdkHtml).toMatch(/reject/);
    });
    
    test('NU provides logging functions', () => {
      // Check for the main log function (internal implementation)
      expect(nusdkHtml).toContain('function log(level, where, msg, data)');
      
      // Verify log function creates proper entry structure
      expect(nusdkHtml).toContain('level: level');
      expect(nusdkHtml).toContain('where: where');
      expect(nusdkHtml).toContain('msg: msg');
      expect(nusdkHtml).toContain('data: data');
      expect(nusdkHtml).toContain('ts: Date.now()');
      
      // Check for convenience methods - accept arrow functions (modern, idiomatic)
      const hasInfoMethod = 
        nusdkHtml.includes('info: (where, msg, data) => log') ||
        nusdkHtml.includes('info:(where,msg,data)=>log') ||
        nusdkHtml.includes('info: (where, msg, data)=>log');
      
      const hasWarnMethod = 
        nusdkHtml.includes('warn: (where, msg, data) => log') ||
        nusdkHtml.includes('warn:(where,msg,data)=>log') ||
        nusdkHtml.includes('warn: (where, msg, data)=>log');
      
      const hasErrorMethod = 
        nusdkHtml.includes('error: (where, msg, data) => log') ||
        nusdkHtml.includes('error:(where,msg,data)=>log') ||
        nusdkHtml.includes('error: (where, msg, data)=>log');
      
      expect(hasInfoMethod).toBe(true);
      expect(hasWarnMethod).toBe(true);
      expect(hasErrorMethod).toBe(true);
      
      // Verify they delegate to the log function with appropriate levels
      expect(nusdkHtml).toContain("log('info'");
      expect(nusdkHtml).toContain("log('warn'");
      expect(nusdkHtml).toContain("log('error'");
      
      // Verify log function uses RPC to send to server
      expect(nusdkHtml).toContain("rpc('clientLog'");
    });
    
  });
  
  describe('Cross-File Consistency', () => {
    
    test('all HTML pages use consistent NU.rpc pattern', () => {
      const htmlFiles = [
        { name: 'Admin.html', content: adminHtml },
        { name: 'Display.html', content: displayHtml },
        { name: 'Public.html', content: publicHtml },
        { name: 'Poster.html', content: posterHtml }
      ];
      
      htmlFiles.forEach(file => {
        const hasNuRpc = file.content.includes('NU.rpc');
        const hasDirectGoogleScript = file.content.includes('google.script.run') && 
                                      file.name !== 'NUSDK.html';
        
        if (hasNuRpc) {
          expect(hasDirectGoogleScript).toBe(false);
        }
      });
    });
    
    test('no duplicate element IDs across Admin.html', () => {
      const declaredIds = extractDeclaredIds(adminHtml);
      const uniqueIds = [...new Set(declaredIds)];
      
      expect(declaredIds.length).toBe(uniqueIds.length);
    });
    
  });
  
});

describe('Critical User Flows (Integration)', () => {
  
  test('Admin.html event creation flow is wired correctly', () => {
    // Verify the flow: form submit → createEvent → NU.rpc → createEventbook
    expect(adminHtml).toContain("getElementById('form-create').onsubmit");
    expect(adminHtml).toContain("NU.rpc('createEventbook'");
    expect(adminHtml).toContain('await loadEvents(true)');
    
    // Verify createEventbook exists in backend
    expect(codeGs).toContain('function createEventbook');
  });
  
  test('Admin.html event list loading flow is wired correctly', () => {
    // Verify the flow: loadEvents → NU.rpc → getEventsSafe
    expect(adminHtml).toContain('async function loadEvents');
    expect(adminHtml).toContain("NU.rpc('getEventsSafe'");
    
    // Verify getEventsSafe exists in backend
    expect(codeGs).toContain('function getEventsSafe');
  });
  
  test('Display.html event display flow is wired correctly', () => {
    // Verify the flow: loadDisplay → NU.rpc → getPublicBundle
    expect(displayHtml).toContain('async function loadDisplay');
    expect(displayHtml).toContain("NU.rpc('getPublicBundle'");
    
    // Verify getPublicBundle exists in backend
    expect(codeGs).toContain('function getPublicBundle');
  });
  
  test('Display.html QR code flow is wired correctly', () => {
    // Verify the flow: loadQRCode → NU.rpc → getShareQrVerified
    expect(displayHtml).toContain('async function loadQRCode');
    expect(displayHtml).toContain("NU.rpc('getShareQrVerified'");
    
    // Verify getShareQrVerified exists in backend
    expect(codeGs).toContain('function getShareQrVerified');
  });
  
});

/**
 * Helper function to extract element IDs
 */
function extractDeclaredIds(html) {
  const idPattern = /id=['"]([^'"]+)['"]/g;
  const ids = [];
  let match;
  
  while ((match = idPattern.exec(html)) !== null) {
    ids.push(match[1]);
  }
  
  return [...new Set(ids)];
}
