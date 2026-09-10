---
title: "Указатель правил соответствия фронтенда"
description: "Краткий указатель канонических правил фронтенда и владения детерминированными проверками."
---

# Указатель правил соответствия фронтенда

Эта страница — указатель, а не вторая копия контракта.
[Контракт переносимого UI](../portable-ui-contract.md) владеет нормативными
формулировками правил; ссылки ниже дают подробные рекомендации по реализации.

| Правило | Подробное руководство | Детерминированный результат |
|---|---|---|
| FE-PORT-001 | [Контракт переносимого UI](../portable-ui-contract.md) | Отклонять приватные допущения о переносимости |
| FE-UI-001 | [Контракт переносимого UI](../portable-ui-contract.md) | Отклонять сырые или самодельные стандартные элементы управления |
| FE-UI-002 | [Контракт переносимого UI](../portable-ui-contract.md) | Требовать анализа аффордансов |
| FE-UI-003 | [Контракт переносимого UI](../portable-ui-contract.md) | Требовать контракта соседних элементов и подтверждения в альтернативной теме |
| FE-UI-004 | [Контракт переносимого UI](../portable-ui-contract.md) | Требовать настройки PrimeVue при наличии элементов управления |
| FE-UI-005 | [Контракт переносимого UI](../portable-ui-contract.md) | Отклонять выдуманные props и API |
| FE-TW-001 | [Контракт Tailwind](./tailwind-contract.md) | Разрешать выбранный пресет Wippy |
| FE-TW-002 | [Контракт Tailwind](./tailwind-contract.md) | Отклонять значения времени компиляции, документированные как runtime |
| FE-TW-003 | [Контракт Tailwind](./tailwind-contract.md) | Отклонять фиксированные значения соседних элементов без классификации инвариантов |
| FE-TW-004 | [Контракт Tailwind](./tailwind-contract.md) | Отклонять переопределения защищённых сопоставлений |
| FE-TOKEN-001 | [Каталог токенов](./token-catalogue.md) | Отклонять необъявленные ссылки `--p-*` |
| FE-TOKEN-002 | [Каталог токенов](./token-catalogue.md) | Отклонять предполагаемые или выдуманные имена токенов |
| FE-STYLE-001 | [Создание темы](./theming.md) | Отклонять приватные классы фасада и локальную для модуля темизацию `.p-*` |
| FE-A11Y-001 | [Контракт переносимого UI](../portable-ui-contract.md) | Отклонять невалидные или недоступные пользовательские элементы управления |

## Обязательные группы проверок

- Токенный CSS разбирается PostCSS; сгенерированный снимок токенов сравнивается побайтово.
- Фактическая конфигурация Tailwind разрешается, и компилируются представительные утилиты.
- Выданные объявления классифицируются как runtime-переменная, скомпилированная константа, произвольный литерал или внутреннее/временное значение.
- Сырые элементы управления, отсутствующая настройка PrimeVue, переопределения защищённых сопоставлений, необъявленные токены, приватные зависимости от фасада и расхождение хэша контракта отклоняются.
- Внешние зависимости import map сравниваются с полным закреплённым снимком.
- Вывод сборки сверяется с настроенным реестром и раздаваемым ресурсом.
- Переключение темы использует `host.setThemeMode()` и проверяет распространённое состояние
  AppConfig; прямые манипуляции классом темы и внутренние каналы прокси отклоняются.
- Сгенерированные каталоги проверяются на происхождение, кортеж версии и хэши источников.
- Копируемые примеры разбираются, при необходимости собираются и проверяются на вложенное интерактивное содержимое.
- Режим привязки к проекту возвращает ровно `UNSUPPORTED`, и стандартный CI завершается неудачей.

Promptmap может порождать гипотезы. Он не является доказательством существования токена, разрешения утилиты, достижимости или удаления.

## Гейты публикации сгенерированных разделов

Сгенерированные разделы токенов и Tailwind не должны содержать маркер ожидания на момент публикации. Каждому новому runtime-токену нужны реальный потребитель CSS в Wippy, тест на мутацию вычисленного стиля и задокументированное назначение для переносимого потребителя.

Публикация держит runtime-доказательства вне репозитория. Установите:

- `WIPPY_THEME_ROOT` в выбранный пакет `@wippy-fe/theme`.
- `WIPPY_FE_EVIDENCE_ROOT` в каталог доказательств релиза, содержащий
  `runtime-acceptance-evidence.json`, `visual-evidence-index.json`, их
  относительные манифесты сценариев и снимки экрана.
- `WIPPY_FE_RUNTIME_EVIDENCE_SHA256` в SHA-256 в нижнем регистре от точных байтов
  `runtime-acceptance-evidence.json`.

`FRONTEND_DOCS_PUBLICATION=1 node scripts/check-frontend-docs.mjs` вызывает
канонический приёмочный чекер выбранной темы с этим путём к доказательствам и хэшем,
затем валидирует и пересчитывает визуальные доказательства. Обычные проверки
свежести документации не требуют локальных доказательств релиза.

## Детерминированная визуальная проверка

Каждый компонент, затронутый изменением внешнего вида, имеет манифест сценария и
неизменяемые доказательства до/после/diff. Базовая и кандидатная версии используют одну и ту же
сборку браузера, device-pixel ratio, шрифты, фикстурные данные, тему, viewport, настройку
уменьшенного движения и правило стабилизации. Захватывайте все применимые состояния, включая
светлую и тёмную темы, состояния взаимодействия, оверлеи, состояния disabled/error и
десктопные раскладки, которые поддерживает продукт. Не выдумывайте требование узкой/мобильной
раскладки для продукта, рассчитанного только на десктоп.

Каждый сценарий захватывает вырезку компонента и окружающий контекст приложения.
Он также захватывает всю страницу, когда могут быть затронуты оверлей, переполнение или
раскладка страницы. Индекс компонента объявляет полную применимую матрицу и указывает
на один неизменяемый манифест на сценарий:

```json
{
  "schemaVersion": "1.0.0",
  "componentId": "module.component",
  "applicability": {
    "themes": ["light", "dark"],
    "viewports": [{ "id": "desktop", "width": 1440, "height": 900 }],
    "states": ["default"],
    "overlay": false
  },
  "finalBuild": {
    "candidateCommit": "generated-candidate-commit",
    "candidateBuildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "scenarios": [
    {
      "scenarioId": "module.component.light.default",
      "theme": "light",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.light.default.json"
    },
    {
      "scenarioId": "module.component.dark.default",
      "theme": "dark",
      "viewport": "desktop",
      "state": "default",
      "manifest": "scenarios/module.component.dark.default.json"
    }
  ]
}
```

Чекер разворачивает декартово произведение применимости и завершается неудачей, если
для какой-либо объявленной темы, viewport или состояния нет уникального сценария. Когда
`overlay` равно true, каждому сценарию также требуется область захвата `full-page`. Коммит и
хэш финальной сборки должны совпадать с кандидатом каждого сценария, а
`recapturedAfterBuild` должно быть true.

Каждый манифест сценария записывает хэши, а не полагается на имена файлов:

```json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "module.component.light.default",
  "componentId": "module.component",
  "state": {
    "theme": "light",
    "viewport": { "width": 1440, "height": 900 },
    "interaction": "default"
  },
  "runtime": {
    "browserVersion": "pinned-browser-version",
    "devicePixelRatio": 1,
    "fontsHash": "sha256:generated-font-set-hash",
    "fixtureHash": "sha256:generated-fixture-hash"
  },
  "baseline": {
    "commit": "generated-baseline-commit",
    "buildHash": "sha256:generated-baseline-build-hash"
  },
  "candidate": {
    "commit": "generated-candidate-commit",
    "buildHash": "sha256:generated-candidate-build-hash",
    "recapturedAfterBuild": true
  },
  "requiredScopes": ["component", "context"],
  "captures": [
    {
      "scope": "component",
      "before": {
        "artifactId": "component-before",
        "path": "screenshots/component-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "component-after",
        "path": "screenshots/component-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "component-diff",
        "path": "screenshots/component-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    },
    {
      "scope": "context",
      "before": {
        "artifactId": "context-before",
        "path": "screenshots/context-before.png",
        "sha256": "sha256:generated-before-hash"
      },
      "after": {
        "artifactId": "context-after",
        "path": "screenshots/context-after.png",
        "sha256": "sha256:generated-after-hash"
      },
      "diff": {
        "artifactId": "context-diff",
        "path": "screenshots/context-diff.png",
        "sha256": "sha256:generated-diff-hash"
      }
    }
  ],
  "diff": {
    "changedPixels": 0,
    "totalPixels": 1296000,
    "changedRatio": 0,
    "pixelDeltaThreshold": 8,
    "changedRatioThreshold": 0.001,
    "disposition": "within-threshold",
    "result": "passed",
    "waiver": null
  },
  "console": { "unexpectedErrors": [] },
  "fixtureCleanup": { "temporaryArtifactsRemaining": [], "verified": true }
}
```

Приведённые выше значения показывают требуемую форму, а не валидные доказательства. Публикация
завершается неудачей, когда у изменённого компонента или требуемого состояния нет сценария,
отсутствует требуемая область захвата, отсутствует упомянутое изображение или хэш, сборки
устарели, остаются неожиданные ошибки в консоли, остаётся временный код фикстур либо diff
превышает допуск без рассмотренного дизайнерского исключения. Исключение фиксирует точное
число изменённых пикселей, дизайнерскую причину, рецензента и затронутый сценарий; оно не может
отменить отсутствующие захваты, ошибки в консоли или очистку фикстур.
