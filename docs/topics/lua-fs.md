# Filesystem
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Read, write, and manage files within sandboxed filesystem volumes.

For filesystem configuration, see [Filesystem](system-filesystem.md).

## Loading

```lua
local fs = require("fs")
```

## Acquiring a Volume

Get a filesystem volume by registry ID:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content = vol:readfile("/config.json")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Volume registry ID |

**Returns:** `FS, error`

<note>
Volumes don't require explicit release. They're managed at the system level and become unavailable if the filesystem is detached from the registry.
</note>

## Reading Files

Read entire file contents:

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

For large files, use streaming with `open()`:

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## Writing Files

Write data to a file:

```lua
local vol = fs.get("app:data")

-- Overwrite (default)
vol:writefile("/config.json", json.encode(config))

-- Append
vol:writefile("/logs/app.log", message .. "\n", "a")

-- Exclusive write (fails if exists)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| Mode | Description |
|------|-------------|
| `"w"` | Overwrite (default) |
| `"a"` | Append |
| `"wx"` | Exclusive write (fails if file exists) |

For streaming writes:

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## Checking Paths

```lua
local vol = fs.get("app:data")

-- Check existence
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- Check if directory
if vol:isdir(path) then
    process_directory(path)
end

-- Get file info
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**Stat fields:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Directory Operations

```lua
local vol = fs.get("app:data")

-- Create directory
vol:mkdir("/uploads/" .. user_id)

-- List directory contents
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- Remove file or empty directory
vol:remove("/temp/file.txt")
```

Entry fields: `name`, `type` ("file" or "directory")

## File Handle Methods

When using `vol:open()` for streaming:

| Method | Description |
|--------|-------------|
| `read(size?)` | Read bytes (default: 4096) |
| `write(data)` | Write string data |
| `seek(whence, offset)` | Set position ("set", "cur", "end") |
| `sync()` | Flush to storage |
| `close()` | Release file handle |
| `scanner(split?)` | Create line/word scanner |

Always call `close()` when done with a file handle.

## Scanner

For line-by-line processing:

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- skip header

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

Split modes: `"lines"` (default), `"words"`, `"bytes"`, `"runes"`

## Constants

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- from start
fs.seek.CUR       -- from current
fs.seek.END       -- from end
```

## FS Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `readfile(path)` | `string, error` | Read entire file |
| `writefile(path, data, mode?)` | `boolean, error` | Write file |
| `exists(path)` | `boolean, error` | Check if path exists |
| `stat(path)` | `table, error` | Get file info |
| `isdir(path)` | `boolean, error` | Check if directory |
| `mkdir(path)` | `boolean, error` | Create directory |
| `remove(path)` | `boolean, error` | Remove file/empty dir |
| `readdir(path)` | `iterator` | List directory |
| `open(path, mode)` | `File, error` | Open file handle |
| `chdir(path)` | `boolean, error` | Change working dir |
| `pwd()` | `string` | Get working dir |

## Permissions

Filesystem access is subject to security policy evaluation.

| Action | Resource | Description |
|--------|----------|-------------|
| `fs.get` | Volume ID | Acquire filesystem volume |

## Errors

| Condition | Kind | Retryable |
|-----------|------|-----------|
| Empty path | `errors.INVALID` | no |
| Invalid mode | `errors.INVALID` | no |
| File is closed | `errors.INVALID` | no |
| Path not found | `errors.NOT_FOUND` | no |
| Path already exists | `errors.ALREADY_EXISTS` | no |
| Permission denied | `errors.PERMISSION_DENIED` | no |

See [Error Handling](lua-errors.md) for working with errors.
