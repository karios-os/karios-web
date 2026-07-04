# Playwright E2E Testing

This project uses Playwright for end-to-end testing.

## Setup

Playwright is already configured and the browsers are installed. The configuration can be found in `playwright.config.ts`.

## Running Tests

### Command Line

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Show test report
npm run test:e2e:report
```

### VS Code Tasks

You can also run Playwright tests using VS Code tasks:

- **Run Playwright Tests**: Runs all E2E tests
- **Run Playwright Tests (UI Mode)**: Opens interactive UI mode
- **Show Playwright Report**: Opens the HTML test report

## Test Structure

Tests are located in the `tests/e2e/` directory. Each test file should end with `.spec.ts` or `.test.ts`.

## Configuration

The Playwright configuration is in `playwright.config.ts`. Key settings:

- **Base URL**: http://localhost:4200 (your app's dev server)
- **Browsers**: Chromium, Firefox, and WebKit
- **Test Directory**: `./tests/e2e`
- **Parallel Execution**: Enabled
- **Reporter**: HTML (generates `playwright-report/index.html`)

## Writing Tests

Example test structure:

```typescript
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Karios/);
});
```

## CI/CD

GitHub Actions workflow is configured in `.github/workflows/playwright.yml` to run tests on push and pull requests.

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
