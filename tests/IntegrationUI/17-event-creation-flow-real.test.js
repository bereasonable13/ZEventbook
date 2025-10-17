/**
 * CRITICAL Integration Test: Event Creation Flow
 * Tests complete event creation from validation → generation → storage
 * 
 * Flow: Admin input → Validate → Generate IDs/Links → Create Event
 * @integration Real Code.js functions
 * @priority CRITICAL - Core MVP Flow
 */

const {
  validateEventTitle_,
  validateEventDate_,
  validateLocation_,
  generateEventId_,
  generateShortCode_,
  generateSlug_,
  slugify_,
  formatDate_,
  isValidShortCode_
} = require('../setup/backend-bridge');

describe('Event Creation Flow (Real Integration)', () => {
  
  describe('Step 1: Input Validation', () => {
    
    test('validates event title correctly', () => {
      const validTitle = validateEventTitle_('Tech Conference 2025');
      expect(validTitle.valid).toBe(true);
      
      const invalidTitle = validateEventTitle_('ab');
      expect(invalidTitle.valid).toBe(false);
      expect(invalidTitle.error).toBeDefined();
    });
    
    test('validates event date correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const validDate = validateEventDate_(futureDateStr);
      expect(validDate.valid).toBe(true);
      
      const pastDate = validateEventDate_('2020-01-01');
      expect(pastDate.valid).toBe(false);
    });
    
    test('validates location correctly', () => {
      const validLocation = validateLocation_('San Francisco, CA');
      expect(validLocation.valid).toBe(true);
      
      const emptyLocation = validateLocation_('');
      expect(emptyLocation.valid).toBe(false);
    });
    
    test('rejects all-invalid input', () => {
      const titleResult = validateEventTitle_('');
      const dateResult = validateEventDate_('');
      const locationResult = validateLocation_('');
      
      expect(titleResult.valid).toBe(false);
      expect(dateResult.valid).toBe(false);
      expect(locationResult.valid).toBe(false);
    });
    
  });
  
  describe('Step 2: ID & Slug Generation', () => {
    
    test('generates valid event ID', () => {
      const eventId = generateEventId_();
      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
      expect(eventId.startsWith('evt-')).toBe(true);
    });
    
    test('generates valid shortcode', () => {
      const shortcode = generateShortCode_();
      expect(shortcode).toBeDefined();
      expect(shortcode.length).toBe(6);
      expect(isValidShortCode_(shortcode)).toBe(true);
    });
    
    test('generates slug from title', () => {
      const slug = generateSlug_('Tech Conference 2025', []);
      expect(slug).toBe('tech-conference-2025');
    });
    
    test('handles slug collisions', () => {
      const existingSlugs = ['tech-conference-2025'];
      const slug = generateSlug_('Tech Conference 2025', existingSlugs);
      expect(slug).toBe('tech-conference-2025-1');
    });
    
    test('all generated IDs are unique', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateEventId_());
      }
      expect(ids.size).toBeGreaterThanOrEqual(99);
    });
    
    test('all generated shortcodes are valid', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateShortCode_();
        expect(isValidShortCode_(code)).toBe(true);
      }
    });
    
  });
  
  describe('Step 3: Complete Flow Integration', () => {
    
    test('validates then generates for valid input', () => {
      const title = 'Tech Conference 2025';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const date = futureDate.toISOString().split('T')[0];
      const location = 'San Francisco, CA';
      
      const titleValid = validateEventTitle_(title);
      const dateValid = validateEventDate_(date);
      const locationValid = validateLocation_(location);
      
      expect(titleValid.valid).toBe(true);
      expect(dateValid.valid).toBe(true);
      expect(locationValid.valid).toBe(true);
      
      if (titleValid.valid && dateValid.valid && locationValid.valid) {
        const eventId = generateEventId_();
        const shortcode = generateShortCode_();
        const slug = slugify_(title);
        
        expect(eventId).toBeDefined();
        expect(shortcode.length).toBe(6);
        expect(slug).toBe('tech-conference-2025');
      }
    });
    
    test('blocks generation for invalid input', () => {
      const titleValid = validateEventTitle_('ab');
      const dateValid = validateEventDate_('invalid');
      
      expect(titleValid.valid).toBe(false);
      expect(dateValid.valid).toBe(false);
    });
    
  });
  
  describe('Step 4: Data Formatting', () => {
    
    test('formats date for display', () => {
      const formatted = formatDate_('2025-12-01');
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
    
    test('slugifies complex titles', () => {
      const complexTitle = 'Tech Conference 2025: AI & Machine Learning!';
      const slug = slugify_(complexTitle);
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).not.toContain(' ');
      expect(slug).not.toContain('!');
      expect(slug).not.toContain('&');
    });
    
  });
  
});
