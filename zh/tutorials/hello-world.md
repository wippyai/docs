# Hello World

你的第一个 Wippy 应用程序 - 一个返回 JSON 的简单 HTTP API。

## 我们要构建什么

一个带有单个端点的最小 Web API：

```
GET /hello → {"message": "hello world"}
```

## 项目结构

```
hello-world/
├── wippy.lock           # 生成的锁文件
└── src/
    ├── _index.yaml      # 入口定义
    └── hello.lua        # 处理程序代码
```

## 步骤 1：创建项目目录

```bash
mkdir hello-world && cd hello-world
mkdir src
```

## 步骤 2：入口定义

创建 `src/_index.yaml`：

```yaml
version: "1.0"
namespace: app

entries:
  # HTTP 服务器
  - name: gateway
    kind: http.service
    addr: :8080
    lifecycle:
      auto_start: true

  # 路由器
  - name: api
    kind: http.router
    meta:
      server: gateway
    prefix: /

  # 处理函数
  - name: hello
    kind: function.lua
    source: file://hello.lua
    method: handler
    modules:
      - http

  # 端点
  - name: hello.endpoint
    kind: http.endpoint
    meta:
      router: app:api
    method: GET
    func: hello
    path: /hello
```

**四个入口协同工作：**

1. `gateway` - 监听 8080 端口的 HTTP 服务器
2. `api` - 通过 `meta.server` 附加到 gateway 的路由器
3. `hello` - 处理请求的 Lua 函数
4. `hello.endpoint` - 将 `GET /hello` 路由到该函数

## 步骤 3：处理程序代码

创建 `src/hello.lua`：

```lua
local http = require("http")

local function handler()
    local res = http.response()

    res:set_content_type(http.CONTENT.JSON)
    res:set_status(http.STATUS.OK)
    res:write_json({message = "hello world"})
end

return {
    handler = handler
}
```

`http` 模块提供对 request/response 对象的访问。函数返回一个包含导出的 `handler` 方法的表。

## 步骤 4：初始化并运行

```bash
# 从源代码生成锁文件
wippy init

# 启动运行时（-c 表示彩色控制台输出）
wippy run -c
```

你将看到类似以下的输出：

```
╦ ╦╦╔═╗╔═╗╦ ╦  Adaptive Application Runtime
║║║║╠═╝╠═╝╚╦╝  v0.1.20
╚╩╝╩╩  ╩   ╩   by Spiral Scout

0.00s  INFO  run          runtime ready
0.11s  INFO  core         service app:gateway is running  {"details": "service listening on :8080"}
```

## 步骤 5：测试

```bash
curl http://localhost:8080/hello
```

响应：

```json
{"message":"hello world"}
```

## 工作原理

1. `gateway` 在 8080 端口接受 TCP 连接
2. `api` 路由器匹配路径前缀 `/`
3. `hello.endpoint` 匹配 `GET /hello`
4. `hello` 函数执行并写入 JSON 响应

## CLI 参考

| 命令 | 描述 |
|---------|-------------|
| `wippy init` | 从 `src/` 生成锁文件 |
| `wippy run` | 从锁文件启动运行时 |
| `wippy run -c` | 启动并显示彩色控制台输出 |
| `wippy run -v` | 启动并显示详细调试日志 |
| `wippy run -s` | 以静默模式启动（无控制台日志） |

## 下一步

- [Echo Service](echo-service.md) - 处理请求参数
- [Task Queue](task-queue.md) - 带后台处理的 REST API
- [HTTP Router](http/router.md) - 路由模式
