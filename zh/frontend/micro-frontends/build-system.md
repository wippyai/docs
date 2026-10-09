---
title: "构建与依赖契约"
description: "标准输出命令、Windows 包装脚本、Web Host import map 快照，以及 externals。"
---

# 构建与依赖契约

## Wippy 项目的标准构建契约

在由 `wippy.exe` 启动的 Wippy 应用或模块仓库中，请调用仓库的 Make 目标。不要直接运行包管理器或 Vite 构建命令。

每个生产前端目标的 Makefile 配方都使用：

```text
npm run build -- --outDir <target> --emptyOutDir
```

部署构建拥有 `<target>`。`vite.config.ts` 不得硬编码部署输出目录。

不由 `wippy.exe` 启动的平台／包源码仓库（例如 Web Host 源码）使用该仓库 `package.json` 中声明的确切脚本和参数。Wippy 模块的 `--outDir <target> --emptyOutDir` 配方不适用于包源码仓库，除非其自身声明的脚本明确记载了这些参数。

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Windows 用户通过 `make.bat` 调用对应目标。`make.ps1` 为 Windows 实现该 Makefile 目标；它不是一个独立的公开构建接口。

```powershell
param(
  [Parameter(Position = 0)]
  [string]$Target = "help"
)

$ErrorActionPreference = "Stop"
$targets = @("frontend-example")
if ($Target -notin $targets) {
  throw "Unknown target '$Target'. Available targets: $($targets -join ', ')"
}

$Output = "app/src/app/static/example"
$resolvedOutput = [System.IO.Path]::GetFullPath(
  [System.IO.Path]::Combine($PSScriptRoot, $Output)
)
Push-Location (Join-Path $PSScriptRoot "frontend/example")
try {
  npm.cmd run build -- --outDir $resolvedOutput --emptyOutDir
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}
```

### make.bat

`make.bat` 只是委托给它的 PowerShell 对应脚本、转发参数并返回其退出码。
对于示例目标，Windows 用户运行 `make.bat frontend-example`。

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## import map 快照算法

目标 Web Host 版本定义了宿主提供的模块。

1. 确定目标 Web Host 的发布标签。
2. 在开发期间获取一次
   `https://web-host.wippy.ai/<release-tag>/import-map.json`。
3. 保存发布标签、解析出的确切 URL、完整的 `imports` 对象，以及所获取 import map 载荷字节的小写 SHA-256。
4. 把该 `imports` 对象中的每个 key 外部化。
5. 无宿主模式使用同一份完整快照。
6. 当宿主版本变更时，或当新添加的依赖可能已由宿主提供时，重新获取。
7. 检查构建产物，拒绝快照中不存在的裸导入。

不要维护手写的包列表。不要把完整的外部集合镜像进 peer dependencies。

```ts
import hostImportMap from './wippy-import-map.json'

export default {
  build: {
    rollupOptions: {
      external: Object.keys(hostImportMap.imports),
    },
  },
}
```

快照必须包含其来源和哈希。快照中不存在的依赖会被打包进产物，除非另有成文的构建规则适用。

获批的合并版 Web Host 1.0.63 候选使用的预期快照 URL 是
`https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json`。发布后请确认标签。
不要替换成本地应用 URL、未固定版本的 `latest` URL 或手工重建的包列表。

候选版 PrimeVue 4.5.5 条目由公开导出模式生成。Host 的
`primevue-export-inventory.json` 记录具体运行时目标。请使用准确的说明符，不要
使用通配符或手工维护子集。请参阅 [Host 包](../web-host/packages.md)。

### Host URL 和部署路径

Web Host 包构建需要 `APP_URL`。请设置公开的 HTTP(S) 来源地址，以及可选的部署路径。
构建会拒绝缺失或无效的 URL，包括凭据、查询、片段和路径遍历段。请保留 `/wippy`
这样的路径；Host 会将它用于 `dist/import-map.json` 中的绝对 URL。

若要在路径下生成生产构建，请设置部署 URL 并运行完整包构建。保留版本标签时，
不要设置 `APP_IGNORE_TAG`：

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

本地无标签构建时，请显式设置两个变量：

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1` 会移除版本标签前缀，仅用于本地测试，不用于带版本的生产部署。
`APP_URL` 始终必填。`build:site` 将 `${APP_URL}/${tagPrefix}` 用作 Vite 绝对基础路径；
完整的 `pnpm run build` 还会准备 proxy、library 和 types 产物。只有这些前置条件
已经存在且仅修改了 site 代码时，才使用 `pnpm run build:site` 进行增量构建。
`build:site:relative` 将标签前缀用作 Vite 相对资源基础路径，但 import map 的值仍为绝对 URL。

对候选版本，`APP_URL=https://cdn.example/wippy` 和标签 `webcomponents-1.0.63` 会生成
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json`。vendor 和动态 chunk URL
也必须保留相同的来源、部署路径和标签。构建后检查 `dist/import-map.json`：所有
`imports` 值必须是位于已配置来源和路径下的绝对 HTTP(S) URL，且不能包含 `/undefined/`。
然后通过实际部署路由请求版本化 map 及其资源。构建成功本身不能证明路由可用。

## AppConfig import map URL

相对映射目标以新文档的 base URL 为基准解析。CDN 和本地 mirror 应使用固定版本和部署路径的绝对 URL，例如 `https://cdn.example/wippy/vendor/` 和 `http://localhost:5173/vendor/`。如果 CDN 模块导入其他 bare specifier，也要为该依赖添加映射，或使用自包含的 CDN 模块。运行时映射不会改写已打包的导入。请参阅[引导顺序](../web-host/bootstrap.md#appconfig-import-map)。

仅在文档明确支持此字段的已部署 Host 版本中使用。

## Release tag source

构建标签取自 `CI_COMMIT_TAG`；未设置时使用 `APP_TAG`。在 CI 之外构建带版本的产物时，请设置 `APP_TAG`。
