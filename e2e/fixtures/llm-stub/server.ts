import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { decideReply, type ChatMessage, type StubReply } from './scenarios';

export const DEFAULT_STUB_PORT = 8890;
const MODEL_ID = 'llm-stub';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function chunk(delta: Record<string, unknown>, finishReason: string | null = null, id = 'chatcmpl-stub') {
  return {
    id,
    object: 'chat.completion.chunk',
    created: 0,
    model: MODEL_ID,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

function streamChunks(reply: StubReply): unknown[] {
  if (reply.kind === 'text') {
    const words = reply.text.split(' ');
    return [
      chunk({ role: 'assistant' }),
      ...words.map((w, i) => chunk({ content: i === 0 ? w : ` ${w}` })),
      chunk({}, 'stop'),
    ];
  }
  return [
    chunk({ role: 'assistant' }),
    ...reply.calls.map((call, index) =>
      chunk({
        tool_calls: [
          {
            index,
            id: `call_stub_${index}`,
            type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          },
        ],
      }),
    ),
    chunk({}, 'tool_calls'),
  ];
}

function completion(reply: StubReply) {
  const message =
    reply.kind === 'text'
      ? { role: 'assistant', content: reply.text }
      : {
          role: 'assistant',
          content: null,
          tool_calls: reply.calls.map((call, index) => ({
            id: `call_stub_${index}`,
            type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          })),
        };
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion',
    created: 0,
    model: MODEL_ID,
    choices: [{ index: 0, message, finish_reason: reply.kind === 'text' ? 'stop' : 'tool_calls' }],
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let payload: { messages?: ChatMessage[]; stream?: boolean };
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: { message: 'Invalid JSON body' } });
    return;
  }

  const reply = decideReply(Array.isArray(payload.messages) ? payload.messages : []);
  if (!payload.stream) {
    sendJson(res, 200, completion(reply));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  for (const c of streamChunks(reply)) {
    res.write(`data: ${JSON.stringify(c)}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

export function createStubServer(): Server {
  return createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok' });
    } else if (req.method === 'GET' && path === '/v1/models') {
      sendJson(res, 200, { object: 'list', data: [{ id: MODEL_ID, object: 'model' }] });
    } else if (req.method === 'POST' && path === '/v1/chat/completions') {
      void handleChat(req, res);
    } else {
      sendJson(res, 404, { error: { message: 'Not found' } });
    }
  });
}
