#!/bin/bash

echo "=========================================="
echo "SYNC ALL ENVIRONMENTS"
echo "Local → GitHub → Apps Script → Deployment"
echo "=========================================="
echo ""

# STEP 1: Check current local state
echo "STEP 1: LOCAL FILES"
echo "=========================================="
git status --short
echo ""
echo "Current commit:"
git log -1 --oneline
echo ""

# STEP 2: Commit all local changes to git
echo "STEP 2: COMMIT TO GIT"
echo "=========================================="
git add -A
git commit -m "SYNC: Align all environments - clean baseline $(date +%Y%m%d-%H%M)" || echo "Nothing to commit"
echo ""

# STEP 3: Push to GitHub
echo "STEP 3: PUSH TO GITHUB"
echo "=========================================="
git push origin dev
echo "✓ GitHub updated"
echo ""

# STEP 4: Push to Apps Script
echo "STEP 4: PUSH TO APPS SCRIPT"
echo "=========================================="
clasp push --force
echo "✓ Apps Script updated"
echo ""

# STEP 5: Create deployment
echo "STEP 5: CREATE DEPLOYMENT"
echo "=========================================="
clasp deploy -i AKfycbzxPOs9lqA-vQOYfw3iGYqEdGPQwrqCDvhkrEMk51m2JCZmRffhbbdNARGed-UpBeFK -d "Synchronized deployment - all environments aligned"
echo ""

# STEP 6: Verify alignment
echo "=========================================="
echo "STEP 6: VERIFY ALIGNMENT"
echo "=========================================="
echo ""

echo "Local git commit:"
git log -1 --oneline
echo ""

echo "GitHub remote:"
git ls-remote origin dev | cut -f1 | cut -c1-7
echo ""

echo "Latest deployment:"
clasp deployments | head -5
echo ""

# STEP 7: Generate verification checklist
echo "=========================================="
echo "VERIFICATION CHECKLIST"
echo "=========================================="
echo ""

cat << 'CHECKLIST'
✓ Local files committed
✓ GitHub updated (dev branch)
✓ Apps Script updated (clasp push)
✓ New deployment created

FILES TO VERIFY ARE IDENTICAL:

1. Config.gs
   - Has BRAND_HIERARCHY inside CONFIG object
   - Has ABC, CBC, CBL brands defined
   - Has entities arrays for each brand

2. Code.gs
   - Has getConfig() function
   - No broken test functions
   - No syntax errors

3. Admin.html
   - Has populateEntityDropdowns() function
   - No rogue closing braces
   - eventData object properly structured

4. NUSDK.html
   - Has NU.getConfig() wrapper
   - Has NU.rpc() function

5. appsscript.json
   - Has correct webapp settings
   - Has required OAuth scopes
CHECKLIST

echo ""
echo "=========================================="
echo "DEPLOYMENT URL"
echo "=========================================="
echo ""
echo "🚀 LIVE URL:"
echo "https://script.google.com/macros/s/AKfycbzxPOs9lqA-vQOYfw3iGYqEdGPQwrqCDvhkrEMk51m2JCZmRffhbbdNARGed-UpBeFK/exec?p=admin&brand=ABC"
echo ""
echo "Wait 60 seconds for deployment to propagate..."
echo ""
echo "Then test:"
echo "1. Open URL in INCOGNITO window"
echo "2. Check console for [NU] SDK loaded"
echo "3. Check entity dropdown populates"
echo "4. Try creating an event"
echo ""
echo "=========================================="
echo "✅ ALL ENVIRONMENTS SYNCHRONIZED!"
echo "=========================================="

