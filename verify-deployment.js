#!/usr/bin/env node

/**
 * NextUp Pre-Deployment Verification System
 * 
 * Runs comprehensive checks BEFORE code reaches Apps Script
 * Catches issues at development time, not production time
 * 
 * Usage: node verify-deployment.js [--fix]
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class DeploymentVerifier {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.errors = [];
    this.warnings = [];
    this.passes = [];
    this.fixes = [];
  }

  /**
   * Run all verification checks
   */
  async verify() {
    console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}   NextUp Deployment Verification${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);

    // Phase 1: File Structure
    console.log(`${colors.blue}[Phase 1] Verifying File Structure...${colors.reset}`);
    this.checkRequiredFiles();
    this.checkFileNaming();
    
    // Phase 2: Code Quality
    console.log(`\n${colors.blue}[Phase 2] Checking Code Quality...${colors.reset}`);
    this.checkCodeGsSyntax();
    this.checkFunctionExports();
    this.checkHtmlSyntax();
    
    // Phase 3: Dependencies
    console.log(`\n${colors.blue}[Phase 3] Analyzing Dependencies...${colors.reset}`);
    this.checkIncludes();
    this.checkRpcCalls();
    this.checkCircularDependencies();
    
    // Phase 4: Contracts
    console.log(`\n${colors.blue}[Phase 4] Verifying API Contracts...${colors.reset}`);
    this.checkFunctionSignatures();
    this.checkResponseStructures();
    this.checkErrorHandling();
    
    // Phase 5: UX Patterns
    console.log(`\n${colors.blue}[Phase 5] Validating UX Patterns...${colors.reset}`);
    this.checkNavigationPatterns();
    this.checkModalPatterns();
    this.checkInlineResults();
    
    // Phase 6: Performance
    console.log(`\n${colors.blue}[Phase 6] Checking Performance...${colors.reset}`);
    this.checkFileSize();
    this.checkDuplication();
    
    // Results
    this.printResults();
    
    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      passes: this.passes,
      fixes: this.fixes
    };
  }

  /**
   * Check that all required files exist
   */
  checkRequiredFiles() {
    const required = [
      'Code.gs',
      'Styles.html',
      'NUSDK.html',
      'Admin.html',
      'Display.html',
      'Public.html',
      'Poster.html',
      'Test.html',
      'HealthCheck.html',
      'appsscript.json'
    ];

    required.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      if (!fs.existsSync(filepath)) {
        this.errors.push(`Missing required file: ${file}`);
      } else {
        this.passes.push(`✓ ${file} exists`);
      }
    });
  }

  /**
   * Check file naming conventions
   */
   */
  checkFileNaming() {
    // Check for HealthCheck vs Healthcheck
    const healthFileWrong = path.join(this.projectDir, 'Healthcheck.html');
    
    if (fs.existsSync(healthFileWrong)) {
      this.errors.push('Found "Healthcheck.html" but Code.gs expects "HealthCheck.html" (capital C)');
      this.fixes.push('Rename Healthcheck.html → HealthCheck.html');
    }
    
    // Check for -FIXED suffix files
    const files = fs.readdirSync(this.projectDir).filter(f => f.endsWith('-FIXED.html'));
    if (files.length > 0) {
      this.warnings.push(`Found ${files.length} files with -FIXED suffix: ${files.join(', ')}`);
      this.fixes.push('Remove -FIXED suffix from production files');
    }
  }
      this.warnings.push(`Found ${files.length} files with -FIXED suffix: ${files.join(', ')}`);
      this.fixes.push('Remove -FIXED suffix from production files');
  /**
   * Check Code.gs for syntax errors
   */
  checkCodeGsSyntax() {
    const codeFile = path.join(this.projectDir, 'Code.gs');
    if (!fs.existsSync(codeFile)) return;
    
    const content = fs.readFileSync(codeFile, 'utf8');
    
    // Check for unclosed braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      this.errors.push(`Code.gs: Mismatched braces (${openBraces} open, ${closeBraces} close)`);
    } else {
      this.passes.push('✓ Code.gs braces balanced');
    }
    
    // Check for unclosed parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
      this.errors.push(`Code.gs: Mismatched parentheses (${openParens} open, ${closeParens} close)`);
    } else {
      this.passes.push('✓ Code.gs parentheses balanced');
    }
    
    // Check for version ID
    const buildIdMatch = content.match(/BUILD_ID\s*=\s*['"]([^'"]+)['"]/);
    if (buildIdMatch) {
      this.passes.push(`✓ Code.gs version: ${buildIdMatch[1]}`);
    } else {
      this.warnings.push('Code.gs: No BUILD_ID found');
    }
    
    // Check for doGet function
    if (content.includes('function doGet(e)')) {
      this.passes.push('✓ Code.gs has doGet() function');
    } else {
      this.errors.push('Code.gs: Missing doGet() function - app will not load');
    }
  }

  /**
   * Extract and verify all exported functions
   */
  checkFunctionExports() {
    const codeFile = path.join(this.projectDir, 'Code.gs');
    if (!fs.existsSync(codeFile)) return;
    
    const content = fs.readFileSync(codeFile, 'utf8');
    const functionRegex = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
    const functions = [];
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1];
      // Skip private functions (starting with _)
      if (!funcName.startsWith('_')) {
        functions.push(funcName);
      }
    }
    
    this.passes.push(`✓ Found ${functions.length} public functions in Code.gs`);
    
    // Store for later comparison
    this.exportedFunctions = functions;
  }

  /**
   * Check HTML files for syntax errors
   */
  checkHtmlSyntax() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html'));
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      // Check for unclosed tags
      const openTags = (content.match(/<(?!\/)[a-z][^>]*>/gi) || []).length;
      const closeTags = (content.match(/<\/[a-z][^>]*>/gi) || []).length;
      const selfClosing = (content.match(/<[a-z][^>]*\/>/gi) || []).length;
      
      const expected = openTags - selfClosing;
      if (closeTags !== expected && file !== 'NUSDK.html') {
        this.warnings.push(`${file}: Potential unclosed tags (${openTags} open, ${closeTags} close, ${selfClosing} self-closing)`);
      }
      
      // Check for <script> inside <?!= include() ?>
      if (content.includes('<?!= include') && content.includes('<script>')) {
        const includeMatch = content.match(/<?!=\s*include\([^)]+\)\s*\?>/);
        const scriptIndex = content.indexOf('<script>');
        const includeIndex = includeMatch ? content.indexOf(includeMatch[0]) : -1;
        
        if (includeIndex > scriptIndex) {
          this.errors.push(`${file}: include() call AFTER <script> tag - will not work`);
          this.fixes.push(`${file}: Move include() calls to <head> before any <script> tags`);
        }
      }
    });
  }

  /**
   * Check that all include() calls reference existing files
   */
  checkIncludes() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html'));
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      const includeRegex = /<?!=\s*include\(['"]([^'"]+)['"]\)\s*\?>/g;
      let match;
      
      while ((match = includeRegex.exec(content)) !== null) {
        const includedFile = match[1] + '.html';
        const includedPath = path.join(this.projectDir, includedFile);
        
        if (!fs.existsSync(includedPath)) {
          this.errors.push(`${file}: Includes non-existent file "${includedFile}"`);
        } else {
          this.passes.push(`✓ ${file} → ${includedFile}`);
        }
      }
    });
  }

  /**
   * Check that all NU.rpc() calls reference existing functions
   */
  checkRpcCalls() {
    if (!this.exportedFunctions) return;
    
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') && f !== 'NUSDK.html');
    
    const allCalls = {};
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      const rpcRegex = /NU\.rpc\(['"]([a-zA-Z_][a-zA-Z0-9_]*)['"][\s,)]/g;
      let match;
      
      while ((match = rpcRegex.exec(content)) !== null) {
        const funcName = match[1];
        
        if (!allCalls[funcName]) {
          allCalls[funcName] = [];
        }
        allCalls[funcName].push(file);
        
        if (!this.exportedFunctions.includes(funcName)) {
          this.errors.push(`${file}: Calls non-existent function "${funcName}"`);
        }
      }
    });
    
    // Report function usage
    Object.entries(allCalls).forEach(([func, files]) => {
      this.passes.push(`✓ ${func}() called by: ${files.join(', ')}`);
    });
    
    // Find unused functions (potential dead code)
    const unusedFunctions = this.exportedFunctions.filter(func => {
      return !allCalls[func] && 
             !func.startsWith('test') && 
             func !== 'doGet' &&
             func !== 'include' &&
             func !== 'ping';
    });
    
    if (unusedFunctions.length > 0) {
      this.warnings.push(`Found ${unusedFunctions.length} potentially unused functions: ${unusedFunctions.join(', ')}`);
    }
  }

  /**
   * Check for circular include dependencies
   */
  checkCircularDependencies() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html'));
    
    const dependencies = {};
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      const includeRegex = /<?!=\s*include\(['"]([^'"]+)['"]\)\s*\?>/g;
      const includes = [];
      let match;
      
      while ((match = includeRegex.exec(content)) !== null) {
        includes.push(match[1]);
      }
      
      dependencies[file.replace('.html', '')] = includes;
    });
    
    // Check for circular deps (simplified - could be more thorough)
    Object.entries(dependencies).forEach(([file, includes]) => {
      includes.forEach(inc => {
        if (dependencies[inc] && dependencies[inc].includes(file)) {
          this.errors.push(`Circular dependency: ${file} ↔ ${inc}`);
        }
      });
    });
    
    this.passes.push('✓ No circular dependencies detected');
  }

  /**
   * Verify function signatures match between Code.gs and contract tests
   */
  checkFunctionSignatures() {
    const codeFile = path.join(this.projectDir, 'Code.gs');
    if (!fs.existsSync(codeFile)) return;
    
    const content = fs.readFileSync(codeFile, 'utf8');
    
    // Check critical functions have contract tests
    const criticalFunctions = [
      'getEventsSafe',
      'createEventbook',
      'getPublicBundle',
      'getShareQrVerified'
    ];
    
    criticalFunctions.forEach(func => {
      const testFunc = `test${func.charAt(0).toUpperCase() + func.slice(1)}Contract`;
      
      if (content.includes(`function ${testFunc}(`)) {
        this.passes.push(`✓ ${func}() has contract test: ${testFunc}()`);
      } else {
        this.warnings.push(`${func}() missing contract test`);
        this.fixes.push(`Add ${testFunc}() to Code.gs`);
      }
    });
  }

  /**
   * Check that error responses follow standard structure
   */
  checkResponseStructures() {
    const codeFile = path.join(this.projectDir, 'Code.gs');
    if (!fs.existsSync(codeFile)) return;
    
    const content = fs.readFileSync(codeFile, 'utf8');
    
    // Check for errorResponse_ helper usage
    if (content.includes('function errorResponse_(')) {
      this.passes.push('✓ Code.gs has errorResponse_() helper');
    } else {
      this.warnings.push('Code.gs missing errorResponse_() helper - inconsistent error responses');
    }
    
    // Check for successResponse_ helper usage
    if (content.includes('function successResponse_(')) {
      this.passes.push('✓ Code.gs has successResponse_() helper');
    } else {
      this.warnings.push('Code.gs missing successResponse_() helper - inconsistent success responses');
    }
  }

  /**
   * Check that HTML files handle errors properly
   */
  checkErrorHandling() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') && f !== 'NUSDK.html' && f !== 'Styles.html');
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      // Check for error handling patterns
      const hasErrorCheck = content.includes('result.error') || 
                           content.includes('if (error)') ||
                           content.includes('.catch(');
      
      const hasRateLimitCheck = content.includes('result.code === 429') ||
                               content.includes('code === 429');
      
      if (!hasErrorCheck) {
        this.warnings.push(`${file}: Missing error handling for RPC calls`);
      } else {
        this.passes.push(`✓ ${file} has error handling`);
      }
      
      if (!hasRateLimitCheck) {
        this.warnings.push(`${file}: Missing rate limit (429) handling`);
      } else {
        this.passes.push(`✓ ${file} handles rate limits`);
      }
    });
  }

  /**
   * Check for bad navigation patterns (window.location.href in buttons)
   */
  checkNavigationPatterns() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') && f !== 'NUSDK.html' && f !== 'Styles.html');
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      // Check for window.location.href in onclick
      const badPattern = /onclick=["']window\.location\.href=/g;
      const matches = content.match(badPattern);
      
      if (matches) {
        this.warnings.push(`${file}: Found ${matches.length} navigation patterns - consider inline actions instead`);
        this.fixes.push(`${file}: Replace window.location.href with modal or inline result patterns`);
      } else {
        this.passes.push(`✓ ${file} uses good navigation patterns`);
      }
    });
  }

  /**
   * Check for modal pattern implementations
   */
  checkModalPatterns() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') && f !== 'NUSDK.html' && f !== 'Styles.html');
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      // Check if file has modals
      const hasModal = content.includes('modal-overlay') || 
                      content.includes('class="modal"');
      
      if (hasModal) {
        // Check for ESC key handler
        if (content.includes('Escape') || content.includes('keyCode === 27')) {
          this.passes.push(`✓ ${file} modal has ESC key support`);
        } else {
          this.warnings.push(`${file}: Modal missing ESC key handler`);
        }
        
        // Check for backdrop click handler
        if (content.includes('stopPropagation')) {
          this.passes.push(`✓ ${file} modal handles backdrop clicks`);
        } else {
          this.warnings.push(`${file}: Modal should prevent backdrop click from closing`);
        }
      }
    });
  }

  /**
   * Check for inline result patterns
   */
  checkInlineResults() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') && f !== 'NUSDK.html' && f !== 'Styles.html');
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      // Check for result containers
      const hasResultContainer = content.includes('-results') ||
                                 content.includes('id="test-') ||
                                 content.includes('id="health-');
      
      if (hasResultContainer) {
        // Check for loading states
        if (content.includes('loading') || content.includes('spinner')) {
          this.passes.push(`✓ ${file} has loading states for inline results`);
        } else {
          this.warnings.push(`${file}: Inline results should show loading state`);
        }
      }
    });
  }

  /**
   * Check file sizes
   */
  checkFileSize() {
    const files = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.gs') || f.endsWith('.html'));
    
    files.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const stats = fs.statSync(filepath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      
      if (stats.size > 100 * 1024) {
        this.warnings.push(`${file}: Large file size (${sizeKB}KB) - consider splitting`);
      } else {
        this.passes.push(`✓ ${file}: ${sizeKB}KB`);
      }
    });
  }

  /**
   * Check for code duplication
   */
  checkDuplication() {
    const htmlFiles = fs.readdirSync(this.projectDir)
      .filter(f => f.endsWith('.html') && f !== 'NUSDK.html' && f !== 'Styles.html');
    
    const commonPatterns = {};
    
    htmlFiles.forEach(file => {
      const filepath = path.join(this.projectDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      
      // Look for common function patterns
      const functionRegex = /async function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*{/g;
      let match;
      
      while ((match = functionRegex.exec(content)) !== null) {
        const funcName = match[1];
        if (!commonPatterns[funcName]) {
          commonPatterns[funcName] = [];
        }
        commonPatterns[funcName].push(file);
      }
    });
    
    // Find duplicated functions
    Object.entries(commonPatterns).forEach(([func, files]) => {
      if (files.length > 1) {
        this.warnings.push(`Function "${func}()" duplicated in: ${files.join(', ')} - consider extracting to NUSDK`);
      }
    });
  }

  /**
   * Print results summary
   */
  printResults() {
    console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}   Verification Results${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);
    
    // Errors
    if (this.errors.length > 0) {
      console.log(`${colors.red}✗ ${this.errors.length} ERRORS:${colors.reset}`);
      this.errors.forEach(err => console.log(`  ${colors.red}•${colors.reset} ${err}`));
      console.log('');
    }
    
    // Warnings
    if (this.warnings.length > 0) {
      console.log(`${colors.yellow}⚠ ${this.warnings.length} WARNINGS:${colors.reset}`);
      this.warnings.forEach(warn => console.log(`  ${colors.yellow}•${colors.reset} ${warn}`));
      console.log('');
    }
    
    // Fixes
    if (this.fixes.length > 0) {
      console.log(`${colors.blue}🔧 ${this.fixes.length} SUGGESTED FIXES:${colors.reset}`);
      this.fixes.forEach(fix => console.log(`  ${colors.blue}•${colors.reset} ${fix}`));
      console.log('');
    }
    
    // Summary
    console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}`);
    if (this.errors.length === 0) {
      console.log(`${colors.green}✓ PASS - Safe to deploy${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ FAIL - Fix errors before deploying${colors.reset}`);
    }
    console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);
    
    console.log(`Passes: ${colors.green}${this.passes.length}${colors.reset} | ` +
                `Warnings: ${colors.yellow}${this.warnings.length}${colors.reset} | ` +
                `Errors: ${colors.red}${this.errors.length}${colors.reset}\n`);
  }
}

// Main execution
const projectDir = process.argv[2] || './';
const verifier = new DeploymentVerifier(projectDir);

verifier.verify().then(result => {
  process.exit(result.success ? 0 : 1);
}).catch(err => {
  console.error(`${colors.red}Verification failed:${colors.reset}`, err);
  process.exit(1);
});
