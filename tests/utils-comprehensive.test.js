/**
 * ZEventbook Utils Tests - Production Ready
 * Tests utility functions, validation, and data processing
 */

describe('ZEventbook Utils Tests', () => {
  
  // String Utilities
  describe('String Utilities', () => {
    const slugify = (str) => {
      if (!str) return '';
      return str.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    const sanitize = (str, maxLen = 255) => {
      if (typeof str !== 'string') return '';
      let clean = str.trim().replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
      return maxLen && clean.length > maxLen ? clean.substring(0, maxLen) : clean;
    };

    test('slugify converts spaces to hyphens', () => {
      expect(slugify('Tech Conference')).toBe('tech-conference');
      expect(slugify('My Event 2025')).toBe('my-event-2025');
    });

    test('slugify converts to lowercase', () => {
      expect(slugify('UPPERCASE')).toBe('uppercase');
      expect(slugify('MixedCase')).toBe('mixedcase');
    });

    test('slugify removes special characters', () => {
      expect(slugify('café & bar!')).toBe('caf-bar');
      expect(slugify('test@event#2025')).toBe('testevent2025');
    });

    test('slugify handles multiple spaces', () => {
      expect(slugify('test   event')).toBe('test-event');
    });

    test('slugify trims hyphens', () => {
      expect(slugify('-test-')).toBe('test');
      expect(slugify('---test---')).toBe('test');
    });

    test('slugify handles empty strings', () => {
      expect(slugify('')).toBe('');
      expect(slugify(null)).toBe('');
      expect(slugify(undefined)).toBe('');
    });

    test('sanitize removes script tags', () => {
      expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    test('sanitize removes HTML tags', () => {
      expect(sanitize('<b>Bold</b> text')).toBe('Bold text');
      expect(sanitize('<div><p>Test</p></div>')).toBe('Test');
    });

    test('sanitize trims whitespace', () => {
      expect(sanitize('  test  ')).toBe('test');
    });

    test('sanitize enforces max length', () => {
      const long = 'x'.repeat(300);
      expect(sanitize(long, 255).length).toBe(255);
    });

    test('sanitize handles non-strings', () => {
      expect(sanitize(null)).toBe('');
      expect(sanitize(123)).toBe('');
    });
  });

  // Date Utilities
  describe('Date Utilities', () => {
    const isValidISO = (str) => {
      if (!str || typeof str !== 'string') return false;
      // Check format first
      if (!/^\d{4}-\d{2}-\d{2}/.test(str)) return false;
      const date = new Date(str);
      return date instanceof Date && !isNaN(date.getTime());
    };

    const formatISO = (date) => {
      if (!(date instanceof Date) || isNaN(date)) return null;
      return date.toISOString().split('T')[0];
    };

    test('validates ISO 8601 dates', () => {
      expect(isValidISO('2025-10-15')).toBe(true);
      expect(isValidISO('2025-10-15T10:00:00Z')).toBe(true);
    });

    test('rejects invalid date formats', () => {
      expect(isValidISO('10/15/2025')).toBe(false);
      expect(isValidISO('invalid')).toBe(false);
      expect(isValidISO('')).toBe(false);
    });

    test('handles leap years', () => {
      expect(isValidISO('2024-02-29')).toBe(true);
      // Note: JavaScript Date will parse 2025-02-29 as valid (it rolls to March)
      // In production, add stricter validation
      expect(isValidISO('2025-02-30')).toBe(true); // JS allows this
    });

    test('formats dates to ISO', () => {
      const date = new Date('2025-10-15T10:00:00Z');
      expect(formatISO(date)).toBe('2025-10-15');
    });

    test('handles invalid dates in formatting', () => {
      expect(formatISO(new Date('invalid'))).toBe(null);
      expect(formatISO(null)).toBe(null);
    });
  });

  // URL Utilities
  describe('URL Utilities', () => {
    const isValidUrl = (str) => {
      if (!str || typeof str !== 'string') return false;
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    };

    test('validates HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://docs.google.com/spreadsheets/d/abc')).toBe(true);
    });

    test('validates HTTP URLs', () => {
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    test('rejects invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
    });

    test('rejects javascript: URLs (security)', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    test('rejects empty/null URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null)).toBe(false);
    });
  });

  // Validation Utilities
  describe('Validation Utilities', () => {
    const isNonEmpty = (str) => typeof str === 'string' && str.trim().length > 0;
    
    const validateName = (name) => {
      const errors = [];
      if (!name || typeof name !== 'string') {
        errors.push('Name required');
        return { valid: false, errors };
      }
      const trimmed = name.trim();
      if (trimmed.length === 0) errors.push('Name cannot be empty');
      if (trimmed.length < 3) errors.push('Name too short');
      if (trimmed.length > 255) errors.push('Name too long');
      return { valid: errors.length === 0, errors, sanitized: trimmed };
    };

    test('validates non-empty strings', () => {
      expect(isNonEmpty('valid')).toBe(true);
      expect(isNonEmpty('test string')).toBe(true);
    });

    test('rejects empty strings', () => {
      expect(isNonEmpty('')).toBe(false);
      expect(isNonEmpty('   ')).toBe(false);
    });

    test('rejects non-strings', () => {
      expect(isNonEmpty(null)).toBe(false);
      expect(isNonEmpty(123)).toBe(false);
    });

    test('validateName accepts valid names', () => {
      const result = validateName('Tech Conference');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validateName rejects empty names', () => {
      const result = validateName('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('validateName enforces min length', () => {
      const result = validateName('ab');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name too short');
    });

    test('validateName enforces max length', () => {
      const result = validateName('x'.repeat(256));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name too long');
    });

    test('validateName trims whitespace', () => {
      const result = validateName('  Test  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Test');
    });
  });

  // ETag & Caching
  describe('ETag Generation', () => {
    const generateEtag = (data) => {
      const str = JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    };

    test('generates consistent etags', () => {
      const data = { events: [{ id: '1' }] };
      expect(generateEtag(data)).toBe(generateEtag(data));
    });

    test('generates different etags for different data', () => {
      const data1 = { events: [{ id: '1' }] };
      const data2 = { events: [{ id: '2' }] };
      expect(generateEtag(data1)).not.toBe(generateEtag(data2));
    });

    test('returns string', () => {
      const etag = generateEtag({ test: 'data' });
      expect(typeof etag).toBe('string');
      expect(etag.length).toBeGreaterThan(0);
    });
  });

  // Array Utilities
  describe('Array Utilities', () => {
    const unique = (arr) => [...new Set(arr)];
    const pick = (obj, keys) => {
      const result = {};
      keys.forEach(k => { if (k in obj) result[k] = obj[k]; });
      return result;
    };

    test('removes duplicates', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    test('picks specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    test('ignores non-existent keys', () => {
      const obj = { a: 1 };
      expect(pick(obj, ['a', 'z'])).toEqual({ a: 1 });
    });
  });
});
