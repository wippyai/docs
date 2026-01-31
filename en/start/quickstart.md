# Quick Start

Create and run your first Wippy application.

## Initialize Project

```bash
mkdir myapp && cd myapp
wippy init
```

This creates:
- `wippy.lock` - Dependency lock file
- `src/` - Source directory
- `.wippy/` - Modules directory

## Create Entry Point

Create `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: main
    modules:
      - json
```

Create `src/hello.lua`:

```lua
local json = require("json")

local function main(input)
    local name = input and input.name or "World"
    return {
        message = string.format("Hello, %s!", name)
    }
end

return main
```

## Add HTTP Endpoint

Update `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Function that handles the request
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - json
      - http

  # HTTP server
  - name: gateway
    kind: http.service
    addr: ":8080"
    lifecycle:
      auto_start: true

  # Router attached to the server
  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /

  # Endpoint attached to the router
  - name: hello_endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    path: /hello
    func: hello
```

Update `src/hello.lua`:

```lua
local http = require("http")
local json = require("json")

local function handler()
    local req = http.request()
    local name = req:query("name") or "World"

    local res = http.response()
    res:set_status(200)
    res:set_header("Content-Type", "application/json")
    res:write(json.encode({
        message = string.format("Hello, %s!", name)
    }))
    return res
end

return { handler = handler }
```

## Run Application

```bash
wippy run
```

Test the endpoint:

```bash
curl "http://localhost:8080/hello?name=Wippy"
```

Response:
```json
{"message": "Hello, Wippy!"}
```

## Add a Process

Create `src/worker.lua`:

```lua
local process = require("process")

local function main()
    local inbox = process.inbox()

    while true do
        local payload, ok = inbox:receive()
        if not ok then break end

        print("Received:", payload)
    end
end

return main
```

Add to `src/_index.yaml`:

```yaml
  - name: worker
    kind: process.lua
    source: file://worker.lua
    method: main
    modules:
      - process
    lifecycle:
      auto_start: true
```

## Configuration

Create `.wippy.yaml` for runtime settings:

```yaml
logger:
  level: info
  mode: development

http:
  address: :8080
```

## Next Steps

- [Project Structure](getting-started-structure.md) - Directory layout
- [Entry Definitions](lua-entries.md) - Configure entries
- [Configuration](guide-configuration.md) - All options
