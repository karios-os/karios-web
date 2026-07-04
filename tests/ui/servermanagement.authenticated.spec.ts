import { test, expect, Page } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');
const PAUSE_TIMEOUT = parseInt(process.env.PAUSE_TIMEOUT || '2000');

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
const logger = createTestLogger('ServerManagementTests');
test.describe('Server Management Tests (Authenticated)', () => {
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

  test('server status dashboard and metrics display', async ({ page }) => {
    logger.info('Starting server status dashboard and metrics display test');

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

      const uptimeValue = await page
        .getByText(/^\d+W\s+\d+D\s+\d+H$/)
        .first()
        .innerText();
      await expect(uptimeValue).not.toBeNull();
      logger.info(`Node uptime since last restart: ${uptimeValue}`);

      // Verify Node Metrics page
      const nodeMetricsHeading = page.getByRole('heading', { name: 'Node Metrics' });
      await expect(nodeMetricsHeading).toBeVisible();
      logger.info('Node Metrics page is visible');

      const modelName = await page
        .getByTestId('system-information-container')
        .locator('div')
        .filter({ hasText: /^Model Name/i })
        .locator('span, div')
        .last()
        .innerText();
      logger.info('system information ');
      logger.info(`Model Name: ${modelName}`);

      const storageContainer = page.getByTestId('storage-cards-container');
      await storageContainer.locator('div').filter({ hasText: 'Storage Devices' }).nth(2);

      const nvmeDetails = await storageContainer
        .locator('div')
        .filter({ hasText: /NVMe SSD Controller/i })
        .nth(2)
        .innerText();

      logger.info(`Storage Device Details: ${nvmeDetails}`);
      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test('server hardware information accuracy', async ({ page }) => {
    logger.info('Starting server hardware information accuracy test');

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

    // Click server node
    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      const nodeMetricsHeading = page.getByRole('heading', { name: 'Node Metrics' });
      await expect(nodeMetricsHeading).toBeVisible();
      logger.info('Node Metrics page is visible');

      //hardware information
      const Usage = await page
        .getByTestId('landing-page-container')
        .locator('div')
        .locator('div', { hasText: /%/ })
        .nth(0)
        .innerText();
      logger.info(`Efficiency,cpuusage,storage,ram usage: ${Usage}`);

      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test('Test server resource utilization monitoring', async ({ page }) => {
    logger.info('Test server resource utilization monitoring');

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

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Navigate to Diagnostics -> Monitoring
      await page.getByText('Diagnostics').click();
      await page.getByRole('link', { name: 'Monitoring' }).click();
      logger.info('Navigated to Diagnostics -> Monitoring');
      await page.getByTestId('time-range-button-1h').click();
      logger.info('Set time range to 1 hour');

      const chartIds = ['cpu-chart-container', 'memory-chart-container', 'storage-chart-container'];
      for (const id of chartIds) {
        const chart = page.getByTestId(id);
        if (await chart.isVisible()) {
          logger.info(`${id} chart is rendered.`);
          await chart.scrollIntoViewIfNeeded();
        } else {
          logger.warn(`${id} chart is not rendered.`);
        }
      }
      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test('server connectivity status', async ({ page }) => {
    logger.info('Starting server connectivity status');

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

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      const uptimeValue = await page
        .getByText(/^\d+W\s+\d+D\s+\d+H$/)
        .first()
        .innerText();
      await expect(uptimeValue).not.toBeNull();
      logger.info(`Node uptime since last restart: ${uptimeValue}`);

      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test('server licensing and feature management', async ({ page }) => {
    logger.info('Starting server licensing and feature management');

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

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
    }
  });

  test(' navigation between server tabs ', async ({ page }) => {
    logger.info('Testing server navigation between tabs...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('Clicked Control Center');

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      logger.info(`Clicked server: ${serverName}`);

      const navItems = [
        'Home',
        'Console',
        'PCIe Devices',
        'Storage',
        'KariosPowerLink',
        'Network',
        'Security',
        'Diagnostics',
        'Monitoring',
      ];

      for (const item of navItems) {
        const navLink = page
          .getByRole('link', { name: item })
          .or(page.getByText(item, { exact: true }))
          .first();

        await expect(navLink).toBeVisible({ timeout: LOAD_TIMEOUT });
        await navLink.click();

        logger.info(`Navigated to  ${serverName} server: ${item}`);

        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);
      }

      logger.info('Server selection and navigation completed successfully');
    }
  });

  test(' server event logs and system logs access', async ({ page }) => {
    logger.info('Starting server event logs and system logs access');

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

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      await page.getByText('Diagnostics').click();
      await page.getByRole('link', { name: 'System Logs' }).click();

      // wait for logs table
      const systemLogRows = page.getByRole('row');
      const latestSystemLogRow = systemLogRows.nth(1);

      // extract text
      const latestSystemLogText = (await latestSystemLogRow.innerText()).trim();
      logger.info(`Latest System Log: ${latestSystemLogText}`);
      // verify it exists
      await expect(latestSystemLogRow).toBeVisible();

      await page.getByText('Diagnostics').click();
      await page.getByRole('link', { name: 'Event Logs' }).click();

      const latestEvent = page.getByRole('heading').nth(2);
      const latestEventText = (await latestEvent.innerText()).trim();
      logger.info(`Latest Event Log: ${latestEventText}`);
      // verify it exists
      await expect(latestEvent).toBeVisible();
      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test('Test server-specific feature access', async ({ page }) => {
    logger.info('Starting Test server-specific feature access');

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

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();

      // Click the Power Management tab
      await page.getByRole('button', { name: 'Power Power Management and' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Verify main headings are visible
      const headings = [
        'Power Consumption(in Wattage)',
        'Voltage (in Volts)',
        'Current (in Ampehere)',
        'Energy (in kW/Hr)',
      ];

      for (const heading of headings) {
        const el = page.getByRole('heading', { name: heading });
        await expect(el).toBeVisible();
        logger.info(`Verified visibility of : ${heading}`);
      }
      await page.waitForTimeout(PAUSE_TIMEOUT);

      await page.getByRole('button', { name: 'Power Monitoring' }).click();
      // Click and fetch Power Supply IDs
      await page.getByTestId('power-supply-title').click();
      const tableContainer = page.getByTestId('power-supply-table-container');
      await expect(tableContainer).toBeVisible({ timeout: LOAD_TIMEOUT });
      logger.info('Power Supply table is visible');

      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test('server console and management interfaces', async ({ page }) => {
    logger.info('Starting server console and management interfaces');

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

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      await page.getByRole('link', { name: 'Home' }).click();

      // Click Console tab
      await page.getByRole('link', { name: 'Console' }).click();
      logger.info('Clicked Console tab');

      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });
});
