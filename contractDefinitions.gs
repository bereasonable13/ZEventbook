/************************************************************
* ContractDefinitions.gs — API Contract Schema Definitions
* 
* PURPOSE:
* This file defines the "contracts" between our client applications
* (Admin.html, Public.html, etc.) and the server (Code.gs). Think of
* these as legally binding agreements about what shape data must have.
* 
* WHY SEPARATE FILE:
* - Keeps contract definitions isolated from implementation
* - Easy to update without touching business logic
* - Can be version controlled independently
* - Single source of truth for API expectations
* 
* ARCHITECTURE PATTERN:
* This follows "Consumer-Driven Contracts" - the clients (consumers)
* define what they need, and the server (provider) must comply.
* This is backwards from traditional API design where the server
* dictates the contract.
* 
* MOBILE-FIRST PRINCIPLE:
* Every contract includes performance budgets (p50, p95, p99) and
* considers bandwidth constraints. A 25-year architect knows that
* mobile users on 3G connections are just as important as desktop
* users on fiber.
************************************************************/

/**
 * Master function that returns all contract definitions.
 * This is the entry point that ContractTests.gs will call.
 * 
 * The return structure follows JSON Schema specification with
 * some custom extensions for our specific needs (like geo-tagging
 * and performance budgets).
 * 
 * @returns {Object} Complete contract definitions with version info
 */
function getContractDefinitions() {
  return {
    // Version follows semantic versioning: MAJOR.MINOR.PATCH
    // Increment MAJOR when breaking changes occur (clients must update)
    // Increment MINOR when adding new optional fields
    // Increment PATCH for documentation-only changes
    version: '2.0.0',
    
    // Track when contracts were last updated
    // Helps teams know if they're testing against stale definitions
    updated: '2025-01-08',
    
    // Description helps new team members understand purpose
    description: 'NextUp API contracts - consumer-driven design with mobile-first principles',
    
    // The actual contract definitions
    // Each key is a function name in Code.gs
    contracts: {
      
      /************************************************************
       * CONTRACT: getEventsSafe
       * 
       * This is the workhorse of the Admin interface. It powers the
       * dropdown of events with smart caching via ETags. The ETag
       * mechanism is borrowed from HTTP: client sends a hash, server
       * responds with 304 Not Modified if nothing changed.
       * 
       * WHY IMPORTANT:
       * Without this contract, the Admin SWR (stale-while-revalidate)
       * pattern would break. The client relies on the exact structure
       * of the 304 response to know when to skip re-rendering.
       * 
       * MOBILE CONSIDERATION:
       * ETags save bandwidth on mobile. A 304 response is ~200 bytes
       * vs a full response that could be 5-50KB depending on event count.
       ************************************************************/
      getEventsSafe: {
        // Who uses this API?
        consumer: ['Admin.html', 'Test.html'],
        
        // Where is it implemented?
        provider: 'Code.gs::getEventsSafe',
        
        // Human-readable description for documentation
        description: 'Unified events index with ETag caching for bandwidth efficiency',
        
        // What the client sends
        request: {
          params: {
            etag: {
              // Type can be string OR null (first call has no ETag yet)
              type: ['string', 'null'],
              description: 'Optional MD5 hash from previous response - enables conditional requests',
              example: 'a3f2b1c9d8e7f6a5'
            }
          }
        },
        
        // What the server must return
        // This structure is MANDATORY - any deviation breaks the contract
        response: {
          type: 'object',
          
          // These fields MUST be present in every response
          // If any are missing, the contract test will fail
          required: ['ok', 'status', 'etag', 'notModified', 'items'],
          
          properties: {
            // Success flag - always present
            ok: { 
              type: 'boolean',
              description: 'True if operation succeeded, false if error occurred'
            },
            
            // HTTP-style status code
            // 200 = fresh data, 304 = not modified, 500 = error
            status: { 
              type: 'integer', 
              enum: [200, 304, 500],
              description: 'HTTP-style status code indicating result type'
            },
            
            // Hash of the current events list
            // Client will send this back on next request
            etag: { 
              type: 'string', 
              minLength: 8,
              description: 'MD5 hash of lightweight event projection - used for caching'
            },
            
            // Flag indicating if data changed
            // Critical: when true, items array MUST be empty
            notModified: { 
              type: 'boolean',
              description: 'True when status=304, indicates ETag matched'
            },
            
            // Array of events
            // Empty when notModified=true, populated when status=200
            items: {
              type: 'array',
              description: 'Event list - empty on 304, full on 200',
              
              // Each item in the array must match this schema
              items: {
                type: 'object',
                
                // Minimum fields required for each event
                required: ['id', 'name', 'slug', 'startDateISO'],
                
                properties: {
                  // UUID generated during creation
                  id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Unique identifier - never changes'
                  },
                  
                  // Display name (user-provided)
                  name: { 
                    type: 'string', 
                    minLength: 1, 
                    maxLength: 200,
                    description: 'Human-readable event name'
                  },
                  
                  // URL-safe identifier (auto-generated from name)
                  slug: { 
                    type: 'string', 
                    pattern: '^[a-z0-9-]+$',
                    description: 'URL-friendly identifier, lowercase alphanumeric with hyphens'
                  },
                  
                  // ISO 8601 date format: YYYY-MM-DD
                  startDateISO: { 
                    type: 'string', 
                    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                    description: 'Event start date in ISO format'
                  },
                  
                  // Google Sheets ID for event workbook
                  eventSpreadsheetId: { 
                    type: 'string',
                    description: 'Google Sheets ID for dedicated event workbook'
                  },
                  
                  // Full URL to event workbook
                  eventSpreadsheetUrl: { 
                    type: 'string', 
                    format: 'uri',
                    description: 'Direct link to event workbook'
                  },
                  
                  // Google Form ID (optional)
                  formId: { 
                    type: 'string',
                    description: 'Google Form ID for signups - empty if not configured'
                  },
                  
                  // Composite identifier: slug-date-id6
                  eventTag: { 
                    type: 'string',
                    description: 'Human-readable composite tag for display'
                  },
                  
                  // Flag for default event (shown first in UI)
                  isDefault: { 
                    type: 'boolean',
                    description: 'True if this is the default event (one per system)'
                  },
                  
                  // Tournament configuration
                  seedMode: { 
                    type: 'string', 
                    enum: ['random', 'seeded'],
                    description: 'How teams are assigned to brackets'
                  },
                  
                  elimType: { 
                    type: 'string', 
                    enum: ['single', 'double', 'none'],
                    description: 'Tournament elimination type'
                  },
                  
                  // GEO-TAGGING FIELDS (new in v2.0.0)
                  // These enable location-based features like "events near me"
                  
                  latitude: { 
                    type: ['number', 'string'], 
                    minimum: -90, 
                    maximum: 90,
                    description: 'Venue latitude in decimal degrees'
                  },
                  
                  longitude: { 
                    type: ['number', 'string'], 
                    minimum: -180, 
                    maximum: 180,
                    description: 'Venue longitude in decimal degrees'
                  },
                  
                  // Geohash for efficient proximity queries
                  // Precision 7 = ~153m × 153m cell
                  geohash: { 
                    type: 'string', 
                    pattern: '^[0-9a-z]{7}$',
                    description: 'Base32-encoded geohash (precision 7) for proximity search'
                  },
                  
                  venue: { 
                    type: 'string', 
                    maxLength: 200,
                    description: 'Venue name or address'
                  },
                  
                  city: { 
                    type: 'string', 
                    maxLength: 100,
                    description: 'City name for display and search'
                  },
                  
                  state: { 
                    type: 'string', 
                    maxLength: 50,
                    description: 'State/province code or name'
                  },
                  
                  country: { 
                    type: 'string', 
                    pattern: '^[A-Z]{2}$',
                    description: 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)'
                  }
                }
              }
            }
          }
        },
        
        // Test scenarios that verify the contract
        // ContractTests.gs will execute these automatically
        scenarios: [
          {
            name: 'first_call_no_etag',
            description: 'Initial page load with no cached ETag',
            request: { etag: null },
            expect: {
              status: 200,
              notModified: false,
              // Note: itemsNotEmpty is false because fresh install might have no events
              // This is intentional - we test shape, not business state
              itemsNotEmpty: false
            }
          },
          {
            name: 'repeat_with_same_etag',
            description: 'Second call with ETag from previous response',
            request: { etag: '{{previousEtag}}' }, // Template - filled at runtime
            expect: {
              status: 304,
              notModified: true,
              itemsEmpty: true // Critical: 304 responses MUST have empty items
            }
          },
          {
            name: 'invalid_etag',
            description: 'Client sends corrupted or outdated ETag',
            request: { etag: 'invalid-hash-12345' },
            expect: {
              status: 200, // Server treats as cache miss
              notModified: false
            }
          }
        ],
        
        // Performance budgets (mobile-first thinking)
        // These are measured in milliseconds
        performance: {
          // 50th percentile - half of requests should be faster
          p50_ms: 300,
          
          // 95th percentile - acceptable for most users
          p95_ms: 800,
          
          // 99th percentile - edge cases (slow connections)
          p99_ms: 1500,
          
          // Hard timeout - server should fail fast beyond this
          timeout_ms: 5000
        }
      },
      
      /************************************************************
       * CONTRACT: createEventbook
       * 
       * This is the money operation - creating new events. It must
       * be idempotent, meaning calling it twice with the same data
       * should return the existing event, not create a duplicate.
       * 
       * WHY GEO-TAGGING:
       * A mobile-first architect thinks about discovery. Users on phones
       * want to find "tournaments near me." Geo-tagging enables this
       * use case from day one.
       * 
       * WHY SHORTLINKS PRE-GENERATION:
       * We generate shortlinks immediately so QR codes are ready without
       * a manual "repair" step. Mobile users expect instant gratification.
       ************************************************************/
      createEventbook: {
        consumer: ['Admin.html'],
        provider: 'Code.gs::createEventbook',
        description: 'Idempotent event creation with geo-tagging and instant shortlink generation',
        
        request: {
          params: {
            name: { 
              type: 'string', 
              required: true, 
              minLength: 1,
              description: 'Event display name - required'
            },
            
            startDateISO: { 
              type: 'string', 
              required: true, 
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Event start date in YYYY-MM-DD format - required'
            },
            
            seedMode: { 
              type: 'string', 
              enum: ['random', 'seeded'], 
              default: 'random',
              description: 'Bracket seeding strategy - optional, defaults to random'
            },
            
            elimType: { 
              type: 'string', 
              enum: ['single', 'double', 'none'], 
              default: 'none',
              description: 'Tournament elimination type - optional'
            },
            
            // Geo-tagging object (entire thing is optional)
            geo: {
              type: 'object',
              description: 'Location metadata for event discovery - optional but recommended',
              properties: {
                latitude: { 
                  type: 'number', 
                  minimum: -90, 
                  maximum: 90,
                  description: 'Venue latitude - required if geo provided'
                },
                
                longitude: { 
                  type: 'number', 
                  minimum: -180, 
                  maximum: 180,
                  description: 'Venue longitude - required if geo provided'
                },
                
                venue: { 
                  type: 'string', 
                  maxLength: 200,
                  description: 'Human-readable venue name or address'
                },
                
                city: { 
                  type: 'string', 
                  maxLength: 100,
                  description: 'City for display and filtering'
                },
                
                state: { 
                  type: 'string', 
                  maxLength: 50,
                  description: 'State/province'
                },
                
                country: { 
                  type: 'string', 
                  pattern: '^[A-Z]{2}$', 
                  default: 'US',
                  description: 'Two-letter country code'
                }
              }
            }
          }
        },
        
        response: {
          type: 'object',
          required: ['ok', 'phase'],
          properties: {
            ok: { 
              type: 'boolean',
              description: 'Success flag'
            },
            
            id: { 
              type: 'string', 
              format: 'uuid',
              description: 'Newly created (or existing) event UUID'
            },
            
            slug: { 
              type: 'string',
              description: 'URL-safe slug derived from name'
            },
            
            tag: { 
              type: 'string',
              description: 'Composite event tag (slug-date-id6)'
            },
            
            ssId: { 
              type: 'string',
              description: 'Google Sheets ID for event workbook'
            },
            
            ssUrl: { 
              type: 'string', 
              format: 'uri',
              description: 'Direct URL to event workbook'
            },
            
            // Critical field for idempotency detection
            idempotent: { 
              type: 'boolean',
              description: 'True if event already existed (idempotent create)'
            },
            
            // Lifecycle phase indicator
            phase: { 
              type: 'string', 
              enum: ['validate', 'done', 'error'],
              description: 'Which phase the operation reached'
            },
            
            ms: { 
              type: 'number',
              description: 'Operation duration in milliseconds'
            },
            
            // New in v2.0: shortlinks ready immediately
            shortlinksReady: { 
              type: 'boolean',
              description: 'True if standard shortlinks were pre-generated'
            },
            
            // Geo data echoed back if provided
            geo: {
              type: ['object', 'null'],
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                geohash: { 
                  type: 'string',
                  description: 'Computed geohash for proximity queries'
                },
                venue: { type: 'string' },
                city: { type: 'string' }
              }
            },
            
            error: { 
              type: 'string',
              description: 'Error message if ok=false'
            }
          }
        },
        
        scenarios: [
          {
            name: 'create_new_event',
            description: 'Happy path - create event with minimal data',
            request: {
              name: 'Test Tournament',
              startDateISO: '2025-06-15',
              seedMode: 'random',
              elimType: 'single'
            },
            expect: {
              ok: true,
              idempotent: false, // First time, not a duplicate
              shortlinksReady: true, // v2.0 feature
              phase: 'done'
            }
          },
          {
            name: 'create_with_geo',
            description: 'Create event with full geo-tagging',
            request: {
              name: 'Chicago Bocce League',
              startDateISO: '2025-07-04',
              geo: {
                latitude: 41.8781,
                longitude: -87.6298,
                venue: 'Midway Plaisance Park',
                city: 'Chicago',
                state: 'IL',
                country: 'US'
              }
            },
            expect: {
              ok: true,
              geoPresent: true // Custom validator checks geo object exists
            }
          },
          {
            name: 'duplicate_create',
            description: 'Idempotency test - same request twice',
            request: '{{previous_request}}', // Reuse previous request
            expect: {
              ok: true,
              idempotent: true // Second time, should return existing
            }
          }
        ],
        
        // Performance budgets
        // Creating events is expensive (workbook copy, shortlink generation)
        // so we allow more time than read operations
        performance: {
          p50_ms: 2000,  // 2 seconds for median case
          p95_ms: 4000,  // 4 seconds acceptable
          p99_ms: 6000,  // 6 seconds for worst case (large template)
          timeout_ms: 10000 // Hard fail at 10 seconds
        }
      },
      
      /************************************************************
       * CONTRACT: findEventsNearby
       * 
       * This is pure mobile-first thinking. Desktop users might browse
       * a list, but mobile users want "show me what's close to me."
       * 
       * HAVERSINE DISTANCE:
       * We calculate great-circle distance using the haversine formula.
       * It's not perfectly accurate (Earth isn't a perfect sphere) but
       * it's fast and accurate enough for "events within 50km."
       * 
       * WHY BOTH KM AND MILES:
       * Different countries use different units. A good mobile app
       * detects locale and shows the right unit without the user asking.
       ************************************************************/
      findEventsNearby: {
        consumer: ['Mobile PWA', 'Public.html'],
        provider: 'Code.gs::findEventsNearby',
        description: 'Geo-proximity search for event discovery - critical for mobile UX',
        
        request: {
          params: {
            latitude: { 
              type: 'number', 
              required: true, 
              minimum: -90, 
              maximum: 90,
              description: 'User current latitude from GPS'
            },
            
            longitude: { 
              type: 'number', 
              required: true, 
              minimum: -180, 
              maximum: 180,
              description: 'User current longitude from GPS'
            },
            
            radius: { 
              type: 'number', 
              default: 50, 
              minimum: 1, 
              maximum: 500,
              description: 'Search radius in kilometers - defaults to 50km'
            },
            
            limit: { 
              type: 'integer', 
              default: 20, 
              minimum: 1, 
              maximum: 100,
              description: 'Maximum results to return - prevents huge responses on mobile'
            }
          }
        },
        
        response: {
          type: 'object',
          required: ['ok', 'query', 'count', 'items'],
          properties: {
            ok: { type: 'boolean' },
            
            // Echo back the query parameters
            // Helps client debug and cache results
            query: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                radiusKm: { type: 'number' }
              }
            },
            
            count: { 
              type: 'integer', 
              minimum: 0,
              description: 'Number of events found within radius'
            },
            
            items: {
              type: 'array',
              description: 'Events sorted by distance (closest first)',
              items: {
                type: 'object',
                required: ['id', 'name', 'distanceKm', 'distanceMiles'],
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  startDateISO: { type: 'string' },
                  venue: { type: 'string' },
                  city: { type: 'string' },
                  state: { type: 'string' },
                  
                  // Critical: both units for internationalization
                  distanceKm: { 
                    type: 'number', 
                    minimum: 0,
                    description: 'Distance in kilometers (1 decimal place)'
                  },
                  
                  distanceMiles: { 
                    type: 'number', 
                    minimum: 0,
                    description: 'Distance in miles (1 decimal place)'
                  },
                  
                  geohash: { 
                    type: 'string',
                    description: 'Event geohash for map clustering'
                  },
                  
                  publicUrl: { 
                    type: 'string', 
                    format: 'uri',
                    description: 'Direct link to event public page'
                  }
                }
              }
            }
          }
        },
        
        scenarios: [
          {
            name: 'find_nearby_chicago',
            description: 'Search from downtown Chicago',
            request: {
              latitude: 41.8781,
              longitude: -87.6298,
              radius: 50,
              limit: 20
            },
            expect: {
              ok: true,
              itemsSortedByDistance: true // Custom validator
            }
          },
          {
            name: 'no_events_nearby',
            description: 'Search in middle of ocean (edge case)',
            request: {
              latitude: 0,
              longitude: 0,
              radius: 10
            },
            expect: {
              ok: true,
              count: 0,
              itemsEmpty: true
            }
          }
        ],
        
        // Performance: geo queries can be expensive
        // We're doing haversine distance calculation in JavaScript
        // (not ideal, but Apps Script doesn't have PostGIS)
        performance: {
          p50_ms: 400,
          p95_ms: 1000,
          p99_ms: 2000,
          timeout_ms: 5000
        }
      },
      
      /************************************************************
       * CONTRACT: getPublicBundleMobile
       * 
       * This is where mobile-first architecture shines. We detect
       * the user's connection speed (2G, 3G, 4G, WiFi) and adapt
       * the response size accordingly.
       * 
       * ADAPTIVE LOADING:
       * - 2G: Send 10 standings, 10 schedule items (~2KB)
       * - 4G: Send 50 items (~10KB)
       * - WiFi: Send 100 items (~20KB)
       * 
       * This prevents the "loading forever" experience on slow
       * connections while maximizing data for fast connections.
       * 
       * PROXIMITY CALCULATION:
       * If the user shares their location, we calculate distance
       * to the event venue. Useful for "how far is this from me?"
       ************************************************************/
      getPublicBundleMobile: {
        consumer: ['Public.html', 'Mobile PWA'],
        provider: 'Code.gs::getPublicBundleMobile',
        description: 'Mobile-optimized bundle with adaptive response sizing based on connection speed',
        
        request: {
          params: {
            eventIdOrSlug: { 
              type: 'string', 
              required: true,
              description: 'Event UUID or slug'
            },
            
            // Connection type from Network Information API
            // See: https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
            connection: { 
              type: 'string', 
              enum: ['slow-2g', '2g', '3g', '4g', 'wifi', 'unknown'],
              default: 'unknown',
              description: 'Effective connection type from navigator.connection.effectiveType'
            },
            
            offset: { 
              type: 'integer', 
              default: 0, 
              minimum: 0,
              description: 'Pagination offset for infinite scroll'
            },
            
            // Optional: user location for proximity calculation
            userLat: { 
              type: 'number', 
              minimum: -90, 
              maximum: 90,
              description: 'User latitude for distance calculation'
            },
            
            userLon: { 
              type: 'number', 
              minimum: -180, 
              maximum: 180,
              description: 'User longitude for distance calculation'
            }
          }
        },
        
        response: {
          type: 'object',
          required: ['ok', 'standings', 'schedule', 'pagination'],
          properties: {
            ok: { type: 'boolean' },
            eventTag: { type: 'string' },
            title: { type: 'string' },
            datePretty: { 
              type: 'string',
              description: 'Human-readable date like "Fri, Oct 15 — 7:00PM"'
            },
            place: { type: 'string' },
            
            // Privacy mode for public display
            public_name_mode: { 
              type: 'string', 
              enum: ['full', 'initials', 'none'],
              description: 'How names are displayed: full="John Smith", initials="JS", none="—"'
            },
            
            standings: { 
              type: 'array',
              description: 'Standings table rows (size varies by connection)'
            },
            
            schedule: { 
              type: 'array',
              description: 'Schedule table rows (size varies by connection)'
            },
            
            // Geo data if event is geo-tagged
            geo: {
              type: ['object', 'null'],
              properties: {
                venue: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                geohash: { type: 'string' },
                plusCode: { 
                  type: 'string',
                  description: 'Google Plus Code for map links'
                },
                
                // Proximity only if user shared location
                proximity: {
                  type: ['object', 'null'],
                  properties: {
                    distanceKm: { type: 'number' },
                    distanceMiles: { type: 'number' }
                  }
                }
              }
            },
            
            // Pagination metadata for infinite scroll
            pagination: {
              type: 'object',
              required: ['limit', 'offset', 'hasMore'],
              properties: {
                limit: { 
                  type: 'integer',
                  description: 'Items in this response (varies by connection)'
                },
                offset: { type: 'integer' },
                totalStandings: { type: 'integer' },
                totalSchedule: { type: 'integer' },
                hasMore: { 
                  type: 'boolean',
                  description: 'True if more data available (user can scroll)'
                }
              }
            },
            
            // Debug metadata (not for UI display)
            _meta: {
              type: 'object',
              properties: {
                connection: { type: 'string' },
                sizeBytes: { 
                  type: 'integer',
                  description: 'Approximate response size for monitoring'
                }
              }
            }
          }
        },
        
        scenarios: [
          {
            name: 'mobile_2g_connection',
            description: 'Slow connection - minimal data',
            request: {
              eventIdOrSlug: 'mock:event-1',
              connection: '2g'
            },
            expect: {
              ok: true,
              'pagination.limit': 10, // Small limit for 2G
              '_meta.sizeBytes': '< 5000' // Under 5KB
            }
          },
          {
            name: 'wifi_connection',
            description: 'Fast connection - full data',
            request: {
              eventIdOrSlug: 'mock:event-1',
              connection: 'wifi'
            },
            expect: {
              ok: true,
              'pagination.limit': 100 // Large limit for WiFi
            }
          },
          {
            name: 'with_user_location',
            description: 'User shared location - calculate proximity',
            request: {
              eventIdOrSlug: 'mock:event-1',
              userLat: 41.8781,
              userLon: -87.6298
            },
            expect: {
              ok: true,
              geoProximityPresent: true // Custom validator
            }
          }
        ],
        
        performance: {
          p50_ms: 500,
          p95_ms: 1200,
          p99_ms: 2000,
          timeout_ms: 5000
        }
      }
      
    } // end contracts object
  }; // end return
}


/************************************************************
* ALTERNATIVE STORAGE OPTIONS
* 
* The function above embeds contracts directly in code. This
* works well for small teams. For larger organizations, you
* might want external storage:
************************************************************/

/**
 * Option 2: Load contracts from Google Sheet
 * 
 * Useful when non-technical team members need to edit contracts.
 * Store in Control spreadsheet → "Contracts" sheet.
 * 
 * Sheet structure:
 *   | contractName | version | schema (JSON) | scenarios (JSON) |
 *   | getEventsSafe | 2.0.0  | {...}         | [...]            |
 */
function getContractDefinitionsFromSheet() {
  try {
    const ss = SpreadsheetApp.openById(cfgControlId_());
    let sh = ss.getSheetByName('Contracts');
    
    if (!sh) {
      // Sheet doesn't exist yet - fall back to embedded
      Logger.log('Contracts sheet not found, using embedded definitions');
      return getContractDefinitions();
    }
    
    const lastRow = sh.getLastRow();
    if (lastRow < 2) {
      // Sheet exists but has no data
      Logger.log('Contracts sheet empty, using embedded definitions');
      return getContractDefinitions();
    }
    
    // Read all rows (skip header)
    const data = sh.getRange(2, 1, lastRow - 1, 4).getValues();
    const contracts = {};
    
    for (const row of data) {
      const [name, version, schemaJson, scenariosJson] = row;
      if (!name) continue; // Skip empty rows
      
      try {
        contracts[name] = {
          version,
          response: JSON.parse(schemaJson || '{}'),
          scenarios: JSON.parse(scenariosJson || '[]')
        };
      } catch (e) {
        Logger.log(`Error parsing contract ${name}: ${e}`);
        // Skip this contract but continue with others
      }
    }
    
    return { 
      version: '2.0.0-sheet', 
      source: 'Google Sheets',
      contracts 
    };
    
  } catch (e) {
    Logger.log(`Error loading contracts from sheet: ${e}`);
    // Fall back to embedded definitions
    return getContractDefinitions();
  }
}


/**
 * Option 3: Load contracts from GitHub
 * 
 * Best for teams using Git for version control. Contracts live
 * in your GitHub repo as JSON, and we fetch them at runtime.
 * 
 * Setup:
 * 1. Create contracts/api-contracts.json in your GitHub repo
 * 2. Set script property: CONTRACT_GITHUB_URL
 * 3. This function fetches and caches for 1 hour
 */
function getContractDefinitionsFromGitHub() {
  // Get GitHub URL from script properties
  const githubUrl = PropertiesService.getScriptProperties()
    .getProperty('CONTRACT_GITHUB_URL');
  
  if (!githubUrl) {
    Logger.log('CONTRACT_GITHUB_URL not configured, using embedded definitions');
    return getContractDefinitions();
  }
  
  const CACHE_KEY = 'CONTRACT_DEFINITIONS_GITHUB';
  const CACHE_TTL = 3600; // 1 hour in seconds
  
  try {
    // Check cache first (avoid hitting GitHub on every test run)
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      Logger.log('Using cached GitHub contracts');
      return JSON.parse(cached);
    }
    
    Logger.log(`Fetching contracts from GitHub: ${githubUrl}`);
    
    // Fetch from GitHub raw URL
    const response = UrlFetchApp.fetch(githubUrl, {
      muteHttpExceptions: true,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NextUp-ContractTests/2.0'
      }
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`GitHub returned ${response.getResponseCode()}`);
    }
    
    const contracts = JSON.parse(response.getContentText());
    
    // Cache for 1 hour to avoid rate limits
    cache.put(CACHE_KEY, JSON.stringify(contracts), CACHE_TTL);
    
    Logger.log('GitHub contracts fetched and cached');
    return contracts;
    
  } catch (e) {
    Logger.log(`Error loading contracts from GitHub: ${e}`);
    Logger.log('Falling back to embedded definitions');
    return getContractDefinitions();
  }
}


/**
 * Smart loader with fallback chain
 * 
 * Tries multiple sources in order:
 * 1. GitHub (if configured)
 * 2. Google Sheet (if exists)
 * 3. Embedded definitions (always works)
 * 
 * This gives you flexibility: start with embedded, migrate to
 * Sheet when non-devs need to edit, then migrate to GitHub when
 * you have CI/CD pipeline.
 */
function loadContractsWithFallback() {
  // Try GitHub first (if URL configured)
  const githubUrl = PropertiesService.getScriptProperties()
    .getProperty('CONTRACT_GITHUB_URL');
  
  if (githubUrl) {
    try {
      Logger.log('Attempting GitHub load...');
      const contracts = getContractDefinitionsFromGitHub();
      if (contracts.contracts && Object.keys(contracts.contracts).length > 0) {
        Logger.log('✓ Loaded from GitHub');
        return contracts;
      }
    } catch (e) {
      Logger.log('GitHub load failed, trying sheet...');
    }
  }
  
  // Try sheet second
  try {
    Logger.log('Attempting Sheet load...');
    const sheetContracts = getContractDefinitionsFromSheet();
    if (sheetContracts.contracts && Object.keys(sheetContracts.contracts).length > 0) {
      Logger.log('✓ Loaded from Sheet');
      return sheetContracts;
    }
  } catch (e) {
    Logger.log('Sheet load failed, using embedded...');
  }
  
  // Fall back to embedded (always works)
  Logger.log('✓ Loaded from embedded definitions');
  return getContractDefinitions();
}


/**
 * Helper: Export embedded contracts to Sheet
 * 
 * Run this once to populate the Contracts sheet from the embedded
 * definitions. After that, you can edit in the sheet.
 * 
 * Usage in Apps Script:
 *   Run > exportContractsToSheet
 */
function exportContractsToSheet() {
  const contracts = getContractDefinitions();
  const ss = SpreadsheetApp.openById(cfgControlId_());
  
  // Delete old sheet if exists
  let sh = ss.getSheetByName('Contracts');
  if (sh) {
    ss.deleteSheet(sh);
  }
  
  // Create fresh sheet
  sh = ss.insertSheet('Contracts');
  
  // Header row
  sh.getRange(1, 1, 1, 4)
    .setValues([['contractName', 'version', 'schema', 'scenarios']])
    .setFontWeight('bold')
    .setBackground('#f3f6fb');
  sh.setFrozenRows(1);
  
  // Data rows
  const rows = [];
  for (const [name, contract] of Object.entries(contracts.contracts)) {
    rows.push([
      name,
      contracts.version,
      JSON.stringify(contract.response, null, 2), // Pretty JSON
      JSON.stringify(contract.scenarios, null, 2)
    ]);
  }
  
  sh.getRange(2, 1, rows.length, 4).setValues(rows);
  
  // Formatting
  sh.autoResizeColumns(1, 2);
  sh.setColumnWidth(3, 400); // Wide for JSON
  sh.setColumnWidth(4, 400);
  
  Logger.log(`✓ Exported ${rows.length} contracts to sheet`);
  return { ok: true, count: rows.length };
}