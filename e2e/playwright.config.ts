import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

// E2E_LLM_MODE=stub (default) runs the agent against the deterministic LLM stub;
// E2E_LLM_MODE=real uses the configured LLM_BASE_URL (single worker, see below).
const llmMode = process.env['E2E_LLM_MODE'] === 'real' ? 'real' : 'stub';
const stubPort = process.env['E2E_LLM_STUB_PORT'] || '8890';

const llmStubServer = {
  command: 'bun e2e/fixtures/llm-stub/main.ts',
  url: `http://127.0.0.1:${stubPort}/health`,
  reuseExistingServer: true,
  cwd: workspaceRoot,
  timeout: 30000,
  env: { E2E_LLM_STUB_PORT: stubPort },
};

const agentServiceEnv: Record<string, string> =
  llmMode === 'stub'
    ? {
        LLM_BASE_URL: `http://127.0.0.1:${stubPort}/v1`,
        LLM_MODEL: 'llm-stub',
        LLM_API_KEY: '',
        // Pointing at a missing file disables data/runtime-config.json overrides.
        RUNTIME_CONFIG_PATH: '/nonexistent/e2e-runtime-config.json',
      }
    : {};

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './specs' }),
  timeout: 120000,
  // Always 1 worker: parallel requests to a local LLM inflate streaming latency (see e2e-testing-quirks).
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run local dev servers before starting tests */
  webServer: [
    ...(llmMode === 'stub' ? [llmStubServer] : []),
    {
      command: 'bun nx run dashboard-api:serve',
      url: 'http://localhost:3000/api',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120000,
    },
    {
      command: 'bun nx run agent-service:serve',
      url: 'http://localhost:8000/health',
      // An already-running agent keeps its own LLM, so only reuse it in real mode.
      reuseExistingServer: llmMode === 'real',
      cwd: workspaceRoot,
      timeout: 120000,
      env: agentServiceEnv,
    },
    {
      command: 'bun nx run chat-mfe:serve',
      url: 'http://localhost:4204',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120000,
    },
    {
      command: 'bun nx run dashboard-shell:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
