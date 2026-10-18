---
name: nestjs-and-sqlite-quirks
description: Use when working on the NestJS dashboard API or its SQLite access: dependency injection under Vitest, optional providers, Kysely queries and timestamps, better-sqlite3 with Bun, or reconnecting after an ETL file swap.
---

# NestJS and SQLite quirks

Pitfalls specific to the NestJS dashboard API and derived SQLite database.

- **NestJS DI under Vitest**: Vitest does not emit TypeScript `design:paramtypes` metadata by default. Add explicit `@Inject(ServiceName)` to controller constructor parameters (e.g. `@Inject(AppService) private readonly appService: AppService`) to prevent undefined injection in tests without extra compiler plugins.
- **Kysely SQLite Integer Division & UTC Timestamps**: Template expressions `${bucketSeconds}` in Kysely `sql` strings parameterize values as SQLite binds, producing floating-point division. Wrap interval seconds with `sql.raw(bucketSeconds.toString())`. SQLite `datetime()` uses space separation; format as ISO UTC via `replace(datetime(...), ' ', 'T') || 'Z'`.
- **NestJS Optional Providers in Vitest**: Optional constructor dependencies (e.g. `sqliteInstance?: Database.Database`) trigger `UnknownDependenciesException` in Vitest unless explicitly decorated with `@Optional()`.
- **`better-sqlite3` Native Addon & Bun Crash**: Running scripts that load `better-sqlite3` directly via `bun run` or `bun` triggers a fatal N-API panic (`Error::New napi_get_last_error_info`). For standalone CLI runners touching `better-sqlite3` (e.g. `apps/dashboard-api/src/etl-cli.ts`), run with Node.js and `jiti` (`node apps/dashboard-api/src/etl-runner.cjs`), not bare `bun`.
- **Linux Inode Detachment on Atomic File Swaps (`reconnect()`)**: On Linux, replacing an SQLite file atomically via `fs.renameSync` associates the path with a new inode. Existing open file descriptors continue querying the unlinked old inode. Persistence repositories (e.g. `KyselyMeasurementsRepository`) must close and recreate their database instance (`reconnect()`) immediately following an ETL atomic swap.
- **Fastify `reply.hijack()` for MCP Stream Transports**: When delegating requests to `@modelcontextprotocol/sdk` transports (e.g. `SSEServerTransport`) that write to Node's raw response stream (`reply.raw`), call `reply.hijack()` first. Without `reply.hijack()`, Fastify's response lifecycle attempts to send headers or close the socket prematurely.
