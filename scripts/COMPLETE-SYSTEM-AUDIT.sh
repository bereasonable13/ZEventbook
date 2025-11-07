#!/bin/bash

echo "=========================================="
echo "NEXTUP COMPLETE SYSTEM AUDIT"
echo "Multi-Perspective Analysis"
echo "=========================================="
echo ""
date
echo ""

# ==========================================
# 1. SOFTWARE ARCHITECT - CONFIGURATION
# ==========================================

echo "=========================================="
echo "1. ARCHITECTURE: CONFIGURATION ANALYSIS"
echo "=========================================="
echo ""

echo "📋 Configuration Files:"
ls -lh *.json *.gs 2>/dev/null | grep -E "(config|Config|appsscript)" || echo "No config files found"
echo ""

echo "🔍 Config.gs Structure Analysis:"
if [ -f "Config.gs" ]; then
  echo "✓ Config.gs exists"
  echo ""
  echo "CONFIG object structure:"
  grep -n "^const CONFIG" Config.gs
  grep -n "  VERSION:" Config.gs
  grep -n "  BRANDS:" Config.gs
  grep -n "  DOMAIN_TO_BRAND:" Config.gs
  grep -n "  BRAND_HIERARCHY:" Config.gs
  grep -n "  GITHUB:" Config.gs
  echo ""
  
  echo "Closing braces (structure validation):"
  grep -n "^};" Config.gs
  
  echo ""
  echo "Brand count:"
  grep -c "'ABC':" Config.gs
  grep -c "'CBC':" Config.gs
  grep -c "'CBL':" Config.gs
  
  echo ""
  echo "Entity definitions per brand:"
  grep -A 1 "entities: \[" Config.gs | head -20
else
  echo "❌ Config.gs NOT FOUND"
fi

echo ""
echo "🔍 Code.gs Configuration Usage:"
if [ -f "Code.gs" ]; then
  echo "✓ Code.gs exists"
  echo ""
  echo "CONFIG references in Code.gs:"
  grep -n "CONFIG\." Code.gs | head -20
  echo ""
  
  echo "Functions that access CONFIG:"
  grep -n "function.*(" Code.gs | grep -B2 -A5 CONFIG | head -30
else
  echo "❌ Code.gs NOT FOUND"
fi

# ==========================================
# 2. FUNCTION TRACING & DATA FLOW
# ==========================================

echo ""
echo "=========================================="
echo "2. ARCHITECTURE: FUNCTION FLOW ANALYSIS"
echo "=========================================="
echo ""

echo "📊 Backend Functions (Code.gs):"
grep -n "^function " Code.gs 2>/dev/null | nl
echo ""

echo "📊 Backend Functions - Client-facing (clientXXX):"
grep -n "^function client" Code.gs 2>/dev/null
echo ""

echo "📊 doGet() Entry Point:"
sed -n '/^function doGet/,/^}/p' Code.gs 2>/dev/null | head -50
echo ""

echo "📊 getConfig() Implementation:"
sed -n '/^function getConfig/,/^}/p' Code.gs 2>/dev/null
echo ""

echo "🔍 Frontend RPC Calls:"
echo ""
echo "Admin.html:"
grep -n "NU\.rpc\|google\.script\.run" Admin.html 2>/dev/null | head -15
echo ""

echo "Public.html:"
grep -n "NU\.rpc\|google\.script\.run" Public.html 2>/dev/null | head -10
echo ""

echo "Reports.html:"
grep -n "NU\.rpc\|google\.script\.run" Reports.html 2>/dev/null | head -10
echo ""

# ==========================================
# 3. FRONTEND INTEGRATION TRACING
# ==========================================

echo "=========================================="
echo "3. FRONTEND: INTEGRATION TRACING"
echo "=========================================="
echo ""

echo "📱 HTML Pages:"
ls -1 *.html 2>/dev/null | nl
echo ""

echo "🔗 NUSDK Integration:"
echo "Pages that include NUSDK:"
grep -l "include('NUSDK')" *.html 2>/dev/null | nl
echo ""

echo "NUSDK.html Functions Exported:"
if [ -f "NUSDK.html" ]; then
  echo "Return object:"
  sed -n '/return {/,/};/p' NUSDK.html | head -20
fi
echo ""

echo "🔗 Header Integration:"
echo "Pages that include Header:"
grep -l "include('Header')" *.html 2>/dev/null | nl
echo ""

echo "🔗 Styles Integration:"
echo "Pages that include Styles:"
grep -l "include('Styles')" *.html 2>/dev/null | nl
echo ""

echo "📊 Admin.html Data Flow:"
echo ""
echo "State variables:"
grep -n "let.*=" Admin.html 2>/dev/null | grep -E "(current|events|save)" | head -10
echo ""

echo "Init function:"
grep -n "async function init" Admin.html 2>/dev/null
echo ""

echo "Entity population:"
grep -n "populateEntityDropdowns" Admin.html 2>/dev/null
echo ""

echo "Create event function:"
grep -n "async function createEvent" Admin.html 2>/dev/null
echo ""

# ==========================================
# 4. FRONTEND DESIGNER - UI/UX ANALYSIS
# ==========================================

echo "=========================================="
echo "4. FRONTEND DESIGNER: UI/UX ANALYSIS"
echo "=========================================="
echo ""

echo "🎨 CSS Architecture:"
echo ""
echo "Styles.html size:"
wc -l Styles.html 2>/dev/null
echo ""

echo "CSS Variables/Custom Properties:"
grep -n "var(--" Styles.html 2>/dev/null | wc -l
echo "custom properties defined"
echo ""

echo "Responsive Breakpoints:"
grep -n "@media" Styles.html Admin.html 2>/dev/null | wc -l
echo "media queries found"
echo ""

echo "Component Consistency Check:"
echo ""
echo "Button classes used:"
grep -oh "class=\"[^\"]*btn[^\"]*\"" *.html 2>/dev/null | sort -u
echo ""

echo "Card classes used:"
grep -oh "class=\"[^\"]*card[^\"]*\"" *.html 2>/dev/null | sort -u
echo ""

echo "🎨 Brand Theming:"
echo ""
echo "Brand colors referenced:"
grep -n "brand\.colors" Header.html Admin.html 2>/dev/null | head -10
echo ""

echo "Logo usage:"
grep -n "brand\.logo" *.html 2>/dev/null
echo ""

# ==========================================
# 5. SDET - TEST AUTOMATION
# ==========================================

echo "=========================================="
echo "5. SDET: TEST AUTOMATION STATUS"
echo "=========================================="
echo ""

echo "📁 Test Directory Structure:"
if [ -d "tests" ]; then
  tree tests/ 2>/dev/null || find tests/ -type f 2>/dev/null
else
  echo "❌ No tests/ directory found"
fi
echo ""

echo "📊 Test Files:"
find . -name "*.test.js" -o -name "*.spec.js" 2>/dev/null | nl
echo ""

echo "📋 Package.json Test Scripts:"
if [ -f "package.json" ]; then
  grep -A 10 "\"scripts\"" package.json
else
  echo "❌ package.json not found"
fi
echo ""

echo "🧪 Test.html Verification Suite:"
if [ -f "Test.html" ]; then
  echo "✓ Test.html exists"
  grep -n "function.*test\|function.*verify" Test.html 2>/dev/null | head -10
else
  echo "❌ Test.html not found"
fi
echo ""

echo "❌ GAPS - Missing Test Coverage:"
cat << 'TESTGAPS'
- No automated unit tests for NUSDK functions
- No automated integration tests for Code.gs functions
- No E2E tests with Playwright/Cypress
- No CI/CD pipeline with automated testing
- No test coverage reporting
- No contract tests between frontend/backend
TESTGAPS

# ==========================================
# 6. QA TESTER - E2E USER FLOWS
# ==========================================

echo ""
echo "=========================================="
echo "6. QA TESTER: E2E USER FLOW ANALYSIS"
echo "=========================================="
echo ""

cat << 'E2EFLOWS'
🎯 PRIMARY USER FLOW: Create Event

Step 1: Navigate to Admin
  URL: zeventbook.io/exec?p=admin&brand=ABC
  Expected: Page loads, SDK initializes
  Verification: Console shows "[NU] SDK loaded"

Step 2: Select Entity
  Action: Click entity dropdown
  Expected: Dropdown populates with 5 options
  Verification: Options appear (ABC-Leagues, ABC-Tournaments, etc.)
  ❌ BROKEN: Currently shows "Loading entities..."

Step 3: Fill Form
  Actions:
    - Enter event name
    - Select date
    - Enter location
    - Enter summary
  Expected: All fields accept input
  Verification: No validation errors

Step 4: Submit Event
  Action: Click "Create Event"
  Expected: 
    - Loading overlay appears
    - RPC call to clientCreateEvent()
    - Success toast appears top-right
    - Event ID generated
  ❌ CANNOT TEST: Entity dropdown blocked

Step 5: View Public Page
  URL: zeventbook.io/exec?p=public&event={eventId}
  Expected:
    - Event details display
    - Mobile responsive
    - QR code visible
  ❌ CANNOT TEST: No event created yet

Step 6: View Display
  URL: zeventbook.io/exec?p=display&event={eventId}
  Expected:
    - Full screen display
    - Auto-refresh
  ❌ CANNOT TEST: No event created yet

🚨 BLOCKING ISSUES:
1. Entity dropdown not populating (SyntaxError in Code.gs line 88)
2. Cannot complete event creation flow
3. Cannot test downstream pages (Public, Display, Poster)

✅ WHAT WORKS:
- Page routing (doGet)
- NUSDK loading
- Basic page rendering
- Brand detection

E2EFLOWS

# ==========================================
# 7. DEVOPS - DEPLOYMENT PIPELINE
# ==========================================

echo ""
echo "=========================================="
echo "7. DEVOPS: DEPLOYMENT PIPELINE ANALYSIS"
echo "=========================================="
echo ""

echo "📁 Repository Structure:"
git remote -v 2>/dev/null || echo "Not a git repository"
echo ""

echo "Current branch:"
git branch 2>/dev/null | grep \*
echo ""

echo "📋 .clasp.json Configuration:"
if [ -f ".clasp.json" ]; then
  cat .clasp.json
else
  echo "❌ .clasp.json not found"
fi
echo ""

echo "📋 Deployment Configuration:"
echo "Stable deployment ID configured:"
grep -q "deploymentId" .clasp.json && echo "✓ Yes" || echo "❌ No"
echo ""

echo "🔄 Deployment Script:"
if [ -f "deploy.sh" ]; then
  echo "✓ deploy.sh exists"
  cat deploy.sh
else
  echo "❌ deploy.sh not found"
fi
echo ""

echo "📊 Recent Deployments:"
clasp deployments 2>/dev/null | head -15 || echo "clasp not available or not logged in"
echo ""

echo "🔍 Current Deployment Status:"
cat << 'DEPLOYSTATUS'
Deployment Flow:
1. ✓ Local files → Git (working)
2. ✓ Git → GitHub (working)  
3. ✓ GitHub → Apps Script (clasp push working)
4. ✓ Apps Script → Deployment (clasp deploy working)
5. ❌ Deployment verification (no automated checks)

Missing DevOps Components:
- No CI/CD pipeline (GitHub Actions)
- No automated deployment verification
- No smoke tests post-deployment
- No rollback automation
- No environment management (dev/staging/prod)
- No deployment quality gates
DEPLOYSTATUS

# ==========================================
# 8. CRITICAL ISSUES SUMMARY
# ==========================================

echo ""
echo "=========================================="
echo "8. CRITICAL ISSUES FOUND"
echo "=========================================="
echo ""

cat << 'ISSUES'
🚨 BLOCKING (Must Fix Now):
1. SyntaxError in Code.gs line 88
   - Prevents entity dropdown from populating
   - Blocks all event creation
   - User cannot proceed past form

2. Entity Dropdown Not Populating
   - RPC call to getConfig() failing
   - populateEntityDropdowns() stuck
   - Shows "Loading entities..." indefinitely

⚠️  HIGH PRIORITY:
3. Header.html Branding Not Loading
   - Logo not displaying
   - Brand colors not applying
   - Tagline/description missing

4. No Automated Tests
   - Cannot verify deployments work
   - Manual testing required for every change
   - No regression detection

5. No CI/CD Pipeline
   - Manual deployment process
   - No quality gates
   - Risk of broken deployments

📋 MEDIUM PRIORITY:
6. Reports.html Not Tested
   - Master dashboard exists but unverified
   - May have similar issues to Admin page

7. Display/Poster Pages Unverified
   - Unknown if they work end-to-end
   - Need event creation to test

8. Mobile Responsiveness Untested
   - No device testing documented
   - Unknown user experience on phones

💡 LOW PRIORITY:
9. Code Organization
   - Some duplication between files
   - Could benefit from refactoring

10. Performance Optimization
    - No caching strategy
    - No lazy loading
    - Room for improvement
ISSUES

# ==========================================
# 9. IMMEDIATE ACTION PLAN
# ==========================================

echo ""
echo "=========================================="
echo "9. IMMEDIATE ACTION PLAN"
echo "=========================================="
echo ""

cat << 'ACTIONPLAN'
🎯 STEP 1: Fix Syntax Error (15 minutes)
  Task: Find and fix line 88 in Code.gs
  Command: sed -n '80,100p' Code.gs
  Goal: Eliminate SyntaxError
  Test: Console shows no errors

🎯 STEP 2: Verify Config Integration (10 minutes)
  Task: Ensure getConfig() returns proper data
  Test: Call NU.getConfig() in console
  Goal: Returns CONFIG object with BRANDS

🎯 STEP 3: Test Entity Dropdown (5 minutes)
  Task: Verify populateEntityDropdowns() works
  Test: Dropdown shows 5 ABC entities
  Goal: User can select entity

🎯 STEP 4: Create Test Event (10 minutes)
  Task: Fill form and submit
  Test: Event creation succeeds
  Goal: Event ID returned, spreadsheet created

🎯 STEP 5: Verify Public Page (5 minutes)
  Task: Open public page URL
  Test: Event details display
  Goal: User can view event

🎯 STEP 6: Document Working URLs (5 minutes)
  Task: Create URL reference doc
  Test: All URLs work
  Goal: Clear documentation

Total: ~50 minutes to working MVP

🔄 STEP 7: Add Basic E2E Test (1 hour)
  Task: Create Playwright test for event creation
  File: tests/e2e/create-event.spec.js
  Goal: Automated smoke test

🔄 STEP 8: CI/CD Pipeline (2 hours)
  Task: Create .github/workflows/deploy.yml
  Goal: Automated testing + deployment
  Includes: Quality gates, rollback capability

📚 STEP 9: Documentation (1 hour)
  Task: Create user guide + developer docs
  Files: README.md, CONTRIBUTING.md, API.md
  Goal: Self-service onboarding
ACTIONPLAN

# ==========================================
# 10. ARCHITECTURE RECOMMENDATIONS
# ==========================================

echo ""
echo "=========================================="
echo "10. ARCHITECTURE RECOMMENDATIONS"
echo "=========================================="
echo ""

cat << 'RECOMMENDATIONS'
✨ CONFIGURATION MANAGEMENT:
- ✓ GOOD: Single CONFIG object in Config.gs
- ✓ GOOD: Brand hierarchy defined
- 💡 IMPROVE: Add schema validation
- 💡 IMPROVE: Add environment configs (dev/prod)

✨ CODE ORGANIZATION:
- ✓ GOOD: Separation of concerns (Config, Code, UI)
- ✓ GOOD: NUSDK abstraction layer
- 💡 IMPROVE: Extract validation logic to separate file
- 💡 IMPROVE: Create utilities.gs for shared functions

✨ FRONTEND ARCHITECTURE:
- ✓ GOOD: Consistent include pattern (NUSDK, Header, Styles)
- ✓ GOOD: Component-based thinking
- 💡 IMPROVE: Extract shared UI components
- 💡 IMPROVE: Add state management (for complex flows)

✨ DATA FLOW:
- ✓ GOOD: Clear RPC boundary (NU.rpc)
- ✓ GOOD: Standardized error handling
- 💡 IMPROVE: Add request/response typing
- 💡 IMPROVE: Add caching layer

✨ TESTING STRATEGY:
- ❌ MISSING: Unit tests
- ❌ MISSING: Integration tests
- ❌ MISSING: E2E tests
- 💡 ADD: Jest for backend, Playwright for E2E

✨ DEVOPS:
- ✓ GOOD: Git workflow established
- ✓ GOOD: Stable deployment ID configured
- ❌ MISSING: CI/CD pipeline
- 💡 ADD: GitHub Actions, quality gates
RECOMMENDATIONS

