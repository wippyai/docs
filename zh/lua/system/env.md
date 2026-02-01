# 环境变量
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

访问环境变量以获取配置值、密钥和运行时设置。

变量必须在 [环境系统](system/env.md) 中定义后才能访问。系统控制哪些存储后端（操作系统、文件、内存）提供值，以及变量是否只读。

## 加载

```lua
local env = require("env")
```

## get

获取环境变量值。

```lua
-- 获取数据库连接字符串
local db_url = env.get("DATABASE_URL")
if not db_url then
    return nil, errors.new("INVALID", "DATABASE_URL not configured")
end

-- 带回退值获取
local port = env.get("PORT") or "8080"
local host = env.get("HOST") or "localhost"

-- 获取密钥
local api_key = env.get("API_SECRET_KEY")
local jwt_secret = env.get("JWT_SECRET")

-- 配置
local log_level = env.get("LOG_LEVEL") or "info"
local debug_mode = env.get("DEBUG") == "true"
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 变量名 |

**返回:** `string, error`

如果变量不存在则返回 `nil, error`。

## set

设置环境变量。

```lua
-- 设置运行时配置
env.set("APP_MODE", "production")

-- 测试时覆盖
env.set("API_URL", "http://localhost:8080")

-- 根据条件设置
if is_development then
    env.set("LOG_LEVEL", "debug")
end
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `key` | string | 变量名 |
| `value` | string | 要设置的值 |

**返回:** `boolean, error`

## get_all

获取所有可访问的环境变量。

```lua
local vars = env.get_all()

-- 记录配置（注意不要记录密钥）
for key, value in pairs(vars) do
    if not key:match("SECRET") and not key:match("KEY") then
        logger.debug("env", {[key] = value})
    end
end

-- 检查必需变量
local required = {"DATABASE_URL", "REDIS_URL", "API_KEY"}
for _, key in ipairs(required) do
    if not vars[key] then
        return nil, errors.new("INVALID", "Missing required env var: " .. key)
    end
end
```

**返回:** `table, error`

## 权限

环境访问受安全策略评估约束。

### 安全操作

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `env.get` | 变量名 | 读取环境变量 |
| `env.set` | 变量名 | 写入环境变量 |
| `env.get_all` | `*` | 列出所有变量 |

### 检查访问权限

```lua
local security = require("security")

if security.can("env.get", "DATABASE_URL") then
    local url = env.get("DATABASE_URL")
end
```

策略配置请参阅 [安全模型](system/security.md)。

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 键为空 | `errors.INVALID` | 否 |
| 变量未找到 | `errors.NOT_FOUND` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |

错误处理请参阅 [错误处理](lua/core/errors.md)。

## 另请参阅

- [环境系统](system/env.md) - 配置存储后端和变量定义
