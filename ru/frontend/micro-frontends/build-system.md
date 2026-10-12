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

Для утвержденного общего кандидата Web Host 1.0.63 ожидаемый URL снимка —
`https://web-host.wippy.ai/webcomponents-1.0.63/import-map.json`. Подтвердите тег
после публикации. Не подставляйте URL локального приложения, незакрепленный
`latest` или вручную восстановленный список пакетов.

Записи PrimeVue 4.5.5 в кандидате генерируются из публичных шаблонов экспорта.
Файл Host `primevue-export-inventory.json` содержит конкретные runtime-цели.
Используйте точные спецификаторы, а не шаблон или ручное подмножество. См. [Пакеты Host](../web-host/packages.md).

### URL Host и пути развертывания

Для сборки пакета Web Host требуется `APP_URL`. Укажите публичный HTTP(S)-origin
и, при необходимости, путь развертывания. Сборка отклоняет отсутствующий или
некорректный URL, включая учетные данные, query, fragment и сегменты traversal.
Сохраните путь вроде `/wippy`: Host использует его в абсолютных URL в
`dist/import-map.json`.

Для production-сборки под путем укажите URL развертывания и запустите полную
сборку пакета. Не задавайте `APP_IGNORE_TAG`, чтобы сохранить тег версии:

```powershell
$env:APP_URL = 'https://cdn.example/wippy'
Remove-Item Env:APP_IGNORE_TAG -ErrorAction SilentlyContinue
pnpm run build
```

Для локальной сборки без тега задайте обе переменные явно:

```powershell
$env:APP_URL = 'http://localhost:5173'
$env:APP_IGNORE_TAG = '1'
pnpm run build
```

`APP_IGNORE_TAG=1` удаляет префикс тега. Используйте это для локальных тестов,
а не для versioned production deployment. `APP_URL` обязателен всегда.
Полная команда `pnpm run build` также создает артефакты proxy, библиотек и типов.
Используйте `pnpm run build:site` только для инкрементального изменения сайта,
когда эти зависимости сборки уже подготовлены.
`build:site` задает `${APP_URL}/${tagPrefix}` как абсолютный Vite base.
`build:site:relative` использует префикс тега как относительный asset base Vite,
но значения import map остаются абсолютными URL.

Для кандидата `APP_URL=https://cdn.example/wippy` и тег
`webcomponents-1.0.63` дают URL карты
`https://cdn.example/wippy/webcomponents-1.0.63/import-map.json`. URL vendor и
dynamic chunks должны сохранять origin, путь и тег. После сборки проверьте
`dist/import-map.json`: все значения `imports` должны быть абсолютными URL
HTTP(S) под заданными origin и путем, без `/undefined/`. Затем запросите карту и
ее ресурсы через реальный маршрут развертывания. Успешная сборка не проверяет
маршрутизацию.

## URL для AppConfig importMap

Относительные цели карты разрешаются относительно базового URL созданного документа. Для CDN и локального mirror используйте абсолютные URL с закреплённой версией и путём развёртывания, например `https://cdn.example/wippy/vendor/` и `http://localhost:5173/vendor/`. Если CDN-модуль импортирует другой bare specifier, добавьте для него запись или используйте самодостаточный модуль. Карта времени выполнения не меняет уже включённые в bundle импорты. См. [Порядок запуска](../web-host/bootstrap.md#appconfig-import-map).

Используйте это поле только с развернутой версией Host, в документации которой указана поддержка.

## Release tag source

Тег сборки берется из `CI_COMMIT_TAG`; если он не задан, используется `APP_TAG`. Задайте `APP_TAG` для создания версионированного артефакта вне CI.
