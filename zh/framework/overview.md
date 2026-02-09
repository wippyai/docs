# 框架

Wippy 通过 hub 提供官方框架模块。这些模块在 `wippy` 组织下维护，可以添加到任何项目中。

## 添加框架模块

```bash
wippy add wippy/test
wippy install
```

这会将模块添加到锁文件并下载到 `.wippy/vendor/`。

## 在源码中声明依赖

框架模块也可以在 `_index.yaml` 中声明为依赖项：

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

## 导入框架库

安装后，将框架库导入到你的条目中：

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

导入将 `wippy.test:test`（`wippy.test` 命名空间中的 `test` 条目）映射到本地名称 `test`，然后在 Lua 中通过 `require("test")` 使用。

## 可用模块

| 模块 | 描述 |
|--------|-------------|
| `wippy/test` | BDD 风格的测试框架，支持断言和 Mock |
| `wippy/terminal` | 终端 UI 组件 |

更多模块正在持续发布中。搜索 hub：

```bash
wippy search wippy
```

## 另请参阅

- [依赖管理](guides/dependency-management.md) - 锁文件和版本约束
- [发布](guides/publishing.md) - 发布你自己的模块
- [命令行工具](guides/cli.md) - CLI 命令
