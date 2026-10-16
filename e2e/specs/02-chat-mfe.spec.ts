import { test, expect } from '@playwright/test';

test.describe('Standalone Chat Microfrontend Suite', () => {
  test('should mount standalone chat assistant UI on port 4204', async ({ page }) => {
    await page.goto('http://localhost:4204');

    // Verify root container and header mount
    const root = page.locator('[data-testid="chat-app-root"]');
    await expect(root).toBeVisible();

    const header = page.locator('[data-testid="chat-header"]');
    await expect(header).toBeVisible();

    // Verify context pill is populated with container defaults
    const contextPill = page.locator('[data-testid="context-pill"]');
    await expect(contextPill).toBeVisible();

    // Verify clear button is disabled with empty conversation
    const clearBtn = page.locator('[data-testid="clear-conversation-btn"]');
    await expect(clearBtn).toBeVisible();
    await expect(clearBtn).toBeDisabled();
  });

  test('should render empty state with starter prompt suggestions', async ({ page }) => {
    await page.goto('http://localhost:4204');

    const emptyState = page.locator('[data-testid="message-list-empty"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('IoT Data Assistant');

    // Verify starter question chips exist
    const starter0 = page.locator('[data-testid="starter-prompt-0"]');
    const starter1 = page.locator('[data-testid="starter-prompt-1"]');
    await expect(starter0).toBeVisible();
    await expect(starter1).toBeVisible();
  });

  test('should manage input form state and handle send button enablement', async ({ page }) => {
    await page.goto('http://localhost:4204');

    const textarea = page.locator('[data-testid="chat-textarea"]');
    const sendBtn = page.locator('[data-testid="send-message-btn"]');

    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue('');
    await expect(sendBtn).toBeDisabled();

    // Typing enables send button
    await textarea.fill('Testing chat controls');
    await expect(sendBtn).toBeEnabled();

    // Clearing textarea disables send button
    await textarea.fill('');
    await expect(sendBtn).toBeDisabled();
  });

  test('should send message, stream response from live backend, and clear conversation', async ({ page }) => {
    await page.goto('http://localhost:4204');

    const textarea = page.locator('[data-testid="chat-textarea"]');
    const sendBtn = page.locator('[data-testid="send-message-btn"]');

    await textarea.fill('Give a short 1-sentence test response');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // User message bubble appears
    await expect(page.locator('[data-testid^="user-message-"]')).toContainText(
      'Give a short 1-sentence test response'
    );

    // Assistant response appears
    const assistantBubble = page.locator('[data-testid^="assistant-message-"]');
    await expect(assistantBubble).toBeVisible({ timeout: 60000 });

    // Stream finishes: stop button disappears and send button returns
    await expect(page.locator('[data-testid="stop-generation-btn"]')).not.toBeVisible({ timeout: 60000 });
    await expect(sendBtn).toBeVisible();

    // Clear conversation
    const clearBtn = page.locator('[data-testid="clear-conversation-btn"]');
    await expect(clearBtn).toBeEnabled();
    await clearBtn.click();

    // Empty state returns
    await expect(page.locator('[data-testid="message-list-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid^="user-message-"]')).not.toBeVisible();
    await expect(clearBtn).toBeDisabled();
  });
});
