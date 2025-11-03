describe('Smoke Tests', () => {
  test('Config.js exists and has BRANDS', () => {
    const fs = require('fs');
    const config = fs.readFileSync('./Config.js', 'utf8');
    
    expect(config).toContain('BRANDS');
    expect(config).toContain('ABC');
  });
  
  test('Code.js exists and has getBrand', () => {
    const fs = require('fs');
    const code = fs.readFileSync('./Code.js', 'utf8');
    
    expect(code).toContain('function getBrand');
    expect(code).toContain('function doGet');
  });
  
  test('Admin.html exists', () => {
    const fs = require('fs');
    expect(fs.existsSync('./Admin.html')).toBe(true);
  });
  
  test('.clasp.json is valid', () => {
    const fs = require('fs');
    const clasp = JSON.parse(fs.readFileSync('./.clasp.json', 'utf8'));
    expect(clasp.scriptId).toBeDefined();
  });
});
