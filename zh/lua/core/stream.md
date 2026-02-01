# 流
<secondary-label ref="function"/>
<secondary-label ref="process"/>

用于高效处理数据的流读写操作。Stream 对象从其他模块（HTTP、文件系统等）获取。

## 加载

```lua
-- 从 HTTP 请求体
local stream = req:stream()

-- 从文件系统
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
```

## 读取

```lua
local chunk, err = stream:read(size)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `size` | integer | 要读取的字节数（0 = 读取所有可用） |

**返回:** `string, error` — EOF 时返回 nil

```lua
-- 读取所有剩余数据
local data, err = stream:read_all()
```

## 写入

```lua
local bytes, err = stream:write(data)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `data` | string | 要写入的数据 |

**返回:** `integer, error` — 写入的字节数

## 定位

```lua
local pos, err = stream:seek(whence, offset)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `whence` | string | `"set"`、`"cur"` 或 `"end"` |
| `offset` | integer | 偏移字节数 |

**返回:** `integer, error` — 新位置

## 刷新

```lua
local ok, err = stream:flush()
```

将缓冲数据刷新到底层存储。

## 流信息

```lua
local info, err = stream:stat()
```

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `size` | integer | 总大小（未知时为 -1） |
| `position` | integer | 当前位置 |
| `readable` | boolean | 是否可读 |
| `writable` | boolean | 是否可写 |
| `seekable` | boolean | 是否可定位 |

## 关闭

```lua
local ok, err = stream:close()
```

关闭流并释放资源。可多次安全调用。

## Scanner

为流内容创建分词器：

```lua
local scanner, err = stream:scanner(split)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `split` | string | `"lines"`、`"words"`、`"bytes"`、`"runes"` |

### Scanner 方法

```lua
local has_more = scanner:scan()  -- 前进到下一个 token
local token = scanner:text()      -- 获取当前 token
local err_msg = scanner:err()     -- 获取错误（如有）
```

```lua
while scanner:scan() do
    local line = scanner:text()
    process(line)
end
if scanner:err() then
    return nil, errors.new("INTERNAL", scanner:err())
end
```

## 错误

| 条件 | 类型 |
|-----------|------|
| 无效的 whence/split 类型 | `INVALID` |
| 流已关闭 | `INTERNAL` |
| 不可读/不可写 | `INTERNAL` |
| 读写失败 | `INTERNAL` |
