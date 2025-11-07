#!/bin/bash

echo "=========================================="
echo "COMPLETE SYSTEM ARCHITECTURE AUDIT"
echo "=========================================="
echo ""

echo "📁 ALL .GS FILES IN PROJECT:"
ls -1 *.gs
echo ""

echo "=========================================="
echo "1. CONFIGURATION ARCHITECTURE"
echo "=========================================="
echo ""

echo "A. How is CONFIG defined across all .gs files?"
echo ""
for file in *.gs; do
  echo "--- $file ---"
  grep -n "^const CONFIG\|^const BRANDS\|^CONFIG\." "$file" | head -5
  echo ""
done

echo "=========================================="
echo "2. ENTITY DEFINITIONS"
echo "=========================================="
echo ""

echo "A. Where are entities defined?"
for file in *.gs; do
  if grep -q "entities:" "$file"; then
    echo "✓ $file has entities:"
    grep -n "entities:" "$file"
  fi
done
echo ""

echo "B. Show all entity references:"
grep -n "ABC-Leagues\|ABC-Tournaments" *.gs | head -20
echo ""

echo "=========================================="
echo "3. FILE RELATIONSHIPS"
echo "=========================================="
echo ""

echo "In Google Apps Script, all .gs files compile together."
echo "Execution order is alphabetical by filename:"
echo ""
ls -1 *.gs | nl
echo ""

echo "This means:"
echo "  1. Config.gs loads first (alphabetically)"
echo "  2. Then Code.gs, TestRunner.gs, etc."
echo "  3. All share global namespace"
echo ""

echo "=========================================="
echo "4. COMPLETE CONFIG STRUCTURE"
echo "=========================================="
echo ""

echo "Config.gs content:"
cat Config.gs
echo ""

echo "=========================================="
echo "5. HOW CODE.GS USES CONFIG"
echo "=========================================="
echo ""

echo "First 100 lines of Code.gs:"
head -100 Code.gs
echo ""

echo "=========================================="
echo "6. HOLISTIC SOLUTION"
echo "=========================================="
echo ""

cat << 'SOLUTION'
CURRENT STATE:
  - Config.gs: Has BRANDS, DOMAIN_TO_BRAND but NOT wrapped in CONFIG
  - Code.gs: WAS defining its own CONFIG (now removed)
  - Result: Code.gs references CONFIG.BRANDS but CONFIG doesn't exist!

ROOT CAUSE:
  Config.gs uses pattern:
    const BRANDS = {...}
    CONFIG.DOMAIN_TO_BRAND = {...}
  
  Code.gs expects:
    const CONFIG = {
      BRANDS: {...},
      DOMAIN_TO_BRAND: {...}
    }

SOLUTION OPTIONS:

Option A: Wrap Config.gs in CONFIG object
  - Change Config.gs to define: const CONFIG = { BRANDS: {...}, ... }
  - Code.gs just uses CONFIG.BRANDS

Option B: Change Code.gs to match Config.gs pattern
  - Config.gs keeps: const BRANDS = {...}
  - Code.gs uses: BRANDS[brand] instead of CONFIG.BRANDS[brand]

Option C: Create CONFIG from pieces in Config.gs
  - Config.gs: const BRANDS = {...}
  - Config.gs: CONFIG.DOMAIN_TO_BRAND = {...}
  - Config.gs: const CONFIG = { BRANDS, DOMAIN_TO_BRAND, ... }

RECOMMENDATION: Option A (cleanest)
SOLUTION

echo "=========================================="
echo "WHICH OPTION?"
echo "=========================================="

