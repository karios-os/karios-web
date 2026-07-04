import { test, expect, Page } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');
const PAUSE_TIMEOUT = parseInt(process.env.PAUSE_TIMEOUT || '2000');
const TEST_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000') * 4;
test.setTimeout(TEST_TIMEOUT);

let serverIds: string[] = []; // shared variable

async function getServerIds(page: Page) {
  const serverList = page.getByTestId('sidebar-server-list');
  const servers = serverList.locator('[data-testid^="server-node-"]');
  const count = await servers.count();

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = await servers.nth(i).getAttribute('data-testid');
    if (id) ids.push(id);
  }
  return ids;
}
// Initialize logger for this test suite
const logger = createTestLogger('SecurityManagementTests');
test.describe('Security Management Tests (Authenticated)', () => {
  // Use pre-authenticated session for all tests in this suite
  test.use({ storageState: 'playwright/.auth/user.json' });
  test('collect all server IDs', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    await page.getByTitle('Control Center').click();
    await page.locator('button[title*="Expand"]').click();

    serverIds = await getServerIds(page);
    logger.info(`Collected server IDs: ${serverIds.join(', ')}`);

    expect(serverIds.length).toBeGreaterThan(0);
  });
   test('Security Module Firewall and Karios Shield Navigation', async ({ page }) => {
    logger.info('Starting Security module navigation test');

    // Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('navigate to Control Center');

    // dropdown of server
    const serverdropdown = page.locator('button[title*="Expand"]');
    await serverdropdown.click();
    logger.info(' Expand Cluster button');

    // Click server node
    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

       // Navigate to Security → Firewall
      await page.getByText('Security', { exact: true }).click();
      logger.info('Clicked Security menu');

      await page.getByRole('link', { name: 'Firewall' }).click();
      logger.info('Navigated to Firewall');

      // Verify Firewall page loaded
      await expect(
        page.getByTestId('server-firewall-simple-mode-button')
      ).toBeVisible();
      logger.info('Verified Firewall page loaded');

      // Switch Firewall modes
      await page.getByTestId('server-firewall-simple-mode-button').click();
      logger.info('Switched to Firewall Simple Mode');

      await page.getByTestId('server-firewall-advanced-mode-button').click();
      logger.info('Switched to Firewall Advanced Mode');

      // Navigate to Security → Karios Shield
      await page.getByText('Security', { exact: true }).click();
      logger.info('Clicked Security menu again');

      await page.getByRole('link', { name: 'Karios Shield' }).click();
      logger.info('Navigated to Karios Shield');

      // Verify Karios Shield page loaded
      await expect(
        page.getByRole('button', { name: 'History' })
      ).toBeVisible();
      logger.info('Verified Karios Shield History button');

      await expect(
        page.getByRole('button', { name: 'Metrics' })
      ).toBeVisible();
      logger.info('Verified Karios Shield Metrics button');

      // Navigate between History and Metrics
      await page.getByRole('button', { name: 'History' }).click();
      logger.info('Clicked Karios Shield History tab');

      await page.getByRole('button', { name: 'Metrics' }).click();
      logger.info('Clicked Karios Shield Metrics tab');

      logger.info('Completed Security module navigation test');
    }
  });

  test('Verify firewall simple mode and existing packet filter variables', async ({ page }) => {
    logger.info('Starting Verifing firewall simple mode and existing packet filter variables');

    // Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('navigate to Control Center');

    // dropdown of server
    const serverdropdown = page.locator('button[title*="Expand"]');
    await serverdropdown.click();
    logger.info(' Expand Cluster button');

    // Click server node
    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Navigate to Security → Firewall → Simple Mode
      await page.getByText('Security').click();
      await page.getByRole('link', { name: 'Firewall' }).click();
      await page.getByTestId('server-firewall-simple-mode-button').click();

      // Verify "Packet Filter Management" exists
      await expect(
        page.getByRole('heading', { name: 'Packet Filter Management' })
      ).toBeVisible();
      logger.info('Verified "Packet Filter Management" exists');

      await expect(
        page.getByTestId('server-firewall-existing-packet')
      ).toBeVisible();
      logger.info(' Verified existing packet filter section exists');

      await expect(
        page.getByRole('heading', { name: 'Existing Packet Filters' })
      ).toBeVisible();
      logger.info(' Verified "Existing Packet Filters" heading exists');

      const variables = page.getByTestId('server-firewall-varibles');
      await expect(variables).toBeVisible();
      logger.info(' Verified variables section exists');

      await expect(
        variables.getByTitle('Click to edit this item').first()
      ).toBeVisible();
      logger.info('verified varibles are exsisting or not');
      await page.waitForTimeout(PAUSE_TIMEOUT);
      logger.info('completed the firewall simple mode and existing packet filter variables');
    }
  });
  test('Firewall advanced mode  warning and editor validation', async ({ page }) => {
    logger.info('Starting Firewall advanced mode warning and editor validation');

    // Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('navigate to Control Center');

    // dropdown of server
    const serverdropdown = page.locator('button[title*="Expand"]');
    await serverdropdown.click();
    logger.info(' Expand Cluster button');

    // Click server node
    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Navigate to Security → Firewall
      await page.getByText('Security', { exact: true }).click();
      await page.getByRole('link', { name: 'Firewall' }).click();

      // Click Advanced Mode
      await page.getByTestId('server-firewall-advanced-mode-button').click();

      await expect(
        page.getByTestId('server-firewall-advanced-warning')
      ).toBeVisible();
      logger.info(' Verified advanced mode warning is shown');

      await expect(
        page.getByTestId('server-firewall-title')
      ).toBeVisible();
      logger.info(' Verified firewall title exists');

      const editorContainer = page.getByTestId('server-firewall-editor-container');
      await expect(editorContainer).toBeVisible();
      logger.info('  Verified editor container exists');

      await expect(editorContainer).not.toBeEmpty();
      logger.info('Verified editor has content (not empty)');

      await page.waitForTimeout(PAUSE_TIMEOUT);
      logger.info('completed the Firewall advanced mode  warning and editor validation');
    }
  });

  test('Verify Karios Shield Metrics Page and Sections', async ({ page }) => {
    logger.info('Starting Verifying Karios Shield Metrics Page and Sections');

    // Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('navigate to Control Center');

    // dropdown of server
    const serverdropdown = page.locator('button[title*="Expand"]');
    await serverdropdown.click();
    logger.info(' Expand Cluster button');

    // Click server node
    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Navigate to Security → Firewall
      await page.getByText('Security', { exact: true }).click();
      await page.getByRole('link', { name: 'Karios Shield' }).click();

      await expect(
        page.getByRole('heading', { name: 'Security Center', exact: true })
      ).toBeVisible();
      logger.info('Verified Security Center heading')

      // Navigate to Metrics tab
      await page.getByRole('button', { name: 'Metrics' }).click();
      logger.info('Navigated to Metrics tab');

      const metricsContainer = page.getByTestId('server-metrics-container');
      await expect(metricsContainer).toBeVisible();
      logger.info('verified metrics container')

      await expect(
        metricsContainer.getByText('Compliance')
      ).toBeVisible();

      await expect(
        metricsContainer.locator('div').filter({ hasText: 'System Status' }).first()
      ).toBeVisible();

      await expect(
        page.getByText('Total Issues', { exact: false })
      ).toBeVisible();

      await expect(
        page.getByRole('heading', { name: 'Vulnerabilities' })
      ).toBeVisible();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      logger.info('Successfully verified the metrics');
    }
  });

  test('Verify Karios Shield History and Scan Details', async ({ page }) => {
    logger.info('Starting Karios Shield History validation');

    // Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('navigate to Control Center');

    // dropdown of server
    const serverdropdown = page.locator('button[title*="Expand"]');
    await serverdropdown.click();
    logger.info(' Expand Cluster button');

    // Click server node
    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Navigate to Security → Karios Shield
      await page.getByText('Security', { exact: true }).click();
      logger.info('Clicked Security menu');

      await page.getByRole('link', { name: 'Karios Shield' }).click();
      logger.info('Navigated to Karios Shield');

      // Navigate to History tab
      await page.getByRole('button', { name: 'History' }).click();
      logger.info('Clicked History tab');

      await expect(
        page.getByRole('heading', { name: 'Security Scan History' })
      ).toBeVisible();
      logger.info('Verified Security Scan History heading');

      const scanHistory = page.getByTestId('server-security-scan-history');
      await expect(scanHistory).toBeVisible();
      logger.info('Verified scan history container');

      // Verify Compliance Score exists
      await expect(
        scanHistory.getByText(/Compliance Score/i)
      ).toBeVisible();
      logger.info('Verified Compliance Score is displayed');

      await expect(
        scanHistory.getByText(/Vulnerabilities/i)
      ).toBeVisible();
      logger.info('Verified vulnerabilities section');

      await expect(
        page.getByRole('heading', { name: 'Previous Scan Details' })
      ).toBeVisible();
      logger.info('Verified Previous Scan Details heading');

      // Verify Recent Changes section
      await expect(
        page.getByTestId('server-history-recent-changes')
      ).toBeVisible();
      logger.info('Verified Recent Changes section');

      await expect(
        page.getByRole('heading', { name: 'Scan History', exact: true })
      ).toBeVisible();
      logger.info('Verified Scan History heading');
      await page.waitForTimeout(PAUSE_TIMEOUT);

      logger.info('Completed Karios Shield History validation');
    }
  });
  test('Verify Security Scan execution from Metrics and vulnerability details', async ({ page }) => {
    logger.info('Starting Security Scan execution test from Metrics');

    // Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('navigate to Control Center');

    // dropdown of server
    const serverdropdown = page.locator('button[title*="Expand"]');
    await serverdropdown.click();
    logger.info(' Expand Cluster button');

    // Click server node
    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Navigate to Security → Karios Shield
      await page.getByText('Security', { exact: true }).click();
      logger.info('Clicked Security menu');

      await page.getByRole('link', { name: 'Karios Shield' }).click();
      logger.info('Navigated to Karios Shield');

      // Navigate to Metrics tab
      await page.getByRole('button', { name: 'Metrics' }).click();
      logger.info('Navigated to Metrics tab');

      // Click Scan button
      await page.getByRole('button', { name: 'Scan' }).click();
      logger.info('Clicked Scan button');

      // Verify Security Scan Profile page
      await expect(
        page.getByRole('heading', { name: 'Security Scan Profile' })
      ).toBeVisible();
      logger.info('Verified Security Scan Profile heading');

      // Select Security Profile
      const profileSelector = page.getByTestId('select-security-profile');
      await expect(profileSelector).toBeVisible();
      await profileSelector.getByText('Sshd Xccdf Profile').click();
      logger.info('Selected "Sshd Xccdf Profile"');

      // Start Security Scan
      await page.getByRole('button', { name: 'Start Security Scan' }).click();
      logger.info('Started Security Scan');

      // Verify scan is running
      await expect(
        page.getByText('Running security scan...', { exact: false })
      ).toBeVisible();
      logger.info('Verified security scan is running');

      await expect(
        page.getByText('Scan Complete', { exact: true })
      ).toBeVisible({ timeout: LOAD_TIMEOUT });
      logger.info('Scan completed');
      logger.info('Completed Security Scan execution test');
    }
  });
});
