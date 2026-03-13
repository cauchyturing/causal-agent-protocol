# Contributing to Abel CAP Reference Implementation

## Setup

```bash
git clone <repo-url> && cd abel-cap-ref
npm install
cp .env.example .env  # if applicable
```

Requires Node >= 20.

## Running Tests

```bash
npm run check-all     # Full gate: lint + format + all tests
npm run test          # All tests (unit + integration + conformance + structural)
npm run test:unit     # Unit tests only
npm run typecheck     # TypeScript type checking
```

All tests must pass before submitting a PR.

## Adding a New Verb

1. **Create handler** — Add `src/verbs/<verb-name>.ts` implementing the verb logic.
2. **Add to VERB_REGISTRY** — Register the verb in the shared verb registry.
3. **Register in `index.ts`** — Wire the verb handler into the server's route setup.
4. **Register MCP tool** — Add the corresponding MCP tool binding in `mcp-binding.ts`.

Follow existing verbs as examples. Every verb must include proper CAP envelope wrapping
and respect the semantic honesty rules documented in CLAUDE.md.

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
src/abel-client/  → src/cap/ (types only)
src/verbs/        → src/cap/ + src/abel-client/
src/transport/    → src/cap/ + src/verbs/
src/security/     → src/cap/
src/utils/        → no internal deps
```

See CLAUDE.md for full architectural rules.

## PR Process

1. Branch from `main` (or the active dev branch).
2. All tests pass: `npm run check-all`
3. Typecheck clean: `npm run typecheck`
4. Lint clean: zero warnings
5. Keep PRs focused — one concern per PR.
