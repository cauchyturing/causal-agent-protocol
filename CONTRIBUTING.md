# Contributing to CAP Protocol Spec + MCP Bridge

## Setup

```bash
git clone <repo-url> && cd causal-agent-protocol
npm install
cp .env.example .env  # edit CAP_ENDPOINT to point to your Python CAP server
```

Requires Node >= 20.

## Running Tests

```bash
npm run check         # Quick gate: lint + format + unit tests
npm run check:all     # Full: lint + format + all tests
npm run test          # All tests (unit + integration + conformance + structural)
npm run test:unit     # Unit tests only
npm run typecheck     # TypeScript type checking
npm run structural    # Layer boundary + verb registry consistency
```

All tests must pass before submitting a PR.

## Adding a New Verb

1. **Add to VERB_REGISTRY** — Register in `src/cap/verbs.ts` with name, category, tier, minLevel, and semantic requirements.
2. **Add to TOOL_DEFINITIONS** — Add MCP tool definition in `src/transport/mcp-binding.ts`.
3. **Register MCP tool** — Add `server.tool()` call with Zod schema in `createMcpServer()` in the same file.
4. **The structural test `verb-registry-consistency.test.ts` will automatically catch any mismatch** between VERB_REGISTRY and TOOL_DEFINITIONS.
5. **Implement the verb handler** in the Python CAP server (not in this repo).

## Code Style

Enforced by ESLint and Prettier. Before committing:

```bash
npm run lint:fix && npm run format
```

CI runs `npm run lint && npm run format:check` — zero warnings allowed.

## Layer Boundaries

The dependency direction between layers is enforced by structural tests:

```
src/cap/          → no internal deps (only zod)
src/utils/        → no internal deps
src/security/     → src/cap/
src/transport/    → src/cap/ + src/security/ + src/utils/ + config
```

See CLAUDE.md for full architectural rules.

## PR Process

1. Branch from `main` (or the active dev branch).
2. All tests pass: `npm run check:all`
3. Typecheck clean: `npm run typecheck`
4. Lint clean: zero warnings
5. Keep PRs focused — one concern per PR.
