import { test, expect } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load deployment environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.deployment') });

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');

// Initialize logger for this test suite
const logger = createTestLogger('LoginTests');

test.describe('Login Tests', () => {
  // These tests don't use pre-authenticated sessions

  test('Successful login with valid credentials', async ({ page }) => {
    logger.info('Testing successful login...');

    const baseURL = process.env.BASE_URL!;
    const username = process.env.DEPLOY_TEST_USERNAME!;
    const password = process.env.DEPLOY_TEST_PASSWORD!;

    // Navigate to login page
    await page.goto(baseURL, { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT });

    logger.info('Filling in valid credentials...');

    // Fill login form
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', password);

    // Add delay for video visibility
    await page.waitForTimeout(1000);

    await page.click('button[type="submit"]');

    // Wait for successful login - look for control center URL
    await page.waitForURL('**/control-center**', { timeout: 10000 });

    const finalUrl = page.url();
    logger.info(`Login successful - URL: ${finalUrl}`);

    // Verify we're logged in
    expect(finalUrl).toContain('control-center');
    expect(finalUrl).not.toContain('/login');

    // Add delay for video visibility
    await page.waitForTimeout(2000);

    logger.info('Valid credentials allowed access');
  });

  test('Login fails with wrong password', async ({ page }) => {
    logger.info('Testing login with wrong password...');

    const baseURL = process.env.BASE_URL!;
    const username = process.env.DEPLOY_TEST_USERNAME!;
    const wrongPassword = 'wrongpassword123';

    // Navigate to login page
    await page.goto(baseURL, { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT });

    logger.info('Filling in invalid credentials...');

    // Fill login form with wrong password
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', wrongPassword);

    // Add delay for video visibility
    await page.waitForTimeout(1000);

    await page.click('button[type="submit"]');

    // Wait a moment for the error to appear
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    logger.info(`Current URL after failed login: ${currentUrl}`);

    // Should still be on login page or see error message
    expect(currentUrl).toContain('/login');

    // Look for error message
    const errorSelectors = [
      'text=/invalid|incorrect|wrong|failed/i',
      '[role="alert"]',
      '.error',
      '.alert-error',
      '[data-testid*="error"]',
    ];

    let errorFound = false;
    for (const selector of errorSelectors) {
      const errorElement = page.locator(selector).first();
      if ((await errorElement.count()) > 0 && (await errorElement.isVisible())) {
        const errorText = await errorElement.textContent();
        logger.info(`Error message found: "${errorText}"`);
        errorFound = true;
        break;
      }
    }

    // Add delay for video visibility to see the error
    await page.waitForTimeout(3000);

    // Take screenshot of the error
    await page.screenshot({ path: 'test-results/login-error.png', fullPage: true });

    if (errorFound) {
      logger.info('Login correctly rejected with error message');
    } else {
      logger.info('Login rejected - stayed on login page');
    }

    // Verify we didn't get access to control center
    expect(currentUrl).not.toContain('control-center');
  });

  test('Login fails with empty credentials', async ({ page }) => {
    logger.info('Testing login with empty credentials...');

    const baseURL = process.env.BASE_URL!;

    // Navigate to login page
    await page.goto(baseURL, { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT });

    logger.info('Attempting to submit empty form...');

    // Try to submit without filling anything
    await page.click('button[type="submit"]');

    // Wait a moment
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    logger.info(`Current URL after empty submit: ${currentUrl}`);

    // Should still be on login page
    expect(currentUrl).toContain('/login');

    // Check for validation errors or that form wasn't submitted
    const submitButton = page.locator('button[type="submit"]');
    const isButtonStillVisible = await submitButton.isVisible();

    logger.info(`Submit button still visible: ${isButtonStillVisible}`);

    // Add delay for video visibility
    await page.waitForTimeout(2000);

    expect(currentUrl).not.toContain('control-center');
    logger.info('Empty credentials correctly prevented login');
  });

  test('Login fails with wrong username', async ({ page }) => {
    logger.info('Testing login with wrong username...');

    const baseURL = process.env.BASE_URL!;
    const wrongUsername = 'nonexistentuser123';
    const password = process.env.DEPLOY_TEST_PASSWORD!;

    // Navigate to login page
    await page.goto(baseURL, { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: LOAD_TIMEOUT });

    logger.info('Filling in credentials with wrong username...');

    // Fill login form with wrong username
    await page.fill('[name="username"]', wrongUsername);
    await page.fill('[name="password"]', password);

    // Add delay for video visibility
    await page.waitForTimeout(1000);

    await page.click('button[type="submit"]');

    // Wait a moment for the error to appear
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    logger.info(`Current URL after failed login: ${currentUrl}`);

    // Should still be on login page
    expect(currentUrl).toContain('/login');

    // Add delay for video visibility
    await page.waitForTimeout(2000);

    // Verify we didn't get access to control center
    expect(currentUrl).not.toContain('control-center');
    logger.info('Invalid username correctly prevented login');
  });
});
