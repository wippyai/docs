---
title: "Dynamic Evaluation"
description: "Evaluate expressions or run capability-restricted Lua code with configured module and registry access."
---

# Dynamic Evaluation

Wippy provides expression evaluation and capability-restricted Lua execution for code supplied at runtime. This page is an API guide: its examples run inside an existing Wippy Lua process and assume the entry declares the modules used by the caller. Registry IDs, policies, and application data are placeholders supplied by the surrounding application.

`eval_runner` limits which Wippy modules evaluated code can reach, but it is not complete containment for hostile code. In particular, `limits.max_steps` counts scheduler resumes rather than Lua instructions, so a non-yielding infinite loop is not interrupted by that limit.

## Choosing an Evaluation System

Choose the evaluation system according to the code being run:

| System | Purpose | Use Case |
|--------|---------|----------|
| `expr` | Expression evaluation | Config, templates, simple calculations |
| `eval_runner` | Capability-restricted Lua execution | Trusted plugins and controlled dynamic code |

## Expression Evaluation with `expr`

The `expr` module evaluates expressions written in expr-lang syntax. Use it for expressions rather than full Lua programs. [Expression Language](lua/dynamic/expression.md) is the complete Lua API and syntax reference.

```lua
local expr = require("expr")

local result, err = expr.eval("x + y * 2", {x = 10, y = 5})
if err then
    return nil, err
end
-- result = 20
```

### Reusing Compiled Expressions

Compile an expression for repeated evaluation:

```lua
local program, err = expr.compile("price * quantity")
if err then
    return nil, err
end

local total1, first_err = program:run({price = 10, quantity = 5})
if first_err then
    return nil, first_err
end

local total2, second_err = program:run({price = 20, quantity = 3})
if second_err then
    return nil, second_err
end
```

### Syntax at a Glance

| Feature | Expression | Result |
|---------|------------|--------|
| Arithmetic | `1 + 2 * 3` | `7` |
| Remainder | `10 % 3` | `1` |
| Comparison | `x > 5` with `{x = 10}` | `true` |
| Boolean | `a && b` with `{a = true, b = false}` | `false` |
| Ternary | `x > 0 ? 'positive' : 'negative'` with `{x = 5}` | `"positive"` |
| Function | `max(1, 5, 3)` | `5` |
| Array index | `[1, 2, 3][0]` | `1` |
| Concatenation | `'hello' + ' ' + 'world'` | `"hello world"` |

## Capability-Restricted Lua with `eval_runner`

The `eval_runner` module executes Lua with configured module and registry access.

```lua
local runner = require("eval_runner")

local result, err = runner.run({
    source = [[
        local function double(x)
            return x * 2
        end
        return { double = double }
    ]],
    method = "double",
    args = {21}
})
if err then
    return nil, err
end
-- result = 42
```

### Configuration

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | Lua source code (required) |
| `method` | string | Function to call in returned table |
| `args` | any[] | Arguments passed to function |
| `modules` | string[] | Allowed builtin modules |
| `imports` | table | Registry entries to import |
| `context` | table | Values available as `ctx` |
| `allow_classes` | string[] | Additional module classes |
| `custom_modules` | table | Custom tables as modules |
| `limits` | table | Execution limits for the evaluation |

If `modules` is omitted or empty, the host supplies every available module whose classes pass the default filter. In that implicit mode, `allow_classes` expands the filter and can therefore add modules from the named classes. With an explicit `modules` list, it only permits listed modules whose classes would otherwise be excluded. Prefer an explicit, minimal list so the evaluated program's capabilities are visible in the call.

At runtime v0.3.32a, `eval.module` policy checks cover the names explicitly supplied in `modules`, not modules selected implicitly by the default filter. Do not rely on `eval.module` policy to remove one of those implicit default modules; pass an explicit list instead.

### Step Limit

Use `limits.max_steps` to bound scheduler resumes during an evaluation:

```lua
local result, err = runner.run({
    source = user_code,
    modules = {"json"},
    limits = {max_steps = 1000}
})
if err then
    return nil, err
end
```

`max_steps` must be a non-negative integer. When omitted, the evaluation inherits `lua.eval.max_steps` (default `10000`); an explicit `0` removes the limit. Each scheduler resume consumes a step, so yields from module calls consume the budget. Ordinary Lua loop iterations do not, which means this setting is not a CPU or instruction budget for non-yielding code.

Unknown `limits` fields, a non-table `limits` value, and invalid `max_steps` values return non-retryable `errors.INVALID`.

### Module Access

Provide an allowlist of modules:

```lua
local encoded, err = runner.run({
    source = [[
        local json = require("json")
        return json.encode({hello = "world"})
    ]],
    modules = {"json"}
})
if err then
    return nil, err
end
```

When an explicit list is present, modules outside that list cannot be required. Every listed module also requires `eval.module` permission.

### Registry Imports

Import entries from the registry:

```lua
local result, err = runner.run({
    source = [[
        local data = ...
        return utils.format(data)
    ]],
    imports = {
        utils = "app.lib:utilities"
    },
    args = {{key = "value"}}
})
if err then
    return nil, err
end
```

The imported library must be a source-backed registry library that returns a value. The alias (`utils` here) is bound as a global in the evaluated program; it is not a Wippy module and does not need `require()`.

### Privileged Imports

An import can use modules that are unavailable to the evaluated source. Use the table form with `id` and `modules`:

```lua
local quote, err = runner.run({
    source = [[
        return pricing.quote(...)
    ]],
    modules = {"json"},
    imports = {
        pricing = { id = "app.lib:pricing", modules = {"funcs"} }
    },
})
if err then
    return nil, err
end
```

The `pricing` library executes in a scoped environment where `funcs` is available; the evaluated source cannot require or access `funcs` directly. Granting a module to an import requires the caller to hold `eval.module` permission for that module, so the import cannot receive a module unavailable to the caller.

### Custom Modules

Expose custom tables as modules:

```lua
local version, err = runner.run({
    source = [[
        return sdk.version
    ]],
    custom_modules = {
        sdk = {version = "1.0.0"}
    }
})
if err then
    return nil, err
end
```

Custom-module values are directly reachable by evaluated code. Do not place secrets or privileged handles in these tables unless disclosure to that code is intentional.

### Context Values

Pass values through `ctx`:

```lua
local greeting, err = runner.run({
    source = [[
        local user, ctx_err = ctx.get("user")
        if ctx_err then error(ctx_err) end
        return "Hello, " .. user
    ]],
    modules = {"ctx"},
    context = {user = "Alice"}
})
if err then
    return nil, err
end
```

### Compiling Programs

`runner.compile` validates source and reports its entrypoint and modules without running it:

```lua
local program, err = runner.compile([[
    local function process(x)
        return x * 2
    end
    return { process = process }
]], "process", {modules = {"json"}})
if err then
    return nil, err
end

program:method()   -- "process"  (string)
program:modules()  -- {"json"}    (string[])
```

The compiled program describes the source but does not execute it. Call `runner.run` with the source and method to run the program.

## Capability Controls

### Module Classes

Modules are categorized by capability:

| Class | Description | Default |
|-------|-------------|---------|
| `deterministic` | Pure functions | Allowed |
| `encoding` | Data encoding | Allowed |
| `time` | Time operations | Allowed |
| `nondeterministic` | Random, etc. | Allowed |
| `io` | Input/output operations without a separately blocked class | Allowed |
| `security` | Security helpers | Allowed |
| `workflow` | Workflow-safe operations | Allowed |
| `process` | Spawn, registry | Blocked |
| `storage` | File, database | Blocked |
| `network` | HTTP, sockets | Blocked |

"Blocked" means blocked unless the caller supplies the blocked class in `allow_classes` and is authorized for that `eval.class` resource. A module can belong to several classes; list each blocked class that the module carries.

### Allowing Additional Classes

```lua
local status, err = runner.run({
    source = [[
        local http = require("http_client")
        local response, err = http.get("https://api.example.com")
        if err then error(err) end
        return response.status_code
    ]],
    modules = {"http_client"},
    allow_classes = {"network"}
})
if err then
    return nil, err
end
```

Class authorization only admits the module to the eval environment. The module's own security checks and external access controls still apply.

### Permission Checks

The system checks permissions for:

- `eval.compile` - Before compilation
- `eval.run` - Before execution
- `eval.module` - For each module in whitelist, and for each module granted to a privileged import
- `eval.import` - For each registry import
- `eval.class` - For each allowed class

Configure these actions in security policies.

## Compiled Program Cache

Compiled programs are cached in an LRU keyed by source, method, modules, and allowed classes. Repeated runs of identical code skip compilation. Imports, custom modules, arguments, and context are bound at run time and do not affect the cache key.

```yaml
# .wippy.yaml
lua:
  eval:
    cache_size: 256   # entries; 0 or less disables caching (default: 256)
    cache_ttl: 0      # expiry; 0 = no expiry (default: 0)
    max_steps: 10000  # inherited run limit; 0 = unlimited (default: 10000)
```

## Handling Evaluation Errors

```lua
local result, err = runner.run(run_config)
if err then
    if err:kind() == errors.PERMISSION_DENIED then
        -- Access denied by security policy
    elseif err:kind() == errors.INVALID then
        -- Missing source or invalid limits configuration
    elseif err:kind() == errors.INTERNAL then
        -- Syntax, compilation, import, or execution failure
    end
end
```

Here `run_config` is the configuration table assembled by the surrounding application.

## Choosing by Use Case

### Plugins

```lua
local plugins, find_err = registry.find({["meta.type"] = "plugin"})
if find_err then
    return nil, find_err
end

for _, plugin in ipairs(plugins) do
    local _, run_err = runner.run({
        source = plugin.data.source,
        method = "init",
        modules = {"json", "time"},
        context = {config = app_config}
    })
    if run_err then
        return nil, run_err
    end
end
```

This partial pattern assumes the caller has loaded `registry` and `eval_runner`, `app_config` is defined, and matching registry entries store Lua source at `data.source`. `registry.find` returns entry tables, so fields are read as `plugin.data`, not through an entry method.

### Repeated Rules

```lua
local compiled, compile_err = expr.compile("score >= minimum")
if compile_err then
    return nil, compile_err
end

for _, candidate in ipairs(candidates) do
    local accepted, run_err = compiled:run({
        score = candidate.score,
        minimum = 80
    })
    if run_err then
        return nil, run_err
    end
    candidate.accepted = accepted
end
```

This partial pattern assumes `candidates` is supplied by the application. Use the template module, rather than `expr`, when the output is rendered text.

### User Scripts

```lua
local result, err = runner.run({
    source = user_code, -- Supplied by the surrounding application
    modules = {"json", "text"},
    context = {data = input_data}
})
if err then
    return nil, err
end
```

This is a partial integration pattern, not a hostile-code sandbox. Validate who may supply `user_code`, grant only the required modules and policies, and enforce an external timeout or isolation boundary when untrusted code could fail to yield.

## See Also

- [Expression](./expression.md) - Expression language reference
- [Exec](lua/dynamic/exec.md) - System command execution
- [Security](lua/security/security.md) - Security policies
