<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Frontend Import Convention

Frontend (`apps/frontend`) source and test files import via the `@/*` path alias (mapped to the workspace root in `tsconfig.json`, e.g. `@/app/lib/use-game-socket`), never relative `./`/`../` paths. Vitest resolves the same alias via a manual `resolve.alias` entry in `vitest.config.ts`.
