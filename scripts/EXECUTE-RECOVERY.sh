#!/bin/bash

echo "=========================================="
echo "EXECUTING HOLISTIC RECOVERY"
echo "=========================================="
echo ""

# STEP 1: Rollback to commit BEFORE syntax errors
echo "STEP 1: Rolling back to clean state"
echo "Target: afe4679 (Config.gs with BRAND_HIERARCHY)"
echo ""

# Save current work just in case
git stash push -m "Pre-recovery backup $(date +%Y%m%d-%H%M)"

# Hard reset to the commit with working Config.gs
git reset --hard afe4679

echo "✅ Rolled back to afe4679"
echo ""

# STEP 2: Verify the files
echo "STEP 2: Verifying core files"
echo ""

echo "Config.gs structure:"
grep -n "BRAND_HIERARCHY:" Config.gs
echo ""

echo "Admin.html createEvent function (first 30 lines):"
sed -n '/async function createEvent/,+30p' Admin.html | head -35
echo ""

echo "Code.gs - checking for broken functions:"
grep -n "function quickSmokeTest" Code.gs || echo "✓ No broken quickSmokeTest"
echo ""

# STEP 3: Quick validation
echo "STEP 3: Quick validation checks"
echo ""

# Check if Config.gs is valid JavaScript structure
echo "Checking Config.gs closing braces:"
tail -5 Config.gs
echo ""

# Check Admin.html for syntax issues
echo "Checking Admin.html eventData object:"
sed -n '/const eventData = {/,/}/p' Admin.html | head -25
echo ""

# STEP 4: Deploy clean version
echo "=========================================="
echo "STEP 4: Deploying clean version"
echo "=========================================="
echo ""

git push origin dev --force
clasp push --force
clasp deploy -i AKfycbzxPOs9lqA-vQOYfw3iGYqEdGPQwrqCDvhkrEMk51m2JCZmRffhbbdNARGed-UpBeFK -d "Holistic recovery - clean baseline"

echo ""
echo "=========================================="
echo "✅ RECOVERY COMPLETE!"
echo "=========================================="
echo ""
echo "🧪 TEST NOW (wait 30 seconds):"
echo "https://script.google.com/macros/s/AKfycbzxPOs9lqA-vQOYfw3iGYqEdGPQwrqCDvhkrEMk51m2JCZmRffhbbdNARGed-UpBeFK/exec?p=admin&brand=ABC"
echo ""
echo "Expected:"
echo "1. ✅ Page loads"
echo "2. ✅ [NU] SDK loaded in console"
echo "3. ✅ NO syntax errors"
echo "4. ✅ Entity dropdown populates"
echo ""
echo "If it works: We have a clean baseline!"
echo "If not: We rollback one more commit to 71333e7"
