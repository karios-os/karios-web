import { test, expect, Page } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');
const PAUSE_TIMEOUT = parseInt(process.env.PAUSE_TIMEOUT || '2000');
const ACTION_TIMEOUT = parseInt(process.env.ACTION_TIMEOUT || '5000');
const TEST_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000') * 40;
test.setTimeout(TEST_TIMEOUT);
const logger = createTestLogger('StorageManagementTests');

let serverIds: string[] = [];
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

test.describe('Server Management Tests (Authenticated)', () => {
  // Use pre-authenticated session for all tests in this suite
  test.use({ storageState: 'playwright/.auth/user.json' });
  test('collect all server IDs for storage management tests', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    await page.getByTitle('Control Center').click();
    await page.locator('button[title*="Expand"]').click();

    serverIds = await getServerIds(page);
    logger.info(`Collected server IDs: ${serverIds.join(', ')}`);

    expect(serverIds.length).toBeGreaterThan(0);
    logger.info(`Total servers found: ${serverIds.length}`);
  });

  test('Create ZPool - validate no disks available scenario', async ({ page }) => {
    logger.info('Starting test: Create ZPool - validate no disks available scenario');

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
      logger.info(`Testing server id : ${serverId}`);

      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByRole('link', { name: 'Storage' }).click();

      await page.getByRole('button', { name: 'Create Pool' }).click();
      await page.getByTestId('zpool-name-input').fill('zpool1');

      const createBtn = page.getByTestId('create-zpool-button');

      // Case 1: No disks available → button disabled
      if (await createBtn.isDisabled()) {
        logger.info('No disks available to create ZPool');

        await expect(page.getByText('No disks are available')).toBeVisible();

        logger.info('Verified: ZPool creation blocked due to no disks');
        await page.getByRole('button', { name: 'Close' }).click();
        return;
      }

      // Disks available → create pool
      //await expect(createBtn).toBeEnabled();
      await createBtn.click();

      await page.getByRole('button', { name: 'OK' }).click();
      logger.info('ZPool created successfully');
      await page.waitForTimeout(PAUSE_TIMEOUT);
    }
  });

  test('Create Datastore using first available pool and dataset', async ({ page }) => {
    logger.info('Starting test: Create Datastore using available pool and dataset');
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
    await page.waitForTimeout(PAUSE_TIMEOUT);

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      logger.info(`Testing server id : ${serverId}`);

      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByRole('link', { name: 'Storage' }).click();
      //Storage Pools
      const storagePoolsHeader = page.getByTestId('storage-pools-header');
      await expect(storagePoolsHeader).toBeVisible();

      const createDatastoreBtn = page.getByRole('button', { name: 'Create Datastore' });
      await expect(createDatastoreBtn).toBeVisible();
      await createDatastoreBtn.click();

      // Enter datastore name
      const datastoreNameInput = page.getByTestId('datastore-name-input');
      await expect(datastoreNameInput).toBeVisible();
      const uniqueName = `datastore-${Date.now()}`;
      await datastoreNameInput.fill(uniqueName);

      // Select Pool
      const poolSelect = page.getByTestId('datastore-pool-select');
      await expect(poolSelect).toBeVisible();
      logger.info('Selecting first available pool for datastore');

      // Open Dataset dropdown
      const datasetDropdown = page.getByTestId('datastore-dataset-dropdown');
      await expect(datasetDropdown).toBeVisible();
      await datasetDropdown.click();

      // Wait for dataset list to load
      const datasetItems = page.getByRole('listitem');
      await expect(datasetItems.first()).toBeVisible();

      // Capture & click first dataset
      const selectedDataset = (await datasetItems.first().textContent())?.trim();
      await datasetItems.first().click();
      logger.info(`Selected Dataset: ${selectedDataset}`);

      // Click Create
      const createBtn = page.getByTestId('create-datastore-button');
      await expect(createBtn).toBeVisible();
      await createBtn.click();
      await page.waitForTimeout(PAUSE_TIMEOUT);
      logger.info('Datastore creation test completed successfully');
    }
  });

  test('Storage Management - Pools, Datastores, Available Disks verification', async ({ page }) => {
    logger.info(
      'Starting test: Storage Management - Pools, Datastores, Available Disks verification'
    );

    // Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc');
    logger.info(`Landed on page: ${currentUrl}`);

    // Click Control Center title
    await page.getByTitle('Control Center').click();
    logger.info('Navigated to Control Center');
    await page.waitForTimeout(LOAD_TIMEOUT);

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      logger.info(`Testing server id : ${serverId}`);

      // Navigate to Storage section
      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByRole('link', { name: 'Storage' }).click();

      // STORAGE POOLS
      await page.getByRole('button', { name: 'Storage Pools' }).click();
      await expect(page.getByTestId('storage-pools-header')).toBeVisible();

      const poolName = await page.getByTestId('pool-name-zroot').textContent();
      const poolCapacity = await page.getByTestId('pool-capacity-zroot').textContent();

      logger.info(`Pool Name: ${poolName?.trim()}`);
      logger.info(`Pool Capacity: ${poolCapacity?.trim()}`);

      // DATASTORES
      await page.getByRole('button', { name: 'Datastores' }).click();
      await expect(page.getByRole('heading', { name: 'Datastores' })).toBeVisible();

      const noDatastoreMsg = page.getByText('No datastores available');

      if (await noDatastoreMsg.isVisible()) {
        logger.info('Datastores: No datastores found');
      } else {
        const firstDatastore = page.getByTestId('datastores-view').locator('> div').first();

        await expect(firstDatastore).toBeVisible();
        const datastoreText = (await firstDatastore.textContent())?.replace(/\s+/g, ' ').trim();
        logger.info(`First Datastore: ${datastoreText}`);
      }

      // AVAILABLE DISKS
      await page.getByRole('button', { name: 'Datastores' }).click();
      await page.getByRole('button', { name: 'Available Disks' }).click();
      await expect(page.getByTestId('available-disks-heading')).toBeVisible();

      const noDisksMessage = page.getByText('No disks are available');

      if (await noDisksMessage.isVisible()) {
        logger.info('Available Disks: No disks are available');
      } else {
        const disks = page.getByTestId('available-disks-list').locator('> div');
        const diskCount = await disks.count();

        logger.info(`Available Disks Count: ${diskCount}`);
        expect(diskCount).toBeGreaterThan(0);
      }
      await page.waitForTimeout(PAUSE_TIMEOUT);
      logger.info(`Completed storage validation for server: ${serverName}`);
    }
  });

  test('Storage pool capacity and device actions validation', async ({ page }) => {
    logger.info('Starting test: Storage pool capacity and device actions validation');
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
    await page.waitForTimeout(ACTION_TIMEOUT);

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      logger.info(`Testing server id : ${serverId}`);

      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByRole('link', { name: 'Storage' }).click();
      // Open Storage Pools
      const storagePoolsHeader = page.getByTestId('storage-pools-header');
      await expect(storagePoolsHeader).toBeVisible();

      // Read pool capacity
      const capacity = await page.getByTestId('pool-capacity-zroot').textContent();

      logger.info(`zroot Pool Capacity: ${capacity?.trim()}`);

      // Open Disks section
      await page.getByRole('heading', { name: 'Disks' }).click();

      //ADD SLOG
      await page.getByTestId('pool-actions-button-zroot').click();
      await page.getByRole('button', { name: 'Add SLOG Device' }).click();

      await expect(page.getByRole('heading', { name: 'Add SLOG Device to zroot' })).toBeVisible();

      if (await page.getByText(/No available disks for SLOG/i).isVisible()) {
        logger.info('No available disks for SLOG');
        await page.getByRole('button', { name: 'Close' }).click();
      }

      //ADD L2ARC
      await page.getByTestId('pool-actions-button-zroot').click();
      await page.getByRole('button', { name: 'Add L2ARC Device' }).click();

      if (await page.getByText(/No available disks for L2ARC/i).isVisible()) {
        logger.info('No available disks for L2ARC');
        await page.getByRole('button', { name: 'Close' }).click();
      }

      //REMOVE DEVICES
      await page.getByTestId('pool-actions-button-zroot').click();
      await page.getByRole('button', { name: 'Remove Devices' }).click();

      if (await page.getByText(/No devices available/i).isVisible()) {
        logger.info('No devices available to remove');
        await page.getByRole('button', { name: 'Close' }).click();
      }

      logger.info('Storage pool validation completed');
    }
  });

  test('Create, view and delete dataset ', async ({ page }) => {
    logger.info('Starting test: dataset create,view and delete');
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
    await page.waitForTimeout(ACTION_TIMEOUT);

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      logger.info(`Testing server id : ${serverId}`);

      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByRole('link', { name: 'Storage' }).click();
      // Open Storage Pools
      const storagePoolsHeader = page.getByTestId('storage-pools-header');
      await expect(storagePoolsHeader).toBeVisible();

      // get first pool name
      const poolNameElement = page.locator('[data-testid^="pool-name-"]').first();
      await expect(poolNameElement).toBeVisible();

      const fullText = (await poolNameElement.textContent())?.trim();
      expect(fullText).toBeTruthy();

      const poolName = fullText!.split('(')[0].trim();
      logger.info(`Detected Pool Name: ${poolName}`);

      // CREATE DATASET
      await page.getByRole('button', { name: 'Create Dataset Information' }).click();

      const datasetName = `testdataset`;
      const datasetNameInput = page.getByRole('textbox', { name: 'Dataset Name' });
      await expect(datasetNameInput).toBeVisible();
      await datasetNameInput.fill(datasetName);
      await page
        .getByTestId('create-dataset-form-zroot')
        .getByRole('button', { name: 'Create' })
        .click();

      await page.getByRole('button', { name: 'OK' }).click();

      logger.info(`Dataset created: ${poolName}/${datasetName}`);

      // VIEW DATASETS
      await page.getByRole('button', { name: 'View Datasets Information' }).click();
      await page.getByTestId('dataset-type-filter-zroot').selectOption('filesystem');

      const fullDatasetName = `${poolName}/${datasetName}`;

      // FIND DATASET CARD (pool/dataset)
      const datasetCard = page
        .locator('p')
        .filter({ hasText: fullDatasetName })
        .first()
        .locator('..')
        .locator('..');

      await expect(datasetCard).toBeVisible();
      logger.info(`Dataset found: ${fullDatasetName}`);

      // CLICK DELETE FOR THAT DATASET
      const deleteButton = datasetCard.getByTestId('delete-dataset-button');
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // CONFIRM DELETE
      const confirmInput = page.getByRole('textbox', { name: fullDatasetName });
      await expect(confirmInput).toBeVisible();
      await confirmInput.fill(fullDatasetName);

      await page.getByRole('button', { name: 'Yes, Delete' }).click();

      // VERIFY DELETION
      await expect(page.locator('p').filter({ hasText: fullDatasetName })).toHaveCount(0);

      logger.info(`Dataset deleted successfully: ${fullDatasetName}`);
    }
  });

  test('Zvol creation and deletion workflow ', async ({ page }) => {
    logger.info('Starting test: Zvol creation and deletion workflow ');
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
    await page.waitForTimeout(ACTION_TIMEOUT);

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      logger.info(`Testing server id : ${serverId}`);

      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByRole('link', { name: 'Storage' }).click();
      // Open Storage Pools
      const storagePoolsHeader = page.getByTestId('storage-pools-header');
      await expect(storagePoolsHeader).toBeVisible();

      // get first pool name
      const poolNameElement = page.locator('[data-testid^="pool-name-"]').first();
      await expect(poolNameElement).toBeVisible();

      const fullText = (await poolNameElement.textContent())?.trim();
      expect(fullText).toBeTruthy();

      const poolName = fullText!.split('(')[0].trim();
      logger.info(`Detected Pool Name: ${poolName}`);

      // CREATE DATASET
      await page.getByRole('button', { name: 'Create Zvol Information' }).click();

      const zvolName = `testzvol`;
      await page.getByRole('textbox', { name: 'Zvol Name' }).click();
      await page.getByRole('textbox', { name: 'Zvol Name' }).fill(zvolName);
      await page.getByRole('textbox', { name: 'Size' }).click();
      await page.getByRole('textbox', { name: 'Size' }).fill('2');
      await page
        .getByTestId('create-zvol-form-zroot')
        .getByRole('button', { name: 'Create Zvol' })
        .click();

      logger.info(`zvol created: ${poolName}/${zvolName}`);

      // VIEW DATASETS
      await page.getByRole('button', { name: 'View Datasets Information' }).click();
      await page.getByTestId('dataset-type-filter-zroot').selectOption('volume');

      const fullDatasetName = `${poolName}/${zvolName}`;

      const zvolCard = page
        .locator('p')
        .filter({ hasText: fullDatasetName })
        .first()
        .locator('..')
        .locator('..');

      await expect(zvolCard).toBeVisible();
      logger.info(`zvol found: ${fullDatasetName}`);

      const deleteButton = zvolCard.getByTestId('delete-dataset-button');
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      const confirmInput = page.getByRole('textbox', { name: fullDatasetName });
      await expect(confirmInput).toBeVisible();
      await confirmInput.fill(fullDatasetName);

      await page.getByRole('button', { name: 'Yes, Delete' }).click();

      // VERIFY DELETION
      await expect(page.locator('p').filter({ hasText: fullDatasetName })).toHaveCount(0);

      logger.info(`zvol deleted successfully: ${fullDatasetName}`);
    }
  });

  test('End-to-End Dataset and Snapshot Creation and Deletion Workflow ', async ({ page }) => {
    logger.info('Starting test: dataset,Snapshot creation and delection');
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
    await page.waitForTimeout(ACTION_TIMEOUT);

    for (const serverId of serverIds) {
      await page.getByTestId(serverId).click();
      logger.info('Clicked server node');
      const serverName = await page.getByTestId(serverId).innerText();
      logger.info(`Testing server: ${serverName}`);
      logger.info(`Testing server id : ${serverId}`);

      await page.getByRole('link', { name: 'Home' }).click();
      await page.getByRole('link', { name: 'Storage' }).click();
      // Open Storage Pools
      const storagePoolsHeader = page.getByTestId('storage-pools-header');
      await expect(storagePoolsHeader).toBeVisible();

      // get first pool name
      const poolNameElement = page.locator('[data-testid^="pool-name-"]').first();
      await expect(poolNameElement).toBeVisible();

      const fullText = (await poolNameElement.textContent())?.trim();
      expect(fullText).toBeTruthy();

      const poolName = fullText!.split('(')[0].trim();
      logger.info(`Detected Pool Name: ${poolName}`);

      // CREATE DATASET
      await page.getByRole('button', { name: 'Create Dataset Information' }).click();

      let datasetName = `testdataset`;
      const datasetNameInput = page.getByRole('textbox', { name: 'Dataset Name' });
      await expect(datasetNameInput).toBeVisible();
      await datasetNameInput.fill(datasetName);
      await page
        .getByTestId('create-dataset-form-zroot')
        .getByRole('button', { name: 'Create' })
        .click();

      await page.getByRole('button', { name: 'OK' }).click();

      logger.info(`Dataset created: ${poolName}/${datasetName}`);

      // VIEW DATASETS
      await page.getByRole('button', { name: 'View Datasets Information' }).click();
      await page.getByTestId('dataset-type-filter-zroot').selectOption('filesystem');

      const fullDatasetName = `${poolName}/${datasetName}`;
      datasetName = fullDatasetName;

      // FIND DATASET CARD (pool/dataset)
      const datasetCard = page
        .locator('p')
        .filter({ hasText: fullDatasetName })
        .first()
        .locator('..')
        .locator('..');

      await expect(datasetCard).toBeVisible();
      logger.info(`Dataset found: ${fullDatasetName}`);

      //snapshot create ,delete
      const snapshotinputButton = datasetCard.getByTestId('snapshot-name-input');
      await expect(snapshotinputButton).toBeVisible();
      await snapshotinputButton.click();

      const snapshotname = 'testsnapshot';
      await datasetCard.getByTestId('snapshot-name-input').fill(snapshotname);

      const snapshotButton = datasetCard.getByTestId('create-snapshot-button');
      await expect(snapshotButton).toBeVisible();
      await snapshotButton.click();
      logger.info('snapshot created');
      await page.waitForTimeout(PAUSE_TIMEOUT);

      await page.getByTestId('dataset-type-filter-zroot').selectOption('snapshot');
      const verifySnapName = `${fullDatasetName}@${snapshotname}`;
      const snapshotCard = page
        .getByTestId('datasets-section-zroot')
        .locator('div')
        .filter({ hasText: `${fullDatasetName}@` })
        .first();

      const snapdeleteButton = snapshotCard.getByTestId('delete-dataset-button');
      await expect(snapdeleteButton).toBeVisible();
      await snapdeleteButton.click();

      await page.getByRole('textbox', { name: verifySnapName }).click();
      await page.getByRole('textbox', { name: verifySnapName }).fill(verifySnapName);
      await page.getByRole('button', { name: 'Yes, Delete' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // VERIFY DELETION
      await expect(page.locator('p').filter({ hasText: verifySnapName })).toHaveCount(0);

      logger.info(`snapshot deleted successfully: ${verifySnapName}`);

      await page.getByTestId('dataset-type-filter-zroot').selectOption('filesystem');
      await expect(datasetCard).toBeVisible();
      logger.info(`Dataset found: ${fullDatasetName}`);

      // CLICK DELETE FOR THAT DATASET
      const deleteButton = datasetCard.getByTestId('delete-dataset-button');
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // CONFIRM DELETE
      const confirmInput = page.getByRole('textbox', { name: fullDatasetName });
      await expect(confirmInput).toBeVisible();
      await confirmInput.fill(fullDatasetName);

      await page.getByRole('button', { name: 'Yes, Delete' }).click();

      // VERIFY DELETION
      await expect(page.locator('p').filter({ hasText: fullDatasetName })).toHaveCount(0);

      logger.info(`Dataset deleted successfully: ${fullDatasetName}`);
    }
  });
});
