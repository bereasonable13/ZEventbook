# Entity Architecture - Single Source of Truth

## ❌ WRONG: Duplication
```
Config.gs: entities: [{id: 'ABC-Leagues', ...}]
Code.gs:   const entities = ['ABC-Leagues', ...]  // DUPLICATE!
```

## ✅ RIGHT: Single Source
```
Config.gs: entities: [{id: 'ABC-Leagues', ...}]
Code.gs:   const entities = CONFIG.BRANDS[brand].entities  // READ ONLY!
```

---

## 📊 CURRENT STATE CHECK

**Config.gs (Configuration Layer):**
- BRANDS object with entities
- DOMAIN_TO_BRAND mappings
- Brand colors, logos, features

**Code.gs (Business Logic Layer):**
- Validates entity exists in CONFIG.BRANDS[brand].entities
- Never duplicates entity definitions
- Reads from CONFIG

**Frontend (Presentation Layer):**
- Calls NU.getConfig() to get entities
- Populates dropdown from config
- Never hardcodes entities

---

## ✅ CORRECT DATA FLOW
```
Config.gs (DEFINE)
    ↓
    entities: [...]
    ↓
Code.gs (VALIDATE)
    ↓
    const validEntities = CONFIG.BRANDS[brand].entities
    if (!validEntities.includes(data.entity)) { error }
    ↓
Frontend (DISPLAY)
    ↓
    NU.getConfig() → config.BRANDS[brand].entities
    ↓
    Populate dropdown
```

---

## 🔍 VERIFY NO DUPLICATION

Let me check if Code.gs has any hardcoded entities...
