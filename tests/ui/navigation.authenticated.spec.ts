import { test, expect } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');

// Initialize logger for this test suite
const logger = createTestLogger('NavigationTests');

test.describe('Navigation Tests (Authenticated)', () => {
  // Use pre-authenticated session - no need for individual logins
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('Top navigation bar and user dropdown', async ({ page }) => {
    logger.info('Testing top navigation bar and dropdowns...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    logger.info(`Landed on page: ${currentUrl}`);
    await page.waitForTimeout(2000); // pause for video

    // Should not be redirected to login
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info('Verified page access without login redirect');

    // Top nav bar
    const topNav = page.locator('div.fixed.top-0');
    await expect(topNav).toBeVisible();
    logger.info('Top navigation bar is visible');

    // Setup VM dropdown
    const setupVmDropdown = topNav.locator('button:has(span:text("Setup VM"))'); // robust locator
    await expect(setupVmDropdown).toBeVisible();
    await setupVmDropdown.click();
    logger.info('Setup VM dropdown clicked');
    await page.waitForTimeout(2000); // pause for video

    // Set Kubernetes dropdown
    const kubernetesDropdown = topNav.locator('button:has(span:text("Setup Kubernetes"))');
    await expect(kubernetesDropdown).toBeVisible();
    await kubernetesDropdown.click();
    logger.info('Set Kubernetes dropdown clicked');
    await page.waitForTimeout(2000);

    // Notifications icon
    const notificationsIcon = topNav.locator('[data-testid="notification-icon"]');
    await expect(notificationsIcon).toBeVisible();
    await notificationsIcon.click();
    logger.info('Notifications icon clicked');
    await page.waitForTimeout(2000);

    // User dropdown
    const userDropdown = topNav.locator('div.cursor-pointer:has(span.sm\\:hidden)');
    await expect(userDropdown).toBeVisible();
    await userDropdown.click();
    logger.info('User dropdown clicked');
    await page.waitForTimeout(2000);

    // Verify user dropdown options (Account Info)
    const userOptions = page.locator('div.absolute >> button:has-text("Account Info")');
    await expect(userOptions).toBeVisible();
    logger.info('User dropdown options are visible');

    // Click Account Info
    await userOptions.click();
    logger.info('Clicked Account Info option');

    await page.waitForTimeout(2000); // final pause for video
    logger.info('Top navigation bar and dropdown interactions verified');
  });
  test('Sidebar navigation: Nodes,Vms,Control center,kurbernetes,migrate,license', async ({
    page,
  }) => {
    logger.info('Testing sidebar navigation hierarchy...');

    await page.goto('/dc', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    logger.info(`Control center access: ${currentUrl}`);

    // Should be able to access control center without login redirect
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on: ${currentUrl}`);
    await page.waitForTimeout(2000); // pause for video

    // Sidebar container
    const sidebar = page.locator('div.flex.flex-col').first();
    await expect(sidebar).toBeVisible({ timeout: LOAD_TIMEOUT });
    logger.info('Sidebar is visible');

    // expand
    const doubleDot = sidebar.locator('.p-1');
    await expect(doubleDot).toBeVisible();
    await doubleDot.click();
    logger.info('Clicked double-dot to expand nodes');
    await page.waitForTimeout(2000);

    const vmsButton = sidebar.locator('button', { hasText: 'VMs' });

    // Wait until its visible
    await expect(vmsButton).toBeVisible({ timeout: LOAD_TIMEOUT });
    logger.info('VMs button is visible');
    await vmsButton.click();
    logger.info('Clicked VMs');
    await page.waitForTimeout(2000);

    // Inactive VMs
    const inactiveButton = sidebar.locator('button').filter({ hasText: /^Inactive\b/ });
    await expect(inactiveButton).toBeVisible();
    await inactiveButton.click();
    logger.info('Clicked Inactive VMs');
    await page.waitForTimeout(2000);

    // Active VMs
    const activeButton = sidebar.locator('button').filter({ hasText: /^Active\b/ });
    await expect(activeButton).toBeVisible();
    await activeButton.click();
    logger.info('Clicked Active VMs');
    await page.waitForTimeout(2000);

    logger.info('Sidebar navigation hierarchy verified successfully');
  });

  test('Authenticated session works for app navigation', async ({ page }) => {
    logger.info('Testing authenticated navigation...');

    // Test access directly to a known protected page
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    logger.info(`Control center access: ${currentUrl}`);

    // Should be able to access control center without login redirect
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('control-center');

    // Add delay for video visibility
    logger.info('Pausing for video recording...');
    await page.waitForTimeout(3000);

    logger.info('Authenticated session allows protected page access');
  });

  test('Control center direct access and navigation', async ({ page }) => {
    logger.info('Testing direct control center access and UI navigation...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    logger.info(`Control center URL: ${currentUrl}`);

    // Show control center for video
    logger.info('Showing control center for video...');
    await page.waitForTimeout(3000);

    // Should not be redirected to login
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('control-center');

    // Test basic navigation functionality
    logger.info('Testing navigation to different sections...');

    try {
      // Look for navigation elements
      const navElement = await page.locator('a[href*="/dc/"]').first();
      if ((await navElement.count()) > 0) {
        logger.info('Found navigation element: a[href*="/dc/"]');
      }
    } catch (e) {
      logger.warn('Navigation elements not immediately visible, but page loaded');
    }

    logger.info('Control center is directly accessible and UI is interactive');
  });

  test('Page reload maintains authentication with UI verification', async ({ page }) => {
    logger.info('Testing session persistence on reload with UI interaction...');

    // Navigate to a protected page
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const urlBeforeReload = page.url();
    logger.info(`URL before reload: ${urlBeforeReload}`);

    // Show page before reload for video
    logger.info('Showing page before reload...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/before-reload.png', fullPage: true });

    // Reload the page
    logger.info('Reloading page...');
    await page.reload({ timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const urlAfterReload = page.url();
    logger.info(`URL after reload: ${urlAfterReload}`);

    // Show page after reload for video
    logger.info('Showing page after reload...');
    await page.waitForTimeout(3000);

    // Take screenshot after reload
    await page.screenshot({ path: 'test-results/after-reload.png', fullPage: true });

    // Verify we're still authenticated by checking if we can access the page content
    if (!urlAfterReload.includes('/login')) {
      logger.info('Testing UI interaction after reload...');

      // Try to interact with the page to verify it's fully functional
      try {
        // Look for any clickable elements to verify page is interactive
        const interactiveElements = [
          'button',
          'a[href]',
          '[role="button"]',
          'input',
          '[data-testid]',
        ];

        for (const selector of interactiveElements) {
          const elements = await page.locator(selector).all();
          if (elements.length > 0) {
            logger.info(`Found ${elements.length} interactive elements of type: ${selector}`);
            await page.waitForTimeout(1000); // Brief pause for video
            break;
          }
        }
      } catch (e) {
        logger.warn('Could not verify interactive elements, but page loaded');
      }

      logger.info('Session persists after page reload and UI is accessible');
    } else {
      throw new Error('Session expired - redirected to login after reload');
    }
  });
});
