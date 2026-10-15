import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run local dev servers before starting tests */
  webServer: [
    {
      command: 'bun nx run chat-mfe:serve',
      url: 'http://localhost:4204',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    {
      command: 'bun nx run dashboard-shell:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
