global.HtmlService = { createTemplateFromFile: jest.fn() };
global.Logger = { log: jest.fn() };

const fs = require('fs');
const configContent = fs.readFileSync('./Config.gs', 'utf8');
const vm = require('vm');
const script = new vm.Script(configContent);
const context = { BRANDS: undefined, GITHUB: undefined, DEFAULT_BRAND: undefined, CONFIG: undefined };
vm.createContext(context);
script.runInContext(context);

global.BRANDS = context.BRANDS;
global.GITHUB = context.GITHUB;
global.DEFAULT_BRAND = context.DEFAULT_BRAND;
global.CONFIG = context.CONFIG;

global.testUtils = {
  getAllBrandSlugs() {
    return Object.values(global.BRANDS || {}).map(b => b.slug);
  }
};
