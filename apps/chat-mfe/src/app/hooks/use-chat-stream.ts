import { useState, useRef, useCallback, useEffect } from 'react';
import type { DashboardContext } from 'shared-mfe-context';

export interface ToolStep {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'running' | 'completed' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolStep[];
  status?: 'streaming' | 'completed' | 'error';
  timestamp?: string;
  error?: string;
}

export interface UseChatStreamOptions {
  apiBaseUrl?: string;
  context?: DashboardContext;
  initialMessages?: ChatMessage[];
}

interface StreamEventPayload {
  content?: string;
  delta?: string;
  call_id?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  output?: unknown;
  message?: string;
  [key: string]: unknown;
}

export interface UseChatStreamReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (prompt: string) => Promise<void>;
  abortStream: () => void;
  clearMessages: () => void;
}

export function useChatStream(options: UseChatStreamOptions = {}): UseChatStreamReturn {
  const {
    apiBaseUrl = (import.meta.env?.VITE_AGENT_API_URL as string | undefined) || 'http://localhost:8000',
    context,
    initialMessages = [],
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const contextRef = useRef<DashboardContext | undefined>(context);
  contextRef.current = context;

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setIsStreaming(false);
    setError(null);
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role === 'assistant' && last.status === 'streaming') {
        return [
          ...prev.slice(0, -1),
          { ...last, status: 'completed' },
        ];
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isStreaming) return;

      setError(null);

      const userMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const assistantMessageId = `msg-${Date.now() + 1}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();

      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: trimmed,
        status: 'completed',
        timestamp: nowIso,
      };

      const assistantPlaceholder: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        status: 'streaming',
        timestamp: nowIso,
      };

      // Construct history for the API request: user messages and assistant completed contents
      const currentHistory = [...messages, userMessage];
      setMessages([...currentHistory, assistantPlaceholder]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestPayload = {
        messages: currentHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        context: contextRef.current,
      };

      try {
        const response = await fetch(`${apiBaseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorDetail = '';
          try {
            const errorJson = await response.json();
            if (errorJson && typeof errorJson === 'object') {
              if (typeof errorJson.detail === 'string') {
                errorDetail = errorJson.detail;
              } else if (Array.isArray(errorJson.detail)) {
                errorDetail = errorJson.detail
                  .map((d: any) => (d && typeof d === 'object' && d.msg ? d.msg : String(d)))
                  .join('; ');
              } else if (typeof errorJson.message === 'string') {
                errorDetail = errorJson.message;
              }
            }
          } catch {
            try {
              errorDetail = await response.text();
            } catch {
              // fallback to status text
            }
          }

          if (errorDetail && errorDetail.trim()) {
            throw new Error(errorDetail.trim());
          }
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is empty, cannot read stream.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'message';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
              currentEvent = 'message';
              continue;
            }

            if (trimmedLine.startsWith('event:')) {
              currentEvent = trimmedLine.slice(6).trim();
              continue;
            }

            if (trimmedLine.startsWith('data:')) {
              const rawData = trimmedLine.slice(5).trim();
              let parsedData: StreamEventPayload = {};
              try {
                parsedData = JSON.parse(rawData);
              } catch {
                parsedData = { content: rawData };
              }

              if (currentEvent === 'token') {
                const tokenContent = parsedData.content ?? parsedData.delta ?? '';
                setMessages((prev) => {
                  const lastIndex = prev.findIndex((m) => m.id === assistantMessageId);
                  if (lastIndex === -1) return prev;
                  const target = prev[lastIndex];
                  const updated: ChatMessage = {
                    ...target,
                    content: target.content + tokenContent,
                  };
                  const next = [...prev];
                  next[lastIndex] = updated;
                  return next;
                });
              } else if (currentEvent === 'tool_call') {
                const step: ToolStep = {
                  callId: parsedData.call_id || `call-${Date.now()}`,
                  tool: parsedData.tool || 'unknown_tool',
                  args: parsedData.args || {},
                  status: 'running',
                };

                setMessages((prev) => {
                  const lastIndex = prev.findIndex((m) => m.id === assistantMessageId);
                  if (lastIndex === -1) return prev;
                  const target = prev[lastIndex];
                  const existingSteps = target.toolCalls || [];
                  const updated: ChatMessage = {
                    ...target,
                    toolCalls: [...existingSteps, step],
                  };
                  const next = [...prev];
                  next[lastIndex] = updated;
                  return next;
                });
              } else if (currentEvent === 'tool_result') {
                const callId = parsedData.call_id;
                const result = parsedData.result !== undefined ? parsedData.result : parsedData.output;

                setMessages((prev) => {
                  const lastIndex = prev.findIndex((m) => m.id === assistantMessageId);
                  if (lastIndex === -1) return prev;
                  const target = prev[lastIndex];
                  const existingSteps = target.toolCalls || [];
                  const updatedSteps = existingSteps.map((s) => {
                    if (s.callId === callId) {
                      const hasError =
                        result !== null &&
                        typeof result === 'object' &&
                        'error' in result &&
                        Boolean((result as { error?: unknown }).error);
                      return {
                        ...s,
                        result,
                        status: (hasError ? 'error' : 'completed') as ToolStep['status'],
                      };
                    }
                    return s;
                  });

                  const updated: ChatMessage = {
                    ...target,
                    toolCalls: updatedSteps,
                  };
                  const next = [...prev];
                  next[lastIndex] = updated;
                  return next;
                });
              } else if (currentEvent === 'error') {
                const errMsg = parsedData.message || 'Unknown streaming error';
                setError(errMsg);
                setMessages((prev) => {
                  const lastIndex = prev.findIndex((m) => m.id === assistantMessageId);
                  if (lastIndex === -1) return prev;
                  const target = prev[lastIndex];
                  const updated: ChatMessage = {
                    ...target,
                    status: 'error',
                    error: errMsg,
                  };
                  const next = [...prev];
                  next[lastIndex] = updated;
                  return next;
                });
              } else if (currentEvent === 'done') {
                setMessages((prev) => {
                  const lastIndex = prev.findIndex((m) => m.id === assistantMessageId);
                  if (lastIndex === -1) return prev;
                  const target = prev[lastIndex];
                  if (target.status === 'error') return prev;
                  const updated: ChatMessage = {
                    ...target,
                    status: 'completed',
                  };
                  const next = [...prev];
                  next[lastIndex] = updated;
                  return next;
                });
              }
            }
          }
        }

        // Finalize assistant status if not already completed/errored
        setMessages((prev) => {
          const lastIndex = prev.findIndex((m) => m.id === assistantMessageId);
          if (lastIndex === -1) return prev;
          const target = prev[lastIndex];
          if (target.status === 'streaming') {
            const next = [...prev];
            next[lastIndex] = { ...target, status: 'completed' };
            return next;
          }
          return prev;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Handled by abortStream
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setMessages((prev) => {
          const lastIndex = prev.findIndex((m) => m.id === assistantMessageId);
          if (lastIndex === -1) return prev;
          const target = prev[lastIndex];
          const next = [...prev];
          next[lastIndex] = { ...target, status: 'error', error: msg };
          return next;
        });
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [apiBaseUrl, isStreaming, messages]
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    abortStream,
    clearMessages,
  };
}
