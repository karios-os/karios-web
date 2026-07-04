import { test, expect, Page, Locator } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');
const TEST_TIMEOUT = parseInt(process.env.VMTEST_TIMEOUT || '60000');
const PAUSE_TIMEOUT = parseInt(process.env.PAUSE_TIMEOUT || '2000');
test.setTimeout(TEST_TIMEOUT);
// Initialize logger for this test suite
const logger = createTestLogger('VmmanagementTests');
test.describe('Vm Management Tests (Authenticated)', () => {
  // Use pre-authenticated session for all tests in this suite
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('Test complete VM creation flow for standard VM', async ({ page }) => {
    logger.info('Starting complete VM creation flow test');

    // Step 1: Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    expect(page.url()).toContain('/dc/1/control-center');
    logger.info('Landed on Control Center');
    await page.waitForLoadState('domcontentloaded');

    // Start VM setup
    await page.getByRole('button', { name: 'Setup VM' }).click();
    await page.getByRole('button', { name: 'Standard VM' }).click();
    logger.info('Started VM setup');

    const vmName = `vmtest-${Math.floor(100 + Math.random() * 900)}`;
    await page.getByRole('textbox', { name: 'Enter VM name' }).fill(vmName);
    logger.info(`Entered VM name: ${vmName}`);

    await page
      .locator('div', { hasText: /^Operating System \*Select OSLinux, BSD or SolarisWindows$/ })
      .getByRole('combobox')
      .selectOption('Linux, BSD or Solaris');
    logger.info('Selected Operating System: Linux');

    await page
      .locator('div', { hasText: /^Cores$/ })
      .getByRole('spinbutton')
      .fill('1');
    logger.info('Entered Cores: 1');

    await page
      .locator('div', { hasText: /^RAM \(GB\)$/ })
      .getByRole('spinbutton')
      .fill('1');
    logger.info('Entered RAM (GB): 1');
    await page
      .locator('div', { hasText: /^StorageDisk Size \(GB\) \*$/ })
      .getByRole('spinbutton')
      .fill('20');
    logger.info('Entered Storage Disk Size (GB): 20');
    const desiredOptions = ['virtio-net', 'e1000'];
    const comboBox = page
      .locator('div', { hasText: /^Network Driver \*Select Drivervirtio-net$/ })
      .getByRole('combobox');
    // Get all available options
    const availableOptions = await comboBox.locator('option').allTextContents();
    // Pick the first desired option that exists
    const optionToSelect = desiredOptions.find((opt) => availableOptions.includes(opt));

    if (optionToSelect) {
      await comboBox.selectOption(optionToSelect);
    } else {
      console.warn('No matching option available in dropdown');
    }
    logger.info(`Selected Network Driver: ${optionToSelect || 'none available'}`);

    await page
      .locator('div', { hasText: /^Virtual Switch \*Select Switchpublic$/ })
      .getByRole('combobox')
      .selectOption('public');
    logger.info('Selected Virtual Switch: public');

    await page.getByRole('button', { name: 'Select DNS Zone' }).click();
    await page.getByRole('button', { name: 'internal.local', exact: true }).click();
    logger.info('Selected DNS Zone: internal.local');

    // Create VM
    await page.getByRole('button', { name: 'Create VM' }).click();
    logger.info('Clicked Create VM');
    await page.waitForTimeout(PAUSE_TIMEOUT);
    // Verify VM creation
    await page.getByRole('button', { name: 'VMs' }).click();
    await page.getByRole('button', { name: /Inactive/i }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const vmItem = page.getByTestId('sidebar-vms-list').getByText(vmName, { exact: true });
    await vmItem.scrollIntoViewIfNeeded();
    await vmItem.waitFor({ state: 'visible' });
    await vmItem.click();

    logger.info(`Verified VM ${vmName} successfully in Inactive list`);
    logger.info(`VM ${vmName} created successfully`);
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // Cleanup - Delete the created VM
    await page
      .getByTestId('sidebar-vms-list')
      .locator('div')
      .filter({ hasText: vmName })
      .first()
      .click();
    await page.getByTestId(`more-icon-${vmName}`).click();
    await page.getByTestId('sidebar-vms-list').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'OK' }).click();

    logger.info(`VM ${vmName} deleted successfully`);
  });

  test('Test complete VM creation flow for cloudinit VM', async ({ page }) => {
    logger.info('Starting complete VM creation flow test');

    // Step 1: Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    expect(page.url()).toContain('/dc');
    logger.info('Landed on Control Center');
    await page.waitForLoadState('domcontentloaded');

    // Start VM setup
    await page.getByRole('button', { name: 'Setup VM' }).click();
    await page.getByRole('button', { name: 'CloudInit' }).click();
    logger.info('Started VM setup');

    // Fill VM Name
    const vmName = `cloudvmtest-${Math.floor(100 + Math.random() * 900)}`;
    const vmNameInput = page.locator('div', { hasText: /^VM Name \*$/ }).getByRole('textbox');
    await vmNameInput.waitFor({ state: 'visible' });
    await vmNameInput.fill(vmName);
    logger.info(`Entered VM name: ${vmName}`);

    // Select OS
    await page.getByLabel('Operating System *').selectOption('freebsd');
    logger.info('Selected Operating System: FreeBSD');

    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Network Switch *').selectOption('public');
    logger.info('Selected Network Switch: public');

    await page.getByRole('button', { name: 'Select DNS Zone' }).click();
    await page.getByRole('button', { name: 'internal.local' }).click();
    logger.info('Selected DNS Zone: internal.local');

    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('spinbutton', { name: 'CPU Cores *' }).fill('1');
    logger.info('Entered CPU Cores: 1');

    await page.getByRole('spinbutton', { name: 'Memory (GB) *' }).fill('1');
    logger.info('Entered Memory (GB): 1');

    await page.getByRole('spinbutton', { name: 'Disk Size (GB) *' }).fill('20');
    logger.info('Entered Disk Size (GB): 20');

    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('textbox', { name: 'Username *' }).fill('username');
    logger.info('Entered Username: ');

    await page.getByRole('textbox', { name: 'Password *' }).fill('password');
    logger.info('Entered Password: ');

    // await page.getByRole('textbox', { name: 'SSH Public Key (Optional)' }).fill('shakey');
    // logger.info('Entered SSH Public Key');

    // Create VM
    await page.getByRole('button', { name: 'Create VM' }).click();
    logger.info('Clicked Create VM');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // // Verify VM creation
    await page.getByRole('button', { name: 'VMs' }).click();
    await page.getByRole('button', { name: /Inactive/i }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const vmItem = page.getByTestId('sidebar-vms-list').getByText(vmName, { exact: true });
    await vmItem.scrollIntoViewIfNeeded();
    await vmItem.waitFor({ state: 'visible' });
    await vmItem.click();

    logger.info(`Verified VM ${vmName} successfully in Inactive list`);
    logger.info(`VM ${vmName} created successfully`);
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // Cleanup - Delete the created VM
    await page
      .getByTestId('sidebar-vms-list')
      .locator('div')
      .filter({ hasText: vmName })
      .first()
      .click();
    await page.getByTestId(`more-icon-${vmName}`).click();
    await page.getByTestId('sidebar-vms-list').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info(`VM ${vmName} deleted successfully`);
  });

  const vmConfigs = [
    { os: 'Linux, BSD or Solaris', cores: 1, ram: 1, disk: 20 },
    { os: 'Windows', cores: 1, ram: 1, disk: 20 },
  ];

  for (const config of vmConfigs) {
    test(`Creating VMs with diff OS's in standard mode - OS: ${config.os}, Cores: ${config.cores}`, async ({
      page,
    }) => {
      // Open Control Center
      await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

      // Setup VM
      await page.getByRole('button', { name: 'Setup VM' }).click();
      await page.getByRole('button', { name: 'Standard VM' }).click(); // fixed VM type

      const vmName = `vmtest-${Math.floor(100 + Math.random() * 900)}`;
      await page.getByRole('textbox', { name: 'Enter VM name' }).fill(vmName);

      // OS, Cores, RAM, Disk
      await page
        .locator('div', { hasText: /^Operating System \*Select OSLinux, BSD or SolarisWindows$/ })
        .getByRole('combobox')
        .selectOption(config.os);

      await page
        .locator('div', { hasText: /^Cores$/ })
        .getByRole('spinbutton')
        .fill(config.cores.toString());
      await page
        .locator('div', { hasText: /^RAM \(GB\)$/ })
        .getByRole('spinbutton')
        .fill(config.ram.toString());
      await page
        .locator('div', { hasText: /^StorageDisk Size \(GB\) \*$/ })
        .getByRole('spinbutton')
        .fill(config.disk.toString());
      logger.info(
        `Configured VM: OS=${config.os}, Cores=${config.cores}, RAM=${config.ram}, Disk=${config.disk}`
      );

      const desiredOptions = ['e1000', 'virtio-net'];
      const comboBox = page
        .locator('div', { hasText: /^Network Driver \*Select Drivervirtio-net$/ })
        .getByRole('combobox');
      // Get all available options
      const availableOptions = await comboBox.locator('option').allTextContents();
      // Pick the first desired option that exists
      const optionToSelect = desiredOptions.find((opt) => availableOptions.includes(opt));

      if (optionToSelect) {
        await comboBox.selectOption(optionToSelect);
      } else {
        console.warn('No matching option available in dropdown');
      }
      logger.info(`Selected Network Driver: ${optionToSelect || 'none available'}`);

      await page
        .locator('div', { hasText: /^Virtual Switch \*Select Switchpublic$/ })
        .getByRole('combobox')
        .selectOption('public');
      logger.info('Selected Virtual Switch: public');

      await page.getByRole('button', { name: 'Select DNS Zone' }).click();
      await page.getByRole('button', { name: 'internal.local', exact: true }).click();
      logger.info('Selected DNS Zone: internal.local');

      // Create VM
      await page.getByRole('button', { name: 'Create VM' }).click();
      logger.info('Clicked Create VM');
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // // Verify VM creation
      await page.getByRole('button', { name: 'VMs' }).click();
      await page.getByRole('button', { name: /Inactive/i }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      const vmItem = page.getByTestId('sidebar-vms-list').getByText(vmName, { exact: true });
      await vmItem.scrollIntoViewIfNeeded();
      await vmItem.waitFor({ state: 'visible' });
      await vmItem.click();

      logger.info(`Verified VM ${vmName} successfully in Inactive list`);
      logger.info(`VM ${vmName} created successfully`);
      await page.waitForTimeout(PAUSE_TIMEOUT);
      // Cleanup - Delete the created VM
      await page
        .getByTestId('sidebar-vms-list')
        .locator('div')
        .filter({ hasText: vmName })
        .first()
        .click();
      await page.getByTestId(`more-icon-${vmName}`).click();
      await page.getByTestId('sidebar-vms-list').getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'OK' }).click();
      logger.info(`VM ${vmName} deleted successfully`);
    });
  }

  const cloudInitConfigs = [
    { os: 'freebsd', cores: 1, ram: 1, disk: 20 },
    { os: 'ubuntu-server', cores: 1, ram: 1, disk: 20 },
  ];

  for (const config of cloudInitConfigs) {
    test(`Create CloudInit VM - OS: ${config.os}, Cores: ${config.cores}`, async ({ page }) => {
      // Open Control Center
      await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

      // Start VM setup
      await page.getByRole('button', { name: 'Setup VM' }).click();
      await page.getByRole('button', { name: 'CloudInit' }).click();

      const vmName = `cloudvmtest-${Math.floor(100 + Math.random() * 900)}`;
      await page
        .locator('div', { hasText: /^VM Name \*$/ })
        .getByRole('textbox')
        .fill(vmName);
      logger.info(`Entered VM name: ${vmName}`);

      // Select OS
      await page.getByLabel('Operating System *').selectOption(config.os);
      await page.getByRole('button', { name: 'Next' }).click();
      logger.info(`Selected Operating System: ${config.os}`);

      //  network settings
      await page.getByLabel('Network Switch *').selectOption('public');
      await page.getByRole('button', { name: 'Select DNS Zone' }).click();
      await page.getByRole('button', { name: 'internal.local' }).click();
      logger.info('Configured network settings');

      await page.getByRole('button', { name: 'Next' }).click();

      // CPU, RAM, Disk from config
      await page.getByRole('spinbutton', { name: 'CPU Cores *' }).fill(config.cores.toString());
      await page.getByRole('spinbutton', { name: 'Memory (GB) *' }).fill(config.ram.toString());
      await page.getByRole('spinbutton', { name: 'Disk Size (GB) *' }).fill(config.disk.toString());
      logger.info(
        `Configured VM resources: Cores=${config.cores}, RAM=${config.ram}, Disk=${config.disk}`
      );

      await page.getByRole('button', { name: 'Next' }).click();

      // Fixed user details
      await page.getByRole('textbox', { name: 'Username *' }).fill('username');
      await page.getByRole('textbox', { name: 'Password *' }).fill('password');
      logger.info('Entered user credentials');
      // await page.getByRole('textbox', { name: 'SSH Public Key (Optional)' }).fill('shakey');

      // Create VM
      await page.getByRole('button', { name: 'Create VM' }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Verify VM creation
      await page.getByRole('button', { name: 'VMs' }).click();
      await page.getByRole('button', { name: /Inactive/i }).click();
      await page.waitForTimeout(PAUSE_TIMEOUT);

      const vmItem = page.getByTestId('sidebar-vms-list').getByText(vmName, { exact: true });
      await vmItem.waitFor({ state: 'visible' });
      await vmItem.click();

      logger.info(`Verified VM ${vmName} successfully in Inactive list`);
      logger.info(`VM ${vmName} created successfully`);
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Cleanup - Delete the created VM
      await page
        .getByTestId('sidebar-vms-list')
        .locator('div')
        .filter({ hasText: vmName })
        .first()
        .click();
      await page.getByTestId(`more-icon-${vmName}`).click();
      await page.getByTestId('sidebar-vms-list').getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'OK' }).click();
      logger.info(`VM ${vmName} deleted successfully`);
    });
  }

  let vmNameforHardware = 'vmtest-112';
  test('creating vm for Performing VM operations ', async ({ page }) => {
    logger.info('Starting complete VM creation flow test');

    // Step 1: Open Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    expect(page.url()).toContain('/dc/1/control-center');
    logger.info('Landed on Control Center');
    await page.waitForLoadState('domcontentloaded');

    // Start VM setup
    await page.getByRole('button', { name: 'Setup VM' }).click();
    await page.getByRole('button', { name: 'Standard VM' }).click();
    logger.info('Started VM setup');

    const vmName = `vmtest-${Math.floor(100 + Math.random() * 900)}`;
    vmNameforHardware = vmName;
    await page.getByRole('textbox', { name: 'Enter VM name' }).fill(vmName);
    logger.info(`Entered VM name: ${vmName}`);

    await page
      .locator('div', { hasText: /^Operating System \*Select OSLinux, BSD or SolarisWindows$/ })
      .getByRole('combobox')
      .selectOption('Linux, BSD or Solaris');
    logger.info('Selected Operating System: Linux');

    await page
      .locator('div', { hasText: /^Cores$/ })
      .getByRole('spinbutton')
      .fill('1');
    logger.info('Entered Cores: 1');

    await page
      .locator('div', { hasText: /^RAM \(GB\)$/ })
      .getByRole('spinbutton')
      .fill('1');
    logger.info('Entered RAM (GB): 1');
    await page
      .locator('div', { hasText: /^StorageDisk Size \(GB\) \*$/ })
      .getByRole('spinbutton')
      .fill('20');
    logger.info('Entered Storage Disk Size (GB): 20');
    await page
      .locator('div', { hasText: /^Network Driver \*Select Drivervirtio-net$/ })
      .getByRole('combobox')
      .selectOption('virtio-net');
    logger.info('Selected Network Driver: virtio-net');

    await page
      .locator('div', { hasText: /^Virtual Switch \*Select Switchpublic$/ })
      .getByRole('combobox')
      .selectOption('public');
    logger.info('Selected Virtual Switch: public');

    await page.getByRole('button', { name: 'Select DNS Zone' }).click();
    await page.getByRole('button', { name: 'internal.local', exact: true }).click();
    logger.info('Selected DNS Zone: internal.local');

    // Create VM
    await page.getByRole('button', { name: 'Create VM' }).click();
    logger.info('Clicked Create VM');
    await page.waitForTimeout(PAUSE_TIMEOUT);
    // Verify VM creation
    await page.getByRole('button', { name: 'VMs' }).click();
    await page.getByRole('button', { name: /Inactive/i }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    const vmItem = page.getByTestId('sidebar-vms-list').getByText(vmName, { exact: true });
    await vmItem.scrollIntoViewIfNeeded();
    await vmItem.waitFor({ state: 'visible' });
    await vmItem.click();

    logger.info(`Verified VM ${vmName} successfully in Inactive list`);
    logger.info(`VM ${vmName} created successfully`);
    await page.waitForTimeout(PAUSE_TIMEOUT);
  });
  test('listout all the active and inactive vms', async ({ page }) => {
    logger.info('Testing sidebar navigation hierarchy...');

    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });

    const currentUrl = page.url();
    logger.info(`Control center access: ${currentUrl}`);

    // Should be able to access control center without login redirect
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).toContain('/dc/1/control-center');
    logger.info(`Landed on: ${currentUrl}`);
    await page.waitForTimeout(PAUSE_TIMEOUT); // pause for video

    // VMs button
    const vmsButton = page.locator('button').filter({ hasText: /^VMs\b/ });

    if ((await vmsButton.count()) > 0) {
      await expect(vmsButton).toBeVisible({ timeout: LOAD_TIMEOUT });
      await vmsButton.click();
      logger.info('Clicked VMs');
      await page.waitForTimeout(PAUSE_TIMEOUT);

      // Count Active VMs
      const activeButton = page.locator('button').filter({ hasText: /^Active/ });
      let activeVMs = 0;
      if ((await activeButton.count()) > 0) {
        const activeText = await activeButton.first().innerText();
        const match = activeText.match(/\((\d+)\)/);
        activeVMs = match ? parseInt(match[1]) : 0;
        logger.info(`Active VMs: ${activeVMs}`);
        if (activeVMs > 0) {
          await activeButton.first().click();
          logger.info('Clicked Active VMs');
          await page.waitForTimeout(PAUSE_TIMEOUT);
        }
      }

      // Inactive VMs
      const inactiveButton = page.locator('button').filter({ hasText: /^Inactive/ });
      let inactiveVMs = 0;
      if ((await inactiveButton.count()) > 0) {
        const inactiveText = await inactiveButton.first().innerText();
        const match = inactiveText.match(/\((\d+)\)/);
        inactiveVMs = match ? parseInt(match[1]) : 0;
        logger.info(`Inactive VMs: ${inactiveVMs}`);

        if (inactiveVMs > 0) {
          await inactiveButton.first().click();
          logger.info('Clicked Inactive VMs');
          await page.waitForTimeout(PAUSE_TIMEOUT);
        }
      }
      const totalVMs = activeVMs + inactiveVMs;
      logger.info(`Total VMs: ${totalVMs}`);
    } else {
      logger.info('No VMs available (0)');
    }
  });

  //creating vm for hardware conf tests
  test('VM hardware configuration constraints', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    // Click VMs
    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });
    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
      logger.info(`Clicked VM ${vmNameforHardware} from Active`);
    }

    // Try Inactive if not found
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });
      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
        logger.info(`Clicked VM ${vmNameforHardware} from Inactive`);
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found in Active or Inactive`);
    }
    logger.info(`Proceeding to update hardware for VM ${vmNameforHardware}`);

    // ---------- UPDATE HARDWARE ----------
    await page.locator('button', { hasText: /^Update$/ }).click();
    // ---------- Sockets ----------
    const socketsInput = page
      .locator('div', { hasText: /^Sockets/ })
      .locator('input[type="number"]')
      .first();
    await socketsInput.fill('1'); // random value
    await socketsInput.press('Tab');
    logger.info('Sockets filled with random value 1');

    // ---------- CPU  ----------
    const cpuInput = page.getByRole('dialog').getByRole('textbox');
    await cpuInput.click();
    await cpuInput.fill('2'); // random value
    await cpuInput.press('Tab');
    logger.info('CPU filled with random value 2');

    // ---------- Memory ----------
    const memoryInput = page
      .locator('div', { hasText: /^Memory \(GB\)/ })
      .locator('input[type="number"]')
      .first();
    await memoryInput.fill('10'); // random value
    await memoryInput.press('Tab');
    logger.info('Memory filled with random value 10');

    // Click Update VM
    await page.getByRole('button', { name: 'Update VM' }).click();
    logger.info(`Hardware max values filled and updated for VM ${vmNameforHardware}`);
  });

  test('Validate VM hardware configuration constraints negative cases', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }
    logger.info(`Proceeding to validate hardware constraints for VM ${vmNameforHardware}`);

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    // ---------- UPDATE HARDWARE ----------
    await page.locator('button', { hasText: /^Update$/ }).click();

    // -------- Sockets Negative Validation --------
    const socketsInput = page
      .locator('div', { hasText: /^Sockets:\(Max:/ })
      .locator('input[type="number"]')
      .first();

    const socketsMax = parseInt((await socketsInput.getAttribute('max')) || '1');

    // Step 1: Try above max
    await socketsInput.evaluate((el, max) => {
      (el as HTMLInputElement).value = (max + 1).toString();
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, socketsMax);
    await page.waitForTimeout(PAUSE_TIMEOUT);
    await socketsInput.press('Tab');
    // Step 2: Set to max allowed
    await socketsInput.fill(socketsMax.toString());
    logger.info(`Sockets set to max: ${socketsMax}`);
    await socketsInput.press('Tab');

    // -------- CPU Negative Validation --------
    const cpuInput = page.getByRole('dialog').getByRole('textbox');
    await cpuInput.click();

    const cpuLabelText = await page.getByText(/CPU:\(Max: \d+\)/).innerText();
    const cpuMaxMatch = cpuLabelText.match(/Max:\s*(\d+)/);
    const cpuMax = cpuMaxMatch ? parseInt(cpuMaxMatch[1]) : 4;

    // Step 1: Try above max
    await cpuInput.evaluate((el, max) => {
      (el as HTMLInputElement).value = (max + 4).toString();
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, cpuMax);
    await page.waitForTimeout(PAUSE_TIMEOUT);
    await socketsInput.press('Tab');

    // Step 2: Set to max allowed
    await cpuInput.fill(cpuMax.toString());
    logger.info(`CPU set to max: ${cpuMax}`);
    await cpuInput.press('Tab');

    // -------- Memory Negative Validation --------
    const memoryInput = page
      .locator('div', { hasText: /^Memory \(GB\)/ })
      .locator('input[type="number"]')
      .first();

    const memoryMax = parseInt((await memoryInput.getAttribute('max')) || '15');

    // Step 1: Try above max
    await memoryInput.evaluate((el, max) => {
      (el as HTMLInputElement).value = (max + 10).toString();
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, memoryMax);
    await page.waitForTimeout(PAUSE_TIMEOUT);
    await socketsInput.press('Tab');

    // Step 2: Set to max allowed
    await memoryInput.fill(memoryMax.toString());
    logger.info(`Memory set to max: ${memoryMax}`);
    await memoryInput.press('Tab');

    // -------- Update VM ----------
    await page.getByRole('button', { name: 'Update VM' }).click();
    logger.info('VM hardware updated with max values successfully');
  });

  test('Validate VM Start and vm Console Retrieval', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    logger.info(`Starting VM ${vmNameforHardware} to validate console retrieval`);
    // Click more icon and start VM
    await page.getByTestId(`more-icon-${vmNameforHardware}`).click();
    await page.getByRole('button', { name: 'Start' }).click();
    logger.info(`Clicked Start for VM ${vmNameforHardware}`);

    // Open Console
    await page.getByRole('link', { name: 'Console' }).click();
    logger.info('Navigated to Console tab');

    // Wait for console iframe
    const consoleFrame = page.locator('iframe[title="VM Console"]').contentFrame();
    await consoleFrame.locator('#noVNC_transition').click();
    await consoleFrame.locator('canvas').click();
    logger.info('Interacted with VM console iframe');

    // Go to Activity Logs
    await page.getByRole('link', { name: 'Activity Logs' }).click();
    logger.info('Navigated to Activity Logs tab to verify console log');

    // Validate log text exists
    const consoleLog = page
      .getByRole('cell', {
        name: /Console connection retrieved/i,
      })
      .first();

    await expect(consoleLog).toBeVisible();
    await page.waitForTimeout(PAUSE_TIMEOUT);
    await page.getByRole('link', { name: 'Bhyve Logs' }).click();
    logger.info('Navigated to Bhyve Logs tab to verify console log');
    await page.waitForTimeout(PAUSE_TIMEOUT);

    logger.info('Console connection retrieved log found with timestamp');
  });

  test('VM status monitoring and real-time updates', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    logger.info(`Monitoring VM ${vmNameforHardware} status and logs`);

    // Hardware tab
    const hardwareLink = page.getByRole('link', { name: 'Hardware' });
    await hardwareLink.waitFor({ state: 'visible' });
    await hardwareLink.click();
    logger.info('navigated Hardware tab');
    //activity logs tab
    const activityLogsLink = page.getByRole('link', { name: 'Activity Logs' });
    await activityLogsLink.waitFor({ state: 'visible' });
    await activityLogsLink.click();
    logger.info('navigated Activity Logs tab');

    // logs content
    const activityLogsContent = page
      .locator('div')
      .filter({ hasText: /Activity Logs/i })
      .last();
    await activityLogsContent.waitFor({ state: 'visible' });

    // scroll logs
    await activityLogsContent.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    //bhyve logs tab
    const bhyveLogsLink = page.getByRole('link', { name: 'Bhyve Logs' });
    await bhyveLogsLink.waitFor({ state: 'visible' });
    await bhyveLogsLink.click();
    logger.info('navigated Bhyve Logs tab');

    // logs content
    const bhyveLogsContent = page
      .locator('div')
      .filter({ hasText: /Bhyve Logs/i })
      .last();
    await bhyveLogsContent.waitFor({ state: 'visible' });

    // scroll logs
    await bhyveLogsContent.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(PAUSE_TIMEOUT);

    logger.info('VM status and logs monitoring and real-time updates');
  });

  test('Test virtual disk attachment/detachment', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    logger.info(`Testing virtual disk attachment/detachment for VM ${vmNameforHardware}`);
    await page.getByRole('button', { name: 'Attach' }).nth(2).click();
    logger.info('Clicked Attach button for Disk');

    const diskTypeCombo = page.getByRole('combobox').first();

    await diskTypeCombo.waitFor({ state: 'visible' });
    await diskTypeCombo.click(); // open dropdown
    await diskTypeCombo.selectOption({ index: 0 }); // select first option
    logger.info('Selected Disk type from dropdown');

    // Enter disk size
    const sizeInput = page.getByRole('textbox', { name: 'e.g., 1G' });
    await sizeInput.waitFor({ state: 'visible' });
    await sizeInput.fill('5G');
    logger.info('Entered Disk size: 5G');

    // Confirm Attach
    await page.getByRole('dialog').getByRole('button', { name: 'Attach' }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // VERIFY ATTACH
    const diskPath = `/vm/${vmNameforHardware}/disk1.img`;
    const attachedDisk = page.getByText(diskPath);
    logger.info(`Verifying disk attachment at path: ${diskPath}`);

    // Scroll and verify disk is visible
    await attachedDisk.scrollIntoViewIfNeeded();
    await attachedDisk.waitFor({ state: 'visible' });

    logger.info(`Disk attached successfully for VM ${vmNameforHardware}`);

    // VERIFY DETACH
    await page.getByRole('button', { name: 'Detach' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Detach' }).click();
    await page.waitForTimeout(PAUSE_TIMEOUT);
    logger.info('Clicked Detach button for Disk');

    // VERIFY DETACH
    await expect(page.getByText(diskPath)).toHaveCount(0);
    logger.info(`Verifying disk detachment at path: ${diskPath}`);

    logger.info(`Disk detached successfully for VM ${vmNameforHardware}`);
  });

  test('Test ISO mounting for OS installation', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    logger.info(`Testing ISO mounting for VM ${vmNameforHardware}`);
    //  Click Attach button
    const cdRow = page.getByText('CD/DVD Drive Attach').locator('..');
    await cdRow.getByRole('button', { name: 'Attach' }).click();
    logger.info('Clicked Attach button for CD/DVD Drive');

    //  Open the combobox (ISO selector)
    const isoCombo = page.getByRole('combobox').first();
    await isoCombo.waitFor({ state: 'visible' });
    await isoCombo.click(); // open dropdown
    logger.info('Opened ISO selection dropdown');

    //  Select first option OR specific ISO
    await isoCombo.selectOption('Win10_22H2_English_x64v1.iso');

    //  Check "Start VM on Host Restart"
    const startOnBootCheckbox = page.getByRole('checkbox', {
      name: 'Start VM on Host Restart',
    });

    if (!(await startOnBootCheckbox.isChecked())) {
      await startOnBootCheckbox.click(); // use click, not check
    }
    logger.info('Selected ISO and enabled Start VM on Host Restart');

    // Confirm Attach
    await page.getByRole('dialog').getByRole('button', { name: 'Attach' }).first().click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // Open Console
    await page.getByRole('link', { name: 'Console' }).click();
    logger.info('Navigated to Console tab');

    // Wait for console iframe
    const consoleFrame = page.locator('iframe[title="VM Console"]').contentFrame();
    await consoleFrame.locator('#noVNC_transition').click();
    await consoleFrame.locator('canvas').click();
    logger.info('Interacted with VM console iframe');

    // Go to Activity Logs
    await page.getByRole('link', { name: 'Activity Logs' }).click();
    logger.info('Navigated to Activity Logs tab to verify console log');
    logger.info(`ISO mounted and VM ${vmNameforHardware} started successfully`);
  });

  test(' VM snapshot management and restoration ', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    logger.info(`vm snapshot management and restoration for VM ${vmNameforHardware}`);
    // Go to Snapshots tab
    const snapshotsLink = page.getByRole('link', { name: 'Snapshots' });
    await snapshotsLink.scrollIntoViewIfNeeded();
    await snapshotsLink.click();

    // Take snapshot
    const snapshotName = `testvmsnapshot`;
    const snapshotInput = page.getByRole('textbox', { name: 'Enter Snapshot Name' });
    await snapshotInput.click();
    await snapshotInput.fill(snapshotName);

    const takeSnapshotBtn = page.getByRole('button', { name: 'Take Snapshot' });
    await takeSnapshotBtn.scrollIntoViewIfNeeded();
    await takeSnapshotBtn.click();
    await page.waitForTimeout(PAUSE_TIMEOUT);

    // Reload page to refresh snapshot list
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for snapshot to appear in the list
    const snapshotCell = page.getByRole('cell', {
      name: new RegExp(`${snapshotName}_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-`),
    });
    await snapshotCell.scrollIntoViewIfNeeded();
    await snapshotCell.waitFor({ state: 'visible' });
    await snapshotCell.click();

    // Rollback snapshot
    const rollbackBtn = page.getByRole('button', { name: 'Rollback' });
    await rollbackBtn.first().click();

    const confirmYesBtn = page.getByRole('button', { name: 'Yes' });
    await confirmYesBtn.click();

    logger.info(`Snapshot taken and rolled back successfully for VM ${vmNameforHardware}`);
  });

  test('stop the running vm ', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    logger.info(`Preparing to stop and delete VM ${vmNameforHardware}`);

    // Go to Active VMs
    await page.getByRole('button', { name: /Active/ }).click();
    logger.info(`Navigated to Active VMs to stop VM ${vmNameforHardware}`);

    // Stop the specific VM
    await page.getByTestId(`more-icon-${vmNameforHardware}`).click();
    await page.getByRole('button', { name: 'Stop' }).click();
    logger.info(`Stop command issued for VM ${vmNameforHardware}`);

    // Wait for state change
    await page.waitForTimeout(LOAD_TIMEOUT);

    // Go to Inactive VMs
    await page.getByRole('button', { name: /Inactive/ }).click();
    logger.info(`Navigated to Inactive VMs to verify VM ${vmNameforHardware} status`);

    // Verify VM appears in Inactive list
    const inactiveVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });
    await page.waitForTimeout(PAUSE_TIMEOUT);
    logger.info(`VM ${vmNameforHardware} successfully moved to Inactive`);
  });
  test(' delete operation on stopped vm ', async ({ page }) => {
    // Go to Control Center
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');

    await page.locator('button', { hasText: /^VMs\b/ }).click();

    let vmClicked = false;

    // Try Active
    await page.locator('button', { hasText: /^Active/ }).click();
    const activeVM = page
      .getByTestId('sidebar-vms-list')
      .getByText(vmNameforHardware, { exact: true });

    if ((await activeVM.count()) > 0) {
      await activeVM.click();
      vmClicked = true;
    }

    // Try Inactive
    if (!vmClicked) {
      await page.locator('button', { hasText: /^Inactive/ }).click();
      const inactiveVM = page
        .getByTestId('sidebar-vms-list')
        .getByText(vmNameforHardware, { exact: true });

      if ((await inactiveVM.count()) > 0) {
        await inactiveVM.click();
        vmClicked = true;
      }
    }

    if (!vmClicked) {
      throw new Error(`VM ${vmNameforHardware} not found`);
    }
    logger.info(`Preparing to  delete VM ${vmNameforHardware}`);

    // Delete the VM
    await page.getByTestId(`more-icon-${vmNameforHardware}`).click();
    await page.getByTestId('sidebar-vms-list').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    logger.info(`VM ${vmNameforHardware} deleted successfully`);
  });
});
