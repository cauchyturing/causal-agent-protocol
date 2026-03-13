# Abel API → CAP Verb Mapping

See the reference impl plan for full mapping table.
This file will be expanded as verb handlers are implemented.

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
| `traverse.subgraph` | Recursive `/features` + `/children` | BFS with depth limit ≤ 3 |
| `traverse.latest_values` | `GET /causal_graph/ticker_nodes/latest_change` | Direct mapping |
| `intervene.do` | `POST /causal_graph/intervene` | Inject L2 semantics |
| `meta.graph_info` | `GET /health` + cached graph stats | Aggregate |
| `meta.node_info` | `/features` + `/children` for node | Combine |
| `meta.algorithms` | Static response | PCMCI metadata |
| `meta.health` | `GET /health` | Passthrough |
