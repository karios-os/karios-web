import { test as setup, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load deployment environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.deployment') });

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const baseURL = process.env.BASE_URL!;
  const username = process.env.DEPLOY_TEST_USERNAME!;
  const password = process.env.DEPLOY_TEST_PASSWORD!;

  // Navigate to login page
  await page.goto(baseURL);
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for successful login - look for control center URL
  await page.waitForURL('**/control-center**', { timeout: 10000 });

  // Verify we're logged in by checking for common authenticated elements
  await expect(page.url()).toContain('control-center');

  // Save signed-in state to reuse in tests
  await page.context().storageState({ path: authFile });

});
