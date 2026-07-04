import { test, expect, Page } from '@playwright/test';
import { createTestLogger } from '../utils/test-logger';
import path from 'path';
import fs from 'fs';

// Environment configuration with fallbacks
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '15000');
const LOAD_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000');
const PAUSE_TIMEOUT = parseInt(process.env.PAUSE_TIMEOUT || '2000');
const TEST_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000') * 12;
const ISO_TIMEOUT = parseInt(process.env.LOAD_TIMEOUT || '10000') * 3;
test.setTimeout(TEST_TIMEOUT);

const logger = createTestLogger('isoManagementTests');

test.describe('Iso Management Tests (Authenticated)', () => {
  // Use pre-authenticated session for all tests in this suite
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('navigate to iso ', async ({ page }) => {
    await page.goto('/dc/1/control-center', { timeout: PAGE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    // Navigate to Karios Forge
    await page.getByRole('link', { name: 'Karios Forge' }).click();

    await page.getByRole('link', { name: 'ISO' }).click();
    logger.info('navigated to iso')

  });

  test('ISO Download Workflow Validation', async ({ page }) => {
      await page.goto('/dc/1/control-center', { timeout: ISO_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: ISO_TIMEOUT });
      // Navigate to Karios Forge
      await page.getByRole('link', { name: 'Karios Forge' }).click();

      await page.getByRole('link', { name: 'ISO' }).click();
      logger.info('navigated to iso')

      // VERIFY DOWNLOAD PAGE
      const downloadHeading = page.getByRole('heading', { name: 'Download' });
      await expect(downloadHeading).toBeVisible();

      // ENTER ISO DOWNLOAD URL
      const isoUrlInput = page.getByTestId('dc-iso-download-url-input');
      await expect(isoUrlInput).toBeVisible();

      await isoUrlInput.click();
      await isoUrlInput.fill(
        'https://mirror.math.princeton.edu/pub/tinycorelinux/12.x/x86/release/Core-12.0.iso'
      );

      // CLICK DOWNLOAD BUTTON
      const downloadButton = page.getByTestId('dc-iso-download-button');
      await expect(downloadButton).toBeEnabled();
      await downloadButton.click();

      // VERIFY DOWNLOADING STATE
      const downloadingText = page.getByText('Downloading...');
      await expect(downloadingText).toBeVisible({ timeout:PAGE_TIMEOUT });

      // VERIFY DOWNLOAD COMPLETED
      const completedText = page.getByText('Download completed');
      await expect(completedText).toBeVisible({ timeout: PAGE_TIMEOUT });

      // GO TO ISO LIST VIEW
      const viewModeSelect = page.getByTestId('dc-iso-view-mode-select');
      await expect(viewModeSelect).toBeVisible();

      await viewModeSelect.selectOption('isos');

      // VERIFY ISO LIST
      const isoListSection = page.getByTestId('dc-iso-list-section');
      await expect(isoListSection).toBeVisible();

      const firstIsoItem = page.getByTestId('dc-iso-list-item-0');
      await expect(firstIsoItem).toBeVisible();

      const isoText = await firstIsoItem.textContent();
      expect(isoText).toContain('Core-12.0.iso');

      logger.info(`ISO successfully listed: ${isoText?.trim()}`);

      //delete iso
      await page.getByTestId('dc-iso-delete-button-0').click();
      await page.getByTestId('dc-iso-delete-modal-confirm-button').click();
      logger.info('Iso deleted successfully');
    });

     test('ISO Upload Workflow Validation', async ({ page }) => {
      await page.goto('/dc/1/control-center', { timeout: ISO_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: ISO_TIMEOUT });
      // Navigate to Karios Forge
      await page.getByRole('link', { name: 'Karios Forge' }).click();

      await page.getByRole('link', { name: 'ISO' }).click();
      logger.info('navigated to iso')

       await expect(
        page.getByRole('heading', { name: 'Upload' })
      ).toBeVisible();


      // SELECT ISO FILE
      // Path to ISO file (keep it in repo for CI)
      const isoFilePath = path.resolve('tests/Core-12.0.iso');
      expect(fs.existsSync(isoFilePath)).toBeTruthy();

      // IMPORTANT: file input is hidden by design
      const fileInput = page.getByTestId('dc-iso-upload-file-input');
      await fileInput.setInputFiles(isoFilePath);

      // CLICK UPLOAD BUTTON
      const uploadButton = page.getByTestId('dc-iso-upload-button');
      await expect(uploadButton).toBeEnabled();
      await uploadButton.click();

      // VERIFY UPLOADING STATE
      await expect(
        page.getByText('Uploading file...')
      ).toBeVisible({ timeout: PAUSE_TIMEOUT });

      // VERIFY PROGRESS BAR
      const progressBar = page.getByTestId(
        'dc-iso-upload-progress-bar-container'
      );
      await expect(progressBar).toBeVisible({ timeout: PAUSE_TIMEOUT });

      // GO TO ISO LIST VIEW
      const viewModeSelect = page.getByTestId('dc-iso-view-mode-select');
      await expect(viewModeSelect).toBeVisible({timeout: ISO_TIMEOUT * 4});

      await viewModeSelect.selectOption('isos');

      // VERIFY ISO LIST
      const isoListSection = page.getByTestId('dc-iso-list-section');
      await expect(isoListSection).toBeVisible();

      const firstIsoItem = page.getByTestId('dc-iso-list-item-0');
      await expect(firstIsoItem).toBeVisible();

      const isoText = await firstIsoItem.textContent();
      expect(isoText).toContain('Core-12.0.iso');

      logger.info(`ISO successfully listed: ${isoText?.trim()}`);

      //delete iso
      await page.getByTestId('dc-iso-delete-button-0').click();
      await page.getByTestId('dc-iso-delete-modal-confirm-button').click();
      logger.info('Iso deleted successfully');
    });

    test('list the available isos', async ({ page }) => {
      await page.goto('/dc/1/control-center', { timeout: ISO_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: ISO_TIMEOUT });
      // Navigate to Karios Forge
      await page.getByRole('link', { name: 'Karios Forge' }).click();

      await page.getByRole('link', { name: 'ISO' }).click();
      logger.info('navigated to iso')

      // Switch to ISO view
      await page
        .getByTestId('dc-iso-view-mode-select')
        .selectOption('isos');
      logger.info('Switched view mode to ISOs');

      // Verify Available ISOs heading
      await expect(
        page.getByRole('heading', { name: "Available ISO's" })
      ).toBeVisible();
      logger.info('Available ISOs heading is visible');

      // Verify ISO list section
      const isoListSection = page.getByTestId('dc-iso-list-section');
      await expect(isoListSection).toBeVisible();
      logger.info('ISO list section is visible');

      // Verify ISO items are present
      const isoItems = page.locator('[data-testid^="dc-iso-list-item-"]');
      await expect(isoItems.first()).toBeVisible();
      logger.info('At least one ISO is visible in the list');

      // Count ISO items
      const isoCount = await isoItems.count();
      const count=isoCount/2;
      logger.info(`Total ISOs available: ${count}`);

      expect(isoCount).toBeGreaterThan(0);
    });

    test('list the available cloud images', async ({ page }) => {
      await page.goto('/dc/1/control-center', { timeout: ISO_TIMEOUT });
      await page.waitForLoadState('domcontentloaded', { timeout: ISO_TIMEOUT });
      // Navigate to Karios Forge
      await page.getByRole('link', { name: 'Karios Forge' }).click();

      await page.getByRole('link', { name: 'ISO' }).click();
      logger.info('navigated to iso')

      // Switch to Cloud Images view
      await page
        .getByTestId('dc-iso-view-mode-select')
        .selectOption('cloud-images');
      logger.info('Switched view mode to Cloud Images');

      // Wait for heading
      const cloudHeading = page.getByRole('heading', { name: /Available Cloud Images/i });
      await expect(cloudHeading).toBeVisible();
      logger.info('Available Cloud Images heading is visible');

      // SCOPE CLOUD IMAGES CONTAINER
      const cloudImagesContainer = cloudHeading.locator('xpath=following-sibling::div[1]');
      await expect(cloudImagesContainer).toBeVisible();
      logger.info('Cloud Images container located');

      // GET ALL CLOUD IMAGE CARDS
      const cloudImageCards = cloudImagesContainer.locator('button', { hasText: 'Delete' }).locator('..');
      // '..' goes to the parent div containing the image info
      const cloudImageCount = await cloudImageCards.count();
      logger.info(`Total Cloud Images available: ${cloudImageCount}`);

      expect(cloudImageCount).toBeGreaterThan(0);
    });

});
