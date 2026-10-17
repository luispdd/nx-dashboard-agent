export interface ChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: unknown[];
}

export interface ScriptedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type StubReply =
  | { kind: 'tool_calls'; calls: ScriptedToolCall[] }
  | { kind: 'text'; text: string };

export const FALLBACK_REPLY = 'This is a deterministic reply from the stub LLM.';
export const TOOL_ANSWER_REPLY = 'Stub summary based on the tool result.';

interface Scenario {
  keyword: RegExp;
  call: ScriptedToolCall;
}

const SCENARIOS: Scenario[] = [
  { keyword: /anomal|strange|outlier/i, call: { name: 'detect_anomalies', arguments: { metric_key: 'temperature' } } },
  { keyword: /compare/i, call: { name: 'compare_devices', arguments: { metric_key: 'temperature' } } },
  { keyword: /series|history/i, call: { name: 'get_series', arguments: { metric_key: 'temperature', device_id: 'esp32c6' } } },
  { keyword: /stats|average|summary/i, call: { name: 'get_stats', arguments: { metric_key: 'temperature' } } },
  { keyword: /metrics/i, call: { name: 'list_metrics', arguments: {} } },
  { keyword: /devices|nodes|boards/i, call: { name: 'list_devices', arguments: {} } },
];

export const SCRIPTED_TOOL_NAMES = SCENARIOS.map((s) => s.call.name);

export function decideReply(messages: ChatMessage[]): StubReply {
  const last = messages[messages.length - 1];
  if (last?.role === 'tool') {
    return { kind: 'text', text: TOOL_ANSWER_REPLY };
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const prompt = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const scenario = SCENARIOS.find((s) => s.keyword.test(prompt));
  if (scenario) {
    return { kind: 'tool_calls', calls: [scenario.call] };
  }
  return { kind: 'text', text: FALLBACK_REPLY };
}
