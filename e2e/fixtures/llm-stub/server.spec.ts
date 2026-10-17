import { execFileSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FALLBACK_REPLY, SCRIPTED_TOOL_NAMES, TOOL_ANSWER_REPLY } from './scenarios';
import { createStubServer } from './server';

interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    parameters: {
      properties: Record<string, { type?: string; enum?: unknown[]; anyOf?: { type?: string; enum?: unknown[] }[] }>;
      required: string[];
    };
  };
}

interface StreamedCall {
  name: string;
  arguments: string;
}

const agentDir = path.resolve(import.meta.dirname, '../../../apps/agent-service');

function loadToolSchemas(): ToolSchema[] {
  const script =
    'import json; from agent_service.tools.registry import get_tool_registry; ' +
    'print(json.dumps(get_tool_registry().get_openai_tools()))';
  const out = execFileSync('uv', ['run', 'python', '-c', script], { cwd: agentDir, encoding: 'utf8' });
  return JSON.parse(out.trim().split('\n').pop() as string);
}

function assertValidArguments(schema: ToolSchema, args: Record<string, unknown>): void {
  const { properties, required } = schema.function.parameters;
  for (const key of required) {
    expect(args, `${schema.function.name} requires ${key}`).toHaveProperty(key);
  }
  for (const [key, value] of Object.entries(args)) {
    expect(Object.keys(properties), `${schema.function.name} has no property ${key}`).toContain(key);
    const prop = properties[key];
    const variants = prop.anyOf ?? [prop];
    const enums = variants.flatMap((v) => v.enum ?? []);
    if (enums.length > 0) {
      expect(enums).toContain(value);
    }
  }
}

async function readStream(
  url: string,
  messages: unknown[],
): Promise<{ lines: string[]; text: string; calls: StreamedCall[] }> {
  const res = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'any', stream: true, messages }),
  });
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  const raw = await res.text();
  const lines = raw.split('\n\n').filter(Boolean).map((l) => l.replace(/^data: /, ''));
  let text = '';
  const calls: StreamedCall[] = [];
  for (const line of lines) {
    if (line === '[DONE]') continue;
    const delta = JSON.parse(line).choices[0].delta;
    if (delta.content) text += delta.content;
    for (const tc of delta.tool_calls ?? []) {
      calls[tc.index] = {
        name: (calls[tc.index]?.name ?? '') + (tc.function.name ?? ''),
        arguments: (calls[tc.index]?.arguments ?? '') + (tc.function.arguments ?? ''),
      };
    }
  }
  return { lines, text, calls };
}

describe('llm stub server', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createStubServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('starts without credentials and answers requests', async () => {
    const res = await fetch(`${url}/models`);
    expect(res.status).toBe(200);
    expect((await res.json()).data[0].id).toBe('llm-stub');
  });

  it('streams a completion terminated by [DONE]', async () => {
    const { lines, text } = await readStream(url, [{ role: 'user', content: 'hello' }]);
    expect(lines.at(-1)).toBe('[DONE]');
    expect(text).toBe(FALLBACK_REPLY);
  });

  it('replies with the fallback text for unrecognised prompts', async () => {
    const { calls, text } = await readStream(url, [{ role: 'user', content: 'Reply with one word: ping' }]);
    expect(calls).toHaveLength(0);
    expect(text).toBe(FALLBACK_REPLY);
  });

  it('emits a tool call, then a final answer after the tool result', async () => {
    const first = await readStream(url, [{ role: 'user', content: 'Which metrics are available?' }]);
    expect(first.calls).toHaveLength(1);
    expect(first.calls[0].name).toBe('list_metrics');

    const second = await readStream(url, [
      { role: 'user', content: 'Which metrics are available?' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'call_stub_0', type: 'function' }] },
      { role: 'tool', tool_call_id: 'call_stub_0', content: '{"metrics":[]}' },
    ]);
    expect(second.calls).toHaveLength(0);
    expect(second.text).toBe(TOOL_ANSWER_REPLY);
  });

  it('serves non-streaming completions as JSON', async () => {
    const res = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });
    expect((await res.json()).choices[0].message.content).toBe(FALLBACK_REPLY);
  });

  it('only scripts tool calls that are valid for the agent tool catalogue', async () => {
    const schemas = loadToolSchemas();
    const prompts = ['metrics', 'devices', 'anomalies', 'compare', 'series', 'stats'];
    const seen = new Set<string>();
    for (const prompt of prompts) {
      const { calls } = await readStream(url, [{ role: 'user', content: prompt }]);
      expect(calls).toHaveLength(1);
      const schema = schemas.find((s) => s.function.name === calls[0].name);
      expect(schema, `unknown tool ${calls[0].name}`).toBeDefined();
      assertValidArguments(schema as ToolSchema, JSON.parse(calls[0].arguments));
      seen.add(calls[0].name);
    }
    expect([...seen].sort()).toEqual([...SCRIPTED_TOOL_NAMES].sort());
  }, 60000);
});
