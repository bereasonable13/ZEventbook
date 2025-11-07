# 📍 NextUp - ACTUAL URLs (Data-Driven)
**Generated from live code analysis - November 6, 2025**

---

## 🌐 BASE DEPLOYMENT URL
```
https://script.google.com/macros/s/AKfycbzxPOs9IgA-vQ0Yfw3iGYqEdGPQwrgCDvhkrEMk51m2JCZmRfhbbdNARGed-UpB8LJD0g/exec
```

**Script ID:** `1KttRXT0Sq2663irNS0FlUi3mMkHL9QisErtY4pAqwtqPKH2ZuS7y_Upe`

---

## ✅ PAGES THAT ACTUALLY EXIST

These HTML files exist in the deployment and are routed by `doGet()`:

| Page | File | Purpose | URL Parameter |
|------|------|---------|---------------|
| Admin | Admin.html | Create/manage events | `?p=admin` or `?p=Admin` |
| Public | Public.html | Mobile event page for attendees | `?p=public&event={ID}` |
| Display | Display.html | TV/projector carousel | `?p=display&event={ID}&mode=carousel` |
| Poster | Poster.html | Printable poster with QR codes | `?p=poster&event={ID}` |
| ConfigAdmin | ConfigAdmin.html | View system configuration | `?p=configadmin` |
| HealthCheck | HealthCheck.html | System health monitoring | `?p=healthcheck` |
| Test | Test.html | Run verification suite | `?p=test` |

**Note:** URLs are case-insensitive:
- `?p=admin` = `?p=Admin` = `?p=ADMIN`
- `?p=public` = `?p=Public` = `?p=PUBLIC`

---

## 🔧 ACTUAL BACKEND API

These functions exist in Code.gs and can be called via `NU.rpc()`:

### Event Management
```javascript
NU.rpc('clientCreateEvent', brand, entity, eventName, eventDate, eventTime, 
       location, summaryText, summaryLink, summaryImage, videoURLs, 
       bioImage, bioText, bioLink, showSummaryImage, showVideos, showBio, showMetrics)

NU.rpc('clientSetupEventTracking', eventId)

NU.rpc('clientGetEvents', brand)

NU.rpc('clientGetEventCounts', eventId)
```

### Configuration
```javascript
NU.getConfig()  // Returns CONFIG object with BRANDS, DOMAIN_TO_BRAND, VERSION

NU.rpc('clientGetBrands')

NU.rpc('clientGetBrandConfig', brand)
```

### Content Updates
```javascript
NU.rpc('clientUpdateEventDetails', eventId, updates)

NU.rpc('clientUpdateEventContent', eventId, content)

NU.rpc('clientUpdatePublicConfig', eventId, config)

NU.rpc('clientUpdateDisplayConfig', eventId, displayConfig)

NU.rpc('clientUpdatePosterData', eventId, posterData)

NU.rpc('clientGetPosterData', eventId)
```

### Utilities
```javascript
NU.rpc('clientGetEventJSONUrl', eventId)

NU.rpc('clientManualExportNow')
```

---

## 🏢 ACTUAL DOMAIN MAPPINGS

Configured in `Config.gs` → `DOMAIN_TO_BRAND`:
```javascript
"abc.zeventbooks.io" → Brand: ABC
"events.zeventbooks.io" → Brand: ABC
"zeventbooks.io" → Brand: ABC
```

**Brand Detection Priority:**
1. `?brand=ABC` URL parameter (highest)
2. Domain mapping (above)
3. Default: ABC

---

## 📊 COMPLETE URL EXAMPLES

### Admin Page
```
# Default (ABC brand auto-detected)
https://.../exec?p=admin

# Explicit brand
https://.../exec?p=admin&brand=ABC

# Case variations (all work)
?p=admin
?p=Admin  
?p=ADMIN
```

### Public Event Page
```
# Required: event ID
https://.../exec?p=public&event=abc-open-2025&brand=ABC

# Case insensitive
?p=public&event=abc-open-2025
?p=Public&event=abc-open-2025
```

### Display Carousel
```
# Carousel mode (default)
https://.../exec?p=display&event=abc-open-2025&brand=ABC&mode=carousel

# Static mode (no rotation)
https://.../exec?p=display&event=abc-open-2025&brand=ABC&mode=static
```

### Poster
```
https://.../exec?p=poster&event=abc-open-2025&brand=ABC
```

### System Pages
```
# Configuration viewer
https://.../exec?p=configadmin

# Health check
https://.../exec?p=healthcheck

# Test suite
https://.../exec?p=test
```

---

## 🎯 NUSDK CLIENT SDK

Every page includes NUSDK.html which provides:
```javascript
// Backend communication
NU.rpc(functionName, ...args)

// UI feedback  
NU.toast(message, type)  // type: success, error, warning, info
NU.loading.show(message)
NU.loading.hide()

// Error handling
NU.handleError(error, context, showToast)

// Brand detection
NU.getBrand()  // Returns: 'ABC'
NU.getConfig()  // Returns: {VERSION, BRANDS, DOMAIN_TO_BRAND, DEFAULT_BRAND}
NU.getBrandConfig(brandId)  // Returns: brand object with entities, colors, etc

// Logging
NU.info(where, msg, data)
NU.warn(where, msg, data)
NU.error(where, msg, data)
```

---

## ✅ VERIFIED WORKING

Based on code analysis, these features are IMPLEMENTED:

- ✅ Case-insensitive page URLs
- ✅ getConfig() function exists (line 1194)
- ✅ NUSDK auto-injects toast + loading overlay
- ✅ Entity validation in backend
- ✅ Brand detection from domain
- ✅ Error handling with NU.handleError()
- ✅ Retry logic with rate limiting

---

## ⚠️ NOT YET VERIFIED

These need manual testing:

- ⏸️ Admin entity dropdown population (needs browser test)
- ⏸️ Event creation end-to-end flow
- ⏸️ Toast notifications display
- ⏸️ Display carousel auto-rotation
- ⏸️ Public page loads event data
- ⏸️ Domain detection works on abc.zeventbooks.io

---

## 🧪 NEXT: MANUAL TESTING

**Test URLs (replace {BASE}):**

1. Admin: `{BASE}?p=admin`
   - Open in browser
   - Check console for `[NU]` messages
   - Verify entity dropdown populates

2. Health Check: `{BASE}?p=healthcheck`
   - Should show system status

3. Config: `{BASE}?p=configadmin`
   - Should show brands, entities, domains

4. Test Suite: `{BASE}?p=test`
   - Click "Run Full Verification"

---

**Base URL for testing:**
```
https://script.google.com/macros/s/AKfycbzxPOs9IgA-vQ0Yfw3iGYqEdGPQwrgCDvhkrEMk51m2JCZmRfhbbdNARGed-UpB8LJD0g/exec
```

