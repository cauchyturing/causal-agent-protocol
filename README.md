# Abel CAP Server

Reference implementation of the [Causal Agent Protocol (CAP)](docs/CAP-v0.2.2-PROTOCOL-SPEC.md) v0.2.2 — an open protocol defining how AI agents discover, invoke, and trust causal reasoning engines.

This is Abel AI's **Level 2** (Intervene) implementation, backed by PCMCI on H100 clusters with a Neo4j graph backend covering 150+ financial instruments.

## Quick Start

```bash
# Install
npm install

# Configure (minimum required)
export ABEL_API_BASE=https://abel-agentic-trade-backend.abel.ai
export ABEL_API_KEY=your-key         # optional for public-tier access
export CAP_PUBLIC_URL=https://your-domain.com  # optional, defaults to localhost

# Run as HTTP server
npm start

# Run as MCP server (stdio, for local agent integration)
npm run start:stdio

# Verify
curl http://localhost:3001/.well-known/cap.json
```

## Architecture

```
src/
├── cap/            # Protocol layer — engine-agnostic, reusable (depends only on zod)
├── abel-client/    # Abel API client + response transformers
├── verbs/          # Verb handlers (Abel-specific, wraps Abel API)
│   ├── core/       # L1/L2 core verbs: meta.capabilities, graph.neighbors, effect.query, graph.paths
│   ├── convenience/# Convenience verbs: observe.*, traverse.*, intervene.do, meta.*
│   └── _shared/    # Cross-cutting: L2 semantics, error mapping
├── transport/      # HTTP binding (§8.1), MCP binding (§8.2), A2A binding (§8.3)
├── security/       # Access tiers (§9.1), progressive disclosure (§9.2), rate limiting
└── utils/          # Shared utilities (duration helpers)
```

**Layer dependency direction** (enforced by structural tests):
```
cap/          → (zod only)
abel-client/  → cap/
verbs/        → cap/ + abel-client/
transport/    → cap/ + verbs/
security/     → cap/
utils/        → (no internal deps)
```

## Supported Verbs (18 total)

| Category | Verb | Level | Description |
|----------|------|-------|-------------|
| Core | `meta.capabilities` | L1 | Server self-description |
| Core | `graph.neighbors` | L1 | Direct causal neighbors |
| Core | `effect.query` | L1/L2 | Observational + interventional queries |
| Core | `graph.paths` | L2 | Causal paths between nodes |
| Observe | `observe.predict` | L1 | Single-target prediction |
| Observe | `observe.predict_multistep` | L1 | Multi-horizon prediction |
| Observe | `observe.predict_batch` | L1 | Batch predictions |
| Observe | `observe.attribute` | L1 | Causal attribution |
| Traverse | `traverse.parents` | L1 | Parent nodes |
| Traverse | `traverse.children` | L1 | Child nodes |
| Traverse | `traverse.path` | L1 | Alias for graph.paths |
| Traverse | `traverse.subgraph` | L1 | Local subgraph extraction |
| Traverse | `traverse.latest` | L1 | Latest values for nodes |
| Intervene | `intervene.do` | L2 | Pearl's do-operator simulation |
| Meta | `meta.health` | L1 | Health check |
| Meta | `meta.graph_info` | L1 | Graph metadata |
| Meta | `meta.node_info` | L1 | Node details |
| Meta | `meta.algorithms` | L1 | Algorithm information |

## Semantic Honesty

This implementation follows the **Partial Coverage Rule** (CAP §6.6):

- When **all** path nodes have structural mechanisms: `reasoning_mode = "scm_simulation"`
- When coverage is **partial**: `reasoning_mode = "graph_propagation"` (honest fallback)
- In **both** cases: `identification_status = "not_formally_identified"`

Mechanism override is not formal identification. Every L2 response says so explicitly.

## Quality Gates

```bash
npm run check          # Lint + format + unit tests (quick gate)
npm run check:all      # Full: lint + format + all tests + typecheck
npm run test:unit      # Unit tests only
npm run test:conformance  # CAP conformance suite
npm run structural     # Layer boundary enforcement
npm run typecheck      # TypeScript type check
```

## Transports

| Transport | Binding | Endpoint |
|-----------|---------|----------|
| HTTP | §8.1 | `POST /v1/{category}/{name}` |
| MCP | §8.2 | stdio (local) |
| A2A | §8.3 | `GET /.well-known/agent-card.json` |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ABEL_API_BASE` | (required) | Abel API base URL |
| `ABEL_API_KEY` | — | API key for Abel backend |
| `CAP_ACCESS_TIER` | `standard` | Default tier: `public`, `standard`, `enterprise` |
| `CAP_PORT` | `3001` | HTTP server port |
| `CAP_PUBLIC_URL` | — | Public URL for capability card (defaults to localhost) |
| `CAP_LOG_LEVEL` | `info` | Log level |
| `CAP_RATE_LIMIT_PUBLIC` | `100` | Requests/hour for public tier |
| `CAP_RATE_LIMIT_STANDARD` | `1000` | Requests/hour for standard tier |
| `CAP_RATE_LIMIT_ENTERPRISE` | `10000` | Requests/hour for enterprise tier |
| `CAP_MAX_SUBGRAPH_EDGES` | `50` | Max edges in traverse.subgraph |
| `CAP_MCP_ENABLED` | `true` | Enable MCP transport |
| `CAP_A2A_ENABLED` | `true` | Enable A2A binding |

## Implementing Your Own CAP Server

The `src/cap/` directory is engine-agnostic and can be copied as-is:

1. Copy `src/cap/` — protocol types, envelope, errors, capability card builder
2. Write your own `src/verbs/` handlers implementing the `VerbHandler` interface
3. Reuse `src/transport/` and `src/security/` layers
4. Register handlers and start serving

See `src/verbs/handler.ts` for the handler interface (5 lines).

## License

Apache-2.0 — see [LICENSE](LICENSE).
