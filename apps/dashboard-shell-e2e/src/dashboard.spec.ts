import { test, expect } from '@playwright/test';

test.describe('Dashboard Shell E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend API requests with deterministic fixtures
    await page.route('**/api/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { metric_key: 'temperature', unit: '°C' },
          { metric_key: 'humidity', unit: '%' },
        ]),
      });
    });

    await page.route('**/api/devices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['esp32c6', 'esp32s3']),
      });
    });

    await page.route('**/api/series*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metric: 'temperature',
          unit: '°C',
          bucket: '15m',
          series: [
            {
              device_id: 'esp32c6',
              points: [
                { ts: '2026-10-14T10:00:00Z', value: 20.0 },
                { ts: '2026-10-14T10:15:00Z', value: 22.0 },
                { ts: '2026-10-14T10:30:00Z', value: 24.0 },
              ],
            },
            {
              device_id: 'esp32s3',
              points: [
                { ts: '2026-10-14T10:00:00Z', value: 19.0 },
                { ts: '2026-10-14T10:15:00Z', value: 21.0 },
              ],
            },
          ],
        }),
      });
    });

    await page.route('**/api/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metric: 'temperature',
          unit: '°C',
          stats: [
            {
              device_id: 'esp32c6',
              count: 300,
              min: 19.5,
              max: 25.2,
              mean: 22.1,
              std: 1.1,
              missing_ratio: 0.02,
            },
            {
              device_id: 'esp32s3',
              count: 100,
              min: 18.0,
              max: 23.0,
              mean: 20.5,
              std: 1.3,
              missing_ratio: 0.15,
            },
          ],
        }),
      });
    });
  });

  test('should navigate between Trends, Distribution, and Settings views', async ({ page }) => {
    await page.goto('/');

    // Check Trends view
    await expect(page.locator('h1')).toContainText('Environmental Telemetry Trends');
    await expect(page.locator('[data-testid="trends-view"]')).toBeVisible();

    // Navigate to Distribution
    await page.click('a[href="/distribution"]');
    await expect(page).toHaveURL(/.*distribution/);
    await expect(page.locator('h1')).toContainText('Device Measurement Distribution');
    await expect(page.locator('[data-testid="distribution-view"]')).toBeVisible();

    // Navigate to Settings
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL(/.*settings/);
    await expect(page.locator('h1')).toContainText('System & LLM Settings');
    await expect(page.locator('[data-testid="settings-view"]')).toBeVisible();

    // Navigate back to Trends
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(/.*(?:\/|$)/);
    await expect(page.locator('h1')).toContainText('Environmental Telemetry Trends');
  });

  test('should enforce mutual exclusivity between time range and points filter rows', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="trends-view"]')).toBeVisible();

    // Default: Last 1d is active (accent style)
    const range1d = page.getByTestId('range-btn-1d');
    const point50 = page.getByTestId('points-btn-50');

    // Verify initial range button is active
    await expect(range1d).toHaveClass(/bg-accent\/20/);

    // Click 50 points
    await point50.click();

    // Point button should now be active, range button unselected
    await expect(point50).toHaveClass(/bg-accent\/20/);
    await expect(range1d).not.toHaveClass(/bg-accent\/20/);

    // Click Last 1h
    const range1h = page.getByTestId('range-btn-1h');
    await range1h.click();

    // Last 1h should now be active, point button unselected
    await expect(range1h).toHaveClass(/bg-accent\/20/);
    await expect(point50).not.toHaveClass(/bg-accent\/20/);
  });

  test('should render telemetry chart and synchronize per-board statistics table', async ({ page }) => {
    await page.goto('/');

    // Verify chart container is present
    await expect(page.locator('.telemetry-chart-container')).toBeVisible();

    // Verify per-board statistics table rows
    const table = page.locator('table[aria-label="Device statistics summary"]');
    await expect(table).toBeVisible();

    // esp32c6 row: 3 measurements, latest 24.00 °C, min 20.00 °C, avg 22.00 °C, max 24.00 °C
    const rowC6 = table.locator('tr', { hasText: 'esp32c6' });
    await expect(rowC6).toContainText('3');
    await expect(rowC6).toContainText('24.00 °C');
    await expect(rowC6).toContainText('20.00 °C');
    await expect(rowC6).toContainText('22.00 °C');
    await expect(rowC6).toContainText('24.00 °C');

    // esp32s3 row: 2 measurements, latest 21.00 °C, min 19.00 °C, avg 20.00 °C, max 21.00 °C
    const rowS3 = table.locator('tr', { hasText: 'esp32s3' });
    await expect(rowS3).toContainText('2');
    await expect(rowS3).toContainText('21.00 °C');
    await expect(rowS3).toContainText('19.00 °C');
    await expect(rowS3).toContainText('20.00 °C');
    await expect(rowS3).toContainText('21.00 °C');
  });

  test('should persist LLM runtime settings in Settings view', async ({ page }) => {
    await page.goto('/settings');

    const baseUrlInput = page.locator('[data-testid="base-url-input"]');
    const modelInput = page.locator('[data-testid="model-input"]');
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    const maskToggle = page.locator('[data-testid="toggle-mask-btn"]');
    const saveButton = page.locator('[data-testid="save-settings-btn"]');

    // Verify initial values
    await expect(baseUrlInput).toHaveValue('http://localhost:8000/v1');
    await expect(modelInput).toHaveValue('qwen2.5-coder-7b');
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Toggle API key mask
    await maskToggle.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'text');

    // Update settings
    await baseUrlInput.fill('http://custom-ai-host:11434/v1');
    await modelInput.fill('deepseek-r1');
    await apiKeyInput.fill('sk-test-secret-123');

    // Save
    await saveButton.click();

    // Verify success alert
    await expect(page.locator('[data-testid="save-success-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-success-alert"]')).toContainText(
      'saved successfully'
    );
  });

  test('should open chat drawer and successfully mount the chat microfrontend via Native Federation', async ({ page }) => {
    await page.goto('/');

    // Click AI Assistant button in header
    const toggleBtn = page.locator('[data-testid="toggle-chat-button"]');
    await toggleBtn.click();

    // Verify chat drawer opens
    const drawer = page.locator('[data-testid="chat-drawer"]');
    await expect(drawer).toBeVisible();

    // Verify chat container mounts and no error occurs
    const chatContainer = page.locator('[data-testid="chat-container"]');
    await expect(chatContainer).toBeVisible();

    // Verify no error state is displayed
    await expect(page.locator('[data-testid="chat-error"]')).not.toBeVisible();
    await expect(page.getByText(/Failed to load chat microfrontend/i)).not.toBeVisible();
  });
});
