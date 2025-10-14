# NextUp Code Quality & Verification System
## Shift-Left Testing: Catch Issues Before Deployment

**Version:** 1.0  
**Created:** 2025-01-13  
**Purpose:** Automate quality checks before code reaches production

---

## 🎯 **PHILOSOPHY**

> "Quality is built in, not tested in"

**Traditional (Slow) Cycle:**
```
Write → Deploy → Test → Find bugs → Fix → Redeploy → Retest
Duration: Hours to days
Bug discovery: Production (users find bugs)
```

**Shift-Left (Fast) Cycle:**
```
Write → Verify → Deploy → Monitor
Duration: Minutes
Bug discovery: Development (tools find bugs)
```

---

## 🔧 **VERIFICATION TOOLS**

### **1. Pre-Deployment Verifier**

**File:** `verify-deployment.js`

**What It Checks:**

#### **Phase 1: File Structure**
- ✅ All required files exist (Code.gs, HTML files, appsscript.json)
- ✅ Correct file naming (HealthCheck.html not Healthcheck.html)
- ✅ No -FIXED suffix files
- ✅ No duplicate versions

#### **Phase 2: Code Quality**
- ✅ Code.gs syntax (balanced braces, parentheses)
- ✅ BUILD_ID present
- ✅ doGet() function exists
- ✅ All public functions exported
- ✅ HTML syntax valid

#### **Phase 3: Dependencies**
- ✅ All include() calls reference existing files
- ✅ All NU.rpc() calls reference existing functions
- ✅ No circular dependencies
- ✅ No orphaned files

#### **Phase 4: Contracts**
- ✅ Critical functions have contract tests
- ✅ errorResponse_() helper exists
- ✅ successResponse_() helper exists
- ✅ Response structures consistent

#### **Phase 5: UX Patterns**
- ✅ Error handling in all HTML files
- ✅ Rate limit (429) handling present
- ✅ No bad navigation patterns (window.location.href)
- ✅ Modals have ESC key support
- ✅ Inline results have loading states

#### **Phase 6: Performance**
- ✅ File sizes reasonable (<100KB)
- ✅ No excessive code duplication

**Usage:**
```bash
# Run verification
node verify-deployment.js

# Run on file change (watch mode)
npm run verify:watch

# Exit codes
# 0 = Pass (safe to deploy)
# 1 = Fail (errors found)
```

**Example Output:**
```
═══════════════════════════════════════
   NextUp Deployment Verification
═══════════════════════════════════════

[Phase 1] Verifying File Structure...
✓ Code.gs exists
✓ Styles.html exists
✓ NUSDK.html exists
[...]

[Phase 2] Checking Code Quality...
✓ Code.gs braces balanced
✓ Code.gs parentheses balanced
✓ Code.gs version: nextup-v4.3.0-bootstrap
✓ Code.gs has doGet() function
[...]

═══════════════════════════════════════
   Verification Results
═══════════════════════════════════════

✗ 2 ERRORS:
  • Admin.html: Calls non-existent function "invalidFunc"
  • Public.html: Missing rate limit (429) handling

⚠ 3 WARNINGS:
  • Admin.html: Found 1 navigation patterns - consider inline actions
  • Test.html: Modal missing ESC key handler
  • Code.gs: Missing contract test for getEventQuickLinks

🔧 3 SUGGESTED FIXES:
  • Remove invalidFunc call from Admin.html
  • Add rate limit check to Public.html
  • Add testGetEventQuickLinksContract() to Code.gs

═══════════════════════════════════════
✗ FAIL - Fix errors before deploying
═══════════════════════════════════════

Passes: 45 | Warnings: 3 | Errors: 2
```

---

### **2. Dependency Analyzer**

**File:** `analyze-dependencies.js` (from previous conversation)

**What It Does:**
- Maps all function definitions
- Tracks all function calls
- Identifies unused functions
- Shows dependency tree
- Highlights high-impact functions

**Usage:**
```bash
node analyze-dependencies.js
```

---

### **3. Git Pre-Commit Hook**

**File:** `pre-commit.sh`

**What It Does:**
- Automatically runs verification before EVERY commit
- Blocks commit if errors found
- Forces quality at source control level

**Installation:**
```bash
# Copy to Git hooks directory
cp pre-commit.sh .git/hooks/pre-commit

# Make executable
chmod +x .git/hooks/pre-commit

# Now runs automatically on: git commit
```

**Bypass (Emergency Only):**
```bash
# Skip verification (NOT RECOMMENDED)
git commit --no-verify -m "Emergency fix"
```

---

## 📋 **DEVELOPMENT WORKFLOW**

### **Before You Start Coding**

```bash
# 1. Pull latest code
git pull origin main

# 2. Verify current state is clean
npm run verify

# 3. Start watch mode (optional)
npm run verify:watch
```

### **During Development**

```bash
# Edit files in your IDE
# Watch mode shows real-time verification

# Or manually verify
npm run verify
```

### **Before Commit**

```bash
# 1. Run verification manually (pre-commit hook will run anyway)
npm run verify

# 2. Fix any errors/warnings

# 3. Commit (pre-commit hook runs automatically)
git add .
git commit -m "Add feature X"

# 4. If verification fails, fix and retry
```

### **Before Deployment**

```bash
# 1. Final verification
npm run verify

# 2. Run contract tests (in Apps Script)
# Visit: ?page=test
# Click: "Run All Tests"
# Confirm: All tests PASS

# 3. Deploy to Apps Script
# - Create new deployment version
# - Test in incognito window

# 4. Post-deployment smoke test
# Visit: ?page=health
# Confirm: All systems HEALTHY
```

---

## ✅ **QUALITY GATES**

### **Gate 1: Pre-Commit (MANDATORY)**

**Enforced By:** Git pre-commit hook

**Requirements:**
- ✅ All files exist
- ✅ No syntax errors
- ✅ All dependencies valid
- ✅ No critical errors

**If Fails:** Commit blocked

### **Gate 2: Pre-Deployment (RECOMMENDED)**

**Enforced By:** Manual run

**Requirements:**
- ✅ Gate 1 requirements
- ✅ No warnings (or warnings acknowledged)
- ✅ Contract tests pass
- ✅ Performance acceptable

**If Fails:** Deployment not recommended

### **Gate 3: Post-Deployment (VERIFICATION)**

**Enforced By:** Manual testing

**Requirements:**
- ✅ Admin page loads
- ✅ Can create event
- ✅ QR code generates
- ✅ Public page works
- ✅ Health check passes

**If Fails:** Rollback immediately

---

## 🚨 **ERROR SEVERITY LEVELS**

### **🔴 Critical (Must Fix)**

**Definition:** Breaks core functionality

**Examples:**
- Missing required files
- Syntax errors
- Missing doGet() function
- Calling non-existent functions
- Circular dependencies

**Action:** Cannot deploy until fixed

### **🟡 Warning (Should Fix)**

**Definition:** Doesn't break, but degrades quality

**Examples:**
- Missing contract tests
- No error handling
- Bad UX patterns
- Large file sizes
- Code duplication

**Action:** Deploy with caution, fix in next release

### **⚪ Info (Nice to Fix)**

**Definition:** Opportunities for improvement

**Examples:**
- Unused functions
- Missing documentation
- Suboptimal patterns

**Action:** Address during refactoring

---

## 📊 **QUALITY METRICS**

### **Target Metrics**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pre-commit pass rate | 100% | All commits pass verification |
| Contract test coverage | 90%+ | Critical functions have tests |
| Deployment success rate | 95%+ | Deployments work first try |
| Production bug rate | <1/week | User-reported bugs |
| Page load time | <2s | Time to interactive |

### **Tracking**

```bash
# Generate quality report
npm run verify > quality-report.txt

# Compare over time
git log --grep="quality:" --oneline
```

---

## 🔧 **EXTENDING THE SYSTEM**

### **Adding New Checks**

**Example: Check for TODO comments**

```javascript
// In verify-deployment.js

checkTodoComments() {
  const files = fs.readdirSync(this.projectDir)
    .filter(f => f.endsWith('.gs') || f.endsWith('.html'));
  
  let todoCount = 0;
  
  files.forEach(file => {
    const filepath = path.join(this.projectDir, file);
    const content = fs.readFileSync(filepath, 'utf8');
    
    const todos = content.match(/\/\/\s*TODO:/gi) || [];
    todoCount += todos.length;
    
    if (todos.length > 0) {
      this.warnings.push(`${file}: ${todos.length} TODO comments`);
    }
  });
  
  if (todoCount === 0) {
    this.passes.push('✓ No TODO comments');
  }
}
```

### **Adding Custom Rules**

**Example: Enforce function naming convention**

```javascript
checkFunctionNaming() {
  const codeFile = path.join(this.projectDir, 'Code.gs');
  const content = fs.readFileSync(codeFile, 'utf8');
  
  const functionRegex = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const funcName = match[1];
    
    // Public functions should use camelCase
    if (!funcName.startsWith('_') && !/^[a-z][a-zA-Z0-9]*$/.test(funcName)) {
      this.warnings.push(`Function "${funcName}" should use camelCase`);
    }
  }
}
```

---

## 🎯 **BEST PRACTICES**

### **DO:**

✅ Run verification before every commit
✅ Fix errors immediately (don't accumulate)
✅ Address warnings during development
✅ Keep contract tests up to date
✅ Document any bypasses in commit message
✅ Run full verification before deployment
✅ Test in incognito window after deploy
✅ Monitor first 15 minutes after deploy

### **DON'T:**

❌ Skip verification to "save time" (costs more later)
❌ Commit with known errors
❌ Deploy without testing contract tests
❌ Ignore warnings indefinitely
❌ Deploy on Friday afternoon (no time to fix)
❌ Deploy without backup plan
❌ Deploy multiple changes at once
❌ Skip post-deployment verification

---

## 🚀 **CONTINUOUS IMPROVEMENT**

### **Weekly Quality Review**

**Agenda:**
1. Review quality metrics
2. Analyze failed verifications
3. Identify common errors
4. Update verification rules
5. Refactor problematic code

**Output:**
- Quality trend report
- Updated verification rules
- Refactoring backlog

### **Monthly Audit**

**Tasks:**
1. Run full dependency analysis
2. Review unused functions
3. Check code duplication
4. Update contract tests
5. Performance profiling

**Output:**
- Technical debt assessment
- Refactoring priorities
- Performance optimization plan

---

## 📚 **REFERENCE**

### **Files in Quality System**

```
nextup-quality-tools/
├── verify-deployment.js    # Main verification script
├── analyze-dependencies.js # Dependency analyzer
├── pre-commit.sh          # Git hook
├── package.json           # Node.js config
└── QUALITY-SYSTEM.md      # This document
```

### **Integration Points**

```
Development → Pre-commit Hook → Git → CI/CD → Deployment → Monitoring
    ↓             ↓              ↓      ↓         ↓           ↓
  verify      verify          tests  verify    smoke      health
  manual      automatic       auto   manual    auto       auto
```

### **Command Reference**

```bash
# Verification
npm run verify           # Run once
npm run verify:watch     # Watch mode
npm run pre-commit       # Manual pre-commit

# Analysis
npm run analyze          # Dependency analysis

# Git
git commit               # Auto-runs pre-commit
git commit --no-verify   # Bypass (emergency only)

# Apps Script
?page=test              # Contract tests
?page=health            # Health check
```

---

## ✅ **COMMITMENT**

**This quality system is mandatory for all NextUp development.**

**Zero tolerance for:**
- Deploying with known errors
- Skipping verification
- Ignoring test failures
- Breaking contracts

**High expectations for:**
- Clean code
- Good UX patterns
- Comprehensive testing
- Continuous improvement

---

**Quality is everyone's responsibility. Build it in from the start.** 🎯
