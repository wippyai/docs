# 命令执行
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

执行外部命令和 shell 脚本，完全控制 I/O 流。

关于执行器配置，请参见 [Executor](system/exec.md)。

## 加载

```lua
local exec = require("exec")
```

## 获取 Executor

通过 ID 获取进程执行器资源：

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- 使用执行器
local proc = executor:exec("ls -la")
-- ...

-- 完成后释放
executor:release()
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `id` | string | 资源 ID |

**返回值:** `Executor, error`

## 创建进程

使用指定命令创建新进程：

```lua
-- 简单命令
local proc, err = executor:exec("echo 'Hello, World!'")

-- 带工作目录
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- 带环境变量
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- 运行 shell 脚本
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `cmd` | string | 要执行的命令 |
| `options.work_dir` | string | 工作目录 |
| `options.env` | table | 环境变量 |

**返回值:** `Process, error`

## start / wait

启动进程并等待完成。

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", "Build failed with exit code: " .. exit_code)
end
```

## stdout_stream / stderr_stream

获取流以读取进程输出。

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- 读取所有 stdout
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- 检查错误
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

向进程 stdin 写入数据。

```lua
-- 通过管道传输数据到命令
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

-- 写入输入
proc:write_stdin("banana\napple\ncherry\n")
proc:write_stdin("")  -- 发送 EOF 信号

-- 读取排序后的输出
local sorted = stdout:read()
print(sorted)  -- "apple\nbanana\ncherry\n"

proc:wait()
stdout:close()
```

## signal / close

发送信号或关闭进程。

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... 稍后，需要停止它 ...

-- 优雅关闭（SIGTERM）
proc:close()

-- 或强制终止（SIGKILL）
proc:close(true)

-- 或发送特定信号
local SIGINT = 2
proc:signal(SIGINT)
```

## 权限

Exec 操作受安全策略评估约束。

| 操作 | 资源 | 描述 |
|--------|----------|-------------|
| `exec.get` | Executor ID | 获取执行器资源 |
| `exec.run` | Command | 执行特定命令 |

## 错误

| 条件 | 类型 | 可重试 |
|-----------|------|-----------|
| 无效的 ID | `errors.INVALID` | 否 |
| 权限被拒绝 | `errors.PERMISSION_DENIED` | 否 |
| 进程已关闭 | `errors.INVALID` | 否 |
| 进程未启动 | `errors.INVALID` | 否 |
| 已经启动 | `errors.INVALID` | 否 |

参见 [错误处理](lua/core/errors.md) 了解如何处理错误。
