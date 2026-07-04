import { test, expect } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');
const PAUSE_TIMEOUT = parseInt(process.env.PAUSE_TIMEOUT || '2000');
const TEST_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000') * 10;
const ACTION_TIMEOUT = parseInt(process.env.ACTION_TIMEOUT || '5000');
const MooseFS_SERVERIP = process.env.MOUNTMOOSEFS_SERVERIP;
const MooseFS_PORT = process.env.MOUNTMOOSEFS_PORT;
const ISCSI_TARGET = process.env.ISCSI_TARGET;
const ISCSI_PORTAL = process.env.ISCSI_PORTAL;
const ISCSI_USERNAME = process.env.ISCSI_USERNAME;
const ISCSI_PASSWORD = process.env.ISCSI_PASSWORD;
const SCAN_SUBNET = process.env.SCAN_SUBNET;
const REVEAL_USERNAME = process.env.REVEAL_USERNAME;
const REVEAL_PASSWORD = process.env.REVEAL_PASSWORD;
const ENABLE_PROVISIONING = process.env.ENABLE_PROVISIONING;

test.setTimeout(TEST_TIMEOUT);
const logger = createTestLogger('datacenterManagementTests');

test.describe('Server Management Tests (Authenticated)', () => {
  // Use pre-authenticated session for all tests in this suite
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('Node provisioning (Scan subnet, reveal hardware, and get logs)', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    // Navigate to Karios Forge
    await page.getByRole('link', { name: 'Karios Forge' }).click();

    // Enter subnet and scan
    await page.getByTestId('subnet-input').click();
    await page.getByTestId('subnet-input').fill(SCAN_SUBNET!);
    await page.getByTestId('scan-button').click();
    await page.waitForTimeout(ACTION_TIMEOUT);

    // Open scanned nodes
    await page.getByText(/Scanned Nodes/);
    await page.getByRole('cell', { name: 'BMC IP Address' });

    // Get all scanned nodes dynamically
    const scannedRows = page.locator('[data-testid^="scanned-node-row-"]');
    const scannedCount = await scannedRows.count();
    logger.info(`Total scanned nodes: ${scannedCount}`);

    if (ENABLE_PROVISIONING === 'false') {
      logger.warn('Provisioning is DISABLED. Skipping Reveal / Provision / Configure steps.');
      return;
    }
    logger.info('enabling provisioning: ' + ENABLE_PROVISIONING);

    if (scannedCount > 0) {
      const firstNode = scannedRows.nth(0);

      // Click "More" on the first node
      await firstNode.getByRole('button', { name: 'More' }).click();

      // Start hardware reveal
      await page.getByRole('button', { name: 'Reveal' }).click();
      await page.getByRole('textbox', { name: 'Enter username' }).fill(REVEAL_USERNAME!);
      await page.getByRole('textbox', { name: 'Enter password' }).fill(REVEAL_PASSWORD!);
      await page.getByRole('button', { name: 'Start Hardware Reveal' }).click();

      // Fetch a log from log container
      await page.getByTestId('log-container').click();
      const firstLog = await page
        .locator('[data-testid="log-container"] div')
        .first()
        .textContent();
      logger.info(`First hardware reveal log: ${firstLog?.trim()}`);
      await page.waitForTimeout(ACTION_TIMEOUT);

      // Close & continue in background
      await page.getByRole('button', { name: 'Close & Continue in Background' }).click();

      // Go to Event Logs and display the first log
      await page.getByRole('link', { name: 'Event logs' }).click();
      const firstEventLog = await page.locator('.border.rounded-lg').first().textContent();
      logger.info(`First Event log: ${firstEventLog?.trim()}`);
    } else {
      logger.warn('No scanned nodes found.');
    }
  });

  test('BMC node scanning', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    // Navigate to Karios Forge
    await page.getByRole('link', { name: 'Karios Forge' }).click();

    // Enter subnet and scan
    await page.getByTestId('subnet-input').click();
    await page.getByTestId('subnet-input').fill(SCAN_SUBNET!);
    await page.getByTestId('scan-button').click();
    await page.waitForTimeout(ACTION_TIMEOUT);

    // Open scanned nodes
    await page.getByText(/Scanned Nodes/);
    await page.getByRole('cell', { name: 'BMC IP Address' });

    // Get all scanned nodes dynamically
    const scannedRows = page.locator('[data-testid^="scanned-node-row-"]');
    const scannedCount = await scannedRows.count();
    logger.info(`Total scanned nodes: ${scannedCount}`);
  });

  test('data center overview and statistics', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    await page.getByTitle('Control Center').click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const statuses = ['Discovered', 'Registered', 'Provisioned', 'Configured'];
    for (const status of statuses) {
      const card = page
        .getByTestId('status-cards-grid')
        .locator('div')
        .filter({ hasText: status })
        .first();
      await expect(card).toBeVisible();
    }
    // Go to Stats
    await page.getByRole('link', { name: 'Stats' }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);
    await page.getByTestId('dcstats-container').click();

    // Get all rows (nodes) in the table
    const rows = page.getByRole('row').filter({ has: page.locator('td') });
    const rowCount = await rows.count();

    await expect(rowCount).toBeGreaterThan(0);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await expect(row).toBeVisible();

      const cells = row.locator('td');
      const cellCount = await cells.count();

      let rowData: string[] = [];
      for (let j = 0; j < cellCount; j++) {
        const text = (await cells.nth(j).textContent())?.trim() || '';
        rowData.push(text);
      }

      logger.info(`Row ${i + 1} data: ${rowData.join(' | ')}`);

      // Click image in each row if present
      const rowImg = row.getByRole('img');
      if ((await rowImg.count()) > 0) {
        await rowImg.click();
      }
    }

    // Click on Recommendations tab
    await page.getByRole('button', { name: 'Recommendations' }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // Get updated rows
    const recRows = page.getByRole('row').filter({ has: page.locator('td') });
    const recRowCount = await recRows.count();
    expect(recRowCount).toBeGreaterThan(0);

    // Click down icons/images in all rows
    for (let i = 0; i < recRowCount; i++) {
      const row = recRows.nth(i);
      const downIcon = row.getByRole('img');
      if ((await downIcon.count()) > 0) {
        await expect(downIcon).toBeVisible();
        await downIcon.click();
      }
    }

    // Get the data
    if (recRowCount > 0) {
      const lastRow = recRows.nth(recRowCount - 1);
      await expect(lastRow).toBeVisible();
      const lastRowCells = lastRow.locator('td');
      const lastRowCellCount = await lastRowCells.count();
      let lastRowData: string[] = [];
      for (let j = 0; j < lastRowCellCount; j++) {
        const text = (await lastRowCells.nth(j).textContent())?.trim() || '';
        lastRowData.push(text);
      }
      logger.info(`Node recommendations row data: ${lastRowData.join(' | ')}`);
    }
    await page.waitForTimeout(PAUSE_TIMEOUT);
  });

  test('Filterings nodes with stages', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    await page.getByTitle('Control Center').click();
    await page.getByRole('link', { name: 'Karios Forge' }).click();
    await page.waitForLoadState('domcontentloaded');

    // ---------------- STATUS FILTER ----------------
    const statuses = [
      'DISCOVERED',
      'REGISTERED',
      'PROVISIONING',
      'PROVISIONED',
      'CONFIGURING',
      'CONFIGURED',
    ];

    await page.getByTestId('filter-button').click();
    for (const status of statuses) {
      await page.getByTestId('filter-status-select').selectOption(status);
      await page.waitForTimeout(PAUSE_TIMEOUT);

      const rows = page.getByRole('row').filter({ has: page.locator('td') });
      const rowCount = await rows.count();

      logger.info(`STATUS = ${status} | NODES = ${rowCount - 1}`);

      for (let i = 1; i < rowCount; i++) {
        const cells = rows.nth(i).locator('td');
        const cellCount = await cells.count();
        let rowData: string[] = [];

        for (let j = 0; j < cellCount; j++) {
          rowData.push((await cells.nth(j).textContent())?.trim() || '');
        }

        logger.info(`[${status}] Row ${i + 1}: ${rowData.join(' | ')}`);
      }

      await page.getByTestId('clear-filters-button').click();
      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test(' BMC IP, Node IP and Vendor filters', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    await page.getByTitle('Control Center').click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    await page.getByRole('link', { name: 'Karios Forge' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('filter-button').click();
    await page.getByTestId('filter-bmc-ip-input').fill('192.168.112.95');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    let rows = page.getByRole('row').filter({ has: page.locator('td') });
    let rowCount = await rows.count();

    logger.info(`BMC IP FILTER  | NODES = ${rowCount - 1}`);

    for (let i = 1; i < rowCount; i++) {
      const cells = rows.nth(i).locator('td');
      const cellCount = await cells.count();
      let rowData: string[] = [];

      for (let j = 0; j < cellCount; j++) {
        rowData.push((await cells.nth(j).textContent())?.trim() || '');
      }

      logger.info(`[BMC IP] Row ${i}: ${rowData.join(' | ')}`);
    }

    await page.getByTestId('clear-filters-button').click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // NODE IP FILTER
    await page.getByTestId('filter-node-ip-input').fill('192.168.112.95');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    rows = page.getByRole('row').filter({ has: page.locator('td') });
    rowCount = await rows.count();

    logger.info(`NODE IP FILTER  | NODES = ${rowCount - 1}`);

    for (let i = 1; i < rowCount; i++) {
      const cells = rows.nth(i).locator('td');
      const cellCount = await cells.count();
      let rowData: string[] = [];

      for (let j = 0; j < cellCount; j++) {
        rowData.push((await cells.nth(j).textContent())?.trim() || '');
      }

      logger.info(`[NODE IP] Row ${i}: ${rowData.join(' | ')}`);
    }

    await page.getByTestId('clear-filters-button').click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // ================= VENDOR FILTER =================
    const vendors = ['As', 'ASUS'];

    for (const vendor of vendors) {
      await page.getByTestId('filter-vendor-input').fill(vendor);
      await page.waitForTimeout(PAUSE_TIMEOUT);

      rows = page.getByRole('row').filter({ has: page.locator('td') });
      rowCount = await rows.count();

      logger.info(`VENDOR = ${vendor} | NODES = ${rowCount - 1}`);

      for (let i = 1; i < rowCount; i++) {
        const cells = rows.nth(i).locator('td');
        const cellCount = await cells.count();
        let rowData: string[] = [];

        for (let j = 0; j < cellCount; j++) {
          rowData.push((await cells.nth(j).textContent())?.trim() || '');
        }

        logger.info(`[VENDOR=${vendor}] Row ${i}: ${rowData.join(' | ')}`);
      }

      await page.getByTestId('clear-filters-button').click();
      await page.waitForTimeout(PAUSE_TIMEOUT);
    }

    logger.info('BMC IP, Node IP, and Vendor filter test completed successfully');
  });
  test('Mount MooseFS storage and verify mounted entry', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    await page.getByRole('link', { name: 'Karios Forge' }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'Storage' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Open Mount dialog
    await page.getByRole('button', { name: 'Mount MooseFS Storage' }).click();

    // Assert dialog fields are visible
    await expect(page.getByRole('textbox', { name: 'ID' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Server' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Port' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Directory' })).toBeVisible();

    // Fill mount details
    await page.getByRole('textbox', { name: 'ID' }).fill('1');
    await page.getByRole('textbox', { name: 'Server' }).fill(MooseFS_SERVERIP!);
    await page.getByRole('textbox', { name: 'Port' }).fill(MooseFS_PORT!);
    await page.getByRole('textbox', { name: 'Directory' }).fill('/');

    // Optional checkboxes
    await page.getByRole('checkbox', { name: 'Auto Mount on Restart' }).uncheck();
    await page.getByRole('checkbox', { name: 'Add to Datastore Information' }).uncheck();

    logger.info('Filled MooseFS mount details');

    // Submit mount
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('button', { name: 'OK' }).click();

    logger.info('MooseFS mount submitted successfully');
    await page.getByRole('cell', { name: 'Port' }).click();

    // Find the row containing the port "9421"
    const rows = page
      .getByRole('row')
      .filter({ has: page.getByRole('cell', { name: '9421', exact: true }) });
    const rowCount = await rows.count();

    if (rowCount === 0) {
      throw new Error('Mounted storage row with Port 9421 not found');
    }

    // Assume only one row matches
    const mountedRow = rows.nth(0);
    await expect(mountedRow).toBeVisible();
    logger.info('Mounted MooseFS storage row is visible');

    // Fetch all cell data in the row
    const cells = mountedRow.locator('td');
    const cellCount = await cells.count();
    let rowData: string[] = [];
    for (let i = 0; i < cellCount; i++) {
      const text = (await cells.nth(i).textContent())?.trim() || '';
      rowData.push(text);
    }

    // Unmount / remove action
    await mountedRow.getByRole('button').click();
    await page.getByRole('button', { name: 'OK' }).click();

    logger.info('Mounted MooseFS storage removed successfully');
  });

  test('iSCSI storage workflow: connect, mount, remove, destroy, disconnect', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    // Navigate to Storage section
    await page.getByRole('link', { name: 'Karios Forge' }).click();
    await page.getByRole('link', { name: 'Storage' }).click();

    // Connect to iSCSI Target
    await page.getByRole('combobox').selectOption('iscsi');
    await page.getByRole('button', { name: 'Connect to iSCSI Target' }).click();
    await page.getByRole('textbox', { name: 'Portal' }).fill(ISCSI_PORTAL!);
    await page.getByRole('textbox', { name: 'Target' }).fill(ISCSI_TARGET!);
    await page.getByRole('textbox', { name: 'Username' }).fill(ISCSI_USERNAME!);
    await page.getByRole('textbox', { name: 'Password' }).fill(ISCSI_PASSWORD!);
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info('Connected to iSCSI target successfully');

    // Mount device
    await page.getByRole('cell', { name: 'Type' }).click();
    await page.getByRole('button', { name: 'Mount' }).click();
    const deviceLabels = page.locator('div.space-y-2 input[type="checkbox"]');

    // Get the count of available devices
    const deviceCount = await deviceLabels.count();

    if (deviceCount > 0) {
      // Select the first device dynamically
      await deviceLabels.nth(0).check();
      const deviceName = await deviceLabels
        .nth(0)
        .locator('xpath=following-sibling::span')
        .textContent();
      logger.info(`Selected first device dynamically: ${deviceName?.trim()}`);
    } else {
      logger.warn('No devices found to select');
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Mount' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info('iSCSI device mounted successfully');

    // Remove device
    await page.getByRole('button', { name: 'Remove device' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info('iSCSI device removed successfully');

    // Remount device
    await page.getByRole('button', { name: 'Mount' }).click();
    const deviceLabels1 = page.locator('div.space-y-2 input[type="checkbox"]');

    // Get the count of available devices
    const deviceCount1 = await deviceLabels.count();

    if (deviceCount1 > 0) {
      // Select the first device dynamically
      await deviceLabels1.nth(0).check();
      const deviceName = await deviceLabels
        .nth(0)
        .locator('xpath=following-sibling::span')
        .textContent();
      logger.info(`Selected first device dynamically: ${deviceName?.trim()}`);
    } else {
      logger.warn('No devices found to select');
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Mount' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info('iSCSI device remounted successfully');

    // Destroy path
    await page.getByRole('button', { name: 'Destroy path' }).click();
    await page.getByRole('button', { name: 'Remove device' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info('iSCSI device path destroyed successfully');

    // Disconnect iSCSI
    await page.getByRole('button', { name: 'Disconnect' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info('Disconnected from iSCSI target successfully');

    logger.info('iSCSI storage workflow executed successfully');
  });

  test('getting event logs', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    logger.info('getting event logs test started');
    // Navigate to Karios Forge
    await page.getByRole('link', { name: 'Karios Forge' }).click();

    // Go to Event Logs and display the first log
    await page.getByRole('link', { name: 'Event logs' }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);
    const firstEventLog = await page.locator('.border.rounded-lg').first().textContent();
    logger.info(`First Event log: ${firstEventLog?.trim()}`);
    logger.info('getting event logs test completed successfully');
  });
});
