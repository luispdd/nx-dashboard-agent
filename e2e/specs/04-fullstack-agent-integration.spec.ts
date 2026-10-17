import { test, expect } from '@playwright/test';

test.describe('Full-Stack Assistant Integration Suite', () => {
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

    // Verify chat app root inside remote React MFE mounts
    await expect(page.locator('[data-testid="chat-app-root"]')).toBeVisible();

    // Verify no error state is displayed
    await expect(page.locator('[data-testid="chat-error"]')).not.toBeVisible();
    await expect(page.getByText(/Failed to load chat microfrontend/i)).not.toBeVisible();
  });

  test('should stream response via SSE in chat drawer from live agent service without mocks', async ({ page }) => {
    await page.goto('/');

    // Open chat drawer
    const drawer = page.locator('[data-testid="chat-drawer"]');
    await page.locator('[data-testid="toggle-chat-button"]').click();
    await expect(drawer).toHaveClass(/translate-x-0/);
    await expect(drawer).not.toHaveAttribute('inert');
    await expect(page.locator('[data-testid="chat-app-root"]')).toBeVisible();

    // Type query and submit
    const textarea = page.locator('[data-testid="chat-textarea"]');
    await expect(textarea).toBeVisible();
    await textarea.fill('How is esp32c6 performing?');
    const sendBtn = page.locator('[data-testid="send-message-btn"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Verify user message appears
    await expect(page.locator('[data-testid^="user-message-"]')).toContainText(
      'How is esp32c6 performing?'
    );

    // Verify assistant response appears from live backend
    const assistantBubble = page.locator('[data-testid^="assistant-message-"]');
    await expect(assistantBubble).toBeVisible({ timeout: 60000 });

    // Wait for stream to finish (stop button disappears, send button returns)
    await expect(page.locator('[data-testid="stop-generation-btn"]')).not.toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-testid="send-message-btn"]')).toBeVisible();

    // Verify content received
    const assistantText = await assistantBubble.textContent();
    expect(assistantText && assistantText.trim().length > 0).toBeTruthy();
  });

  test('should propagate dashboard filter changes to chat context pill and request payload', async ({ page }) => {
    await page.goto('/');

    // Change dashboard filter to Last 1h
    const range1hBtn = page.getByTestId('range-btn-1h');
    await range1hBtn.click();
    await expect(range1hBtn).toHaveClass(/bg-accent\/20/);

    // Open chat drawer
    const drawer = page.locator('[data-testid="chat-drawer"]');
    await page.locator('[data-testid="toggle-chat-button"]').click();
    await expect(drawer).toHaveClass(/translate-x-0/);
    await expect(drawer).not.toHaveAttribute('inert');
    await expect(page.locator('[data-testid="chat-app-root"]')).toBeVisible();

    // Verify context pill displays updated filter (1h)
    const contextPill = page.locator('[data-testid="context-pill"]');
    await expect(contextPill).toBeVisible();
    await expect(contextPill).toContainText('1h');

    // Intercept outgoing POST request to verify payload context
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/chat') && req.method() === 'POST'
    );

    // Send query
    const textarea = page.locator('[data-testid="chat-textarea"]');
    await expect(textarea).toBeVisible();
    await textarea.fill('Summarize this hour');
    const sendBtn = page.locator('[data-testid="send-message-btn"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Verify payload captured in live request includes the updated context
    const req = await requestPromise;
    const postData = req.postDataJSON();
    expect(postData.context?.timeRange?.preset).toBe('1h');

    // Wait for stream to finish
    await expect(page.locator('[data-testid^="assistant-message-"]')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-testid="stop-generation-btn"]')).not.toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-testid="send-message-btn"]')).toBeVisible();
  });

  test('should retain conversation state across drawer toggles and reset on Clear', async ({ page }) => {
    await page.goto('/');

    // Open chat drawer
    const drawer = page.locator('[data-testid="chat-drawer"]');
    await page.locator('[data-testid="toggle-chat-button"]').click();
    await expect(drawer).toHaveClass(/translate-x-0/);
    await expect(drawer).not.toHaveAttribute('inert');
    await expect(page.locator('[data-testid="chat-app-root"]')).toBeVisible();

    // Send message to live agent
    const textarea = page.locator('[data-testid="chat-textarea"]');
    await expect(textarea).toBeVisible();
    await textarea.fill('Reply with one word: ping');
    const sendBtn = page.locator('[data-testid="send-message-btn"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    const assistantMsg = page.locator('[data-testid^="assistant-message-"]');
    await expect(assistantMsg).toBeVisible({ timeout: 90000 });
    await expect(page.locator('[data-testid="stop-generation-btn"]')).not.toBeVisible({ timeout: 90000 });
    await expect(page.locator('[data-testid="send-message-btn"]')).toBeVisible();

    // Close drawer
    await page.locator('[data-testid="close-chat-button"]').click();
    await expect(drawer).toHaveClass(/translate-x-full/);
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    // Reopen drawer
    await page.locator('[data-testid="toggle-chat-button"]').click();
    await expect(drawer).toHaveClass(/translate-x-0/);

    // Verify conversation state was retained
    await expect(page.locator('[data-testid^="user-message-"]')).toContainText(
      'Reply with one word: ping'
    );
    await expect(assistantMsg).toBeVisible();

    // Click Clear Conversation
    const clearBtn = page.locator('[data-testid="clear-conversation-btn"]');
    await expect(clearBtn).toBeEnabled();
    await clearBtn.click();

    // Verify conversation cleared and starter suggestions visible
    await expect(page.locator('[data-testid="message-list-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid^="user-message-"]')).not.toBeVisible();
    await expect(clearBtn).toBeDisabled();
  });

  test('should allow dragging the drawer border to resize width clamped to 50% max and 360px min', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="toggle-chat-button"]').click();

    const drawer = page.locator('[data-testid="chat-drawer"]');
    const resizeHandle = page.locator('[data-testid="chat-drawer-resize-handle"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/translate-x-0/);
    await expect(drawer).not.toHaveAttribute('inert');
    await expect(resizeHandle).toBeVisible();

    // Allow slide-in transition to settle
    await page.waitForTimeout(350);

    const initialBox = await drawer.boundingBox();
    expect(initialBox).not.toBeNull();
    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();
    if (!viewportSize) throw new Error('Missing viewport size');
    const maxAllowedWidth = Math.floor(viewportSize.width * 0.5);

    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (!handleBox) throw new Error('Missing handle box');

    // Drag handle leftwards towards 20% of window (attempting to exceed 50% max)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(viewportSize.width * 0.2, handleBox.y + 100, { steps: 5 });
    await page.mouse.up();

    // Width should be clamped to at most 50% of viewport width
    const expandedBox = await drawer.boundingBox();
    expect(expandedBox).not.toBeNull();
    if (!expandedBox) throw new Error('Missing expanded box');
    expect(expandedBox.width).toBeLessThanOrEqual(maxAllowedWidth + 2);
    expect(expandedBox.width).toBeGreaterThan(450);

    // Drag handle rightwards towards right edge (attempting to shrink below 360px min)
    await page.waitForTimeout(50);
    const newHandleBox = await resizeHandle.boundingBox();
    expect(newHandleBox).not.toBeNull();
    if (!newHandleBox) throw new Error('Missing new handle box');
    await page.mouse.move(newHandleBox.x + newHandleBox.width / 2, newHandleBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(viewportSize.width - 100, newHandleBox.y + 100, { steps: 5 });
    await page.mouse.up();

    // Width should be clamped to 360px
    const shrunkBox = await drawer.boundingBox();
    expect(shrunkBox).not.toBeNull();
    if (!shrunkBox) throw new Error('Missing shrunk box');
    expect(Math.round(shrunkBox.width)).toBe(360);
  });
});
