import { test, expect } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');

// Initialize logger for this test suite
const logger = createTestLogger('PageAccessibilityTests');

test.describe('Page Accessibility Tests (Authenticated)', () => {
  // Use pre-authenticated session - no need for individual logins
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('Page structure is present when authenticated', async ({ page }) => {
    logger.info('Testing basic page structure...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    // Get page title
    const pageTitle = await page.title();
    logger.info(`Page title: "${pageTitle}"`);

    // Take full page screenshot
    await page.screenshot({
      path: 'test-results/page-structure-authenticated.png',
      fullPage: true,
    });

    // Check basic HTML structure
    const bodyCount = await page.locator('body').count();
    const htmlCount = await page.locator('html').count();

    expect(bodyCount).toBe(1);
    expect(htmlCount).toBe(1);
    expect(pageTitle).toBeTruthy();

    logger.info('Basic page structure is present');
  });
});
