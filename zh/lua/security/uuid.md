# UUID 生成
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

生成通用唯一标识符。适配工作流使用 - 随机 UUID 在重放时返回一致的值。

## 加载

```lua
local uuid = require("uuid")
```

## 随机 UUID

### Version 1

基于时间的 UUID，包含时间戳和节点 ID。

```lua
local id, err = uuid.v1()
```

**返回值:** `string, error`

### Version 4

随机 UUID。

```lua
local id, err = uuid.v4()
```

**返回值:** `string, error`

### Version 7

时间排序的 UUID。可按创建时间排序。

```lua
local id, err = uuid.v7()
```

**返回值:** `string, error`

## 确定性 UUID

### Version 3

使用 MD5 从命名空间和名称生成确定性 UUID。

```lua
local id, err = uuid.v3(namespace, name)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `namespace` | string | 有效的 UUID 字符串 |
| `name` | string | 要哈希的值 |

**返回值:** `string, error`

### Version 5

使用 SHA-1 从命名空间和名称生成确定性 UUID。

```lua
local NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
local id, err = uuid.v5(NS_URL, "https://example.com/resource")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `namespace` | string | 有效的 UUID 字符串 |
| `name` | string | 要哈希的值 |

**返回值:** `string, error`

## 检查

### 验证

```lua
local valid = uuid.validate(input)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `input` | any | 要检查的值 |

**返回值:** `boolean`

### 获取版本

```lua
local ver, err = uuid.version(id)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `uuid` | string | 有效的 UUID 字符串 |

**返回值:** `integer, error`

### 获取变体

```lua
local var, err = uuid.variant(id)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `uuid` | string | 有效的 UUID 字符串 |

**返回值:** `string, error` (RFC4122, Microsoft, NCS, 或 Invalid)

### 解析

```lua
local info, err = uuid.parse(id)
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `uuid` | string | 有效的 UUID 字符串 |

**返回值:** `table, error`

返回表字段：
- `version` (integer): UUID 版本（1、3、4、5 或 7）
- `variant` (string): RFC4122、Microsoft、NCS 或 Invalid
- `timestamp` (integer): Unix 时间戳（仅 v1 和 v7）
- `node` (string): 节点 ID（仅 v1）

### 格式化

```lua
local formatted, err = uuid.format(id, "standard")
local formatted, err = uuid.format(id, "simple")
local formatted, err = uuid.format(id, "urn")
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `uuid` | string | 有效的 UUID 字符串 |
| `format` | string? | standard（默认）、simple 或 urn |

**返回值:** `string, error`

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无效的输入类型 | `errors.INVALID` | 否 |
| 无效的 UUID 格式 | `errors.INVALID` | 否 |
| 不支持的格式类型 | `errors.INVALID` | 否 |
| 生成失败 | `errors.INTERNAL` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。
