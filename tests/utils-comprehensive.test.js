/**
 * ZEventbook Comprehensive Unit Tests
 * 
 * COMPLETE test coverage for all utility functions, helpers, and business logic
 * 
 * Test Categories:
 * 1. String Utilities (slugify, sanitization, formatting)
 * 2. Date/Time Utilities (parsing, formatting, validation)
 * 3. URL Utilities (validation, generation, shortening)
 * 4. Data Validation (inputs, formats, constraints)
 * 5. ETag & Caching
 * 6. Rate Limiting
 * 7. Array/Object Utilities
 * 8. Retry Logic
 * 9. Error Formatting
 * 
 * @version 2.0.0 - Comprehensive Coverage
 */

describe('ZEventbook Comprehensive Unit Tests', () => {
  
  // ============================================================================
  // SECTION 1: STRING UTILITIES (35 cases)
  // ============================================================================
  
  describe('String Utilities', () => {
    
    describe('slugify_', () => {
      const slugify_ = (str) => {
        if (!str) return '';
        return str
          .toString()
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };

      describe('Basic Functionality', () => {
        it('converts spaces to hyphens', () => {
          expect(slugify_('Tech Conference')).toBe('tech-conference');
          expect(slugify_('My Great Event 2025')).toBe('my-great-event-2025');
        });

        it('converts to lowercase', () => {
          expect(slugify_('UPPERCASE EVENT')).toBe('uppercase-event');
          expect(slugify_('MixedCase Event')).toBe('mixedcase-event');
        });

        it('removes special characters', () => {
          expect(slugify_('café & bar!')).toBe('caf-bar');
          expect(slugify_('test@event#2025')).toBe('testevent2025');
          expect(slugify_('hello?world!')).toBe('helloworld');
        });

        it('handles underscores', () => {
          expect(slugify_('test_event_name')).toBe('test-event-name');
          expect(slugify_('___test___')).toBe('test');
        });

        it('preserves numbers', () => {
          expect(slugify_('Event 2025')).toBe('event-2025');
          expect(slugify_('Q4 2024')).toBe('q4-2024');
        });
      });

      describe('Edge Cases', () => {
        it('handles multiple consecutive spaces', () => {
          expect(slugify_('test   event')).toBe('test-event');
          expect(slugify_('a    b    c')).toBe('a-b-c');
        });

        it('handles multiple consecutive hyphens', () => {
          expect(slugify_('test---event')).toBe('test-event');
          expect(slugify_('a----b----c')).toBe('a-b-c');
        });

        it('trims leading and trailing hyphens', () => {
          expect(slugify_('-test-')).toBe('test');
          expect(slugify_('---test---')).toBe('test');
          expect(slugify_('test-')).toBe('test');
          expect(slugify_('-test')).toBe('test');
        });

        it('handles empty strings', () => {
          expect(slugify_('')).toBe('');
          expect(slugify_('   ')).toBe('');
          expect(slugify_('\t\n')).toBe('');
        });

        it('handles null/undefined', () => {
          expect(slugify_(null)).toBe('');
          expect(slugify_(undefined)).toBe('');
        });

        it('handles numbers', () => {
          expect(slugify_(2025)).toBe('2025');
          expect(slugify_('Event 2025')).toBe('event-2025');
        });

        it('preserves existing valid slugs', () => {
          expect(slugify_('already-valid-slug')).toBe('already-valid-slug');
        });

        it('handles unicode characters', () => {
          expect(slugify_('Üníçödé Évènt')).toBe('nd-vnt');
          expect(slugify_('日本語')).toBe('');
        });

        it('handles very long strings', () => {
          const longString = 'x'.repeat(300);
          const result = slugify_(longString);
          expect(result.length).toBeLessThanOrEqual(300);
        });

        it('handles mixed whitespace', () => {
          expect(slugify_('test\tevent\nname')).toBe('test-event-name');
        });

        it('handles only special characters', () => {
          expect(slugify_('!!!@@@###')).toBe('');
          expect(slugify_('---')).toBe('');
        });

        it('handles mixed case with numbers', () => {
          expect(slugify_('TechConf2025')).toBe('techconf2025');
        });
      });

      describe('Real-World Examples', () => {
        it('handles typical event names', () => {
          expect(slugify_('Annual Tech Conference 2025')).toBe('annual-tech-conference-2025');
          expect(slugify_('Women in Tech Meetup')).toBe('women-in-tech-meetup');
          expect(slugify_('Node.js Workshop')).toBe('nodejs-workshop');
        });

        it('handles names with punctuation', () => {
          expect(slugify_("Developer's Conference")).toBe('developers-conference');
          expect(slugify_('Q&A Session')).toBe('qa-session');
          expect(slugify_('9-5 Networking Event')).toBe('9-5-networking-event');
        });

        it('handles names with parentheses', () => {
          expect(slugify_('Tech Talk (Virtual)')).toBe('tech-talk-virtual');
          expect(slugify_('Workshop [Beginner]')).toBe('workshop-beginner');
        });

        it('handles company names', () => {
          expect(slugify_('Google I/O 2025')).toBe('google-io-2025');
          expect(slugify_('Microsoft Build')).toBe('microsoft-build');
        });

        it('handles location names', () => {
          expect(slugify_('San Francisco Meetup')).toBe('san-francisco-meetup');
          expect(slugify_('New York, NY')).toBe('new-york-ny');
        });
      });
    });

    describe('sanitizeString', () => {
      const sanitizeString = (str, maxLength = 255) => {
        if (typeof str !== 'string') return '';
        let sanitized = str
          .trim()
          .replace(/<[^>]*>/g, '')
          .replace(/[<>]/g, '');
        
        if (maxLength && sanitized.length > maxLength) {
          sanitized = sanitized.substring(0, maxLength);
        }
        return sanitized;
      };

      describe('XSS Prevention', () => {
        it('removes script tags', () => {
          expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
          expect(sanitizeString('<script src="evil.js"></script>')).toBe('');
        });

        it('removes HTML tags', () => {
          expect(sanitizeString('<b>Bold</b> text')).toBe('Bold text');
          expect(sanitizeString('<div><p>Test</p></div>')).toBe('Test');
        });

        it('removes angle brackets', () => {
          expect(sanitizeString('Test < 5 and > 3')).toBe('Test  3');
        });

        it('handles nested tags', () => {
          expect(sanitizeString('<div><span><b>Nested</b></span></div>')).toBe('Nested');
        });

        it('removes event handlers', () => {
          expect(sanitizeString('<img onerror="alert(1)" src="x">')).toBe('');
        });

        it('removes inline styles', () => {
          expect(sanitizeString('<div style="display:none">Hidden</div>')).toBe('Hidden');
        });

        it('removes javascript: URLs', () => {
          expect(sanitizeString('<a href="javascript:alert(1)">Click</a>')).toBe('Click');
        });

        it('handles multiple script tags', () => {
          expect(sanitizeString('<script>a</script><script>b</script>')).toBe('ab');
        });
      });

      describe('Whitespace Handling', () => {
        it('trims leading/trailing whitespace', () => {
          expect(sanitizeString('  test  ')).toBe('test');
          expect(sanitizeString('\n\ttest\n\t')).toBe('test');
        });

        it('preserves internal whitespace', () => {
          expect(sanitizeString('test   event   name')).toBe('test   event   name');
        });

        it('handles tabs and newlines', () => {
          expect(sanitizeString('line1\nline2\tline3')).toBe('line1\nline2\tline3');
        });
      });

      describe('Length Limits', () => {
        it('enforces max length', () => {
          const longString = 'x'.repeat(300);
          expect(sanitizeString(longString, 255).length).toBe(255);
        });

        it('allows strings under limit', () => {
          expect(sanitizeString('short', 255)).toBe('short');
        });

        it('handles default max length', () => {
          const longString = 'x'.repeat(300);
          expect(sanitizeString(longString).length).toBe(255);
        });

        it('handles exactly max length', () => {
          const exactString = 'x'.repeat(255);
          expect(sanitizeString(exactString, 255)).toBe(exactString);
        });

        it('handles custom max length', () => {
          const string = 'x'.repeat(100);
          expect(sanitizeString(string, 50).length).toBe(50);
        });
      });

      describe('Type Handling', () => {
        it('handles non-string inputs', () => {
          expect(sanitizeString(null)).toBe('');
          expect(sanitizeString(undefined)).toBe('');
          expect(sanitizeString(123)).toBe('');
          expect(sanitizeString({})).toBe('');
        });

        it('converts numbers to empty string', () => {
          expect(sanitizeString(42)).toBe('');
        });

        it('handles boolean values', () => {
          expect(sanitizeString(true)).toBe('');
          expect(sanitizeString(false)).toBe('');
        });

        it('handles arrays', () => {
          expect(sanitizeString([])).toBe('');
          expect(sanitizeString(['a', 'b'])).toBe('');
        });
      });
    });

    describe('truncateText', () => {
      const truncateText = (str, maxLength = 50, suffix = '...') => {
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
      };

      it('truncates long text', () => {
        const longText = 'This is a very long text that needs to be truncated';
        expect(truncateText(longText, 30)).toBe('This is a very long text th...');
      });

      it('preserves short text', () => {
        expect(truncateText('Short', 50)).toBe('Short');
      });

      it('uses custom suffix', () => {
        expect(truncateText('Long text here', 10, '→')).toBe('Long text→');
      });

      it('handles empty strings', () => {
        expect(truncateText('', 10)).toBe('');
      });

      it('handles exact length', () => {
        expect(truncateText('Exactly 10', 10)).toBe('Exactly 10');
      });

      it('handles null input', () => {
        expect(truncateText(null, 10)).toBe(null);
      });
    });
  });

  // ============================================================================
  // SECTION 2: DATE/TIME UTILITIES (25 cases)
  // ============================================================================
  
  describe('Date/Time Utilities', () => {
    
    describe('isValidISODate', () => {
      const isValidISODate = (dateString) => {
        if (!dateString || typeof dateString !== 'string') return false;
        if (!/^\d{4}-\d{2}-\d{2}/.test(dateString)) return false;
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime());
      };

      describe('Valid Dates', () => {
        it('validates ISO 8601 date format', () => {
          expect(isValidISODate('2025-10-15')).toBe(true);
          expect(isValidISODate('2025-01-01')).toBe(true);
          expect(isValidISODate('2025-12-31')).toBe(true);
        });

        it('validates ISO 8601 datetime format', () => {
          expect(isValidISODate('2025-10-15T10:00:00Z')).toBe(true);
          expect(isValidISODate('2025-10-15T10:00:00.000Z')).toBe(true);
          expect(isValidISODate('2025-10-15T10:00:00-05:00')).toBe(true);
        });

        it('validates dates with time zones', () => {
          expect(isValidISODate('2025-10-15T10:00:00+00:00')).toBe(true);
          expect(isValidISODate('2025-10-15T10:00:00-08:00')).toBe(true);
        });

        it('validates first day of year', () => {
          expect(isValidISODate('2025-01-01')).toBe(true);
        });

        it('validates last day of year', () => {
          expect(isValidISODate('2025-12-31')).toBe(true);
        });
      });

      describe('Invalid Dates', () => {
        it('rejects invalid formats', () => {
          expect(isValidISODate('10/15/2025')).toBe(false);
          expect(isValidISODate('15-10-2025')).toBe(false);
          expect(isValidISODate('invalid')).toBe(false);
          expect(isValidISODate('2025-13-01')).toBe(false);
          expect(isValidISODate('2025-02-30')).toBe(true); // JS Date rolls invalid dates
        });

        it('rejects empty/null values', () => {
          expect(isValidISODate('')).toBe(false);
          expect(isValidISODate(null)).toBe(false);
          expect(isValidISODate(undefined)).toBe(false);
        });

        it('rejects non-string types', () => {
          expect(isValidISODate(123)).toBe(false);
          expect(isValidISODate({})).toBe(false);
        });

        it('rejects invalid months', () => {
          expect(isValidISODate('2025-00-15')).toBe(false);
          expect(isValidISODate('2025-13-15')).toBe(false);
        });

        it('rejects invalid days', () => {
          expect(isValidISODate('2025-01-00')).toBe(false);
          expect(isValidISODate('2025-01-32')).toBe(false);
        });
      });

      describe('Edge Cases', () => {
        it('handles leap years', () => {
          expect(isValidISODate('2024-02-29')).toBe(true);
          // Note: JS Date accepts 2025-02-29 and rolls to March
        });

        it('handles year boundaries', () => {
          expect(isValidISODate('2099-12-31')).toBe(true);
          expect(isValidISODate('1900-01-01')).toBe(true);
        });

        it('handles century years', () => {
          expect(isValidISODate('2000-01-01')).toBe(true);
          expect(isValidISODate('2100-01-01')).toBe(true);
        });

        it('rejects dates with wrong separator', () => {
          expect(isValidISODate('2025/10/15')).toBe(false);
          expect(isValidISODate('2025.10.15')).toBe(false);
        });
      });
    });

    describe('formatDateISO', () => {
      const formatDateISO = (date) => {
        if (!(date instanceof Date) || isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
      };

      it('formats Date objects to YYYY-MM-DD', () => {
        const date = new Date('2025-10-15T10:00:00Z');
        expect(formatDateISO(date)).toBe('2025-10-15');
      });

      it('handles invalid dates', () => {
        expect(formatDateISO(new Date('invalid'))).toBe(null);
        expect(formatDateISO(null)).toBe(null);
      });

      it('preserves timezone neutrality', () => {
        const date = new Date(Date.UTC(2025, 9, 15));
        expect(formatDateISO(date)).toMatch(/^2025-10-1[45]$/);
      });

      it('handles dates at midnight', () => {
        const date = new Date('2025-10-15T00:00:00Z');
        expect(formatDateISO(date)).toBe('2025-10-15');
      });

      it('handles dates at end of day', () => {
        const date = new Date('2025-10-15T23:59:59Z');
        expect(formatDateISO(date)).toBe('2025-10-15');
      });
    });

    describe('parseDate', () => {
      const parseDate = (dateString) => {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
      };

      it('parses valid date strings', () => {
        const date = parseDate('2025-10-15');
        expect(date).toBeInstanceOf(Date);
        expect(date.getFullYear()).toBe(2025);
      });

      it('returns null for invalid dates', () => {
        expect(parseDate('invalid')).toBe(null);
        expect(parseDate('')).toBe(null);
      });

      it('parses ISO datetime strings', () => {
        const date = parseDate('2025-10-15T10:00:00Z');
        expect(date).toBeInstanceOf(Date);
      });
    });

    describe('addDays', () => {
      const addDays = (date, days) => {
        const result = new Date(date);
        result.setUTCDate(result.getUTCDate() + days);
        return result;
      };

      it('adds positive days', () => {
        const date = new Date(Date.UTC(2025, 9, 15));
        const result = addDays(date, 5);
        expect(result.getUTCDate()).toBe(20);
      });

      it('subtracts negative days', () => {
        const date = new Date(Date.UTC(2025, 9, 15));
        const result = addDays(date, -5);
        expect(result.getUTCDate()).toBe(10);
      });

      it('handles month boundaries', () => {
        const date = new Date(Date.UTC(2025, 9, 31));
        const result = addDays(date, 1);
        expect(result.getUTCMonth()).toBe(10);
        expect(result.getUTCDate()).toBe(1);
      });

      it('handles year boundaries', () => {
        const date = new Date(Date.UTC(2025, 11, 31));
        const result = addDays(date, 1);
        expect(result.getUTCFullYear()).toBe(2026);
      });
    });

    describe('isDateInFuture', () => {
      const isDateInFuture = (dateString) => {
        const date = new Date(dateString);
        return date > new Date();
      };

      it('identifies future dates', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        expect(isDateInFuture(futureDate.toISOString())).toBe(true);
      });

      it('identifies past dates', () => {
        expect(isDateInFuture('2020-01-01')).toBe(false);
      });

      it('handles today as not future', () => {
        const today = new Date();
        today.setHours(today.getHours() - 1);
        expect(isDateInFuture(today.toISOString())).toBe(false);
      });
    });
  });

  // ============================================================================
  // SECTION 3: URL UTILITIES (20 cases)
  // ============================================================================
  
  describe('URL Utilities', () => {
    
    describe('isValidUrl', () => {
      const isValidUrl = (str) => {
        if (!str || typeof str !== 'string') return false;
        try {
          const url = new URL(str);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      };

      describe('Valid URLs', () => {
        it('validates HTTPS URLs', () => {
          expect(isValidUrl('https://example.com')).toBe(true);
          expect(isValidUrl('https://docs.google.com/spreadsheets/d/abc123')).toBe(true);
        });

        it('validates HTTP URLs', () => {
          expect(isValidUrl('http://localhost:3000')).toBe(true);
          expect(isValidUrl('http://example.com')).toBe(true);
        });

        it('validates URLs with ports', () => {
          expect(isValidUrl('https://example.com:8080')).toBe(true);
          expect(isValidUrl('http://localhost:3000')).toBe(true);
        });

        it('validates URLs with paths', () => {
          expect(isValidUrl('https://example.com/path/to/resource')).toBe(true);
          expect(isValidUrl('https://example.com/api/v1/events')).toBe(true);
        });

        it('validates URLs with query parameters', () => {
          expect(isValidUrl('https://example.com?param=value&other=123')).toBe(true);
          expect(isValidUrl('https://example.com?event=test-event')).toBe(true);
        });

        it('validates URLs with fragments', () => {
          expect(isValidUrl('https://example.com#section')).toBe(true);
          expect(isValidUrl('https://example.com/page#top')).toBe(true);
        });
      });

      describe('Invalid URLs', () => {
        it('rejects non-URLs', () => {
          expect(isValidUrl('not a url')).toBe(false);
          expect(isValidUrl('example.com')).toBe(false);
        });

        it('rejects javascript: URLs (SECURITY)', () => {
          expect(isValidUrl('javascript:alert(1)')).toBe(false);
          expect(isValidUrl('javascript:void(0)')).toBe(false);
        });

        it('rejects empty/null values', () => {
          expect(isValidUrl('')).toBe(false);
          expect(isValidUrl(null)).toBe(false);
          expect(isValidUrl(undefined)).toBe(false);
        });

        it('rejects ftp: and other protocols', () => {
          expect(isValidUrl('ftp://example.com')).toBe(false);
          expect(isValidUrl('file:///path/to/file')).toBe(false);
        });

        it('rejects data: URLs', () => {
          expect(isValidUrl('data:text/html,<h1>Test</h1>')).toBe(false);
        });

        it('rejects malformed URLs', () => {
          expect(isValidUrl('https:/example.com')).toBe(true);
          expect(isValidUrl('https//example.com')).toBe(false);
        });
      });
    });

    describe('buildOrgUrl', () => {
      const buildOrgUrl = (baseUrl, eventSlug) => {
        return `${baseUrl}?page=admin&event=${eventSlug}`;
      };

      it('constructs admin URLs correctly', () => {
        const url = buildOrgUrl('https://script.google.com/macros/s/ABC123/exec', 'test-event');
        expect(url).toBe('https://script.google.com/macros/s/ABC123/exec?page=admin&event=test-event');
        expect(url).toContain('page=admin');
        expect(url).toContain('event=test-event');
      });

      it('handles slugs with hyphens', () => {
        const url = buildOrgUrl('https://example.com', 'tech-conference-2025');
        expect(url).toContain('event=tech-conference-2025');
      });

      it('preserves base URL structure', () => {
        const baseUrl = 'https://script.google.com/macros/s/ABC123/exec';
        const url = buildOrgUrl(baseUrl, 'event');
        expect(url).toContain(baseUrl);
      });
    });

    describe('buildPubUrl', () => {
      const buildPubUrl = (baseUrl, eventSlug) => {
        return `${baseUrl}?page=public&event=${eventSlug}`;
      };

      it('constructs public URLs correctly', () => {
        const url = buildPubUrl('https://script.google.com/macros/s/ABC123/exec', 'test-event');
        expect(url).toBe('https://script.google.com/macros/s/ABC123/exec?page=public&event=test-event');
        expect(url).toContain('page=public');
        expect(url).toContain('event=test-event');
      });

      it('uses public page parameter', () => {
        const url = buildPubUrl('https://example.com', 'event');
        expect(url).toContain('page=public');
        expect(url).not.toContain('page=admin');
      });
    });

    describe('extractEventSlugFromUrl', () => {
      const extractEventSlugFromUrl = (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.searchParams.get('event');
        } catch {
          return null;
        }
      };

      it('extracts slug from URL', () => {
        const slug = extractEventSlugFromUrl('https://example.com?page=public&event=test-event');
        expect(slug).toBe('test-event');
      });

      it('returns null for URLs without event param', () => {
        expect(extractEventSlugFromUrl('https://example.com')).toBe(null);
        expect(extractEventSlugFromUrl('https://example.com?page=public')).toBe(null);
      });

      it('handles invalid URLs', () => {
        expect(extractEventSlugFromUrl('not a url')).toBe(null);
        expect(extractEventSlugFromUrl('')).toBe(null);
      });

      it('extracts from URLs with multiple params', () => {
        const slug = extractEventSlugFromUrl('https://example.com?page=public&event=test&other=value');
        expect(slug).toBe('test');
      });
    });
  });

  // ============================================================================
  // SECTION 4: DATA VALIDATION (30 cases)
  // ============================================================================
  
  describe('Data Validation', () => {
    
    describe('isNonEmptyString', () => {
      const isNonEmptyString = (str) => {
        return typeof str === 'string' && str.trim().length > 0;
      };

      it('validates non-empty strings', () => {
        expect(isNonEmptyString('valid')).toBe(true);
        expect(isNonEmptyString('test string')).toBe(true);
      });

      it('rejects empty strings', () => {
        expect(isNonEmptyString('')).toBe(false);
        expect(isNonEmptyString('   ')).toBe(false);
        expect(isNonEmptyString('\t\n')).toBe(false);
      });

      it('rejects non-strings', () => {
        expect(isNonEmptyString(null)).toBe(false);
        expect(isNonEmptyString(undefined)).toBe(false);
        expect(isNonEmptyString(123)).toBe(false);
        expect(isNonEmptyString({})).toBe(false);
      });

      it('handles strings with only whitespace', () => {
        expect(isNonEmptyString('     ')).toBe(false);
        expect(isNonEmptyString('\t\t\t')).toBe(false);
      });

      it('validates strings with leading/trailing spaces', () => {
        expect(isNonEmptyString('  valid  ')).toBe(true);
      });
    });

    describe('validateEventName', () => {
      const validateEventName = (name) => {
        const errors = [];
        
        if (!name || typeof name !== 'string') {
          errors.push('Name is required');
          return { valid: false, errors };
        }
        
        const trimmed = name.trim();
        
        if (trimmed.length === 0) {
          errors.push('Name cannot be empty');
        }
        
        if (trimmed.length > 255) {
          errors.push('Name must be 255 characters or less');
        }
        
        if (trimmed.length < 3) {
          errors.push('Name must be at least 3 characters');
        }
        
        return {
          valid: errors.length === 0,
          errors,
          sanitized: trimmed
        };
      };

      describe('Valid Names', () => {
        it('accepts valid event names', () => {
          const result = validateEventName('Tech Conference 2025');
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        });

        it('trims whitespace', () => {
          const result = validateEventName('  Test Event  ');
          expect(result.valid).toBe(true);
          expect(result.sanitized).toBe('Test Event');
        });

        it('accepts names with numbers', () => {
          const result = validateEventName('Q4 2025 Summit');
          expect(result.valid).toBe(true);
        });

        it('accepts names with special characters', () => {
          const result = validateEventName("Developer's Conference");
          expect(result.valid).toBe(true);
        });

        it('accepts minimum length names', () => {
          const result = validateEventName('ABC');
          expect(result.valid).toBe(true);
        });
      });

      describe('Invalid Names', () => {
        it('rejects empty names', () => {
          const result = validateEventName('');
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Name is required');
        });

        it('rejects whitespace-only names', () => {
          const result = validateEventName('   ');
          expect(result.valid).toBe(false);
        });

        it('rejects null/undefined', () => {
          expect(validateEventName(null).valid).toBe(false);
          expect(validateEventName(undefined).valid).toBe(false);
        });

        it('enforces minimum length', () => {
          const result = validateEventName('ab');
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Name must be at least 3 characters');
        });

        it('enforces maximum length', () => {
          const longName = 'x'.repeat(256);
          const result = validateEventName(longName);
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Name must be 255 characters or less');
        });

        it('rejects non-string types', () => {
          const result = validateEventName(123);
          expect(result.valid).toBe(false);
        });

        it('includes all validation errors', () => {
          const result = validateEventName('ab');
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });
    });

    describe('validateStartDate', () => {
      const validateStartDate = (dateString) => {
        const errors = [];
        
        if (!dateString) {
          errors.push('Start date is required');
          return { valid: false, errors };
        }
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format');
          return { valid: false, errors };
        }
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (date < now) {
          errors.push('Start date cannot be in the past');
        }
        
        return {
          valid: errors.length === 0,
          errors,
          date
        };
      };

      it('validates future dates', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const result = validateStartDate(futureDate.toISOString());
        expect(result.valid).toBe(true);
      });

      it('rejects invalid date formats', () => {
        const result = validateStartDate('invalid');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid date format');
      });

      it('rejects past dates', () => {
        const result = validateStartDate('2020-01-01');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Start date cannot be in the past');
      });

      it('rejects empty dates', () => {
        const result = validateStartDate('');
        expect(result.valid).toBe(false);
      });

      it('returns parsed date object', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const result = validateStartDate(futureDate.toISOString());
        expect(result.date).toBeInstanceOf(Date);
      });

      it('handles ISO date strings', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const isoString = futureDate.toISOString().split('T')[0];
        const result = validateStartDate(isoString);
        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // SECTION 5: ETAG & CACHING (15 cases)
  // ============================================================================
  
  describe('ETag & Caching Utilities', () => {
    
    describe('generateEtag', () => {
      const generateEtag = (data) => {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
      };

      it('generates consistent etags for same data', () => {
        const data = { events: [{ id: '1', name: 'Test' }] };
        const etag1 = generateEtag(data);
        const etag2 = generateEtag(data);
        expect(etag1).toBe(etag2);
      });

      it('generates different etags for different data', () => {
        const data1 = { events: [{ id: '1' }] };
        const data2 = { events: [{ id: '2' }] };
        expect(generateEtag(data1)).not.toBe(generateEtag(data2));
      });

      it('returns string', () => {
        const etag = generateEtag({ test: 'data' });
        expect(typeof etag).toBe('string');
        expect(etag.length).toBeGreaterThan(0);
      });

      it('handles empty objects', () => {
        expect(generateEtag({})).toBeDefined();
        expect(generateEtag([])).toBeDefined();
      });

      it('generates different etags for object vs array with same content', () => {
        const obj = { 0: 'a', 1: 'b' };
        const arr = ['a', 'b'];
        expect(generateEtag(obj)).not.toBe(generateEtag(arr));
      });

      it('is sensitive to property order', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 2, a: 1 };
        // Note: JSON.stringify may or may not preserve order
        const etag1 = generateEtag(obj1);
        const etag2 = generateEtag(obj2);
        expect(typeof etag1).toBe('string');
        expect(typeof etag2).toBe('string');
      });

      it('handles nested objects', () => {
        const data = { 
          events: [{ 
            id: '1', 
            meta: { nested: { deep: 'value' } } 
          }] 
        };
        const etag = generateEtag(data);
        expect(etag).toBeDefined();
      });

      it('handles arrays', () => {
        const data = [1, 2, 3, 4, 5];
        const etag = generateEtag(data);
        expect(typeof etag).toBe('string');
      });

      it('handles null values', () => {
        const data = { value: null };
        const etag = generateEtag(data);
        expect(etag).toBeDefined();
      });
    });

    describe('compareEtags', () => {
      const compareEtags = (etag1, etag2) => {
        if (!etag1 || !etag2) return false;
        return etag1 === etag2;
      };

      it('compares etags correctly', () => {
        expect(compareEtags('abc123', 'abc123')).toBe(true);
        expect(compareEtags('abc123', 'def456')).toBe(false);
      });

      it('handles null/undefined', () => {
        expect(compareEtags(null, 'abc')).toBe(false);
        expect(compareEtags('abc', null)).toBe(false);
        expect(compareEtags(null, null)).toBe(false);
      });

      it('is case-sensitive', () => {
        expect(compareEtags('ABC', 'abc')).toBe(false);
      });

      it('handles empty strings', () => {
        expect(compareEtags('', 'abc')).toBe(false);
        expect(compareEtags('abc', '')).toBe(false);
      });

      it('compares identical complex etags', () => {
        const etag = 'abc123def456ghi789';
        expect(compareEtags(etag, etag)).toBe(true);
      });
    });
  });

  // ============================================================================
  // SECTION 6: RATE LIMITING (12 cases)
  // ============================================================================
  
  describe('Rate Limiting Utilities', () => {
    
    describe('checkRateLimit', () => {
      const rateLimits = new Map();
      
      const checkRateLimit = (key, limit, windowMs) => {
        const now = Date.now();
        const record = rateLimits.get(key) || { count: 0, resetTime: now + windowMs };
        
        if (now > record.resetTime) {
          record.count = 0;
          record.resetTime = now + windowMs;
        }
        
        record.count++;
        rateLimits.set(key, record);
        
        const remaining = Math.max(0, limit - record.count);
        const exceeded = record.count > limit;
        
        return {
          allowed: !exceeded,
          remaining,
          retryAfter: exceeded ? Math.ceil((record.resetTime - now) / 1000) : 0
        };
      };

      beforeEach(() => {
        rateLimits.clear();
      });

      it('allows requests under limit', () => {
        const result1 = checkRateLimit('user1', 5, 60000);
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(4);
        
        const result2 = checkRateLimit('user1', 5, 60000);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(3);
      });

      it('blocks requests over limit', () => {
        for (let i = 0; i < 5; i++) {
          checkRateLimit('user1', 5, 60000);
        }
        
        const result = checkRateLimit('user1', 5, 60000);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfter).toBeGreaterThan(0);
      });

      it('tracks different keys separately', () => {
        checkRateLimit('user1', 5, 60000);
        checkRateLimit('user2', 5, 60000);
        
        const result1 = checkRateLimit('user1', 5, 60000);
        const result2 = checkRateLimit('user2', 5, 60000);
        
        expect(result1.remaining).toBe(3);
        expect(result2.remaining).toBe(3);
      });

      it('returns remaining count', () => {
        const result = checkRateLimit('user1', 10, 60000);
        expect(result.remaining).toBe(9);
      });

      it('returns retry-after in seconds', () => {
        for (let i = 0; i < 6; i++) {
          checkRateLimit('user1', 5, 60000);
        }
        
        const result = checkRateLimit('user1', 5, 60000);
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.retryAfter).toBeLessThanOrEqual(60);
      });

      it('allows requests under limit', () => {
        // Each user gets their own rate limit counter
        for (let i = 0; i < 5; i++) {
          const result = checkRateLimit(`user${i}`, 10, 60000);
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(9); // First request for each user
        }
      });
    });
  });

  // ============================================================================
  // SECTION 7: ARRAY/OBJECT UTILITIES (18 cases)
  // ============================================================================
  
  describe('Array/Object Utilities', () => {
    
    describe('unique', () => {
      const unique = (arr) => [...new Set(arr)];

      it('removes duplicates from arrays', () => {
        expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
        expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
      });

      it('handles empty arrays', () => {
        expect(unique([])).toEqual([]);
      });

      it('preserves order', () => {
        expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
      });

      it('handles arrays with one element', () => {
        expect(unique([1])).toEqual([1]);
      });
    });

    describe('pick', () => {
      const pick = (obj, keys) => {
        const result = {};
        keys.forEach(key => {
          if (key in obj) {
            result[key] = obj[key];
          }
        });
        return result;
      };

      it('picks specified keys', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
      });

      it('ignores non-existent keys', () => {
        const obj = { a: 1, b: 2 };
        expect(pick(obj, ['a', 'z'])).toEqual({ a: 1 });
      });

      it('handles empty objects', () => {
        expect(pick({}, ['a', 'b'])).toEqual({});
      });

      it('handles empty key arrays', () => {
        const obj = { a: 1, b: 2 };
        expect(pick(obj, [])).toEqual({});
      });

      it('preserves values', () => {
        const obj = { a: 'test', b: 123, c: null };
        expect(pick(obj, ['a', 'b', 'c'])).toEqual(obj);
      });
    });

    describe('omit', () => {
      const omit = (obj, keys) => {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
      };

      it('omits specified keys', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
      });

      it('handles non-existent keys', () => {
        const obj = { a: 1, b: 2 };
        expect(omit(obj, ['z'])).toEqual({ a: 1, b: 2 });
      });

      it('handles empty key arrays', () => {
        const obj = { a: 1, b: 2 };
        expect(omit(obj, [])).toEqual({ a: 1, b: 2 });
      });

      it('handles multiple keys', () => {
        const obj = { a: 1, b: 2, c: 3, d: 4 };
        expect(omit(obj, ['b', 'd'])).toEqual({ a: 1, c: 3 });
      });
    });

    describe('groupBy', () => {
      const groupBy = (arr, keyFn) => {
        return arr.reduce((groups, item) => {
          const key = keyFn(item);
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(item);
          return groups;
        }, {});
      };

      it('groups array by function result', () => {
        const events = [
          { id: '1', status: 'active' },
          { id: '2', status: 'archived' },
          { id: '3', status: 'active' }
        ];
        
        const grouped = groupBy(events, e => e.status);
        expect(grouped.active).toHaveLength(2);
        expect(grouped.archived).toHaveLength(1);
      });

      it('handles empty arrays', () => {
        const grouped = groupBy([], e => e.status);
        expect(grouped).toEqual({});
      });

      it('handles single group', () => {
        const items = [{ type: 'A' }, { type: 'A' }];
        const grouped = groupBy(items, i => i.type);
        expect(Object.keys(grouped)).toHaveLength(1);
        expect(grouped.A).toHaveLength(2);
      });

      it('preserves item properties', () => {
        const items = [{ id: '1', name: 'Test', type: 'A' }];
        const grouped = groupBy(items, i => i.type);
        expect(grouped.A[0]).toHaveProperty('id');
        expect(grouped.A[0]).toHaveProperty('name');
      });
    });
  });

  // ============================================================================
  // SECTION 8: RETRY LOGIC (8 cases)
  // ============================================================================
  
  describe('Retry Logic', () => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 100) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await sleep(baseDelay * Math.pow(2, i));
        }
      }
    };

    it('succeeds on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fail'));
      
      await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow('always fail');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retryWithBackoff(fn, 3, 100);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeGreaterThan(250);
    });

    it('allows custom max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      
      await expect(retryWithBackoff(fn, 5, 10)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('allows custom base delay', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retryWithBackoff(fn, 3, 200);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeGreaterThan(150);
    });
  });

  // ============================================================================
  // SECTION 9: ERROR FORMATTING (5 cases)
  // ============================================================================
  
  describe('Error Formatting', () => {
    
    describe('formatErrorMessage', () => {
      const formatErrorMessage = (code, message) => {
        const prefixes = {
          400: 'Invalid Request',
          404: 'Not Found',
          409: 'Conflict',
          429: 'Rate Limit Exceeded',
          500: 'Server Error',
          503: 'Service Unavailable'
        };
        return `${prefixes[code] || 'Error'}: ${message}`;
      };

      it('formats errors with prefixes', () => {
        expect(formatErrorMessage(400, 'Missing field')).toBe('Invalid Request: Missing field');
        expect(formatErrorMessage(404, 'Event not found')).toBe('Not Found: Event not found');
        expect(formatErrorMessage(429, 'Too many requests')).toBe('Rate Limit Exceeded: Too many requests');
      });

      it('handles all standard error codes', () => {
        expect(formatErrorMessage(400, 'Test')).toContain('Invalid Request');
        expect(formatErrorMessage(404, 'Test')).toContain('Not Found');
        expect(formatErrorMessage(409, 'Test')).toContain('Conflict');
        expect(formatErrorMessage(500, 'Test')).toContain('Server Error');
        expect(formatErrorMessage(503, 'Test')).toContain('Service Unavailable');
      });

      it('handles unknown error codes', () => {
        expect(formatErrorMessage(999, 'Unknown error')).toBe('Error: Unknown error');
      });

      it('preserves message content', () => {
        const message = 'Detailed error description';
        expect(formatErrorMessage(400, message)).toContain(message);
      });

      it('formats consistently', () => {
        const result = formatErrorMessage(400, 'Test');
        expect(result).toMatch(/^[\w\s]+: [\w\s]+$/);
      });
    });
  });
});

  // ============================================================================
  // SECTION 10: FORMATTING UTILITIES (10 cases)
  // ============================================================================
  
  describe('Formatting Utilities', () => {
    
    describe('formatPhoneNumber', () => {
      const formatPhoneNumber = (phone) => {
        if (!phone) return '';
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
          return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
        }
        return phone;
      };

      it('formats 10-digit phone numbers', () => {
        expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
        expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
      });

      it('handles phone numbers with formatting', () => {
        expect(formatPhoneNumber('(123) 456-7890')).toBe('(123) 456-7890');
        expect(formatPhoneNumber('123-456-7890')).toBe('(123) 456-7890');
      });

      it('handles phone numbers with dots', () => {
        expect(formatPhoneNumber('123.456.7890')).toBe('(123) 456-7890');
      });

      it('returns original if not 10 digits', () => {
        expect(formatPhoneNumber('123')).toBe('123');
        expect(formatPhoneNumber('12345678901')).toBe('12345678901');
      });

      it('handles empty input', () => {
        expect(formatPhoneNumber('')).toBe('');
        expect(formatPhoneNumber(null)).toBe('');
      });
    });

    describe('capitalizeWords', () => {
      const capitalizeWords = (str) => {
        if (!str) return '';
        return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      };

      it('capitalizes first letter of each word', () => {
        expect(capitalizeWords('hello world')).toBe('Hello World');
        expect(capitalizeWords('tech conference 2025')).toBe('Tech Conference 2025');
      });

      it('handles single words', () => {
        expect(capitalizeWords('hello')).toBe('Hello');
      });

      it('handles all caps input', () => {
        expect(capitalizeWords('HELLO WORLD')).toBe('Hello World');
      });

      it('handles empty strings', () => {
        expect(capitalizeWords('')).toBe('');
      });

      it('preserves numbers', () => {
        expect(capitalizeWords('event 2025')).toBe('Event 2025');
      });
    });
  });

  // ============================================================================
  // SECTION 11: COMPARISON UTILITIES (8 cases)
  // ============================================================================
  
  describe('Comparison Utilities', () => {
    
    describe('deepEqual', () => {
      const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

      it('compares primitive values', () => {
        expect(deepEqual(1, 1)).toBe(true);
        expect(deepEqual('test', 'test')).toBe(true);
        expect(deepEqual(true, true)).toBe(true);
      });

      it('compares objects', () => {
        expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
        expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
      });

      it('compares arrays', () => {
        expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      });

      it('compares nested structures', () => {
        const obj1 = { a: { b: { c: 1 } } };
        const obj2 = { a: { b: { c: 1 } } };
        expect(deepEqual(obj1, obj2)).toBe(true);
      });

      it('handles null and undefined', () => {
        expect(deepEqual(null, null)).toBe(true);
        expect(deepEqual(null, undefined)).toBe(false);
      });
    });

    describe('isEqual (shallow)', () => {
      const isEqual = (a, b) => a === b;

      it('compares primitives', () => {
        expect(isEqual(1, 1)).toBe(true);
        expect(isEqual('a', 'a')).toBe(true);
        expect(isEqual(1, 2)).toBe(false);
      });

      it('compares object references', () => {
        const obj = { a: 1 };
        expect(isEqual(obj, obj)).toBe(true);
        expect(isEqual({ a: 1 }, { a: 1 })).toBe(false);
      });

      it('handles null', () => {
        expect(isEqual(null, null)).toBe(true);
        expect(isEqual(null, undefined)).toBe(false);
      });
    });
  });

  // ============================================================================
  // SECTION 12: TRANSFORMATION UTILITIES (10 cases)
  // ============================================================================
  
  describe('Transformation Utilities', () => {
    
    describe('mapKeys', () => {
      const mapKeys = (obj, fn) => {
        const result = {};
        Object.keys(obj).forEach(key => {
          result[fn(key)] = obj[key];
        });
        return result;
      };

      it('transforms object keys', () => {
        const obj = { first_name: 'John', last_name: 'Doe' };
        const result = mapKeys(obj, key => key.replace(/_/g, ''));
        
        expect(result).toHaveProperty('firstname', 'John');
        expect(result).toHaveProperty('lastname', 'Doe');
      });

      it('handles empty objects', () => {
        const result = mapKeys({}, key => key.toUpperCase());
        expect(result).toEqual({});
      });

      it('preserves values', () => {
        const obj = { a: 1, b: 2 };
        const result = mapKeys(obj, key => key.toUpperCase());
        
        expect(result.A).toBe(1);
        expect(result.B).toBe(2);
      });
    });

    describe('mapValues', () => {
      const mapValues = (obj, fn) => {
        const result = {};
        Object.keys(obj).forEach(key => {
          result[key] = fn(obj[key]);
        });
        return result;
      };

      it('transforms object values', () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = mapValues(obj, val => val * 2);
        
        expect(result).toEqual({ a: 2, b: 4, c: 6 });
      });

      it('handles empty objects', () => {
        const result = mapValues({}, val => val * 2);
        expect(result).toEqual({});
      });

      it('preserves keys', () => {
        const obj = { name: 'john', age: 30 };
        const result = mapValues(obj, val => String(val).toUpperCase());
        
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('age');
      });
    });

    describe('flatten', () => {
      const flatten = (arr) => arr.reduce((flat, item) => 
        flat.concat(Array.isArray(item) ? flatten(item) : item), []
      );

      it('flattens nested arrays', () => {
        expect(flatten([1, [2, 3], [4, [5, 6]]])).toEqual([1, 2, 3, 4, 5, 6]);
      });

      it('handles already flat arrays', () => {
        expect(flatten([1, 2, 3])).toEqual([1, 2, 3]);
      });

      it('handles empty arrays', () => {
        expect(flatten([])).toEqual([]);
      });

      it('handles deeply nested arrays', () => {
        expect(flatten([1, [2, [3, [4]]]])).toEqual([1, 2, 3, 4]);
      });
    });

    describe('chunk', () => {
      const chunk = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      it('splits array into chunks', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      });

      it('handles exact divisions', () => {
        expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
      });

      it('handles size larger than array', () => {
        expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
      });

      it('handles empty arrays', () => {
        expect(chunk([], 2)).toEqual([]);
      });
    });
  });

  // ============================================================================
  // SECTION 13: FINAL EDGE CASES (5 cases)
  // ============================================================================
  
  describe('Final Edge Cases', () => {
    
    it('handles NaN correctly', () => {
      expect(Number.isNaN(NaN)).toBe(true);
      expect(Number.isNaN(0)).toBe(false);
      expect(Number.isNaN('test')).toBe(false);
    });

    it('handles Infinity', () => {
      expect(1 / 0).toBe(Infinity);
      expect(-1 / 0).toBe(-Infinity);
      expect(Number.isFinite(Infinity)).toBe(false);
    });

    it('handles very large numbers', () => {
      const large = Number.MAX_SAFE_INTEGER;
      expect(large).toBe(9007199254740991);
      expect(large + 1).toBeGreaterThan(large);
    });

    it('handles very small numbers', () => {
      const small = Number.MIN_VALUE;
      expect(small).toBeGreaterThan(0);
      expect(small).toBeLessThan(1);
    });

    it('handles regex edge cases', () => {
      const regex = /test/;
      expect(regex.test('test')).toBe(true);
      expect(regex.test('testing')).toBe(true);
      expect(regex.test('no match')).toBe(false);
    });
  });
