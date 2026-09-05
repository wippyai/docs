---
title: "通过 MCP 使用 Keeper"
description: "Wippy Keeper 是运行中的 Wippy 应用的控制平面——注册表工作台、文件系统↔注册表治理、智能体/任务编排、Hub…"
---

# 通过 MCP 使用 Keeper

Wippy Keeper 是运行中的 Wippy 应用的控制平面——注册表工作台、文件系统↔注册表治理、智能体/任务编排、Hub 安装、知识库、日志与进程检查，以及 Git 审阅/推送流程，全部藏在内置 UI 之后。它的决定性特征是把这些运维能力通过 **MCP（Model Context Protocol）** 暴露给 AI 客户端（Claude、Codex 等）。本页把 Keeper 添加到一个应用中，并将 MCP 客户端连接到它。

## 我们要构建什么

1. 把 Keeper 添加到一个由 `app-template` 脚手架生成的应用中。
2. 位于 `/app/keeper` 的 Keeper UI 和位于 `/keeper-mcp/` 的 MCP 端点。
3. 一个受限作用域的 MCP 令牌，以及一个配置好的、通过 Keeper 驱动应用的 MCP 客户端。

## 前置条件

- 一个来自 [app-template](https://github.com/wippyai/app-template) 的应用。它已经提供了 Keeper 绑定所需的一切：`app:gateway`、`app:api`、`app:db`、`app:processes`、`app.security:admin` 和 `app.env:store`。
- 已安装 Keeper 模块：

  ```bash
  wippy add keeper/keeper
  wippy install
  ```

## 添加 Keeper

声明依赖并把它绑定到应用的资源上。只有 `admin_scope` 是必填的（没有默认值）；其余的默认为 `app-template` 已经使用的名称，这里为清晰起见显式写出：

```yaml
# src/app/deps/_index.yaml
- name: keeper
  kind: ns.dependency
  component: keeper/keeper
  parameters:
    - { name: app_db,         value: app:db }
    - { name: admin_scope,    value: app.security:admin }
    - { name: env_storage,    value: app.env:store }
    - { name: public_gateway, value: app:gateway }   # 承载 /keeper-mcp/
    - { name: mcp_route,      value: /keeper-mcp/ }
    - { name: ui_server,      value: app:gateway }
    - { name: process_host,   value: app:processes }
```

启动应用：

```bash
wippy run
```

Keeper 会自动挂载三个界面：

- **UI** — `/app/keeper`
- **MCP 传输** — 公共网关上的 `/keeper-mcp/`
- **令牌 API** — 在 `app:api` 上（`/keeper/mcp/tokens`、`/keeper/mcp/scopes`）

MCP 传输由 `MCP_ENABLED` 环境变量把关（默认 `true`）；把它设为 `false` 可关闭该端点。

## 签发 MCP 令牌

令牌由管理员用户签发，带有作用域，并且只显示一次。通过令牌 API（或 Keeper UI 中的 MCP 页面）创建一个：

```bash
curl -X POST http://localhost:8085/api/v1/keeper/mcp/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"label": "claude-dev", "preset": "developer"}'
# -> { "success": true, "token": { "token": "wkmcp_<64 hex>", ... } }
```

`preset` 打包了一组作用域。可用的预设有：`root`、`developer`、`wippy_operator`、`observer`、`knowledge_manager`、`explorer_tools_only`。若需更精细的控制，可以改为传入一个显式的 `scopes` 数组（例如 `registry.read`、`state.write`、`git.pr`、`tasks.run`、`knowledge.read`）。原始的 `wkmcp_...` 令牌只返回一次，并且只以哈希形式存储——请立即复制它。

## 连接客户端

把 MCP 客户端指向该端点，并把令牌作为 bearer 头传入。对于 Claude Code / Codex，在项目根目录放一个 `.mcp.json`：

```json
{
  "mcpServers": {
    "keeper": {
      "type": "http",
      "url": "http://localhost:8085/keeper-mcp/",
      "headers": { "Authorization": "Bearer wkmcp_<token>" }
    }
  }
}
```

在已部署的环境中，用应用的公共基础 URL 替换 `http://localhost:8085`。

## MCP 界面如何工作

Keeper 并不暴露一份扁平、固定的工具列表。它呈现少数几个**元工具**加上按需激活具体工具的**特性（trait）**，因此在你主动选用某项能力之前，界面保持精简：

- `session_info` — 始终可用；报告会话的作用域和已激活的特性。
- `list_traits` / `describe_trait` — 发现有哪些可用内容。
- `use_trait` / `drop_trait`（以及 `set_traits`）— 激活或移除一个特性；这会发出一个 MCP `notifications/tools/list_changed`，因此可见的工具会实时变化。
- `list_tools` / `call_tool` — 枚举并调用某个特性所物化出的工具。

一个令牌能激活什么受其**作用域**限制——大致为 `registry.*`、`state.*`、`hub.*`、`knowledge.*`、`git.*`、`components.*`、`tasks.*`、`agents.*`、`tests.run`、`logger.*`、`env.*`、`functions.call`、`app.ui`（外加用于完全管理员绕过的 `mcp.root`）。令牌的 `access_mode`（`any` / `traits` / `tools_only`）进一步约束它可以如何调用工具。

## 注意事项

- **治理作用域** — 设置 `GOV_MANAGED_NAMESPACES=app`，使 Keeper 的文件系统↔注册表同步只治理你的应用命名空间。除非你正在开发这些模块，否则不要添加 `keeper`、`wippy` 或 `userspace`。
- **安全** — 令牌绑定到签发它的管理员身份和一组作用域，以 SHA-256 存储，并可通过 `POST /keeper/mcp/tokens/revoke` 撤销。`/keeper-mcp/` 路由不运行任何认证中间件；由处理器自己强制执行 bearer 令牌。
- **参考应用** — `app-keeper` 是把 Keeper 接入应用外壳的完整示例；如果你想要一个已知可用的配置，可以复制它的 `src/app/deps/_index.yaml` 块。

## 下一步

- [Hello World](tutorials/hello-world.md) — 最小的项目布局
- [认证](tutorials/auth.md) — 签发令牌的管理员身份
- [智能体](framework/agents.md) — Keeper 特性所暴露的智能体和工具
