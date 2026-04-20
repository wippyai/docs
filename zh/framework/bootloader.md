# 引导加载器

`wippy/bootloader` 模块通过在启动时按预定义顺序发现并执行引导加载器函数来编排应用程序初始化。其他框架模块（迁移、加密、索引刷新）注册引导加载器以执行各自的初始化步骤。

## 配置

将模块添加到项目：

```bash
wippy add wippy/bootloader
wippy install
```

声明依赖以及所需的应用主机：

```yaml
version: "1.0"
namespace: app

entries:
  - name: processes
    kind: process.host
    lifecycle:
      auto_start: true

  - name: os_env
    kind: env.storage.os

  - name: dep.bootloader
    kind: ns.dependency
    component: wippy/bootloader
    version: "*"
    parameters:
      - name: application_host
        value: app:processes
      - name: env_storage
        value: app:os_env
```

引导加载器本身作为 `wippy.bootloader:bootloader.service`（一个 `auto_start: true` 的 `process.service`）运行。激活它无需任何其他配置。

## 工作原理

启动时引导加载器执行以下步骤：

1. 从注册表中发现每个带有 `meta.type: bootloader` 的条目。
2. 按 `meta.order` 升序排序（最低的优先）。
3. 将每个条目作为 Lua 函数依次执行。
4. 在第一个返回 `status = "error"` 的错误处停止。
5. 完成后报告总数 / 成功 / 失败 / 跳过的计数。

引导加载器是自治的 -- 每个都检查自己的条件、执行工作并报告结构化结果。

## 定义引导加载器

引导加载器是任何带有 `meta.type: bootloader` 的 `function.lua` 条目：

```yaml
- name: seed_defaults
  kind: function.lua
  meta:
    type: bootloader
    order: 50
    description: Seed default rows for a new install
  source: file://seed_defaults.lua
  method: run
  modules:
    - logger
  imports:
    sql: :sql
```

| 字段 | 必需 | 描述 |
|-------|----------|-------------|
| `meta.type` | 是 | 必须为 `bootloader` |
| `meta.order` | 否 | 执行顺序（默认 `100`）；越小越先执行 |
| `meta.description` | 否 | 人类可读的摘要 |
| `meta.requires` | 否 | 在日志中显示的依赖提示 |

### 返回契约

`method` 返回一个描述结果的表：

```lua
local function run()
    local ok, err = apply_seed()
    if err then
        return {
            status = "error",
            message = "seed failed: " .. tostring(err)
        }
    end

    if not ok then
        return {
            status = "skipped",
            message = "already seeded"
        }
    end

    return {
        status = "success",
        message = "seeded default rows"
    }
end

return { run = run }
```

| 状态 | 含义 |
|--------|---------|
| `success` | 工作已完成 |
| `skipped` | 无操作（已完成，前置条件未满足） |
| `error` | 失败 -- 停止启动序列 |

引发 Lua 错误的引导加载器被视为 `error`。

## 执行顺序

较低的 `order` 值优先运行。为基础设施保留较低的顺序：

| Order | 典型用途 |
|-------|-------------|
| `10` | 密钥和加密密钥（由模块提供） |
| `20` | 模式迁移（由 `wippy/migration` 提供） |
| `50` | 数据填充、搜索索引预热 |
| `100` | 默认 -- 应用级任务 |

当两个引导加载器共享相同顺序时，它们之间的执行顺序无法保证。

## 内置引导加载器

### 加密密钥（顺序 `10`）

生成 256 位 `ENCRYPTION_KEY`，并在没有值时通过配置的 `env_storage` 存储它。其他模块（安全、用量跟踪）读取此变量用于信封加密。当变量已存在时跳过。

### 迁移引导加载器（顺序 `20`）

由 `wippy/migration` 提供。发现每个带有 `meta.type: migration` 的条目，按 `meta.target_db` 分组并应用待处理的迁移。参见[迁移](framework/migration.md)。

## 观察启动状态

服务为每个引导加载器记录一行（`SUCCESS`、`FAILED`、`SKIPPED`），包含条目 ID、顺序和持续时间。最后的汇总行报告聚合计数。失败的引导加载器会中止启动 -- 此后监管者的重启策略将应用于 `bootloader.service`。

<tip>
保持引导加载器幂等。它们可能在崩溃重启后再次运行，因此在执行工作之前检查前置条件（行存在、文件存在、env 变量已设置）。
</tip>

## 另见

- [迁移](framework/migration.md) - 迁移引导加载器和 DSL
- [监管](guides/supervision.md) - 服务生命周期和重启策略
- [框架概览](framework/overview.md) - 框架模块用法
