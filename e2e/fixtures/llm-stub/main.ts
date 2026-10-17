import { createStubServer, DEFAULT_STUB_PORT } from './server';

const port = Number(process.env['E2E_LLM_STUB_PORT'] ?? DEFAULT_STUB_PORT);

createStubServer().listen(port, '127.0.0.1', () => {
  console.log(`LLM stub listening on http://127.0.0.1:${port}/v1`);
});
