# 代码检查器

Wippy 内置了代码检查器，可对 Lua 代码执行类型检查和静态分析。使用 `wippy lint` 运行。

## 用法

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## 检查内容

代码检查器会验证所有 Lua 条目类型：

- `function.lua.*` - 函数
- `library.lua.*` - 库
- `process.lua.*` - 进程
- `workflow.lua.*` - 工作流

每个条目都会经过解析、类型检查和正确性分析。

## 严重级别

诊断信息分为三个严重级别：

| 级别 | 描述 |
|------|------|
| `error` | 必须修复的类型错误和正确性问题 |
| `warning` | 可能的缺陷或有问题的模式 |
| `hint` | 风格建议和提示性说明 |

使用 `--level` 控制显示的级别：

```bash
wippy lint --level error          # Errors only
wippy lint --level warning        # Warnings and errors (default)
wippy lint --level hint           # Everything
```

## 错误代码

### 解析错误

| 代码 | 描述 |
|------|------|
| `P0001` | Lua 语法错误 - 源代码无法解析 |

### 类型检查错误（E 系列）

类型检查器错误（`E0001`+）报告类型系统发现的问题：类型不匹配、未定义变量、无效操作等正确性问题。这些始终作为错误报告。

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### Lint 规则警告 (W 系列)

Lint 规则提供代码风格和质量检查。使用 `--rules` 启用：

```bash
wippy lint --rules
```

| 代码 | 规则 | 描述 |
|------|------|------|
| `W0001` | no-empty-blocks | 空代码块 |
| `W0002` | no-global-assign | 对全局变量赋值 |
| `W0003` | no-self-compare | 值与自身比较 |
| `W0004` | no-unused-vars | 未使用的局部变量 |
| `W0005` | no-unused-params | 未使用的函数参数 |
| `W0006` | no-unused-imports | 未使用的导入 |
| `W0007` | no-shadowed-vars | 变量遮蔽外部作用域 |

不使用 `--rules` 时，仅执行类型检查（P 和 E 代码）。

## 过滤

### 按命名空间

使用 `--ns` 检查特定命名空间：

```bash
wippy lint --ns app               # Exact namespace match
wippy lint --ns "app.*"           # All under app
wippy lint --ns app --ns lib      # Multiple namespaces
```

选定条目的依赖项会被加载用于类型检查，但其诊断信息不会被报告。

### 按错误代码

按代码过滤诊断信息：

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### 按数量

限制显示的诊断信息数量：

```bash
wippy lint --limit 10             # Show first 10 issues
```

## 输出格式

### 表格格式（默认）

每条诊断信息显示源代码上下文、文件位置和错误消息。结果按条目、严重级别和行号排序。

摘要行显示总数：

```
Checked 42 entries: 5 errors, 12 warnings
```

### 摘要格式

按命名空间和错误代码分组诊断信息：

```bash
wippy lint --summary
```

```
By namespace:

  app                              15 issues (5 errors, 10 warnings)
  lib                               2 issues (2 warnings)

By error code:

  E0001      [error  ]    5 occurrences
  E0004      [error  ]    3 occurrences

Checked 42 entries: 5 errors, 12 warnings
```

### JSON 格式

用于 CI/CD 集成的机器可读输出：

```bash
wippy lint --json
```

```json
{
  "diagnostics": [
    {
      "entry_id": "app:handler",
      "code": "E0001",
      "severity": "error",
      "message": "string not assignable to number",
      "line": 10,
      "column": 5
    }
  ],
  "total_entries": 42,
  "error_count": 5,
  "warning_count": 12,
  "hint_count": 0
}
```

## 缓存

代码检查器会缓存结果以加快重复运行速度。缓存键基于源代码哈希值、方法名称、依赖项和类型系统配置。

如果结果似乎过时，请清除缓存：

```bash
wippy lint --cache-reset
```

## CI/CD 集成

使用 JSON 输出和退出码进行自动化检查：

```bash
wippy lint --json --level error > lint-results.json
```

当未发现错误时，检查器以退出码 0 退出，发现错误时返回非零值。

GitHub Actions 步骤示例：

```yaml
- name: Lint
  run: wippy lint --level warning
```

## 参数参考

| 参数 | 简写 | 默认值 | 描述 |
|------|------|--------|------|
| `--level` | | warning | 最低严重级别（error、warning、hint） |
| `--json` | | false | 以 JSON 格式输出 |
| `--ns` | | | 按命名空间模式过滤 |
| `--code` | | | 按错误代码过滤 |
| `--limit` | | 0 | 显示的最大诊断数量（0 = 不限） |
| `--summary` | | false | 按错误代码分组 |
| `--no-color` | | false | 禁用彩色输出 |
| `--rules` | | false | 启用 lint 规则（W 系列风格/质量检查） |
| `--cache-reset` | | false | 检查前清除缓存 |
| `--lock-file` | `-l` | wippy.lock | 锁定文件路径 |

## 另请参阅

- [CLI](guides/cli.md) - 完整 CLI 参考
- [类型](lua/types.md) - 类型系统文档
- [语言服务器](guides/lsp.md) - 编辑器集成与实时诊断
