---
title: "Framework"
description: "Wippy 通过 hub 提供官方框架模块。这些模块在 wippy 组织下维护，可添加到任何项目中。"
---

# Framework

Wippy 通过 hub 提供官方框架模块。这些模块在 `wippy` 组织下维护，可添加到任何项目中。

## Adding Framework Modules

```bash
wippy add wippy/test
wippy install
```

这会把模块添加到你的锁文件，并下载到 `.wippy/vendor/`。

## Declaring Dependencies in Source

框架模块也可以在 `_index.yaml` 中声明为依赖：

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.3.0"
```

然后解析并安装：

```bash
wippy update
```

## Importing Framework Libraries

安装完成后，把框架库导入到你的条目中：

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

该 import 把 `wippy.test:test`（`wippy.test` 命名空间中的 `test` 条目）映射为本地名称 `test`，随后你在 Lua 中 `require("test")` 使用它。

## Available Modules

| Module | Description |
|--------|-------------|
| `wippy/llm` | 统一的 LLM 接口，支持生成、流式、工具调用和结构化输出 |
| `wippy/agent` | 智能体框架，含工具、委派、traits 和记忆 |
| `wippy/embeddings` | 向量嵌入存储与相似度搜索 |
| `wippy/test` | BDD 风格测试框架，含断言与 mocking |
| `wippy/dataflow` | 基于 DAG 节点执行的工作流编排 |
| `wippy/relay` | WebSocket relay，含按用户的 hub 与插件路由 |
| `wippy/views` | 虚拟页面/组件系统，含模板渲染 |
| `wippy/facade` | 前端宿主配置、主题化和配置端点 |
| `wippy/terminal` | 终端 UI 组件 |
| `wippy/migration` | 数据库模式迁移 |
| `wippy/security` | 行为者作用域、策略包和安全辅助工具 |
| `wippy/usage` | LLM 调用的令牌和成本使用核算 |

还有更多模块可用，并在持续发布。在 hub 中搜索：

```bash
wippy search wippy
```

## See Also

- [Dependency Management](guides/dependency-management.md) - 锁文件与版本约束
- [Publishing](guides/publishing.md) - 发布你自己的模块
- [CLI Reference](guides/cli.md) - CLI 命令
