# CLI 命令参考

Wippy 运行时的命令行接口。

## 全局参数

所有命令均可使用以下参数：

| 参数 | 简写 | 说明 |
|------|------|------|
| `--config` | | 配置文件（默认: .wippy.yaml） |
| `--verbose` | `-v` | 启用调试日志 |
| `--very-verbose` | | 调试日志带堆栈跟踪 |
| `--console` | `-c` | 彩色控制台输出 |
| `--silent` | `-s` | 禁用控制台日志 |
| `--event-streams` | `-e` | 将日志流式传输到事件总线 |
| `--profiler` | `-p` | 在 localhost:6060 启用 pprof |
| `--memory-limit` | `-m` | 内存限制（例如 1G, 512M） |

内存限制优先级：`--memory-limit` 参数 > `GOMEMLIMIT` 环境变量 > 默认 1GB。

## wippy init

创建新的锁文件。

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--src-dir` | `-d` | ./src | 源代码目录 |
| `--modules-dir` | | .wippy | 模块目录 |
| `--lock-file` | `-l` | wippy.lock | 锁文件路径 |

## wippy run

启动运行时或执行命令。

```bash
wippy run                                    # 启动运行时
wippy run list                               # 列出可用命令
wippy run test                               # 运行测试
wippy run snapshot.wapp                      # 从包文件运行
wippy run acme/http                          # 运行模块
wippy run --exec app:processes/app:worker   # 执行单个进程
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `--override` | `-o` | 覆盖入口值（namespace:entry:field=value） |
| `--exec` | `-x` | 执行进程后退出（host/namespace:entry） |
| `--host` | | 执行的主机 |
| `--registry` | | 注册表 URL |

## wippy lint

检查 Lua 代码中的类型错误和警告。

```bash
wippy lint
wippy lint --level warning
```

验证所有 Lua 入口：`function.lua.*`、`library.lua.*`、`process.lua.*`、`workflow.lua.*`。

| 参数 | 说明 |
|------|------|
| `--level` | 报告的最低严重级别 |

## wippy add

添加模块依赖。

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--lock-file` | `-l` | wippy.lock | 锁文件路径 |
| `--registry` | | | 注册表 URL |

## wippy install

从锁文件安装依赖。

```bash
wippy install
wippy install --force
wippy install --repair
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `--lock-file` | `-l` | 锁文件路径 |
| `--force` | | 跳过缓存，始终下载 |
| `--repair` | | 验证哈希，不匹配时重新下载 |
| `--registry` | | 注册表 URL |

## wippy update

更新依赖并重新生成锁文件。

```bash
wippy update                      # 更新全部
wippy update acme/http            # 更新指定模块
wippy update acme/http demo/sql   # 更新多个模块
```

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--lock-file` | `-l` | wippy.lock | 锁文件路径 |
| `--src-dir` | `-d` | . | 源代码目录 |
| `--modules-dir` | | .wippy | 模块目录 |
| `--registry` | | | 注册表 URL |

## wippy pack

创建快照包（.wapp 文件）。

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `--lock-file` | `-l` | 锁文件路径 |
| `--description` | `-d` | 包描述 |
| `--tags` | `-t` | 包标签（逗号分隔） |
| `--meta` | | 自定义元数据（key=value） |
| `--embed` | | 嵌入 fs.directory 入口（匹配模式） |
| `--list` | | 列出 fs.directory 入口（预览模式） |
| `--exclude-ns` | | 排除命名空间（匹配模式） |
| `--exclude` | | 排除入口（匹配模式） |
| `--bytecode` | | 将 Lua 编译为字节码（** 表示全部） |

## wippy publish

将模块发布到 Hub。

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

从当前目录的 `wippy.yaml` 读取配置。

| 参数 | 说明 |
|------|------|
| `--version` | 发布版本 |
| `--dry-run` | 仅验证不发布 |
| `--label` | 版本标签 |
| `--release-notes` | 发布说明 |
| `--protected` | 标记为受保护版本 |
| `--registry` | 注册表 URL |

## wippy search

在 Hub 中搜索模块。

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| 参数 | 说明 |
|------|------|
| `--json` | 以 JSON 格式输出 |
| `--limit` | 最大结果数 |
| `--registry` | 注册表 URL |

## wippy auth

管理注册表认证。

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| 参数 | 说明 |
|------|------|
| `--token` | API 令牌 |
| `--registry` | 注册表 URL |
| `--local` | 本地存储凭据 |

### wippy auth logout

```bash
wippy auth logout
```

| 参数 | 说明 |
|------|------|
| `--registry` | 注册表 URL |
| `--local` | 删除本地凭据 |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

## wippy registry

查询和检查注册表入口。

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `--kind` | `-k` | 按类型过滤 |
| `--ns` | `-n` | 按命名空间过滤 |
| `--name` | | 按名称过滤 |
| `--meta` | | 按元数据过滤 |
| `--json` | | 以 JSON 格式输出 |
| `--yaml` | | 以 YAML 格式输出 |
| `--lock-file` | `-l` | 锁文件路径 |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `--field` | `-f` | 显示特定字段 |
| `--json` | | 以 JSON 格式输出 |
| `--yaml` | | 以 YAML 格式输出 |
| `--raw` | | 原始输出 |
| `--lock-file` | `-l` | 锁文件路径 |

## wippy version

显示版本信息。

```bash
wippy version
wippy version --short
```

## 示例

### 开发工作流

```bash
# 初始化项目
wippy init
wippy add wippy/http wippy/sql
wippy install

# 检查错误
wippy lint

# 带调试输出运行
wippy run -c -v

# 覆盖本地开发配置
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### 生产部署

```bash
# 创建带字节码的发布包
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# 带内存限制运行
wippy run release.wapp -m 2G
```

### 调试

```bash
# 执行单个进程
wippy run --exec app:processes/app:worker

# 启用性能分析器
wippy run -p -v
# 然后: go tool pprof http://localhost:6060/debug/pprof/heap
```

### 依赖管理

```bash
# 添加新依赖
wippy add acme/http@latest

# 修复损坏的模块
wippy install --repair

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

创建 `.wippy.yaml` 用于持久化设置：

```yaml
logger:
  mode: development
  level: debug
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

## 参见

- [配置](guides/configuration.md) - 配置文件参考
- [可观测性](guides/observability.md) - 监控和日志
