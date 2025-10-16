#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = fs.existsSync(path.join(ROOT_DIR, 'src')) ? path.join(ROOT_DIR, 'src') : ROOT_DIR;
const BUILD_DIR = path.join(ROOT_DIR, 'build');

const VALID_EXTENSIONS = new Set(['.gs', '.js', '.html', '.json']);

function cleanBuildDirectory() {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

function copyProjectFiles() {
  const entries = fs.readdirSync(SRC_DIR);
  entries.forEach((entry) => {
    const srcPath = path.join(SRC_DIR, entry);
    const destPath = path.join(BUILD_DIR, entry);
    const stats = fs.statSync(srcPath);

    if (stats.isDirectory()) {
      return;
    }

    if (!VALID_EXTENSIONS.has(path.extname(entry))) {
      return;
    }

    fs.copyFileSync(srcPath, destPath);
  });
}

function writeMetadata() {
  const manifestPath = path.join(BUILD_DIR, 'BUILD_METADATA.json');
  const codeFile = fs.existsSync(path.join(BUILD_DIR, 'Code.gs'))
    ? path.join(BUILD_DIR, 'Code.gs')
    : path.join(BUILD_DIR, 'Code.js');

  let buildId = 'unknown';
  if (fs.existsSync(codeFile)) {
    const content = fs.readFileSync(codeFile, 'utf8');
    const match = content.match(/BUILD_ID\s*=\s*['"]([^'"]+)['"]/);
    if (match) {
      buildId = match[1];
    }
  }

  const payload = {
    source: path.relative(ROOT_DIR, SRC_DIR) || '.',
    buildId,
    generatedAt: new Date().toISOString(),
    files: fs.readdirSync(BUILD_DIR).filter((file) => VALID_EXTENSIONS.has(path.extname(file))),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2));
}

function main() {
  console.log('📦 Packaging Apps Script sources...');
  cleanBuildDirectory();
  copyProjectFiles();
  writeMetadata();
  console.log(`✅ Build artifacts written to ${path.relative(ROOT_DIR, BUILD_DIR)}`);
}

if (require.main === module) {
  main();
}
