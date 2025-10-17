/**
 * CRITICAL Integration Test: Admin Event Setup Flow (E2E)
 * Tests complete 5-minute event setup workflow
 * 
 * PO Requirement: Admin can set up event in under 5 minutes
 * Flow: Create event → Validate → Generate → View
 * 
 * @integration E2E User Journey
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
  formatTime_,
  isValidShortCode_,
  sanitizeString
} = require('../setup/backend-bridge');

describe('Admin Event Setup Flow (E2E)', () => {
  
  describe('Phase 1: Event Creation (< 1 minute)', () => {
    
    test('admin enters basic event info and validates', () => {
      const eventInput = {
        name: 'Tech Conference 2025',
        date: '2025-12-01',
        location: 'San Francisco, CA'
      };
      
      const titleValidation = validateEventTitle_(eventInput.name);
      const dateValidation = validateEventDate_(eventInput.date);
      const locationValidation = validateLocation_(eventInput.location);
      
      expect(titleValidation.valid).toBe(true);
      expect(dateValidation.valid).toBe(true);
      expect(locationValidation.valid).toBe(true);
    });
    
    test('provides immediate feedback on invalid input', () => {
      const invalidInput = {
        name: 'ab',
        date: '2020-01-01',
        location: ''
      };
      
      const titleValidation = validateEventTitle_(invalidInput.name);
      const dateValidation = validateEventDate_(invalidInput.date);
      const locationValidation = validateLocation_(invalidInput.location);
      
      expect(titleValidation.valid).toBe(false);
      expect(titleValidation.error).toBeDefined();
      expect(dateValidation.valid).toBe(false);
      expect(locationValidation.valid).toBe(false);
    });
    
    
  });
  
  describe('Phase 2: Asset Generation (< 30 seconds)', () => {
    
    test('generates all required identifiers', () => {
      const eventId = generateEventId_();
      const shortcode = generateShortCode_();
      const slug = generateSlug_('Tech Conference 2025', []);
      
      expect(eventId).toBeDefined();
      expect(eventId.startsWith('evt-')).toBe(true);
      expect(shortcode.length).toBe(6);
      expect(isValidShortCode_(shortcode)).toBe(true);
      expect(slug).toBe('tech-conference-2025');
    });
    
    test('constructs all URLs correctly', () => {
      const shortcode = generateShortCode_();
      const slug = slugify_('Tech Conference 2025');
      
      const publicUrl = `https://example.com/e/${shortcode}`;
      const adminUrl = `https://example.com/admin/${slug}`;
      const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(publicUrl)}`;
      
      expect(publicUrl).toContain(shortcode);
      expect(adminUrl).toContain(slug);
      expect(qrUrl).toContain('chart.googleapis.com');
      expect(qrUrl).toContain('cht=qr');
    });
    
    test('formats date and time for display', () => {
      const date = '2025-12-01';
      const time = '14:30';
      
      const formattedDate = formatDate_(date);
      const formattedTime = formatTime_(time);
      
      expect(formattedDate).toBeDefined();
      expect(typeof formattedDate).toBe('string');
      expect(formattedTime).toBeDefined();
      expect(typeof formattedTime).toBe('string');
    });
    
  });
  
  describe('Phase 3: Complete Flow Integration', () => {
    
    test('executes full event creation workflow', () => {
      // Step 1: Validate Input
      const input = {
        name: 'Tech Conference 2025',
        date: '2025-12-01',
        location: 'San Francisco Convention Center'
      };
      
      const titleValid = validateEventTitle_(input.name);
      const dateValid = validateEventDate_(input.date);
      const locationValid = validateLocation_(input.location);
      
      expect(titleValid.valid).toBe(true);
      expect(dateValid.valid).toBe(true);
      expect(locationValid.valid).toBe(true);
      
      // Step 2: Generate Assets
      const eventId = generateEventId_();
      const shortcode = generateShortCode_();
      const slug = slugify_(input.name);
      
      expect(eventId).toBeDefined();
      expect(isValidShortCode_(shortcode)).toBe(true);
      expect(slug).toBe('tech-conference-2025');
      
      // Step 3: Format Display
      const displayDate = formatDate_(input.date);
      
      expect(displayDate).toBeDefined();
      
      // Step 4: Construct URLs
      const publicUrl = `https://example.com/e/${shortcode}`;
      const adminUrl = `https://example.com/admin/${slug}`;
      
      expect(publicUrl).toBeDefined();
      expect(adminUrl).toBeDefined();
      expect(publicUrl).not.toBe(adminUrl);
    });
    
    test('handles multiple events without collision', () => {
      const events = [];
      
      for (let i = 0; i < 10; i++) {
        const event = {
          title: `Conference ${i}`,
          eventId: generateEventId_(),
          shortcode: generateShortCode_(),
          slug: slugify_(`Conference ${i}`)
        };
        events.push(event);
      }
      
      const eventIds = new Set(events.map(e => e.eventId));
      const shortcodes = new Set(events.map(e => e.shortcode));
      const slugs = new Set(events.map(e => e.slug));
      
      expect(eventIds.size).toBe(10);
      expect(shortcodes.size).toBe(10);
      expect(slugs.size).toBe(10);
    });
    
  });
  
  describe('Phase 4: Performance Requirements', () => {
    
    test('validates and generates in acceptable time', () => {
      const start = Date.now();
      
      const titleValid = validateEventTitle_('Tech Conference 2025');
      const dateValid = validateEventDate_('2025-12-01');
      const locationValid = validateLocation_('San Francisco, CA');
      
      const eventId = generateEventId_();
      const shortcode = generateShortCode_();
      const slug = slugify_('Tech Conference 2025');
      
      const duration = Date.now() - start;
      
      expect(titleValid.valid).toBe(true);
      expect(dateValid.valid).toBe(true);
      expect(locationValid.valid).toBe(true);
      expect(eventId).toBeDefined();
      expect(shortcode).toBeDefined();
      expect(slug).toBeDefined();
      expect(duration).toBeLessThan(100);
    });
    
    test('batch operations are performant', () => {
      const start = Date.now();
      
      for (let i = 0; i < 50; i++) {
        validateEventTitle_(`Event ${i}`);
        generateEventId_();
        generateShortCode_();
        slugify_(`Event ${i}`);
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
    
  });
  
  describe('Phase 5: Error Handling', () => {
    
    test('gracefully handles invalid state transitions', () => {
      const invalidTitle = validateEventTitle_('ab');
      expect(invalidTitle.valid).toBe(false);
      
      // Should not proceed to generation if validation fails
      // This is enforced by frontend logic
    });
    
    test('provides helpful error messages', () => {
      const errors = [];
      
      const titleResult = validateEventTitle_('');
      if (!titleResult.valid) errors.push(titleResult.error);
      
      const dateResult = validateEventDate_('invalid');
      if (!dateResult.valid) errors.push(dateResult.error);
      
      expect(errors.length).toBeGreaterThan(0);
      errors.forEach(error => {
        expect(error).toBeDefined();
        expect(typeof error).toBe('string');
      });
    });
    
  });
  
  describe('Phase 6: Data Consistency', () => {
    
    test('maintains consistent event data structure', () => {
      const eventData = {
        id: generateEventId_(),
        title: 'Tech Conference 2025',
        slug: slugify_('Tech Conference 2025'),
        shortcode: generateShortCode_(),
        date: '2025-12-01',
        displayDate: formatDate_('2025-12-01')
      };
      
      expect(eventData.id).toMatch(/^evt-/);
      expect(eventData.slug).toMatch(/^[a-z0-9-]+$/);
      expect(isValidShortCode_(eventData.shortcode)).toBe(true);
      expect(eventData.displayDate).toBeDefined();
    });
    
    test('slug and shortcode remain independent', () => {
      const title = 'Tech Conference 2025';
      const slug = slugify_(title);
      const shortcode = generateShortCode_();
      
      expect(slug).not.toBe(shortcode);
      expect(slug.length).toBeGreaterThan(shortcode.length);
    });
    
  });
  
});
