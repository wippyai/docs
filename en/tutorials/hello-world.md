---
title: "Hello World"
description: "Build and run a minimal Wippy HTTP API that returns JSON."
---

# Hello World

Build a minimal Wippy application with one HTTP endpoint that returns JSON.

**Classification:** Runnable tutorial. It provides the complete registry and Lua
source for a local HTTP application, plus startup and verification commands.

## What We're Building

A minimal web API with one endpoint:

```
GET /hello → {"message": "hello world"}
```

## Prerequisites

- Wippy runtime `v0.3.32a` available as `wippy`. Confirm it with
  `wippy version --short`.
- `curl` or another HTTP client.
- Port 8080 available on the local machine.

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
    local res, response_err = http.response()
    if response_err then
        error("cannot create response: " .. tostring(response_err))
    end

    local content_type_err = res:set_content_type(http.CONTENT.JSON)
    if content_type_err then
        error("cannot set content type: " .. tostring(content_type_err))
    end

    local status_err = res:set_status(http.STATUS.OK)
    if status_err then
        error("cannot set status: " .. tostring(status_err))
    end

    local write_err = res:write_json({message = "hello world"})
    if write_err then
        error("cannot write response: " .. tostring(write_err))
    end
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

`wippy init` writes `wippy.lock`. Keep `wippy run -c` running while you test the
endpoint. Log formatting varies by build, so use the HTTP response below as the
readiness check.

## Step 5: Test It

```bash
curl http://localhost:8080/hello
```

Expected response:

```json
{"message":"hello world"}
```

The request should return HTTP status 200 with `Content-Type: application/json`.

## How It Works

1. `gateway` accepts the TCP connection on port 8080.
2. The `api` router matches the `/` path prefix.
3. `hello.endpoint` matches `GET /hello`.
4. The `hello` function writes the JSON response.

## CLI Reference

| Command | Description |
|---------|-------------|
| `wippy init` | Create `wippy.lock` with `./src` as the source directory |
| `wippy run` | Start runtime from lock file |
| `wippy run -c` | Start with colorful console output |
| `wippy run -v` | Start with verbose debug logging |
| `wippy run -s` | Start in silent mode (no console logs) |

## Troubleshooting and Cleanup

- If `wippy init` cannot find the entries, run it from `hello-world/` and confirm
  that `src/_index.yaml` exists.
- If startup reports that the address is already in use, stop the process using
  port 8080 or change `addr` and the test URL to the same free port.
- A 404 response usually means the router or endpoint entry differs from the
  definitions above. Check `meta.server`, `meta.router`, and `/hello` exactly.
- Press Ctrl+C in the runtime terminal to stop the application. After leaving the
  directory, delete `hello-world/` if it was only a disposable exercise.

## Next Steps

- [Echo Service](tutorials/echo-service.md) — Build a multi-process CLI service
- [Task Queue](tutorials/task-queue.md) — Combine a REST API with background processing
- [HTTP Router](http/router.md) — Review routing patterns
