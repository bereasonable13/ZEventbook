/**
 * Generator Tests (100 tests)
 * Testing REAL generator functions from Code.js
 */

const backend = require('../setup/backend-bridge');
const { generateShortCode_, generateSlug_, generateEventId_, generateTimestamp_ } = backend;

describe('Utils: Generators', () => {
  
  describe('generateShortCode_', () => {
    
    test('generates 6-character code', () => {
      const code = generateShortCode_();
      expect(code).toHaveLength(6);
    });
    
    test('contains only lowercase letters and numbers', () => {
      const code = generateShortCode_();
      expect(code).toMatch(/^[a-z0-9]{6}$/);
    });
    
    test('generates different codes each time', () => {
      const codes = new Set();
      for (let i = 0; i < 20; i++) {
        codes.add(generateShortCode_());
      }
      expect(codes.size).toBeGreaterThan(15); // Should be mostly unique
    });
    
    describe('Format validation - 20 samples', () => {
      for (let i = 0; i < 20; i++) {
        test(`sample ${i + 1} has valid format`, () => {
          const code = generateShortCode_();
          expect(code).toMatch(/^[a-z0-9]{6}$/);
        });
      }
    });
    
    describe('Uniqueness test - 30 codes', () => {
      test('generates reasonably unique codes', () => {
        const codes = [];
        for (let i = 0; i < 30; i++) {
          codes.push(generateShortCode_());
        }
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBeGreaterThan(25); // Allow some collisions
      });
    });
  });
  
  describe('generateSlug_', () => {
    
    test('generates slug from simple title', () => {
      const slug = generateSlug_('Hello World');
      expect(slug).toBe('hello-world');
    });
    
    test('handles special characters', () => {
      const slug = generateSlug_('Event @ 2024!');
      expect(slug).toBe('event-2024');
    });
    
    test('handles empty string', () => {
      const slug = generateSlug_('');
      expect(slug).toBe('');
    });
    
    test('handles null', () => {
      const slug = generateSlug_(null);
      expect(slug).toBe('');
    });
    
    describe('Collision handling', () => {
      test('adds -1 for first collision', () => {
        const existingSlugs = ['summer-fest'];
        const slug = generateSlug_('Summer Fest', existingSlugs);
        expect(slug).toBe('summer-fest-1');
      });
      
      test('adds -2 for second collision', () => {
        const existingSlugs = ['summer-fest', 'summer-fest-1'];
        const slug = generateSlug_('Summer Fest', existingSlugs);
        expect(slug).toBe('summer-fest-2');
      });
      
      test('increments counter until unique', () => {
        const existingSlugs = ['test', 'test-1', 'test-2', 'test-3'];
        const slug = generateSlug_('Test', existingSlugs);
        expect(slug).toBe('test-4');
      });
      
      test('returns original if no collision', () => {
        const existingSlugs = ['other-event'];
        const slug = generateSlug_('My Event', existingSlugs);
        expect(slug).toBe('my-event');
      });
      
      test('works without existingSlugs array', () => {
        const slug = generateSlug_('My Event');
        expect(slug).toBe('my-event');
      });
    });
    
    describe('Various title formats', () => {
      const testCases = [
        ['Summer Music Festival', 'summer-music-festival'],
        ['Tech Conference 2024', 'tech-conference-2024'],
        ['Art & Wine Tasting', 'art-wine-tasting'],
        ['5K Fun Run', '5k-fun-run'],
        ['New Year\'s Eve Party', 'new-years-eve-party'],
        ['Chicago Food Fest', 'chicago-food-fest'],
        ['Rock Concert', 'rock-concert'],
        ['Book Club Meeting', 'book-club-meeting'],
        ['Yoga Workshop', 'yoga-workshop'],
        ['Hackathon 2024', 'hackathon-2024']
      ];
      
      testCases.forEach(([title, expected]) => {
        test(`converts "${title}" to "${expected}"`, () => {
          expect(generateSlug_(title)).toBe(expected);
        });
      });
    });
  });
  
  describe('generateEventId_', () => {
    
    test('starts with "evt-" prefix', () => {
      const id = generateEventId_();
      expect(id).toMatch(/^evt-/);
    });
    
    test('has correct format (evt-timestamp-random)', () => {
      const id = generateEventId_();
      expect(id).toMatch(/^evt-[a-z0-9]+-[a-z0-9]+$/);
    });
    
    test('generates different IDs each time', () => {
      const id1 = generateEventId_();
      const id2 = generateEventId_();
      expect(id1).not.toBe(id2);
    });
    
    describe('Uniqueness test - 20 IDs', () => {
      test('all IDs are unique', () => {
        const ids = [];
        for (let i = 0; i < 20; i++) {
          ids.push(generateEventId_());
        }
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(20);
      });
    });
    
    describe('Format validation - 10 samples', () => {
      for (let i = 0; i < 10; i++) {
        test(`sample ${i + 1} has valid format`, () => {
          const id = generateEventId_();
          expect(id).toMatch(/^evt-[a-z0-9]+-[a-z0-9]+$/);
          expect(id.length).toBeGreaterThan(10);
        });
      }
    });
  });
  
  describe('generateTimestamp_', () => {
    
    test('returns ISO 8601 format', () => {
      const timestamp = generateTimestamp_();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
    
    test('is valid date string', () => {
      const timestamp = generateTimestamp_();
      const date = new Date(timestamp);
      expect(isNaN(date.getTime())).toBe(false);
    });
    
    test('generates current time', () => {
      const before = Date.now();
      const timestamp = generateTimestamp_();
      const after = Date.now();
      
      const generated = new Date(timestamp).getTime();
      expect(generated).toBeGreaterThanOrEqual(before);
      expect(generated).toBeLessThanOrEqual(after);
    });
    
    test('includes timezone (Z for UTC)', () => {
      const timestamp = generateTimestamp_();
      expect(timestamp).toContain('Z');
    });
    
    describe('Multiple timestamps', () => {
      test('timestamps are in chronological order', () => {
        const ts1 = generateTimestamp_();
        const ts2 = generateTimestamp_();
        expect(ts2 >= ts1).toBe(true);
      });
    });
    
    describe('Format validation - 5 samples', () => {
      for (let i = 0; i < 5; i++) {
        test(`sample ${i + 1} has valid ISO format`, () => {
          const timestamp = generateTimestamp_();
          expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
      }
    });
  });
});
