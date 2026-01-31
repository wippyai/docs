# Dynamic Evaluation
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Execute Lua code dynamically at runtime. Compile and run untrusted code in sandboxed environments with controlled module access.

## Loading

```lua
local eval = require("eval_runner")
```

## Running Code

Compile and execute Lua code in one operation. The code runs in an isolated environment with only specified modules available.

```lua
-- Simple execution
local result, err = eval.run({
    source = [[
        local function add(a, b)
            return a + b
        end
        return { add = add }
    ]],
    method = "add",
    args = {10, 20}
})
-- result = 30

-- With allowed modules
local result, err = eval.run({
    source = [[
        local json = require("json")
        local function parse(data)
            return json.decode(data)
        end
        return { parse = parse }
    ]],
    method = "parse",
    args = {'{"name": "test"}'},
    modules = {"json"}
})
-- result = {name = "test"}

-- With context values
local result, err = eval.run({
    source = [[
        local function greet()
            return "Hello, " .. ctx.user_name
        end
        return { greet = greet }
    ]],
    method = "greet",
    context = {user_name = "Alice"}
})
-- result = "Hello, Alice"

-- With registry imports
local result, err = eval.run({
    source = [[
        local utils = require("utils")
        return utils.process(data)
    ]],
    method = "process",
    args = {input_data},
    imports = {
        utils = "myapp.libs:utilities"
    }
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.source` | string | Lua source code to execute |
| `config.method` | string | Method name to call (optional) |
| `config.modules` | string[] | Module names allowed in code (optional) |
| `config.imports` | table | Registry entries to import (alias = ID) (optional) |
| `config.args` | any[] | Arguments passed to method (optional) |
| `config.context` | table | Context values available as `ctx` (optional) |

**Returns:** `any, error`

## Compiling Programs

Compile Lua source code into a reusable Program. Use this when you need to execute the same code multiple times with different arguments.

```lua
local program, err = eval.compile([[
    local function process(data)
        local result = {}
        for k, v in pairs(data) do
            result[k] = string.upper(tostring(v))
        end
        return result
    end
    return { process = process }
]], "process", {modules = {}})

if err then
    return nil, err
end

print(program:method())   -- "process"
print(program:modules())  -- {}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | Lua source code to compile |
| `method` | string | Method name to call on execution (optional) |
| `options.modules` | string[] | Module names allowed in sandboxed code (optional) |
| `options.imports` | table | Registry entries to import (alias = ID) (optional) |

**Returns:** `Program, error`

## Program Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `method()` | string | Method name to call |
| `modules()` | string[] | Allowed module names |

## Permissions

Dynamic code evaluation is subject to security policy evaluation.

| Action | Resource | Meta | Description |
|--------|----------|------|-------------|
| `eval.compile` | - | - | Compile Lua source code |
| `eval.run` | - | - | Execute compiled code |
| `eval.module` | module name | `entry_id` | Load builtin module in sandbox |
| `eval.import` | registry ID | `entry_id`, `alias` | Import registry entry |

The `eval.module` permission is checked for each builtin module in the `modules` list. The `eval.import` permission is checked for each registry entry in the `imports` table. Both include `entry_id` metadata containing the registry ID of the calling entry.

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Permission denied | `errors.PERMISSION_DENIED` | no |
| No context available | `errors.INTERNAL` | no |
| Source is required | `errors.INVALID` | no |
| Compilation failed | `errors.INTERNAL` | no |
| Execution failed | `errors.INTERNAL` | no |

See [Error Handling](lua-errors.md) for working with errors.
