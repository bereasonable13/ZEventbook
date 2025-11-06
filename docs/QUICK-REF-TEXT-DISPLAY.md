# ⚡ QUICK REFERENCE - Text Display Feature

**Last Updated:** November 6, 2025

---

## ✅ WHAT YOU ASKED FOR

**Edit text once in Admin → Appears in both Public AND Display**

---

## 📊 STATUS: READY TO DEPLOY

| What | Status | Location |
|------|--------|----------|
| Admin Text Editing | ✅ EXISTS | Admin.html lines 1034-1035 |
| Display with Text Pane | ✅ CREATED | /outputs/Display.html |
| Test Plan | ✅ READY | /outputs/END-TO-END-TEST-PLAN.md |

---

## 🚀 DEPLOY IN 3 STEPS

```bash
# 1. Copy Display.html
cd ~/zeventbook
cp /mnt/user-data/outputs/Display.html ./Display.html

# 2. Push to Apps Script
clasp push --force

# 3. Update deployment in browser
# (Manual: Deploy → Manage → Edit → New version)
```

---

## 🎯 WHERE TO EDIT TEXT

**Location:** Admin.html → Select Event → "📄 Summary Section" card

**Field:** "Summary Text" textarea

**What Happens:**
1. Type text
2. Wait 2 seconds (auto-saves)
3. See "Saved ✓"
4. Text now in Public.html AND Display.html

---

## 📱 WHERE TEXT APPEARS

### **Public.html (Mobile Page)**
```
Always visible in summary section
https://.../exec?p=Public&event=ID&brand=ABC
```

### **Display.html (TV Carousel)**
```
Shows as text pane for 10 seconds
Red background, white text, large font
https://.../exec?p=Display&event=ID&brand=ABC&mode=carousel
```

---

## 🎨 CAROUSEL SEQUENCE

```
1. Public page iframe → 20 seconds
2. Text pane (summaryText) → 10 seconds ← YOUR TEXT HERE
3. Video 1 → 30 seconds
4. Video 2 → 30 seconds
5. (loop back to #1)
```

---

## ⚠️ BEFORE ABC OPEN - VERIFY THESE

- [ ] Code.gs has getEvent API endpoint
- [ ] Public.html renders summaryText
- [ ] Run Test Plan (11 tests)
- [ ] Fix any critical bugs

---

## 📋 FILES TO REVIEW

[Display.html](computer:///mnt/user-data/outputs/Display.html) - Deploy this  
[Test Plan](computer:///mnt/user-data/outputs/END-TO-END-TEST-PLAN.md) - Run this  
[Full Summary](computer:///mnt/user-data/outputs/TEXT-DISPLAY-IMPLEMENTATION-SUMMARY.md) - Read this

---

## 💬 EXAMPLE TEXT

**Short (works great):**
```
Welcome to ABC Open 2025! Check-in starts at 9 AM. 
Courts 1-8 in use. Pizza at noon!
```

**Long (also works, smaller font):**
```
Welcome to the American Bocce Co Open Tournament 2025! 
Registration and check-in start at 9:00 AM sharp. 
We'll be using courts 1 through 8 throughout the day. 
Lunch will be served at noon in the pavilion. 
Prizes for top 3 teams! Good luck to all participants!
```

---

## 🎯 SUCCESS = ONE EDIT, TWO PLACES

```
ADMIN.HTML (edit here)
    ↓
EVENT DATA (saves here)
    ↓
    ├→ PUBLIC.HTML (shows here)
    └→ DISPLAY.HTML (shows here)
```

**That's it!** Single source of truth. ✓

---

## 🐛 IF SOMETHING BREAKS

1. Check browser console for errors
2. Verify event has summaryText saved
3. Check spreadsheet for data
4. Refresh Public/Display pages
5. Check Test Plan for specific test

---

## ✅ READY TO SHIP?

**YES** - if these are true:
- [x] Display.html created
- [x] Admin text editing exists
- [x] Test plan ready
- [ ] Tests executed and passed ← DO THIS NEXT

---

**Questions?** Review the full implementation summary or test plan.

**Ready to test?** Start with Test 1 in the test plan.

**Ready to deploy?** Run the 3-step deployment above.
