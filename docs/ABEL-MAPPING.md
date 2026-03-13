# Abel Internal API → CAP Verb Mapping

This document maps Abel's internal REST API endpoints to CAP v0.2.2 verbs.
The Python CAP server uses this mapping to implement the actual verb handlers.
The TS MCP bridge proxies to the Python server — it does NOT implement this mapping.

## Core Verbs

| CAP Verb | Abel Endpoint(s) | Transform |
|----------|-----------------|-----------|
| `meta.capabilities` | None (static) | Return Capability Card |
| `graph.neighbors(parents)` | `GET /causal_graph/{ticker}/features` | Rename fields, apply tier obfuscation |
| `graph.neighbors(children)` | `GET /causal_graph/{ticker}/children` | Rename fields |
| `graph.paths` | Compose: recursive `/features` + `/children` | BFS path search |
| `effect.query(observational)` | `GET /causal_graph/{ticker}/prediction` | Wrap in CAP envelope |
| `effect.query(interventional)` | `POST /causal_graph/intervene` | Wrap + inject L2 semantics |

## Convenience Verbs

| CAP Verb | Abel Endpoint | Transform |
|----------|--------------|-----------|
| `observe.predict` | `GET /causal_graph/{ticker}/prediction` | Direct mapping |
| `observe.predict_multistep` | `GET /causal_graph/{ticker}/multi-step-prediction` | Map cumulative fields |
| `observe.predict_batch` | `GET /causal_graph/multi-step-prediction/batch` | Wrap array |
| `observe.attribute` | Compose: `/prediction` + `/features` | Decompose |
| `traverse.parents` | `GET /causal_graph/{ticker}/features` | = graph.neighbors(parents) |
| `traverse.children` | `GET /causal_graph/{ticker}/children` | = graph.neighbors(children) |
| `traverse.path` | Same as graph.paths (§6.3 alias) | BFS with depth limit |
| `traverse.subgraph` | Recursive `/features` + `/children` | BFS with depth limit ≤ 3 |
| `traverse.latest_values` | `GET /causal_graph/ticker_nodes/latest_change` | Direct mapping |
| `intervene.do` | `POST /causal_graph/intervene` | Inject L2 semantics |
| `intervene.ate` | Compose: two `intervene.do` calls | Treatment vs control delta |
| `intervene.sensitivity` | TBD — custom sensitivity analysis | Robustness check on effect |
| `meta.graph_info` | `GET /health` + cached graph stats | Aggregate |
| `meta.node_info` | `/features` + `/children` for node | Combine |
| `meta.algorithms` | Static response | PCMCI metadata |
| `meta.health` | `GET /health` | Passthrough |

## Abel's 6 Graph-Computer Primitives

These are the internal computation primitives the Python CAP server uses:

| Primitive | CAP Verbs It Serves |
|-----------|-------------------|
| `predict(ticker)` | observe.predict, observe.predict_multistep, observe.predict_batch, effect.query(obs) |
| `explain(ticker)` | observe.attribute, graph.neighbors, traverse.parents, traverse.children, graph.paths, traverse.path, traverse.subgraph |
| `intervene(do_values, targets)` | intervene.do, intervene.ate, effect.query(int) |
| `counterfactual(...)` | counterfact.query (L3 reserved) |
| `validate(graph)` | No direct CAP verb — internal quality assurance |
| `meta(...)` | meta.capabilities, meta.graph_info, meta.node_info, meta.algorithms, meta.health |
