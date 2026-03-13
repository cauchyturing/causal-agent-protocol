# MCP Streamable HTTP Transport — Design Spec

**Goal:** Mount MCP Streamable HTTP at `/mcp` on the existing Express app so remote agents can invoke CAP tools over HTTP (not just stdio).

**Approach:** Option B — same Express app, same port, `/mcp` path.

## Architecture

```
Express app (:3001)
├── GET  /.well-known/cap.json          (existing)
├── GET  /.well-known/agent-card.json   (existing)
├── POST /v1/:category/:name            (existing CAP HTTP binding)
├── POST /mcp                           (NEW — MCP request)
├── GET  /mcp                           (NEW — MCP SSE stream)
└── DELETE /mcp                         (NEW — MCP session cleanup)
```

## Components

### 1. `src/transport/mcp-http-transport.ts` (new)
- Factory: `mountMcpHttp(app, mcpServer, config): void`
- Uses `StreamableHTTPServerTransport` from MCP SDK
- Per-session stateful transport (SDK manages `Mcp-Session-Id` header)
- Mounts POST/GET/DELETE on `/mcp`

### 2. `src/transport/mcp-binding.ts` (modify)
- `createMcpServer()` returns McpServer instance without connecting transport
- Both stdio and HTTP transports share the same server instance + tool registrations

### 3. `src/index.ts` (modify)
- HTTP mode: `createMcpServer()` → `mountMcpHttp(app, server, config)`
- stdio mode: `createMcpServer()` → `StdioServerTransport` (unchanged)

## Auth
- No auth on `/mcp` for v1 (matches stdio trust model)
- Future: extract key from headers, apply tier

## Testing (strict TDD)
1. Unit: `mountMcpHttp` registers correct Express routes
2. Integration: MCP initialize handshake over HTTP
3. Integration: Full tool call (cap_meta_health) through HTTP transport
4. Conformance: `/mcp` endpoint matches capability card `bindings.mcp.endpoint`

## Files
- Create: `src/transport/mcp-http-transport.ts`
- Create: `tests/unit/mcp-http-transport.test.ts`
- Create: `tests/integration/mcp-http.test.ts`
- Modify: `src/transport/mcp-binding.ts`
- Modify: `src/index.ts`
