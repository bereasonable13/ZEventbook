#!/usr/bin/env node

/**
 * NextUp Pre-Deployment Verification System
 *
 * Aligns the Apps Script project structure with the automated
 * GitHub Action workflows. The verifier performs a series of
 * structural, configuration, and UX integrity checks and exits
 * with a non-zero status code when blocking problems are found.
 */

const fs = require('fs');
const path = require('path');

const COLOR_CODES = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const REQUIRED_FILES = [
  ['Code.gs', 'Code.js'],
  'Styles.html',
  'NUSDK.html',
  'Admin.html',
  'Display.html',
  'Public.html',
  'Poster.html',
  'Test.html',
  'HealthCheck.html',
  ['appsscript.json', 'appsscript.js'],
];

function createColorPalette(enabled) {
  if (!enabled) {
    return Object.keys(COLOR_CODES).reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {});
  }

  return { ...COLOR_CODES };
}

function resolveProjectDir(inputDir) {
  if (inputDir) {
    return path.resolve(process.cwd(), inputDir);
  }

  const srcDir = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcDir)) {
    return srcDir;
  }

  return process.cwd();
}

class DeploymentVerifier {
  constructor(projectDir, options = {}) {
    this.projectDir = path.resolve(projectDir);
    this.useColor = options.useColor !== false;
    this.colors = createColorPalette(this.useColor);
    this.errors = [];
    this.warnings = [];
    this.passes = [];
    this.fixes = [];

    this.htmlFiles = this.collectHtmlFiles();
    this.codeFile = this.resolveCodeFile();
    this.codeContent = this.codeFile ? this.readFile(this.codeFile.path) : '';
    this.exportedFunctions = [];
  }

  collectHtmlFiles() {
    if (!fs.existsSync(this.projectDir)) {
      return [];
    }

    return fs
      .readdirSync(this.projectDir)
      .filter((file) => file.toLowerCase().endsWith('.html'))
      .map((file) => ({
        name: file,
        path: path.join(this.projectDir, file),
      }));
  }

  resolveCodeFile() {
    const candidates = ['Code.gs', 'Code.js'];
    for (const name of candidates) {
      const candidatePath = path.join(this.projectDir, name);
      if (fs.existsSync(candidatePath)) {
        return { name, path: candidatePath };
      }
    }

    return null;
  }

  readFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      this.errors.push(`Unable to read ${path.basename(filePath)}: ${error.message}`);
      return '';
    }
  }

  logHeader(title) {
    console.log(`${this.colors.cyan}═══════════════════════════════════════${this.colors.reset}`);
    console.log(`${this.colors.cyan}   ${title}${this.colors.reset}`);
    console.log(`${this.colors.cyan}═══════════════════════════════════════${this.colors.reset}\n`);
  }

  logPhase(label, description) {
    console.log(`\n${this.colors.blue}[${label}] ${description}${this.colors.reset}`);
  }

  pushPass(message) {
    this.passes.push(`✓ ${message}`);
  }

  pushWarning(message, fix) {
    this.warnings.push(message);
    if (fix) {
      this.fixes.push(fix);
    }
  }

  pushError(message, fix) {
    this.errors.push(message);
    if (fix) {
      this.fixes.push(fix);
    }
  }

  async verify() {
    this.logHeader('NextUp Deployment Verification');

    this.logPhase('Phase 1', 'Verifying File Structure');
    this.checkRequiredFiles();
    this.checkFileNaming();

    this.logPhase('Phase 2', 'Checking Code Quality');
    this.checkCodeSyntax();
    this.checkFunctionExports();

    this.logPhase('Phase 3', 'Analyzing Dependencies');
    this.checkHtmlSyntax();
    this.checkIncludes();
    this.checkCircularDependencies();
    this.checkRpcCalls();

    this.logPhase('Phase 4', 'Verifying API Contracts');
    this.checkFunctionSignatures();
    this.checkResponseStructures();
    this.checkErrorHandling();

    this.logPhase('Phase 5', 'Validating UX Patterns');
    this.checkNavigationPatterns();
    this.checkModalPatterns();
    this.checkInlineResults();

    this.logPhase('Phase 6', 'Checking Performance');
    this.checkFileSize();
    this.checkDuplication();

    this.printResults();

    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      passes: this.passes,
      fixes: this.fixes,
    };
  }

  checkRequiredFiles() {
    REQUIRED_FILES.forEach((entry) => {
      const candidates = Array.isArray(entry) ? entry : [entry];
      const found = candidates.find((name) => fs.existsSync(path.join(this.projectDir, name)));

      if (found) {
        this.pushPass(`${found} exists`);
      } else {
        this.pushError(`Missing required file: ${candidates[0]}`);
      }
    });
  }

  checkFileNaming() {
    const incorrectHealthCheck = path.join(this.projectDir, 'Healthcheck.html');
    if (fs.existsSync(incorrectHealthCheck)) {
      this.pushError(
        'Found "Healthcheck.html" but the project expects "HealthCheck.html"',
        'Rename Healthcheck.html → HealthCheck.html'
      );
    }

    if (!fs.existsSync(this.projectDir)) {
      return;
    }

    const fixedSuffixFiles = fs
      .readdirSync(this.projectDir)
      .filter((file) => file.endsWith('-FIXED.html'));

    if (fixedSuffixFiles.length > 0) {
      this.pushWarning(
        `Found ${fixedSuffixFiles.length} file(s) with a -FIXED suffix: ${fixedSuffixFiles.join(', ')}`,
        'Remove -FIXED suffix before deployment'
      );
    }
  }

  checkCodeSyntax() {
    if (!this.codeFile) {
      this.pushError('Code.gs file not found in project directory');
      return;
    }

    const content = this.codeContent;
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      this.pushError(`Code file has mismatched braces (${openBraces} open vs ${closeBraces} close)`);
    } else {
      this.pushPass(`${this.codeFile.name} braces balanced`);
    }

    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      this.pushError(`Code file has mismatched parentheses (${openParens} open vs ${closeParens} close)`);
    } else {
      this.pushPass(`${this.codeFile.name} parentheses balanced`);
    }

    const buildIdMatch = content.match(/BUILD_ID\s*=\s*['"]([^'"]+)['"]/);
    if (buildIdMatch) {
      this.pushPass(`Build identifier present (${buildIdMatch[1]})`);
    } else {
      this.pushWarning(`${this.codeFile.name} is missing BUILD_ID constant`);
    }

    if (content.includes('function doGet')) {
      this.pushPass('doGet handler present');
    } else {
      this.pushError('doGet handler missing - web app entry point not defined');
    }
  }

  checkFunctionExports() {
    if (!this.codeFile) {
      return;
    }

    const functionRegex = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
    const functions = [];
    let match;

    while ((match = functionRegex.exec(this.codeContent)) !== null) {
      const name = match[1];
      if (!name.startsWith('_')) {
        functions.push(name);
      }
    }

    this.exportedFunctions = functions;
    this.pushPass(`Discovered ${functions.length} public function(s)`);
  }

  checkHtmlSyntax() {
    this.htmlFiles.forEach((file) => {
      const content = this.readFile(file.path);
      const openTags = (content.match(/<(?!\/)([a-zA-Z0-9-]+)(?:(?!\/).)*?>/g) || []).length;
      const closeTags = (content.match(/<\/([a-zA-Z0-9-]+)>/g) || []).length;
      const selfClosing = (content.match(/<([a-zA-Z0-9-]+)(?:(?!<).)*\/>/g) || []).length;

      const expectedClosures = openTags - selfClosing;
      if (closeTags !== expectedClosures) {
        this.pushWarning(
          `${file.name}: potential unbalanced HTML tags (open=${openTags}, close=${closeTags}, selfClosing=${selfClosing})`
        );
      } else {
        this.pushPass(`${file.name} markup structure looks balanced`);
      }
    });
  }

  checkIncludes() {
    const availableFiles = new Set(this.htmlFiles.map((file) => file.name));
    const includeRegex = /<\?!=\s*include\(['"]([^'"]+)['"]\)\s*\?>/g;

    this.htmlFiles.forEach((file) => {
      const content = this.readFile(file.path);
      let match;
      while ((match = includeRegex.exec(content)) !== null) {
        const includeName = `${match[1]}.html`;
        if (!availableFiles.has(includeName)) {
          this.pushError(
            `${file.name} includes missing template ${includeName}`,
            `Create ${includeName} or remove include() call from ${file.name}`
          );
        }
      }
    });
  }

  checkCircularDependencies() {
    const includeRegex = /<\?!=\s*include\(['"]([^'"]+)['"]\)\s*\?>/g;
    const graph = new Map();

    this.htmlFiles.forEach((file) => {
      const content = this.readFile(file.path);
      const includes = [];
      let match;
      while ((match = includeRegex.exec(content)) !== null) {
        includes.push(`${match[1]}.html`);
      }
      graph.set(file.name, includes);
    });

    const visiting = new Set();
    const visited = new Set();
    let hasCycle = false;

    const visit = (node, stack) => {
      if (visiting.has(node)) {
        hasCycle = true;
        this.pushError(`Circular include detected: ${[...stack, node].join(' → ')}`);
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      const neighbors = graph.get(node) || [];
      neighbors.forEach((neighbor) => visit(neighbor, [...stack, neighbor]));
      visiting.delete(node);
      visited.add(node);
    };

    Array.from(graph.keys()).forEach((node) => visit(node, [node]));

    if (!hasCycle) {
      this.pushPass('No circular include() references detected');
    }
  }

  checkRpcCalls() {
    if (!this.codeFile) {
      return;
    }

    const rpcRegex = /google\.script\.run(?:\.withSuccessHandler\([^)]*\))?(?:\.withFailureHandler\([^)]*\))?\.(\w+)/g;
    const referenced = new Set();

    this.htmlFiles.forEach((file) => {
      const content = this.readFile(file.path);
      let match;
      while ((match = rpcRegex.exec(content)) !== null) {
        referenced.add(match[1]);
      }
    });

    if (referenced.size === 0) {
      this.pushWarning('No google.script.run calls detected in HTML templates');
      return;
    }

    const exported = new Set(this.exportedFunctions);
    const missing = Array.from(referenced).filter((name) => !exported.has(name));

    if (missing.length > 0) {
      this.pushWarning(
        `Found ${missing.length} RPC handler(s) without matching Apps Script exports: ${missing.join(', ')}`,
        'Ensure corresponding server-side functions exist or remove unused RPC calls'
      );
    } else {
      this.pushPass('All RPC handlers map to exported Apps Script functions');
    }
  }

  checkFunctionSignatures() {
    if (!this.codeFile) {
      return;
    }

    const expected = ['doGet', 'createEventbook', 'getEventsSafe', 'ping'];
    const exported = new Set(this.exportedFunctions);
    const missing = expected.filter((fn) => !exported.has(fn));

    if (missing.length > 0) {
      this.pushWarning(`Missing recommended public function(s): ${missing.join(', ')}`);
    } else {
      this.pushPass('Core Apps Script entry points present');
    }
  }

  checkResponseStructures() {
    if (!this.codeFile) {
      return;
    }

    const classicHelpers = ['function envelope_', 'function ok_', 'function rateLimited_', 'function serverError_'];
    const modernHelpers = ['function successResponse_', 'function errorResponse_'];

    const hasClassic = classicHelpers.every((snippet) => this.codeContent.includes(snippet));
    const hasModern = modernHelpers.every((snippet) => this.codeContent.includes(snippet));

    if (hasClassic || hasModern) {
      this.pushPass('Response helpers detected');
    } else {
      this.pushError('Response helpers missing: expected envelope_/ok_ or successResponse_/errorResponse_ implementation');
    }
  }

  checkErrorHandling() {
    if (!this.codeFile) {
      return;
    }

    const tryCount = (this.codeContent.match(/try\s*\{/g) || []).length;
    const catchCount = (this.codeContent.match(/catch\s*\(/g) || []).length;

    if (tryCount === 0 || catchCount === 0) {
      this.pushWarning('Limited try/catch usage detected; consider wrapping external calls');
    } else {
      this.pushPass('Error handling blocks present');
    }
  }

  checkNavigationPatterns() {
    const testTemplate = this.htmlFiles.find((file) => file.name === 'Test.html');
    if (!testTemplate) {
      this.pushWarning('Test.html not found; unable to validate navigation patterns');
      return;
    }

    const content = this.readFile(testTemplate.path);
    const requiredIds = ['data-testid="btn-smoke"', 'data-testid="btn-selftests"', 'data-testid="btn-sla-mock"'];
    const missing = requiredIds.filter((snippet) => !content.includes(snippet));

    if (missing.length > 0) {
      this.pushWarning(`Navigation controls missing expected test ids: ${missing.join(', ')}`);
    } else {
      this.pushPass('Primary navigation controls exposed via data-testid attributes');
    }
  }

  checkModalPatterns() {
    const testTemplate = this.htmlFiles.find((file) => file.name === 'Test.html');
    if (!testTemplate) {
      return;
    }

    const content = this.readFile(testTemplate.path);
    if (content.includes('class="diag"') && content.includes('data-testid="diag-pane"')) {
      this.pushPass('Diagnostics modal scaffold detected');
    } else {
      this.pushWarning('Diagnostics panel markup missing expected structure');
    }
  }

  checkInlineResults() {
    const testTemplate = this.htmlFiles.find((file) => file.name === 'Test.html');
    if (!testTemplate) {
      return;
    }

    const content = this.readFile(testTemplate.path);
    if (content.includes('data-testid="sla-results"')) {
      this.pushPass('Inline SLA results container present');
    } else {
      this.pushWarning('SLA results container missing from Test.html');
    }
  }

  checkFileSize() {
    if (!this.codeFile) {
      return;
    }

    try {
      const stats = fs.statSync(this.codeFile.path);
      const sizeKb = Math.round(stats.size / 1024);
      if (stats.size > 750 * 1024) {
        this.pushWarning(
          `${this.codeFile.name} is ${sizeKb}KB — consider splitting into modules to stay within Apps Script limits`
        );
      } else {
        this.pushPass(`${this.codeFile.name} size within recommended limits (${sizeKb}KB)`);
      }
    } catch (error) {
      this.pushError(`Unable to determine ${this.codeFile.name} size: ${error.message}`);
    }
  }

  checkDuplication() {
    if (!this.codeFile) {
      return;
    }

    const seen = new Set();
    const duplicates = new Set();

    this.exportedFunctions.forEach((fn) => {
      if (seen.has(fn)) {
        duplicates.add(fn);
      }
      seen.add(fn);
    });

    if (duplicates.size > 0) {
      this.pushWarning(`Duplicate public function declarations detected: ${Array.from(duplicates).join(', ')}`);
    } else {
      this.pushPass('No duplicate public function declarations detected');
    }
  }

  printResults() {
    console.log(`\n${this.colors.cyan}═══════════════════════════════════════${this.colors.reset}`);
    console.log(`${this.colors.cyan}   Verification Results${this.colors.reset}`);
    console.log(`${this.colors.cyan}═══════════════════════════════════════${this.colors.reset}\n`);

    if (this.errors.length > 0) {
      console.log(`${this.colors.red}✗ ${this.errors.length} ERRORS:${this.colors.reset}`);
      this.errors.forEach((error) => console.log(`  ${this.colors.red}•${this.colors.reset} ${error}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log(`${this.colors.yellow}⚠ ${this.warnings.length} WARNINGS:${this.colors.reset}`);
      this.warnings.forEach((warning) => console.log(`  ${this.colors.yellow}•${this.colors.reset} ${warning}`));
      console.log('');
    }

    if (this.fixes.length > 0) {
      console.log(`${this.colors.blue}🔧 ${this.fixes.length} SUGGESTED FIXES:${this.colors.reset}`);
      this.fixes.forEach((fix) => console.log(`  ${this.colors.blue}•${this.colors.reset} ${fix}`));
      console.log('');
    }

    console.log(`${this.colors.cyan}═══════════════════════════════════════${this.colors.reset}`);
    if (this.errors.length === 0) {
      console.log(`${this.colors.green}✓ PASS - Safe to deploy${this.colors.reset}`);
    } else {
      console.log(`${this.colors.red}✗ FAIL - Fix errors before deploying${this.colors.reset}`);
    }
    console.log(`${this.colors.cyan}═══════════════════════════════════════${this.colors.reset}\n`);

    console.log(
      `Passes: ${this.colors.green}${this.passes.length}${this.colors.reset} | ` +
        `Warnings: ${this.colors.yellow}${this.warnings.length}${this.colors.reset} | ` +
        `Errors: ${this.colors.red}${this.errors.length}${this.colors.reset}\n`
    );
  }
}

async function runVerification(options = {}) {
  const projectDir = resolveProjectDir(options.projectDir);
  const verifier = new DeploymentVerifier(projectDir, { useColor: options.useColor });
  return verifier.verify();
}

function parseCliArguments(argv) {
  const args = { projectDir: undefined, useColor: true };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--project' || token === '--dir') {
      args.projectDir = argv[i + 1];
      i += 1;
    } else if (token === '--no-color') {
      args.useColor = false;
    } else if (token === '--ci') {
      args.useColor = false;
    }
  }

  return args;
}

if (require.main === module) {
  (async () => {
    try {
      const args = parseCliArguments(process.argv.slice(2));
      const result = await runVerification(args);
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error(`${COLOR_CODES.red}Verification failed:${COLOR_CODES.reset}`, error);
      process.exit(1);
    }
  })();
}

module.exports = {
  DeploymentVerifier,
  runVerification,
  resolveProjectDir,
};
