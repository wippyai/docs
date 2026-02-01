# 文件系统
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

在沙箱化的文件系统卷中读取、写入和管理文件。

文件系统配置请参阅 [文件系统](system/filesystem.md)。

## 加载

```lua
local fs = require("fs")
```

## 获取卷

通过注册表 ID 获取文件系统卷：

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content = vol:readfile("/config.json")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `name` | string | 卷注册表 ID |

**返回:** `FS, error`

<note>
卷不需要显式释放。它们在系统级别管理，如果文件系统从注册表分离则变为不可用。
</note>

## 读取文件

读取整个文件内容：

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

对于大文件，使用 `open()` 流式读取：

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## 写入文件

将数据写入文件：

```lua
local vol = fs.get("app:data")

-- 覆盖（默认）
vol:writefile("/config.json", json.encode(config))

-- 追加
vol:writefile("/logs/app.log", message .. "\n", "a")

-- 独占写入（如果文件存在则失败）
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| 模式 | 描述 |
|------|-------------|
| `"w"` | 覆盖（默认） |
| `"a"` | 追加 |
| `"wx"` | 独占写入（如果文件存在则失败） |

流式写入：

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## 检查路径

```lua
local vol = fs.get("app:data")

-- 检查是否存在
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- 检查是否为目录
if vol:isdir(path) then
    process_directory(path)
end

-- 获取文件信息
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**stat 字段:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## 目录操作

```lua
local vol = fs.get("app:data")

-- 创建目录
vol:mkdir("/uploads/" .. user_id)

-- 列出目录内容
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- 删除文件或空目录
vol:remove("/temp/file.txt")
```

条目字段：`name`, `type`（"file" 或 "directory"）

## 文件句柄方法

使用 `vol:open()` 进行流式操作时：

| 方法 | 描述 |
|--------|-------------|
| `read(size?)` | 读取字节（默认：4096） |
| `write(data)` | 写入字符串数据 |
| `seek(whence, offset)` | 设置位置（"set", "cur", "end"） |
| `sync()` | 刷新到存储 |
| `close()` | 释放文件句柄 |
| `scanner(split?)` | 创建行/词扫描器 |

使用完文件句柄后务必调用 `close()`。

## 扫描器

逐行处理：

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- 跳过标题

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

分割模式：`"lines"`（默认）, `"words"`, `"bytes"`, `"runes"`

## 常量

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- 从开头
fs.seek.CUR       -- 从当前位置
fs.seek.END       -- 从末尾
```

## FS 方法

| 方法 | 返回 | 描述 |
|--------|---------|-------------|
| `readfile(path)` | `string, error` | 读取整个文件 |
| `writefile(path, data, mode?)` | `boolean, error` | 写入文件 |
| `exists(path)` | `boolean, error` | 检查路径是否存在 |
| `stat(path)` | `table, error` | 获取文件信息 |
| `isdir(path)` | `boolean, error` | 检查是否为目录 |
| `mkdir(path)` | `boolean, error` | 创建目录 |
| `remove(path)` | `boolean, error` | 删除文件/空目录 |
| `readdir(path)` | `iterator` | 列出目录 |
| `open(path, mode)` | `File, error` | 打开文件句柄 |
| `chdir(path)` | `boolean, error` | 更改工作目录 |
| `pwd()` | `string` | 获取工作目录 |

## 权限

文件系统访问受安全策略评估约束。

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `fs.get` | 卷 ID | 获取文件系统卷 |

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 路径为空 | `errors.INVALID` | 否 |
| 模式无效 | `errors.INVALID` | 否 |
| 文件已关闭 | `errors.INVALID` | 否 |
| 路径未找到 | `errors.NOT_FOUND` | 否 |
| 路径已存在 | `errors.ALREADY_EXISTS` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。
