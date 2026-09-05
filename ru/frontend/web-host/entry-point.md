---
title: "Точка входа фасада"
description: "Бэкенд-модуль wippy/facade — это точка входа, доставляющая Web Host пользователям. Он раздаёт HTML-страницу, которая загружает JS-модуль Web Host,…"
---

# Точка входа фасада

Бэкенд-модуль `wippy/facade` — это точка входа, доставляющая Web Host пользователям. Он раздаёт HTML-страницу, которая загружает JS-модуль Web Host, обрабатывает редиректы аутентификации, предоставляет конечную точку `/facade/config` и переносит конфигурацию конкретного развёртывания во фронтенд-бандл, размещённый на CDN. В сам бандл никакая конфигурация не запекается — каждое развёртывание предоставляет свою через этот механизм.

![Точка входа фасада](../diagrams/facade-entry-point.svg)

## HTML-страница

Когда пользователь переходит в приложение Wippy, `wippy/facade` раздаёт HTML-страницу. Эта страница тонкая: она загружает JS-модуль Web Host с CDN и инициализирует хост конфигурацией, возвращённой из `/facade/config`. Модуль забирает себе всю страницу, включая историю браузера, поэтому хост работает как всё приложение, а не внутри iframe.

Фасад загружает одну из двух точек входа JS-модуля в зависимости от настроенного `fe_mode`:

- **`module.js`** — оболочка **compat** (по умолчанию): стандартная вёрстка с навигационной боковой панелью, областью страницы и правой панелью чата.
- **`managed-layout.js`** — оболочка **managed** (по согласию, ранний доступ): декларативная многопанельная вёрстка.

Упрощённая версия страницы выглядит так:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://web-host.wippy.ai/<release-tag>/module.js"></script>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        window.initWippyApp(config, '#app')
      })
  </script>
</body>
</html>
```

Страница получает свою конфигурацию и передаёт её функции инициализации модуля. Хост монтируется в страницу, забирает маршрутизацию и историю браузера и переходит к полной инициализации.

> **Замечание о пути fetch.** `/facade/config` — это путь, который фасад регистрирует на публичном роутере; фактический URL, который запрашивает ваша страница, включает префикс этого роутера. С примером префикса `/api/public` это будет `/api/public/facade/config` — ровно то, что запрашивает поставляемая страница фасада. Встроенные фрагменты `fetch('/facade/config')` здесь сокращены для читаемости.

## Поток конфигурации

Поток конфигурации состоит из двух шагов:

1. Встроенный JavaScript страницы вызывает `GET /facade/config` на том же origin, что и страница. Эта конечная точка регистрируется модулем `wippy/facade` на публичном роутере.
2. Получив ответ, страница передаёт полный объект конфигурации функции инициализации загруженного JS-модуля (`window.initWippyApp(config, rootContainer?)`).

Web Host извлекает полезную нагрузку `AppConfig` из объекта конфигурации и переходит к полной инициализации. С этого момента скрипт страницы пассивен — всё взаимодействие с пользователем происходит внутри смонтированного хоста.

Такой подход означает, что размещённый на CDN бандл никогда не содержит URL, токенов или брендинга конкретного развёртывания. Бандл одинаков для всех развёртываний. Различается только полезная нагрузка конфигурации.

> **Поля оболочки против дочернего `AppConfig`.** Ответ `/facade/config` несёт и то, и другое. Поля вроде `facade_url`, `iframe_origin`, `iframe_url` и `login_path` — это поля **уровня оболочки**, потребляемые встраивающей страницей для собственного построения; они не входят в дочерний `AppConfig`. `AppConfig`, которым хост фактически инициализируется, — это `auth`, `env`, `theming`, `hostConfig`, `context` и прочие поля, документированные ниже.

## Ответ `/facade/config`

Конечная точка конфигурации возвращает JSON-объект, несущий и поля уровня оболочки, и дочерний `AppConfig`. Страница фасада передаёт его функции инициализации модуля хоста; ручное встраивание в iframe вместо этого доставляет часть `AppConfig` через PostMessage (см. ниже). Все поля собираются `wippy/facade` из его параметров модуля и работающего окружения:

```json
{
  "$schema": "wippy-context-2.0",
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "auth": {
    "token": "eyJ...",
    "expiresAt": "2026-06-01T12:00:00Z"
  },
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "axiosDefaults": {},
  "apiRoutes": {},
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "theming": {
    "global": {
      "customCSS": "@import url('https://fonts.googleapis.com/...');",
      "cssVariables": { "--p-primary": "#6366f1" },
      "iconSets": {}
    },
    "host": {
      "customCSS": ".wippy-host-app .chat-container { background: var(--p-content-background); }",
      "cssVariables": {},
      "iconSets": {},
      "i18n": {
        "app": {
          "title": "My App",
          "icon": "wippy:logo",
          "appName": "My Application"
        }
      }
    },
    "children": {
      "customCSS": "",
      "cssVariables": {}
    }
  },
  "hostConfig": {
    // примерные значения — умолчания приведены в таблице ниже
    "session": { "type": "non-persistent" },
    "history": "hash",
    "showAdmin": true,
    "allowSelectModel": false,
    "startNavOpen": false,
    "hideNavBar": false,
    "disableRightPanel": false,
    "hideSessionSelector": false,
    "additionalNavItems": [],
    "stateCache": {},
    "allowAdditionalTags": [],
    "chat": {}
  },
  "context": {
    "resourceId": "root",
    "resourceType": "page",
    "route": "/"
  }
}
```

### Справочник полей

**Поля уровня оболочки** — потребляются встраивающей страницей для собственного построения; в дочерний `AppConfig` не входят:

| Поле | Описание |
|-------|-------------|
| `facade_url` | Базовый URL CDN для бандла Web Host. Используется для разрешения входа модуля и вендорных скриптов. |
| `iframe_origin` | Значение заголовка `Origin` для CDN. Используется как `targetOrigin` для PostMessage при ручном встраивании в iframe (см. ниже). |
| `iframe_url` | Полный `src` iframe, включая `?waitForCustomConfig`. Используется только при ручном встраивании в iframe без фасада (см. ниже). |
| `login_path` | Путь на origin страницы, куда перенаправляются неаутентифицированные пользователи. |

**Поля дочернего `AppConfig`** — передаются функции инициализации хоста и потребляются работающим хостом:

| Поле | Описание |
|-------|-------------|
| `$schema` | Версия контракта конфигурации (`"wippy-context-2.0"`). |
| `auth` | Рантайм-токен bearer и срок его действия, внедряемые как `AppConfig.auth`. |
| `env` | Рантайм-URL, внедряемые как `AppConfig.env` верхнего уровня. |
| `routePrefix` | Префикс URL API, передаваемый дочерним приложениям. |
| `axiosDefaults` | Умолчания экземпляра axios, передаваемые дочерним приложениям. |
| `apiRoutes` | Переопределение путей отдельных конечных точек API (поле `AppConfig` верхнего уровня). |
| `tanstack` | Умолчания TanStack Query — глобальные + по ролевой категории (`content`/`lists`); поле `AppConfig` верхнего уровня. Умолчание хоста — `refetchOnWindowFocus:false`. |
| `theming` | Настройка CSS, разделённая на три области. |
| `hostConfig` | Флаги функциональности и настройка интерфейса Web Host. |
| `context` | Начальный контекст страницы или артефакта для хоста. |

**Поля `env`:**

| Поле | Источник | Описание |
|-------|--------|-------------|
| `APP_API_URL` | Переменная окружения `PUBLIC_API_URL` | Базовый URL для всех HTTP-вызовов к бэкенду |
| `APP_AUTH_API_URL` | То же, что `APP_API_URL` | URL конечной точки аутентификации (может отличаться в нестандартных конфигурациях) |
| `APP_WEBSOCKET_URL` | Выводится из `APP_API_URL` | `http://` → `ws://`, `https://` → `wss://` |

**Области `theming`:**

| Область | Применяется к |
|-------|-----------|
| `global` | И к оболочке хоста, и ко всем дочерним iframe |
| `host` | Только к оболочке хоста. Также несёт `i18n.app` для заголовка приложения, иконки и имени, отображаемых в боковой панели. |
| `children` | Только к дочерним iframe (вставляется скриптом прокси) |

**Поля `hostConfig`:**

| Поле | Тип | По умолчанию | Описание |
|-------|------|---------|-------------|
| `session.type` | `"non-persistent"` \| `"cookie"` | `"non-persistent"` | Режим хранения токена |
| `history` | `"hash"` \| `"browser"` | `"hash"` | Режим истории Vue Router |
| `showAdmin` | boolean | `true` | Показывать административные возможности в интерфейсе |
| `allowSelectModel` | boolean | `false` | Показывать выбор модели LLM |
| `startNavOpen` | boolean | `false` | Разворачивать навигационную боковую панель при загрузке |
| `hideNavBar` | boolean | `false` | Полностью скрыть левую навигационную боковую панель |
| `disableRightPanel` | boolean | `false` | Отключить правую панель артефактов |
| `hideSessionSelector` | boolean | `false` | Скрыть выбор сессии чата |
| `additionalNavItems` | array | `[]` | Дополнительные пункты, добавляемые в боковую панель |
| `stateCache` | object | `{}` | Конфигурация LRU-кэша состояния дочерних iframe |
| `allowAdditionalTags` | object | `{}` | Белый список тегов санитайзера HTML (`Record<string, string[]>`, тег → допустимые атрибуты) |
| `chat` | object | `{}` | Переопределения интерфейса чата (поведение вставки в файл и т. д.) |

## Поток аутентификации

Если пользователь не аутентифицирован при загрузке страницы, `wippy/facade` перенаправляет на `login_path` до раздачи HTML-страницы. После успешного входа пользователь возвращается на исходный URL. Состояние аутентификации не передаётся через саму конфигурацию Web Host — Web Host доверяет токену аутентификации, встроенному в `auth`/`env` ответом аутентифицированной страницы.

Поскольку конечную точку конфигурации обслуживает та же аутентифицированная сессия, что раздала HTML-страницу, `APP_API_URL` и производный URL WebSocket автоматически отражают правильный бэкенд для этого пользователя.

## Функция инициализации модуля

Точка входа JS-модуля регистрирует на странице `window.initWippyApp`. Страница фасада вызывает её с объектом конфигурации, полученным из `/facade/config`. `fe_mode` выбирает, какой модуль загружает фасад — `module.js` для **compat**, `managed-layout.js` для **managed** — и оба предоставляют одну и ту же входную функцию `initWippyApp`. Выбор модуля определяет, какая оболочка отрисовывается; он не зависит от стиля встраивания (страница с JS-модулем против ручного iframe).

`initWippyApp(config, rootContainer?)` возвращает простой генератор событий:

```javascript
const events = window.initWippyApp(config, '#app')
events.on('ready', () => console.log('Wippy loaded'))
events.on('error', err => console.error('Failed to load:', err))
```

При вызове без корневого контейнера хост монтируется в элемент по умолчанию. С этого момента хост забирает себе страницу и её историю браузера.

## Ручное встраивание в iframe (без фасада)

Описанная выше страница с JS-модулем — стандартный, рекомендуемый путь, и именно его использует текущий фасад. Существует и второй механизм встраивания для случаев, когда полноценный хост нужно запустить **внутри iframe** — например, чтобы занять лишь часть страницы с более сильной изоляцией от окружающего приложения. В этом режиме вы встраиваете хост сами; фасад такую страницу не создаёт.

![Ручное встраивание в iframe](../diagrams/manual-iframe-embedding.svg)

Вы всё равно можете переиспользовать конечную точку фасада `/facade/config`, чтобы получить URL и конфигурацию: её `iframe_url` (точка входа хоста `iframe.html` с уже добавленным `?waitForCustomConfig`) и `iframe_origin` (`targetOrigin` для PostMessage) существуют именно для этого пути. Далее вы сами создаёте iframe и завершаете рукопожатие конфигурации.

В отличие от пути с JS-модулем, хост внутри iframe **запрашивает** свою конфигурацию: он загружается и отправляет родителю сообщение `get-config`, а родитель отвечает `set-config`. Поэтому родитель **слушает** запрос, а не проталкивает конфигурацию вслепую по событию `load`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <iframe id="wippy" style="width:100%;height:100vh;border:none"></iframe>
  <script>
    fetch('/facade/config')
      .then(r => r.json())
      .then(config => {
        const iframe = document.getElementById('wippy')

        // Слушаем запрос конфигурации @gen2-chat от потомка и отвечаем на него.
        window.addEventListener('message', (event) => {
          if (event.origin !== config.iframe_origin) return
          const msg = event.data
          if (msg?.type === '@gen2-chat' && msg.action === 'get-config') {
            iframe.contentWindow.postMessage(
              { type: '@gen2-chat', action: 'set-config', ...config },
              config.iframe_origin
            )
          }
        })

        // iframe_url уже содержит ?waitForCustomConfig
        iframe.src = config.iframe_url
      })
  </script>
</body>
</html>
```

Query-параметр `?waitForCustomConfig` (уже присутствующий в `iframe_url`) — ключевой сигнал. Он говорит Web Host приостановить инициализацию: приложение монтируется, но намеренно не пытается разрешить аутентификацию или загрузить маршруты, пока не получит сообщение `set-config`. Без него Web Host попытался бы прочитать токены аутентификации из параметров URL или умолчаний, что неуместно для встроенных развёртываний.

Рукопожатие использует протокол PostMessage `@gen2-chat`:

1. Родитель запрашивает `GET /facade/config` (или сам предоставляет эквивалентную полезную нагрузку `AppConfig`) и создаёт iframe, указывающий на `iframe_url`.
2. Загружающийся iframe отправляет родителю `{ type: '@gen2-chat', action: 'get-config' }`.
3. Слушатель `message` родителя отвечает `{ type: '@gen2-chat', action: 'set-config', ...config }`, нацеленным на `iframe_origin`.

Web Host извлекает полезную нагрузку `AppConfig` и переходит к полной инициализации. Полный протокол сообщений (конверт `@gen2-chat` и перечисление `IFrameMessageType`) см. в [Прокси и изоляция](./proxy-isolation.md). Это рукопожатие `SetConfig` специфично для ручного встраивания без фасада; модуль `wippy/facade` вместо этого загружает Web Host как JS-модуль.

## Настройка модуля фасада

Параметры `wippy/facade`, формирующие приведённый выше ответ конфигурации, задаются в вашем `_index.yaml`. Реальный пример из `app-template`:

```yaml
- name: facade
  kind: ns.dependency
  component: wippy/facade
  version: '>=v0.5.37'
  parameters:
    - name: server
      value: app:gateway
    - name: router
      value: app:api.public
    - name: app_title
      value: Wippy App
    - name: app_name
      value: Wippy App
    - name: app_icon
      value: "wippy:logo"
    - name: show_admin
      value: "false"
    - name: hide_nav_bar
      value: "true"
    - name: login_path
      value: /app/login.html
    - name: session_type
      value: non-persistent
    - name: history_mode
      value: browser
    - name: custom_css
      value: "@import url('https://fonts.googleapis.com/css2?family=Poppins...');
             body { font-family: 'Poppins', sans-serif; }"
    - name: css_variables
      value: '{"--p-primary":"#6366f1"}'
    - name: host_custom_css
      value: ".wippy-host-app .chat-container { background: var(--p-content-background); }"
    - name: tanstack
      value: '{"lists":{"refetchOnWindowFocus":true}}'
```

Полный список доступных параметров и их умолчаний см. в [справочнике модуля фасада](../../framework/facade.md).
