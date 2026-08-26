---
title: "Hello World"
description: "Build and run a minimal Wippy HTTP API that returns JSON."
---

# Hello World

Build a minimal Wippy application with one HTTP endpoint that returns JSON.

## What We're Building

A minimal web API with one endpoint:

```
GET /hello → {"message": "hello world"}
```

## Project Structure

```
hello-world/
├── wippy.lock           # Generated lock file
└── src/
    ├── _index.yaml      # Entry definitions
    └── hello.lua        # Handler code
```

## Step 1: Create Project Directory

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## Step 2: Entry Definitions

Create `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP server
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router
  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /

  # Handler function
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # Endpoint
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: app:hello
    path: /hello
```

The application uses four entries:

1. `gateway` — HTTP server listening on port 8080
2. `api` — Router attached to the gateway through `meta.server`
3. `hello` — Lua function that handles requests
4. `hello.endpoint` — Route from `GET /hello` to the function

## Step 3: Handler Code

Create `src/hello.lua`:

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

The `http` module provides access to request/response objects. The function returns a table with the exported `handler` method.

## Step 4: Initialize and Run

```bash
# Generate lock file from source
wippy init

# Start the runtime (-c for colorful console output)
wippy run -c
```

The startup output includes the runtime-ready message and the listening address:

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## Step 5: Test It

```bash
curl http://localhost:8080/hello
```

Expected response:

```json
{"message":"hello world"}
```

## How It Works

1. `gateway` accepts the TCP connection on port 8080.
2. The `api` router matches the `/` path prefix.
3. `hello.endpoint` matches `GET /hello`.
4. The `hello` function writes the JSON response.

## CLI Reference

| Command | Description |
|---------|-------------|
| `wippy init` | Generate lock file from `src/` |
| `wippy run` | Start runtime from lock file |
| `wippy run -c` | Start with colorful console output |
| `wippy run -v` | Start with verbose debug logging |
| `wippy run -s` | Start in silent mode (no console logs) |

## Next Steps

- [Echo Service](tutorials/echo-service.md) — Build a multi-process CLI service
- [Task Queue](tutorials/task-queue.md) — Combine a REST API with background processing
- [HTTP Router](http/router.md) — Review routing patterns
