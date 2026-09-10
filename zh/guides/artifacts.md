---
title: "构建期产物"
description: "把文件系统资源声明为可感知格式的产物、把它物化到消费方项目中，以及运行时会自动协调哪些内容。"
---

# 构建期产物

模块可以附带一个目录，供消费方在**构建期**而非运行时使用——最有用的情形是一个供其他模块编译时依赖的包。Wippy 把它们称为**产物（artifact）**：带有 `meta.artifact.format` 标记的普通 WAPP 文件系统资源。

这就是共享包如何抵达另一个仓库中的模块的方式。路径别名只能在一个仓库内解析；而产物随模块一同流转。

[设计层](../frontend/design-layer.md)解释了*什么*属于这样的包、什么不属于；本页讲的是运送它的机制。

## 声明产物

生产方声明一个普通的 `fs.directory` 并给它标记一个格式：

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: 消费方在构建期物化的 npm 包。
      artifact:
        format: node-package
    directory: ./package
```

其他什么都不变：该资源像任何其他 `fs.directory` 一样被嵌入 WAPP——在 `wippy.yaml` 的 `embed:` 下列出它，或者给 `wippy publish` 和 `wippy pack` 传 `--embed`；未被嵌入的目录既不会被打包也不会被验证。已声明的产物会**在模块发布和应用打包期间被验证**，因此格式错误的产物会在发布时失败，而不是在消费方那里失败。

## 格式

格式适配器决定一个目录如何被验证、它具有什么标识，以及它落在哪里。Wippy 内置了一种：

| 格式 | 拥有的子树 | 验证 |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` 要求有 `name` 和一个语义化的 `version`，并且**拒绝 `preinstall`、`install`、`postinstall` 和 `prepare` 生命周期脚本**——被物化的包不得在安装时执行任何东西。它写入物化根目录下的 `npm/<package name>`。

格式必须在执行该工作的二进制文件中注册。宿主可以注册额外的格式；重复的名称和重叠的根目录会被拒绝。

## 物化

大多数时候你不需要运行任何东西。物化输出会在以下时机被自动协调：

- 全量和定向的 `wippy install` 与 `wippy update`
- 冷启动
- 基于 Hub 的动态安装、更新和卸载

全量安装、更新、冷启动和运行时依赖协调是*精确的*：过期的输出会被清除。**定向**安装只叠加被选中的模块，并保留属于未被选中模块的输出。

本地模块替换走与打包资源相同的验证和物化生命周期，因此被替换模块的产物表现得与已发布的产物一样。

### 显式物化

对于需要在运行时介入之前拿到产物的构建步骤，CLI 直接暴露了它：

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root` 默认为 `.wippy`。该资源必须声明 `meta.artifact.format`，且该格式必须在此 CLI 中注册。

要清楚这个命令**故意不做**什么：它不解析模块依赖，不修改 `wippy.lock`，不调用包管理器，也不参与运行时组合。它只是从一个 WAPP 中验证一个产物并把它写到磁盘上。

### 输出落在哪里

`artifact.materialization_root` 配置由应用拥有的输出根目录。它的默认值是依赖 vendor 目录的父目录。每种格式在它之下拥有一个互不重叠的子树，因此 `node-package` 的输出始终位于 `<root>/npm/` 下。

物化是事务性的。内容先被验证并暂存，受管理的根目录在进程锁下被原子地交换，失败会随外围的注册表事务一起回滚，被中断的交换会在下一次运行时恢复。

## 完整示例：一个共享的前端包

一个唯一职责是发布包的生产方模块——它在运行时不提供任何服务：

```yaml
# platform/ui-kit/src/_index.yaml
version: "1.0"
namespace: kickside.ui_kit

entries:
  - name: package_fs
    kind: fs.directory
    meta:
      artifact:
        format: node-package
    directory: ./package
```

消费方在安装依赖之前把它物化到自己的目录树中：

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

这会写入 `./.wippy/npm/@kickside/ui-kit`。消费方用一个普通的 workspaces glob 把它捡起来，从那之后的解析就是普通的 node 解析：

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

从这个形态中有两点值得借鉴：

- **这个包是它自己的模块，而不是某个更大模块里的一个目录。** 产物携带自己的 `package.json` 版本，把它绑定到一个会因无关原因而变化的模块，会导致每当一方变动就必须发布另一方。
- **消费方把它当作普通依赖来解析。** 一旦物化，就不存在 Wippy 特有的导入路径，这正是同一份源码既能在 monorepo 内构建、也能在其外构建的原因。

## 端到端：编写、开发循环、CI

### 编写生产方

对于包产物，通常**没有什么可构建的**——目录本身就是交付物。一个 CSS 词汇包只是一些文件加上一份清单：

```text
platform/ui-kit/
├── src/_index.yaml      # 把 package_fs 声明为产物
└── package/             # 将成为 npm 包的目录
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

```json
{
  "name": "@kickside/ui-kit",
  "version": "1.5.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    "./kx-card.css": "./kx-card.css",
    "./kx-state.css": "./kx-state.css"
  },
  "files": ["kx-card.css", "kx-state.css", "package.json"]
}
```

`sideEffects` 对纯 CSS 包很重要：没有它，打包器可以自由地把被导入的样式表当作死代码丢弃。

**包版本必须等于模块版本。** `wippy publish` 会验证这一点并拒绝不匹配，所以请同时提升两者。这也是给共享包*自己的*模块而不是把它嵌套在更大模块中的原因——否则宿主模块的每一次无关改动都会迫使该包发布新版本，反之亦然。

### 发布

```bash
# 只验证不发布
wippy publish --dry-run --version 1.5.0 --embed package_fs

# 发布
wippy publish --create --module-type library --module-visibility public --version 1.5.0 --embed package_fs
```

已声明的产物会作为发布的一部分被验证，因此不符合该格式规则的 package.json 会在这里被拒绝，而不是在消费方的构建中。

### 开发循环

每次编辑都发布不是开发循环。在本地打包生产方，并让消费方的物化步骤指向那个文件：

```bash
# 在生产方模块中
wippy pack /tmp/ui-kit-dev.wapp --embed package_fs

# 消费方从本地 pack 而不是已发布的 pack 物化
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

让这个覆盖成为开发路径与 CI 之间*唯一*的差异——一个用来选择 pack 文件的环境变量，其下游的一切完全相同。物化方式与 CI 不同的开发循环就不再能预测 CI 的结果。

### 接入 make 和 CI

把物化步骤做成**消费方构建的前置依赖**，而不是靠人记得去运行的东西：

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

这样 CI 就完全不需要任何针对产物的专门步骤：它运行同一个 `make build`，`UI_KIT_WAPP` 未设置，因此走的是抓取并物化的路径，针对的是在 `build-inputs` 中锁定的已发布版本。全新检出的代码不可能针对过期或缺失的包进行编译，而从未听说过产物的贡献者仍然能得到正确的构建。

## 你仍然需要自己动手做的部分

`wippy artifacts materialize` 刻意保持窄小，因此消费产物的构建目前需要自己把四个步骤粘合起来。知道是哪四个可以省去重新摸索：

**1. 获取 `.wapp`。** 该命令接受的是*pack 文件路径*，而不是模块引用，并且不解析依赖——所以必须有别的东西先把生产方抓下来。可行的模式是一个微型 Wippy 项目，它唯一的职责就是锁定并下载它：

```yaml
# build-inputs/wippy.lock — 一个只为抓取而存在的项目
directories:
  modules: .wippy
  src: ./src
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

在这里而不是在应用锁文件中锁定它，可以把构建期输入排除在运行时依赖图之外。

**2. 为每个消费方物化一次**，物化到消费方的包管理器能看到的根目录：

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. 接线消费方的 `package.json`。** 物化写入文件；它不会编辑清单。只有当消费方*同时*声明了 workspace glob 和依赖时，npm 才会链接该包：

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

版本是 `*`，因为被物化的包自带版本。把这一步脚本化并使其幂等——如果接线缺失，构建会在很久之后以一个光秃秃的样式表 `ENOENT` 失败，这读起来像是文件缺失，而不是接线缺失。

**4. 运行包管理器。** `materialize` 不会调用它，所以在第 3 步之后 `npm install` 需要你自己调用。

把它们合在一起，放进一个以消费方模块为参数的目标中：

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

把整个目标做成消费方构建的前置依赖，这样全新检出的代码就不可能针对过期或缺失的包进行编译。

## 范围之外

产物有意不引入第二套解析器、包注册中心、归档格式、锁文件 schema、Hub API 或模块清单。仅构建期的依赖语义、再分发策略和宿主 ABI 验证是各自独立的问题，这里并不解决它们。

## 相关内容

- [依赖管理](./dependency-management.md) — 解析模块与本地替换
- [发布](./publishing.md) — 已发布模块包含什么
- [设计层](../frontend/design-layer.md) — 为什么共享前端词汇首先要作为一个包来交付
