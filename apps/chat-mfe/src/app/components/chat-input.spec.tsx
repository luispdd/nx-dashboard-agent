import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatInput } from './chat-input';

describe('ChatInput', () => {
  it('should render textarea with placeholder and disabled send button when empty', () => {
    render(<ChatInput onSendMessage={vi.fn()} onAbort={vi.fn()} isStreaming={false} />);

    const textarea = screen.getByTestId('chat-textarea');
    expect(textarea).toBeDefined();

    const sendBtn = screen.getByTestId('send-message-btn');
    expect(sendBtn.hasAttribute('disabled')).toBe(true);
  });

  it('should enable send button and dispatch message on submit', () => {
    const sendSpy = vi.fn();
    render(<ChatInput onSendMessage={sendSpy} onAbort={vi.fn()} isStreaming={false} />);

    const textarea = screen.getByTestId('chat-textarea');
    fireEvent.change(textarea, { target: { value: 'How is humidity?' } });

    const sendBtn = screen.getByTestId('send-message-btn');
    expect(sendBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(sendBtn);
    expect(sendSpy).toHaveBeenCalledWith('How is humidity?');
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('should submit on Enter key press without Shift', () => {
    const sendSpy = vi.fn();
    render(<ChatInput onSendMessage={sendSpy} onAbort={vi.fn()} isStreaming={false} />);

    const textarea = screen.getByTestId('chat-textarea');
    fireEvent.change(textarea, { target: { value: 'Check esp32s3' } });

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(sendSpy).toHaveBeenCalledWith('Check esp32s3');
  });

  it('should NOT submit on Enter key press with Shift (allows multiline)', () => {
    const sendSpy = vi.fn();
    render(<ChatInput onSendMessage={sendSpy} onAbort={vi.fn()} isStreaming={false} />);

    const textarea = screen.getByTestId('chat-textarea');
    fireEvent.change(textarea, { target: { value: 'Line 1' } });

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('should render stop button when isStreaming is true and dispatch abort on click', () => {
    const abortSpy = vi.fn();
    render(<ChatInput onSendMessage={vi.fn()} onAbort={abortSpy} isStreaming={true} />);

    expect(screen.queryByTestId('send-message-btn')).toBeNull();

    const stopBtn = screen.getByTestId('stop-generation-btn');
    expect(stopBtn).toBeDefined();

    fireEvent.click(stopBtn);
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });
});
