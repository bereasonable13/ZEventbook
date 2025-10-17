/**
 * Unit Tests: Validators (Utils)
 * 
 * Tests REAL validation functions from Code.gs
 * These are pure functions - no side effects, no external dependencies
 * 
 * Location: tests/unit/validators.test.js
 */

const {
  validateEventTitle_,
  isValidShortCode_,
  validateEventDate_,
  isValidTimeFormat_,
  validateLocation_,
  validateEventData_
} = require('../setup/backend-bridge');

describe('Utils: Validators', () => {
  
  // ==========================================
  // validateEventTitle_
  // ==========================================
  describe('validateEventTitle_', () => {
    
    test('accepts valid titles', () => {
      const validTitles = [
        'My Event',
        'Conference 2025',
        'Team Building @ Chicago',
        'Event with numbers 123',
        'A'.repeat(100) // Exactly 100 chars (max)
      ];
      
      validTitles.forEach(title => {
        const result = validateEventTitle_(title);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
    
    test('rejects null or undefined titles', () => {
      expect(validateEventTitle_(null).valid).toBe(false);
      expect(validateEventTitle_(undefined).valid).toBe(false);
      expect(validateEventTitle_(null).error).toContain('required');
    });
    
    test('rejects empty or whitespace-only titles', () => {
      const emptyTitles = ['', '   ', '\t', '\n'];
      
      emptyTitles.forEach(title => {
        const result = validateEventTitle_(title);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/empty|required/i);
      });
    });
    
    test('rejects titles shorter than 3 characters', () => {
      const shortTitles = ['A', 'AB', '12'];
      
      shortTitles.forEach(title => {
        const result = validateEventTitle_(title);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 3 characters');
      });
    });
    
    test('rejects titles longer than 100 characters', () => {
      const longTitle = 'A'.repeat(101);
      const result = validateEventTitle_(longTitle);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 100 characters');
    });
    
    test('trims whitespace before validating length', () => {
      const result = validateEventTitle_('   My Event   ');
      expect(result.valid).toBe(true);
    });
    
    test('accepts titles with special characters', () => {
      const specialTitles = [
        'Event @ Location',
        'Party & Celebration',
        'Meeting (Important)',
        'Event #1'
      ];
      
      specialTitles.forEach(title => {
        expect(validateEventTitle_(title).valid).toBe(true);
      });
    });
  });
  
  // ==========================================
  // isValidShortCode_
  // ==========================================
  describe('isValidShortCode_', () => {
    
    test('accepts valid 6-character alphanumeric codes', () => {
      const validCodes = [
        'abc123',
        'xyz789',
        '000000',
        'aaaaaa',
        'z9z9z9',
        'hello1'
      ];
      
      validCodes.forEach(code => {
        expect(isValidShortCode_(code)).toBe(true);
      });
    });
    
    test('rejects codes with incorrect length', () => {
      const invalidLengths = [
        'abc12',      // 5 chars
        'abc1234',    // 7 chars
        '',           // 0 chars
        'a',          // 1 char
        'ab',         // 2 chars
        'abcdefg'     // 7 chars
      ];
      
      invalidLengths.forEach(code => {
        expect(isValidShortCode_(code)).toBe(false);
      });
    });
    
    test('rejects codes with uppercase letters', () => {
      const uppercaseCodes = [
        'ABC123',
        'Abc123',
        'abc12C'
      ];
      
      uppercaseCodes.forEach(code => {
        expect(isValidShortCode_(code)).toBe(false);
      });
    });
    
    test('rejects codes with special characters', () => {
      const specialCharCodes = [
        'abc-23',   // Hyphen
        'abc 23',   // Space
        'abc@23',   // At sign
        'abc.23',   // Period
        'abc_23',   // Underscore
        'abcéfg'    // Accented
      ];
      
      specialCharCodes.forEach(code => {
        expect(isValidShortCode_(code)).toBe(false);
      });
    });
    
    test('rejects null and undefined', () => {
      expect(isValidShortCode_(null)).toBe(false);
      expect(isValidShortCode_(undefined)).toBe(false);
    });
    
    test('rejects non-string types', () => {
      expect(isValidShortCode_(123456)).toBe(false);
      expect(isValidShortCode_({})).toBe(false);
      expect(isValidShortCode_([])).toBe(false);
    });
  });
  
  // ==========================================
  // validateEventDate_
  // ==========================================
  describe('validateEventDate_', () => {
    
    test('accepts future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const result = validateEventDate_(futureDate.toISOString().split('T')[0]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
    
    test('accepts today\'s date', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = validateEventDate_(today);
      
      expect(result.valid).toBe(true);
    });
    
    test('rejects past dates', () => {
      const pastDate = '2020-01-01';
      const result = validateEventDate_(pastDate);
      
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/future|today/i);
    });
    
    test('rejects yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const result = validateEventDate_(yesterday.toISOString().split('T')[0]);
      expect(result.valid).toBe(false);
    });
    
    test('rejects invalid date formats', () => {
      const invalidFormats = [
        'not-a-date',
        '2025-13-01',     // Invalid month
        '2025-02-30',     // Invalid day
        '01/01/2025',     // Wrong format
        '2025/01/01'      // Wrong format
      ];
      
      invalidFormats.forEach(dateStr => {
        const result = validateEventDate_(dateStr);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid date format');
      });
    });
    
    test('rejects empty or null dates', () => {
      expect(validateEventDate_('').valid).toBe(false);
      expect(validateEventDate_(null).valid).toBe(false);
      expect(validateEventDate_(undefined).valid).toBe(false);
      
      expect(validateEventDate_('').error).toContain('required');
    });
    
    test('accepts dates far in the future', () => {
      const farFuture = '2030-12-31';
      const result = validateEventDate_(farFuture);
      
      expect(result.valid).toBe(true);
    });
  });
  
  // ==========================================
  // isValidTimeFormat_
  // ==========================================
  describe('isValidTimeFormat_', () => {
    
    test('accepts valid 24-hour time formats', () => {
      const validTimes = [
        '00:00',
        '09:30',
        '12:00',
        '18:45',
        '23:59'
      ];
      
      validTimes.forEach(time => {
        expect(isValidTimeFormat_(time)).toBe(true);
      });
    });
    
    test('accepts single-digit hours without leading zero', () => {
      const singleDigitHours = [
        '0:00',
        '9:30',
        '5:45'
      ];
      
      singleDigitHours.forEach(time => {
        expect(isValidTimeFormat_(time)).toBe(true);
      });
    });
    
    test('accepts empty/null time (optional field)', () => {
      expect(isValidTimeFormat_('')).toBe(true);
      expect(isValidTimeFormat_(null)).toBe(true);
      expect(isValidTimeFormat_(undefined)).toBe(true);
    });
    
    test('rejects invalid hours', () => {
      const invalidHours = [
        '24:00',    // Hour too high
        '25:30',
        '99:00'
      ];
      
      invalidHours.forEach(time => {
        expect(isValidTimeFormat_(time)).toBe(false);
      });
    });
    
    test('rejects invalid minutes', () => {
      const invalidMinutes = [
        '12:60',    // Minute too high
        '12:99',
        '12:5'      // Single digit minutes
      ];
      
      invalidMinutes.forEach(time => {
        expect(isValidTimeFormat_(time)).toBe(false);
      });
    });
    
    test('rejects 12-hour format with AM/PM', () => {
      const twelveHourFormats = [
        '6:00 PM',
        '6:00PM',
        '06:00 AM'
      ];
      
      twelveHourFormats.forEach(time => {
        expect(isValidTimeFormat_(time)).toBe(false);
      });
    });
    
    test('rejects missing colon', () => {
      expect(isValidTimeFormat_('1200')).toBe(false);
      expect(isValidTimeFormat_('12 00')).toBe(false);
    });
  });
  
  // ==========================================
  // validateLocation_
  // ==========================================
  describe('validateLocation_', () => {
    
    test('accepts valid locations', () => {
      const validLocations = [
        'Chicago, IL',
        'New York',
        'Online',
        'Virtual Event',
        '123 Main St',
        'Conference Room A'
      ];
      
      validLocations.forEach(location => {
        const result = validateLocation_(location);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
    
    test('rejects empty or null locations', () => {
      expect(validateLocation_('').valid).toBe(false);
      expect(validateLocation_('   ').valid).toBe(false);
      expect(validateLocation_(null).valid).toBe(false);
      expect(validateLocation_(undefined).valid).toBe(false);
      
      expect(validateLocation_('').error).toContain('required');
    });
    
    test('trims whitespace', () => {
      const result = validateLocation_('   Chicago   ');
      expect(result.valid).toBe(true);
    });
  });
  
  // ==========================================
  // validateEventData_ (Composite Validator)
  // ==========================================
  describe('validateEventData_', () => {
    
    test('accepts complete valid event data', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const validEvent = {
        title: 'Test Event',
        date: futureDate.toISOString().split('T')[0],
        time: '18:00',
        location: 'Chicago, IL'
      };
      
      const result = validateEventData_(validEvent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('accepts minimal event (no optional time)', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const minimalEvent = {
        title: 'Minimal Event',
        date: futureDate.toISOString().split('T')[0],
        location: 'Chicago'
      };
      
      const result = validateEventData_(minimalEvent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('catches all validation errors at once', () => {
      const invalidEvent = {
        title: 'AB',           // Too short
        date: '2020-01-01',    // Past date
        time: '25:00',         // Invalid time
        location: ''           // Empty
      };
      
      const result = validateEventData_(invalidEvent);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      
      // Check that all errors are captured
      const errorText = result.errors.join(' ');
      expect(errorText).toMatch(/title/i);
      expect(errorText).toMatch(/date/i);
      expect(errorText).toMatch(/time/i);
      expect(errorText).toMatch(/location/i);
    });
    
    test('allows optional time field to be omitted', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const eventWithoutTime = {
        title: 'All Day Event',
        date: futureDate.toISOString().split('T')[0],
        location: 'Chicago'
      };
      
      const result = validateEventData_(eventWithoutTime);
      expect(result.valid).toBe(true);
    });
    
    test('validates time format only if time is provided', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const eventWithInvalidTime = {
        title: 'Event With Bad Time',
        date: futureDate.toISOString().split('T')[0],
        time: 'not-a-time',
        location: 'Chicago'
      };
      
      const result = validateEventData_(eventWithInvalidTime);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('time'))).toBe(true);
    });
  });
});
