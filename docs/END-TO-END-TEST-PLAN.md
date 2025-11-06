# 🧪 END-TO-END TEST PLAN
## Text Editing → Public.html → Display.html Flow

**Date:** November 6, 2025  
**Purpose:** Verify that text edited in Admin.html appears correctly in both Public.html and Display.html  
**Tester:** Matt / ABC Staff  

---

## 📋 PRE-TEST SETUP

### **1. Deploy All Files**
```bash
cd ~/zeventbook

# Apply updates
cp /mnt/user-data/outputs/Admin.html.FLOW-FIX ./Admin.html
cp /mnt/user-data/outputs/Display.html ./Display.html

# Push to Apps Script
clasp push --force

# Update deployment
# (Manual step in browser - update version)
```

### **2. Create Test Event**
```
Event Name: "Text Display Test"
Event Date: Tomorrow
Location: "Test Venue"
(Leave other fields empty for now)
```

### **3. Setup Tracking**
```
Click: Setup Tracking
Wait: 15-20 seconds
Verify: 4 form cards appear
```

---

## 🎯 TEST SUITE

---

### **TEST 1: Edit Text in Admin.html**

**Objective:** Verify text can be edited and saved in Admin interface

**Steps:**
1. Open Admin.html
2. Select event: "Text Display Test"
3. Scroll to: "📄 Summary Section" card
4. Find: "Summary Text" textarea
5. Type: "Welcome to the Text Display Test! This message should appear on both Public and Display pages."
6. Wait: 2-3 seconds (auto-save debounce)
7. Look for: "Saved ✓" indicator

**Expected Results:**
- ✅ Text can be typed into textarea
- ✅ "Saving..." appears after typing stops
- ✅ "Saved ✓" appears after ~2 seconds
- ✅ No error messages

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Notes:**
```
[Note any issues here]
```

---

### **TEST 2: Verify Data Saved to Spreadsheet**

**Objective:** Confirm text persists in backend storage

**Steps:**
1. Open Google Sheets: zeventbook-events-ABC
2. Find row: "Text Display Test"
3. Find column: "summaryText" (should be column M or N)
4. Read value

**Expected Results:**
- ✅ Row exists for "Text Display Test"
- ✅ summaryText column contains: "Welcome to the Text Display Test! This message should appear on both Public and Display pages."
- ✅ Text matches exactly what was typed

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Notes:**
```
[Note any issues here]
```

---

### **TEST 3: Text Appears on Public.html**

**Objective:** Verify text displays on mobile-friendly public page

**Steps:**
1. Copy Public page URL from Admin
   - In "🔗 Links" card, find "Public" link
   - Or construct: `{DEPLOYMENT_URL}?p=Public&event={EVENT_ID}&brand=ABC`
2. Open URL on mobile phone (or mobile emulator)
3. Look for summary text section

**Expected Results:**
- ✅ Public page loads without errors
- ✅ Event name displayed: "Text Display Test"
- ✅ Summary text displayed: "Welcome to the Text Display Test! This message should appear on both Public and Display pages."
- ✅ Text is readable and properly formatted
- ✅ No blank sections or missing content

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Screenshot:**
```
[Attach screenshot of Public page showing text]
```

**Notes:**
```
[Note any issues here]
```

---

### **TEST 4: Text Appears on Display.html (Static Mode)**

**Objective:** Verify text displays when Display is in static/public mode

**Steps:**
1. Construct Display URL:
   ```
   {DEPLOYMENT_URL}?p=Display&event={EVENT_ID}&brand=ABC&mode=static
   ```
2. Open URL on large screen/TV (or desktop browser full screen)
3. Wait for page to load

**Expected Results:**
- ✅ Display page loads without errors
- ✅ Shows Public page in full-screen iframe
- ✅ Summary text visible: "Welcome to the Text Display Test! This message should appear on both Public and Display pages."
- ✅ No scrollbars or layout issues
- ✅ Text is large enough to read from distance

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Screenshot:**
```
[Attach screenshot of Display in static mode]
```

**Notes:**
```
[Note any issues here]
```

---

### **TEST 5: Text Appears on Display.html (Carousel Mode)**

**Objective:** Verify text pane displays correctly in carousel rotation

**Steps:**
1. Construct Display URL:
   ```
   {DEPLOYMENT_URL}?p=Display&event={EVENT_ID}&brand=ABC&mode=carousel
   ```
2. Open URL on large screen/TV (or desktop browser full screen)
3. Wait for carousel to cycle through items
4. Observe for at least 90 seconds (to see full rotation)

**Expected Results:**
- ✅ Display page loads without errors
- ✅ Carousel starts automatically
- ✅ First item: Public page iframe (20 seconds)
- ✅ Second item: Text pane with red gradient background (10 seconds)
  - Text reads: "Welcome to the Text Display Test! This message should appear on both Public and Display pages."
  - Text is white, large (48-56px), centered
  - Background is red gradient (#C8102E)
- ✅ Carousel loops back to Public page
- ✅ No flickering or loading delays between transitions
- ✅ Text is readable from 10+ feet away

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Screenshot:**
```
[Attach screenshot of text pane in carousel]
```

**Timing Verification:**
- Public page duration: _____ seconds (expected: 20)
- Text pane duration: _____ seconds (expected: 10)
- Total cycle time: _____ seconds (expected: 30+ depending on videos)

**Notes:**
```
[Note any issues here]
```

---

### **TEST 6: Update Text and Verify Changes Propagate**

**Objective:** Confirm updates in Admin reflect in Public and Display

**Steps:**
1. Return to Admin.html
2. Select event: "Text Display Test"
3. Go to: Summary Section card
4. Change text to: "UPDATED: This text has been changed to verify real-time updates work correctly."
5. Wait for "Saved ✓"
6. Refresh Public.html (mobile)
7. Refresh Display.html (TV/desktop)
8. Verify new text appears

**Expected Results:**
- ✅ Text saves successfully in Admin
- ✅ Public page shows UPDATED text after refresh
- ✅ Display static mode shows UPDATED text after refresh
- ✅ Display carousel shows UPDATED text in text pane after refresh
- ✅ Changes propagate within 5 seconds of save

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Notes:**
```
[Note any issues here]
```

---

### **TEST 7: Long Text Handling**

**Objective:** Verify long text adapts font size appropriately

**Steps:**
1. In Admin.html Summary Section
2. Enter very long text (300+ characters):
   ```
   This is a very long summary text designed to test the adaptive font sizing feature in the display carousel. When text exceeds certain length thresholds, the font size should automatically decrease to ensure all content remains visible on screen without scrolling. This text should be displayed at a smaller font size (32px) compared to shorter messages, but should still remain readable from a reasonable viewing distance.
   ```
3. Save and verify on Display carousel

**Expected Results:**
- ✅ Long text saves successfully
- ✅ Text pane shows all text (no truncation)
- ✅ Font size reduced automatically (32px for very long text)
- ✅ Text remains readable
- ✅ No overflow or scrollbars

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Screenshot:**
```
[Attach screenshot showing long text handling]
```

**Notes:**
```
[Note any issues here]
```

---

### **TEST 8: Empty Text Handling**

**Objective:** Verify system handles missing/empty summary text gracefully

**Steps:**
1. In Admin.html Summary Section
2. Clear all text (make it empty)
3. Save
4. Check Public.html
5. Check Display.html carousel

**Expected Results:**
- ✅ Empty text saves without error
- ✅ Public page: Summary section either hidden or shows default message
- ✅ Display carousel: Text pane is SKIPPED (not shown in rotation)
- ✅ Carousel shows: Public page → (skip text) → Videos (if any)
- ✅ No blank/empty screens in carousel

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Notes:**
```
[Note any issues here]
```

---

### **TEST 9: Special Characters Handling**

**Objective:** Verify text with special characters displays correctly

**Steps:**
1. In Admin.html Summary Section
2. Enter text with special characters:
   ```
   Welcome to ABC's #1 tournament! Join us at Rock Island (Blue Island, IL) for $500 in prizes. Questions? Email info@abc.com or call (555) 123-4567. Don't miss out—register today!
   ```
3. Save
4. Check Public and Display

**Expected Results:**
- ✅ All special characters save correctly:
  - Apostrophes: ABC's
  - Hash symbols: #1
  - Parentheses: (Blue Island, IL)
  - Dollar signs: $500
  - At symbols: info@abc.com
  - Dashes: 123-4567
  - Em dashes: Don't
- ✅ Text displays correctly on Public page
- ✅ Text displays correctly on Display text pane
- ✅ No encoding errors (like &amp; or &#39;)

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Notes:**
```
[Note any issues here]
```

---

### **TEST 10: Multi-Device Verification**

**Objective:** Confirm display works across different devices/browsers

**Steps:**
Test on multiple devices:
1. **Mobile (Public page)**
   - iPhone Safari
   - Android Chrome
2. **Tablet (Public page)**
   - iPad Safari
   - Android tablet
3. **Desktop (Display page)**
   - Chrome
   - Firefox
   - Safari (Mac)
4. **TV/Large Display (Display page)**
   - Smart TV browser
   - Roku/Chromecast

**Expected Results:**
- ✅ Public page renders correctly on all mobile devices
- ✅ Display page renders correctly on all large screens
- ✅ Text is readable at appropriate sizes
- ✅ No layout breaking or content overflow
- ✅ Carousel timing consistent across devices

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Device Matrix:**
| Device | Browser | Public Works | Display Works | Notes |
|--------|---------|--------------|---------------|-------|
| iPhone | Safari  | ⬜ Yes ⬜ No | N/A           |       |
| Android| Chrome  | ⬜ Yes ⬜ No | N/A           |       |
| Desktop| Chrome  | N/A          | ⬜ Yes ⬜ No |       |
| TV     | Browser | N/A          | ⬜ Yes ⬜ No |       |

---

## 🎯 EVENT DAY SIMULATION TEST

### **TEST 11: ABC Open Workflow Simulation**

**Objective:** Simulate actual ABC Open event day usage

**Scenario:**
```
Week before event:
1. Matt creates event in Admin
2. Sets up tracking
3. Edits summary: "Welcome to ABC Open 2025! Check-in starts at 9 AM. Courts 1-8 in use. Pizza at noon!"
4. Adds 2 YouTube videos
5. Shares Poster on social media

Event day:
6. Staff opens Display on 8 TVs (carousel mode)
7. Attendees arrive, see rotating content on TVs
8. Staff checks Public page on iPads at check-in
9. Attendees open Public page on their phones
```

**Steps:**
1. Create event: "ABC Open 2025 Simulation"
2. Setup tracking
3. Edit summary text with event day info
4. Add video URLs (real or test):
   ```
   https://www.youtube.com/watch?v=dQw4w9WgXcQ,
   https://www.youtube.com/watch?v=jNQXAC9IVRw
   ```
5. Open Display URL on large screen
6. Verify carousel shows:
   - Public page (20s)
   - Text pane: "Welcome to ABC Open 2025..." (10s)
   - Video 1 (30s)
   - Video 2 (30s)
   - Loop
7. Open Public URL on mobile
8. Verify text displays properly

**Expected Results:**
- ✅ Complete workflow executes smoothly
- ✅ No errors at any step
- ✅ Display carousel runs continuously without issues
- ✅ Text pane shows event info clearly on TVs
- ✅ Public page works on mobile devices
- ✅ Video playback works (muted autoplay)
- ✅ Total setup time: < 5 minutes
- ✅ No staff intervention needed once Display is loaded

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

**Timing:**
- Event creation to setup complete: _____ minutes
- First Display load to carousel start: _____ seconds
- Public page load time: _____ seconds

**Notes:**
```
[Note any issues or improvements needed]
```

---

## 🐛 BUG TRACKING

### **Issues Found During Testing**

| # | Test | Issue Description | Severity | Status |
|---|------|-------------------|----------|--------|
| 1 |      |                   | 🔴🟡🟢 | Open/Fixed |
| 2 |      |                   | 🔴🟡🟢 | Open/Fixed |
| 3 |      |                   | 🔴🟡🟢 | Open/Fixed |

**Severity:**
- 🔴 Critical (blocks deployment)
- 🟡 Important (should fix before ABC Open)
- 🟢 Minor (can defer to Phase 2)

---

## ✅ TEST SUMMARY

### **Overall Results**

**Tests Passed:** _____ / 11  
**Tests Failed:** _____ / 11  
**Pass Rate:** _____%

**Critical Path:**
- [ ] Text editing works (Test 1)
- [ ] Data persists (Test 2)
- [ ] Public displays text (Test 3)
- [ ] Display carousel shows text pane (Test 5)
- [ ] Updates propagate (Test 6)

**Ready for ABC Open?** ⬜ YES  ⬜ NO (pending fixes)

---

## 📊 PERFORMANCE METRICS

**Load Times:**
- Admin page: _____ seconds
- Public page: _____ seconds
- Display page: _____ seconds

**Carousel Performance:**
- Transition smoothness: ⬜ Smooth ⬜ Choppy ⬜ Broken
- Video autoplay: ⬜ Works ⬜ Fails
- Text pane rendering: ⬜ Instant ⬜ Delayed ⬜ Error

**Mobile Performance:**
- Public page responsive: ⬜ Yes ⬜ No
- Touch interactions: ⬜ Smooth ⬜ Laggy
- Load time on 4G: _____ seconds

---

## 🎯 ACCEPTANCE CRITERIA

For deployment to ABC Open, ALL of these must be true:

- [ ] Text can be edited in Admin.html
- [ ] Text saves to backend successfully
- [ ] Text appears on Public.html (mobile)
- [ ] Text appears on Display.html carousel (10 seconds)
- [ ] Updates in Admin reflect in Public/Display within 5 seconds of refresh
- [ ] Carousel runs continuously without crashing
- [ ] No console errors in any page
- [ ] Text is readable from 10+ feet on TV
- [ ] Works on staff iPads
- [ ] Complete workflow takes < 5 minutes

**Sign-Off:**
- Tester: _________________ Date: _______
- Product Owner: __________ Date: _______

---

## 📝 TESTING NOTES

**Environment:**
- Apps Script Project: zeventbook
- Deployment ID: _____________________
- Test Date: _________________________
- Tester: ___________________________

**Additional Observations:**
```
[Any other notes, observations, or recommendations]
```

---

## 🚀 NEXT STEPS AFTER TESTING

**If All Tests Pass:**
1. Document deployment URL for ABC staff
2. Create quick reference card for event day
3. Brief ABC staff on Display setup
4. Monitor first real event closely

**If Tests Fail:**
1. Document issues in Bug Tracking section
2. Prioritize critical bugs
3. Fix and re-test
4. Schedule additional testing before ABC Open

---

**Test Plan Version:** 1.0  
**Last Updated:** November 6, 2025  
**Status:** Ready for execution
