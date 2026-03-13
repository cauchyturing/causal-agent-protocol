# AGENTS.md — Abel CAP Reference Implementation

## What This Is
Reference implementation of the Causal Agent Protocol (CAP) v0.2.2.
CAP is an open protocol (see /docs/CAP-v0.2.2-PROTOCOL-SPEC.md) defining how
AI agents discover, invoke, and trust causal reasoning engines.

This repo is Abel AI's Level 2 implementation backed by PCMCI on H100s + Neo4j.

## Architecture
- TypeScript, dual transport: MCP (stdio + Streamable HTTP) + CAP HTTP binding
- Wraps Abel API at https://abel-agentic-trade-backend.abel.ai
- Translates Abel responses → CAP standard envelopes with mandatory causal semantics
- Serves Capability Card at /.well-known/cap.json

## Key Principle: Semantic Honesty
When all path nodes have mechanisms: reasoning_mode = "scm_simulation".
When coverage is partial: reasoning_mode = "graph_propagation" (honest fallback).
In BOTH cases: identification_status = "not_formally_identified".
Mechanism override ≠ formal identification. Every L2 response says so explicitly.

## Key Principle: LLM-Abel Orthogonality
This server does NO LLM inference. The calling agent IS the LLM. Abel does math.

## Code Conventions
- CAP protocol layer: src/cap/ (engine-agnostic, reusable by other implementations)
- Verb handlers: src/verbs/ (Abel-specific, wraps Abel API)
- Abel API client: src/abel-client/
- All schemas: Zod
- MCP tool prefix: cap_
- Every intervene.* effect MUST include per-effect: reasoning_mode + mechanism_coverage_complete
- Every intervene.* result MUST include result-level: identification_status + assumptions

## Layer Dependency Direction (enforced by structural tests)
```
src/cap/          → (no internal deps, only zod)
src/abel-client/  → src/cap/ (types only)
src/verbs/        → src/cap/ + src/abel-client/
src/transport/    → src/cap/ + src/verbs/
src/security/     → src/cap/
src/utils/        → (no internal deps)
```

## Do NOT
- Call any LLM API from within this server
- Expose raw Neo4j queries
- Return >50 edges in traverse.subgraph
- Cache predictions >5 minutes
- Return reasoning_mode "scm_simulation" if ANY node on the solve path lacks a mechanism
- Declare conformance_level as 3 (Level 3 is reserved in v0.2 spec)

## Quality Gates
```
make check        # Lint + format + unit tests + typecheck (quick gate)
make check-all    # Full: lint + format + all tests + typecheck + structural
make test-unit    # Unit tests only
make test-conformance  # CAP conformance suite
```

## Key Files
- src/verbs/_shared/l2-semantics.ts — THE critical file. Single source of truth for L2 claims.
- src/cap/capability-card.ts — Abel's Capability Card (machine-readable self-description)
- src/cap/envelope.ts — Request/Response envelope construction
- src/cap/errors.ts — All CAP error codes
- src/config.ts — Environment variable parsing
- src/transport/mcp-http-transport.ts — MCP Streamable HTTP at /mcp (stateful, per-session)
- src/transport/mcp-binding.ts — MCP tool registration (shared by stdio + HTTP transports)
