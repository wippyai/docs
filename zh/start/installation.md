# 安装

## 快速安装

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

或从 [hub.wippy.ai/releases](https://hub.wippy.ai/releases) 直接下载。

## 验证安装

```bash
wippy version
```

## 快速开始

```bash
# 创建新项目
mkdir myapp && cd myapp
wippy init

# 添加依赖
wippy add wippy/http
wippy install

# 运行
wippy run
```

## 命令概览

| 命令 | 描述 |
|------|------|
| `wippy init` | 初始化新项目 |
| `wippy run` | 启动运行时 |
| `wippy lint` | 检查代码错误 |
| `wippy add` | 添加依赖 |
| `wippy install` | 安装依赖 |
| `wippy update` | 更新依赖 |
| `wippy pack` | 创建快照包 |
| `wippy publish` | 发布到 Hub |
| `wippy search` | 搜索模块 |
| `wippy auth` | 管理认证 |
| `wippy version` | 显示版本信息 |

详见 [CLI 参考](guides/cli.md)。

## 下一步

- [Hello World](tutorials/hello-world.md) — 创建你的第一个项目
- [项目结构](start/structure.md) — 了解项目布局
- [CLI 参考](guides/cli.md) — 所有命令和选项
