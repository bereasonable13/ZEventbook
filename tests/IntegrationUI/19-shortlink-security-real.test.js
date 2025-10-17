/**
 * CRITICAL Integration Test: Shortlink Security
 * Tests shortlink generation, validation, and security measures
 * 
 * @integration Real Code.js functions
 * @security HIGH PRIORITY
 */

const {
  isValidShortCode_,
  generateShortCode_,
  validateEventTitle_,
  slugify_
} = require('../setup/backend-bridge');

describe('Shortlink Security (Real Integration)', () => {
  
  describe('Shortcode Security', () => {
    
    test('generates cryptographically random shortcodes', () => {
      const codes = new Set();
      for (let i = 0; i < 1000; i++) {
        codes.add(generateShortCode_());
      }
      expect(codes.size).toBe(1000);
    });
    
    test('shortcodes are case-insensitive safe', () => {
      const code = generateShortCode_();
      expect(code).toMatch(/^[a-z0-9]{6}$/);
      expect(code).not.toMatch(/[A-Z]/);
    });
    
    
    test('validates shortcode format strictly', () => {
      expect(isValidShortCode_('abc123')).toBe(true);
      expect(isValidShortCode_('ABCDEF')).toBe(false);
      expect(isValidShortCode_('abc12')).toBe(false);
      expect(isValidShortCode_('abc1234')).toBe(false);
      expect(isValidShortCode_('abc-12')).toBe(false);
      expect(isValidShortCode_('abc_12')).toBe(false);
    });
    
  });
  
  describe('URL Construction Security', () => {
    
    test('constructs safe public URLs', () => {
      const shortcode = generateShortCode_();
      const publicUrl = `https://example.com/e/${shortcode}`;
      
      expect(publicUrl).toMatch(/^https:\/\//);
      expect(publicUrl).not.toContain(' ');
      expect(publicUrl).not.toContain('<');
      expect(publicUrl).not.toContain('>');
    });
    
    test('handles malicious input in event names safely', () => {
      const maliciousInputs = [
        '<script>alert(1)</script>',
        'Event"><img src=x onerror=alert(1)>',
        'Event\'; DROP TABLE events;--',
        '../../../etc/passwd'
      ];
      
      maliciousInputs.forEach(input => {
        const validation = validateEventTitle_(input);
        if (validation.valid) {
          const slug = slugify_(input);
          expect(slug).toMatch(/^[a-z0-9-]*$/);
          expect(slug).not.toContain('<');
          expect(slug).not.toContain('>');
          expect(slug).not.toContain(';');
          expect(slug).not.toContain('..');
        }
      });
    });
    
    test('prevents path traversal in slugs', () => {
      const attempts = [
        '../admin',
        '../../root',
        './../etc/passwd'
      ];
      
      attempts.forEach(attempt => {
        const slug = slugify_(attempt);
        expect(slug).not.toContain('..');
        expect(slug).not.toContain('/');
      });
    });
    
  });
  
  describe('Collision Prevention', () => {
    
    test('shortcodes have low collision probability', () => {
      const codes = new Set();
      const iterations = 10000;
      
      for (let i = 0; i < iterations; i++) {
        codes.add(generateShortCode_());
      }
      
      const collisionRate = 1 - (codes.size / iterations);
      expect(collisionRate).toBeLessThan(0.01);
    });
    
    test('generates unique shortcodes on demand', () => {
      const batch1 = [];
      const batch2 = [];
      
      for (let i = 0; i < 100; i++) {
        batch1.push(generateShortCode_());
      }
      
      for (let i = 0; i < 100; i++) {
        batch2.push(generateShortCode_());
      }
      
      const combined = new Set([...batch1, ...batch2]);
      expect(combined.size).toBe(200);
    });
    
  });
  
  describe('Rate Limiting Preparation', () => {
    
    test('shortcode generation is fast enough for rate limiting', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        generateShortCode_();
      }
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
    });
    
    test('validation is performant', () => {
      const testCodes = [];
      for (let i = 0; i < 1000; i++) {
        testCodes.push(generateShortCode_());
      }
      
      const start = Date.now();
      testCodes.forEach(code => isValidShortCode_(code));
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(500);
    });
    
  });
  
  describe('Complete Shortlink Flow', () => {
    
    test('validates input, generates shortcode, constructs URL', () => {
      const title = 'Tech Conference 2025';
      const titleValidation = validateEventTitle_(title);
      expect(titleValidation.valid).toBe(true);
      
      const shortcode = generateShortCode_();
      expect(isValidShortCode_(shortcode)).toBe(true);
      
      const slug = slugify_(title);
      const publicUrl = `https://example.com/e/${shortcode}`;
      const adminUrl = `https://example.com/admin/${slug}`;
      
      expect(publicUrl).toContain(shortcode);
      expect(adminUrl).toContain(slug);
      expect(publicUrl).not.toBe(adminUrl);
    });
    
    test('handles rapid shortlink generation', () => {
      const links = [];
      for (let i = 0; i < 50; i++) {
        const shortcode = generateShortCode_();
        links.push(`https://example.com/e/${shortcode}`);
      }
      
      const uniqueLinks = new Set(links);
      expect(uniqueLinks.size).toBe(50);
    });
    
  });
  
  describe('Input Sanitization', () => {
    
    test('slugifies removes dangerous characters', () => {
      const dangerous = [
        'event<script>',
        'event\'>alert(1)',
        'event";alert(1)//',
        'event\n\r\t'
      ];
      
      dangerous.forEach(input => {
        const slug = slugify_(input);
        expect(slug).toMatch(/^[a-z0-9-]*$/);
      });
    });
    
    test('validates titles before slug generation', () => {
      const invalidTitles = ['', ' ', 'ab', null];
      
      invalidTitles.forEach(title => {
        const validation = validateEventTitle_(title);
        expect(validation.valid).toBe(false);
      });
    });
    
  });
  
});
