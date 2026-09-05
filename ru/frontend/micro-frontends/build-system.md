---
title: "Контракт сборки и зависимостей"
description: "Канонические команды вывода, обёртки для Windows, снимки import map Web Host и внешние зависимости."
---

# Контракт сборки и зависимостей

## Канонический контракт сборки проекта Wippy

В репозитории приложения или модуля Wippy, запускаемом через `wippy.exe`, вызывайте
Make-цель репозитория. Не запускайте команды пакетного менеджера или Vite
напрямую.

Рецепт Makefile для каждой продуктовой фронтенд-цели использует:

```text
npm run build -- --outDir <target> --emptyOutDir
```

Сборка развёртывания владеет `<target>`. `vite.config.ts` не должен жёстко задавать каталог вывода развёртывания.

Репозитории исходников платформы и пакетов, которые не запускаются через `wippy.exe`,
например исходники Web Host, используют точные скрипты и аргументы, объявленные в
`package.json` этого репозитория. Рецепт модуля Wippy `--outDir <target>
--emptyOutDir` не применяется к репозиториям с исходниками пакетов, если только их
собственный объявленный скрипт явно не документирует эти аргументы.

### Makefile

```makefile
FRONTEND_OUTPUT := $(abspath app/src/app/static/example)

.PHONY: frontend-example
frontend-example:
	cd frontend/example && npm run build -- --outDir "$(FRONTEND_OUTPUT)" --emptyOutDir
```

### make.ps1

Пользователи Windows вызывают соответствующую цель через `make.bat`. `make.ps1`
реализует цель Makefile для Windows; это не отдельный публичный интерфейс
сборки.

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

`make.bat` лишь делегирует своему PowerShell-аналогу, передаёт аргументы и возвращает его код завершения.
Для примера с целью `frontend-example` пользователи Windows запускают `make.bat frontend-example`.

```bat
@powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
@exit /b %ERRORLEVEL%
```

## Алгоритм снимка import map

Целевой релиз Web Host определяет модули, предоставляемые хостом.

1. Определите тег целевого релиза Web Host.
2. Однократно во время разработки загрузите
   `https://web-host.wippy.ai/<release-tag>/import-map.json`.
3. Сохраните тег релиза, точный итоговый URL, полный объект `imports` и
   SHA-256 в нижнем регистре от точных байтов загруженного import map.
4. Externalize каждый ключ этого объекта `imports`.
5. Используйте тот же полный снимок для режима без хоста.
6. Перезагружайте снимок при смене релиза хоста или когда вновь добавленная зависимость может теперь предоставляться хостом.
7. Проверьте собранный вывод и отклоните bare-импорты, отсутствующие в снимке.

Не ведите список пакетов вручную. Не зеркалируйте полный набор внешних зависимостей в peer dependencies.

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

Снимок должен содержать сведения о происхождении и хэш. Зависимость, отсутствующая в снимке, попадает в бандл, если не применяется другое задокументированное правило сборки.

Например, если выбранный тег релиза — `v1.2.3`, единственный канонический
URL снимка —
`https://web-host.wippy.ai/v1.2.3/import-map.json`. Не подставляйте URL локального
приложения, незакреплённый URL с `latest` или вручную восстановленный список
пакетов.
