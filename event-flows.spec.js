// Example E2E Test - Full User Flow with Playwright
import { test, expect } from '@playwright/test';

test.describe('Event Management - Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:3000');
  });

  test('User can create an event and RSVP @smoke', async ({ page }) => {
    // Step 1: Navigate to create event page
    await page.click('text=Create Event');
    await expect(page).toHaveURL(/.*\/events\/create/);

    // Step 2: Fill out event form
    await page.fill('input[name="title"]', 'Tech Conference 2025');
    await page.fill('input[name="date"]', '2025-10-15');
    await page.fill('input[name="location"]', 'San Francisco');
    await page.fill('input[name="maxAttendees"]', '100');
    await page.fill('textarea[name="description"]', 'A great tech conference');

    // Step 3: Submit form
    await page.click('button[type="submit"]');

    // Step 4: Verify success message
    await expect(page.locator('.success-message')).toContainText(
      'Event created successfully'
    );

    // Step 5: Verify redirect to event details
    await expect(page).toHaveURL(/.*\/events\/[a-z0-9-]+/);

    // Step 6: Verify event details are displayed
    await expect(page.locator('h1')).toContainText('Tech Conference 2025');
    await expect(page.locator('.event-date')).toContainText('October 15, 2025');
    await expect(page.locator('.event-location')).toContainText('San Francisco');

    // Step 7: RSVP to event
    await page.click('button:has-text("RSVP")');

    // Step 8: Verify RSVP confirmation
    await expect(page.locator('.rsvp-status')).toContainText('You are attending');
    await expect(page.locator('.attendee-count')).toContainText('1 / 100');
  });

  test('User login and dashboard flow', async ({ page }) => {
    // Step 1: Click login button
    await page.click('text=Login');

    // Step 2: Fill in credentials
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');

    // Step 3: Submit login
    await page.click('button[type="submit"]');

    // Step 4: Verify redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Step 5: Verify user name is displayed
    await expect(page.locator('.user-name')).toContainText('Test User');

    // Step 6: Verify dashboard sections
    await expect(page.locator('h2:has-text("My Events")')).toBeVisible();
    await expect(page.locator('h2:has-text("Upcoming RSVPs")')).toBeVisible();
  });

  test('Search and filter events', async ({ page }) => {
    // Step 1: Navigate to events page
    await page.click('text=Browse Events');

    // Step 2: Use search
    await page.fill('input[placeholder="Search events..."]', 'Tech');
    await page.press('input[placeholder="Search events..."]', 'Enter');

    // Step 3: Verify search results
    await expect(page.locator('.event-card')).toHaveCount(3);
    await expect(page.locator('.event-card').first()).toContainText('Tech');

    // Step 4: Apply date filter
    await page.click('button:has-text("Filters")');
    await page.fill('input[name="startDate"]', '2025-10-01');
    await page.fill('input[name="endDate"]', '2025-10-31');
    await page.click('button:has-text("Apply Filters")');

    // Step 5: Verify filtered results
    await expect(page.locator('.event-card')).toHaveCount(2);

    // Step 6: Clear filters
    await page.click('button:has-text("Clear Filters")');
    await expect(page.locator('.event-card').first()).toBeVisible();
  });

  test('Event cancellation flow', async ({ page, context }) => {
    // Assume user is logged in
    await context.addCookies([
      {
        name: 'auth-token',
        value: 'test-token',
        domain: 'localhost',
        path: '/'
      }
    ]);

    // Step 1: Navigate to user's events
    await page.goto('http://localhost:3000/dashboard/my-events');

    // Step 2: Select event to cancel
    await page.click('.event-card:first-child button:has-text("Manage")');

    // Step 3: Click cancel button
    await page.click('button:has-text("Cancel Event")');

    // Step 4: Confirm cancellation in modal
    await expect(page.locator('.modal')).toBeVisible();
    await page.fill('textarea[name="cancellationReason"]', 'Venue unavailable');
    await page.click('.modal button:has-text("Confirm Cancellation")');

    // Step 5: Verify success
    await expect(page.locator('.success-message')).toContainText(
      'Event cancelled successfully'
    );

    // Step 6: Verify event status updated
    await expect(page.locator('.event-status')).toContainText('Cancelled');
  });

  test('Mobile responsive navigation', async ({ page, viewport }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Step 1: Verify mobile menu is hidden
    await expect(page.locator('.mobile-menu')).not.toBeVisible();

    // Step 2: Click hamburger menu
    await page.click('button[aria-label="Menu"]');

    // Step 3: Verify menu opens
    await expect(page.locator('.mobile-menu')).toBeVisible();

    // Step 4: Navigate through menu
    await page.click('.mobile-menu a:has-text("Events")');

    // Step 5: Verify navigation
    await expect(page).toHaveURL(/.*\/events/);

    // Step 6: Verify menu closes after navigation
    await expect(page.locator('.mobile-menu')).not.toBeVisible();
  });

  test('Form validation and error handling', async ({ page }) => {
    // Step 1: Navigate to create event
    await page.goto('http://localhost:3000/events/create');

    // Step 2: Try to submit empty form
    await page.click('button[type="submit"]');

    // Step 3: Verify error messages
    await expect(page.locator('.error-message')).toHaveCount(4);
    await expect(page.locator('text=Title is required')).toBeVisible();
    await expect(page.locator('text=Date is required')).toBeVisible();
    await expect(page.locator('text=Location is required')).toBeVisible();
    await expect(page.locator('text=Max attendees is required')).toBeVisible();

    // Step 4: Fill form with invalid data
    await page.fill('input[name="title"]', 'AB'); // Too short
    await page.fill('input[name="date"]', '2020-01-01'); // Past date
    await page.fill('input[name="maxAttendees"]', '-5'); // Negative number

    // Step 5: Verify validation errors
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Title must be at least 3 characters')).toBeVisible();
    await expect(page.locator('text=Date must be in the future')).toBeVisible();
    await expect(page.locator('text=Must be a positive number')).toBeVisible();

    // Step 6: Fix errors and submit
    await page.fill('input[name="title"]', 'Valid Event Title');
    await page.fill('input[name="date"]', '2025-12-31');
    await page.fill('input[name="location"]', 'San Francisco');
    await page.fill('input[name="maxAttendees"]', '50');

    await page.click('button[type="submit"]');

    // Step 7: Verify success
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('Accessibility compliance', async ({ page }) => {
    // Step 1: Check for proper heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);

    // Step 2: Check all images have alt text
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }

    // Step 3: Check form labels
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = await page.locator(`label[for="${id}"]`).count();
        expect(label).toBeGreaterThan(0);
      }
    }

    // Step 4: Check keyboard navigation
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement.tagName);
    expect(focused).toBeTruthy();
  });

  test('Performance - Page load time @performance', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to events page
    await page.goto('http://localhost:3000/events');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Verify page loads within 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // Verify key elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.event-card').first()).toBeVisible();
  });
});

test.describe('Edge Cases and Error Scenarios', () => {
  test('Handles network errors gracefully', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);

    await page.goto('http://localhost:3000/events/create');

    // Try to submit form
    await page.fill('input[name="title"]', 'Test Event');
    await page.fill('input[name="date"]', '2025-12-31');
    await page.fill('input[name="location"]', 'SF');
    await page.fill('input[name="maxAttendees"]', '50');
    await page.click('button[type="submit"]');

    // Verify error message
    await expect(page.locator('.error-message')).toContainText(
      'Network error. Please check your connection.'
    );

    // Go back online
    await context.setOffline(false);

    // Retry
    await page.click('button:has-text("Retry")');

    // Verify success
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('Handles concurrent RSVP race condition', async ({ browser }) => {
    // Create two browser contexts (simulating two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Both users navigate to an event with 1 spot left
    await page1.goto('http://localhost:3000/events/almost-full-event');
    await page2.goto('http://localhost:3000/events/almost-full-event');

    // Both try to RSVP simultaneously
    await Promise.all([
      page1.click('button:has-text("RSVP")'),
      page2.click('button:has-text("RSVP")')
    ]);

    // One should succeed, one should fail
    const success1 = await page1.locator('.success-message').isVisible();
    const success2 = await page2.locator('.success-message').isVisible();

    expect(success1 || success2).toBe(true); // One succeeds
    expect(success1 && success2).toBe(false); // Both don't succeed

    await context1.close();
    await context2.close();
  });
});
