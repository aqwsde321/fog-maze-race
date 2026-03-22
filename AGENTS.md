# fog-maze-race Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-22

## Active Technologies

- TypeScript, Node.js 22 LTS + React 19 + Vite 7, PixiJS 8, Fastify 5, Socket.IO 4.x, Zustand, Vitest, Playwright (001-fog-maze-race)

## Project Structure

```text
apps/server/
apps/web/
packages/shared/
tests/e2e/
```

## Commands

pnpm dev
pnpm test
pnpm test:e2e
pnpm build

## Code Style

TypeScript, Node.js 22 LTS: Follow standard conventions

## Recent Changes

- 001-fog-maze-race: Added TypeScript, Node.js 22 LTS + React 19 + Vite 7, PixiJS 8, Fastify 5, Socket.IO 4.x, Zustand, Vitest, Playwright

<!-- MANUAL ADDITIONS START -->
- Always implement with DDD boundaries: domain rules belong in shared/server domain and application layers, not in UI or transport adapters.
- Always follow TDD for new behavior: write a failing automated test first, implement the change, and do not treat the work as done until the relevant tests pass.
<!-- MANUAL ADDITIONS END -->
