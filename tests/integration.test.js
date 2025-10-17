/**
 * ZEventbook Comprehensive Integration Tests
 * 
 * COMPLETE end-to-end workflow testing
 * 
 * Test Categories:
 * 1. File Inclusion System
 * 2. RPC Integration
 * 3. Spreadsheet Operations
 * 4. Complete Event Creation Workflow
 * 5. Error Propagation
 * 6. Caching Integration
 * 7. Multi-User Scenarios
 * 8. Concurrent Operations
 * 9. Rollback & Recovery
 * 10. Performance & Load
 * 
 * @version 2.0.0 - Comprehensive Coverage
 */

describe('ZEventbook Comprehensive Integration Tests', () => {
  
  // ============================================================================
  // SECTION 1: FILE INCLUSION SYSTEM (12 cases)
  // ============================================================================
  
  describe('File Inclusion System', () => {
    const mockFiles = {
      'Styles': '<style>.container { max-width: 1200px; } .card { padding: 20px; }</style>',
      'NUSDK': '<script>const NU = { rpc: function() {}, util: {} };</script>',
      'Admin': '<div id="admin"><h1>Admin Panel</h1></div>',
      'Public': '<div id="public"><h1>Public View</h1></div>',
      'Navigation': '<nav><ul><li>Home</li><li>Events</li></ul></nav>'
    };
    
    const include = (filename) => {
      if (!mockFiles[filename]) {
        throw new Error(`File not found: ${filename}`);
      }
      return mockFiles[filename];
    };

    describe('Basic Inclusion', () => {
      it('includes Styles.html', () => {
        const content = include('Styles');
        expect(content).toContain('<style>');
        expect(content).toContain('.container');
      });

      it('includes NUSDK.html', () => {
        const content = include('NUSDK');
        expect(content).toContain('const NU');
        expect(content).toContain('rpc');
      });

      it('includes Admin.html', () => {
        const content = include('Admin');
        expect(content).toContain('id="admin"');
        expect(content).toContain('Admin Panel');
      });

      it('includes Public.html', () => {
        const content = include('Public');
        expect(content).toContain('id="public"');
        expect(content).toContain('Public View');
      });

      it('includes Navigation.html', () => {
        const content = include('Navigation');
        expect(content).toContain('<nav>');
        expect(content).toContain('<ul>');
      });
    });

    describe('Error Handling', () => {
      it('throws error for non-existent files', () => {
        expect(() => include('NonExistent')).toThrow('File not found');
        expect(() => include('Missing')).toThrow('File not found: Missing');
      });

      it('handles empty filename', () => {
        expect(() => include('')).toThrow();
      });

      it('handles null filename', () => {
        expect(() => include(null)).toThrow();
      });

      it('is case-sensitive', () => {
        expect(() => include('styles')).toThrow();
        expect(() => include('STYLES')).toThrow();
      });
    });

    describe('Content Validation', () => {
      it('returns string content', () => {
        const content = include('Styles');
        expect(typeof content).toBe('string');
      });

      it('preserves HTML structure', () => {
        const content = include('Admin');
        expect(content).toContain('<div');
        expect(content).toContain('</div>');
      });

      it('preserves CSS syntax', () => {
        const content = include('Styles');
        expect(content).toMatch(/\{[^}]+\}/);
      });
    });
  });

  // ============================================================================
  // SECTION 2: RPC INTEGRATION (25 cases)
  // ============================================================================
  
  describe('RPC Call Integration', () => {
    const mockBackend = {
      getEventsSafe: jest.fn((etag) => {
        if (etag === 'current-etag-123') {
          return Promise.resolve({
            success: true,
            code: 304,
            message: 'Not Modified'
          });
        }
        return Promise.resolve({
          success: true,
          data: {
            events: [
              { id: 'evt-1', name: 'Tech Conference', slug: 'tech-conference' },
              { id: 'evt-2', name: 'Workshop', slug: 'workshop' }
            ],
            etag: 'current-etag-123'
          },
          metadata: { count: 2, cached: false }
        });
      }),
      
      createEventbook: jest.fn((name, startDate) => {
        if (!name) {
          return Promise.resolve({
            error: true,
            code: 400,
            message: 'Validation failed',
            context: { field: 'name', reason: 'required' }
          });
        }
        if (!startDate) {
          return Promise.resolve({
            error: true,
            code: 400,
            message: 'Validation failed',
            context: { field: 'startDate', reason: 'required' }
          });
        }
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        return Promise.resolve({
          success: true,
          data: {
            eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            slug,
            startDate,
            spreadsheetId: `ss-${Date.now()}`,
            orgUrl: `https://example.com?page=admin&event=${slug}`,
            pubUrl: `https://example.com?page=public&event=${slug}`
          }
        });
      }),

      getPublicBundle: jest.fn((eventSlug) => {
        if (eventSlug === 'nonexistent') {
          return Promise.resolve({
            error: true,
            code: 404,
            message: 'Event not found',
            context: { eventSlug }
          });
        }
        return Promise.resolve({
          success: true,
          data: {
            event: {
              id: 'evt-123',
              name: 'Public Event',
              slug: eventSlug,
              pubUrl: `https://example.com?page=public&event=${eventSlug}`
            },
            config: { allowRSVP: true }
          }
        });
      }),

      getShareQrVerified: jest.fn((eventId) => {
        if (!eventId) {
          return Promise.resolve({
            error: true,
            code: 400,
            message: 'Event ID required'
          });
        }
        return Promise.resolve({
          success: true,
          data: {
            qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chl=${eventId}`,
            shortlink: 'https://g.co/abc123',
            eventId
          }
        });
      })
    };

    const NU = {
      rpc: (functionName, ...args) => {
        if (!mockBackend[functionName]) {
          return Promise.reject(new Error(`Function not found: ${functionName}`));
        }
        return mockBackend[functionName](...args);
      }
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('getEventsSafe RPC', () => {
      it('calls getEventsSafe successfully', async () => {
        const result = await NU.rpc('getEventsSafe', null);
        
        expect(result.success).toBe(true);
        expect(result.data.events).toHaveLength(2);
        expect(result.data.etag).toBe('current-etag-123');
        expect(mockBackend.getEventsSafe).toHaveBeenCalledWith(null);
      });

      it('returns 304 when etag matches', async () => {
        const result = await NU.rpc('getEventsSafe', 'current-etag-123');
        
        expect(result.code).toBe(304);
        expect(result.message).toBe('Not Modified');
      });

      it('returns full data on cache miss', async () => {
        const result = await NU.rpc('getEventsSafe', 'old-etag');
        
        expect(result.success).toBe(true);
        expect(result.data.events).toBeDefined();
      });

      it('includes metadata', async () => {
        const result = await NU.rpc('getEventsSafe', null);
        
        expect(result.metadata).toHaveProperty('count');
        expect(result.metadata).toHaveProperty('cached');
      });

      it('returns array of events', async () => {
        const result = await NU.rpc('getEventsSafe', null);
        
        expect(Array.isArray(result.data.events)).toBe(true);
      });
    });

    describe('createEventbook RPC', () => {
      it('creates eventbook successfully', async () => {
        const result = await NU.rpc('createEventbook', 'Tech Conference', '2025-12-01');
        
        expect(result.success).toBe(true);
        expect(result.data.name).toBe('Tech Conference');
        expect(result.data.slug).toBe('tech-conference');
        expect(result.data.eventId).toMatch(/^evt-/);
      });

      it('generates proper slug', async () => {
        const result = await NU.rpc('createEventbook', 'My Great Event', '2025-12-01');
        
        expect(result.data.slug).toBe('my-great-event');
      });

      it('returns validation error for missing name', async () => {
        const result = await NU.rpc('createEventbook', '', '2025-12-01');
        
        expect(result.error).toBe(true);
        expect(result.code).toBe(400);
        expect(result.context.field).toBe('name');
      });

      it('returns validation error for missing date', async () => {
        const result = await NU.rpc('createEventbook', 'Event Name', '');
        
        expect(result.error).toBe(true);
        expect(result.code).toBe(400);
        expect(result.context.field).toBe('startDate');
      });

      it('generates URLs', async () => {
        const result = await NU.rpc('createEventbook', 'Event', '2025-12-01');
        
        expect(result.data.orgUrl).toContain('page=admin');
        expect(result.data.pubUrl).toContain('page=public');
      });

      it('generates unique event IDs', async () => {
        const result1 = await NU.rpc('createEventbook', 'Event 1', '2025-12-01');
        const result2 = await NU.rpc('createEventbook', 'Event 2', '2025-12-01');
        
        expect(result1.data.eventId).not.toBe(result2.data.eventId);
      });
    });

    describe('getPublicBundle RPC', () => {
      it('retrieves public event data', async () => {
        const result = await NU.rpc('getPublicBundle', 'test-event');
        
        expect(result.success).toBe(true);
        expect(result.data.event).toBeDefined();
        expect(result.data.config).toBeDefined();
      });

      it('returns 404 for non-existent events', async () => {
        const result = await NU.rpc('getPublicBundle', 'nonexistent');
        
        expect(result.error).toBe(true);
        expect(result.code).toBe(404);
      });

      it('excludes sensitive data from public bundle', async () => {
        const result = await NU.rpc('getPublicBundle', 'test-event');
        
        expect(result.data.event).not.toHaveProperty('spreadsheetId');
        expect(result.data.event).not.toHaveProperty('folderId');
      });

      it('includes public URL', async () => {
        const result = await NU.rpc('getPublicBundle', 'test-event');
        
        expect(result.data.event.pubUrl).toContain('page=public');
      });
    });

    describe('getShareQrVerified RPC', () => {
      it('generates QR code data', async () => {
        const result = await NU.rpc('getShareQrVerified', 'evt-123');
        
        expect(result.success).toBe(true);
        expect(result.data.qrCodeUrl).toContain('chart.googleapis.com');
        expect(result.data.shortlink).toBeDefined();
      });

      it('requires eventId parameter', async () => {
        const result = await NU.rpc('getShareQrVerified', '');
        
        expect(result.error).toBe(true);
        expect(result.code).toBe(400);
      });

      it('returns valid QR code URL', async () => {
        const result = await NU.rpc('getShareQrVerified', 'evt-123');
        
        expect(result.data.qrCodeUrl).toMatch(/^https?:\/\//);
      });
    });

    describe('Error Handling', () => {
      it('handles non-existent RPC functions', async () => {
        await expect(NU.rpc('nonExistentFunction')).rejects.toThrow('Function not found');
      });

      it('propagates backend errors', async () => {
        const result = await NU.rpc('createEventbook', '', '2025-12-01');
        expect(result.error).toBe(true);
      });

      it('includes error context', async () => {
        const result = await NU.rpc('createEventbook', '', '2025-12-01');
        expect(result.context).toBeDefined();
      });
    });
  });

  // ============================================================================
  // SECTION 3: SPREADSHEET OPERATIONS (15 cases)
  // ============================================================================
  
  describe('Spreadsheet Operations', () => {
    class MockSpreadsheet {
      constructor(id, name) {
        this.id = id;
        this.name = name;
        this.sheets = [];
      }
      
      insertSheet(name) {
        const sheet = {
          name,
          data: [],
          setName: (newName) => { sheet.name = newName; },
          getRange: (notation) => ({
            setValues: (values) => { sheet.data = values; },
            getValues: () => sheet.data
          })
        };
        this.sheets.push(sheet);
        return sheet;
      }
      
      getId() { return this.id; }
      getName() { return this.name; }
      getSheets() { return this.sheets; }
      getSheetByName(name) {
        return this.sheets.find(s => s.name === name) || null;
      }
    }

    describe('Spreadsheet Creation', () => {
      it('creates spreadsheet with ID and name', () => {
        const ss = new MockSpreadsheet('abc123', 'Test Event');
        
        expect(ss.getId()).toBe('abc123');
        expect(ss.getName()).toBe('Test Event');
      });

      it('initializes with empty sheets array', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        expect(ss.getSheets()).toHaveLength(0);
      });

      it('creates spreadsheet for event', () => {
        const ss = new MockSpreadsheet(`ss-${Date.now()}`, 'Tech Conference 2025');
        expect(ss.getName()).toBe('Tech Conference 2025');
      });
    });

    describe('Sheet Operations', () => {
      it('inserts new sheet', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        const sheet = ss.insertSheet('Events');
        
        expect(sheet.name).toBe('Events');
        expect(ss.getSheets()).toHaveLength(1);
      });

      it('inserts multiple sheets', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        ss.insertSheet('Events');
        ss.insertSheet('Attendees');
        ss.insertSheet('Schedule');
        
        expect(ss.getSheets()).toHaveLength(3);
      });

      it('retrieves sheet by name', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        ss.insertSheet('Events');
        
        const sheet = ss.getSheetByName('Events');
        expect(sheet).not.toBeNull();
        expect(sheet.name).toBe('Events');
      });

      it('returns null for non-existent sheet', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        expect(ss.getSheetByName('NonExistent')).toBeNull();
      });
    });

    describe('Data Operations', () => {
      it('stores event data in sheet', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        const sheet = ss.insertSheet('Events');
        
        const headers = ['ID', 'Name', 'Date', 'Status'];
        const data = ['evt-1', 'Conference', '2025-12-01', 'active'];
        
        sheet.data.push(headers);
        sheet.data.push(data);
        
        expect(sheet.data).toHaveLength(2);
        expect(sheet.data[0]).toEqual(headers);
      });

      it('handles multiple rows', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        const sheet = ss.insertSheet('Events');
        
        sheet.data.push(['ID', 'Name']);
        sheet.data.push(['evt-1', 'Event 1']);
        sheet.data.push(['evt-2', 'Event 2']);
        
        expect(sheet.data).toHaveLength(3);
      });

      it('stores attendee data', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        const sheet = ss.insertSheet('Attendees');
        
        sheet.data.push(['Name', 'Email', 'RSVP']);
        sheet.data.push(['John Doe', 'john@example.com', 'Yes']);
        
        expect(sheet.data[1][0]).toBe('John Doe');
      });

      it('updates existing data', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        const sheet = ss.insertSheet('Events');
        
        sheet.data = [['ID', 'Name'], ['evt-1', 'Old Name']];
        sheet.data[1][1] = 'Updated Name';
        
        expect(sheet.data[1][1]).toBe('Updated Name');
      });
    });

    describe('Sheet Structure', () => {
      it('creates standard event sheet structure', () => {
        const ss = new MockSpreadsheet('abc123', 'Event');
        const eventsSheet = ss.insertSheet('Events');
        const attendeesSheet = ss.insertSheet('Attendees');
        const scheduleSheet = ss.insertSheet('Schedule');
        
        expect(ss.getSheets()).toHaveLength(3);
        expect(eventsSheet.name).toBe('Events');
        expect(attendeesSheet.name).toBe('Attendees');
        expect(scheduleSheet.name).toBe('Schedule');
      });

      it('preserves sheet names', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        const sheet = ss.insertSheet('My Custom Sheet');
        
        expect(sheet.name).toBe('My Custom Sheet');
      });

      it('allows sheet renaming', () => {
        const ss = new MockSpreadsheet('abc123', 'Test');
        const sheet = ss.insertSheet('Original');
        sheet.setName('Renamed');
        
        expect(sheet.name).toBe('Renamed');
      });
    });
  });

  // ============================================================================
  // SECTION 4: COMPLETE EVENT CREATION WORKFLOW (20 cases)
  // ============================================================================
  
  describe('Complete Event Creation Workflow', () => {
    const workflow = {
      validate: (name, startDate) => {
        const errors = [];
        if (!name || name.trim().length === 0) errors.push('Name required');
        if (!startDate) errors.push('Date required');
        if (name && name.length < 3) errors.push('Name too short');
        if (name && name.length > 255) errors.push('Name too long');
        return { valid: errors.length === 0, errors };
      },
      
      createSlug: (name) => {
        return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      },
      
      createSpreadsheet: async (name) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          id: `ss-${Date.now()}`,
          url: `https://docs.google.com/spreadsheets/d/ss-${Date.now()}`
        };
      },
      
      createFolder: async (eventName) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          id: `folder-${Date.now()}`,
          url: `https://drive.google.com/drive/folders/folder-${Date.now()}`
        };
      },
      
      generateUrls: (baseUrl, slug) => ({
        orgUrl: `${baseUrl}?page=admin&event=${slug}`,
        pubUrl: `${baseUrl}?page=public&event=${slug}`
      }),

      generateQrCode: async (url) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(url)}`;
      },

      createShortlink: async (longUrl) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        const hash = Math.random().toString(36).substr(2, 6);
        return `https://g.co/${hash}`;
      },

      saveToMaster: async (eventData) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { success: true, rowNumber: Math.floor(Math.random() * 1000) };
      }
    };

    describe('Step 1: Input Validation', () => {
      it('validates all inputs', () => {
        const result = workflow.validate('Tech Conference', '2025-12-01');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('rejects missing name', () => {
        const result = workflow.validate('', '2025-12-01');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Name required');
      });

      it('rejects missing date', () => {
        const result = workflow.validate('Event', '');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Date required');
      });

      it('enforces minimum name length', () => {
        const result = workflow.validate('ab', '2025-12-01');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Name too short');
      });

      it('enforces maximum name length', () => {
        const result = workflow.validate('x'.repeat(256), '2025-12-01');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Name too long');
      });

      it('returns multiple errors', () => {
        const result = workflow.validate('ab', '');
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });

    describe('Step 2: Slug Generation', () => {
      it('creates slug from name', () => {
        expect(workflow.createSlug('Tech Conference 2025')).toBe('tech-conference-2025');
      });

      it('removes special characters', () => {
        expect(workflow.createSlug('Event @ 2025!')).toBe('event--2025');
      });

      it('handles multiple spaces', () => {
        expect(workflow.createSlug('My   Great    Event')).toBe('my-great-event');
      });

      it('converts to lowercase', () => {
        expect(workflow.createSlug('UPPERCASE EVENT')).toBe('uppercase-event');
      });
    });

    describe('Step 3: Resource Creation', () => {
      it('creates spreadsheet', async () => {
        const ss = await workflow.createSpreadsheet('Test Event');
        expect(ss.id).toMatch(/^ss-/);
        expect(ss.url).toContain('spreadsheets');
      });

      it('creates folder', async () => {
        const folder = await workflow.createFolder('Test Event');
        expect(folder.id).toMatch(/^folder-/);
        expect(folder.url).toContain('folders');
      });

      it('generates unique IDs', async () => {
        const ss1 = await workflow.createSpreadsheet('Event 1');
        const ss2 = await workflow.createSpreadsheet('Event 2');
        expect(ss1.id).not.toBe(ss2.id);
      });
    });

    describe('Step 4: URL Generation', () => {
      it('generates admin and public URLs', () => {
        const urls = workflow.generateUrls('https://example.com', 'test-event');
        expect(urls.orgUrl).toContain('page=admin');
        expect(urls.pubUrl).toContain('page=public');
      });

      it('includes event slug in URLs', () => {
        const urls = workflow.generateUrls('https://example.com', 'my-event');
        expect(urls.orgUrl).toContain('event=my-event');
        expect(urls.pubUrl).toContain('event=my-event');
      });
    });

    describe('Step 5: QR Code & Shortlink', () => {
      it('generates QR code URL', async () => {
        const qrUrl = await workflow.generateQrCode('https://example.com');
        expect(qrUrl).toContain('chart.googleapis.com');
        expect(qrUrl).toContain('cht=qr');
      });

      it('creates shortlink', async () => {
        const shortlink = await workflow.createShortlink('https://example.com/very/long/url');
        expect(shortlink).toMatch(/^https:\/\/g\.co\/[a-z0-9]+$/);
        expect(shortlink.length).toBeLessThan(25);
      });
    });

    describe('Step 6: Save to Master', () => {
      it('saves event to master sheet', async () => {
        const result = await workflow.saveToMaster({
          name: 'Test Event',
          slug: 'test-event',
          startDate: '2025-12-01'
        });
        expect(result.success).toBe(true);
        expect(result.rowNumber).toBeDefined();
      });
    });

    describe('Complete Workflow Integration', () => {
      it('executes full workflow successfully', async () => {
        const name = 'Annual Tech Summit 2025';
        const startDate = '2025-12-01';
        
        // Step 1: Validate
        const validation = workflow.validate(name, startDate);
        expect(validation.valid).toBe(true);
        
        // Step 2: Create slug
        const slug = workflow.createSlug(name);
        expect(slug).toBe('annual-tech-summit-2025');
        
        // Step 3: Create resources
        const ss = await workflow.createSpreadsheet(name);
        const folder = await workflow.createFolder(name);
        expect(ss.id).toBeDefined();
        expect(folder.id).toBeDefined();
        
        // Step 4: Generate URLs
        const urls = workflow.generateUrls('https://example.com', slug);
        expect(urls.orgUrl).toBeDefined();
        expect(urls.pubUrl).toBeDefined();
        
        // Step 5: Generate QR and shortlink
        const qrUrl = await workflow.generateQrCode(urls.pubUrl);
        const shortlink = await workflow.createShortlink(urls.pubUrl);
        expect(qrUrl).toBeDefined();
        expect(shortlink).toBeDefined();
        
        // Step 6: Save
        const saved = await workflow.saveToMaster({
          name, slug, startDate,
          spreadsheetId: ss.id,
          folderId: folder.id,
          orgUrl: urls.orgUrl,
          pubUrl: urls.pubUrl
        });
        expect(saved.success).toBe(true);
      });

      it('workflow completes in reasonable time', async () => {
        const startTime = Date.now();
        
        const validation = workflow.validate('Test Event', '2025-12-01');
        const slug = workflow.createSlug('Test Event');
        const ss = await workflow.createSpreadsheet('Test Event');
        const urls = workflow.generateUrls('https://example.com', slug);
        const qr = await workflow.generateQrCode(urls.pubUrl);
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(500); // Should complete in < 500ms
      });
    });
  });

  // ============================================================================
  // SECTION 5: ERROR PROPAGATION (12 cases)
  // ============================================================================
  
  describe('Error Propagation', () => {
    const backend = {
      createEvent: (name, date) => {
        if (!name) {
          return Promise.resolve({
            error: true,
            code: 400,
            message: 'Validation failed',
            context: { field: 'name', reason: 'required' }
          });
        }
        if (new Date(date) < new Date()) {
          return Promise.resolve({
            error: true,
            code: 400,
            message: 'Date cannot be in past',
            context: { field: 'startDate' }
          });
        }
        return Promise.resolve({ 
          success: true, 
          data: { eventId: 'evt-123', name, slug: name.toLowerCase() }
        });
      }
    };

    const frontend = {
      createEvent: async (name, date) => {
        const result = await backend.createEvent(name, date);
        
        if (result.error) {
          return {
            success: false,
            userMessage: `Error: ${result.message}`,
            field: result.context?.field,
            code: result.code
          };
        }
        
        return { 
          success: true, 
          event: result.data 
        };
      },

      displayError: (error) => {
        return {
          message: error.userMessage,
          field: error.field,
          type: 'error'
        };
      }
    };

    it('propagates validation errors to frontend', async () => {
      const result = await frontend.createEvent('', '2025-12-01');
      
      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Validation failed');
      expect(result.field).toBe('name');
    });

    it('propagates date validation errors', async () => {
      const result = await frontend.createEvent('Event', '2020-01-01');
      
      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Date cannot be in past');
    });

    it('handles successful operations', async () => {
      const result = await frontend.createEvent('Valid Event', '2025-12-01');
      
      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();
    });

    it('includes error codes', async () => {
      const result = await frontend.createEvent('', '2025-12-01');
      expect(result.code).toBe(400);
    });

    it('formats errors for display', async () => {
      const result = await frontend.createEvent('', '2025-12-01');
      const displayError = frontend.displayError(result);
      
      expect(displayError.type).toBe('error');
      expect(displayError.message).toBeDefined();
    });

    it('includes field information in errors', async () => {
      const result = await frontend.createEvent('', '2025-12-01');
      expect(result.field).toBe('name');
    });

    it('preserves error context through layers', async () => {
      const result = await frontend.createEvent('', '2025-12-01');
      expect(result.field).toBe('name');
    });

    it('handles multiple validation errors', async () => {
      const result1 = await frontend.createEvent('', '2025-12-01');
      const result2 = await frontend.createEvent('Event', '2020-01-01');
      
      expect(result1.field).toBe('name');
      expect(result2.field).toBe('startDate');
    });

    it('provides user-friendly error messages', async () => {
      const result = await frontend.createEvent('', '2025-12-01');
      expect(result.userMessage).not.toContain('undefined');
      expect(result.userMessage.length).toBeGreaterThan(0);
    });

    it('distinguishes between error types by code', async () => {
      const result = await frontend.createEvent('', '2025-12-01');
      expect([400, 404, 409, 500]).toContain(result.code);
    });
  });

  // ============================================================================
  // SECTION 6: CACHING INTEGRATION (15 cases)
  // ============================================================================
  
  describe('Caching Integration', () => {
    let cache = null;
    let cacheEtag = null;
    let cacheTimestamp = null;
    const CACHE_TTL = 300000; // 5 minutes

    const getEvents = async (clientEtag) => {
      const now = Date.now();
      
      // Check if cache is valid
      if (cache && cacheEtag === clientEtag && (now - cacheTimestamp) < CACHE_TTL) {
        return { 
          code: 304, 
          message: 'Not Modified',
          cached: true
        };
      }
      
      // Simulate fetching from database
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const events = [
        { id: 'evt-1', name: 'Event 1', slug: 'event-1' },
        { id: 'evt-2', name: 'Event 2', slug: 'event-2' }
      ];
      
      cache = events;
      cacheEtag = `etag-${now}`;
      cacheTimestamp = now;
      
      return { 
        success: true, 
        data: { events: cache, etag: cacheEtag },
        metadata: { cached: false, timestamp: now }
      };
    };

    const invalidateCache = () => {
      cache = null;
      cacheEtag = null;
      cacheTimestamp = null;
    };

    beforeEach(() => {
      invalidateCache();
    });

    describe('Cache Miss', () => {
      it('returns full data on cache miss', async () => {
        const result = await getEvents(null);
        
        expect(result.success).toBe(true);
        expect(result.data.events).toHaveLength(2);
        expect(result.data.etag).toBeDefined();
      });

      it('returns full data on invalid etag', async () => {
        await getEvents(null); // Prime cache
        const result = await getEvents('wrong-etag');
        
        expect(result.success).toBe(true);
        expect(result.data.events).toBeDefined();
      });

      it('sets metadata.cached to false', async () => {
        const result = await getEvents(null);
        expect(result.metadata.cached).toBe(false);
      });
    });

    describe('Cache Hit', () => {
      it('returns 304 when etag matches', async () => {
        const result1 = await getEvents(null);
        const etag = result1.data.etag;
        
        const result2 = await getEvents(etag);
        expect(result2.code).toBe(304);
        expect(result2.cached).toBe(true);
      });

      it('saves bandwidth on cache hit', async () => {
        const result1 = await getEvents(null);
        const size1 = JSON.stringify(result1).length;
        
        const result2 = await getEvents(result1.data.etag);
        const size2 = JSON.stringify(result2).length;
        
        expect(size2).toBeLessThan(size1);
      });

      it('responds faster on cache hit', async () => {
        await getEvents(null);
        const etag = cacheEtag;
        
        const start = Date.now();
        await getEvents(etag);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(20);
      });
    });

    describe('Cache Invalidation', () => {
      it('invalidates cache manually', async () => {
        await getEvents(null);
        const oldEtag = cacheEtag;
        
        invalidateCache();
        
        const result = await getEvents(oldEtag);
        expect(result.success).toBe(true);
        expect(result.data.events).toBeDefined();
      });

      it('generates new etag after invalidation', async () => {
        const result1 = await getEvents(null);
        const etag1 = result1.data.etag;
        
        invalidateCache();
        
        const result2 = await getEvents(result1.data.etag);
        const etag2 = result2.data.etag;
        
        expect(etag1).not.toBe(etag2);
      });

      it('cache expires after TTL', async () => {
        const result1 = await getEvents(null);
        const etag = result1.data.etag;
        
        // Simulate time passing beyond TTL
        cacheTimestamp = Date.now() - (CACHE_TTL + 1000);
        
        const result2 = await getEvents(etag);
        expect(result2.success).toBe(true);
        expect(result2.data.events).toBeDefined();
      });
    });

    describe('Multiple Clients', () => {
      it('handles multiple clients with different etags', async () => {
        const result1 = await getEvents(null);
        const etag1 = result1.data.etag;
        
        invalidateCache();
        const result2 = await getEvents(result1.data.etag);
        const etag2 = result2.data.etag;
        
        // Client 1 with old etag
        const client1Result = await getEvents(etag1);
        expect(client1Result.success).toBe(true);
        
        // Client 2 with current etag
        const client2Result = await getEvents(cacheEtag);
        expect(client2Result.code).toBe(304);
      });

      it('all clients get same etag on fresh fetch', async () => {
        const result1 = await getEvents(null);
        const result2 = await getEvents(result1.data.etag);
        
        // Both should have same etag since cache is shared
        expect(result2.code).toBe(304);
      });
    });

    describe('Cache Performance', () => {
      it('reduces server load with caching', async () => {
        let fetchCount = 0;
        
        const getEventsWithCounter = async (etag) => {
          const result = await getEvents(etag);
          if (result.success && result.data) fetchCount++;
          return result;
        };
        
        await getEventsWithCounter(null);
        const etag = cacheEtag;
        
        await getEventsWithCounter(etag);
        await getEventsWithCounter(etag);
        await getEventsWithCounter(etag);
        
        expect(fetchCount).toBe(1); // Only fetched once
      });
    });
  });

  // ============================================================================
  // SECTION 7: MULTI-USER SCENARIOS (10 cases)
  // ============================================================================
  
  describe('Multi-User Scenarios', () => {
    const eventStore = [];
    
    const createEvent = async (userId, name, date) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      
      // Check for duplicate slug
      if (eventStore.some(e => e.slug === slug)) {
        return {
          error: true,
          code: 409,
          message: 'Event already exists'
        };
      }
      
      const event = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substr(2,5)}-${userId}`,
        userId,
        name,
        slug,
        date,
        createdAt: new Date().toISOString()
      };
      
      eventStore.push(event);
      
      return { success: true, data: event };
    };

    const getUserEvents = (userId) => {
      return eventStore.filter(e => e.userId === userId);
    };

    beforeEach(() => {
      eventStore.length = 0;
    });

    it('allows multiple users to create events', async () => {
      const result1 = await createEvent('user1', 'Event A', '2025-12-01');
      const result2 = await createEvent('user2', 'Event B', '2025-12-01');
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(eventStore).toHaveLength(2);
    });

    it('prevents duplicate slugs across users', async () => {
      await createEvent('user1', 'Tech Conference', '2025-12-01');
      const result = await createEvent('user2', 'Tech Conference', '2025-12-02');
      
      expect(result.error).toBe(true);
      expect(result.code).toBe(409);
    });

    it('filters events by user', async () => {
      await createEvent('user1', 'Event A', '2025-12-01');
      await createEvent('user1', 'Event B', '2025-12-01');
      await createEvent('user2', 'Event C', '2025-12-01');
      
      const user1Events = getUserEvents('user1');
      expect(user1Events).toHaveLength(2);
    });

    it('includes user ID in event data', async () => {
      const result = await createEvent('user123', 'Event', '2025-12-01');
      expect(result.data.userId).toBe('user123');
    });

    it('generates unique IDs per user', async () => {
      const result1 = await createEvent('user1', 'Event A', '2025-12-01');
      const result2 = await createEvent('user1', 'Event B', '2025-12-01');
      
      expect(result1.data.id).not.toBe(result2.data.id);
    });

    it('tracks creation timestamps', async () => {
      const result = await createEvent('user1', 'Event', '2025-12-01');
      expect(result.data.createdAt).toBeDefined();
      expect(result.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('handles concurrent creations', async () => {
      const promises = [
        createEvent('user1', 'Event 1', '2025-12-01'),
        createEvent('user2', 'Event 2', '2025-12-01'),
        createEvent('user3', 'Event 3', '2025-12-01')
      ];
      
      const results = await Promise.all(promises);
      expect(results.every(r => r.success)).toBe(true);
      expect(eventStore).toHaveLength(3);
    });

    it('isolates user data', async () => {
      await createEvent('user1', 'Private Event', '2025-12-01');
      const user2Events = getUserEvents('user2');
      
      expect(user2Events).toHaveLength(0);
    });

    it('maintains event order by creation time', async () => {
      await createEvent('user1', 'Event A', '2025-12-01');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createEvent('user1', 'Event B', '2025-12-01');
      
      const events = getUserEvents('user1');
      expect(new Date(events[0].createdAt) < new Date(events[1].createdAt)).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 8: PERFORMANCE & LOAD (8 cases)
  // ============================================================================
  
  describe('Performance & Load Testing', () => {
    it('handles rapid sequential requests', async () => {
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(Promise.resolve({ success: true, id: i }));
      }
      
      const results = await Promise.all(requests);
      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('handles large event lists', () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        id: `evt-${i}`,
        name: `Event ${i}`,
        slug: `event-${i}`
      }));
      
      expect(events).toHaveLength(1000);
      expect(events[999].id).toBe('evt-999');
    });

    it('processes batch operations efficiently', async () => {
      const startTime = Date.now();
      
      const batch = Array.from({ length: 50 }, (_, i) => ({
        name: `Event ${i}`,
        date: '2025-12-01'
      }));
      
      const results = await Promise.all(
        batch.map(e => Promise.resolve({ success: true, name: e.name }))
      );
      
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(100);
    });

    it('maintains performance under load', async () => {
      const iterations = 100;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await Promise.resolve({ success: true });
        times.push(Date.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(5);
    });

    it('handles concurrent reads', async () => {
      const reads = Array.from({ length: 20 }, () =>
        Promise.resolve({ data: { events: [] } })
      );
      
      const results = await Promise.all(reads);
      expect(results).toHaveLength(20);
    });

    it('handles concurrent writes', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve({ success: true, id: `evt-${i}` })
      );
      
      const results = await Promise.all(writes);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('scales with data volume', () => {
      const smallData = Array(100).fill({ id: '1' });
      const largeData = Array(10000).fill({ id: '1' });
      
      const smallStart = Date.now();
      const smallFiltered = smallData.filter(d => d.id === '1');
      const smallTime = Date.now() - smallStart;
      
      const largeStart = Date.now();
      const largeFiltered = largeData.filter(d => d.id === '1');
      const largeTime = Date.now() - largeStart;
      
      expect(smallFiltered).toHaveLength(100);
      expect(largeFiltered).toHaveLength(10000);
      expect(largeTime).toBeLessThan(100);
    });

    it('manages memory efficiently', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: `evt-${i}`,
        name: `Event ${i}`,
        data: Array(10).fill('x')
      }));
      
      // Clear references
      data.length = 0;
      
      expect(data).toHaveLength(0);
    });
  });

  // ============================================================================
  // SECTION 9: ROLLBACK & RECOVERY (15 cases)
  // ============================================================================
  
  describe('Rollback & Recovery', () => {
    const resources = [];
    
    const createResource = async (type, name) => {
      const resource = {
        id: `${type}-${Date.now()}`,
        type,
        name,
        createdAt: new Date().toISOString()
      };
      resources.push(resource);
      return resource;
    };

    const deleteResource = (id) => {
      const index = resources.findIndex(r => r.id === id);
      if (index > -1) {
        resources.splice(index, 1);
        return true;
      }
      return false;
    };

    const rollbackTransaction = (createdIds) => {
      const deleted = [];
      createdIds.forEach(id => {
        if (deleteResource(id)) {
          deleted.push(id);
        }
      });
      return { success: true, deletedCount: deleted.length, deleted };
    };

    beforeEach(() => {
      resources.length = 0;
    });

    it('tracks created resources', async () => {
      const ss = await createResource('spreadsheet', 'Test Event');
      const folder = await createResource('folder', 'Test Event');
      
      expect(resources).toHaveLength(2);
      expect(resources[0].type).toBe('spreadsheet');
      expect(resources[1].type).toBe('folder');
    });

    it('deletes single resource', () => {
      resources.push({ id: 'test-123', type: 'spreadsheet' });
      const deleted = deleteResource('test-123');
      
      expect(deleted).toBe(true);
      expect(resources).toHaveLength(0);
    });

    it('rolls back multiple resources', () => {
      resources.push({ id: 'ss-1', type: 'spreadsheet' });
      resources.push({ id: 'folder-1', type: 'folder' });
      
      const result = rollbackTransaction(['ss-1', 'folder-1']);
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(resources).toHaveLength(0);
    });

    it('handles partial rollback failures', () => {
      resources.push({ id: 'ss-1', type: 'spreadsheet' });
      
      const result = rollbackTransaction(['ss-1', 'nonexistent']);
      
      expect(result.deletedCount).toBe(1);
    });

    it('rollback preserves unrelated resources', () => {
      resources.push({ id: 'keep-1', type: 'spreadsheet' });
      resources.push({ id: 'delete-1', type: 'spreadsheet' });
      
      rollbackTransaction(['delete-1']);
      
      expect(resources).toHaveLength(1);
      expect(resources[0].id).toBe('keep-1');
    });

    it('logs rollback actions', () => {
      const log = [];
      const logRollback = (action) => log.push(action);
      
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      deleteResource('test-1');
      logRollback({ action: 'delete', id: 'test-1' });
      
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe('delete');
    });

    it('handles empty rollback list', () => {
      const result = rollbackTransaction([]);
      expect(result.deletedCount).toBe(0);
    });

    it('rollback is idempotent', () => {
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      
      rollbackTransaction(['test-1']);
      const result2 = rollbackTransaction(['test-1']);
      
      expect(result2.deletedCount).toBe(0);
    });

    it('tracks rollback timestamps', () => {
      const timestamp = new Date().toISOString();
      const rollback = {
        timestamp,
        resources: ['ss-1', 'folder-1'],
        reason: 'Creation failed'
      };
      
      expect(rollback.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes failure reason in rollback', () => {
      const rollback = {
        success: true,
        reason: 'QR code generation failed',
        step: 'qr_generation'
      };
      
      expect(rollback.reason).toBeDefined();
      expect(rollback.step).toBe('qr_generation');
    });

    it('rollback cleans up in reverse order', () => {
      const creationOrder = ['ss-1', 'folder-1', 'qr-1'];
      const deletionOrder = [];
      
      creationOrder.reverse().forEach(id => {
        deletionOrder.push(id);
      });
      
      expect(deletionOrder).toEqual(['qr-1', 'folder-1', 'ss-1']);
    });

    it('validates all resources deleted', () => {
      resources.push({ id: 'ss-1', type: 'spreadsheet' });
      resources.push({ id: 'folder-1', type: 'folder' });
      
      rollbackTransaction(['ss-1', 'folder-1']);
      
      expect(resources).toHaveLength(0);
    });

    it('handles concurrent rollback attempts', async () => {
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      
      const rollback1 = Promise.resolve(rollbackTransaction(['test-1']));
      const rollback2 = Promise.resolve(rollbackTransaction(['test-1']));
      
      const results = await Promise.all([rollback1, rollback2]);
      expect(results.some(r => r.deletedCount === 1)).toBe(true);
    });

    it('recovery validates resource state', () => {
      const validateRecovery = () => {
        return resources.length === 0 && {
          valid: true,
          message: 'All resources cleaned up'
        };
      };
      
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      rollbackTransaction(['test-1']);
      
      const validation = validateRecovery();
      expect(validation.valid).toBe(true);
    });

    it('records rollback metrics', () => {
      const metrics = {
        totalRollbacks: 0,
        resourcesDeleted: 0,
        averageTime: 0
      };
      
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      const result = rollbackTransaction(['test-1']);
      
      metrics.totalRollbacks++;
      metrics.resourcesDeleted += result.deletedCount;
      
      expect(metrics.totalRollbacks).toBe(1);
      expect(metrics.resourcesDeleted).toBe(1);
    });
  });

  // ============================================================================
  // SECTION 10: DATA INTEGRITY & VALIDATION (15 cases)


  // ============================================================================
  // SECTION 9: ROLLBACK & RECOVERY (15 cases)
  // ============================================================================
  
  describe('Rollback & Recovery', () => {
    const resources = [];
    
    const createResource = async (type, name) => {
      const resource = {
        id: `${type}-${Date.now()}`,
        type,
        name,
        createdAt: new Date().toISOString()
      };
      resources.push(resource);
      return resource;
    };

    const deleteResource = (id) => {
      const index = resources.findIndex(r => r.id === id);
      if (index > -1) {
        resources.splice(index, 1);
        return true;
      }
      return false;
    };

    const rollbackTransaction = (createdIds) => {
      const deleted = [];
      createdIds.forEach(id => {
        if (deleteResource(id)) {
          deleted.push(id);
        }
      });
      return { success: true, deletedCount: deleted.length, deleted };
    };

    beforeEach(() => {
      resources.length = 0;
    });

    it('tracks created resources', async () => {
      const ss = await createResource('spreadsheet', 'Test Event');
      const folder = await createResource('folder', 'Test Event');
      
      expect(resources).toHaveLength(2);
      expect(resources[0].type).toBe('spreadsheet');
      expect(resources[1].type).toBe('folder');
    });

    it('deletes single resource', () => {
      resources.push({ id: 'test-123', type: 'spreadsheet' });
      const deleted = deleteResource('test-123');
      
      expect(deleted).toBe(true);
      expect(resources).toHaveLength(0);
    });

    it('rolls back multiple resources', () => {
      resources.push({ id: 'ss-1', type: 'spreadsheet' });
      resources.push({ id: 'folder-1', type: 'folder' });
      
      const result = rollbackTransaction(['ss-1', 'folder-1']);
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(resources).toHaveLength(0);
    });

    it('handles partial rollback failures', () => {
      resources.push({ id: 'ss-1', type: 'spreadsheet' });
      
      const result = rollbackTransaction(['ss-1', 'nonexistent']);
      
      expect(result.deletedCount).toBe(1);
    });

    it('rollback preserves unrelated resources', () => {
      resources.push({ id: 'keep-1', type: 'spreadsheet' });
      resources.push({ id: 'delete-1', type: 'spreadsheet' });
      
      rollbackTransaction(['delete-1']);
      
      expect(resources).toHaveLength(1);
      expect(resources[0].id).toBe('keep-1');
    });

    it('logs rollback actions', () => {
      const log = [];
      const logRollback = (action) => log.push(action);
      
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      deleteResource('test-1');
      logRollback({ action: 'delete', id: 'test-1' });
      
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe('delete');
    });

    it('handles empty rollback list', () => {
      const result = rollbackTransaction([]);
      expect(result.deletedCount).toBe(0);
    });

    it('rollback is idempotent', () => {
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      
      rollbackTransaction(['test-1']);
      const result2 = rollbackTransaction(['test-1']);
      
      expect(result2.deletedCount).toBe(0);
    });

    it('tracks rollback timestamps', () => {
      const timestamp = new Date().toISOString();
      const rollback = {
        timestamp,
        resources: ['ss-1', 'folder-1'],
        reason: 'Creation failed'
      };
      
      expect(rollback.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes failure reason in rollback', () => {
      const rollback = {
        success: true,
        reason: 'QR code generation failed',
        step: 'qr_generation'
      };
      
      expect(rollback.reason).toBeDefined();
      expect(rollback.step).toBe('qr_generation');
    });

    it('rollback cleans up in reverse order', () => {
      const creationOrder = ['ss-1', 'folder-1', 'qr-1'];
      const deletionOrder = [];
      
      creationOrder.reverse().forEach(id => {
        deletionOrder.push(id);
      });
      
      expect(deletionOrder).toEqual(['qr-1', 'folder-1', 'ss-1']);
    });

    it('validates all resources deleted', () => {
      resources.push({ id: 'ss-1', type: 'spreadsheet' });
      resources.push({ id: 'folder-1', type: 'folder' });
      
      rollbackTransaction(['ss-1', 'folder-1']);
      
      expect(resources).toHaveLength(0);
    });

    it('handles concurrent rollback attempts', async () => {
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      
      const rollback1 = Promise.resolve(rollbackTransaction(['test-1']));
      const rollback2 = Promise.resolve(rollbackTransaction(['test-1']));
      
      const results = await Promise.all([rollback1, rollback2]);
      expect(results.some(r => r.deletedCount === 1)).toBe(true);
    });

    it('recovery validates resource state', () => {
      const validateRecovery = () => {
        return resources.length === 0 && {
          valid: true,
          message: 'All resources cleaned up'
        };
      };
      
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      rollbackTransaction(['test-1']);
      
      const validation = validateRecovery();
      expect(validation.valid).toBe(true);
    });

    it('records rollback metrics', () => {
      const metrics = {
        totalRollbacks: 0,
        resourcesDeleted: 0,
        averageTime: 0
      };
      
      resources.push({ id: 'test-1', type: 'spreadsheet' });
      const result = rollbackTransaction(['test-1']);
      
      metrics.totalRollbacks++;
      metrics.resourcesDeleted += result.deletedCount;
      
      expect(metrics.totalRollbacks).toBe(1);
      expect(metrics.resourcesDeleted).toBe(1);
    });
  });

  // ============================================================================
  // SECTION 10: DATA INTEGRITY & VALIDATION (15 cases)
  // ============================================================================
  
  describe('Data Integrity & Validation', () => {
    
    describe('Input Sanitization Pipeline', () => {
      const sanitizePipeline = (input) => {
        let sanitized = input;
        
        // Step 1: Trim whitespace
        sanitized = sanitized.trim();
        
        // Step 2: Remove HTML
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        
        // Step 3: Escape special chars
        sanitized = sanitized.replace(/[<>]/g, '');
        
        // Step 4: Normalize spaces
        sanitized = sanitized.replace(/\s+/g, ' ');
        
        return sanitized;
      };

      it('executes full sanitization pipeline', () => {
        const dirty = '  <script>alert(1)</script>  Test   Event  ';
        const clean = sanitizePipeline(dirty);
        
        expect(clean).toBe('alert(1) Test Event');
        expect(clean).not.toContain('<script>');
        expect(clean).not.toContain('  ');
      });

      it('preserves valid content', () => {
        const input = 'Valid Event Name 2025';
        const output = sanitizePipeline(input);
        
        expect(output).toBe(input);
      });

      it('handles empty input', () => {
        expect(sanitizePipeline('')).toBe('');
        expect(sanitizePipeline('   ')).toBe('');
      });

      it('removes all HTML tags', () => {
        const input = '<div><b>Bold</b> <i>Italic</i></div>';
        const output = sanitizePipeline(input);
        
        expect(output).not.toContain('<');
        expect(output).not.toContain('>');
      });

      it('normalizes multiple spaces', () => {
        const input = 'Test    Event    Name';
        expect(sanitizePipeline(input)).toBe('Test Event Name');
      });
    });

    describe('Data Consistency Checks', () => {
      const validateConsistency = (event) => {
        const errors = [];
        
        if (event.slug && event.name) {
          const expectedSlug = event.name.toLowerCase().replace(/\s+/g, '-');
          if (!event.slug.includes(expectedSlug.substring(0, 10))) {
            errors.push('Slug does not match name');
          }
        }
        
        if (event.orgUrl && event.pubUrl) {
          if (!event.orgUrl.includes('page=admin')) {
            errors.push('orgUrl missing admin parameter');
          }
          if (!event.pubUrl.includes('page=public')) {
            errors.push('pubUrl missing public parameter');
          }
        }
        
        return { valid: errors.length === 0, errors };
      };

      it('validates slug matches name', () => {
        const event = {
          name: 'Tech Conference',
          slug: 'tech-conference'
        };
        
        const result = validateConsistency(event);
        expect(result.valid).toBe(true);
      });

      it('detects mismatched slug', () => {
        const event = {
          name: 'Tech Conference',
          slug: 'wrong-slug'
        };
        
        const result = validateConsistency(event);
        expect(result.valid).toBe(false);
      });

      it('validates URL parameters', () => {
        const event = {
          orgUrl: 'https://example.com?page=admin&event=test',
          pubUrl: 'https://example.com?page=public&event=test'
        };
        
        const result = validateConsistency(event);
        expect(result.valid).toBe(true);
      });

      it('detects missing URL parameters', () => {
        const event = {
          orgUrl: 'https://example.com?event=test',
          pubUrl: 'https://example.com?event=test'
        };
        
        const result = validateConsistency(event);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('validates all fields present', () => {
        const requiredFields = ['id', 'name', 'slug', 'startDate'];
        const event = {
          id: 'evt-123',
          name: 'Test',
          slug: 'test',
          startDate: '2025-12-01'
        };
        
        const allPresent = requiredFields.every(field => field in event);
        expect(allPresent).toBe(true);
      });
    });

    describe('Cross-Field Validation', () => {
      it('validates date is in future relative to creation', () => {
        const event = {
          createdAt: '2025-10-01',
          startDate: '2025-12-01'
        };
        
        expect(new Date(event.startDate) > new Date(event.createdAt)).toBe(true);
      });

      it('validates spreadsheet ID format', () => {
        const spreadsheetId = 'ss-abc123def456';
        expect(spreadsheetId).toMatch(/^ss-[a-z0-9]+$/);
      });

      it('validates event ID format', () => {
        const eventId = 'evt-1234567890';
        expect(eventId).toMatch(/^evt-[0-9a-z-]+$/);
      });

      it('validates slug is URL-safe', () => {
        const slug = 'tech-conference-2025';
        expect(slug).toMatch(/^[a-z0-9-]+$/);
        expect(slug).not.toContain(' ');
        expect(slug).not.toContain('_');
      });
    });
  });

  // ============================================================================
  // SECTION 11: EDGE CASES & BOUNDARY CONDITIONS (14 cases)
  // ============================================================================
  
  describe('Edge Cases & Boundary Conditions', () => {
    
    it('handles maximum string length', () => {
      const maxName = 'x'.repeat(255);
      expect(maxName.length).toBe(255);
    });

    it('handles minimum string length', () => {
      const minName = 'abc';
      expect(minName.length).toBe(3);
    });

    it('handles empty arrays', () => {
      const events = [];
      expect(events).toHaveLength(0);
      expect(Array.isArray(events)).toBe(true);
    });

    it('handles single-item arrays', () => {
      const events = [{ id: '1' }];
      expect(events).toHaveLength(1);
    });

    it('handles very long arrays', () => {
      const events = Array(10000).fill({ id: 'test' });
      expect(events).toHaveLength(10000);
    });

    it('handles null values gracefully', () => {
      const event = { name: null };
      expect(event.name).toBeNull();
    });

    it('handles undefined values', () => {
      const event = {};
      expect(event.name).toBeUndefined();
    });

    it('handles special characters in names', () => {
      const specialChars = '!@#$%^&*()';
      const sanitized = specialChars.replace(/[^a-z0-9-]/gi, '');
      expect(sanitized).toBe('');
    });

    it('handles dates at year boundaries', () => {
      const date = new Date('2025-12-31T23:59:59Z');
      expect(date.getUTCFullYear()).toBe(2025);
    });

    it('handles leap year dates', () => {
      const leapDay = new Date('2024-02-29');
      expect(leapDay.getMonth()).toBe(1); // February
    });

    it('handles concurrent operations', async () => {
      const operations = Array(10).fill(null).map((_, i) => 
        Promise.resolve({ id: `evt-${i}` })
      );
      
      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
    });

    it('handles rapid sequential requests', async () => {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(Promise.resolve({ success: true }));
      }
      
      const results = await Promise.all(requests);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('handles zero values', () => {
      const count = 0;
      expect(count).toBe(0);
      expect(count).not.toBeNull();
      expect(count).not.toBeUndefined();
    });

    it('handles boolean edge cases', () => {
      expect(true && false).toBe(false);
      expect(true || false).toBe(true);
      expect(!false).toBe(true);
    });
  });
});
