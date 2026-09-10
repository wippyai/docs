---
title: "Facade"
description: "Модуль wippy/facade предоставляет переносимый фасад, который загружает и настраивает фронтенд Wippy из CDN. Он отдаёт тонкую HTML-страницу, загружающую…"
---

# Facade

Модуль `wippy/facade` предоставляет переносимый фасад, который загружает и настраивает фронтенд Wippy из CDN. Он отдаёт тонкую HTML-страницу, загружающую запись JS-модуля Web Host (`module.js` для стандартной compat-оболочки или `managed-layout.js` для managed-режима), обрабатывает аутентификацию и связывает конфигурацию бэкенда с фронтендом. Загруженный модуль забирает себе всю страницу и её историю браузера.

Доставка через iframe (`iframe.html` плюс рукопожатие `SetConfig` через PostMessage) остаётся доступной для ручных встраиваний без фасада, когда вы сами встраиваете хост ради изоляции или использования на части страницы, но сам фасад её больше не использует.

## Настройка

Добавьте модуль в проект:

```bash
wippy add wippy/facade
wippy install
```

Объявите зависимость:

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8090
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: dep.facade
    kind: ns.dependency
    component: wippy/facade
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api
```

### Параметры конфигурации

| Параметр | Обязателен | По умолчанию | Описание |
|-----------|----------|---------|-------------|
| `server` | да | — | HTTP-сервер для раздачи статики и страниц |
| `router` | да | — | Публичный API-роутер для эндпоинта конфигурации |
| `fe_facade_url` | нет | `https://web-host.wippy.ai/<release-tag>` | Базовый CDN-URL бандла фронтенда |
| `fe_entry_path` | нет | `/iframe.html` | Путь к **iframe**-точке входа в бандле, используемый режимом встраивания через iframe. Текущая страница фасада вместо этого загружает точку входа JS-модуля (`module.js`/`managed-layout.js`); этот iframe-путь остаётся доступным для ручных встраиваний через iframe без фасада. |
| `fe_mode` | нет | `compat` | Какую оболочку загружает страница фасада: `compat` загружает `module.js` (стандартная оболочка чата); `managed` загружает `managed-layout.js` (опциональная декларативная многопанельная раскладка). Отдаётся на `/facade/config` как `mode`/`module_file`. |
| `host_config_layout` | нет | `{}` | JSON-конфигурация раскладки, выдаваемая как `hostConfig.layout`; используется только оболочкой **managed**. |
| `render_engine` | нет | `iframe` | Движок рендеринга страниц, выдаётся как `hostConfig.renderEngine`. См. [Движок рендеринга](#движок-рендеринга). |
| `login_path` | нет | `/login.html` | Путь на origin страницы, куда перенаправляются неаутентифицированные пользователи; работает вместе с `login_redirect_param`. |
| `login_redirect_param` | нет | `""` (выкл.) | Имя query-параметра, в который добавляется URL возврата после входа при перенаправлении на `login_path`. Пустое значение отключает добавление URL возврата. |
| `extra_scripts` | нет | `[]` | JSON-массив дополнительных URL скриптов, которые загружает страница фасада; выдаётся на `/facade/config` как `extraScripts`. |

### Движок рендеринга

`render_engine` выбирает [движок рендеринга страниц](../frontend/web-host/render-engines.md) для всего развёртывания. Он выдаётся как `hostConfig.renderEngine` и читается Web Host в его единственной точке ветвления рендеринга страницы.

| Значение | Эффект |
|-------|--------|
| `iframe` _(по умолчанию)_ | Страницы рендерятся как srcdoc-iframe — основной (стандартный) движок. |
| `fragment` | Страницы рендерятся как [Web Fragments](../frontend/web-host/render-engines.md) (реалм `reframed`, отражённый в shadow root). |

Включает режим только точная строка `fragment`; **любое другое значение — включая опечатку вроде `fragmnet` — приводится к `iframe`** (безопасно, но молча). Для включения fragment-движка также нужен [шлюз `/@fragment`](./views.md#web-fragments-gateway), который `wippy/views` (≥ 0.5.9) предоставляет сам — настройка на стороне потребителя не требуется. Страница может переопределить умолчание развёртывания для себя через [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine).

### Идентичность приложения

| Параметр | По умолчанию | Описание |
|-----------|---------|-------------|
| `app_title` | `Wippy` | Заголовок, отображаемый в боковой панели |
| `app_name` | `Wippy AI` | Полное имя приложения |
| `app_icon` | `wippy:logo` | Ссылка на иконку Iconify |

### Флаги функций

| Параметр | По умолчанию | Описание |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | Скрыть левую боковую панель навигации |
| `disable_right_panel` | `false` | Отключить правую боковую панель |
| `start_nav_open` | `false` | Панель навигации открыта по умолчанию |
| `show_admin` | `true` | Показать переключатель админ-панели |
| `allow_select_model` | `false` | Разрешить пользователю выбирать LLM-модель |
| `session_type` | `non-persistent` | Хранение токена аутентификации: `non-persistent` (в памяти) или `cookie`. Web Host трактует любое значение, кроме `cookie`, как `non-persistent`. |
| `history_mode` | `hash` | Режим истории браузера: `hash` или `browser`. Web Host трактует любое значение, кроме `browser`, как `hash`. |
| `hide_session_selector` | `false` | Скрыть интерфейс выбора сессии |

### Оформление

Применяются три области: **global** (везде), **host** (хром Web Host — боковая панель, чат, область страницы) и **children** (и дочерние iframe `view.page`, **и** веб-компоненты `view.component`). О том, какой поверхности достигает каждая настройка, см. [Матрицу доставки CSS](../frontend/web-host/css-injection.md#css-delivery-matrix).

| Параметр | Область | По умолчанию | Описание |
|-----------|-------|---------|-------------|
| `custom_css` | global | Импорт Google Fonts | Глобальный CSS — достигает хрома хоста, iframe `view.page` и shadow root `view.component` (1.0.43+). |
| `css_variables` | global | `{}` | JSON-карта произвольных CSS-кастомных свойств; компилируется для режимов Auto и forced и пробрасывается в shadow root компонентов. |
| `icon_sets` | global | `[]` | URL наборов иконок Iconify (только inline JSON — без `fs://`) |
| `host_custom_css` | host | `""` | CSS только для хрома хоста — не для потомков. Правила на основе классов ограничивайте селектором `.wippy-host-app`. |
| `host_css_variables` | host | `{}` | CSS-кастомные свойства только для хрома хоста |
| `host_icon_sets` | host | `[]` | Наборы иконок только для хоста (только inline JSON) |
| `children_custom_css` | children | `""` | CSS только для потомков — внедряется в iframe `view.page` и shadow root `view.component` (1.0.43+), но не в хром хоста |
| `children_css_variables` | children | `{}` | CSS-кастомные свойства только для потомков |

**Рекомендация по умолчанию:** общие и брендовые стили размещайте в `custom_css` и `css_variables` (global) — туда относится примерно 95% оформления, и оно достигает каждой поверхности. `host_custom_css` / `host_css_variables` оставьте для хрома, специфичного для хоста (боковая панель, панель чата, разделители). `view.component` отказывается от `*_custom_css` в shadow root через `customCss: false`.

#### Режим темы и сохранение

| Параметр | По умолчанию | Описание |
|-----------|---------|-------------|
| `theme_mode` | `auto` | Принудительная тема для хоста и потомков: `auto` (следовать ОС), `light` или `dark`. Выдаётся на `/facade/config` как `themeMode`. |
| `theme_persist` | `none` | Сохранять выбранную пользователем тему между перезагрузками: `none`, `cookie` или `localStorage`. В режиме `cookie` отрендеренная Jet оболочка читает cookie на сервере и применяет класс `w-theme-*` до первой отрисовки (без мигания). Выдаётся как `themePersist`. |
| `theme_storage_key` | `@wippy-theme-mode` | Ключ cookie / localStorage, под которым сохраняется режим. Выдаётся как `themeStorageKey` и зашивается в сгенерированный `/facade/theme-persist.js`. |

Сохранение темы **включается явно**: `theme_persist` по умолчанию равен `none`, поэтому ничего не сохраняется, пока развёртывание не установит `cookie` или `localStorage`. При включении фасад отдаёт готовый скрипт по адресу **`GET /facade/theme-persist.js`** с зашитыми ключом и режимом; подключайте его на любой странице, которая должна разделять тему. Полную модель, событие хоста `themeChanged` и интеграцию со страницами вне Wippy см. в [Сохранении темы](../frontend/web-host/theme-persistence.md).

#### Переиспользование оформления фасада на страницах вне Web Host

Страница, отдаваемая **вне** Web Host — ваш `login.html`, страница ошибки, страница подтверждения почты — может переиспользовать *ту же* брендовую тему фасада вместо её дублирования, так что токены и собственные правила живут в одном месте.

Сначала держите `custom_css` и `css_variables` в отдельных файлах, а не встраивайте их, и укажите параметрам на эти файлы через `fs://` плюс файловую систему `content_fs`:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Используйте `fs://` (разрешается через `content_fs` во время выполнения), а **не** `file://` — `file://` встраивается загрузчиком wippy относительно YAML на этапе загрузки. Держите файлы в той же статической папке, из которой отдаётся страница `login_path` (в `app` это `static/`, отдаваемая по `/app`).

Разрешение `fs://` применяется ровно к **шести параметрам оформления** — `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css`, `children_css_variables` (CSS-строки читаются как есть; JSON-файлы `*_css_variables` разбираются как карта переменных). `icon_sets` / `host_icon_sets` и любой другой JSON-параметр (`api_routes`, `chat`, `tanstack`, …) — **только inline**; `fs://` там не разрешается.

Отдельная страница затем подключает оба:

- **`custom_css`** — уже `.css`-файл, поэтому подключайте его напрямую оттуда, откуда он отдаётся.
- **`css_variables`** — JSON, поэтому его нельзя подключить как есть. Фасад рендерит его по адресу **`GET /facade/variables.css`** как базу плюс действующие блоки Auto-light, Auto-dark, принудительного Light и принудительного Dark. Значения верхнего уровня применяются везде; `@light` / `@dark` заменяют выбранные имена. Таблица кэшируется на 1 час и регистрируется на том же публичном роутере, что и `/facade/config`, поэтому несёт префикс роутера.

```html
<!-- в login.html, отдаваемом вне Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, сгенерированный CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- файл custom_css -->
```

Чтобы также разделять **режим темы** (чтобы `login.html` учитывал и сохранял тот же выбор светлой/тёмной темы, что и хост), добавьте сгенерированный скрипт сохранения темы и вызывайте его `write()` из своего переключателя:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- заранее применяет сохранённую тему и предоставляет window.wippyThemePersist -->
```

Полный пример переключателя см. в [Сохранение темы → Страницы вне Wippy](../frontend/web-host/theme-persistence.md).

### Опциональные JSON-параметры

Каждый из следующих параметров — строка, закодированная в JSON; значения по умолчанию пустые (`{}` или `[]`).

Эти четыре передаются без изменений под `hostConfig` для фронтенда:

| Параметр | По умолчанию | Описание |
|-----------|---------|-------------|
| `additional_nav_items` | `[]` | Дополнительные пункты боковой панели |
| `state_cache` | `{}` | Конфигурация кэша состояния фронтенда |
| `allow_additional_tags` | `{}` | Белый список тегов HTML-санитайзера (`Record<string, string[]>`, тег → разрешённые атрибуты) |
| `chat` | `{}` | Переопределения UI чата |

Эти три выдаются как поля `AppConfig` **верхнего уровня** (соседи `hostConfig`), а не внутри `hostConfig`:

| Параметр | Выдаётся как | По умолчанию | Описание |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | Переопределения маршрутов для фронтенда |
| `axios_defaults` | `axiosDefaults` | `{}` | Значения по умолчанию для HTTP-клиента axios на фронтенде |
| `tanstack` | `tanstack` | `{}` | Значения по умолчанию TanStack Query: `{ default?, content?, lists? }`. `default` применяется ко всем запросам; `content` нацелен на рендер одиночных ресурсов, `lists` — на запросы навигации и списков. Умолчание хоста — `refetchOnWindowFocus:false` |

## Эндпоинт конфигурации

Фасад регистрирует `GET /facade/config` на настроенном роутере. Этот путь регистрируется *на* публичном роутере, поэтому URL, который страница фактически запрашивает, включает префикс роутера — с префиксом из примера `/api/public` (см. [Настройка](#настройка)) это `/api/public/facade/config`, ровно то, что запрашивает поставляемая страница фасада. (Фасад регистрирует на том же роутере ещё один маршрут — `GET /facade/variables.css`, `css_variables`, отрендеренные как таблица стилей `text/css` для страниц вне Web Host; см. [Переиспользование оформления фасада на страницах вне Web Host](#переиспользование-оформления-фасада-на-страницах-вне-web-host).) Фронтенд запрашивает конфигурацию при загрузке:

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "login_redirect_param": null,
    "mode": "compat",
    "module_file": "/module.js",
    "extraScripts": null,
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
    "tanstack":      { "lists": { "refetchOnWindowFocus": true } },
    "theming": {
        "global":  { "customCSS": "...", "cssVariables": {}, "iconSets": {} },
        "host":    { "customCSS": "...", "cssVariables": {}, "iconSets": {}, "i18n": { "app": { "title": "Wippy", "icon": "wippy:logo", "appName": "Wippy AI" } } },
        "children": { "customCSS": "...", "cssVariables": {} }
    },
    "hostConfig": {
        "session": { "type": "non-persistent" },
        "history": "hash",
        "renderEngine": "iframe",
        "showAdmin": true,
        "allowSelectModel": false,
        "startNavOpen": false,
        "hideNavBar": false,
        "disableRightPanel": false,
        "hideSessionSelector": false,
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

API URL читается из переменной окружения `PUBLIC_API_URL`; `APP_WEBSOCKET_URL` получается заменой `http://` на `ws://` или `https://` на `wss://`. Оформление имеет три области (`global`, `host`, `children`) — `host.i18n` содержит брендинг приложения. Ключи `hostConfig` записаны в camelCase и собираются из параметров фасада: `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, плюс опциональные `additional_nav_items`, `state_cache`, `allow_additional_tags` и `chat`. `render_engine` становится `renderEngine` (см. [Движок рендеринга](#движок-рендеринга)). Параметры `api_routes`, `axios_defaults` и `tanstack` выдаются как поля `AppConfig` верхнего уровня (`apiRoutes`, `axiosDefaults`, `tanstack`), соседние с `hostConfig`, а не внутри него.

Поля `facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode` и `module_file` — поля **уровня оболочки**, используемые встраивающей страницей для сборки самой себя; они не входят в дочерний `AppConfig`, которым инициализируется хост. Поля `iframe_origin`/`iframe_url` используются только ручными встраиваниями через iframe без фасада (см. [Точка входа фасада](../frontend/web-host/entry-point.md)). Поле `mode` — нормализованный `fe_mode` (`compat` или `managed`), а `module_file` — точка входа JS-модуля, которую загружает страница фасада: `/module.js` для compat, `/managed-layout.js` для managed.

## Боковая панель навигации

Страницы, зарегистрированные через `wippy/views`, появляются в боковой панели автоматически на основании своих метаданных:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: tabler:chart-bar
      group: Analytics
      group_icon: tabler:chart-dots
      group_order: 10
      order: 1
      announced: true
      secure: true
      url: https://cdn.example.com/dashboard/
```

### Группы боковой панели

Страницы с одинаковым значением `group` собираются в сворачиваемые секции. Группы сортируются по `group_order` (меньшие первыми), страницы внутри групп — по `order`.

| Поле | Описание |
|-------|-------------|
| `group` | Имя категории, отображаемое в боковой панели |
| `group_icon` | Иконка заголовка категории |
| `group_order` | Позиция сортировки группы (меньше = выше) |
| `group_placement` | `"sidebar"` (в боковой панели) или `"default"` (только в основной области) |

Страницы без `group` появляются как элементы верхнего уровня.

### Управление видимостью

| Поле | Эффект |
|-------|--------|
| `announced: true` | Страница появляется в навигации боковой панели |
| `announced: false` | Страница скрыта из навигации, но доступна по URL |
| `inline: true` | Внутренняя страница, скрытая из всех списков UI |
| `hide_nav_bar: true` | Параметр фасада — скрывает всю левую боковую панель |

## Публикация со встроенными ресурсами

При публикации компонента, включающего статические файлы (например, каталог `public/` фасада), используйте `--embed`, чтобы включить в пакет записи `fs.directory`:

```bash
wippy publish --embed facade:public_files
```

Без `--embed` записи `fs.directory` исключаются из публикуемого пакета. Флаг `--embed` принимает ID записей или имена, соответствующие записям `fs.directory`.

## См. также

- [Views](./views.md) - Система страниц и компонентов
- [HTTP-сервер](../http/server.md) - Конфигурация HTTP-сервиса
- [Обзор фреймворка](./overview.md) - Использование модулей фреймворка
- [Точка входа фасада](../frontend/web-host/entry-point.md) - Как фасад загружает Web Host (со стороны фронтенда)
- [Внедрение CSS](../frontend/web-host/css-injection.md) - Как оформление фасада попадает в дочерние iframe
- [Движки рендеринга](../frontend/web-host/render-engines.md) - Рендеринг страниц через iframe или Web Fragment (переключатель `render_engine`)
