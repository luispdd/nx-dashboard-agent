import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatStream } from './use-chat-stream';

function createMockSseResponse(chunks: string[], status = 200, statusText = 'OK') {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    statusText,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('useChatStream', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should initialize with default empty state', () => {
    const { result } = renderHook(() => useChatStream());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should stream tokens into assistant message and complete', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: token\ndata: {"content": "Hello "}\n\n',
        'event: token\ndata: {"content": "there!"}\n\n',
        'event: done\ndata: {}\n\n',
      ])
    );

    const { result } = renderHook(() => useChatStream({ apiBaseUrl: 'http://test-agent' }));

    await act(async () => {
      await result.current.sendMessage('Hi assistant');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'Hi assistant',
      status: 'completed',
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello there!',
      status: 'completed',
    });
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle tool_call and tool_result events', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: tool_call\ndata: {"call_id": "call-1", "tool": "get_device_series", "args": {"metric": "temperature"}}\n\n',
        'event: tool_result\ndata: {"call_id": "call-1", "result": {"count": 100}}\n\n',
        'event: token\ndata: {"content": "Found 100 readings."}\n\n',
        'event: done\ndata: {}\n\n',
      ])
    );

    const { result } = renderHook(() => useChatStream({ apiBaseUrl: 'http://test-agent' }));

    await act(async () => {
      await result.current.sendMessage('Fetch series');
    });

    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.toolCalls).toHaveLength(1);
    expect(assistantMsg.toolCalls?.[0]).toEqual({
      callId: 'call-1',
      tool: 'get_device_series',
      args: { metric: 'temperature' },
      result: { count: 100 },
      status: 'completed',
    });
    expect(assistantMsg.content).toBe('Found 100 readings.');
    expect(assistantMsg.status).toBe('completed');
  });

  it('should cancel an in-flight stream via abortStream', async () => {
    let controllerToAbort: ReadableStreamDefaultController | null = null;
    const stream = new ReadableStream({
      start(c) {
        controllerToAbort = c;
        c.enqueue(new TextEncoder().encode('event: token\ndata: {"content": "Partial"}\n\n'));
      },
      cancel() {
        // stream cancelled
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const { result } = renderHook(() => useChatStream({ apiBaseUrl: 'http://test-agent' }));

    await act(async () => {
      // Fire and allow first microtask/chunk
      result.current.sendMessage('Start streaming');
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.abortStream();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages[1].status).toBe('completed');
    if (controllerToAbort) {
      try {
        (controllerToAbort as ReadableStreamDefaultController).close();
      } catch {
        // already closed
      }
    }
  });

  it('should handle server error events', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: error\ndata: {"message": "Service unavailable"}\n\n',
        'event: done\ndata: {}\n\n',
      ])
    );

    const { result } = renderHook(() => useChatStream({ apiBaseUrl: 'http://test-agent' }));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBe('Service unavailable');
    expect(result.current.messages[1].status).toBe('error');
    expect(result.current.isStreaming).toBe(false);
  });

  it('should clear messages when clearMessages is called', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: token\ndata: {"content": "Response"}\n\n',
        'event: done\ndata: {}\n\n',
      ])
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('should extract error detail from 429 response body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Rate limit exceeded. Try again in 60 seconds.' }),
        { status: 429, statusText: 'Too Many Requests', headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { result } = renderHook(() => useChatStream({ apiBaseUrl: 'http://test-agent' }));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBe('Rate limit exceeded. Try again in 60 seconds.');
    expect(result.current.messages[1].status).toBe('error');
    expect(result.current.messages[1].error).toBe('Rate limit exceeded. Try again in 60 seconds.');
    expect(result.current.isStreaming).toBe(false);
  });

  it('should extract error detail from 413 payload too large response', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Message length (5000 chars) exceeds maximum allowed limit of 4000 chars.' }),
        { status: 413, statusText: 'Payload Too Large', headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { result } = renderHook(() => useChatStream({ apiBaseUrl: 'http://test-agent' }));

    await act(async () => {
      await result.current.sendMessage('A'.repeat(5000));
    });

    expect(result.current.error).toBe(
      'Message length (5000 chars) exceeds maximum allowed limit of 4000 chars.'
    );
    expect(result.current.messages[1].status).toBe('error');
  });

  it('should extract validation details from 422 response body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ detail: [{ msg: 'Field required' }] }),
        { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { result } = renderHook(() => useChatStream({ apiBaseUrl: 'http://test-agent' }));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toBe('Field required');
    expect(result.current.messages[1].status).toBe('error');
  });
});
