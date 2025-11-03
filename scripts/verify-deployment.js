#!/usr/bin/env node
const fs = require('fs');

console.log('🔍 Verifying deployment...\n');

const required = ['Code.js', 'Config.js', 'Admin.html', '.clasp.json'];
let errors = 0;

required.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} missing`);
    errors++;
  }
});

if (errors === 0) {
  console.log('\n✅ All checks passed!');
  process.exit(0);
} else {
  console.log(`\n❌ ${errors} error(s) found`);
  process.exit(1);
}
