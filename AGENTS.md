# AGENTS.md — Causal Agent Protocol (CAP) v0.2.2

## What This Is
Two things in one repo:
1. **Protocol Spec** — CAP v0.2.2, the open protocol for AI agents to discover and invoke causal reasoning engines
2. **MCP Bridge** — TypeScript transport layer that exposes any CAP HTTP endpoint as MCP tools (stdio + Streamable HTTP)

This is NOT a causal engine. The Python CAP server (Abel's graph-computer) does the actual computation.
This repo is the protocol definition + a thin transport bridge.

## Architecture
```
┌─────────────┐       ┌──────────────┐       ┌──────────────────┐
│  LLM Agent  │──MCP──│  TS Bridge   │──HTTP──│  Python CAP      │
│  (any)      │       │  (this repo) │       │  Server (Abel)   │
└─────────────┘       └──────────────┘       └──────────────────┘
```
- The bridge translates MCP tool calls → CAP HTTP POST `/v1/{category}/{name}`
- 20 MCP tools registered (cap_ prefix), mapping 1:1 to all L1+L2 CAP verbs
- Dual transport: `--stdio` for local MCP, HTTP for remote MCP + CAP HTTP binding
- BoundDispatcher pattern: `(verb, params) => Promise<VerbResult>` decouples transport from backend

## Layer Dependency Direction (enforced by structural tests)
```
src/cap/          → (no internal deps, only zod)
src/utils/        → (no internal deps)
src/security/     → src/cap/
src/transport/    → src/cap/ + src/security/ + src/utils/ + config
```

## Code Conventions
- CAP protocol layer: src/cap/ (engine-agnostic, reusable)
- Transport layer: src/transport/ (MCP binding, HTTP binding, A2A)
- All schemas: Zod
- MCP tool prefix: cap_
- Config env vars: CAP_ENDPOINT, CAP_API_KEY, CAP_PORT, etc.

## Key Files
- docs/CAP-v0.2.2-PROTOCOL-SPEC.md — The protocol spec (normative)
- src/cap/capability-card.ts — Machine-readable self-description
- src/cap/envelope.ts — Request/Response envelope construction
- src/cap/errors.ts — All CAP error codes
- src/transport/mcp-binding.ts — MCP tool registration (20 tools, all L1+L2)
- src/transport/mcp-http-transport.ts — MCP Streamable HTTP at /mcp
- src/transport/http-binding.ts — CAP HTTP binding at /v1/:category/:name
- src/index.ts — Entrypoint (creates CAP HTTP proxy + starts transport)

## Quality Gates
```
npm run check        # Lint + format + unit tests
npm run check:all    # Full: lint + format + all tests
npm run typecheck    # TypeScript type checking
npm run structural   # Architectural layer boundary tests
```

## Do NOT
- Add causal computation logic here — that belongs in the Python CAP server
- Call any LLM API from within this bridge
- Return >50 edges in traverse.subgraph
- Declare conformance_level as 3 (reserved in v0.2 spec)
