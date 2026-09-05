---
title: "安装"
description: "安装 Wippy 运行时"
---

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

# 运行
wippy run
```

HTTP、SQL、存储和进程托管都内置在运行时中 — 新项目无需任何依赖即可运行。框架模块按需从 Hub 添加：

```bash
wippy add wippy/test
wippy install
```

## 命令概览

| 命令 | 描述 |
|------|------|
| `wippy init` | 初始化新项目 |
| `wippy run` | 启动运行时 |
| `wippy test` | 运行测试入口点 |
| `wippy lint` | 检查代码错误 |
| `wippy add` | 添加依赖 |
| `wippy install` | 安装依赖 |
| `wippy update` | 更新依赖 |
| `wippy artifacts` | 物化构建期文件系统制品 |
| `wippy pack` | 创建快照包 |
| `wippy publish` | 发布到 Hub |
| `wippy search` | 搜索模块 |
| `wippy readme` | 从 Hub 获取模块 README |
| `wippy registry` | 检查已加载的注册表条目 |
| `wippy auth` | 管理认证 |
| `wippy version` | 显示版本信息 |

详见 [CLI 参考](guides/cli.md)。

## 故障排查

如果安装后找不到 `wippy version`，请重新打开 shell，或确认安装目录已加入 `PATH`。

## 下一步

- [Hello World](tutorials/hello-world.md) — 创建你的第一个项目
- [项目结构](start/structure.md) — 了解项目布局
- [CLI 参考](guides/cli.md) — 所有命令和选项
