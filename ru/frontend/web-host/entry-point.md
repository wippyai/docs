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

```javascript
const configResponse = await fetch('/api/public/facade/config')
if (!configResponse.ok)
  throw new Error('Facade config request failed: ' + configResponse.status)
const cfg = await configResponse.json()

const storedAuth = localStorage.getItem('@wippy_token_info')
if (!storedAuth)
  throw new Error('Authentication is required before bootstrapping the host')
const { token } = JSON.parse(storedAuth)
if (typeof token !== 'string' || token.length === 0)
  throw new Error('Stored authentication does not contain a token')

const mapResponse = await fetch(cfg.facade_url + '/import-map.json')
if (!mapResponse.ok)
  throw new Error('Host import map request failed: ' + mapResponse.status)
const hostMap = await mapResponse.json()
await new Promise((resolve, reject) => {
  const script = document.createElement('script')
  script.src = cfg.facade_url + '/@wippy-fe/import-map-bootstrap.js'
  script.onload = resolve
  script.onerror = reject
  document.head.appendChild(script)
})
window.WippyImportMapBootstrap.register(undefined, hostMap, cfg.importMap, document.baseURI)

await import(cfg.facade_url + cfg.module_file)
window.initWippyApp({
  $schema: cfg.facade_url + '/schemas/wippy-context-2.2.json',
  auth: { token, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
  env: cfg.env,
  routePrefix: cfg.routePrefix,
  themeMode: window.wippyThemePersist?.read() || cfg.themeMode,
  apiRoutes: cfg.apiRoutes,
  attention: cfg.attention,
  allowSelectModel: cfg.allowSelectModel,
  hideSessionSelector: cfg.hideSessionSelector,
  allowAdditionalTags: cfg.allowAdditionalTags,
  axiosDefaults: cfg.axiosDefaults,
  iconify: cfg.iconify,
  importMap: cfg.importMap,
  theming: cfg.theming,
  hostConfig: cfg.hostConfig,
  context: { resourceId: '', resourceType: 'page' },
}, '#app')
```

Страница получает свою конфигурацию и передаёт её функции инициализации модуля. Хост монтируется в страницу, забирает маршрутизацию и историю браузера и переходит к полной инициализации.

> **Замечание о пути fetch.** `/facade/config` — это путь, который фасад регистрирует на публичном роутере; фактический URL, который запрашивает ваша страница, включает префикс этого роутера. С примером префикса `/api/public` это будет `/api/public/facade/config` — ровно то, что запрашивает поставляемая страница фасада. Встроенные фрагменты `fetch('/facade/config')` здесь сокращены для читаемости.

## Поток конфигурации

Поток конфигурации состоит из двух шагов:

1. Страница запрашивает `/facade/config` у публичного роутера того же origin.

2. Оболочка получает import map Host, загружает общий bootstrap и регистрирует карту Host, объединённую с `cfg.importMap`. Только после этого она динамически импортирует `cfg.module_file`. Оболочка собирает `AppConfig` из возвращённых полей и добавляет схему `wippy-context-2.2`, `auth` и `context` перед вызовом `initWippyApp`.

Web Host извлекает полезную нагрузку `AppConfig` из объекта конфигурации и переходит к полной инициализации. С этого момента скрипт страницы пассивен — всё взаимодействие с пользователем происходит внутри смонтированного хоста.

Такой подход означает, что размещённый на CDN бандл никогда не содержит URL, токенов или брендинга конкретного развёртывания. Бандл одинаков для всех развёртываний. Различается только полезная нагрузка конфигурации.

Эндпоинт возвращает настройки оболочки и выбранные поля Web Host. Он не возвращает полный `AppConfig`: оболочка добавляет `$schema`, `auth` и `context` перед вызовом `initWippyApp`. Текущий контракт — `wippy-context-2.2`.

## Ответ `/facade/config`

Эндпоинт возвращает настройки оболочки и выбранные поля Web Host. Он не возвращает полный `AppConfig`: оболочка добавляет `$schema`, `auth` и `context` перед вызовом `initWippyApp`. Текущий контракт — `wippy-context-2.2`.

```json
{
  "facade_url": "https://web-host.wippy.ai/<release-tag>",
  "iframe_origin": "https://web-host.wippy.ai",
  "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
  "login_path": "/login.html",
  "login_redirect_param": "return_to",
  "mode": "compat",
  "module_file": "/module.js",
  "env": {
    "APP_API_URL": "https://api.example.com",
    "APP_AUTH_API_URL": "https://api.example.com",
    "APP_WEBSOCKET_URL": "wss://api.example.com"
  },
  "routePrefix": "https://api.example.com",
  "themeMode": "auto",
  "themePersist": "localStorage",
  "themeStorageKey": "@wippy-theme-mode",
  "axiosDefaults": { "timeout": 30000 },
  "apiRoutes": { "agents": { "list": "/custom/agents" } },
  "tanstack": { "lists": { "refetchOnWindowFocus": true } },
  "iconify": {},
  "importMap": {
    "imports": { "example-package": "https://cdn.example.com/example-package.js" }
  },
  "extraScripts": ["/monitoring.js"],
  "theming": {},
  "hostConfig": {}
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
| `$schema` | Версия контракта конфигурации (`"wippy-context-2.2"`). |
| `auth` | Рантайм-токен bearer и срок его действия, внедряемые как `AppConfig.auth`. |
| `env` | Рантайм-URL, внедряемые как `AppConfig.env` верхнего уровня. |
| `routePrefix` | Префикс URL API, передаваемый дочерним приложениям. |
| `axiosDefaults` | Умолчания экземпляра axios, передаваемые дочерним приложениям. |
| `apiRoutes` | Переопределение путей отдельных конечных точек API (поле `AppConfig` верхнего уровня). |
| `tanstack` | Умолчания TanStack Query — глобальные + по ролевой категории (`content`/`lists`); поле `AppConfig` верхнего уровня. Умолчание хоста — `refetchOnWindowFocus:false`. |
| `iconify` | Явно настроенные источники Iconify, переданные из `cfg.iconify`. |
| `importMap` | Необязательное расширение browser import map из `cfg.importMap`; оболочка регистрирует его до импорта модулей Host. |
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

```javascript
async function mountWippyIframe(auth) {
  const response = await fetch('/api/public/facade/config')
  if (!response.ok)
    throw new Error(`Facade config request failed: ${response.status}`)
  const cfg = await response.json()
  const iframe = document.getElementById('wippy')
  if (!(iframe instanceof HTMLIFrameElement))
    throw new Error('Expected <iframe id="wippy">')

  const iframeUrl = new URL(cfg.iframe_url)
  if (iframeUrl.origin !== cfg.iframe_origin)
    throw new Error('iframe_url and iframe_origin must identify the same origin')

  const appConfig = {
    $schema: `${cfg.facade_url}/schemas/wippy-context-2.2.json`,
    auth,
    env: cfg.env,
    routePrefix: cfg.routePrefix,
    themeMode: cfg.themeMode,
    apiRoutes: cfg.apiRoutes,
    axiosDefaults: cfg.axiosDefaults,
    iconify: cfg.iconify,
    importMap: cfg.importMap,
    tanstack: cfg.tanstack,
    theming: cfg.theming,
    hostConfig: cfg.hostConfig,
    context: { resourceId: '', resourceType: 'page' },
  }

  function onMessage(event) {
    if (event.origin !== cfg.iframe_origin || event.source !== iframe.contentWindow)
      return

    let message
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    }
    catch {
      return
    }
    if (message?.type === '@gen2-chat' && message.action === 'get-config') {
      event.source.postMessage(
        JSON.stringify({ type: '@gen2-chat', action: 'set-config', ...appConfig }),
        cfg.iframe_origin,
      )
    }
  }

  window.addEventListener('message', onMessage)

  // iframe_url already includes ?waitForCustomConfig
  iframe.src = iframeUrl.href

  return function unmount() {
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
```

Параметр `?waitForCustomConfig` заставляет standalone bootstrap ждать сообщение `set-config` от родителя до регистрации import map и импорта модулей приложения Host. На этом этапе приложение еще не смонтировано. Без параметра выполняется обычный standalone-путь конфигурации.

Рукопожатие использует протокол PostMessage `@gen2-chat`:

1. Родитель запрашивает `GET /facade/config` (или сам предоставляет эквивалентную полезную нагрузку `AppConfig`) и создаёт iframe, указывающий на `iframe_url`.
2. Загружающийся iframe отправляет родителю `{ type: '@gen2-chat', action: 'get-config' }`.
3. Слушатель `message` родителя отвечает `{ type: '@gen2-chat', action: 'set-config', ...config }`, нацеленным на `iframe_origin`.

При последующем изменении конфигурации отправьте полное сообщение `set-config`
этому же iframe, указав `iframe_origin`. Host применяет изменение без
перемонтирования. API-запросы iframe используют origin его документа.
Размещайте backend API на том же origin или настройте CORS-политику backend,
чтобы разрешить origin документа iframe. CORS настраивается на backend, это не
параметр AppConfig.

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

## Передача import map в Host

Получатель принимает iframe `SetConfig` только от физического родительского окна. Если origin родителя доступен, он также сравнивает с ним `event.origin`. В Web Fragment сообщение должно быть адресовано собственному `fragmentId` этого экземпляра.

Требование фасада называется `import_map`; `/facade/config` возвращает его как `cfg.importMap`. Перед импортом модуля Host shell передает это значение общему bootstrap import map. Затем он передает `importMap: cfg.importMap` в начальную конфигурацию `initWippyApp`. См. [Последовательность запуска](./bootstrap.md#appconfig-import-map). Изменение import map не влияет на уже открытый документ. Перезагрузите или создайте документ заново, чтобы использовать новую карту.

Используйте это поле только с развернутой версией Host, в документации которой указана поддержка.
