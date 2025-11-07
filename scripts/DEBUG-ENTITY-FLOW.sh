#!/bin/bash

echo "=========================================="
echo "DEBUG: ENTITY DROPDOWN DATA FLOW"
echo "Tracing from Frontend → Backend → Config"
echo "=========================================="
echo ""

# STEP 1: Check if getConfig() exists in backend
echo "STEP 1: Backend - Does getConfig() exist?"
echo "=========================================="
grep -n "^function getConfig" Code.gs || echo "❌ getConfig() NOT FOUND in Code.gs"
echo ""

if grep -q "^function getConfig" Code.gs; then
  echo "✓ getConfig() exists - showing implementation:"
  sed -n '/^function getConfig/,/^}/p' Code.gs
  echo ""
else
  echo "🚨 CRITICAL: getConfig() function is MISSING!"
  echo "This is why entity dropdown cannot load!"
  echo ""
fi

# STEP 2: Check Config.gs structure
echo "STEP 2: Config - Is BRANDS defined?"
echo "=========================================="
grep -n "  BRANDS: {" Config.gs || echo "❌ BRANDS not found"
echo ""

echo "ABC entities defined?"
grep -n "entities: \[" Config.gs | head -3
echo ""

# STEP 3: Check frontend RPC call
echo "STEP 3: Frontend - How is getConfig called?"
echo "=========================================="
grep -n "NU.getConfig()" Admin.html
echo ""

echo "NUSDK.html getConfig implementation:"
sed -n '/getConfig.*{/,/}/p' NUSDK.html | head -10
echo ""

# STEP 4: Check populateEntityDropdowns
echo "STEP 4: Frontend - populateEntityDropdowns function"
echo "=========================================="
sed -n '/async function populateEntityDropdowns/,/^    }/p' Admin.html | head -35
echo ""

echo "=========================================="
echo "DIAGNOSIS"
echo "=========================================="
echo ""

# Check the critical link
if ! grep -q "^function getConfig" Code.gs; then
  cat << 'DIAGNOSIS'
🚨 ROOT CAUSE FOUND:
- getConfig() function is MISSING from Code.gs
- Frontend calls NU.getConfig() → google.script.run.getConfig()
- But backend has no getConfig() function to respond!
- Entity dropdown stays "Loading entities..." forever

FIX:
Add getConfig() function to Code.gs that returns CONFIG object

function getConfig() {
  return {
    VERSION: CONFIG.VERSION,
    BRANDS: CONFIG.BRANDS,
    DOMAIN_TO_BRAND: CONFIG.DOMAIN_TO_BRAND,
    BRAND_HIERARCHY: CONFIG.BRAND_HIERARCHY,
    DEFAULT_BRAND: CONFIG.DEFAULT_BRAND
  };
}
DIAGNOSIS
else
  echo "✓ getConfig() exists in backend"
  echo "Need to debug why it's not returning data properly"
fi

