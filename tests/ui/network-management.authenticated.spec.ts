import { test, expect, Page } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');
const PAUSE_TIMEOUT = parseInt(process.env.PAUSE_TIMEOUT || '2000');
const TEST_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000') * 4;
test.setTimeout(TEST_TIMEOUT);

const logger = createTestLogger('NetworkManagementTests');

test.describe('Iso Management Tests (Authenticated)', () => {
  // Use pre-authenticated session for all tests in this suite
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('navigation to network ', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    // Navigate to Karios Forge
    await page.getByRole('link', { name: 'Karios Forge' }).click();

    await page.getByText('Network', { exact: true }).click();
    await page.getByRole('link', { name: 'Switches' }).click();
    logger.info('navigated to network')

  });

  test('Network Navigation  Virtual Switches, Interfaces, Tunnels', async ({ page }) => {
    logger.info('Starting Network navigation test');
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    // Navigate to Karios Forge
    await page.getByRole('link', { name: 'Karios Forge' }).click();

    // NAVIGATE TO NETWORK -> SWITCHES
    await page.getByText('Network', { exact: true }).click();
    logger.info('Clicked Network menu');

    await page.getByRole('link', { name: 'Switches' }).click();
    logger.info('Navigated to Switches');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // VIRTUAL SWITCHES
    await page.getByRole('button', { name: 'Virtual Switches' }).click();
    logger.info('Clicked Virtual Switches button');

    const virtualSwitchesHeading = page.getByRole('heading', { name: 'Virtual Switches' });
    await expect(virtualSwitchesHeading).toBeVisible();
    logger.info('Virtual Switches page is visible');

    //  Vale Switches
    await page.getByRole('button', { name: 'Vale Switches' }).click();
    logger.info('Clicked Vale Switches');

    // NETWORK -> INTERFACE
    await page.getByText('Network', { exact: true }).click();
    logger.info('Returned to Network menu');

    await page.getByRole('link', { name: 'Interface' }).click();
    logger.info('Navigated to Interface');
    await page.waitForTimeout(PAUSE_TIMEOUT);


    const interfaceHeading = page.getByRole('heading', {
      name: 'Physical Network Interfaces',
    });
    await expect(interfaceHeading).toBeVisible();
    logger.info('Physical Network Interfaces page is visible');

    // NETWORK -> TUNNEL
    await page.getByText('Network', { exact: true }).click();
    logger.info('Returned to Network menu');

    await page.getByRole('link', { name: 'Tunnel' }).click();
    logger.info('Navigated to Tunnel');
    await page.waitForTimeout(PAUSE_TIMEOUT);


    const tunnelHeading = page.getByRole('heading', { name: 'Available Tunnels' });
    await expect(tunnelHeading).toBeVisible();
    logger.info('Available Tunnels page is visible');

    logger.info('Network navigation test completed successfully');

  });

  test('Network Virtual Switches | Public switch validation', async ({ page }) => {
    logger.info('Starting Virtual Switches validation test');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    await page.getByRole('link', { name: 'Karios Forge' }).click();

    // NETWORK -> SWITCHES
    await page.getByText('Network', { exact: true }).click();
    logger.info('navigated to Network');

    await page.getByRole('link', { name: 'Switches' }).click();
    logger.info('navigeted to Switches');

    await expect(
      page.getByRole('heading', { name: 'Network Management' })
    ).toBeVisible();
    logger.info('Network Management page loaded');

    // VIRTUAL SWITCHES VIEW
    await page.getByRole('button', { name: 'Virtual Switches' }).click();
    logger.info('Opened Virtual Switches');

    await expect(page.getByTestId('network-switch-view')).toBeVisible();
    logger.info('Virtual Switches container visible');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const switchTitle = page.getByTestId('network-switch-title');
    await expect(switchTitle).toBeVisible();
    const titleText = (await switchTitle.textContent())?.trim();
    logger.info(`Virtual Switches title: ${titleText}`);

    // READ ALL VIRTUAL SWITCH ITEMS
    const switchItems = page.locator('[data-testid^="network-switch-item-"]');
    const switchCount = await switchItems.count();

    logger.info(` Total Virtual Switches found: ${switchCount}`);
    expect(switchCount).toBeGreaterThan(0);

    let publicSwitchFound = false;

    for (let i = 0; i < switchCount; i++) {
      const item = switchItems.nth(i);
      const text = (await item.innerText()).trim();

      logger.info(`Virtual Switch [${i}]: ${text}`);

      if (/public/i.test(text)) {
        publicSwitchFound = true;
        logger.info('Public switch found');
      }
    }

    // Mandatory validation
    expect(publicSwitchFound).toBeTruthy();

    // VALE SWITCHES
    await page.getByRole('button', { name: 'Vale Switches' }).click();
    logger.info('Navigated to Vale Switches');

    const valeContainer = page.getByTestId('network-vale-container');
    await expect(valeContainer).toBeVisible();
    logger.info('Vale Switches container visible');

    const valeText = await valeContainer
      .locator('div')
      .filter({ hasText: /Active Vale Switches/i })
      .first()
      .textContent();

    const match = valeText?.match(/(\d+)\s*Active Vale Switches/i);
    const activeValeSwitchCount = match ? Number(match[1]) : 0;

    logger.info(`Active Vale Switch Count: ${activeValeSwitchCount}`);
    logger.info('Switches validation test completed successfully');
  });

  test('Network Interfaces | VLANs & Physical Interfaces Validation', async ({ page }) => {
    logger.info('Starting VLANs & Physical Interfaces validation');
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    await page.getByRole('link', { name: 'Karios Forge' }).click();

    // NETWORK -> SWITCHES
    await page.getByText('Network', { exact: true }).click();
    logger.info('navigated to Network');

    // NAVIGATE -> INTERFACE -> VIRTUAL
    await page.getByRole('link', { name: 'Interface' }).click();
    logger.info('Clicked Interface');

    await page.getByTestId('network-interfaces-virtual-tab').click();
    logger.info('Opened Virtual Interfaces tab');

    // VLAN TITLE
    const vlanTitle = page.getByTestId('network-vlan-title');
    await expect(vlanTitle).toBeVisible();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const vlanTitleText = (await vlanTitle.textContent())?.trim();
    logger.info(`VLAN Title: ${vlanTitleText}`);

    // VLAN SUMMARY
    const summaryCards = page.getByTestId('network-vlan-summary-cards');

    const totalVlansText = await summaryCards
      .locator('div')
      .filter({ hasText: /Total VLANs/i })
      .nth(1)
      .textContent();

    const activeVlansText = await summaryCards
      .locator('div')
      .filter({ hasText: /Active/i })
      .nth(1)
      .textContent();

    const totalVlans = Number(totalVlansText?.match(/\d+/)?.[0] ?? 0);
    const activeVlans = Number(activeVlansText?.match(/\d+/)?.[0] ?? 0);

    logger.info(`Total VLANs: ${totalVlans}`);
    logger.info(`Active VLANs: ${activeVlans}`);

    expect(totalVlans).toBeGreaterThan(0);

    // VLAN LIST
    const vlanContainer = page.getByTestId('network-vlan-container');
    await expect(vlanContainer).toBeVisible();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const vlanRows = vlanContainer.getByRole('cell');
    const vlanCount = await vlanRows.count();

    for (let i = 0; i < vlanCount; i++) {
      const rowText = (await vlanRows.nth(i).textContent())?.trim();

      if (rowText && rowText.startsWith('vlan')) {
        const vlanName = rowText.split(' ')[0];
        logger.info(`VLAN Found: ${vlanName}`);
      }
    }

    // NAVIGATE -> PHYSICAL
    await page.getByTestId('network-interfaces-physical-tab').click();
    logger.info('Opened Physical Interfaces tab');

    const physicalTitle = page.getByTestId('physical-interfaces-title');
    await expect(physicalTitle).toBeVisible();

    logger.info(
      `Physical Interfaces Title: ${(await physicalTitle.textContent())?.trim()}`
    );

    // PHYSICAL INTERFACES LIST
    const physicalContainer = page.getByTestId('physical-interfaces-container');
    await expect(physicalContainer).toBeVisible();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const physicalInterfaces = physicalContainer.locator(
      '[data-testid^="interface-name-"]'
    );

    const physicalCount = await physicalInterfaces.count();
    logger.info(`Total Physical Interfaces: ${physicalCount}`);

    expect(physicalCount).toBeGreaterThan(0);

    for (let i = 0; i < physicalCount; i++) {
      const ifaceName = (await physicalInterfaces.nth(i).textContent())?.trim();
      logger.info(`Physical Interface: ${ifaceName}`);
    }

    logger.info('VLANs & Physical Interfaces validation completed successfully');
  });

  test('Network | Tunnels availability validation', async ({ page }) => {
      logger.info('Test:tunnels avail validation');
      // Navigate to Control Center
      await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

      // Navigate: Network -> Tunnel
      await page.getByText('Network', { exact: true }).click();
      await page.getByRole('link', { name: 'Tunnel' }).click();

      // Verify page title
      const tunnelsHeading = page.getByRole('heading', {
        name: /Available Tunnels/i,
      });
      await expect(tunnelsHeading).toBeVisible();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      const headingText = (await tunnelsHeading.textContent())?.trim() ?? '';
      logger.info(`Tunnel heading text: ${headingText}`);

      const match = headingText.match(/Available Tunnels\s*(\d+)/i);
      const tunnelCount = match ? Number(match[1]) : 0;

      if (tunnelCount === 0) {
        logger.info(' No tunnels found');

        const emptyState = page.getByText('No tunnels found', { exact: false });
        if (await emptyState.isVisible()) {
          logger.info('Empty state message displayed');
        }
      } else {
        logger.info(` Total tunnels available: ${tunnelCount}`);
      }

      logger.info('Network Tunnels validation completed successfully');
    });

  test('Network Monitoring | Physical & Virtual Interface Statistics', async ({ page }) => {
    logger.info('Starting Network Monitoring & Statistics test');
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    // Navigate -> Network -> Interface
    await page.getByText('Network', { exact: true }).click();
    await page.getByRole('link', { name: 'Interface' }).click();

    // PHYSICAL INTERFACES
    await expect(page.getByTestId('physical-interfaces-title')).toBeVisible();
    logger.info('Physical Interfaces page visible');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // Get all physical interface names
    const interfaceNames = page.locator('[data-testid^="interface-name-"]');
    const interfaceCount = await interfaceNames.count();

    logger.info(`Total Physical Interfaces: ${interfaceCount}`);

    for (let i = 0; i < interfaceCount; i++) {
      const ifaceName = (await interfaceNames.nth(i).textContent())?.trim() ?? 'UNKNOWN';
      logger.info(`\nInterface: ${ifaceName}`);

      // Open interface details
      await interfaceNames.nth(i).click();
      const detailsButton = page.getByTestId(`interface-view-details-button-${i}`);

      // Check if button is enabled
      if (!(await detailsButton.isEnabled())) {
        logger.info(`Details button disabled for interface: ${ifaceName}, skipping`);
        continue;
      }

      // Safe to click
      await detailsButton.click();

      // RX stats
      await expect(page.getByRole('heading', { name: 'Received (RX)' })).toBeVisible();
      const rxBytes = (await page.getByTestId('rx-bytes').textContent())?.trim() ?? 'N/A';

      // TX stats
      await expect(page.getByRole('heading', { name: 'Transmitted (TX)' })).toBeVisible();
      const txBytes = (await page.getByTestId('tx-bytes').textContent())?.trim() ?? 'N/A';

      logger.info(`RX Bytes: ${rxBytes}`);
      logger.info(`TX Bytes: ${txBytes}`);

      await page.getByRole('button', { name: 'Close' }).click();
    }

    // VIRTUAL INTERFACES → VLANs
    await page.getByTestId('network-interfaces-virtual-tab').click();
    await expect(page.getByTestId('network-vlan-title')).toBeVisible();
    logger.info('\nVirtual VLANs page visible');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // Get all VLAN view buttons dynamically
    const vlanViewButtons = page.locator('[data-testid^="network-vlan-view-button-"]');
    const vlanCount = await vlanViewButtons.count();

    logger.info(`Total VLANs found: ${vlanCount}`);

    for (let i = 0; i < vlanCount; i++) {
      const vlanTestId = await vlanViewButtons.nth(i).getAttribute('data-testid');
      const vlanName = vlanTestId?.replace('network-vlan-view-button-', '') ?? 'UNKNOWN';

      logger.info(`\nVLAN: ${vlanName}`);

      // Open VLAN details
      await vlanViewButtons.nth(i).click();
      await page.getByRole('button', { name: 'Close' }).click();

      // Open VLAN stats
      await page.getByTestId(`network-vlan-stats-button-${vlanName}`).click();

      // RX / TX stats
      const rxText = (await page.getByText(/Receive \(RX\)/).textContent())?.trim() ?? 'N/A';
      const txText = (await page.getByText(/Transmit \(TX\)/).textContent())?.trim() ?? 'N/A';

      logger.info(`RX Stats: ${rxText}`);
      logger.info(`TX Stats: ${txText}`);

      await page.getByRole('button', { name: 'Close' }).click();
    }

    logger.info('\nNetwork Monitoring & Statistics test completed successfully');
  });


});
