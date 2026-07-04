import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load deployment environment variables if running deployment tests
if (process.env.TEST_ENV === 'deployment') {
  dotenv.config({ path: path.resolve(__dirname, '.env.deployment') });
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Allow tests to proceed with self-signed/unknown CA backend certs
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: ['--ignore-certificate-errors'],
      // Enable slow motion for better visual debugging in headed runs.
      // Override via env SLOWMO_MS (e.g., SLOWMO_MS=0 to disable)
      slowMo: Number(process.env.SLOWMO_MS ?? 600),
    },
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL,
      },
    },

    // Authenticated tests - depends on setup
    {
      name: 'authenticated-tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL,
        // Use pre-authenticated state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.authenticated\.spec\.ts/,
    },

    // Daily health monitoring - depends on setup for authentication
    {
      name: 'health-monitoring',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL,
        // Use pre-authenticated state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*health.*\.spec\.ts/,
    },

    // Login-specific tests (no pre-auth needed)
    {
      name: 'login-tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL,
      },
      testMatch: /.*login.*\.spec\.ts/,
    },

    // Health monitoring tests - daily service checks
    {
      name: 'health-monitoring',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL,
        // Faster execution for health checks
        launchOptions: {
          args: ['--ignore-certificate-errors'],
          slowMo: 0,
        },
      },
      testMatch: /.*health.*\.spec\.ts/,
      timeout: 30000,
      retries: 1, // Retry once for network issues
    },

    // Deployment validation project - runs against real server
    {
      name: 'deployment-validation',
      testMatch: '**/deployment-validation.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL,
        // Faster execution for deployment validation
        launchOptions: {
          args: ['--ignore-certificate-errors'],
          // No slow motion for deployment tests
          slowMo: 0,
        },
      },
      timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
      retries: parseInt(process.env.TEST_RETRIES || '2'),
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm start',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
