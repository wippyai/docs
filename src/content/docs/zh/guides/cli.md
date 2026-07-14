---
title: "CLI 参考"
description: "Wippy 运行时的命令行界面。"
---

# CLI 参考

Wippy 运行时的命令行界面。

## 全局标志

适用于所有命令：

| 标志 | 缩写 | 描述 |
|------|------|------|
| `--config` | | 配置文件（默认：.wippy.yaml） |
| `--verbose` | `-v` | 启用调试日志 |
| `--very-verbose` | | 包含堆栈跟踪的调试日志 |
| `--console` | `-c` | 彩色控制台日志 |
| `--silent` | `-s` | 禁用控制台日志 |
| `--event-streams` | `-e` | 将日志流式传输到事件总线 |
| `--profiler` | `-p` | 在 localhost:6060 启用 pprof |
| `--memory-limit` | `-m` | 内存限制（例如 1G、512M） |

内存限制优先级：`--memory-limit` 标志 > `GOMEMLIMIT` 环境变量 > 默认 1GB。

## wippy init

创建新的锁文件。

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| 标志 | 缩写 | 默认值 | 描述 |
|------|------|--------|------|
| `--src-dir` | `-d` | ./src | 源代码目录 |
| `--modules-dir` | | .wippy | 模块目录 |
| `--lock-file` | `-l` | wippy.lock | 锁文件路径 |

## wippy run

启动运行时或执行命令。

```bash
wippy run                                   # 启动运行时
wippy run list                              # 列出可用命令
wippy run test                              # 运行测试
wippy run snapshot.wapp                     # 从打包文件运行
wippy run acme/http                         # 从中心运行模块
wippy run acme/http@1.2.3                   # 运行指定版本
wippy run --exec app:worker                 # 启动运行时并执行单个进程
```

| 标志 | 缩写 | 描述 |
|------|------|------|
| `--override` | `-o` | 覆盖条目值（`namespace:entry:field=value`）；`field` 可为 `kind` 以更改条目种类 |
| `--set` | | 覆盖配置值（`section.path=value`，可重复，优先于配置文件） |
| `--exec` | `-x` | 执行进程后退出（`namespace:entry`） |
| `--host` | | `--exec` 的终端主机 ID（若仅存在一个 `terminal.host` 则自动检测） |
| `--registry` | | 中心模块的注册中心 URL |

`--set` 从命令行写入任意运行时配置值，按叶子合并到 `.wippy.yaml` 之上：

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

值按形态转换：`true`/`false` 转为布尔，整数和浮点转为数字，其余保持字符串（在选项需要时，`5s` 这样的时长会被解析）。

## wippy lint

检查 Lua 代码的类型错误和警告。

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

验证所有 Lua 条目：`function.lua`、`library.lua`、`process.lua`、`workflow.lua`（包括其 `.bc` 变体）。

| 标志 | 缩写 | 默认值 | 描述 |
|------|------|--------|------|
| `--lock-file` | `-l` | `wippy.lock` | 锁文件路径 |
| `--level` | | `warning` | 最低严重级别：`error`、`warning`、`hint` |
| `--ns` | | | 按命名空间模式过滤（例如 `app`、`lib.*`） |
| `--code` | | | 按错误代码过滤（例如 `E0001,E0004`） |
| `--rules` | | `false` | 启用风格/质量 lint 规则 |
| `--summary` | | `false` | 按错误代码分组输出 |
| `--limit` | | `0` | 最多显示的诊断数（0 = 无限制） |
| `--json` | | `false` | JSON 输出 |
| `--no-color` | | `false` | 禁用彩色输出 |
| `--cache-reset` | | `false` | lint 前清除 Lua 缓存 |

## wippy add

添加模块依赖。

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| 标志 | 缩写 | 默认值 | 描述 |
|------|------|--------|------|
| `--lock-file` | `-l` | wippy.lock | 锁文件路径 |
| `--registry` | | | 注册中心 URL |

## wippy install

从锁文件安装依赖。

```bash
wippy install                            # 安装全部
wippy install acme/http                  # 安装指定模块
wippy install --refresh acme/http        # 重新获取指定模块
```

| 标志 | 缩写 | 默认值 | 描述 |
|------|------|--------|------|
| `--lock-file` | `-l` | wippy.lock | 锁文件路径 |
| `--refresh` | | false | 重新获取每个模块，绕过缓存 |
| `--force` | | false | `--refresh` 的别名 |
| `--repair` | | false | `--refresh` 的别名 |
| `--registry` | | | 注册中心 URL |

## wippy update

更新依赖并重新生成锁文件。

```bash
wippy update                      # 更新全部
wippy update acme/http            # 更新指定模块
wippy update acme/http demo/sql   # 更新多个模块
```

| 标志 | 缩写 | 默认值 | 描述 |
|------|------|--------|------|
| `--lock-file` | `-l` | wippy.lock | 锁文件路径 |
| `--src-dir` | `-d` | ./src | 源代码目录 |
| `--modules-dir` | | .wippy | 模块目录 |
| `--registry` | | | 注册中心 URL |

## wippy pack

创建快照包（.wapp 文件）。

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| 标志 | 缩写 | 描述 |
|------|------|------|
| `--lock-file` | `-l` | 锁文件路径 |
| `--description` | `-d` | 包描述 |
| `--tags` | `-t` | 包标签（逗号分隔） |
| `--meta` | | 自定义元数据（key=value） |
| `--embed` | | 嵌入 fs.directory 条目（模式匹配） |
| `--list` | | 列出 fs.directory 条目（预览模式） |
| `--exclude-ns` | | 排除命名空间（模式匹配） |
| `--exclude` | | 排除条目（模式匹配） |
| `--bytecode` | | 将 Lua 编译为字节码（** 表示全部） |

## wippy publish

将模块发布到 Hub。

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

从当前目录的 `wippy.yaml` 读取配置。

| 标志 | 描述 |
|------|------|
| `--version` | 发布版本 |
| `--dry-run` | 仅验证，不实际发布 |
| `--label` | 以可变标签发布，而非版本号 |
| `--release-notes` | 发布说明 |
| `--protected` | 将版本标记为受保护 |
| `--embed` | 按 id 或 name 嵌入 fs.directory 条目 |
| `--config` | 包含 wippy.yaml 的目录路径（默认：.） |
| `--registry` | 注册中心 URL |
| `--create` | 若模块在注册中心尚不存在则自动创建 |
| `--module-visibility` | 新建模块的可见性（仅 `--create`）：`public` 或 `private`（默认：private） |
| `--module-type` | 新建模块的类型（仅 `--create`）：`library`、`application`、`agent` 或 `plugin`（默认：application） |
| `--module-display-name` | 新建模块的显示名称（仅 `--create`） |

## wippy search

在 Hub 中搜索模块。

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| 标志 | 默认值 | 描述 |
|------|--------|------|
| `--json` | false | 以 JSON 格式输出 |
| `--limit` | 20 | 最大结果数 |
| `--registry` | | 注册中心 URL |

## wippy auth

管理注册中心认证。

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| 标志 | 描述 |
|------|------|
| `--token` | API 令牌 |
| `--registry` | 注册中心 URL |
| `--local` | 将凭据存储在本地 |

### wippy auth logout

```bash
wippy auth logout
```

| 标志 | 描述 |
|------|------|
| `--registry` | 注册中心 URL |
| `--local` | 删除本地凭据 |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

| 标志 | 描述 |
|------|------|
| `--json` | 以 JSON 格式输出 |

## wippy readme

从 Hub 获取模块的 README。

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| 标志 | 描述 |
|------|------|
| `--json` | 以 JSON 格式输出 |
| `--registry` | 注册中心 URL（默认：来自凭据） |

## wippy registry

查询和检查注册表条目。

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| 标志 | 缩写 | 描述 |
|------|------|------|
| `--kind` | `-k` | 按类型过滤（glob 模式） |
| `--ns` | `-n` | 按命名空间过滤（glob 模式） |
| `--name` | | 按名称过滤（glob 模式） |
| `--meta` | | 按元数据过滤（可重复） |
| `--json` | | 以 JSON 格式输出 |
| `--yaml` | | 以 YAML 格式输出 |
| `--lock-file` | `-l` | 锁文件路径 |

`--meta` 的元数据运算符：

| 运算符 | 含义 |
|--------|------|
| `field=value` | 精确匹配 |
| `field~regex` | 正则匹配 |
| `field*substr` | 包含子串 |
| `field^prefix` | 以前缀开头 |
| `field$suffix` | 以后缀结尾 |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| 标志 | 缩写 | 描述 |
|------|------|------|
| `--field` | `-f` | 显示指定字段 |
| `--json` | | 以 JSON 格式输出 |
| `--yaml` | | 以 YAML 格式输出 |
| `--raw` | | 原始输出 |
| `--lock-file` | `-l` | 锁文件路径 |

## wippy version

打印版本信息。

```bash
wippy version
wippy version --short
```

## 自定义命令

任何 `process.lua` 或 `process.wasm` 条目都可以通过添加 `command` 元数据注册为命名命令：

```yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      command:
        name: test
        short: Run application tests
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

使用以下方式运行：

```bash
wippy run test
```

列出所有可用命令：

```bash
wippy run list
```

### 命令元数据字段

| 字段 | 必填 | 描述 |
|------|------|------|
| `name` | 是 | 与 `wippy run <name>` 配合使用的命令名称 |
| `short` | 否 | 在 `wippy run list` 中显示的简短描述 |
| `main` | 否 | 将此条目标记为默认命令（由仅提供单个命令的 pack 与中心模块自动选用） |

任何进程条目类型均可使用（`process.lua`、`process.wasm`）。命令名称在所有已加载的条目中必须唯一。命令名称之后的参数会作为字符串负载传递给进程。

## 示例

### 开发工作流

```bash
# 初始化项目
wippy init
wippy add wippy/http wippy/sql
wippy install

# 检查错误
wippy lint

# 启用调试输出运行
wippy run -c -v

# 覆盖本地开发配置
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### 生产部署

```bash
# 创建带字节码的发布包
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# 从打包文件运行并设置内存限制
wippy run release.wapp -m 2G
```

### 调试

```bash
# 执行单个进程
wippy run --exec app:worker

# 启用性能分析器
wippy run -p -v
# 然后：go tool pprof http://localhost:6060/debug/pprof/heap
```

### 依赖管理

```bash
# 添加新依赖
wippy add acme/http@latest

# 强制重新下载
wippy install --force

# 更新指定模块
wippy update acme/http
```

### 发布

```bash
# 登录 Hub
wippy auth login

# 验证模块
wippy publish --dry-run

# 发布
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## 配置文件

创建 `.wippy.yaml` 以保存持久化设置：

```yaml
logger:
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## 另请参阅

- [配置](guides/configuration.md) - 配置文件参考
- [可观测性](guides/observability.md) - 监控与日志
