# Lua 标准库
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

所有 Wippy 进程中自动可用的核心 Lua 库，无需 `require()`。

## 全局函数

### 类型与转换

```lua
type(value)         -- 返回: "nil", "number", "string", "boolean", "table", "function", "thread", "userdata"
tonumber(s [,base]) -- 转换为数字，可选基数 (2-36)
tostring(value)     -- 转换为字符串，调用 __tostring 元方法
```

### 断言与错误

```lua
assert(v [,msg])    -- 若 v 为 false/nil 则抛出错误，否则返回 v
error(msg [,level]) -- 在指定栈层级抛出错误（默认 1）
pcall(fn, ...)      -- 保护调用，返回 ok, result_or_error
xpcall(fn, errh)    -- 带错误处理函数的保护调用
```

### 表迭代

```lua
pairs(t)            -- 迭代所有键值对
ipairs(t)           -- 迭代数组部分 (1, 2, 3, ...)
next(t [,index])    -- 获取 index 之后的下一个键值对
```

### 元表

```lua
getmetatable(obj)       -- 获取元表（如有 __metatable 字段则返回该字段）
setmetatable(t, mt)     -- 设置元表，返回 t
```

### 原始表访问

绕过元方法直接访问表：

```lua
rawget(t, k)        -- 不经 __index 获取 t[k]
rawset(t, k, v)     -- 不经 __newindex 设置 t[k]=v
rawequal(a, b)      -- 不经 __eq 比较
```

### 实用函数

```lua
select(index, ...)  -- 返回从 index 开始的参数
select("#", ...)    -- 返回参数数量
unpack(t [,i [,j]]) -- 将 t[i] 到 t[j] 作为多个值返回
print(...)          -- 打印值（在 Wippy 中使用结构化日志）
```

### 全局变量

```lua
_G        -- 全局环境表
_VERSION  -- Lua 版本字符串
```

## 表操作

用于修改表的函数：

```lua
table.insert(t, [pos,] value)  -- 在 pos 位置插入值（默认：末尾）
table.remove(t [,pos])         -- 移除并返回 pos 位置的元素（默认：最后一个）
table.concat(t [,sep [,i [,j]]]) -- 用分隔符连接数组元素
table.sort(t [,comp])          -- 原地排序，comp(a,b) 返回 true 表示 a < b
table.pack(...)                -- 将可变参数打包成带 'n' 字段的表
table.unpack(t [,i [,j]])      -- 将表元素解包为多个值
```

```lua
local items = {"a", "b", "c"}

table.insert(items, "d")           -- {"a", "b", "c", "d"}
table.insert(items, 2, "x")        -- {"a", "x", "b", "c", "d"}
table.remove(items, 2)             -- {"a", "b", "c", "d"}, 返回 "x"

local csv = table.concat(items, ",")  -- "a,b,c,d"

table.sort(items, function(a, b)
    return a > b  -- 降序
end)
```

## 字符串操作

字符串操作函数，也可作为字符串值的方法使用：

### 模式匹配

```lua
string.find(s, pattern [,init [,plain]])   -- 查找模式，返回起始位置、结束位置、捕获
string.match(s, pattern [,init])           -- 提取匹配的子串
string.gmatch(s, pattern)                  -- 遍历所有匹配的迭代器
string.gsub(s, pattern, repl [,n])         -- 替换匹配项，返回字符串和替换次数
```

### 大小写转换

```lua
string.upper(s)   -- 转换为大写
string.lower(s)   -- 转换为小写
```

### 子串与字符

```lua
string.sub(s, i [,j])      -- 从 i 到 j 的子串（负索引从末尾计算）
string.len(s)              -- 字符串长度（或使用 #s）
string.byte(s [,i [,j]])   -- 字符的数值编码
string.char(...)           -- 从字符编码创建字符串
string.rep(s, n [,sep])    -- 用分隔符重复字符串 n 次
string.reverse(s)          -- 反转字符串
```

### 格式化

```lua
string.format(fmt, ...)    -- printf 风格格式化
```

格式说明符：`%d`（整数）、`%f`（浮点数）、`%s`（字符串）、`%q`（带引号）、`%x`（十六进制）、`%o`（八进制）、`%e`（科学计数法）、`%%`（字面量 %）

```lua
local s = "Hello, World!"

-- 模式匹配
local start, stop = string.find(s, "World")  -- 8, 12
local word = string.match(s, "%w+")          -- "Hello"

-- 替换
local new = string.gsub(s, "World", "Wippy") -- "Hello, Wippy!"

-- 方法语法
local upper = s:upper()                       -- "HELLO, WORLD!"
local part = s:sub(1, 5)                      -- "Hello"
```

### 模式

| 模式 | 匹配内容 |
|---------|---------|
| `.` | 任意字符 |
| `%a` | 字母 |
| `%d` | 数字 |
| `%w` | 字母数字 |
| `%s` | 空白符 |
| `%p` | 标点符号 |
| `%c` | 控制字符 |
| `%x` | 十六进制数字 |
| `%z` | 零（空字符） |
| `[set]` | 字符类 |
| `[^set]` | 否定类 |
| `*` | 0 或多个（贪婪） |
| `+` | 1 或多个（贪婪） |
| `-` | 0 或多个（惰性） |
| `?` | 0 或 1 个 |
| `^` | 字符串开头 |
| `$` | 字符串结尾 |
| `%b()` | 匹配括号对 |
| `(...)` | 捕获组 |

大写版本（`%A`、`%D` 等）匹配其补集。

## 数学函数

数学函数和常量：

### 常量 {id="math-constants"}

```lua
math.pi       -- 3.14159...
math.huge     -- 无穷大
math.mininteger  -- 最小整数
math.maxinteger  -- 最大整数
```

### 基本运算

```lua
math.abs(x)           -- 绝对值
math.min(...)         -- 参数的最小值
math.max(...)         -- 参数的最大值
math.floor(x)         -- 向下取整
math.ceil(x)          -- 向上取整
math.modf(x)          -- 整数部分和小数部分
math.fmod(x, y)       -- 浮点余数
```

### 幂与根

```lua
math.sqrt(x)          -- 平方根
math.pow(x, y)        -- x^y（或使用 x^y 运算符）
math.exp(x)           -- e^x
math.log(x [,base])   -- 自然对数（或以 n 为底的对数）
```

### 三角函数

```lua
math.sin(x)   math.cos(x)   math.tan(x)    -- 弧度
math.asin(x)  math.acos(x)  math.atan(y [,x])
math.sinh(x)  math.cosh(x)  math.tanh(x)   -- 双曲函数
math.deg(r)   -- 弧度转角度
math.rad(d)   -- 角度转弧度
```

### 随机数

```lua
math.random()         -- 随机浮点数 [0,1)
math.random(n)        -- 随机整数 [1,n]
math.random(m, n)     -- 随机整数 [m,n]
math.randomseed(x)    -- 设置随机种子
```

### 类型转换

```lua
math.tointeger(x)     -- 转换为整数或 nil
math.type(x)          -- "integer"、"float" 或 nil
math.ult(m, n)        -- 无符号小于比较
```

## 协程

协程创建和控制。通道和并发模式请参见 [通道与协程](lua/core/channel.md)：

```lua
coroutine.create(fn)        -- 从函数创建协程
coroutine.resume(co, ...)   -- 启动/继续协程
coroutine.yield(...)        -- 挂起协程，向 resume 返回值
coroutine.status(co)        -- "running"、"suspended"、"normal"、"dead"
coroutine.running()         -- 当前协程（主线程返回 nil）
coroutine.wrap(fn)          -- 创建可调用函数形式的协程
```

### 启动并发协程

启动独立运行的并发协程（Wippy 特有）：

```lua
coroutine.spawn(fn)         -- 将函数作为并发协程启动
```

```lua
-- 启动后台任务
coroutine.spawn(function()
    while true do
        check_health()
        time.sleep("30s")
    end
end)

-- 主执行立即继续
process_request()
```

## 错误处理

结构化错误创建和分类。完整文档请参见 [错误处理](lua/core/errors.md)：

### 常量 {id="error-constants"}

```lua
errors.UNKNOWN           -- 未分类错误
errors.INVALID           -- 无效参数或输入
errors.NOT_FOUND         -- 资源未找到
errors.ALREADY_EXISTS    -- 资源已存在
errors.PERMISSION_DENIED -- 权限被拒绝
errors.TIMEOUT           -- 操作超时
errors.CANCELED          -- 操作已取消
errors.UNAVAILABLE       -- 服务不可用
errors.INTERNAL          -- 内部错误
errors.CONFLICT          -- 冲突（如并发修改）
errors.RATE_LIMITED      -- 超出速率限制
```

### 函数 {id="error-functions"}

```lua
-- 从字符串创建错误
local err = errors.new("something went wrong")

-- 创建带元数据的错误
local err = errors.new({
    message = "User not found",
    kind = errors.NOT_FOUND,
    retryable = false,
    details = {user_id = 123}
})

-- 用上下文包装现有错误
local wrapped = errors.wrap(err, "failed to load profile")

-- 检查错误类型
if errors.is(err, errors.NOT_FOUND) then
    -- 处理未找到
end

-- 从错误获取调用栈
local stack = errors.call_stack(err)
```

### 错误方法

```lua
err:message()    -- 获取错误消息字符串
err:kind()       -- 获取错误类型（如 "NOT_FOUND"）
err:retryable()  -- true、false 或 nil（未知）
err:details()    -- 获取详情表或 nil
err:stack()      -- 获取堆栈跟踪字符串
```

## UTF-8 Unicode

Unicode UTF-8 字符串处理：

### 常量 {id="utf8-constants"}

```lua
utf8.charpattern  -- 匹配单个 UTF-8 字符的模式
```

### 函数 {id="utf8-functions"}

```lua
utf8.char(...)           -- 从 Unicode 码点创建字符串
utf8.codes(s)            -- 遍历码点的迭代器: for pos, code in utf8.codes(s)
utf8.codepoint(s [,i [,j]]) -- 获取位置 i 到 j 的码点
utf8.len(s [,i [,j]])    -- 计算 UTF-8 字符数（非字节数）
utf8.offset(s, n [,i])   -- 从位置 i 开始第 n 个字符的字节位置
```

```lua
local s = "Hello, 世界"

-- 计算字符数（非字节数）
print(utf8.len(s))  -- 9

-- 遍历码点
for pos, code in utf8.codes(s) do
    print(pos, code, utf8.char(code))
end

-- 获取指定位置的码点
local code = utf8.codepoint(s, 8)  -- 第一个中文字符

-- 从码点创建字符串
local emoji = utf8.char(0x1F600)  -- 笑脸
```

## 受限功能

出于安全考虑，以下标准 Lua 功能不可用：

| 功能 | 替代方案 |
|---------|-------------|
| `load`、`loadstring`、`loadfile`、`dofile` | 使用[动态求值](lua/dynamic/eval.md)模块 |
| `collectgarbage` | 自动 GC |
| `rawlen` | 使用 `#` 运算符 |
| `io.*` | 使用[文件系统](lua/storage/filesystem.md)模块 |
| `os.execute`、`os.exit`、`os.remove`、`os.rename`、`os.tmpname` | 使用[命令执行](lua/dynamic/exec.md)、[环境](lua/system/env.md)模块 |
| `debug.*`（除 traceback 外） | 不可用 |
| `package.loadlib` | 不支持原生库 |

## 参见

- [通道与协程](lua/core/channel.md) - Go 风格的并发通道
- [错误处理](lua/core/errors.md) - 创建和处理结构化错误
- [系统时间](lua/system/ostime.md) - 系统时间函数
