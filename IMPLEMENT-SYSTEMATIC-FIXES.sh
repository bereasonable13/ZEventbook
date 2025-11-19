#!/bin/bash

echo "=========================================="
echo "SYSTEMATIC IMPLEMENTATION PLAN"
echo "Based on Multi-Perspective Analysis"
echo "=========================================="
echo ""

cat << 'ENDPLAN'
PRIORITY 1: Single Admin Implementation
========================================
Action: Merge Admin-IMPROVED.html → Admin.html
- Two-step brand → entity selection
- Clear labels and UX
- Single source of truth

PRIORITY 2: Config Contract Centralization
========================================
Action: Formalize Config.gs structure with JSDoc types
- Define Brand, Entity, BrandConfig interfaces
- Make DOMAIN_TO_BRAND derive from BRANDS
- Single source: Config.gs for prod, test-config.js for tests

PRIORITY 3: RPC Surface Contract
========================================
Action: Document all RPC endpoints
- Create RPC_REGISTRY in NUSDK
- Add Jest tests to verify each endpoint exists
- Type definitions for args/returns

PRIORITY 4: DRY Styling
========================================
Action: Consolidate all CSS to Styles.html
- Remove inline styles from Admin, Test, HealthCheck
- Use shared components consistently
- Single header include pattern

PRIORITY 5: E2E Test Framework
========================================
Action: Add Playwright tests driven by test-config.js
- Admin smoke test per brand
- Public/Poster load tests
- HealthCheck validation
- Automated regression suite

PRIORITY 6: CI/CD Pipeline
========================================
Action: GitHub Actions workflow
- Run Jest on every push
- Deploy via clasp
- Run E2E tests against deployment
- Quality gates (tests + HealthCheck)

IMPLEMENTATION ORDER:
1. Fix entity dropdown (blocking issue)
2. Merge Admin variants (Priority 1)
3. Formalize config (Priority 2)
4. Add RPC contract (Priority 3)
5. Consolidate styles (Priority 4)
6. E2E tests (Priority 5)
7. CI/CD (Priority 6)
ENDPLAN

echo ""
echo "=========================================="
echo "STEP 1: FIX ENTITY DROPDOWN (BLOCKING)"
echo "=========================================="
echo ""

# First, let's test if getConfig works
cat << 'ENDTEST'
Before we implement improvements, we need to fix the blocking issue:

CONSOLE TEST NEEDED:
1. Open: https://script.google.com/macros/s/AKfycbzxPOs9lqA-vQOYfw3iGYqEdGPQwrqCDvhkrEMk51m2JCZmRffhbbdNARGed-UpBeFK/exec?p=admin&brand=ABC

2. Open Console (F12, click "Console" tab)

3. Paste:
google.script.run
  .withSuccessHandler(function(result) {
    console.log('✓ SUCCESS:', result);
    console.log('ABC entities:', result.BRANDS.ABC.entities);
  })
  .withFailureHandler(function(error) {
    console.error('✗ FAILED:', error);
  })
  .getConfig();

4. Report results!

If SUCCESS: We proceed with Admin merge
If FAILED: We debug backend first
ENDTEST

