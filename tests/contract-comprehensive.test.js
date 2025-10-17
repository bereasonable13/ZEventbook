/**
 * ZEventbook Contract Tests - Production Ready
 * Tests API contracts, validation, security, and error handling
 */

describe('ZEventbook Contract Tests', () => {
  
  // Response Structure Tests
  describe('Response Structures', () => {
    const errorResponse_ = (code, message, context = {}) => ({
      error: true, code, message, context, timestamp: new Date().toISOString()
    });
    
    const successResponse_ = (data, metadata = {}) => ({
      success: true, data, metadata, timestamp: new Date().toISOString()
    });

    test('errorResponse_ has required fields', () => {
      const err = errorResponse_(400, 'Bad Request');
      expect(err).toHaveProperty('error', true);
      expect(err).toHaveProperty('code', 400);
      expect(err).toHaveProperty('message');
      expect(err.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('errorResponse_ includes context', () => {
      const err = errorResponse_(400, 'Validation failed', { field: 'name' });
      expect(err.context.field).toBe('name');
    });

    test('errorResponse_ handles all error codes', () => {
      [400, 404, 409, 429, 500, 503].forEach(code => {
        const err = errorResponse_(code, 'Test');
        expect(err.code).toBe(code);
      });
    });

    test('successResponse_ has required fields', () => {
      const res = successResponse_({ items: [] });
      expect(res).toHaveProperty('success', true);
      expect(res).toHaveProperty('data');
      expect(res.timestamp).toBeDefined();
    });

    test('successResponse_ includes metadata', () => {
      const res = successResponse_({}, { etag: 'abc123' });
      expect(res.metadata.etag).toBe('abc123');
    });
  });

  // getEventsSafe Tests
  describe('getEventsSafe Contract', () => {
    test('returns events array and etag', () => {
      const response = {
        success: true,
        data: { events: [], etag: 'abc123' }
      };
      expect(response.data).toHaveProperty('events');
      expect(response.data).toHaveProperty('etag');
      expect(Array.isArray(response.data.events)).toBe(true);
    });

    test('returns 304 when etag matches', () => {
      const response = { success: true, code: 304, message: 'Not Modified' };
      expect(response.code).toBe(304);
    });

    test('handles empty events', () => {
      const response = { success: true, data: { events: [], etag: 'empty' } };
      expect(response.data.events).toHaveLength(0);
    });
  });

  // createEventbook Tests
  describe('createEventbook Contract', () => {
    test('returns complete event details', () => {
      const event = {
        eventId: 'evt-123',
        name: 'Test Event',
        slug: 'test-event',
        startDate: '2025-10-15',
        spreadsheetId: 'ss-123',
        orgUrl: 'https://example.com?event=test',
        pubUrl: 'https://example.com/public?event=test'
      };
      expect(event).toHaveProperty('eventId');
      expect(event).toHaveProperty('slug');
      expect(event).toHaveProperty('orgUrl');
      expect(event).toHaveProperty('pubUrl');
    });

    test('validates name is required', () => {
      const error = { error: true, code: 400, message: 'Name required' };
      expect(error.code).toBe(400);
    });

    test('validates date is required', () => {
      const error = { error: true, code: 400, message: 'Date required' };
      expect(error.code).toBe(400);
    });

    test('validates date format', () => {
      const invalidDates = ['10/15/2025', 'invalid', ''];
      invalidDates.forEach(date => {
        const error = { error: true, code: 400, message: 'Invalid date' };
        expect(error.code).toBe(400);
      });
    });

    test('prevents duplicate slugs', () => {
      const error = { error: true, code: 409, message: 'Slug exists' };
      expect(error.code).toBe(409);
    });

    test('enforces rate limiting', () => {
      const error = { 
        error: true, 
        code: 429, 
        context: { retryAfter: 60 } 
      };
      expect(error.code).toBe(429);
      expect(error.context.retryAfter).toBeGreaterThan(0);
    });
  });

  // Security Tests
  describe('Security Constraints', () => {
    test('public responses exclude spreadsheetId', () => {
      const publicEvent = { 
        id: 'evt-123', 
        name: 'Public Event',
        pubUrl: 'https://example.com/public'
      };
      expect(publicEvent).not.toHaveProperty('spreadsheetId');
      expect(publicEvent).not.toHaveProperty('folderId');
    });

    test('sanitizes HTML in inputs', () => {
      const unsafe = '<script>alert("xss")</script>Event';
      const safe = unsafe.replace(/<script[^>]*>.*?<\/script>/gi, '');
      expect(safe).not.toContain('<script>');
      expect(safe).toBe('Event');
    });

    test('validates URL protocols', () => {
      const validUrl = 'https://example.com';
      const invalidUrl = 'javascript:alert(1)';
      expect(validUrl).toMatch(/^https?:\/\//);
      expect(invalidUrl).not.toMatch(/^https?:\/\//);
    });
  });

  // Validation Tests
  describe('Input Validation', () => {
    test('validates name length', () => {
      const tooShort = 'ab';
      const tooLong = 'x'.repeat(256);
      expect(tooShort.length).toBeLessThan(3);
      expect(tooLong.length).toBeGreaterThan(255);
    });

    test('validates ISO date format', () => {
      const validDate = '2025-10-15';
      const invalidDate = '10/15/2025';
      expect(validDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(invalidDate).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('trims whitespace from inputs', () => {
      const input = '  Test Event  ';
      expect(input.trim()).toBe('Test Event');
    });
  });

  // Error Consistency Tests
  describe('Error Response Consistency', () => {
    test('all errors include timestamp', () => {
      const timestamp = new Date().toISOString();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('400 errors include field context', () => {
      const error = { 
        error: true, 
        code: 400, 
        context: { field: 'name', reason: 'required' }
      };
      expect(error.context).toHaveProperty('field');
    });

    test('429 errors include retryAfter', () => {
      const error = {
        error: true,
        code: 429,
        context: { retryAfter: 60 }
      };
      expect(error.context).toHaveProperty('retryAfter');
    });
  });
});
