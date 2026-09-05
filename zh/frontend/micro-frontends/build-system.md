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

例如，如果所选发布标签是 `v1.2.3`，唯一的标准快照 URL 就是
`https://web-host.wippy.ai/v1.2.3/import-map.json`。不要替换为本地应用 URL、未固定版本的 `latest` URL，或手工重建的包列表。
