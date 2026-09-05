---
title: "归档"
description: "以有界内存读写 zip/tar 归档。归档既不会被加载到 RAM，也不会被解压到磁盘——峰值内存与归档和条目大小无关，因此多 GB 的归档也能在低内存服务器上运行。"
---

# 归档
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

以有界内存读写 zip/tar 归档。归档既不会被加载到 RAM，也不会被解压到磁盘——峰值内存与归档和条目大小无关，因此多 GB 的归档也能在低内存服务器上运行。

## 加载

```lua
local archive = require("archive")
```

## 格式

内置格式通过魔术字节检测，或用 `opts.format` 强制指定：

| 格式 | 随机读取 | 顺序扫描 | 写入 |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | 是 | 是（本地头） | 是 |
| `tar` | 是 | 是 | 是 |
| `tar.gz` | 否 | 是 | 是 |
| `tar.zst` | 否 | 是 | 是 |

`archive.formats()` 返回已注册格式名称的列表。

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## 选项

所有入口点都接受一个可选的 `opts` 表：

| 键 | 默认值 | 含义 |
|-----|---------|---------|
| `format` | 自动 | `"zip"`、`"tar"`、`"tar.gz"`、`"tar.zst"`；自动 = 嗅探魔术字节，否则用扩展名 |
| `max_entries` | 100000 | 拒绝条目数超过此值的归档（解压炸弹防御） |
| `max_total_bytes` | 2 GiB | 读取/解压期间累计未压缩输出的上限 |
| `max_file_bytes` | 1 GiB | 单个条目未压缩大小的上限 |
| `max_inline_bytes` | 16 MiB | 会在 RAM 中物化的 `read()` 调用的硬上限；超过它请使用 `stream()`/`extract()` |
| `buffer_bytes` | 64 KiB | 读取/解压/添加时的流式复制缓冲区 |

`max_total_bytes`/`max_file_bytes` 是工作量上限，而不是 RAM 上限——流式处理一个条目持有的内存永远不超过 `buffer_bytes` 加上编解码器的解压窗口。唯一控制 RAM 大小的旋钮是 `max_inline_bytes`。

## 读取——随机访问

`archive.open(source, ...)` 打开一个**可寻址**的源以进行完整的随机访问（zip 中央目录会预先读取；条目按需解压）。源可以是一个 `fs.FS` 句柄加一个路径、一个已打开的 `fs.File`、原始字节（字节会把整个归档保存在 RAM 中——仅限小归档），或由另一个模块交出的任何随机访问读取器。

来自其他模块的读取器只要实现了 `io.ReaderAt` 并报告其 `Size` 就符合条件；当省略 `opts.format` 时，可选的 `Name` 会用于扩展名嗅探。[`cloudstorage`](lua/storage/cloud.md) 的 `open_reader` 就是其中之一，它直接从对象存储读取多 GB 的归档。在这种情况下归档不打开任何东西，也永远不关闭该读取器——由它的所有者负责关闭。

```lua
local fs = require("fs")
local archive = require("archive")

-- 通过 fs 句柄 + 路径打开（模块打开文件并拥有其生命周期）
local r, err = archive.open(fs.get("app:uploads"), "incoming.zip")
-- 或从一个已打开的可寻址 fs.File 打开
-- local r = archive.open(fs:get("app:uploads"):open("x.zip"))
-- 或从原始字节打开（仅限小归档）
-- local r = archive.open(zip_bytes, { format = "zip" })
-- 或从另一个模块拥有的随机访问读取器打开
-- local reader = cloudstorage.get("app:files"):open_reader("incoming.zip")
-- local r = archive.open(reader)
```

**返回：** `Reader, error`

**权限：** `archive.read`

### entries

遍历目录（仅元数据——不解压）：

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### stat

按名称获取条目元数据（不解压）：

```lua
local info, err = r:stat("docs/readme.md")
```

### read

将单个条目物化为一个 Lua 字符串。超过 `max_inline_bytes` 时报错（`kind = Invalid`）——对于任何较大的内容，请使用 `stream()` 或 `extract()`：

```lua
local data, err = r:read("docs/readme.md")  -- 仅限小条目
```

### stream

将条目作为按需解压的 `stream.Stream` 返回。它可以在任何接受流的地方组合使用——`:scanner()`、`fs:writefile()`，或交给另一个模块：

```lua
local es, err = r:stream("big.csv")
while true do
    local chunk = es:read(65536)
    if not chunk then break end
    process(chunk)
end
es:close()
```

### extract

将一个条目流式写入目标文件系统：

```lua
local ok, err = r:extract("docs/readme.md", fs.get("app:out"))
-- 可选的目标路径：
-- r:extract("docs/readme.md", fs.get("app:out"), "readme.md")
```

### extract_all

将每个条目流式写入目标文件系统：

```lua
local count, err = r:extract_all(fs.get("app:out"), {
    prefix = "job123/",          -- 添加到每个目标路径之前
    strip  = 1,                  -- 去掉 N 个前导路径分量
    filter = function(e) return not e.is_dir end,
})
```

条目名称在解压时会被净化——`..` 分段、绝对路径以及 Windows 驱动器/UNC 前缀都会被拒绝（zip-slip 防御）。

### close

关闭读取器。幂等；在任务作用域结束时也会自动关闭。

```lua
r:close()
```

## 读取——顺序扫描

`archive.scan(source, opts?)` 打开一个**只能向前**的流（一个 HTTP 上传体、一个 multipart 文件流）。条目按归档中的顺序访问；每个条目的读取器仅在你前进之前有效。没有随机的 `read(name)`。

```lua
local up = form.files.upload[1]:stream()        -- stream.Stream
local s, err = archive.scan(up, { format = "zip" })

for e, entry in s:walk() do                      -- entry 是一个 stream.Stream
    if not e.is_dir then
        fs.get("app:uploads"):writefile("job123/" .. e.name, entry)
    end
end
s:close()
```

**返回：** `Walker, error`

**权限：** `archive.read`

`tar`、`tar.gz` 和 `tar.zst` 原生支持流式处理。`zip` 通过每个条目的本地头解析；用流式数据描述符（大小/CRC 跟在数据之后）写入的条目通过解压到条目边界来读取。若要稳健地处理大型上传的 zip，先把上传落成一个文件（一次有界的顺序复制），然后使用 `archive.open`：

```lua
local dst = fs.get("app:tmp")
dst:writefile("u.zip", req:stream())   -- 流式复制上传 → fs 文件
local r = archive.open(dst, "u.zip")   -- 稳健的随机访问
-- ... entries / extract_all ...
r:close()
dst:remove("u.zip")
```

## 写入

`archive.create(dest, ...)` 通过把条目流式写入一个目标来构建归档——可以是 fs 中的一个文件（带路径），也可以是一个可写的 `stream.Stream`（例如一个 HTTP 响应），因此可以用有界内存把下载用的 `.zip` 直接生成到网络上。

```lua
local w, err = archive.create(fs.get("app:tmp"), "out.zip", { format = "zip" })
-- 或流式写入到响应：
-- local w = archive.create(res:stream(), { format = "zip" })
```

**返回：** `Writer, error`

**权限：** `archive.write`

### add

从字符串、字节、读取器或 `stream.Stream` 添加一个条目：

```lua
w:add("notes.txt", "hello")
w:add("from_upload", some_stream, { method = "deflate", mode = 0644 })
```

### add_file

从文件系统中的一个文件流式添加条目：

```lua
w:add_file("data/big.bin", fs.get("app:data"), "big.bin")
```

### add_dir

添加一个目录条目：

```lua
w:add_dir("empty/")
```

### close

完成归档（为 zip 写入中央目录）。幂等；在任务作用域结束时也会自动关闭。

```lua
w:close()
```

`add*` 的选项：`{ method = "store"|"deflate", mode, modified }`。zip 写入器使用数据描述符向不可寻址的写入器流式写入，因此写入响应流是可行的。

## 错误

| 条件 | 类型 |
|-----------|------|
| 源不是 fs 句柄、fs 文件、字节或随机访问读取器 | `errors.INVALID` |
| 未知/不匹配的格式 | `errors.INVALID` |
| 归档损坏或被截断 | `errors.INVALID` |
| 超出限制（条目数/总量/单文件/内联） | `errors.INVALID` |
| 对仅支持流式的格式做随机访问（请使用 `scan`） | `errors.UNAVAILABLE` |
| 未找到条目名称 | `errors.NOT_FOUND` |
| 源不可读/目标不可写 | `errors.PERMISSION_DENIED` |
| 在遍历前进后读取过期的流式条目 | `errors.INTERNAL` |

参见[错误处理](lua/core/errors.md)了解错误处理方法。

## 另请参阅

- [文件系统](lua/storage/filesystem.md) - 源文件系统和目标文件系统
- [流](lua/core/stream.md) - 交给归档以及从归档返回的流对象
- [压缩](lua/data/compress.md) - 内存中的 gzip/deflate/zstd
- [云存储](lua/storage/cloud.md) - 作为随机访问归档源的 `open_reader`
