import path from 'path';
import { test, expect } from '@playwright/test';

const testPagePath = path.resolve(__dirname, '../../Test.html');
const testPageUrl = `file://${testPagePath}`;

test.describe('Apps Script test harness', () => {
  test('renders core QA controls', async ({ page }) => {
    await page.goto(testPageUrl);

    await expect(page.getByTestId('test-preflight')).toBeVisible();
    await expect(page.getByTestId('btn-smoke')).toBeVisible();
    await expect(page.getByTestId('btn-selftests')).toBeVisible();
    await expect(page.getByTestId('btn-sla-mock')).toBeVisible();
    await expect(page.getByTestId('sla-results')).toBeVisible();
  });

  test('exposes a local google.script.run stub', async ({ page }) => {
    await page.goto(testPageUrl);

    const stubAvailable = await page.evaluate(() => {
      const googleGlobal: any = (window as any).google;
      if (!googleGlobal || !googleGlobal.script) {
        return false;
      }

      return (
        typeof googleGlobal.script.run === 'object' &&
        typeof googleGlobal.script.run.withSuccessHandler === 'function' &&
        typeof googleGlobal.script.run.withFailureHandler === 'function'
      );
    });

    expect(stubAvailable).toBe(true);
  });
});
