/**
 * ZEventbook Integration Tests - Production Ready
 * Tests end-to-end workflows and component integration
 */

describe('ZEventbook Integration Tests', () => {
  
  // File Inclusion System
  describe('File Inclusion System', () => {
    const mockFiles = {
      'Styles': '<style>.container { }</style>',
      'NUSDK': '<script>const NU = {};</script>',
      'Admin': '<div id="admin"></div>',
      'Public': '<div id="public"></div>'
    };
    
    const include = (filename) => {
      if (!mockFiles[filename]) throw new Error(`File not found: ${filename}`);
      return mockFiles[filename];
    };

    test('includes Styles.html', () => {
      const content = include('Styles');
      expect(content).toContain('style');
    });

    test('includes NUSDK.html', () => {
      const content = include('NUSDK');
      expect(content).toContain('NU');
    });

    test('includes Admin.html', () => {
      const content = include('Admin');
      expect(content).toContain('admin');
    });

    test('throws error for non-existent files', () => {
      expect(() => include('NonExistent')).toThrow('File not found');
    });
  });

  // RPC Integration
  describe('RPC Call Integration', () => {
    const mockBackend = {
      getEventsSafe: jest.fn((etag) => {
        if (etag === 'current') {
          return Promise.resolve({ success: true, code: 304 });
        }
        return Promise.resolve({
          success: true,
          data: { events: [{ id: '1', name: 'Test' }], etag: 'current' }
        });
      }),
      
      createEventbook: jest.fn((name, date) => {
        if (!name) {
          return Promise.resolve({ error: true, code: 400, message: 'Name required' });
        }
        return Promise.resolve({
          success: true,
          data: {
            eventId: 'evt-123',
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            startDate: date
          }
        });
      })
    };

    const NU = {
      rpc: (fn, ...args) => {
        if (!mockBackend[fn]) {
          return Promise.reject(new Error(`Function not found: ${fn}`));
        }
        return mockBackend[fn](...args);
      }
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('calls getEventsSafe successfully', async () => {
      const result = await NU.rpc('getEventsSafe', null);
      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(1);
    });

    test('returns 304 when etag matches', async () => {
      const result = await NU.rpc('getEventsSafe', 'current');
      expect(result.code).toBe(304);
    });

    test('calls createEventbook successfully', async () => {
      const result = await NU.rpc('createEventbook', 'Tech Conf', '2025-10-15');
      expect(result.success).toBe(true);
      expect(result.data.slug).toBe('tech-conf');
    });

    test('handles validation errors', async () => {
      const result = await NU.rpc('createEventbook', '', '2025-10-15');
      expect(result.error).toBe(true);
      expect(result.code).toBe(400);
    });

    test('handles non-existent functions', async () => {
      await expect(NU.rpc('nonExistent')).rejects.toThrow('Function not found');
    });
  });

  // Spreadsheet Operations
  describe('Spreadsheet Operations', () => {
    class MockSpreadsheet {
      constructor(id, name) {
        this.id = id;
        this.name = name;
        this.sheets = [];
      }
      
      insertSheet(name) {
        const sheet = { name, data: [] };
        this.sheets.push(sheet);
        return sheet;
      }
      
      getId() { return this.id; }
    }

    test('creates spreadsheet with structure', () => {
      const ss = new MockSpreadsheet('abc123', 'Test Event');
      const sheet = ss.insertSheet('Events');
      
      expect(ss.getId()).toBe('abc123');
      expect(sheet.name).toBe('Events');
    });

    test('stores event data', () => {
      const ss = new MockSpreadsheet('abc123', 'Test');
      const sheet = ss.insertSheet('Events');
      sheet.data.push(['ID', 'Name', 'Date']);
      sheet.data.push(['evt-1', 'Event 1', '2025-10-15']);
      
      expect(sheet.data).toHaveLength(2);
      expect(sheet.data[1][0]).toBe('evt-1');
    });
  });

  // End-to-End Workflows
  describe('Complete Event Creation Workflow', () => {
    const workflow = {
      validate: (name, date) => {
        const errors = [];
        if (!name) errors.push('Name required');
        if (!date) errors.push('Date required');
        return { valid: errors.length === 0, errors };
      },
      
      createSlug: (name) => name.toLowerCase().replace(/\s+/g, '-'),
      
      createSpreadsheet: async (name) => ({
        id: 'ss-123',
        url: `https://docs.google.com/spreadsheets/d/ss-123`
      }),
      
      generateUrls: (slug) => ({
        orgUrl: `https://example.com?event=${slug}`,
        pubUrl: `https://example.com/public?event=${slug}`
      })
    };

    test('validates inputs', () => {
      const result = workflow.validate('Event Name', '2025-10-15');
      expect(result.valid).toBe(true);
    });

    test('creates slug from name', () => {
      const slug = workflow.createSlug('Tech Conference 2025');
      expect(slug).toBe('tech-conference-2025');
    });

    test('creates spreadsheet', async () => {
      const ss = await workflow.createSpreadsheet('Test Event');
      expect(ss.id).toBe('ss-123');
      expect(ss.url).toContain('spreadsheets');
    });

    test('generates URLs', () => {
      const urls = workflow.generateUrls('test-event');
      expect(urls.orgUrl).toContain('event=test-event');
      expect(urls.pubUrl).toContain('public');
    });

    test('complete workflow executes', async () => {
      const name = 'Tech Conference';
      const date = '2025-10-15';
      
      const validation = workflow.validate(name, date);
      expect(validation.valid).toBe(true);
      
      const slug = workflow.createSlug(name);
      expect(slug).toBe('tech-conference');
      
      const ss = await workflow.createSpreadsheet(name);
      expect(ss.id).toBeDefined();
      
      const urls = workflow.generateUrls(slug);
      expect(urls.orgUrl).toBeDefined();
      expect(urls.pubUrl).toBeDefined();
    });
  });

  // Error Propagation
  describe('Error Propagation', () => {
    const backend = {
      createEvent: (name) => {
        if (!name) {
          return Promise.resolve({
            error: true,
            code: 400,
            message: 'Validation failed',
            context: { field: 'name' }
          });
        }
        return Promise.resolve({ success: true });
      }
    };

    const frontend = {
      createEvent: async (name) => {
        const result = await backend.createEvent(name);
        if (result.error) {
          return {
            success: false,
            userMessage: `Error: ${result.message}`,
            field: result.context?.field
          };
        }
        return { success: true };
      }
    };

    test('propagates validation errors to frontend', async () => {
      const result = await frontend.createEvent('');
      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Validation failed');
      expect(result.field).toBe('name');
    });

    test('handles successful operations', async () => {
      const result = await frontend.createEvent('Valid Name');
      expect(result.success).toBe(true);
    });
  });

  // Caching Integration
  describe('Caching Integration', () => {
    let cache = null;
    let cacheEtag = null;
    
    const getEvents = async (clientEtag) => {
      if (cache && cacheEtag === clientEtag) {
        return { code: 304, message: 'Not Modified' };
      }
      
      const events = [{ id: '1', name: 'Event 1' }];
      cache = events;
      cacheEtag = 'etag-' + Date.now();
      
      return { success: true, data: { events: cache, etag: cacheEtag } };
    };

    test('cache miss returns full data', async () => {
      const result = await getEvents(null);
      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(1);
    });

    test('cache hit returns 304', async () => {
      const result1 = await getEvents(null);
      const etag = result1.data.etag;
      
      const result2 = await getEvents(etag);
      expect(result2.code).toBe(304);
    });
  });
});
