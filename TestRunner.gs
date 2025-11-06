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
