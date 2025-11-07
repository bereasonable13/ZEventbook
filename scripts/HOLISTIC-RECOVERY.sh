#!/bin/bash

echo "=========================================="
echo "HOLISTIC SYSTEM RECOVERY"
echo "Clean Rebuild Strategy"
echo "=========================================="
echo ""

# STEP 1: Understand current state
echo "STEP 1: CURRENT STATE ASSESSMENT"
echo "=========================================="
echo ""

echo "Files that were modified:"
git status --short

echo ""
echo "Recent commits:"
git log --oneline -5

echo ""
echo "Known issues:"
cat << 'ISSUES'
1. Admin.html has rogue }; breaking eventData object
2. Code.gs has mangled quickSmokeTest function  
3. Multiple sed commands put code in wrong places
4. System is broken from incremental patches

ROOT CAUSE: Appending code and using sed without validating entire file structure
ISSUES

echo ""
echo "=========================================="
echo "STEP 2: RECOVERY STRATEGY"
echo "=========================================="
echo ""

cat << 'STRATEGY'
Instead of fixing individual lines, we need to:

1. Identify LAST KNOWN GOOD STATE
   - Find git commit before syntax errors
   - Restore those files as baseline

2. Reapply ONLY the essential changes:
   - Config.gs with BRAND_HIERARCHY (inside CONFIG object)
   - Reports.html (if needed for demo)
   - Remove any broken test functions

3. Validate ENTIRE system:
   - Check all .gs files compile
   - Check all .html files have valid JavaScript
   - Verify configuration is complete

4. Deploy ONCE with everything working
   - Not incremental patches
   - Complete, tested deployment

5. Test FULL USER FLOW:
   - Load admin page
   - Populate entity dropdown  
   - Create event
   - View public page
   - End-to-end validation
STRATEGY

echo ""
echo "=========================================="
echo "STEP 3: EXECUTE RECOVERY"
echo "=========================================="
echo ""

# Option A: Restore from last good commit
echo "Option A: Restore from known good commit"
echo "Last good commit was likely before we started appending functions"
echo ""
git log --oneline --all | grep -B5 -A5 "BRAND_HIERARCHY\|Config.*hierarchy" | head -20
echo ""

# Option B: Cherry-pick good changes
echo "Option B: Start fresh with core files"
echo "We can restore Config.gs and Code.gs from a working state"
echo "Then carefully add ONLY what's needed"
echo ""

echo "=========================================="
echo "RECOMMENDATION"
echo "=========================================="
echo ""

cat << 'RECOMMEND'
Let's do a CONTROLLED ROLLBACK + REBUILD:

1. Restore to commit before syntax errors (likely afe4679 or earlier)
2. Manually add ONLY these essential pieces:
   - Config.gs: Add BRAND_HIERARCHY inside CONFIG object
   - Leave Code.gs alone (don't append broken test functions)
   - Verify Admin.html has clean eventData object
3. Deploy as one complete unit
4. Test the core flow: admin → create event → works

This gives us a CLEAN, WORKING baseline.
Then we can add Reports.html and other features systematically.

Want me to execute this recovery plan?
RECOMMEND

