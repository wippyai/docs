# 操作系统时间
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

标准 Lua `os` 时间函数。提供用于时间戳、日期格式化和时间计算的真实墙上时钟时间。

## 加载

全局 `os` 表。无需 require。

```lua
os.time()
os.date()
os.clock()
os.difftime()
```

## 获取时间戳

获取 Unix 时间戳（自 1970 年 1 月 1 日 UTC 以来的秒数）：

```lua
-- 当前时间戳
local now = os.time()  -- 1718462445

-- 指定日期/时间
local t = os.time({
    year = 2024,
    month = 12,
    day = 25,
    hour = 10,
    min = 30,
    sec = 0
})
```

**签名:** `os.time([spec]) -> integer`

**参数:**

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `year` | integer | 当前年份 | 四位数年份（例如 2024） |
| `month` | integer | 当前月份 | 月份 1-12 |
| `day` | integer | 当前日期 | 月中日期 1-31 |
| `hour` | integer | 0 | 小时 0-23 |
| `min` | integer | 0 | 分钟 0-59 |
| `sec` | integer | 0 | 秒 0-59 |

不带参数调用时返回当前 Unix 时间戳。

带表调用时，任何缺失的字段使用上面显示的默认值。`year`、`month` 和 `day` 字段如果未指定则默认为当前日期。

```lua
-- 仅日期（时间默认为午夜）
os.time({year = 2024, month = 6, day = 15})

-- 部分指定（填充当前年/月）
os.time({day = 1})  -- 当月第一天
```

## 格式化日期

将时间戳格式化为字符串或返回日期表：

<code-block lang="lua">
local now = os.time()

-- 默认格式
os.date()  -- "Sat Jun 15 14:30:45 2024"

-- 自定义格式
os.date("%Y-%m-%d", now)           -- "2024-06-15"
os.date("%H:%M:%S", now)           -- "14:30:45"
os.date("%Y-%m-%dT%H:%M:%S", now)  -- "2024-06-15T14:30:45"

-- UTC 时间（格式前加 !）
os.date("!%Y-%m-%d %H:%M:%S", now)  -- UTC 而非本地时间

-- 日期表
local t = os.date("*t", now)
</code-block>

**签名:** `os.date([format], [timestamp]) -> string | table`

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| `format` | string | `"%c"` | 格式字符串，`"*t"` 返回表 |
| `timestamp` | integer | 当前时间 | 要格式化的 Unix 时间戳 |

### 格式说明符

| 代码 | 输出 | 示例 |
|------|--------|---------|
| `%Y` | 4 位年份 | 2024 |
| `%y` | 2 位年份 | 24 |
| `%m` | 月份 (01-12) | 06 |
| `%d` | 日期 (01-31) | 15 |
| `%H` | 24 小时制小时 (00-23) | 14 |
| `%I` | 12 小时制小时 (01-12) | 02 |
| `%M` | 分钟 (00-59) | 30 |
| `%S` | 秒 (00-59) | 45 |
| `%p` | AM/PM | PM |
| `%A` | 星期全名 | Saturday |
| `%a` | 星期缩写 | Sat |
| `%B` | 月份全名 | June |
| `%b` | 月份缩写 | Jun |
| `%w` | 星期几 (0-6, Sunday=0) | 6 |
| `%j` | 年中日 (001-366) | 167 |
| `%U` | 周数 (00-53) | 24 |
| `%z` | 时区偏移 | -0700 |
| `%Z` | 时区名称 | PDT |
| `%c` | 完整日期/时间 | Sat Jun 15 14:30:45 2024 |
| `%x` | 仅日期 | 06/15/24 |
| `%X` | 仅时间 | 14:30:45 |
| `%%` | 字面 % | % |

### 日期表

当格式为 `"*t"` 时返回表：

```lua
local t = os.date("*t")
```

| 字段 | 类型 | 描述 | 示例 |
|-------|------|-------------|---------|
| `year` | integer | 四位数年份 | 2024 |
| `month` | integer | 月份 (1-12) | 6 |
| `day` | integer | 月中日期 (1-31) | 15 |
| `hour` | integer | 小时 (0-23) | 14 |
| `min` | integer | 分钟 (0-59) | 30 |
| `sec` | integer | 秒 (0-59) | 45 |
| `wday` | integer | 星期几 (1-7, Sunday=1) | 7 |
| `yday` | integer | 年中日 (1-366) | 167 |
| `isdst` | boolean | 夏令时 | false |

使用 `"!*t"` 获取 UTC 日期表。

## 测量经过时间

获取 Lua 运行时启动以来经过的秒数：

```lua
local start = os.clock()

-- 执行工作
for i = 1, 1000000 do end

local elapsed = os.clock() - start
print(string.format("Took %.3f seconds", elapsed))
```

**签名:** `os.clock() -> number`

## 时间差

获取两个时间戳之间的差值（秒）：

```lua
local t1 = os.time({year = 2024, month = 1, day = 1})
local t2 = os.time({year = 2024, month = 12, day = 31})

local diff = os.difftime(t2, t1)  -- t2 - t1
local days = diff / 86400
print(days)  -- 365
```

**签名:** `os.difftime(t2, t1) -> number`

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `t2` | integer | 较晚的时间戳 |
| `t1` | integer | 较早的时间戳 |

返回 `t2 - t1`（秒）。如果 `t1 > t2` 可能为负数。

## 平台常量

标识运行时的常量：

```lua
os.platform  -- "wippy"
```
