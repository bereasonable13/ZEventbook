const TEST_CONFIG = require('../config/test-config');

describe('Brand Configuration Contract Tests', () => {
  
  test('TEST_CONFIG is defined and has brands', () => {
    expect(TEST_CONFIG).toBeDefined();
    expect(TEST_CONFIG.brands).toBeDefined();
    expect(Object.keys(TEST_CONFIG.brands).length).toBeGreaterThan(0);
  });
  
  TEST_CONFIG.getAllBrandKeys().forEach(brandKey => {
    const brand = TEST_CONFIG.getBrandConfig(brandKey);
    
    describe(`${brandKey} Configuration`, () => {
      test('has valid deployment URL', () => {
        expect(brand.deploymentUrl).toBeDefined();
        expect(brand.deploymentUrl).toMatch(/^https:\/\/script\.google\.com/);
      });
      
      test('has brandSlug', () => {
        expect(brand.brandSlug).toBeDefined();
        expect(brand.brandSlug).toBeTruthy();
      });
      
      test('has all required branding fields', () => {
        expect(brand.expectedBranding).toBeDefined();
        expect(brand.expectedBranding.name).toBeTruthy();
        expect(brand.expectedBranding.tagline).toBeTruthy();
        expect(brand.expectedBranding.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
        expect(brand.expectedBranding.logo).toMatch(/^https:\/\//);
      });
      
      test('has valid feature flags', () => {
        expect(brand.features).toBeDefined();
        expect(typeof brand.features.eventOnly).toBe('boolean');
        expect(typeof brand.features.analytics).toBe('boolean');
      });
      
      test('has test event data', () => {
        expect(brand.testEvent).toBeDefined();
        expect(brand.testEvent.name).toBeTruthy();
        expect(brand.testEvent.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(brand.testEvent.location).toBeTruthy();
      });
    });
  });
  
  describe('Helper Methods', () => {
    test('getBrandConfig returns correct brand', () => {
      const abc = TEST_CONFIG.getBrandConfig('ABC');
      expect(abc).toBeDefined();
      expect(abc.brandSlug).toBe('abc');
    });
    
    test('getAllBrandKeys returns all brands', () => {
      const keys = TEST_CONFIG.getAllBrandKeys();
      expect(keys).toContain('ABC');
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });
    
    test('getBrandUrl generates correct URL', () => {
      const url = TEST_CONFIG.getBrandUrl('ABC', 'Admin');
      expect(url).toContain('script.google.com');
      expect(url).toContain('?page=Admin');
    });
  });
});
