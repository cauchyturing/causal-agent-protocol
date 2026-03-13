# Causal Agent Protocol (CAP) v0.2.2

An open protocol defining how AI agents discover, invoke, and trust causal reasoning engines.

This repo contains:
1. **Protocol Spec** — [`docs/CAP-v0.2.2-PROTOCOL-SPEC.md`](docs/CAP-v0.2.2-PROTOCOL-SPEC.md)
2. **MCP Bridge** — TypeScript transport layer that exposes any CAP HTTP endpoint as 20 MCP tools (all L1+L2 verbs)
3. **Protocol Primitives** — Reusable `src/cap/` layer (envelope, errors, capability card) for building CAP servers

## Architecture

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  LLM Agent  │──MCP──│  TS MCP Bridge   │──HTTP──│  CAP Server      │
│  (Claude,   │       │  (this repo)     │       │  (Python, your   │
│   GPT, etc) │       │                  │       │   causal engine) │
└─────────────┘       └──────────────────┘       └──────────────────┘
                       ↓ also serves:
                       POST /v1/{category}/{name}  (CAP HTTP §8.1)
                       GET  /.well-known/cap.json  (Capability Card)
                       GET  /.well-known/agent-card.json  (A2A §8.3)
                       POST/GET/DELETE /mcp  (MCP Streamable HTTP §8.2)
```

The bridge translates MCP tool calls to `POST /v1/{category}/{name}` with CAP request envelopes. The Python CAP server does the actual causal computation.

## Quick Start

```bash
npm install
npm run build

# Configure
export CAP_ENDPOINT=https://your-cap-server.com  # Python CAP server URL
export CAP_API_KEY=your-key                       # optional
export CAP_PORT=3001                              # optional, default 3001

# Run as HTTP server (serves MCP + CAP HTTP + A2A)
npm start

# Or run as MCP stdio server (for local agent integration)
npm run start:stdio

# Verify
curl http://localhost:3001/.well-known/cap.json
```

## Repo Structure

```
docs/
├── CAP-v0.2.2-PROTOCOL-SPEC.md    # The protocol spec (normative)
└── ABEL-MAPPING.md                 # Abel-specific verb→primitive mapping

src/
├── cap/            # Protocol layer — engine-agnostic, reusable (zod only)
│   ├── capability-card.ts          # Machine-readable self-description
│   ├── envelope.ts                 # Request/Response envelope construction
│   ├── errors.ts                   # All CAP error codes
│   ├── provenance.ts               # Provenance metadata builder
│   ├── semantics.ts                # Reasoning modes, identification status, assumptions
│   └── verbs.ts                    # VERB_REGISTRY — protocol truth for all 22 verbs
├── transport/      # Transport bindings
│   ├── mcp-binding.ts              # 20 MCP tools ↔ CAP verbs (all L1+L2)
│   ├── mcp-http-transport.ts       # MCP Streamable HTTP at /mcp
│   ├── http-binding.ts             # CAP HTTP binding at /v1/:cat/:name
│   ├── a2a-card.ts                 # Google A2A agent card
│   └── shared-types.ts             # BoundDispatcher, VerbResult
├── security/       # Access control
│   ├── tiers.ts                    # Public/Standard/Enterprise verb access
│   ├── obfuscation.ts              # Response detail levels
│   └── rate-limiter.ts             # Per-client rate limiting
├── utils/          # Shared utilities
├── config.ts       # Environment variable parsing
└── index.ts        # Entrypoint (CAP HTTP proxy + transport startup)
```

**Layer dependency direction** (enforced by structural tests):
```
cap/          → (zod only)
utils/        → (no internal deps)
security/     → cap/
transport/    → cap/ + security/ + utils/ + config
```

## CAP Verbs (20 L1+L2, 2 L3-reserved)

| Category | Verb | Level | Description |
|----------|------|-------|-------------|
| Core | `meta.capabilities` | L1 | Server self-description (Capability Card) |
| Core | `graph.neighbors` | L1 | Direct causal neighbors |
| Core | `effect.query` | L1/L2 | Observational + interventional causal queries |
| Core | `graph.paths` | L2 | Directed causal paths between nodes |
| Observe | `observe.predict` | L1 | Single-target causal prediction |
| Observe | `observe.predict_multistep` | L1 | Multi-horizon prediction |
| Observe | `observe.predict_batch` | L1 | Batch predictions |
| Observe | `observe.attribute` | L1 | Causal attribution (impact fractions) |
| Traverse | `traverse.parents` | L1 | Parent nodes by weight |
| Traverse | `traverse.children` | L1 | Child nodes by weight |
| Traverse | `traverse.path` | L2 | §6.3 alias for graph.paths |
| Traverse | `traverse.subgraph` | L1 | Local subgraph (max 50 edges) |
| Traverse | `traverse.latest_values` | L1 | Latest causal change data |
| Intervene | `intervene.do` | L2 | Pearl's do-operator simulation |
| Intervene | `intervene.ate` | L2 | Average Treatment Effect estimation |
| Intervene | `intervene.sensitivity` | L2 | Sensitivity analysis on causal effects |
| Meta | `meta.health` | L1 | Engine health check |
| Meta | `meta.graph_info` | L1 | Graph metadata |
| Meta | `meta.node_info` | L1 | Node details |
| Meta | `meta.algorithms` | L1 | Available algorithms |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CAP_ENDPOINT` | (required) | Python CAP server URL |
| `CAP_API_KEY` | — | API key for CAP backend |
| `CAP_ACCESS_TIER` | `standard` | Default tier: `public` / `standard` / `enterprise` |
| `CAP_PORT` | `3001` | HTTP server port |
| `CAP_PUBLIC_URL` | — | Public URL for capability card |
| `CAP_LOG_LEVEL` | `info` | Log level |
| `CAP_RATE_LIMIT_PUBLIC` | `100` | Requests/hour for public tier |
| `CAP_RATE_LIMIT_STANDARD` | `1000` | Requests/hour for standard tier |
| `CAP_RATE_LIMIT_ENTERPRISE` | `10000` | Requests/hour for enterprise tier |
| `CAP_MAX_SUBGRAPH_EDGES` | `50` | Max edges in traverse.subgraph |

## Quality Gates

```bash
npm run check        # Lint + format + unit tests (quick gate)
npm run check:all    # Full: lint + format + all tests
npm run typecheck    # TypeScript type check
npm run structural   # Layer boundary enforcement
```

## For Abel Engineers: How to Continue Building / Abel工程师：如何继续构建

### Three-Layer Model / 三层模型

```
Layer 1: Protocol Spec (this repo)     — WHAT verbs exist, WHAT they mean
         协议规范（本仓库）               — 定义有哪些verb，语义是什么

Layer 2: Abel Mapping Doc (this repo)  — WHERE Abel primitives map to CAP verbs
         Abel映射文档（本仓库）           — Abel的6个原语如何映射到CAP verb

Layer 3: Python CAP Server (Abel repo) — HOW verbs are computed (graph-computer)
         Python CAP服务器（Abel仓库）     — 因果计算的实际实现
```

**You are building Layer 3.** This repo (Layers 1+2) is already complete.
**你要构建的是第3层。** 本仓库（第1+2层）已经完成。

### What Lives Where / 职责分工

| Concern / 关注点 | Where / 位置 |
|---------|-------|
| Protocol spec, verb semantics, envelope format / 协议规范、verb语义、信封格式 | This repo: `docs/CAP-v0.2.2-PROTOCOL-SPEC.md` |
| Abel primitive → CAP verb mapping / Abel原语→CAP verb映射 | This repo: `docs/ABEL-MAPPING.md` |
| MCP tool definitions, transport bindings / MCP工具定义、传输绑定 | This repo: `src/transport/` |
| Reusable protocol primitives (card, envelope, errors) / 可复用协议原语 | This repo: `src/cap/` |
| **Causal computation (predict, intervene, etc.)** / **因果计算** | **Python CAP server (you build this)** |
| **Abel's 6 graph-computer primitives** / **Abel的6个图计算原语** | **Python CAP server (you build this)** |
| **L2 semantic honesty (reasoning_mode, etc.)** / **L2语义诚实性** | **Python CAP server (you build this)** |

---

### Step-by-Step: Building the Python CAP Server / 分步指南：构建Python CAP服务器

#### Step 1: Understand What the Bridge Expects / 第1步：理解Bridge的期望

The TS MCP bridge proxies every MCP tool call to your Python server as:
TS MCP Bridge会将每个MCP工具调用代理到你的Python服务器：

```
POST http://{CAP_ENDPOINT}/v1/{category}/{name}
Content-Type: application/json
X-CAP-Key: {api_key}                              # if configured / 如果配置了
```

The body is a **CAP Request Envelope** (§7.1):
请求体是一个 **CAP请求信封** (§7.1)：

```json
{
  "cap_version": "0.2",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "verb": "observe.predict",
  "params": {
    "target": "BTC",
    "top_k_causes": 5
  },
  "options": {
    "response_detail": "full"
  }
}
```

Your server MUST return a **CAP Response Envelope** (§7.2):
你的服务器 **必须** 返回一个 **CAP响应信封** (§7.2)：

```json
{
  "cap_version": "0.2",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "verb": "observe.predict",
  "status": "success",
  "result": {
    "target": "BTC",
    "prediction": {
      "value": 0.023,
      "unit": "log_return",
      "direction": "up",
      "probability_positive": 0.72,
      "confidence_interval": [0.005, 0.041],
      "interval_method": "bootstrap",
      "horizon": "PT4H"
    },
    "causal_features": [
      {
        "node_id": "ETH",
        "weight": 0.35,
        "tau": 2,
        "direction": "positive",
        "impact_fraction": 0.42
      }
    ]
  },
  "provenance": {
    "engine": "abel-pcmci",
    "graph_version": "2026-03-12T00:00:00Z",
    "algorithm": "PCMCI",
    "computation_ms": 45
  }
}
```

#### Step 2: Implement the 3 Required Endpoints First / 第2步：先实现3个必需端点

A minimal L1 server needs only these (§10.1 / 最小L1服务器只需要这些)：

```
GET  /.well-known/cap.json          → Capability Card (static JSON)
POST /v1/meta/capabilities          → Same card, wrapped in response envelope
POST /v1/graph/neighbors            → Causal parents/children
POST /v1/effect/query               → Observational prediction
```

**Python skeleton / Python骨架:**

```python
from fastapi import FastAPI, Request
from uuid import uuid4

app = FastAPI()

# 1. Capability Card — static, served at well-known path
#    能力卡 — 静态JSON，在well-known路径提供
@app.get("/.well-known/cap.json")
async def capability_card():
    return CAPABILITY_CARD  # see src/cap/capability-card.ts for schema / 参考此文件了解结构

# 2. All CAP verbs — single router, verb from URL path
#    所有CAP verb — 单一路由，verb从URL路径获取
@app.post("/v1/{category}/{name}")
async def handle_verb(category: str, name: str, request: Request):
    body = await request.json()
    verb = f"{category}.{name}"  # e.g. "observe.predict"

    # Validate envelope / 验证信封
    assert body["cap_version"] == "0.2"
    request_id = body["request_id"]
    params = body["params"]

    # Dispatch to handler / 分发到处理函数
    handler = VERB_HANDLERS.get(verb)
    if not handler:
        return error_response(request_id, verb, "verb_not_supported", 501)

    result = await handler(params)

    return {
        "cap_version": "0.2",
        "request_id": request_id,
        "verb": verb,
        "status": "success",
        "result": result,
    }
```

#### Step 3: Map Abel's 6 Primitives to 20 CAP Verbs / 第3步：将Abel的6个原语映射到20个CAP verb

See [`docs/ABEL-MAPPING.md`](docs/ABEL-MAPPING.md) for the complete mapping table. Summary:
完整映射表见 [`docs/ABEL-MAPPING.md`](docs/ABEL-MAPPING.md)。概要：

| Primitive / 原语 | CAP Verbs it serves / 服务的CAP verb |
|-----------|-------------------|
| `predict(ticker)` | observe.predict, observe.predict_multistep, observe.predict_batch, effect.query(obs) |
| `explain(ticker)` | observe.attribute, graph.neighbors, traverse.parents, traverse.children, graph.paths, traverse.path, traverse.subgraph |
| `intervene(do_values, targets)` | intervene.do, intervene.ate, effect.query(int) |
| `counterfactual(...)` | counterfact.query (L3 reserved / L3预留) |
| `validate(graph)` | No direct CAP verb — internal QA / 无直接CAP verb — 内部质量保证 |
| `meta(...)` | meta.capabilities, meta.graph_info, meta.node_info, meta.algorithms, meta.health |

**Key insight / 关键洞察:** Most verbs are thin wrappers around `predict()` and `explain()`. You don't need 20 separate implementations — 6 primitives cover all 20 verbs.
大多数verb只是 `predict()` 和 `explain()` 的薄封装。你不需要20个独立实现 — 6个原语覆盖全部20个verb。

#### Step 4: Add L2 Semantics for intervene.* / 第4步：为intervene.*添加L2语义

**This is the critical difference between L1 and L2.** Every `intervene.*` response MUST include (§10.2):
**这是L1和L2的关键区别。** 每个 `intervene.*` 响应 **必须** 包含 (§10.2)：

```json
{
  "result": {
    "effects": [
      {
        "target": "ETH",
        "expected_change": 0.015,
        "reasoning_mode": "scm_simulation",          // REQUIRED per-effect / 必须，逐效应
        "mechanism_coverage_complete": true           // REQUIRED for scm_simulation / scm_simulation时必须
      }
    ],
    "identification_status": "not_formally_identified",  // REQUIRED result-level / 必须，结果级别
    "assumptions": [                                     // REQUIRED result-level / 必须，结果级别
      "causal_sufficiency",
      "faithfulness",
      "mechanism_invariance_under_intervention"
    ]
  }
}
```

**Partial Coverage Rule (§6.6) / 部分覆盖规则:** If any node in the causal path lacks a fitted mechanism, you MUST NOT return `reasoning_mode: "scm_simulation"` for that effect. Either return `graph_propagation` or error `insufficient_mechanism_coverage`.
如果因果路径上任何节点缺少拟合机制，**不得** 对该效应返回 `reasoning_mode: "scm_simulation"`。要么返回 `graph_propagation`，要么报错 `insufficient_mechanism_coverage`。

**reasoning_mode values / reasoning_mode取值 (§5.1):**
| Value | When to use / 使用场景 |
|-------|----------|
| `scm_simulation` | All path nodes have executable mechanisms / 路径上所有节点都有可执行机制 |
| `graph_propagation` | Fallback when coverage incomplete / 覆盖不完整时的降级 |
| `identified_causal_effect` | Formally identified (rare for PCMCI) / 形式化识别（PCMCI中罕见）|

#### Step 5: Handle Error Codes / 第5步：处理错误码

CAP defines these error codes (§7.3). Return them in the response envelope:
CAP定义了以下错误码 (§7.3)，在响应信封中返回：

```python
def error_response(request_id: str, verb: str, code: str, http_status: int, message: str):
    return JSONResponse(
        status_code=http_status,
        content={
            "cap_version": "0.2",
            "request_id": request_id,
            "verb": verb,
            "status": "error",
            "error": {
                "code": code,         # e.g. "node_not_found"
                "message": message,
                "suggestion": "..."   # optional, helpful hint for the agent
            }
        }
    )
```

| Code | HTTP | When / 使用场景 |
|------|------|------|
| `node_not_found` | 404 | Ticker not in graph / 节点不在图中 |
| `verb_not_supported` | 501 | Verb not implemented / verb未实现 |
| `insufficient_tier` | 403 | Access tier too low / 访问层级太低 |
| `graph_stale` | 503 | Graph not updated within expected frequency / 图未按预期频率更新 |
| `computation_timeout` | 504 | Computation exceeded timeout / 计算超时 |
| `invalid_intervention` | 422 | Bad intervention params / 干预参数无效 |
| `path_not_found` | 404 | No causal path between nodes / 节点间无因果路径 |
| `rate_limited` | 429 | Rate limit exceeded / 超过速率限制 |
| `subgraph_too_large` | 413 | Subgraph > 50 edges / 子图超过50条边 |
| `query_type_not_supported` | 400 | Server can't perform requested query_type / 服务器不支持请求的query_type |
| `insufficient_mechanism_coverage` | 422 | Can't do scm_simulation / 无法执行scm_simulation |

#### Step 6: Recommended Build Order / 第6步：推荐构建顺序

Build incrementally, test each verb against the bridge before moving on:
增量构建，每个verb先对bridge测试通过再继续：

```
Phase 1 — L1 Minimum (get the bridge talking)
          L1最小集（让bridge能通信）
  ✅ GET  /.well-known/cap.json
  ✅ POST /v1/meta/capabilities
  ✅ POST /v1/meta/health
  ✅ POST /v1/graph/neighbors           → explain(ticker)
  ✅ POST /v1/effect/query              → predict(ticker)

Phase 2 — L1 Convenience (most agent value)
          L1便利verb（对agent最有价值）
  ✅ POST /v1/observe/predict           → predict(ticker)
  ✅ POST /v1/observe/predict_multistep → predict(ticker, multi_step=True)
  ✅ POST /v1/observe/predict_batch     → [predict(t) for t in tickers]
  ✅ POST /v1/observe/attribute         → explain(ticker) + predict(ticker)
  ✅ POST /v1/traverse/parents          → explain(ticker, direction="parents")
  ✅ POST /v1/traverse/children         → explain(ticker, direction="children")
  ✅ POST /v1/traverse/subgraph         → explain(ticker, depth=3)
  ✅ POST /v1/traverse/latest_values    → latest_change endpoint

Phase 3 — L2 Core (interventional)
          L2核心（干预性）
  ✅ POST /v1/effect/query (interventional) → intervene(...)
  ✅ POST /v1/graph/paths               → BFS on explain()
  ✅ POST /v1/traverse/path             → alias for graph.paths

Phase 4 — L2 Convenience (full L2)
          L2便利verb（完整L2）
  ✅ POST /v1/intervene/do              → intervene(do_values, targets)
  ✅ POST /v1/intervene/ate             → intervene(treatment) - intervene(control)
  ✅ POST /v1/intervene/sensitivity     → robustness analysis

Phase 5 — Remaining meta
          剩余meta
  ✅ POST /v1/meta/graph_info           → graph stats
  ✅ POST /v1/meta/node_info            → node details
  ✅ POST /v1/meta/algorithms           → static PCMCI info
```

#### Testing Against the Bridge / 对bridge进行测试

```bash
# 1. Start your Python server / 启动Python服务器
uvicorn cap_server:app --port 8082

# 2. Start the bridge pointing to your server / 启动bridge指向你的服务器
#    Note: CAP_ENDPOINT is the base URL — the bridge appends /v1/{category}/{name}
#    注意：CAP_ENDPOINT是基础URL — bridge会追加 /v1/{category}/{name}
CAP_ENDPOINT=http://localhost:8082 CAP_PORT=3001 npm start

# 3. Test: capability card / 测试：能力卡
curl http://localhost:3001/.well-known/cap.json | jq .

# 4. Test: MCP tool call via CAP HTTP binding / 测试：通过CAP HTTP绑定调用MCP工具
curl -X POST http://localhost:3001/v1/observe/predict \
  -H "Content-Type: application/json" \
  -d '{
    "cap_version": "0.2",
    "request_id": "test-001",
    "verb": "observe.predict",
    "params": { "target": "BTC", "top_k_causes": 3 }
  }' | jq .

# 5. Test: MCP Streamable HTTP (what Claude Code actually calls)
#    测试：MCP Streamable HTTP（Claude Code实际调用的方式）
# → Use the integration test pattern from tests/integration/mcp-http.test.ts
```

---

### Reusing `src/cap/` in the Python Server / 在Python服务器中复用 `src/cap/`

The `src/cap/` directory defines the protocol schemas. You can port the key parts to Python:
`src/cap/` 目录定义了协议schema。你可以将关键部分移植到Python：

| TS file / TS文件 | Port to Python / 移植到Python | What you get / 你得到什么 |
|---------|---------------|------------|
| `envelope.ts` | `cap/envelope.py` | Request/Response envelope validation (Pydantic) / 请求/响应信封验证 |
| `errors.ts` | `cap/errors.py` | All 10 CAP error codes + HTTP status mapping / 全部10个CAP错误码+HTTP状态映射 |
| `verbs.ts` | `cap/verbs.py` | VERB_REGISTRY — verb metadata, tier, level / verb元数据、层级 |
| `capability-card.ts` | `cap/card.py` | Capability Card builder / 能力卡构建器 |

Or use the TS definitions directly as your schema reference — they're tested to match the spec.
或者直接把TS定义作为schema参考 — 它们已经过测试确认与规范一致。

### Adding a New Verb / 添加新verb

If you add a new verb to the spec:
如果你在协议规范中新增一个verb：

1. Add to `VERB_REGISTRY` in `src/cap/verbs.ts` (protocol truth / 协议真相)
2. Add to `TOOL_DEFINITIONS` in `src/transport/mcp-binding.ts` (MCP tool name + description)
3. Register the MCP tool with its Zod schema in `createMcpServer()` in the same file
4. The structural test `verb-registry-consistency.test.ts` will **automatically catch** any mismatch between VERB_REGISTRY and TOOL_DEFINITIONS
5. Implement the verb handler in your Python server / 在Python服务器中实现verb处理函数

### Key Spec Sections to Read / 需要阅读的关键规范章节

| Section / 章节 | Why / 为什么要读 |
|---------|-----|
| §4 Capability Card | What your `/.well-known/cap.json` must contain / 你的能力卡必须包含什么 |
| §5 Causal Semantics | reasoning_mode, identification_status, assumptions — **L2 required** |
| §6.6 intervene.do | Full request/response schema + Partial Coverage Rule / 完整请求/响应schema + 部分覆盖规则 |
| §6.7 observe.predict | Full request/response schema (most common verb) / 最常用verb的完整schema |
| §7 Message Format | Envelope schemas — what the bridge sends and expects back / 信封schema |
| §8.1 HTTP Binding | URL path convention: `verb.name` → `POST /v1/verb/name` / URL路径约定 |
| §9 Security | Access tiers, response detail levels, anti-distillation / 安全模型 |
| §10 Conformance | What L1 vs L2 requires / L1和L2各自的要求 |

## License

Apache-2.0 — see [LICENSE](LICENSE).
