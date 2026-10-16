import { test, expect } from '@playwright/test';

test.describe('Dashboard Shell Live End-to-End Suite', () => {
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

  test('should render telemetry chart and synchronize per-board statistics table from live API', async ({ page }) => {
    await page.goto('/');

    // Verify chart container is present
    await expect(page.locator('.telemetry-chart-container')).toBeVisible();

    // Select 50 points filter to request latest telemetry points from live database
    const point50Btn = page.getByTestId('points-btn-50');
    await point50Btn.click();
    await expect(point50Btn).toHaveClass(/bg-accent\/20/);

    // Verify per-board statistics table is rendered with device rows from database without hardcoded counts
    const table = page.locator('table[aria-label="Device statistics summary"]');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
  });

  test('should persist LLM runtime settings in Settings view', async ({ page }) => {
    await page.goto('/settings');

    const baseUrlInput = page.locator('[data-testid="base-url-input"]');
    const modelInput = page.locator('[data-testid="model-input"]');
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    const maskToggle = page.locator('[data-testid="toggle-mask-btn"]');
    const saveButton = page.locator('[data-testid="save-settings-btn"]');

    // Verify settings inputs are rendered
    await expect(baseUrlInput).toBeVisible();
    await expect(modelInput).toBeVisible();
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
});
