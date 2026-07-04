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
    await page.waitForTimeout(1000); // pause for video

    // Set Kubernetes dropdown
    const kubernetesDropdown = topNav.locator('button:has(span:text("Setup Kubernetes"))');
    await expect(kubernetesDropdown).toBeVisible();
    await kubernetesDropdown.click();
    logger.info('Set Kubernetes dropdown clicked');
    await page.waitForTimeout(1000);

    // Notifications icon
    const notificationsIcon = topNav.locator('[data-testid="notification-icon"]');
    await expect(notificationsIcon).toBeVisible();
    await notificationsIcon.click();
    logger.info('Notifications icon clicked');
    await page.waitForTimeout(1000);

    // User dropdown
    const userDropdown = topNav.locator('div.cursor-pointer:has(span.sm\\:hidden)');
    await expect(userDropdown).toBeVisible();
    await userDropdown.click();
    logger.info('User dropdown clicked');
    await page.waitForTimeout(1000);

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
    await page.waitForTimeout(1000); // pause for video

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
    await page.waitForTimeout(1000);

    // Inactive VMs
    const inactiveButton = sidebar.locator('button').filter({ hasText: /^Inactive\b/ });
    await expect(inactiveButton).toBeVisible();
    await inactiveButton.click();
    logger.info('Clicked Inactive VMs');
    await page.waitForTimeout(1000);

    // Active VMs
    const activeButton = sidebar.locator('button').filter({ hasText: /^Active\b/ });
    await expect(activeButton).toBeVisible();
    await activeButton.click();
    logger.info('Clicked Active VMs');
    await page.waitForTimeout(1000);
    // Navigate to Kubernetes tab
    const kubernetesTab = page.getByTitle('Kubernetes');
    await expect(kubernetesTab).toBeVisible({ timeout: LOAD_TIMEOUT });
    await kubernetesTab.click();
    logger.info('Clicked Kubernetes tab');
    await page.waitForTimeout(1000);

    // Expand cluster dropdown if available
    const expandClusterBtn = page.getByRole('button', { name: 'Expand cluster' });
    if ((await expandClusterBtn.count()) > 0) {
      await expandClusterBtn.first().click();
      logger.info('Clicked Expand Cluster button');
      await page.waitForTimeout(2000);
    }

    //migrate
    const migrateTab = sidebar.locator('div[title="Migrate"]');
    await expect(migrateTab).toBeVisible({ timeout: LOAD_TIMEOUT });
    await migrateTab.click();
    logger.info('navigated to  Migrate tab');
    await page.waitForTimeout(1000);

    // License tab
    const licenseTab = sidebar.getByTitle('Licenses');
    await expect(licenseTab).toBeVisible({ timeout: LOAD_TIMEOUT });
    await licenseTab.click();
    logger.info('navigated to License tab');
    await page.waitForTimeout(1000);

    logger.info('Sidebar navigation hierarchy verified successfully');
  });

  const viewports = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Tablet', width: 1024, height: 768 },
    { name: 'Mobile', width: 412, height: 812 },
  ];

  for (const vp of viewports) {
    test(`Responsive top navigation bar works on ${vp.name}`, async ({ page }) => {
      logger.info(`Running top nav test on ${vp.name}`);

      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');
      expect(currentUrl).toContain('/dc');

      const topNav = page.locator('div.fixed.top-0');
      await expect(topNav).toBeVisible({ timeout: LOAD_TIMEOUT });
      logger.info('Top navigation bar visible');

      // Mobile: open hamburger menu
      if (vp.name === 'Mobile') {
        const hamburger = page.locator('button:has(svg)').first();
        await expect(hamburger).toBeVisible({ timeout: LOAD_TIMEOUT });
        await hamburger.click();
        logger.info('Opened mobile hamburger menu');
        await page.waitForTimeout(1000);
      }

      // VM button (Setup VM / VM)
      const vmButton = page.getByRole('button', {
        name: /^(setup\s*)?vm$/i,
      });
      await expect(vmButton).toBeVisible({ timeout: LOAD_TIMEOUT });
      await vmButton.click();
      logger.info('Clicked VM button');
      await page.waitForTimeout(1000);

      // Kubernetes button (Setup Kubernetes / K8s)
      const k8sButton = page.getByRole('button', {
        name: /^(setup\s*)?(kubernetes|k8s)$/i,
      });
      await expect(k8sButton).toBeVisible({ timeout: LOAD_TIMEOUT });
      await k8sButton.click();
      logger.info('Clicked Kubernetes button');
      await page.waitForTimeout(1000);

      // Notifications icon
      const notificationsIcon = page.locator('[data-testid="notification-icon"]');
      if ((await notificationsIcon.count()) > 0) {
        await notificationsIcon.click();
        logger.info('Clicked Notifications icon');
        await page.waitForTimeout(1000);
      }

      // User dropdown
      const userDropdown = topNav.locator('div.cursor-pointer:has(span.sm\\:hidden)');
      await expect(userDropdown).toBeVisible();
      await userDropdown.click();
      logger.info('User dropdown clicked');
      await page.waitForTimeout(1000);

      logger.info(`Responsive top navigation verified on ${vp.name}`);
    });
  }
  test('Navigation between different data centers', async ({ page }) => {
    logger.info('Testing navigation between different data centers...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('navigate to Control Center');

    // Locate and click Expand Cluster button
    const expandClusterBtn = page.locator('button[title*="Expand"]');
    await expandClusterBtn.click();
    logger.info(' Expand Cluster button');

    // Click server node
    await page.getByTestId('server-node-101').click();
    logger.info('Clicked server node');

    // Side navigation checks
    await page.getByRole('link', { name: 'Home' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'Console' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'PCIe Devices' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'Storage' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'KariosPowerLink' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'Network' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page
      .locator('div')
      .filter({ hasText: /^Security$/ })
      .nth(2)
      .click();
    await page.waitForLoadState('domcontentloaded');

    await page
      .locator('div')
      .filter({ hasText: /^Diagnostics$/ })
      .nth(2)
      .click();
    await page.waitForLoadState('domcontentloaded');

    logger.info('Navigation between different data centers completed successfully');
  });
  test('Server selection and navigation', async ({ page }) => {
    logger.info('Testing server selection and navigation...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('Clicked Control Center');

    // Expand cluster dropdown
    const expandBtn = page.locator('button[title*="Expand"]');
    await expandBtn.click();
    logger.info('Clicked Expand Cluster button');
    await page.waitForTimeout(1000);

    const serverContainer = page.getByTestId('server-node-101');
    const servers = serverContainer.getByText(/.+/, { exact: false });

    await expect(servers.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

    const serverCount = await servers.count();
    logger.info(`Total servers found: ${serverCount}`);

    const serverName = (await servers.first().innerText()).trim();

    await servers.first().click();
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
    ];

    for (const item of navItems) {
      const navLink = page
        .getByRole('link', { name: item })
        .or(page.getByText(item, { exact: true }))
        .first();

      await expect(navLink).toBeVisible({ timeout: LOAD_TIMEOUT });
      await navLink.click();

      logger.info(`Navigated to ${item} server: ${serverName}`);

      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }

    logger.info('Server selection and navigation completed successfully');
  });

  test('Browser back and forward navigation', async ({ page }) => {
    logger.info('Testing browser back/forward navigation...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    logger.info('Landed on Control Center');

    const navLinks = ['Karios Forge', 'Storage', 'ISO', 'SDN', 'Event logs'];

    // Navigate forword
    for (const linkName of navLinks) {
      const link = page
        .getByRole('link', { name: linkName })
        .first()
        .or(
          page
            .locator('div')
            .filter({ hasText: `^${linkName}$` })
            .first()
        );
      await link.click();
      logger.info(`Navigated to ${linkName}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }

    // Navigate backword
    for (let i = navLinks.length - 2; i >= 0; i--) {
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');
      logger.info(`Went back to ${navLinks[i]}`);
      await page.waitForTimeout(1000);
    }

    logger.info('Browser back and forward navigation verified successfully');
  });

  test('Test URL parameter handling for resource selection', async ({ page }) => {
    logger.info('Testing URL parameter handling for resource selection...');

    // Go to Control Center page first
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Expand cluster dropdown if needed
    const expandBtn = page.locator('button[title*="Expand"]');
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
      logger.info('Clicked Expand Cluster button');
      await page.waitForTimeout(1000);
    }

    // Get the first available server dynamically
    const serverContainer = page.getByTestId('server-node-101');
    const servers = serverContainer.getByText(/.+/, { exact: false });

    await expect(servers.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

    const serverName = (await servers.first().innerText()).trim();
    logger.info(`Using server: ${serverName} for deep link`);

    // Construct deep link URL dynamically
    const resource = 'storage';
    const deepLinkUrl = `/server/${serverName}/${resource}`;

    await page.goto(deepLinkUrl, { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const newUrl = page.url();
    expect(newUrl).toContain(`/server/${serverName}`);
    expect(newUrl).toContain(`/${resource}`);
    logger.info(`Landed on deep link URL: ${newUrl}`);

    // Verify server header/name is visible
    const serverHeader = page.getByText(serverName, { exact: true });
    await expect(serverHeader).toBeVisible({ timeout: LOAD_TIMEOUT });
    logger.info(`Server "${serverName}" is displayed`);

    // Verify resource tab is visible and click it
    const resourceTab = page
      .getByRole('link', { name: resource.charAt(0).toUpperCase() + resource.slice(1) })
      .first();
    await expect(resourceTab).toBeVisible({ timeout: LOAD_TIMEOUT });
    logger.info(`Resource tab "${resource}" is visible`);

    await resourceTab.click();
    await page.waitForLoadState('domcontentloaded');

    const storageHeader = page.getByText('Storage Management', { exact: true });
    await expect(storageHeader).toBeVisible({ timeout: LOAD_TIMEOUT });
    logger.info('Storage Management text is visible');

    logger.info('URL parameter handling test completed successfully');
  });
});
