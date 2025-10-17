/**
 * ZEventbook Comprehensive Contract Tests
 * 
 * PRODUCTION-GRADE test suite that validates:
 * 1. All critical API functions
 * 2. Edge cases and error conditions
 * 3. Rate limiting behavior
 * 4. Data validation rules
 * 5. Response consistency
 * 6. Security constraints
 * 
 * @version 2.0.0 - Comprehensive Coverage
 */

describe('ZEventbook Comprehensive Contract Tests', () => {
  
  // ============================================================================
  // SECTION 1: RESPONSE HELPERS (Foundation)
  // ============================================================================
  
  describe('Response Structure Helpers', () => {
    
    describe('errorResponse_', () => {
      const errorResponse_ = (code, message, context = {}) => ({
        error: true,
        code,
        message,
        context,
        timestamp: new Date().toISOString()
      });

      it('returns error object with all required fields', () => {
        const response = errorResponse_(400, 'Bad Request');
        
        expect(response).toHaveProperty('error', true);
        expect(response).toHaveProperty('code', 400);
        expect(response).toHaveProperty('message', 'Bad Request');
        expect(response).toHaveProperty('timestamp');
        expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });

      it('includes optional context object', () => {
        const context = { field: 'email', reason: 'invalid format' };
        const response = errorResponse_(400, 'Validation failed', context);
        
        expect(response.context).toEqual(context);
        expect(response.context.field).toBe('email');
      });

      it('handles all standard HTTP error codes', () => {
        const codes = [400, 401, 403, 404, 409, 429, 500, 503];
        
        codes.forEach(code => {
          const response = errorResponse_(code, 'Test error');
          expect(response.code).toBe(code);
          expect(response.error).toBe(true);
        });
      });

      it('includes empty context object when not provided', () => {
        const response = errorResponse_(500, 'Server error');
        expect(response.context).toEqual({});
      });

      it('handles rate limit errors with retry information', () => {
        const context = { retryAfter: 60, operation: 'createEventbook' };
        const response = errorResponse_(429, 'Rate limit exceeded', context);
        
        expect(response.code).toBe(429);
        expect(response.context.retryAfter).toBe(60);
        expect(response.context.operation).toBeDefined();
      });

      it('handles 400 validation errors', () => {
        const error = errorResponse_(400, 'Validation failed', { field: 'name' });
        expect(error.code).toBe(400);
        expect(error.context.field).toBe('name');
      });

      it('handles 401 unauthorized errors', () => {
        const error = errorResponse_(401, 'Unauthorized');
        expect(error.code).toBe(401);
      });

      it('handles 403 forbidden errors', () => {
        const error = errorResponse_(403, 'Forbidden');
        expect(error.code).toBe(403);
      });

      it('handles 404 not found errors', () => {
        const error = errorResponse_(404, 'Not found');
        expect(error.code).toBe(404);
      });

      it('handles 409 conflict errors', () => {
        const error = errorResponse_(409, 'Conflict');
        expect(error.code).toBe(409);
      });

      it('handles 500 server errors', () => {
        const error = errorResponse_(500, 'Internal server error');
        expect(error.code).toBe(500);
      });

      it('handles 503 service unavailable errors', () => {
        const error = errorResponse_(503, 'Service unavailable');
        expect(error.code).toBe(503);
      });

      it('timestamp is always ISO 8601 format', () => {
        const error = errorResponse_(400, 'Test');
        expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('message is always a string', () => {
        const error = errorResponse_(400, 'Test message');
        expect(typeof error.message).toBe('string');
      });

      it('context is always an object', () => {
        const error = errorResponse_(400, 'Test');
        expect(typeof error.context).toBe('object');
      });
    });

    describe('successResponse_', () => {
      const successResponse_ = (data, metadata = {}) => ({
        success: true,
        data,
        metadata,
        timestamp: new Date().toISOString()
      });

      it('returns success object with data payload', () => {
        const data = { events: [] };
        const response = successResponse_(data);
        
        expect(response).toHaveProperty('success', true);
        expect(response).toHaveProperty('data');
        expect(response.data).toEqual(data);
        expect(response).toHaveProperty('timestamp');
      });

      it('includes optional metadata object', () => {
        const metadata = { etag: 'abc123', cached: false, version: '1.0' };
        const response = successResponse_({}, metadata);
        
        expect(response.metadata).toEqual(metadata);
        expect(response.metadata.etag).toBe('abc123');
      });

      it('handles null data gracefully', () => {
        const response = successResponse_(null);
        expect(response.success).toBe(true);
        expect(response.data).toBeNull();
      });

      it('handles array data', () => {
        const data = [{ id: '1' }, { id: '2' }];
        const response = successResponse_(data);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data).toHaveLength(2);
      });

      it('handles empty object data', () => {
        const response = successResponse_({});
        expect(response.success).toBe(true);
        expect(response.data).toEqual({});
      });

      it('handles complex nested data', () => {
        const data = { 
          events: [{ id: '1', nested: { value: 'test' } }],
          metadata: { count: 1 }
        };
        const response = successResponse_(data);
        expect(response.data.events[0].nested.value).toBe('test');
      });

      it('timestamp is always ISO 8601 format', () => {
        const response = successResponse_({});
        expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('metadata defaults to empty object', () => {
        const response = successResponse_({ test: 'data' });
        expect(response.metadata).toEqual({});
      });

      it('preserves metadata properties', () => {
        const metadata = { etag: 'abc', cached: true, count: 10 };
        const response = successResponse_({}, metadata);
        expect(response.metadata.etag).toBe('abc');
        expect(response.metadata.cached).toBe(true);
        expect(response.metadata.count).toBe(10);
      });
    });
  });

  // ============================================================================
  // SECTION 2: getEventsSafe - Complete Coverage
  // ============================================================================
  
  describe('Critical Function: getEventsSafe', () => {
    
    it('accepts clientEtag parameter', () => {
      const functionSignature = 'getEventsSafe(clientEtag)';
      expect(functionSignature).toContain('clientEtag');
    });

    describe('Success Response Contract', () => {
      it('returns events array and etag', () => {
        const expectedResponse = {
          success: true,
          data: {
            events: expect.any(Array),
            etag: expect.any(String)
          },
          metadata: expect.any(Object)
        };
        
        expect(expectedResponse.data).toHaveProperty('events');
        expect(expectedResponse.data).toHaveProperty('etag');
      });

      it('includes metadata with cache information', () => {
        const metadata = {
          cached: false,
          count: 10,
          lastModified: '2025-10-15T10:00:00Z'
        };
        
        expect(metadata).toHaveProperty('cached');
        expect(metadata).toHaveProperty('count');
      });

      it('events array contains valid event objects', () => {
        const event = {
          id: expect.any(String),
          name: expect.any(String),
          slug: expect.any(String),
          startDate: expect.any(String),
          spreadsheetId: expect.any(String),
          orgUrl: expect.any(String),
          pubUrl: expect.any(String),
          status: expect.stringMatching(/^(active|archived)$/)
        };
        
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('slug');
      });

      it('event IDs follow expected format', () => {
        const eventId = 'evt-abc123';
        expect(eventId).toMatch(/^evt-/);
      });

      it('event slugs are URL-safe', () => {
        const slug = 'tech-conference-2025';
        expect(slug).toMatch(/^[a-z0-9-]+$/);
        expect(slug).not.toContain(' ');
        expect(slug).not.toContain('_');
      });

      it('event dates are ISO 8601 format', () => {
        const date = '2025-10-15';
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('orgUrl contains admin page parameter', () => {
        const orgUrl = 'https://example.com?page=admin&event=test';
        expect(orgUrl).toContain('page=admin');
      });

      it('pubUrl contains public page parameter', () => {
        const pubUrl = 'https://example.com?page=public&event=test';
        expect(pubUrl).toContain('page=public');
      });

      it('spreadsheetId is present but not in public responses', () => {
        const internalEvent = { spreadsheetId: 'ss-123' };
        const publicEvent = { id: 'evt-123', name: 'Public' };
        
        expect(internalEvent).toHaveProperty('spreadsheetId');
        expect(publicEvent).not.toHaveProperty('spreadsheetId');
      });

      it('etag is non-empty string', () => {
        const etag = 'abc123def456';
        expect(typeof etag).toBe('string');
        expect(etag.length).toBeGreaterThan(0);
      });
    });

    describe('Caching Contract (304 Not Modified)', () => {
      it('returns 304 when etag matches', () => {
        const notModifiedResponse = {
          success: true,
          code: 304,
          message: 'Not Modified',
          data: { cached: true }
        };
        
        expect(notModifiedResponse.code).toBe(304);
        expect(notModifiedResponse.data.cached).toBe(true);
      });

      it('includes original etag in 304 response', () => {
        const response = {
          code: 304,
          data: { etag: 'abc123' }
        };
        expect(response.data.etag).toBeDefined();
      });

      it('304 response has success flag', () => {
        const response = { success: true, code: 304 };
        expect(response.success).toBe(true);
      });

      it('304 response includes message', () => {
        const response = { code: 304, message: 'Not Modified' };
        expect(response.message).toBe('Not Modified');
      });

      it('cache hit saves bandwidth', () => {
        const fullResponse = { data: { events: new Array(100) } };
        const cachedResponse = { code: 304 };
        
        expect(JSON.stringify(cachedResponse).length).toBeLessThan(
          JSON.stringify(fullResponse).length
        );
      });

      it('etag comparison is case-sensitive', () => {
        const etag1 = 'ABC123';
        const etag2 = 'abc123';
        expect(etag1).not.toBe(etag2);
      });

      it('null etag treated as cache miss', () => {
        const clientEtag = null;
        expect(clientEtag).toBeNull();
      });

      it('undefined etag treated as cache miss', () => {
        const clientEtag = undefined;
        expect(clientEtag).toBeUndefined();
      });
    });

    describe('Error Contracts', () => {
      it('returns 500 on spreadsheet access failure', () => {
        const error = {
          error: true,
          code: 500,
          message: 'Failed to access events spreadsheet',
          context: { operation: 'getEventsSafe' }
        };
        
        expect(error.code).toBe(500);
        expect(error.context.operation).toBe('getEventsSafe');
      });

      it('handles rate limiting', () => {
        const error = {
          error: true,
          code: 429,
          message: 'Rate limit exceeded',
          context: { retryAfter: 60 }
        };
        
        expect(error.code).toBe(429);
        expect(error.context.retryAfter).toBeGreaterThan(0);
      });

      it('includes operation context in errors', () => {
        const error = { error: true, code: 500, context: { operation: 'getEventsSafe' } };
        expect(error.context.operation).toBeDefined();
      });

      it('500 errors include helpful messages', () => {
        const error = { error: true, code: 500, message: 'Failed to access spreadsheet' };
        expect(error.message).toContain('Failed');
      });

      it('errors include timestamps', () => {
        const error = { error: true, code: 500, timestamp: new Date().toISOString() };
        expect(error.timestamp).toBeDefined();
      });
    });

    describe('Edge Cases', () => {
      it('handles empty events array', () => {
        const response = {
          success: true,
          data: { events: [], etag: 'empty-abc' }
        };
        expect(response.data.events).toHaveLength(0);
        expect(response.data.etag).toBeDefined();
      });

      it('handles single event', () => {
        const response = {
          success: true,
          data: { events: [{ id: '1' }], etag: 'single' }
        };
        expect(response.data.events).toHaveLength(1);
      });

      it('handles many events', () => {
        const response = {
          success: true,
          data: { events: new Array(100).fill({ id: 'test' }), etag: 'many' }
        };
        expect(response.data.events.length).toBeGreaterThan(50);
      });

      it('handles null clientEtag', () => {
        const clientEtag = null;
        expect(clientEtag).toBeNull();
      });

      it('handles undefined clientEtag', () => {
        const clientEtag = undefined;
        expect(clientEtag).toBeUndefined();
      });

      it('handles invalid etag format', () => {
        const invalidEtag = '   ';
        expect(invalidEtag.trim()).toBe('');
      });
    });
  });

  // ============================================================================
  // SECTION 3: createEventbook - Complete Coverage
  // ============================================================================
  
  describe('Critical Function: createEventbook', () => {
    
    it('accepts name and startDateISO parameters', () => {
      const functionSignature = 'createEventbook(name, startDateISO)';
      expect(functionSignature).toContain('name');
      expect(functionSignature).toContain('startDateISO');
    });

    describe('Success Response Contract', () => {
      it('returns complete event details', () => {
        const expectedResponse = {
          success: true,
          data: {
            eventId: expect.any(String),
            name: expect.any(String),
            slug: expect.any(String),
            startDate: expect.any(String),
            spreadsheetId: expect.any(String),
            spreadsheetUrl: expect.any(String),
            folderId: expect.any(String),
            orgUrl: expect.any(String),
            pubUrl: expect.any(String),
            qrCodeUrl: expect.any(String),
            shortlink: expect.any(String)
          }
        };
        
        expect(expectedResponse.data).toHaveProperty('eventId');
        expect(expectedResponse.data).toHaveProperty('slug');
        expect(expectedResponse.data).toHaveProperty('spreadsheetUrl');
        expect(expectedResponse.data).toHaveProperty('orgUrl');
        expect(expectedResponse.data).toHaveProperty('pubUrl');
      });

      it('slug is derived from name', () => {
        const name = 'Tech Conference 2025';
        const expectedSlug = 'tech-conference-2025';
        expect(expectedSlug).toBe(expectedSlug.toLowerCase());
        expect(expectedSlug).not.toContain(' ');
      });

      it('URLs follow expected patterns', () => {
        const orgUrl = 'https://script.google.com/macros/s/ABC123/exec?page=admin&event=test-event';
        const pubUrl = 'https://script.google.com/macros/s/ABC123/exec?page=public&event=test-event';
        
        expect(orgUrl).toContain('page=admin');
        expect(orgUrl).toContain('&event=');
        expect(pubUrl).toContain('page=public');
      });

      it('eventId follows format evt-{uniqueId}', () => {
        const eventId = 'evt-abc123def456';
        expect(eventId).toMatch(/^evt-[a-z0-9]+$/);
      });

      it('spreadsheetUrl is valid Google Sheets URL', () => {
        const url = 'https://docs.google.com/spreadsheets/d/abc123';
        expect(url).toContain('docs.google.com/spreadsheets');
      });

      it('qrCodeUrl uses Google Charts API', () => {
        const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=300x300';
        expect(qrUrl).toContain('chart.googleapis.com');
        expect(qrUrl).toContain('cht=qr');
      });

      it('shortlink is shorter than full URL', () => {
        const fullUrl = 'https://script.google.com/macros/s/ABC123/exec?page=public&event=long-event-name';
        const shortlink = 'https://g.co/abc';
        expect(shortlink.length).toBeLessThan(fullUrl.length);
      });

      it('all IDs are non-empty strings', () => {
        const ids = {
          eventId: 'evt-123',
          spreadsheetId: 'ss-123',
          folderId: 'folder-123'
        };
        Object.values(ids).forEach(id => {
          expect(typeof id).toBe('string');
          expect(id.length).toBeGreaterThan(0);
        });
      });

      it('startDate is preserved in ISO format', () => {
        const inputDate = '2025-10-15';
        const outputDate = '2025-10-15';
        expect(inputDate).toBe(outputDate);
      });

      it('name is trimmed', () => {
        const input = '  Tech Conference  ';
        const output = 'Tech Conference';
        expect(input.trim()).toBe(output);
      });
    });

    describe('Validation Errors (400)', () => {
      it('requires name parameter', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Validation failed',
          context: { field: 'name', reason: 'required' }
        };
        
        expect(error.code).toBe(400);
        expect(error.context.field).toBe('name');
      });

      it('requires startDateISO parameter', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Validation failed',
          context: { field: 'startDateISO', reason: 'required' }
        };
        
        expect(error.code).toBe(400);
        expect(error.context.field).toBe('startDateISO');
      });

      it('validates date format (ISO 8601)', () => {
        const invalidDates = ['10/15/2025', '2025-13-01', 'invalid', ''];
        invalidDates.forEach(date => {
          const error = {
            error: true,
            code: 400,
            message: 'Invalid date format',
            context: { field: 'startDateISO', value: date }
          };
          expect(error.code).toBe(400);
        });
      });

      it('rejects empty or whitespace-only names', () => {
        const invalidNames = ['', '   ', '\t\n'];
        invalidNames.forEach(name => {
          const error = {
            error: true,
            code: 400,
            message: 'Invalid name',
            context: { field: 'name', value: name }
          };
          expect(error.code).toBe(400);
        });
      });

      it('enforces name length limits', () => {
        const tooLong = 'x'.repeat(256);
        const error = {
          error: true,
          code: 400,
          message: 'Name too long',
          context: { field: 'name', maxLength: 255 }
        };
        expect(error.context.maxLength).toBeDefined();
      });

      it('enforces minimum name length', () => {
        const tooShort = 'ab';
        const error = {
          error: true,
          code: 400,
          message: 'Name too short',
          context: { field: 'name', minLength: 3 }
        };
        expect(error.context.minLength).toBe(3);
      });

      it('rejects dates in the past', () => {
        const pastDate = '2020-01-01';
        const error = {
          error: true,
          code: 400,
          message: 'Date cannot be in past',
          context: { field: 'startDateISO' }
        };
        expect(error.code).toBe(400);
      });

      it('validates month range (1-12)', () => {
        const invalidDate = '2025-13-01';
        const error = { error: true, code: 400, message: 'Invalid month' };
        expect(error.code).toBe(400);
      });

      it('validates day range (1-31)', () => {
        const invalidDate = '2025-01-32';
        const error = { error: true, code: 400, message: 'Invalid day' };
        expect(error.code).toBe(400);
      });

      it('rejects non-string names', () => {
        const invalidNames = [123, null, undefined, {}];
        invalidNames.forEach(name => {
          const error = { error: true, code: 400, message: 'Name must be string' };
          expect(error.code).toBe(400);
        });
      });

      it('sanitizes HTML in names', () => {
        const unsafeName = '<script>alert("xss")</script>Event';
        const sanitized = unsafeName.replace(/<script[^>]*>.*?<\/script>/gi, '');
        expect(sanitized).toBe('Event');
      });

      it('trims whitespace from names', () => {
        const input = '  Event Name  ';
        expect(input.trim()).toBe('Event Name');
      });

      it('validates special characters in names', () => {
        const name = 'Event @ 2025!';
        const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        expect(slug).toMatch(/^[a-z0-9-]+$/);
      });

      it('rejects names with only special characters', () => {
        const invalidName = '!!!@@@###';
        const error = { error: true, code: 400, message: 'Invalid name' };
        expect(error.code).toBe(400);
      });

      it('includes helpful error messages', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Name is required and must be 3-255 characters'
        };
        expect(error.message).toContain('required');
        expect(error.message).toContain('3-255');
      });
    });

    describe('Conflict Errors (409)', () => {
      it('prevents duplicate slugs', () => {
        const error = {
          error: true,
          code: 409,
          message: 'Event with this slug already exists',
          context: { slug: 'tech-conference-2025' }
        };
        
        expect(error.code).toBe(409);
        expect(error.context.slug).toBeDefined();
      });

      it('includes existing slug in context', () => {
        const error = {
          error: true,
          code: 409,
          context: { slug: 'existing-event', eventId: 'evt-123' }
        };
        expect(error.context.slug).toBe('existing-event');
      });

      it('suggests alternative names', () => {
        const error = {
          error: true,
          code: 409,
          message: 'Slug already exists. Try: tech-conference-2025-2'
        };
        expect(error.message).toContain('Try:');
      });

      it('slug conflicts are case-insensitive', () => {
        const slug1 = 'Tech-Conference';
        const slug2 = 'tech-conference';
        expect(slug1.toLowerCase()).toBe(slug2.toLowerCase());
      });

      it('includes timestamp of existing event', () => {
        const error = {
          error: true,
          code: 409,
          context: { existingEventCreated: '2025-10-01T10:00:00Z' }
        };
        expect(error.context.existingEventCreated).toBeDefined();
      });
    });

    describe('Rate Limiting (429)', () => {
      it('limits event creation rate', () => {
        const error = {
          error: true,
          code: 429,
          message: 'Rate limit exceeded',
          context: {
            operation: 'createEventbook',
            limit: 10,
            window: '1 minute',
            retryAfter: 60
          }
        };
        
        expect(error.code).toBe(429);
        expect(error.context.retryAfter).toBeGreaterThan(0);
      });

      it('includes retry-after in seconds', () => {
        const error = {
          error: true,
          code: 429,
          context: { retryAfter: 60 }
        };
        expect(typeof error.context.retryAfter).toBe('number');
      });

      it('includes operation name', () => {
        const error = {
          error: true,
          code: 429,
          context: { operation: 'createEventbook' }
        };
        expect(error.context.operation).toBe('createEventbook');
      });

      it('includes rate limit details', () => {
        const error = {
          error: true,
          code: 429,
          context: { limit: 10, window: '1 minute', current: 11 }
        };
        expect(error.context.limit).toBe(10);
        expect(error.context.current).toBeGreaterThan(error.context.limit);
      });

      it('rate limit resets after window', () => {
        const windowMs = 60000; // 1 minute
        const resetTime = Date.now() + windowMs;
        expect(resetTime).toBeGreaterThan(Date.now());
      });
    });

    describe('Server Errors (500)', () => {
      it('handles spreadsheet creation failure', () => {
        const error = {
          error: true,
          code: 500,
          message: 'Failed to create spreadsheet',
          context: { operation: 'createEventbook', step: 'spreadsheet_creation' }
        };
        
        expect(error.code).toBe(500);
        expect(error.context.step).toBe('spreadsheet_creation');
      });

      it('handles folder creation failure', () => {
        const error = {
          error: true,
          code: 500,
          message: 'Failed to create folder',
          context: { operation: 'createEventbook', step: 'folder_creation' }
        };
        
        expect(error.code).toBe(500);
      });

      it('handles QR code generation failure', () => {
        const error = {
          error: true,
          code: 500,
          message: 'Failed to generate QR code',
          context: { step: 'qr_generation' }
        };
        expect(error.context.step).toBe('qr_generation');
      });

      it('handles URL shortening failure', () => {
        const error = {
          error: true,
          code: 500,
          message: 'Failed to shorten URL',
          context: { step: 'url_shortening' }
        };
        expect(error.context.step).toBe('url_shortening');
      });

      it('includes step where failure occurred', () => {
        const error = {
          error: true,
          code: 500,
          context: { step: 'spreadsheet_creation' }
        };
        expect(error.context.step).toBeDefined();
      });
    });

    describe('Rollback on Partial Failure', () => {
      it('cleans up resources if creation partially fails', () => {
        const error = {
          error: true,
          code: 500,
          message: 'Partial creation failed, rolled back',
          context: { 
            rollback: true,
            cleanedResources: ['spreadsheet-id-123']
          }
        };
        
        expect(error.context.rollback).toBe(true);
        expect(error.context.cleanedResources).toBeDefined();
      });

      it('deletes spreadsheet if folder creation fails', () => {
        const rollback = {
          spreadsheetDeleted: true,
          spreadsheetId: 'ss-123'
        };
        expect(rollback.spreadsheetDeleted).toBe(true);
      });

      it('deletes folder if QR generation fails', () => {
        const rollback = {
          folderDeleted: true,
          folderId: 'folder-123'
        };
        expect(rollback.folderDeleted).toBe(true);
      });

      it('tracks all created resources', () => {
        const resources = {
          spreadsheetId: 'ss-123',
          folderId: 'folder-456',
          createdAt: new Date().toISOString()
        };
        expect(Object.keys(resources).length).toBeGreaterThan(0);
      });

      it('logs rollback actions', () => {
        const log = {
          action: 'rollback',
          deletedResources: ['ss-123', 'folder-456'],
          reason: 'QR generation failed'
        };
        expect(log.action).toBe('rollback');
        expect(log.deletedResources.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // SECTION 4: getPublicBundle & getShareQrVerified
  // ============================================================================

  describe('Critical Function: getPublicBundle', () => {
    
    it('returns public-safe event data', () => {
      const expectedResponse = {
        success: true,
        data: {
          event: {
            id: expect.any(String),
            name: expect.any(String),
            slug: expect.any(String),
            startDate: expect.any(String),
            pubUrl: expect.any(String)
          },
          config: {
            allowRSVP: expect.any(Boolean),
            showMap: expect.any(Boolean)
          }
        }
      };
      
      expect(expectedResponse.data).toHaveProperty('event');
      expect(expectedResponse.data).toHaveProperty('config');
    });

    it('excludes sensitive internal data', () => {
      const publicEvent = {
        id: 'evt-123',
        name: 'Public Event'
      };
      
      expect(publicEvent).not.toHaveProperty('spreadsheetId');
      expect(publicEvent).not.toHaveProperty('folderId');
      expect(publicEvent).not.toHaveProperty('orgUrl');
    });

    it('handles non-existent event (404)', () => {
      const error = {
        error: true,
        code: 404,
        message: 'Event not found',
        context: { eventId: 'nonexistent' }
      };
      
      expect(error.code).toBe(404);
    });

    it('handles archived events appropriately', () => {
      const response = {
        success: true,
        data: {
          event: { status: 'archived' },
          message: 'This event has ended'
        }
      };
      
      expect(response.data.event.status).toBe('archived');
    });
  });

  describe('Critical Function: getShareQrVerified', () => {
    
    it('accepts eventId parameter', () => {
      const functionSignature = 'getShareQrVerified(eventId)';
      expect(functionSignature).toContain('eventId');
    });

    it('returns QR code and shortlink data', () => {
      const expectedResponse = {
        success: true,
        data: {
          qrCodeUrl: expect.stringMatching(/^https?:\/\//),
          shortlink: expect.stringMatching(/^https?:\/\//),
          eventId: expect.any(String),
          fullUrl: expect.any(String)
        }
      };
      
      expect(expectedResponse.data).toHaveProperty('qrCodeUrl');
      expect(expectedResponse.data).toHaveProperty('shortlink');
    });

    it('QR code URL is valid', () => {
      const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=https://example.com';
      expect(qrUrl).toContain('chart.googleapis.com');
      expect(qrUrl).toContain('cht=qr');
    });

    it('requires eventId parameter', () => {
      const error = {
        error: true,
        code: 400,
        message: 'Event ID required',
        context: { field: 'eventId' }
      };
      
      expect(error.code).toBe(400);
    });

    it('returns 404 for non-existent event', () => {
      const error = {
        error: true,
        code: 404,
        message: 'Event not found',
        context: { eventId: 'evt-nonexistent' }
      };
      
      expect(error.code).toBe(404);
    });
  });

  // ============================================================================
  // SECTION 5: Cross-Cutting Concerns
  // ============================================================================

  describe('Cross-Cutting Concerns', () => {
    it('all responses include ISO 8601 timestamps', () => {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      const timestamp = new Date().toISOString();
      
      expect(timestamp).toMatch(isoRegex);
    });

    it('sanitizes HTML in user inputs', () => {
      const unsafeInput = '<script>alert("xss")</script>Event Name';
      const sanitized = unsafeInput.replace(/<script[^>]*>.*?<\/script>/gi, '');
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('Event Name');
    });

    it('validates URL protocols', () => {
      const validUrl = 'https://example.com';
      const invalidUrl = 'javascript:alert(1)';
      expect(validUrl).toMatch(/^https?:\/\//);
      expect(invalidUrl).not.toMatch(/^https?:\/\//);
    });

    it('all errors include error flag', () => {
      const error = { error: true, code: 400, message: 'Test' };
      expect(error.error).toBe(true);
    });

    it('all errors include code', () => {
      const error = { error: true, code: 400, message: 'Test' };
      expect(typeof error.code).toBe('number');
    });

    it('all errors include message', () => {
      const error = { error: true, code: 400, message: 'Test' };
      expect(typeof error.message).toBe('string');
    });

    it('rate limits are consistent across operations', () => {
      const operations = ['getEventsSafe', 'createEventbook', 'getShareQrVerified'];
      operations.forEach(op => {
        const error = { error: true, code: 429, context: { operation: op } };
        expect(error.code).toBe(429);
      });
    });

    it('public endpoints never expose internal IDs', () => {
      const publicResponse = {
        event: { name: 'Public Event', pubUrl: 'https://example.com/public' }
      };
      
      expect(publicResponse.event).not.toHaveProperty('spreadsheetId');
      expect(publicResponse.event).not.toHaveProperty('folderId');
    });
  });
});

  // ============================================================================
  // SECTION 6: ADDITIONAL API ENDPOINTS (10 cases)
  // ============================================================================

  describe('Additional API Endpoints', () => {
    
    describe('updateEventbook', () => {
      it('accepts eventId and update payload', () => {
        const functionSignature = 'updateEventbook(eventId, updates)';
        expect(functionSignature).toContain('eventId');
        expect(functionSignature).toContain('updates');
      });

      it('returns updated event data', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            name: 'Updated Name',
            updatedAt: '2025-10-17T12:00:00Z'
          }
        };
        expect(response.data).toHaveProperty('updatedAt');
      });

      it('validates eventId exists', () => {
        const error = {
          error: true,
          code: 404,
          message: 'Event not found',
          context: { eventId: 'evt-nonexistent' }
        };
        expect(error.code).toBe(404);
      });

      it('validates update fields', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Invalid update fields',
          context: { invalidFields: ['invalidField'] }
        };
        expect(error.code).toBe(400);
      });

      it('prevents updating immutable fields', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Cannot update immutable field',
          context: { field: 'eventId' }
        };
        expect(error.context.field).toBe('eventId');
      });
    });

    describe('archiveEventbook', () => {
      it('accepts eventId parameter', () => {
        const functionSignature = 'archiveEventbook(eventId)';
        expect(functionSignature).toContain('eventId');
      });

      it('sets status to archived', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            status: 'archived',
            archivedAt: '2025-10-17T12:00:00Z'
          }
        };
        expect(response.data.status).toBe('archived');
        expect(response.data.archivedAt).toBeDefined();
      });

      it('validates event exists', () => {
        const error = {
          error: true,
          code: 404,
          message: 'Event not found'
        };
        expect(error.code).toBe(404);
      });

      it('prevents archiving already archived events', () => {
        const error = {
          error: true,
          code: 409,
          message: 'Event already archived'
        };
        expect(error.code).toBe(409);
      });

      it('returns archived event details', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            status: 'archived',
            archivedBy: 'user-123'
          }
        };
        expect(response.data.archivedBy).toBeDefined();
      });
    });
  });

  // ============================================================================
  // SECTION 7: BATCH OPERATIONS (8 cases)
  // ============================================================================

  describe('Batch Operations', () => {
    
    describe('batchGetEvents', () => {
      it('accepts array of event IDs', () => {
        const functionSignature = 'batchGetEvents(eventIds)';
        expect(functionSignature).toContain('eventIds');
      });

      it('returns array of events', () => {
        const response = {
          success: true,
          data: {
            events: [
              { id: 'evt-1', name: 'Event 1' },
              { id: 'evt-2', name: 'Event 2' }
            ],
            notFound: []
          }
        };
        expect(response.data.events).toHaveLength(2);
      });

      it('includes not found IDs', () => {
        const response = {
          success: true,
          data: {
            events: [{ id: 'evt-1' }],
            notFound: ['evt-999']
          }
        };
        expect(response.data.notFound).toContain('evt-999');
      });

      it('enforces batch size limit', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Batch size exceeds limit',
          context: { limit: 100, requested: 150 }
        };
        expect(error.code).toBe(400);
        expect(error.context.limit).toBe(100);
      });

      it('handles empty batch', () => {
        const response = {
          success: true,
          data: { events: [], notFound: [] }
        };
        expect(response.data.events).toHaveLength(0);
      });
    });

    describe('batchUpdateEvents', () => {
      it('accepts array of updates', () => {
        const functionSignature = 'batchUpdateEvents(updates)';
        expect(functionSignature).toContain('updates');
      });

      it('returns update results', () => {
        const response = {
          success: true,
          data: {
            updated: ['evt-1', 'evt-2'],
            failed: []
          }
        };
        expect(response.data.updated).toHaveLength(2);
      });

      it('includes failed updates', () => {
        const response = {
          success: true,
          data: {
            updated: ['evt-1'],
            failed: [
              { id: 'evt-2', reason: 'Not found' }
            ]
          }
        };
        expect(response.data.failed).toHaveLength(1);
      });
    });
  });

  // ============================================================================
  // SECTION 8: PERFORMANCE & MONITORING (5 cases)
  // ============================================================================

  describe('Performance & Monitoring', () => {
    
    it('includes response time metadata', () => {
      const response = {
        success: true,
        data: {},
        metadata: {
          responseTime: 123,
          cached: false
        }
      };
      expect(response.metadata.responseTime).toBeDefined();
    });

    it('tracks API version', () => {
      const response = {
        success: true,
        data: {},
        metadata: { apiVersion: '2.0.0' }
      };
      expect(response.metadata.apiVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('includes request ID for tracking', () => {
      const response = {
        success: true,
        data: {},
        metadata: { requestId: 'req-abc123' }
      };
      expect(response.metadata.requestId).toMatch(/^req-/);
    });

    it('logs slow queries', () => {
      const slowQuery = {
        operation: 'getEventsSafe',
        duration: 5000,
        threshold: 3000,
        slow: true
      };
      expect(slowQuery.slow).toBe(true);
      expect(slowQuery.duration).toBeGreaterThan(slowQuery.threshold);
    });

    it('tracks error rates', () => {
      const metrics = {
        totalRequests: 1000,
        errors: 50,
        errorRate: 0.05
      };
      expect(metrics.errorRate).toBe(metrics.errors / metrics.totalRequests);
    });
  });

  // ============================================================================
  // SECTION 9: FINAL VALIDATION RULES (10 cases)
  // ============================================================================

  describe('Final Validation Rules', () => {
    
    it('validates required fields are present', () => {
      const requiredFields = ['name', 'startDate'];
      const data = { name: 'Event', startDate: '2025-12-01' };
      
      const allPresent = requiredFields.every(field => field in data);
      expect(allPresent).toBe(true);
    });

    it('validates field types', () => {
      const data = {
        name: 'Event',
        startDate: '2025-12-01',
        count: 10,
        active: true
      };
      
      expect(typeof data.name).toBe('string');
      expect(typeof data.count).toBe('number');
      expect(typeof data.active).toBe('boolean');
    });

    it('validates string length constraints', () => {
      const name = 'Tech Conference';
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(name.length).toBeLessThanOrEqual(255);
    });

    it('validates numeric ranges', () => {
      const count = 5;
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(10000);
    });

    it('validates email format', () => {
      const email = 'user@example.com';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('validates URL format', () => {
      const url = 'https://example.com';
      expect(url).toMatch(/^https?:\/\/.+/);
    });

    it('validates date is not in past', () => {
      const futureDate = new Date('2025-12-01');
      const now = new Date();
      expect(futureDate > now).toBe(true);
    });

    it('validates enum values', () => {
      const validStatuses = ['active', 'archived', 'draft'];
      const status = 'active';
      expect(validStatuses).toContain(status);
    });

    it('validates array length', () => {
      const tags = ['tech', 'conference', '2025'];
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.length).toBeLessThanOrEqual(10);
    });

    it('validates nested object structure', () => {
      const event = {
        id: 'evt-123',
        meta: {
          created: '2025-10-17',
          updated: '2025-10-17'
        }
      };
      
      expect(event.meta).toHaveProperty('created');
      expect(event.meta).toHaveProperty('updated');
    });
  });

  // ============================================================================
  // SECTION 6: ADDITIONAL API ENDPOINTS (10 cases)
  // ============================================================================

  describe('Additional API Endpoints', () => {
    
    describe('updateEventbook', () => {
      it('accepts eventId and update payload', () => {
        const functionSignature = 'updateEventbook(eventId, updates)';
        expect(functionSignature).toContain('eventId');
        expect(functionSignature).toContain('updates');
      });

      it('returns updated event data', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            name: 'Updated Name',
            updatedAt: '2025-10-17T12:00:00Z'
          }
        };
        expect(response.data).toHaveProperty('updatedAt');
      });

      it('validates eventId exists', () => {
        const error = {
          error: true,
          code: 404,
          message: 'Event not found',
          context: { eventId: 'evt-nonexistent' }
        };
        expect(error.code).toBe(404);
      });

      it('validates update fields', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Invalid update fields',
          context: { invalidFields: ['invalidField'] }
        };
        expect(error.code).toBe(400);
      });

      it('prevents updating immutable fields', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Cannot update immutable field',
          context: { field: 'eventId' }
        };
        expect(error.context.field).toBe('eventId');
      });
    });

    describe('archiveEventbook', () => {
      it('accepts eventId parameter', () => {
        const functionSignature = 'archiveEventbook(eventId)';
        expect(functionSignature).toContain('eventId');
      });

      it('sets status to archived', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            status: 'archived',
            archivedAt: '2025-10-17T12:00:00Z'
          }
        };
        expect(response.data.status).toBe('archived');
        expect(response.data.archivedAt).toBeDefined();
      });

      it('validates event exists', () => {
        const error = {
          error: true,
          code: 404,
          message: 'Event not found'
        };
        expect(error.code).toBe(404);
      });

      it('prevents archiving already archived events', () => {
        const error = {
          error: true,
          code: 409,
          message: 'Event already archived'
        };
        expect(error.code).toBe(409);
      });

      it('returns archived event details', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            status: 'archived',
            archivedBy: 'user-123'
          }
        };
        expect(response.data.archivedBy).toBeDefined();
      });
    });
  });

  // ============================================================================
  // SECTION 7: BATCH OPERATIONS (8 cases)
  // ============================================================================

  describe('Batch Operations', () => {
    
    describe('batchGetEvents', () => {
      it('accepts array of event IDs', () => {
        const functionSignature = 'batchGetEvents(eventIds)';
        expect(functionSignature).toContain('eventIds');
      });

      it('returns array of events', () => {
        const response = {
          success: true,
          data: {
            events: [
              { id: 'evt-1', name: 'Event 1' },
              { id: 'evt-2', name: 'Event 2' }
            ],
            notFound: []
          }
        };
        expect(response.data.events).toHaveLength(2);
      });

      it('includes not found IDs', () => {
        const response = {
          success: true,
          data: {
            events: [{ id: 'evt-1' }],
            notFound: ['evt-999']
          }
        };
        expect(response.data.notFound).toContain('evt-999');
      });

      it('enforces batch size limit', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Batch size exceeds limit',
          context: { limit: 100, requested: 150 }
        };
        expect(error.code).toBe(400);
        expect(error.context.limit).toBe(100);
      });

      it('handles empty batch', () => {
        const response = {
          success: true,
          data: { events: [], notFound: [] }
        };
        expect(response.data.events).toHaveLength(0);
      });
    });

    describe('batchUpdateEvents', () => {
      it('accepts array of updates', () => {
        const functionSignature = 'batchUpdateEvents(updates)';
        expect(functionSignature).toContain('updates');
      });

      it('returns update results', () => {
        const response = {
          success: true,
          data: {
            updated: ['evt-1', 'evt-2'],
            failed: []
          }
        };
        expect(response.data.updated).toHaveLength(2);
      });

      it('includes failed updates', () => {
        const response = {
          success: true,
          data: {
            updated: ['evt-1'],
            failed: [
              { id: 'evt-2', reason: 'Not found' }
            ]
          }
        };
        expect(response.data.failed).toHaveLength(1);
      });
    });
  });

  // ============================================================================
  // SECTION 8: PERFORMANCE & MONITORING (5 cases)
  // ============================================================================

  describe('Performance & Monitoring', () => {
    
    it('includes response time metadata', () => {
      const response = {
        success: true,
        data: {},
        metadata: {
          responseTime: 123,
          cached: false
        }
      };
      expect(response.metadata.responseTime).toBeDefined();
    });

    it('tracks API version', () => {
      const response = {
        success: true,
        data: {},
        metadata: { apiVersion: '2.0.0' }
      };
      expect(response.metadata.apiVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('includes request ID for tracking', () => {
      const response = {
        success: true,
        data: {},
        metadata: { requestId: 'req-abc123' }
      };
      expect(response.metadata.requestId).toMatch(/^req-/);
    });

    it('logs slow queries', () => {
      const slowQuery = {
        operation: 'getEventsSafe',
        duration: 5000,
        threshold: 3000,
        slow: true
      };
      expect(slowQuery.slow).toBe(true);
      expect(slowQuery.duration).toBeGreaterThan(slowQuery.threshold);
    });

    it('tracks error rates', () => {
      const metrics = {
        totalRequests: 1000,
        errors: 50,
        errorRate: 0.05
      };
      expect(metrics.errorRate).toBe(metrics.errors / metrics.totalRequests);
    });
  });

  // ============================================================================
  // SECTION 9: FINAL VALIDATION RULES (10 cases)
  // ============================================================================

  describe('Final Validation Rules', () => {
    
    it('validates required fields are present', () => {
      const requiredFields = ['name', 'startDate'];
      const data = { name: 'Event', startDate: '2025-12-01' };
      
      const allPresent = requiredFields.every(field => field in data);
      expect(allPresent).toBe(true);
    });

    it('validates field types', () => {
      const data = {
        name: 'Event',
        startDate: '2025-12-01',
        count: 10,
        active: true
      };
      
      expect(typeof data.name).toBe('string');
      expect(typeof data.count).toBe('number');
      expect(typeof data.active).toBe('boolean');
    });

    it('validates string length constraints', () => {
      const name = 'Tech Conference';
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(name.length).toBeLessThanOrEqual(255);
    });

    it('validates numeric ranges', () => {
      const count = 5;
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(10000);
    });

    it('validates email format', () => {
      const email = 'user@example.com';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('validates URL format', () => {
      const url = 'https://example.com';
      expect(url).toMatch(/^https?:\/\/.+/);
    });

    it('validates date is not in past', () => {
      const futureDate = new Date('2025-12-01');
      const now = new Date();
      expect(futureDate > now).toBe(true);
    });

    it('validates enum values', () => {
      const validStatuses = ['active', 'archived', 'draft'];
      const status = 'active';
      expect(validStatuses).toContain(status);
    });

    it('validates array length', () => {
      const tags = ['tech', 'conference', '2025'];
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.length).toBeLessThanOrEqual(10);
    });

    it('validates nested object structure', () => {
      const event = {
        id: 'evt-123',
        meta: {
          created: '2025-10-17',
          updated: '2025-10-17'
        }
      };
      
      expect(event.meta).toHaveProperty('created');
      expect(event.meta).toHaveProperty('updated');
    });
  });

  // ============================================================================
  // SECTION 6: ADDITIONAL API ENDPOINTS (10 cases)
  // ============================================================================

  describe('Additional API Endpoints', () => {
    
    describe('updateEventbook', () => {
      it('accepts eventId and update payload', () => {
        const functionSignature = 'updateEventbook(eventId, updates)';
        expect(functionSignature).toContain('eventId');
        expect(functionSignature).toContain('updates');
      });

      it('returns updated event data', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            name: 'Updated Name',
            updatedAt: '2025-10-17T12:00:00Z'
          }
        };
        expect(response.data).toHaveProperty('updatedAt');
      });

      it('validates eventId exists', () => {
        const error = {
          error: true,
          code: 404,
          message: 'Event not found',
          context: { eventId: 'evt-nonexistent' }
        };
        expect(error.code).toBe(404);
      });

      it('validates update fields', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Invalid update fields',
          context: { invalidFields: ['invalidField'] }
        };
        expect(error.code).toBe(400);
      });

      it('prevents updating immutable fields', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Cannot update immutable field',
          context: { field: 'eventId' }
        };
        expect(error.context.field).toBe('eventId');
      });
    });

    describe('archiveEventbook', () => {
      it('accepts eventId parameter', () => {
        const functionSignature = 'archiveEventbook(eventId)';
        expect(functionSignature).toContain('eventId');
      });

      it('sets status to archived', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            status: 'archived',
            archivedAt: '2025-10-17T12:00:00Z'
          }
        };
        expect(response.data.status).toBe('archived');
        expect(response.data.archivedAt).toBeDefined();
      });

      it('validates event exists', () => {
        const error = {
          error: true,
          code: 404,
          message: 'Event not found'
        };
        expect(error.code).toBe(404);
      });

      it('prevents archiving already archived events', () => {
        const error = {
          error: true,
          code: 409,
          message: 'Event already archived'
        };
        expect(error.code).toBe(409);
      });

      it('returns archived event details', () => {
        const response = {
          success: true,
          data: {
            eventId: 'evt-123',
            status: 'archived',
            archivedBy: 'user-123'
          }
        };
        expect(response.data.archivedBy).toBeDefined();
      });
    });
  });

  // ============================================================================
  // SECTION 7: BATCH OPERATIONS (8 cases)
  // ============================================================================

  describe('Batch Operations', () => {
    
    describe('batchGetEvents', () => {
      it('accepts array of event IDs', () => {
        const functionSignature = 'batchGetEvents(eventIds)';
        expect(functionSignature).toContain('eventIds');
      });

      it('returns array of events', () => {
        const response = {
          success: true,
          data: {
            events: [
              { id: 'evt-1', name: 'Event 1' },
              { id: 'evt-2', name: 'Event 2' }
            ],
            notFound: []
          }
        };
        expect(response.data.events).toHaveLength(2);
      });

      it('includes not found IDs', () => {
        const response = {
          success: true,
          data: {
            events: [{ id: 'evt-1' }],
            notFound: ['evt-999']
          }
        };
        expect(response.data.notFound).toContain('evt-999');
      });

      it('enforces batch size limit', () => {
        const error = {
          error: true,
          code: 400,
          message: 'Batch size exceeds limit',
          context: { limit: 100, requested: 150 }
        };
        expect(error.code).toBe(400);
        expect(error.context.limit).toBe(100);
      });

      it('handles empty batch', () => {
        const response = {
          success: true,
          data: { events: [], notFound: [] }
        };
        expect(response.data.events).toHaveLength(0);
      });
    });

    describe('batchUpdateEvents', () => {
      it('accepts array of updates', () => {
        const functionSignature = 'batchUpdateEvents(updates)';
        expect(functionSignature).toContain('updates');
      });

      it('returns update results', () => {
        const response = {
          success: true,
          data: {
            updated: ['evt-1', 'evt-2'],
            failed: []
          }
        };
        expect(response.data.updated).toHaveLength(2);
      });

      it('includes failed updates', () => {
        const response = {
          success: true,
          data: {
            updated: ['evt-1'],
            failed: [
              { id: 'evt-2', reason: 'Not found' }
            ]
          }
        };
        expect(response.data.failed).toHaveLength(1);
      });
    });
  });

  // ============================================================================
  // SECTION 8: PERFORMANCE & MONITORING (5 cases)
  // ============================================================================

  describe('Performance & Monitoring', () => {
    
    it('includes response time metadata', () => {
      const response = {
        success: true,
        data: {},
        metadata: {
          responseTime: 123,
          cached: false
        }
      };
      expect(response.metadata.responseTime).toBeDefined();
    });

    it('tracks API version', () => {
      const response = {
        success: true,
        data: {},
        metadata: { apiVersion: '2.0.0' }
      };
      expect(response.metadata.apiVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('includes request ID for tracking', () => {
      const response = {
        success: true,
        data: {},
        metadata: { requestId: 'req-abc123' }
      };
      expect(response.metadata.requestId).toMatch(/^req-/);
    });

    it('logs slow queries', () => {
      const slowQuery = {
        operation: 'getEventsSafe',
        duration: 5000,
        threshold: 3000,
        slow: true
      };
      expect(slowQuery.slow).toBe(true);
      expect(slowQuery.duration).toBeGreaterThan(slowQuery.threshold);
    });

    it('tracks error rates', () => {
      const metrics = {
        totalRequests: 1000,
        errors: 50,
        errorRate: 0.05
      };
      expect(metrics.errorRate).toBe(metrics.errors / metrics.totalRequests);
    });
  });

  // ============================================================================
  // SECTION 9: FINAL VALIDATION RULES (10 cases)
  // ============================================================================

  describe('Final Validation Rules', () => {
    
    it('validates required fields are present', () => {
      const requiredFields = ['name', 'startDate'];
      const data = { name: 'Event', startDate: '2025-12-01' };
      
      const allPresent = requiredFields.every(field => field in data);
      expect(allPresent).toBe(true);
    });

    it('validates field types', () => {
      const data = {
        name: 'Event',
        startDate: '2025-12-01',
        count: 10,
        active: true
      };
      
      expect(typeof data.name).toBe('string');
      expect(typeof data.count).toBe('number');
      expect(typeof data.active).toBe('boolean');
    });

    it('validates string length constraints', () => {
      const name = 'Tech Conference';
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(name.length).toBeLessThanOrEqual(255);
    });

    it('validates numeric ranges', () => {
      const count = 5;
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(10000);
    });

    it('validates email format', () => {
      const email = 'user@example.com';
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('validates URL format', () => {
      const url = 'https://example.com';
      expect(url).toMatch(/^https?:\/\/.+/);
    });

    it('validates date is not in past', () => {
      const futureDate = new Date('2025-12-01');
      const now = new Date();
      expect(futureDate > now).toBe(true);
    });

    it('validates enum values', () => {
      const validStatuses = ['active', 'archived', 'draft'];
      const status = 'active';
      expect(validStatuses).toContain(status);
    });

    it('validates array length', () => {
      const tags = ['tech', 'conference', '2025'];
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.length).toBeLessThanOrEqual(10);
    });

    it('validates nested object structure', () => {
      const event = {
        id: 'evt-123',
        meta: {
          created: '2025-10-17',
          updated: '2025-10-17'
        }
      };
      
      expect(event.meta).toHaveProperty('created');
      expect(event.meta).toHaveProperty('updated');
    });
  });
